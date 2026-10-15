import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabaseService } from './SupabaseClient';
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
} from '../../types';

export function useAuth() {
  const [user, setUser] = useState<UserType | null>(null);
  const [session, setSession] = useState<import('@supabase/supabase-js').Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const handleAuthChange = ((data: unknown) => {
      if (!mounted) return;
      const { user: u, session: s } = data as { user: any; session: any };
      setUser(u as UserType | null);
      setSession(s);
      setLoading(false);
    }) as (data: unknown) => void;

    const unsubscribe = supabaseService.on('authChange', handleAuthChange);

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await supabaseService.signIn(email, password);
    // Emit authChange immediately for instant UI update
    if (!result.error && result.data) {
      supabaseService.emit('authChange', { 
        user: result.data.user, 
        session: result.data.session 
      });
    }
    return result;
  }, []);

  const signUp = useCallback(async (email: string, password: string, metadata?: Record<string, unknown>) => {
    const result = await supabaseService.signUp(email, password, metadata);
    // Emit authChange immediately for instant UI update
    if (!result.error && result.data) {
      supabaseService.emit('authChange', { 
        user: result.data.user, 
        session: result.data.session 
      });
    }
    return result;
  }, []);

  const signOut = useCallback(async () => {
    const result = await supabaseService.signOut();
    if (!result.error) {
      supabaseService.emit('authChange', { user: null, session: null });
    }
    return result;
  }, []);

  return { user, session, loading, signIn, signUp, signOut, isAuthenticated: !!user };

}

export function useProducts(storeId: string, options?: { search?: string; limit?: number; offset?: number }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ count: 0, page: 1, pageSize: 50, hasMore: false });

  const fetch = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setError(null);
    const result = await supabaseService.getProducts(storeId, options);
    if (result.error) {
      setError(result.error.message);
    } else if (result.data) {
      setProducts(result.data.data);
      setPagination({
        count: result.data.count,
        page: result.data.page,
        pageSize: result.data.pageSize,
        hasMore: result.data.hasMore,
      });
    }
    setLoading(false);
  }, [storeId, options?.search, options?.limit, options?.offset]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const create = useCallback(async (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    const result = await supabaseService.createProduct(product);
    if (!result.error && result.data) {
      setProducts(prev => [result.data!, ...prev]);
    }
    return result;
  }, []);

  const update = useCallback(async (id: string, updates: Partial<Product>) => {
    const result = await supabaseService.updateProduct(id, updates);
    if (!result.error && result.data) {
      setProducts(prev => prev.map(p => p.id === id ? result.data! : p));
    }
    return result;
  }, []);

  const getByGTIN = useCallback(async (gtin: string) => {
    return supabaseService.getProductByGTIN(storeId, gtin);
  }, [storeId]);

  return { products, loading, error, pagination, fetch, create, update, getByGTIN };
}

export function useSessions(storeId: string, options?: { status?: InventorySession['status']; limit?: number; offset?: number }) {
  const [sessions, setSessions] = useState<InventorySession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ count: 0, page: 1, pageSize: 20, hasMore: false });

  const fetch = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setError(null);
    const result = await supabaseService.getSessions(storeId, options);
    if (result.error) {
      setError(result.error.message);
    } else if (result.data) {
      setSessions(result.data.data);
      setPagination({
        count: result.data.count,
        page: result.data.page,
        pageSize: result.data.pageSize,
        hasMore: result.data.hasMore,
      });
    }
    setLoading(false);
  }, [storeId, options?.status, options?.limit, options?.offset]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const create = useCallback(async (session: Omit<InventorySession, 'id' | 'createdAt' | 'updatedAt'>) => {
    const result = await supabaseService.createSession(session);
    if (!result.error && result.data) {
      setSessions(prev => [result.data!, ...prev]);
    }
    return result;
  }, []);

  const update = useCallback(async (id: string, updates: Partial<InventorySession>) => {
    const result = await supabaseService.updateSession(id, updates);
    if (!result.error && result.data) {
      setSessions(prev => prev.map(s => s.id === id ? result.data! : s));
    }
    return result;
  }, []);

  const getById = useCallback(async (id: string) => {
    return supabaseService.getSession(id);
  }, []);

  return { sessions, loading, error, pagination, fetch, create, update, getById };
}

export function useSessionItems(sessionId: string) {
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    const result = await supabaseService.getScannedItems(sessionId);
    if (result.error) {
      setError(result.error.message);
    } else if (result.data) {
      setItems(result.data);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const create = useCallback(async (item: Omit<ScannedItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    const result = await supabaseService.createScannedItem(item);
    if (!result.error && result.data) {
      setItems(prev => [result.data!, ...prev]);
    }
    return result;
  }, []);

  const update = useCallback(async (id: string, updates: Partial<ScannedItem>) => {
    const result = await supabaseService.updateScannedItem(id, updates);
    if (!result.error && result.data) {
      setItems(prev => prev.map(i => i.id === id ? result.data! : i));
    }
    return result;
  }, []);

  return { items, loading, error, fetch, create, update };
}

export function useDivergenceLogs(sessionId: string) {
  const [logs, setLogs] = useState<DivergenceLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    const result = await supabaseService.getDivergenceLogs(sessionId);
    if (result.error) {
      setError(result.error.message);
    } else if (result.data) {
      setLogs(result.data);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const create = useCallback(async (log: Omit<DivergenceLog, 'id' | 'createdAt' | 'updatedAt'>) => {
    const result = await supabaseService.createDivergenceLog(log);
    if (!result.error && result.data) {
      setLogs(prev => [result.data!, ...prev]);
    }
    return result;
  }, []);

  return { logs, loading, error, fetch, create };
}

export function useExpiryAlerts(sessionId: string) {
  const [alerts, setAlerts] = useState<ExpiryAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    const result = await supabaseService.getExpiryAlerts(sessionId);
    if (result.error) {
      setError(result.error.message);
    } else if (result.data) {
      setAlerts(result.data);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const create = useCallback(async (alert: Omit<ExpiryAlert, 'id' | 'createdAt' | 'updatedAt'>) => {
    const result = await supabaseService.createExpiryAlert(alert);
    if (!result.error && result.data) {
      setAlerts(prev => [result.data!, ...prev]);
    }
    return result;
  }, []);

  return { alerts, loading, error, fetch, create };
}

export function useStores() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    const user = supabaseService.getCurrentUser();
    if (!user) return;
    setLoading(true);
    setError(null);
    const result = await supabaseService.getStores(user.id);
    if (result.error) {
      setError(result.error.message);
    } else if (result.data) {
      setStores(result.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const create = useCallback(async (store: Omit<Store, 'id' | 'createdAt' | 'updatedAt'>) => {
    const user = supabaseService.getCurrentUser();
    if (!user) return { data: null, error: { code: 'NOT_AUTHENTICATED', message: 'Usuário não autenticado' } };
    
    const result = await supabaseService.createStore({ ...store, user_id: user.id });
    if (!result.error && result.data) {
      setStores(prev => [...prev, result.data!]);
    }
    return result;
  }, []);

  return { stores, loading, error, fetch, create };
}

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>({ pending: 0, synced: 0, failed: 0 });

  useEffect(() => {
    const unsubscribe = supabaseService.on('syncComplete', ((data: unknown) => setStatus((data as any).status)) as (data: unknown) => void);
    const unsubscribeQueue = supabaseService.on('queueChange', ((data: unknown) => setStatus((data as any).status)) as (data: unknown) => void);

    supabaseService.getSyncStatus().then(setStatus);

    return () => {
      unsubscribe();
      unsubscribeQueue();
    };
  }, []);

  const forceSync = useCallback(async () => {
    await (supabaseService as any).processOfflineQueue?.();
  }, []);

  return { status, forceSync };
}

export function useNetworkStatus() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const unsubscribeOnline = supabaseService.on('networkChange', ((data: unknown) => setOnline((data as any).online)) as (data: unknown) => void);
    return unsubscribeOnline;
  }, []);

  return { online };
}

export function useRealtimeSession(sessionId: string) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    const unsubscribe = supabaseService.subscribeToSession(sessionId, (payload) => {
      // Handle realtime updates
      console.log('Realtime update:', payload);
    });
    setConnected(true);
    return () => {
      unsubscribe();
      setConnected(false);
    };
  }, [sessionId]);

  return { connected };
}