import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { ScanEngineConfig, ScanEngineState, BarcodeDetection, SpatialCluster, ScanError } from '../../types';
import { ScanEngine, createScanEngine } from './ScanEngine';

export interface UseScanEngineReturn {
  state: ScanEngineState;
  config: ScanEngineConfig;
  initialize: (videoElement: HTMLVideoElement) => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  destroy: () => Promise<void>;
  updateConfig: (config: Partial<ScanEngineConfig>) => void;
  toggleTorch: () => Promise<boolean>;
  setZoom: (zoom: number) => Promise<void>;
  captureFrame: () => string | null;
  getCapabilities: () => import('../../types').CameraCapabilities | null;
  clearErrors: () => void;
  isSupported: boolean;
}

export function useScanEngine(initialConfig: Partial<ScanEngineConfig> = {}): UseScanEngineReturn {
  const engineRef = useRef<ScanEngine | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [state, setState] = useState<ScanEngineState>({
    isActive: false,
    isInitialized: false,
    hasPermission: false,
    currentFPS: 0,
    frameCount: 0,
    detectionsThisFrame: [],
    clusters: [],
    accumulatedCounts: new Map(),
    errors: [],
  });
  const [config, setConfig] = useState<ScanEngineConfig>({
    targetFPS: 30,
    maxConcurrentCodes: 50,
    minConfidence: 0.5,
    spatialClusteringRadius: 0.08,
    stabilityFramesRequired: 3,
    roi: { enabled: false, x: 0, y: 0, width: 1, height: 1, normalized: true },
    perspectiveCorrection: { enabled: false, method: 'none', cornerDetection: false },
    formats: [
      'EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'CODE_128', 'CODE_39',
      'CODE_93', 'CODABAR', 'ITF', 'QR_CODE', 'DATA_MATRIX', 'AZTEC', 'PDF_417'
    ],
    torchEnabled: false,
    zoomLevel: 1,
    ...initialConfig,
  });
  const [isSupported] = useState(() => 'BarcodeDetector' in window || 'mediaDevices' in navigator);

  useEffect(() => {
    engineRef.current = createScanEngine(config);

    const engine = engineRef.current;

    const unsubFrame = engine.on('frame', ({ detections, clusters }) => {
      setState(prev => ({ ...prev, detectionsThisFrame: detections, clusters }));
    });

    const unsubStateChange = engine.on('stateChange', (newState) => {
      setState(prev => ({ ...prev, ...newState }));
    });

    const unsubError = engine.on('error', (error) => {
      setState(prev => ({ ...prev, errors: [error, ...prev.errors.slice(0, 9)] }));
    });

    return () => {
      unsubFrame();
      unsubStateChange();
      unsubError();
      engine.destroy().catch(console.error);
      engineRef.current = null;
    };
  }, []);

  const initialize = useCallback(async (videoElement: HTMLVideoElement) => {
    videoRef.current = videoElement;
    const engine = engineRef.current;
    if (!engine) throw new Error('Engine not initialized');

    await engine.initialize(videoElement);
    setState(engine.getState());
    setConfig(engine.getConfig());
  }, []);

  const start = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) throw new Error('Engine not initialized');
    await engine.start();
    setState(engine.getState());
  }, []);

  const stop = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    await engine.stop();
    setState(engine.getState());
  }, []);

  const destroy = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    await engine.destroy();
    setState(engine.getState());
  }, []);

  const updateConfig = useCallback((newConfig: Partial<ScanEngineConfig>) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.updateConfig(newConfig);
    setConfig(engine.getConfig());
  }, []);

  const toggleTorch = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return false;
    const result = await engine.toggleTorch();
    setConfig(engine.getConfig());
    return result;
  }, []);

  const setZoom = useCallback(async (zoom: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    await engine.setZoom(zoom);
    setConfig(engine.getConfig());
  }, []);

  const captureFrame = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return null;
    return engine.captureFrame();
  }, []);

  const getCapabilities = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return null;
    return engine.getCapabilities();
  }, []);

  const clearErrors = useCallback(() => {
    setState(prev => ({ ...prev, errors: [] }));
  }, []);

  const memoizedReturn = useMemo<UseScanEngineReturn>(() => ({
    state,
    config,
    initialize,
    start,
    stop,
    destroy,
    updateConfig,
    toggleTorch,
    setZoom,
    captureFrame,
    getCapabilities,
    clearErrors,
    isSupported,
  }), [
    state,
    config,
    initialize,
    start,
    stop,
    destroy,
    updateConfig,
    toggleTorch,
    setZoom,
    captureFrame,
    getCapabilities,
    clearErrors,
    isSupported,
  ]);

  return memoizedReturn;
}

export function useScanEngineEvents() {
  const engineRef = useRef<ScanEngine | null>(null);

  const bindEngine = useCallback((engine: ScanEngine) => {
    engineRef.current = engine;
  }, []);

  const onFrame = useCallback((callback: (data: { detections: BarcodeDetection[]; clusters: SpatialCluster[]; timestamp: number }) => void) => {
    return engineRef.current?.on('frame', callback) || (() => {});
  }, []);

  const onDetection = useCallback((callback: (detection: BarcodeDetection) => void) => {
    return engineRef.current?.on('detection', callback) || (() => {});
  }, []);

  const onClusterUpdate = useCallback((callback: (clusters: SpatialCluster[]) => void) => {
    return engineRef.current?.on('clusterUpdate', callback) || (() => {});
  }, []);

  const onError = useCallback((callback: (error: ScanError) => void) => {
    return engineRef.current?.on('error', callback) || (() => {});
  }, []);

  const onStateChange = useCallback((callback: (state: Partial<ScanEngineState>) => void) => {
    return engineRef.current?.on('stateChange', callback) || (() => {});
  }, []);

  return {
    bindEngine,
    onFrame,
    onDetection,
    onClusterUpdate,
    onError,
    onStateChange,
  };
}