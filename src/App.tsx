import { useState, useEffect, useCallback } from 'react';
import { SessionManager } from '@components/InventoryUI';
import { useAuth, useStores, useSyncStatus, useNetworkStatus } from '@components/SupabaseClient';
import { supabaseService } from '@components/SupabaseClient';
import type { Store } from './types';
import { formatRelativeTime } from '@utils/helpers';

function Header({ store, onStoreChange, user, onSignOut, syncStatus, online }: {
  store: Store | null;
  onStoreChange: (storeId: string) => void;
  user: any;
  onSignOut: () => void;
  syncStatus: any;
  online: boolean;
}) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-surface-950/95 backdrop-blur-xl border-b border-surface-800">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pharma-500 to-pharma-600 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-100">PharmaInventory</h1>
            <p className="text-xs text-surface-500">Balanço Autônomo de Farmácias</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-800/50 border border-surface-700/50">
            <span className={`w-2 h-2 rounded-full ${online ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-sm text-surface-300">{online ? 'Online' : 'Offline'}</span>
            {syncStatus.pending > 0 && (
              <span className="badge badge-warning">{syncStatus.pending} pendentes</span>
            )}
          </div>

          {store && (
            <select
              value={store.id}
              onChange={e => onStoreChange(e.target.value)}
              className="input py-2 px-3 text-sm max-w-[200px] bg-surface-800/50"
            >
              <option value="">Selecionar loja</option>
            </select>
          )}

          <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-surface-800/50 border border-surface-700/50">
            <div className="w-8 h-8 rounded-full bg-pharma-500/20 flex items-center justify-center">
              <span className="text-sm font-medium text-pharma-400">{user?.name?.charAt(0) || 'U'}</span>
            </div>
            <span className="text-sm text-surface-300">{user?.name || 'Usuário'}</span>
            <button onClick={onSignOut} className="text-surface-500 hover:text-surface-200 text-sm">Sair</button>
          </div>
        </div>
      </div>
    </header>
  );
}

function Sidebar({ stores, activeStoreId, onStoreSelect, onNewStore }: {
  stores: Store[];
  activeStoreId: string | null;
  onStoreSelect: (storeId: string) => void;
  onNewStore: () => void;
}) {
  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 bg-surface-900/80 backdrop-blur-xl border-r border-surface-800 flex flex-col z-30">
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {stores.map(store => (
          <button
            key={store.id}
            onClick={() => onStoreSelect(store.id)}
            className={`w-full text-left px-3 py-2.5 rounded-xl transition-all ${
              activeStoreId === store.id
                ? 'bg-pharma-500/20 text-pharma-400 border border-pharma-500/30'
                : 'text-surface-300 hover:bg-surface-800 hover:text-surface-100'
            }`}
          >
            <div className="font-medium">{store.name}</div>
            <div className="text-xs text-surface-500 mt-0.5">{store.address.city}, {store.address.state}</div>
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-surface-800">
        <button onClick={onNewStore} className="btn-secondary w-full justify-center">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova Loja
        </button>
      </div>
    </aside>
  );
}

export function App() {
  const { user, session, loading: authLoading, signOut, isAuthenticated } = useAuth();
  const { stores, loading: storesLoading, fetch: fetchStores } = useStores();
  const { status: syncStatus } = useSyncStatus();
  const { online } = useNetworkStatus();

  const [activeStore, setActiveStore] = useState<Store | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchStores();
    }
  }, [isAuthenticated, fetchStores]);

  useEffect(() => {
    if (stores.length > 0 && !activeStore) {
      setActiveStore(stores[0]);
    }
  }, [stores, activeStore]);

  const handleStoreChange = useCallback((storeId: string) => {
    const store = stores.find(s => s.id === storeId);
    if (store) setActiveStore(store);
    setSidebarOpen(false);
  }, [stores]);

  const handleNewStore = useCallback(() => {
    // TODO: Implement new store modal
    console.log('New store requested');
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-pharma-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-surface-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen onSignIn={handleSignIn} />;
  }

  return (
    <div className="min-h-screen bg-surface-950">
      <Header
        store={activeStore}
        onStoreChange={handleStoreChange}
        user={user}
        onSignOut={signOut}
        syncStatus={syncStatus}
        online={online}
      />

      <div className="pt-16 pb-4 px-4 max-w-7xl mx-auto">
        <div className="flex gap-4 h-[calc(100vh-5rem)]">
          <Sidebar
            stores={stores}
            activeStoreId={activeStore?.id || null}
            onStoreSelect={handleStoreChange}
            onNewStore={handleNewStore}
          />

          <main className="flex-1 ml-64 min-w-0">
            {activeStore ? (
              <SessionManager storeId={activeStore.id} />
            ) : (
              <div className="card flex flex-col h-full">
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="text-center">
                    <svg className="mx-auto h-16 w-16 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <h2 className="mt-4 text-xl font-semibold">Nenhuma loja selecionada</h2>
                    <p className="mt-2 text-surface-400">Selecione uma loja na barra lateral ou crie uma nova</p>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function AuthScreen({ onSignIn }: { onSignIn: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignUp) {
        // TODO: Implement sign up
      } else {
        await onSignIn(email, password);
      }
    } catch (err) {
      setError('Credenciais inválidas');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 px-4">
      <div className="card w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-pharma-500 to-pharma-600 flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">PharmaInventory</h1>
          <p className="text-surface-400 mt-1">{isSignUp ? 'Criar conta' : 'Entrar na sua conta'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input"
              placeholder="seu@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="label">Senha</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Carregando...' : isSignUp ? 'Criar Conta' : 'Entrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-surface-500">
          {isSignUp ? 'Já tem conta?' : 'Não tem conta?'} {' '}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-pharma-400 hover:text-pharma-300 font-medium"
          >
            {isSignUp ? 'Entrar' : 'Cadastrar'}
          </button>
        </p>

        <div className="mt-8 p-4 rounded-xl bg-surface-800/50 border border-surface-700/50 text-xs text-surface-500">
                  <p className="font-medium text-surface-300 mb-2">
                    {supabaseService.getClient() ? 'Supabase Conectado' : 'Modo Demo'}
                  </p>
                  <p className="text-surface-500">
                    {supabaseService.getClient() 
                      ? 'Crie uma conta ou entre com suas credenciais. Se for o primeiro acesso, use "Cadastrar" para criar o primeiro usuário admin.'
                      : 'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no Vercel/Arquivo .env para ativar persistência de dados.'}
                  </p>
                </div>
      </div>
    </div>
  );
}

function handleSignIn(email: string, password: string): Promise<void> {
  // This will be handled by the auth hook
  return Promise.resolve();
}

App.displayName = 'App';