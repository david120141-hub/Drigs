import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useScanEngine } from '@components/ScanEngine';
import type { BarcodeDetection, SpatialCluster, ScanEngineConfig, ROIConfig } from '../../types';
import { formatNumber, hapticFeedback, playSound } from '@utils/helpers';

interface ScannerViewProps {
  onDetection?: (detection: BarcodeDetection) => void;
  onClusterUpdate?: (clusters: SpatialCluster[]) => void;
  config?: Partial<ScanEngineConfig> & { roi?: ROIConfig };
  showROI?: boolean;
  showDetections?: boolean;
  showClusters?: boolean;
  className?: string;
}

export function ScannerView({
  onDetection,
  onClusterUpdate,
  config,
  showROI = true,
  showDetections = true,
  showClusters = true,
  className = '',
}: ScannerViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const roiRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

    const defaultROI: ROIConfig = {
      enabled: false,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      normalized: true,
    };

    const {
    state,
    initialize,
    start,
    stop,
    updateConfig,
    toggleTorch,
    setZoom,
    getCapabilities,
    isSupported,
  } = useScanEngine(config);

  useEffect(() => {
      if (!videoRef.current || !isSupported) return;
      initialize(videoRef.current).then(() => start()).catch(console.error);
      return () => {
        stop().catch(console.error);
      };
    }, [initialize, start, stop, isSupported]);

  useEffect(() => {
    if (!state.isActive) return;

    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    const video = videoRef.current;
    if (!canvas || !overlay || !video) return;

    const ctx = canvas.getContext('2d')!;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    overlay.style.width = `${video.videoWidth}px`;
    overlay.style.height = `${video.videoHeight}px`;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (showDetections && state.detectionsThisFrame.length > 0) {
      state.detectionsThisFrame.forEach((detection, index) => {
        const box = detection.boundingBox;
        const scaleX = canvas.width / video.videoWidth;
        const scaleY = canvas.height / video.videoHeight;

        ctx.strokeStyle = '#0ea5e9';
        ctx.lineWidth = 2;
        ctx.strokeRect(box.x * scaleX, box.y * scaleY, box.width * scaleX, box.height * scaleY);

        ctx.fillStyle = '#0ea5e9';
        ctx.font = '12px JetBrains Mono, monospace';
        const text = `${detection.code} (${(detection.confidence * 100).toFixed(0)}%)`;
        const metrics = ctx.measureText(text);
        ctx.fillRect(box.x * scaleX, box.y * scaleY - 20, metrics.width + 8, 20);
        ctx.fillStyle = '#0f172a';
        ctx.fillText(text, box.x * scaleX + 4, box.y * scaleY - 5);
      });
    }

    if (showClusters && state.clusters.length > 0) {
      state.clusters.forEach(cluster => {
        if (!cluster.isStable) return;

        const scaleX = canvas.width / video.videoWidth;
        const scaleY = canvas.height / video.videoHeight;
        const x = cluster.normalizedCentroid.x * canvas.width;
        const y = cluster.normalizedCentroid.y * canvas.height;

        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 14px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(cluster.count), x, y + 5);
        ctx.textAlign = 'start';

        ctx.fillStyle = '#10b981';
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText(cluster.barcode, x, y + 20);
      });
    }

    if (showROI && config?.roi?.enabled) {
      const roi = config.roi;
      const scaleX = canvas.width / video.videoWidth;
      const scaleY = canvas.height / video.videoHeight;

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(
        roi.x * scaleX * canvas.width,
        roi.y * scaleY * canvas.height,
        roi.width * scaleX * canvas.width,
        roi.height * scaleY * canvas.height
      );
      ctx.setLineDash([]);
    }
  }, [state.detectionsThisFrame, state.clusters, state.isActive, config?.roi, showDetections, showClusters, showROI]);

  useEffect(() => {
    onClusterUpdate?.(state.clusters);
  }, [state.clusters, onClusterUpdate]);

  useEffect(() => {
    if (state.detectionsThisFrame.length > 0) {
      state.detectionsThisFrame.forEach(d => onDetection?.(d));
      if (state.detectionsThisFrame.some(d => d.confidence > 0.8)) {
        hapticFeedback('light');
        playSound(800, 50);
      }
    }
  }, [state.detectionsThisFrame, onDetection]);

  const handleTorchToggle = useCallback(async () => {
    const enabled = await toggleTorch();
    setTorchEnabled(enabled);
  }, [toggleTorch]);

  const handleZoomChange = useCallback(async (zoom: number) => {
    await setZoom(zoom);
    setZoomLevel(zoom);
  }, [setZoom]);

  if (!isSupported) {
    return (
      <div className={`card flex flex-col items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <svg className="mx-auto h-16 w-16 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-surface-100">Câmera não suportada</h3>
          <p className="mt-2 text-surface-400">Seu navegador não suporta acesso à câmera ou BarcodeDetector API.</p>
          <p className="mt-2 text-sm text-surface-500">Use HTTPS e um navegador moderno (Chrome 88+, Firefox 89+, Safari 15+)</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full ${className}`}>
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-surface-900">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        <div ref={overlayRef} className="absolute inset-0 pointer-events-none" />

        {showROI && config?.roi?.enabled && (
          <div
            ref={roiRef}
            className="absolute border-2 border-yellow-500/50 bg-yellow-500/10 pointer-events-none"
            style={{
              left: `${(config.roi?.x || 0) * 100}%`,
              top: `${(config.roi?.y || 0) * 100}%`,
              width: `${(config.roi?.width || 1) * 100}%`,
              height: `${(config.roi?.height || 1) * 100}%`,
            }}
          >
            <div className="absolute -top-6 left-0 px-2 py-1 bg-yellow-500 text-surface-950 text-xs font-mono rounded">
              ROI
            </div>
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="scanner-frame w-3/4 h-1/2 max-w-[280px] max-h-[140px] rounded-xl" />
        </div>

        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2 ml-4">
            <span className={`px-2 py-1 rounded-full text-xs font-mono ${
              state.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {state.isActive ? '● ATIVO' : '○ PARADO'}
            </span>
            <span className="px-2 py-1 rounded-full text-xs font-mono bg-surface-800/50 text-surface-300 border border-surface-600">
              FPS: {state.currentFPS}
            </span>
            <span className="px-2 py-1 rounded-full text-xs font-mono bg-surface-800/50 text-surface-300 border border-surface-600">
              Frame: {state.frameCount}
            </span>
          </div>
          <div className="flex items-center gap-2 mr-4">
            <button
              onClick={handleTorchToggle}
              className={`p-2 rounded-xl transition-all ${
                torchEnabled ? 'bg-yellow-500/20 text-yellow-400' : 'bg-surface-800/50 text-surface-300'
              } border border-surface-600/50`}
              aria-label={torchEnabled ? 'Desligar lanterna' : 'Ligar lanterna'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-xl bg-surface-800/50 text-surface-300 border border-surface-600/50"
              aria-label="Configurações"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/50" onClick={() => setShowSettings(false)}>
          <div className="card w-full max-w-sm animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Configurações do Scanner</h3>
              <button onClick={() => setShowSettings(false)} className="p-2 rounded-lg hover:bg-surface-800">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">FPS Alvo</label>
                <input
                  type="range"
                  min="15"
                  max="60"
                  value={config?.targetFPS || 30}
                  onChange={e => updateConfig({ targetFPS: Number(e.target.value) })}
                  className="w-full h-2 bg-surface-700 rounded-lg appearance-none accent-pharma-500"
                />
                <p className="text-xs text-surface-500 mt-1">{config?.targetFPS || 30} FPS</p>
              </div>
              <div>
                <label className="label">Raio de Agrupamento Espacial</label>
                <input
                  type="range"
                  min="0.02"
                  max="0.2"
                  step="0.01"
                  value={config?.spatialClusteringRadius || 0.08}
                  onChange={e => updateConfig({ spatialClusteringRadius: Number(e.target.value) })}
                  className="w-full h-2 bg-surface-700 rounded-lg appearance-none accent-pharma-500"
                />
                <p className="text-xs text-surface-500 mt-1">{(config?.spatialClusteringRadius || 0.08).toFixed(2)}</p>
              </div>
              <div>
                <label className="label">Frames para Estabilidade</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={config?.stabilityFramesRequired || 3}
                  onChange={e => updateConfig({ stabilityFramesRequired: Number(e.target.value) })}
                  className="w-full h-2 bg-surface-700 rounded-lg appearance-none accent-pharma-500"
                />
                <p className="text-xs text-surface-500 mt-1">{config?.stabilityFramesRequired || 3} frames</p>
              </div>
              <div>
                <label className="label">Confiança Mínima</label>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={config?.minConfidence || 0.5}
                  onChange={e => updateConfig({ minConfidence: Number(e.target.value) })}
                  className="w-full h-2 bg-surface-700 rounded-lg appearance-none accent-pharma-500"
                />
                <p className="text-xs text-surface-500 mt-1">{(config?.minConfidence || 0.5).toFixed(2)}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-300">ROI (Região de Interesse)</span>
                <button
                                  onClick={() => updateConfig({ roi: { ...defaultROI, ...config?.roi, enabled: !config?.roi?.enabled } })}
                                  className={`relative w-12 h-6 rounded-full transition-colors ${
                                    config?.roi?.enabled ? 'bg-pharma-500' : 'bg-surface-600'
                                  }`}
                                >
                  <span
                    className={`absolute top-0.5 bottom-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      config?.roi?.enabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ScannerView.displayName = 'ScannerView';