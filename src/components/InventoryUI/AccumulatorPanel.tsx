import { useMemo, useState } from 'react';
import type { SpatialCluster, ScannedItem, Product } from '../../types';
import { formatNumber, formatCurrency, generateId, formatRelativeTime } from '@utils/helpers';

interface AccumulatorPanelProps {
  clusters: SpatialCluster[];
  scannedItems: ScannedItem[];
  products: Map<string, Product>;
  onConfirmItem: (cluster: SpatialCluster, quantity: number, product?: Product) => void;
  onManualEntry: () => void;
  className?: string;
}

export function AccumulatorPanel({
  clusters,
  scannedItems,
  products,
  onConfirmItem,
  onManualEntry,
  className = '',
}: AccumulatorPanelProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const pendingClusters = useMemo(() => {
    return clusters
      .filter(c => c.isStable && c.count > 0)
      .filter(c => !scannedItems.some(item => item.gtin === c.barcode && item.status === 'confirmed'))
      .sort((a, b) => b.lastSeen - a.lastSeen);
  }, [clusters, scannedItems]);

  const confirmedItems = useMemo(() => {
    return scannedItems.filter(item => item.status === 'confirmed');
  }, [scannedItems]);

  const divergenceItems = useMemo(() => {
    return scannedItems.filter(item => item.status === 'divergence');
  }, [scannedItems]);

  const totalScanned = useMemo(() => {
    return confirmedItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [confirmedItems]);

  const totalValue = useMemo(() => {
    return confirmedItems.reduce((sum, item) => sum + (item.totalValue || 0), 0);
  }, [confirmedItems]);

  const uniqueProducts = useMemo(() => {
    return new Set(confirmedItems.map(item => item.gtin)).size;
  }, [confirmedItems]);

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getProduct = (gtin: string) => products.get(gtin);

  const handleConfirm = (cluster: SpatialCluster, quantity: number) => {
    const product = getProduct(cluster.barcode);
    onConfirmItem(cluster, quantity, product);
  };

  const handleQuantityChange = (cluster: SpatialCluster, newQuantity: number) => {
    if (newQuantity > 0) {
      handleConfirm(cluster, newQuantity);
    }
  };

  return (
    <div className={`card flex flex-col ${className}`}>
      <div className="p-4 border-b border-surface-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-surface-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-pharma-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Acumulador de Quantidades
          </h3>
          <button
            onClick={onManualEntry}
            className="btn-secondary text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Entrada Manual
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="stat-card">
            <span className="stat-value">{formatNumber(totalScanned)}</span>
            <span className="stat-label">Total Itens</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{uniqueProducts}</span>
            <span className="stat-label">Produtos Únicos</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{formatCurrency(totalValue)}</span>
            <span className="stat-label">Valor Estimado</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-surface-700/50">
        {pendingClusters.length > 0 && (
          <>
            <div className="px-4 py-2 bg-yellow-500/5 border-b border-surface-700/50">
              <p className="text-sm font-medium text-yellow-400 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Pendentes de Confirmação ({pendingClusters.length})
              </p>
            </div>

            {pendingClusters.map(cluster => {
              const product = getProduct(cluster.barcode);
              const isExpanded = expandedItems.has(cluster.id);
              const suggestedQty = cluster.count;
              const systemQty = product ? 0 : undefined;

              return (
                <div
                  key={cluster.id}
                  className="p-4 hover:bg-surface-800/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <code className="font-mono text-lg font-medium text-pharma-400 bg-surface-800 px-3 py-1 rounded-lg">
                          {cluster.barcode}
                        </code>
                        <span className="badge badge-success">Estável</span>
                        <span className="badge badge-info">{cluster.format}</span>
                        {product && <span className="badge badge-neutral">{product.name}</span>}
                      </div>

                      {product && (
                        <p className="text-sm text-surface-300 line-clamp-1">{product.name}</p>
                      )}

                      <div className="mt-2 flex items-center gap-4 text-xs text-surface-500">
                        <span>Detecções: {cluster.detections.length}</span>
                        <span>Conf: {(cluster.confidence * 100).toFixed(0)}%</span>
                        <span>Estabilidade: {cluster.stabilityScore.toFixed(1)}/10</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-16 h-16 rounded-xl bg-surface-800 flex items-center justify-center border border-surface-600">
                        <span className="text-2xl font-bold font-mono text-pharma-400">{suggestedQty}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label className="label">Quantidade Confirmada</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="9999"
                          value={suggestedQty}
                          onChange={e => handleQuantityChange(cluster, Math.max(1, parseInt(e.target.value) || 1))}
                          className="input w-24 text-center font-mono text-lg"
                        />
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => handleQuantityChange(cluster, suggestedQty - 1)}
                            disabled={suggestedQty <= 1}
                            className="p-1 rounded bg-surface-700 hover:bg-surface-600 text-surface-300 disabled:opacity-50"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                          </button>
                          <button
                            onClick={() => handleQuantityChange(cluster, suggestedQty + 1)}
                            className="p-1 rounded bg-surface-700 hover:bg-surface-600 text-surface-300"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                          </button>
                        </div>
                        <button
                          onClick={() => handleConfirm(cluster, suggestedQty)}
                          className="btn-success ml-2 flex-1"
                        >
                          Confirmar
                        </button>
                      </div>
                    </div>

                    <div className="sm:col-span-1">
                      <label className="label">Estoque Sistema</label>
                      <div className="input bg-surface-700 text-center font-mono text-lg text-surface-400 pointer-events-none opacity-50" aria-disabled="true">
                        {systemQty !== undefined ? formatNumber(systemQty) : '—'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleExpand(cluster.id)}
                    className="mt-3 w-full flex items-center justify-center gap-2 text-sm text-surface-500 hover:text-surface-300"
                  >
                    <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    <span>{isExpanded ? 'Ocultar detalhes' : 'Mostrar detalhes da detecção'}</span>
                  </button>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-surface-700/50 animate-fade-in">
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {cluster.detections.slice(-8).map((detection, index) => (
                          <div key={index} className="p-3 bg-surface-800/50 rounded-lg">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-mono text-pharma-400">{detection.code}</span>
                              <span className="text-surface-500">Frame #{detection.frameId}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-1 mt-1 text-xs text-surface-500">
                              <div><span className="text-surface-400">Pos:</span> {detection.boundingBox.x.toFixed(0)},{detection.boundingBox.y.toFixed(0)}</div>
                              <div><span className="text-surface-400">Tam:</span> {detection.boundingBox.width.toFixed(0)}×{detection.boundingBox.height.toFixed(0)}</div>
                              <div><span className="text-surface-400">Conf:</span> {(detection.confidence * 100).toFixed(0)}%</div>
                              <div><span className="text-surface-400">Tempo:</span> {formatRelativeTime(detection.timestamp)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {confirmedItems.length > 0 && (
          <>
            <div className="px-4 py-2 bg-green-500/5 border-b border-surface-700/50">
              <p className="text-sm font-medium text-green-400 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Confirmados ({confirmedItems.length})
              </p>
            </div>

            <div className="p-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {confirmedItems.slice(-20).map(item => (
                  <div
                    key={item.id}
                    className="p-3 bg-green-500/5 border border-green-500/10 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <code className="font-mono text-sm text-pharma-400">{item.gtin}</code>
                      <span className="badge badge-success">{item.quantity} un</span>
                    </div>
                    <p className="text-sm text-surface-300 line-clamp-1">{item.productName || 'Produto não cadastrado'}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-surface-500">
                      <span>{formatCurrency(item.totalValue || 0)}</span>
                      {item.batchNumber && <span>Lote: {item.batchNumber}</span>}
                      {item.expiryDate && (
                        <span className={item.daysToExpiry !== undefined && item.daysToExpiry < 90 ? 'text-yellow-400' : 'text-surface-500'}>
                          Val: {new Date(item.expiryDate).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {divergenceItems.length > 0 && (
          <>
            <div className="px-4 py-2 bg-red-500/5 border-b border-surface-700/50">
              <p className="text-sm font-medium text-red-400 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Divergências ({divergenceItems.length})
              </p>
            </div>

            <div className="p-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {divergenceItems.map(item => (
                  <div
                    key={item.id}
                    className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <code className="font-mono text-sm text-red-400">{item.gtin}</code>
                      <span className="badge badge-danger">{item.divergence > 0 ? '+' : ''}{item.divergence} un</span>
                    </div>
                    <p className="text-sm text-surface-300 line-clamp-1">{item.productName || 'Produto não cadastrado'}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-surface-500">
                      <span>Sistema: {item.systemQuantity || 0}</span>
                      <span>Contado: {item.quantity}</span>
                      <span>Diff: {item.divergencePercentage.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {pendingClusters.length === 0 && confirmedItems.length === 0 && divergenceItems.length === 0 && (
          <div className="p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="mt-4 text-surface-400">Nenhum item no acumulador</p>
            <p className="mt-1 text-sm text-surface-500">Itens estáveis aparecerão aqui automaticamente</p>
          </div>
        )}
      </div>
    </div>
  );
}

AccumulatorPanel.displayName = 'AccumulatorPanel';