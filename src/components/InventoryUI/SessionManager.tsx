import { useState, useEffect, useCallback } from 'react';
import { useSessions, useSessionItems, useDivergenceLogs, useExpiryAlerts } from '@components/SupabaseClient';
import type { InventorySession, ScannedItem, DivergenceLog, ExpiryAlert, SessionStatus } from '../../types';
import { generateId, formatRelativeTime, formatNumber, formatCurrency, getDivergenceSeverity, getExpirySeverity } from '@utils/helpers';
import { ScannerView } from './ScannerView';
import { DetectionList } from './DetectionList';
import { AccumulatorPanel } from './AccumulatorPanel';

interface SessionManagerProps {
  storeId: string;
  onSessionComplete?: (session: InventorySession) => void;
}

export function SessionManager({ storeId, onSessionComplete }: SessionManagerProps) {
  const [activeSession, setActiveSession] = useState<InventorySession | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('draft');
  const [showHistory, setShowHistory] = useState(false);

  const { sessions, loading: sessionsLoading, create: createSession, update: updateSession, fetch: fetchSessions } = useSessions(storeId);
  const { items: scannedItems, loading: itemsLoading, create: createScannedItem, update: updateScannedItem } = useSessionItems(activeSession?.id || '');
  const { logs: divergences, create: createDivergence } = useDivergenceLogs(activeSession?.id || '');
  const { alerts: expiryAlerts, create: createExpiryAlert } = useExpiryAlerts(activeSession?.id || '');

  const productsMap = new Map<string, any>();

  const startNewSession = useCallback(async () => {
    const now = new Date().toISOString();
    const newSession: Omit<InventorySession, 'id' | 'createdAt' | 'updatedAt'> = {
      storeId,
      userId: 'current-user',
      status: 'in_progress',
      startedAt: now,
      totalItemsScanned: 0,
      uniqueProductsScanned: 0,
      divergencesCount: 0,
      expiredItemsCount: 0,
      nearExpiryItemsCount: 0,
      settings: {
        autoSaveInterval: 30000,
        divergenceThreshold: 5,
        expiryAlertDays: 90,
        requireConfirmation: true,
        scanMode: 'continuous',
        roiEnabled: true,
        perspectiveCorrection: false,
      },
    };

    const result = await createSession(newSession);
    if (!result.error && result.data) {
      setActiveSession(result.data);
      setSessionStatus('in_progress');
      setShowHistory(false);
    }
    return result;
  }, [storeId, createSession]);

  const pauseSession = useCallback(async () => {
    if (!activeSession) return;
    const result = await updateSession(activeSession.id, {
      status: 'paused',
      pausedAt: new Date().toISOString(),
    });
    if (!result.error) setSessionStatus('paused');
  }, [activeSession, updateSession]);

  const resumeSession = useCallback(async () => {
    if (!activeSession) return;
    const result = await updateSession(activeSession.id, {
      status: 'in_progress',
      pausedAt: undefined,
    });
    if (!result.error) setSessionStatus('in_progress');
  }, [activeSession, updateSession]);

  const completeSession = useCallback(async () => {
    if (!activeSession) return;

    const confirmedItems = scannedItems.filter(i => i.status === 'confirmed');
    const divergenceItems = scannedItems.filter(i => i.status === 'divergence');
    const expiredItems = scannedItems.filter(i => i.status === 'expired');
    const nearExpiryItems = scannedItems.filter(i => i.status === 'near_expiry');

    const result = await updateSession(activeSession.id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      totalItemsScanned: confirmedItems.reduce((sum, i) => sum + i.quantity, 0),
      uniqueProductsScanned: new Set(confirmedItems.map(i => i.gtin)).size,
      divergencesCount: divergenceItems.length,
      expiredItemsCount: expiredItems.length,
      nearExpiryItemsCount: nearExpiryItems.length,
    });

    if (!result.error && result.data) {
      setActiveSession(result.data);
      setSessionStatus('completed');
      onSessionComplete?.(result.data);
    }
  }, [activeSession, scannedItems, updateSession, onSessionComplete]);

  const handleConfirmItem = useCallback(async (cluster: any, quantity: number, product?: any) => {
    if (!activeSession) return;

    const gtin = cluster.barcode;
    const existingItem = scannedItems.find(i => i.gtin === gtin && i.status === 'confirmed');

    let systemQuantity = 0;
    let divergence = 0;
    let divergencePercentage = 0;
    let status: ScannedItem['status'] = 'confirmed';

    if (product) {
      systemQuantity = 100;
      divergence = quantity - systemQuantity;
      divergencePercentage = systemQuantity > 0 ? (divergence / systemQuantity) * 100 : 0;

      if (Math.abs(divergencePercentage) > 5) {
        status = 'divergence';
      }
    }

    const expiryDate = product?.expiryDate;
    const daysToExpiry = expiryDate ? Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : undefined;

    if (daysToExpiry !== undefined) {
      if (daysToExpiry < 0) status = 'expired';
      else if (daysToExpiry <= 30) status = 'near_expiry';
    }

    const itemData: Omit<ScannedItem, 'id' | 'createdAt' | 'updatedAt'> = {
      sessionId: activeSession.id,
      productId: product?.id,
      gtin,
      productName: product?.name,
      quantity,
      systemQuantity,
      divergence,
      divergencePercentage,
      unitCost: product?.cost,
      totalValue: product?.cost ? product.cost * quantity : undefined,
      batchNumber: product?.batchNumber,
      expiryDate,
      daysToExpiry,
      status,
      detections: cluster.detections,
      spatialCluster: cluster,
      scannedAt: new Date().toISOString(),
    };

    if (existingItem) {
      await updateScannedItem(existingItem.id, { quantity, divergence, divergencePercentage, status, totalValue: itemData.totalValue });
    } else {
      const result = await createScannedItem(itemData);
      if (!result.error && result.data && status === 'divergence') {
        await createDivergence({
          sessionId: activeSession.id,
          itemId: result.data.id,
          type: 'quantity_mismatch',
          severity: getDivergenceSeverity(divergencePercentage),
          expectedQuantity: systemQuantity,
          actualQuantity: quantity,
          difference: divergence,
          valueImpact: Math.abs(divergence) * (product?.cost || 0),
          description: `Divergência de ${divergence > 0 ? '+' : ''}${divergence} unidades (${divergencePercentage.toFixed(1)}%)`,
          resolved: false,
        });
      }
      if (!result.error && result.data && (status === 'expired' || status === 'near_expiry')) {
        await createExpiryAlert({
          sessionId: activeSession.id,
          itemId: result.data.id,
          productId: product?.id || '',
          gtin,
          productName: product?.name || 'Desconhecido',
          batchNumber: product?.batchNumber || '',
          expiryDate: expiryDate || '',
          daysToExpiry: daysToExpiry || 0,
          quantity,
          severity: getExpirySeverity(daysToExpiry || 999),
          acknowledged: false,
        });
      }
    }
  }, [activeSession, scannedItems, createScannedItem, updateScannedItem, createDivergence, createExpiryAlert]);

  const handleManualEntry = useCallback(() => {
    // TODO: Implement manual entry modal
    console.log('Manual entry requested');
  }, []);

  if (showHistory) {
    return (
      <div className="card flex flex-col h-full">
        <div className="p-4 border-b border-surface-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Histórico de Sessões</h2>
          <button
            onClick={() => setShowHistory(false)}
            className="btn-secondary"
          >
            Nova Sessão
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessionsLoading ? (
            <div className="p-8 text-center text-surface-500">Carregando...</div>
          ) : sessions.length === 0 ? (
            <div className="p-8 text-center text-surface-500">Nenhuma sessão encontrada</div>
          ) : (
            <div className="divide-y divide-surface-700/50">
              {sessions.map(session => (
                <div key={session.id} className="p-4 hover:bg-surface-800/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{session.id.slice(0, 12)}...</p>
                      <p className="text-sm text-surface-500">{formatRelativeTime(new Date(session.startedAt).getTime())}</p>
                    </div>
                    <div className="text-right">
                      <span className={`badge ${session.status === 'completed' ? 'badge-success' : session.status === 'in_progress' ? 'badge-info' : 'badge-neutral'}`}>
                        {session.status}
                      </span>
                      <p className="text-sm text-surface-400 mt-1">{session.totalItemsScanned} itens</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="card flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <svg className="mx-auto h-16 w-16 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <h2 className="mt-4 text-xl font-semibold">Nenhuma sessão ativa</h2>
            <p className="mt-2 text-surface-400">Inicie um novo balanço de estoque</p>
            <button
              onClick={startNewSession}
              className="btn-primary mt-6 w-full max-w-xs"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Iniciar Novo Balanço
            </button>
            <button
              onClick={() => setShowHistory(true)}
              className="btn-secondary mt-3 w-full max-w-xs"
            >
              Ver Histórico
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card flex flex-col h-full">
      <div className="p-4 border-b border-surface-700">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-semibold text-surface-100">Sessão Ativa</h2>
            <p className="text-sm text-surface-500">{activeSession.id.slice(0, 12)}... • Iniciada {formatRelativeTime(new Date(activeSession.startedAt).getTime())}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`badge ${sessionStatus === 'in_progress' ? 'badge-success' : sessionStatus === 'paused' ? 'badge-warning' : 'badge-info'}`}>
              {sessionStatus}
            </span>
            {sessionStatus === 'in_progress' && (
              <button onClick={pauseSession} className="btn-secondary text-sm">
                Pausar
              </button>
            )}
            {sessionStatus === 'paused' && (
              <button onClick={resumeSession} className="btn-primary text-sm">
                Retomar
              </button>
            )}
            {sessionStatus !== 'completed' && (
              <button onClick={completeSession} className="btn-success text-sm">
                Finalizar
              </button>
            )}
            <button onClick={() => setShowHistory(true)} className="btn-ghost text-sm">
              Histórico
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          <ScannerView
            config={{
              targetFPS: 30,
              spatialClusteringRadius: 0.08,
              stabilityFramesRequired: 3,
              minConfidence: 0.5,
              roi: { enabled: true, x: 0.1, y: 0.15, width: 0.8, height: 0.7, normalized: true },
            }}
            showROI={true}
            showDetections={true}
            showClusters={true}
          />
        </div>

        <div className="w-96 flex-shrink-0 border-l border-surface-700 flex flex-col">
          <DetectionList
            detections={[]}
            clusters={[]}
            maxItems={30}
            showOnlyStable={false}
          />
          <AccumulatorPanel
            clusters={[]}
            scannedItems={scannedItems}
            products={productsMap}
            onConfirmItem={handleConfirmItem}
            onManualEntry={handleManualEntry}
          />
        </div>
      </div>
    </div>
  );
}

SessionManager.displayName = 'SessionManager';