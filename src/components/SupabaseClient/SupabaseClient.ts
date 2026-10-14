import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import type {
  Product,
  InventorySession,
  ScannedItem,
  DivergenceLog,
  ExpiryAlert,
  Store,
  User as UserType,
  APIResponse,
  PaginatedResponse,
  SyncStatus,
  OfflineQueueItem,
  DatabaseSchema,
} from '../../types';
import { generateId, retry, isOnline, onOnline, onOffline } from '@utils/helpers';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export class SupabaseService {
  private client: SupabaseClient | null = null;
  private offlineQueue: OfflineQueueItem[] = [];
  private syncStatus: SyncStatus = { pending: 0, synced: 0, failed: 0 };
  private isSyncing = false;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();
  private currentUser: User | null = null;
  currentSession: Session | null = null;

  constructor() {
      if (SUPABASE_URL && SUPABASE_ANON_KEY) {
        this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
          db: {
            schema: 'public',
          },
          realtime: {
            params: {
              eventsPerSecond: 10,
            },
          },
        });
        this.setupAuthListener();
        this.setupNetworkListeners();
        this.startSyncLoop();
      } else {
        // No Supabase config - emit initial auth state to avoid infinite loading
        this.currentUser = null;
        this.currentSession = null;
        setTimeout(() => {
          this.emit('authChange', { event: 'INITIAL_SESSION', session: null, user: null });
        }, 0);
      }
    }

  private setupAuthListener(): void {
    if (!this.client) return;

    this.client.auth.onAuthStateChange((event, session) => {
      this.currentSession = session;
      this.currentUser = session?.user ?? null;
      this.emit('authChange', { event, session, user: this.currentUser });

      if (event === 'SIGNED_IN' && session) {
        this.processOfflineQueue();
      }
    });

    this.client.auth.getSession().then(({ data: { session } }) => {
      this.currentSession = session;
      this.currentUser = session?.user ?? null;
    });
  }

  private setupNetworkListeners(): void {
    const cleanupOnline = onOnline(() => {
      this.emit('networkChange', { online: true });
      this.processOfflineQueue();
    });

    const cleanupOffline = onOffline(() => {
      this.emit('networkChange', { online: false });
    });

    this.on('destroy', () => {
      cleanupOnline();
      cleanupOffline();
    });
  }

  private startSyncLoop(): void {
    this.syncInterval = setInterval(() => {
      if (isOnline() && !this.isSyncing && this.offlineQueue.length > 0) {
        this.processOfflineQueue();
      }
    }, 30000);
  }

  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }

  on(event: string, callback: (data: unknown) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: (data: unknown) => void): void {
    this.listeners.get(event)?.delete(callback);
  }

  getClient(): SupabaseClient | null {
    return this.client;
  }

  isAuthenticated(): boolean {
    return !!this.currentUser;
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  getCurrentSession(): Session | null {
    return this.currentSession;
  }

  async signIn(email: string, password: string): Promise<APIResponse<{ user: User; session: Session }>> {
    if (!this.client) return { data: null, error: { code: 'NOT_INITIALIZED', message: 'Supabase não configurado' } };

    try {
      const { data, error } = await this.client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { data: { user: data.user, session: data.session } as any, error: null };
    } catch (error) {
      return { data: null, error: { code: 'AUTH_ERROR', message: error instanceof Error ? error.message : 'Erro de autenticação' } };
    }
  }

  async signUp(email: string, password: string, metadata?: Record<string, unknown>): Promise<APIResponse<{ user: User; session: Session }>> {
    if (!this.client) return { data: null, error: { code: 'NOT_INITIALIZED', message: 'Supabase não configurado' } };

    try {
      const { data, error } = await this.client.auth.signUp({ email, password, options: { data: metadata } });
      if (error) throw error;
      return { data: { user: data.user, session: data.session } as any, error: null };
    } catch (error) {
      return { data: null, error: { code: 'AUTH_ERROR', message: error instanceof Error ? error.message : 'Erro no cadastro' } };
    }
  }

  async signOut(): Promise<APIResponse<void>> {
    if (!this.client) return { data: null, error: { code: 'NOT_INITIALIZED', message: 'Supabase não configurado' } };

    try {
      const { error } = await this.client.auth.signOut();
      if (error) throw error;
      return { data: undefined, error: null };
    } catch (error) {
      return { data: null, error: { code: 'AUTH_ERROR', message: error instanceof Error ? error.message : 'Erro ao sair' } };
    }
  }

  async getProducts(storeId: string, options?: { search?: string; limit?: number; offset?: number }): Promise<APIResponse<PaginatedResponse<Product>>> {
    if (!this.client) return { data: null, error: { code: 'NOT_INITIALIZED', message: 'Supabase não configurado' } };

    try {
      let query = this.client.from('products').select('*', { count: 'exact' }).eq('store_id', storeId);

      if (options?.search) {
        query = query.or(`name.ilike.%${options.search}%,gtin.ilike.%${options.search}%`);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data, error, count } = await query.order('name');
      if (error) throw error;

      return {
        data: {
          data: data as Product[],
          count: count || 0,
          page: Math.floor((options?.offset || 0) / (options?.limit || 50)) + 1,
          pageSize: options?.limit || 50,
          hasMore: (options?.offset || 0) + (data?.length || 0) < (count || 0),
        },
        error: null,
      };
    } catch (error) {
      return { data: null, error: { code: 'QUERY_ERROR', message: error instanceof Error ? error.message : 'Erro ao buscar produtos' } };
    }
  }

  async getProductByGTIN(storeId: string, gtin: string): Promise<APIResponse<Product | null>> {
    if (!this.client) return { data: null, error: { code: 'NOT_INITIALIZED', message: 'Supabase não configurado' } };

    try {
      const { data, error } = await this.client
        .from('products')
        .select('*')
        .eq('store_id', storeId)
        .eq('gtin', gtin)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return { data: data as Product | null, error: null };
    } catch (error) {
      return { data: null, error: { code: 'QUERY_ERROR', message: error instanceof Error ? error.message : 'Erro ao buscar produto' } };
    }
  }

  async createProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<APIResponse<Product>> {
    if (!this.client) return { data: null, error: { code: 'NOT_INITIALIZED', message: 'Supabase não configurado' } };

    try {
      const now = new Date().toISOString();
      const { data, error } = await this.client
        .from('products')
        .insert({ ...product, id: generateId('prod'), created_at: now, updated_at: now })
        .select()
        .single();

      if (error) throw error;
      return { data: data as Product, error: null };
    } catch (error) {
      return { data: null, error: { code: 'MUTATION_ERROR', message: error instanceof Error ? error.message : 'Erro ao criar produto' } };
    }
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<APIResponse<Product>> {
    if (!this.client) return { data: null, error: { code: 'NOT_INITIALIZED', message: 'Supabase não configurado' } };

    try {
      const { data, error } = await this.client
        .from('products')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data: data as Product, error: null };
    } catch (error) {
      return { data: null, error: { code: 'MUTATION_ERROR', message: error instanceof Error ? error.message : 'Erro ao atualizar produto' } };
    }
  }

  async createSession(session: Omit<InventorySession, 'id' | 'createdAt' | 'updatedAt'>): Promise<APIResponse<InventorySession>> {
    if (!this.client) return { data: null, error: { code: 'NOT_INITIALIZED', message: 'Supabase não configurado' } };

    try {
      const now = new Date().toISOString();
      const { data, error } = await this.client
        .from('inventory_sessions')
        .insert({ ...session, id: generateId('sess'), created_at: now, updated_at: now })
        .select()
        .single();

      if (error) throw error;
      return { data: data as InventorySession, error: null };
    } catch (error) {
      return { data: null, error: { code: 'MUTATION_ERROR', message: error instanceof Error ? error.message : 'Erro ao criar sessão' } };
    }
  }

  async updateSession(id: string, updates: Partial<InventorySession>): Promise<APIResponse<InventorySession>> {
    if (!this.client) return { data: null, error: { code: 'NOT_INITIALIZED', message: 'Supabase não configurado' } };

    try {
      const { data, error } = await this.client
        .from('inventory_sessions')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data: data as InventorySession, error: null };
    } catch (error) {
      return { data: null, error: { code: 'MUTATION_ERROR', message: error instanceof Error ? error.message : 'Erro ao atualizar sessão' } };
    }
  }

  async getSession(id: string): Promise<APIResponse<InventorySession | null>> {
    if (!this.client) return { data: null, error: { code: 'NOT_INITIALIZED', message: 'Supabase não configurado' } };

    try {
      const { data, error } = await this.client
        .from('inventory_sessions')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return { data: data as InventorySession | null, error: null };
    } catch (error) {
      return { data: null, error: { code: 'QUERY_ERROR', message: error instanceof Error ? error.message : 'Erro ao buscar sessão' } };
    }
  }

  async getSessions(storeId: string, options?: { status?: InventorySession['status']; limit?: number; offset?: number }): Promise<APIResponse<PaginatedResponse<InventorySession>>> {
    if (!this.client) return { data: null, error: { code: 'NOT_INITIALIZED', message: 'Supabase não configurado' } };

    try {
      let query = this.client.from('inventory_sessions').select('*', { count: 'exact' }).eq('store_id', storeId);

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
      }

      const { data, error, count } = await query.order('started_at', { ascending: false });
      if (error) throw error;

      return {
        data: {
          data: data as InventorySession[],
          count: count || 0,
          page: Math.floor((options?.offset || 0) / (options?.limit || 20)) + 1,
          pageSize: options?.limit || 20,
          hasMore: (options?.offset || 0) + (data?.length || 0) < (count || 0),
        },
        error: null,
      };
    } catch (error) {
      return { data: null, error: { code: 'QUERY_ERROR', message: error instanceof Error ? error.message : 'Erro ao buscar sessões' } };
    }
  }

  async createScannedItem(item: Omit<ScannedItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<APIResponse<ScannedItem>> {
    if (!this.client) return { data: null, error: { code: 'NOT_INITIALIZED', message: 'Supabase não configurado' } };

    try {
      const now = new Date().toISOString();
      const { data, error } = await this.client
        .from('scanned_items')
        .insert({ ...item, id: generateId('item'), created_at: now, updated_at: now })
        .select()
        .single();

      if (error) throw error;
      return { data: data as ScannedItem, error: null };
    } catch (error) {
      return { data: null, error: { code: 'MUTATION_ERROR', message: error instanceof Error ? error.message : 'Erro ao criar item escaneado' } };
    }
  }

  async updateScannedItem(id: string, updates: Partial<ScannedItem>): Promise<APIResponse<ScannedItem>> {
    if (!this.client) return { data: null, error: { code: 'NOT_INITIALIZED', message: 'Supabase não configurado' } };

    try {
      const { data, error } = await this.client
        .from('scanned_items')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data: data as ScannedItem, error: null };
    } catch (error) {
      return { data: null, error: { code: 'MUTATION_ERROR', message: error instanceof Error ? error.message : 'Erro ao atualizar item' } };
    }
  }

  async getScannedItems(sessionId: string): Promise<APIResponse<ScannedItem[]>> {
    if (!this.client) return { data: null, error: { code: 'NOT_INITIALIZED', message: 'Supabase não configurado' } };

    try {
      const { data, error } = await this.client
        .from('scanned_items')
        .select('*')
        .eq('session_id', sessionId)
        .order('scanned_at', { ascending: false });

      if (error) throw error;
      return { data: data as ScannedItem[], error: null };
    } catch (error) {
      return { data: null, error: { code: 'QUERY_ERROR', message: error instanceof Error ? error.message : 'Erro ao buscar itens' } };
    }
  }

  async createDivergenceLog(log: Omit<DivergenceLog, 'id' | 'createdAt' | 'updatedAt'>): Promise<APIResponse<DivergenceLog>> {
    if (!this.client) return { data: null, error: { code: 'NOT_INITIALIZED', message: 'Supabase não configurado' } };

    try {
      const now = new Date().toISOString();
      const { data, error } = await this.client
        .from('divergence_logs')
        .insert({ ...log, id: generateId('div'), created_at: now, updated_at: now })
        .select()
        .single();

      if (error) throw error;
      return { data: data as DivergenceLog, error: null };
    } catch (error) {
      return { data: null, error: { code: 'MUTATION_ERROR', message: error instanceof Error ? error.message : 'Erro ao criar log de divergência' } };
    }
  }

  async getDivergenceLogs(sessionId: string): Promise<APIResponse<DivergenceLog[]>> {
    if (!this.client) return { data: null, error: { code: 'NOT_INITIALIZED', message: 'Supabase não configurado' } };

    try {
      const { data, error } = await this.client
        .from('divergence_logs')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data: data as DivergenceLog[], error: null };
    } catch (error) {
      return { data: null, error: { code: 'QUERY_ERROR', message: error instanceof Error ? error.message : 'Erro ao buscar divergências' } };
    }
  }

  async createExpiryAlert(alert: Omit<ExpiryAlert, 'id' | 'createdAt' | 'updatedAt'>): Promise<APIResponse<ExpiryAlert>> {
    if (!this.client) return { data: null, error: { code: 'NOT_INITIALIZED', message: 'Supabase não configurado' } };

    try {
      const now = new Date().toISOString();
      const { data, error } = await this.client
        .from('expiry_alerts')
        .insert({ ...alert, id: generateId('exp'), created_at: now, updated_at: now })
        .select()
        .single();

      if (error) throw error;
      return { data: data as ExpiryAlert, error: null };
    } catch (error) {
      return { data: null, error: { code: 'MUTATION_ERROR', message: error instanceof Error ? error.message : 'Erro ao criar alerta de validade' } };
    }
  }

  async getExpiryAlerts(sessionId: string): Promise<APIResponse<ExpiryAlert[]>> {
    if (!this.client) return { data: null, error: { code: 'NOT_INITIALIZED', message: 'Supabase não configurado' } };

    try {
      const { data, error } = await this.client
        .from('expiry_alerts')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data: data as ExpiryAlert[], error: null };
    } catch (error) {
      return { data: null, error: { code: 'QUERY_ERROR', message: error instanceof Error ? error.message : 'Erro ao buscar alertas' } };
    }
  }

  async getStores(userId: string): Promise<APIResponse<Store[]>> {
    if (!this.client) return { data: null, error: { code: 'NOT_INITIALIZED', message: 'Supabase não configurado' } };

    try {
      const { data, error } = await this.client
        .from('stores')
        .select('*')
        .contains('user_ids', [userId])
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return { data: data as Store[], error: null };
    } catch (error) {
      return { data: null, error: { code: 'QUERY_ERROR', message: error instanceof Error ? error.message : 'Erro ao buscar lojas' } };
    }
  }

  async getSyncStatus(): Promise<SyncStatus> {
    return { ...this.syncStatus };
  }

  async queueOfflineOperation(type: OfflineQueueItem['type'], payload: unknown): Promise<void> {
    const item: OfflineQueueItem = {
      id: generateId('queue'),
      type,
      payload,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: 5,
    };
    this.offlineQueue.push(item);
    this.syncStatus.pending++;
    this.emit('queueChange', { queue: this.offlineQueue, status: this.syncStatus });
  }

  private async processOfflineQueue(): Promise<void> {
    if (this.isSyncing || this.offlineQueue.length === 0 || !isOnline()) return;

    this.isSyncing = true;
    this.emit('syncStart', { queueLength: this.offlineQueue.length });

    const toProcess = [...this.offlineQueue].sort((a, b) => a.timestamp - b.timestamp);

    for (const item of toProcess) {
      try {
        await this.processQueueItem(item);
        this.offlineQueue = this.offlineQueue.filter(i => i.id !== item.id);
        this.syncStatus.synced++;
        this.syncStatus.pending--;
      } catch (error) {
        item.retries++;
        if (item.retries >= item.maxRetries) {
          this.offlineQueue = this.offlineQueue.filter(i => i.id !== item.id);
          this.syncStatus.failed++;
          this.syncStatus.pending--;
        }
      }
    }

    this.syncStatus.lastSyncAt = new Date().toISOString();
    this.isSyncing = false;
    this.emit('syncComplete', { status: this.syncStatus, queue: this.offlineQueue });
  }

  private async processQueueItem(item: OfflineQueueItem): Promise<void> {
    if (!this.client) throw new Error('Client not initialized');

    switch (item.type) {
      case 'session':
        await this.client.from('inventory_sessions').upsert(item.payload as any);
        break;
      case 'item':
        await this.client.from('scanned_items').upsert(item.payload as any);
        break;
      case 'divergence':
        await this.client.from('divergence_logs').upsert(item.payload as any);
        break;
      case 'alert':
        await this.client.from('expiry_alerts').upsert(item.payload as any);
        break;
    }
  }

  subscribeToSession(sessionId: string, callback: (payload: unknown) => void): () => void {
    if (!this.client) return () => {};

    const channel = this.client
      .channel(`session:${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scanned_items', filter: `session_id=eq.${sessionId}` },
        callback
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'divergence_logs', filter: `session_id=eq.${sessionId}` },
        callback
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expiry_alerts', filter: `session_id=eq.${sessionId}` },
        callback
      )
      .subscribe();

    return () => {
      this.client?.removeChannel(channel);
    };
  }

  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.listeners.clear();
    this.client?.auth.signOut();
  }
}

export const supabaseService = new SupabaseService();
export default supabaseService;

export function createSupabaseService(): SupabaseService {
  return new SupabaseService();
}