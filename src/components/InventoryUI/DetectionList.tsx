import { useMemo } from 'react';
import type { BarcodeDetection, SpatialCluster } from '../../types';
import { formatNumber, formatRelativeTime } from '@utils/helpers';

interface DetectionListProps {
  detections: BarcodeDetection[];
  clusters: SpatialCluster[];
  maxItems?: number;
  showOnlyStable?: boolean;
  onItemClick?: (cluster: SpatialCluster) => void;
  className?: string;
}

export function DetectionList({
  detections,
  clusters,
  maxItems = 50,
  showOnlyStable = false,
  onItemClick,
  className = '',
}: DetectionListProps) {
  const displayClusters = useMemo(() => {
    let filtered = clusters;
    if (showOnlyStable) {
      filtered = filtered.filter(c => c.isStable);
    }
    return filtered
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, maxItems);
  }, [clusters, showOnlyStable, maxItems]);

  const recentDetections = useMemo(() => {
    return detections
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, maxItems);
  }, [detections, maxItems]);

  if (displayClusters.length === 0 && recentDetections.length === 0) {
    return (
      <div className={`card p-8 text-center ${className}`}>
        <svg className="mx-auto h-12 w-12 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="mt-4 text-surface-400">Nenhuma detecção ainda</p>
        <p className="mt-1 text-sm text-surface-500">Aponte a câmera para códigos de barras</p>
      </div>
    );
  }

  return (
    <div className={`card overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-surface-700 flex items-center justify-between">
        <h3 className="font-semibold text-surface-100 flex items-center gap-2">
          <svg className="w-5 h-5 text-pharma-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Detecções em Tempo Real
        </h3>
        <div className="flex items-center gap-2">
          <span className="badge badge-info">{displayClusters.length} clusters</span>
          <span className="badge badge-neutral">{recentDetections.length} frames</span>
        </div>
      </div>

      <div className="divide-y divide-surface-700/50 max-h-[400px] overflow-y-auto">
        {displayClusters.map(cluster => (
          <div
            key={cluster.id}
            className={`p-3 hover:bg-surface-800/50 transition-colors cursor-pointer group ${
              cluster.isStable ? 'bg-green-500/5' : 'bg-yellow-500/5'
            }`}
            onClick={() => onItemClick?.(cluster)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="font-mono text-base font-medium text-pharma-400 bg-surface-800 px-2 py-1 rounded">
                    {cluster.barcode}
                  </code>
                  <span className={`badge ${cluster.isStable ? 'badge-success' : 'badge-warning'}`}>
                    {cluster.isStable ? 'Estável' : 'Estabilizando'}
                  </span>
                  <span className="badge badge-info">{cluster.format}</span>
                  <span className="badge badge-neutral">{cluster.detections.length} detecções</span>
                </div>

                <div className="mt-2 flex items-center gap-4 text-sm text-surface-400">
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formatRelativeTime(cluster.lastSeen)}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 12a7.975 7.975 0 01-2.343 6.657z" />
                    </svg>
                    Conf: {(cluster.confidence * 100).toFixed(0)}%
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Estabilidade: {cluster.stabilityScore.toFixed(1)}/10
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <span className="stat-value text-xl">{cluster.count}</span>
                  <span className="text-surface-400">unidades estimadas</span>
                  {cluster.count > cluster.detections.length && (
                    <span className="badge badge-warning ml-2">Extrapolado</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4 shrink-0">
                <div className="w-12 h-12 rounded-xl bg-surface-800 flex items-center justify-center">
                  <svg className="w-6 h-6 text-pharma-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
              </div>
            </div>

            {cluster.detections.length > 1 && (
              <details className="mt-3 pt-3 border-t border-surface-700/50 group-open:animate-fade-in">
                <summary className="flex items-center justify-between cursor-pointer text-sm text-surface-500 hover:text-surface-300">
                  <span>Ver {cluster.detections.length} detecções individuais</span>
                  <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {cluster.detections.slice(-10).map((detection, index) => (
                    <div key={index} className="p-2 bg-surface-800/50 rounded-lg text-xs font-mono">
                      <div className="text-pharma-400">{detection.code}</div>
                      <div className="text-surface-500">
                        {detection.boundingBox.width.toFixed(0)}×{detection.boundingBox.height.toFixed(0)} @
                        {detection.boundingBox.x.toFixed(0)},{detection.boundingBox.y.toFixed(0)}
                      </div>
                      <div className="text-surface-600">Conf: {(detection.confidence * 100).toFixed(0)}%</div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        ))}

        {displayClusters.length === 0 && recentDetections.length > 0 && (
          <div className="p-3 bg-yellow-500/5 border-t border-surface-700/50">
            <p className="text-sm text-yellow-400 font-medium mb-2">Detecções recentes (não agrupadas)</p>
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {recentDetections.slice(0, 10).map((detection, index) => (
                <div key={index} className="p-2 bg-surface-800/50 rounded-lg text-xs font-mono">
                  <div className="text-pharma-400">{detection.code}</div>
                  <div className="text-surface-500">Frame #{detection.frameId}</div>
                  <div className="text-surface-600">Conf: {(detection.confidence * 100).toFixed(0)}%</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

DetectionList.displayName = 'DetectionList';