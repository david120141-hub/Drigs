import type {
  ScanEngineConfig,
  ScanEngineState,
  BarcodeDetection,
  SpatialCluster,
  ScanError,
  CameraCapabilities,
} from '../../types';
import { createEventEmitter, getCameraConstraints, supportsBarcodeDetection, createCanvasFromVideo, sleep, generateId } from '@utils/helpers';
import { SpatialClusteringEngine, createSpatialClusteringEngine } from '@utils/spatialClustering';

export interface ScanEngineEvents {
  frame: { detections: BarcodeDetection[]; clusters: SpatialCluster[]; timestamp: number };
  detection: BarcodeDetection;
  clusterUpdate: SpatialCluster[];
  error: ScanError;
  stateChange: Partial<ScanEngineState>;
  initialized: void;
  started: void;
  stopped: void;
  permissionChange: { hasPermission: boolean; error?: string };
}

export class ScanEngine {
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private stream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private barcodeDetector: BarcodeDetector | null = null;
  private clusteringEngine: SpatialClusteringEngine;
  private config: ScanEngineConfig;
  private state: ScanEngineState;
  private events = createEventEmitter<ScanEngineEvents>();
  private lastFrameTime = 0;
  private frameCount = 0;
  private fpsUpdateInterval: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;

  constructor(config: Partial<ScanEngineConfig> = {}) {
    this.config = {
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
      ...config,
    };

    this.clusteringEngine = createSpatialClusteringEngine(this.config);

    this.state = {
      isActive: false,
      isInitialized: false,
      hasPermission: false,
      currentFPS: 0,
      frameCount: 0,
      detectionsThisFrame: [],
      clusters: [],
      accumulatedCounts: new Map(),
      errors: [],
    };
  }

  on<K extends keyof ScanEngineEvents>(event: K, listener: (data: ScanEngineEvents[K]) => void): () => void {
    return this.events.on(event, listener);
  }

  async initialize(videoElement: HTMLVideoElement): Promise<void> {
    this.video = videoElement;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

    try {
      await this.requestPermission();
      await this.setupCamera();
      await this.setupBarcodeDetector();
      this.setupFPSMonitoring();

      this.state.isInitialized = true;
      this.events.emit('initialized', undefined);
      this.events.emit('stateChange', { isInitialized: true });
    } catch (error) {
      this.addError({
        code: 'INIT_FAILED',
        message: error instanceof Error ? error.message : 'Falha ao inicializar scanner',
        timestamp: Date.now(),
        recoverable: true,
      });
      throw error;
    }
  }

  private async requestPermission(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(getCameraConstraints());
      stream.getTracks().forEach(track => track.stop());
      this.state.hasPermission = true;
      this.events.emit('permissionChange', { hasPermission: true });
    } catch (error) {
      this.state.hasPermission = false;
      const message = error instanceof Error ? error.message : 'Permissão de câmera negada';
      this.events.emit('permissionChange', { hasPermission: false, error: message });
      throw new Error(`Permissão de câmera necessária: ${message}`);
    }
  }

  private async setupCamera(): Promise<void> {
    if (!this.video) throw new Error('Elemento de vídeo não disponível');

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(getCameraConstraints());
      this.video.srcObject = this.stream;

      await new Promise<void>((resolve, reject) => {
        if (!this.video) return reject(new Error('Video element lost'));
        this.video.onloadedmetadata = () => {
          this.video!.play().then(resolve).catch(reject);
        };
        this.video.onerror = () => reject(new Error('Erro ao carregar vídeo'));
        setTimeout(() => reject(new Error('Timeout ao carregar câmera')), 10000);
      });

      this.canvas!.width = this.video.videoWidth;
      this.canvas!.height = this.video.videoHeight;

      if (this.config.torchEnabled && 'torch' in this.video) {
        try {
          await (this.video as any).torch?.toggle?.();
        } catch {
          // Torch not supported
        }
      }
    } catch (error) {
      throw new Error(`Falha ao configurar câmera: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  private async setupBarcodeDetector(): Promise<void> {
    if (!supportsBarcodeDetection()) {
      this.addError({
        code: 'BARCODE_DETECTOR_UNSUPPORTED',
        message: 'BarcodeDetector API não suportada, usando fallback ZXing',
        timestamp: Date.now(),
        recoverable: true,
      });
      return;
    }

    try {
      this.barcodeDetector = new BarcodeDetector({
        formats: this.config.formats.map(f => f.toLowerCase().replace('_', '_')),
      });
    } catch (error) {
      this.addError({
        code: 'BARCODE_DETECTOR_INIT_FAILED',
        message: `Falha ao inicializar BarcodeDetector: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        timestamp: Date.now(),
        recoverable: true,
      });
    }
  }

  private setupFPSMonitoring(): void {
    this.fpsUpdateInterval = setInterval(() => {
      this.state.currentFPS = this.frameCount;
      this.frameCount = 0;
      this.events.emit('stateChange', { currentFPS: this.state.currentFPS });
    }, 1000);
  }

  async start(): Promise<void> {
    if (!this.state.isInitialized) throw new Error('Scanner não inicializado');
    if (this.state.isActive) return;

    this.state.isActive = true;
    this.state.frameCount = 0;
    this.events.emit('started', undefined);
    this.events.emit('stateChange', { isActive: true });
    this.renderLoop();
  }

  async stop(): Promise<void> {
    this.state.isActive = false;
    this.events.emit('stopped', undefined);
    this.events.emit('stateChange', { isActive: false });

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.fpsUpdateInterval) {
      clearInterval(this.fpsUpdateInterval);
      this.fpsUpdateInterval = null;
    }
  }

  async destroy(): Promise<void> {
    await this.stop();

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.video = null;
    this.canvas = null;
    this.ctx = null;
    this.barcodeDetector = null;
    this.clusteringEngine.reset();
    this.events.clear();

    this.state = {
      isActive: false,
      isInitialized: false,
      hasPermission: false,
      currentFPS: 0,
      frameCount: 0,
      detectionsThisFrame: [],
      clusters: [],
      accumulatedCounts: new Map(),
      errors: [],
    };
  }

  private async renderLoop(): Promise<void> {
    if (!this.state.isActive || !this.video || !this.ctx) return;

    const now = performance.now();
    const targetFrameTime = 1000 / this.config.targetFPS;

    if (now - this.lastFrameTime < targetFrameTime) {
      this.animationFrameId = requestAnimationFrame(() => this.renderLoop());
      return;
    }

    this.lastFrameTime = now;
    this.frameCount++;
    this.state.frameCount++;

    if (this.video.readyState === this.video.HAVE_ENOUGH_DATA && !this.isProcessing) {
      await this.processFrame();
    }

    this.animationFrameId = requestAnimationFrame(() => this.renderLoop());
  }

  private async processFrame(): Promise<void> {
    if (!this.video || !this.ctx || !this.canvas) return;

    this.isProcessing = true;

    try {
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

      let detections: BarcodeDetection[] = [];

      if (this.barcodeDetector) {
        try {
          const results = await this.barcodeDetector.detect(this.canvas);
          detections = results.map((result, index) => this.mapBarcodeResult(result, index));
        } catch (error) {
          this.addError({
            code: 'DETECTION_FAILED',
            message: `Falha na detecção: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
            timestamp: Date.now(),
            recoverable: true,
          });
        }
      } else {
        detections = await this.fallbackZXingDetection();
      }

      const clusters = this.clusteringEngine.processFrame(detections, this.canvas.width, this.canvas.height);
      const accumulatedCounts = this.clusteringEngine.getAccumulatedCounts();

      this.state.detectionsThisFrame = detections;
      this.state.clusters = clusters;
      this.state.accumulatedCounts = accumulatedCounts;

      this.events.emit('frame', {
        detections,
        clusters,
        timestamp: Date.now(),
      });

      detections.forEach(d => this.events.emit('detection', d));
      this.events.emit('clusterUpdate', clusters);
      this.events.emit('stateChange', {
        detectionsThisFrame: detections,
        clusters,
        accumulatedCounts,
      });
    } catch (error) {
      this.addError({
        code: 'FRAME_PROCESSING_ERROR',
        message: `Erro no processamento do frame: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        timestamp: Date.now(),
        recoverable: true,
      });
    } finally {
      this.isProcessing = false;
    }
  }

  private mapBarcodeResult(result: DetectedBarcode, index: number): BarcodeDetection {
    const cornerPoints = (result.cornerPoints || []) as any[];
    const boundingBox = this.calculateBoundingBox(cornerPoints);

    return {
      code: result.rawValue,
      format: this.normalizeFormat(result.format),
      confidence: 1.0,
      boundingBox,
      timestamp: Date.now(),
      frameId: this.clusteringEngine.getFrameId(),
      position: {
        x: boundingBox.x + boundingBox.width / 2,
        y: boundingBox.y + boundingBox.height / 2,
      },
      normalizedPosition: {
        x: (boundingBox.x + boundingBox.width / 2) / this.canvas!.width,
        y: (boundingBox.y + boundingBox.height / 2) / this.canvas!.height,
      },
    };
  }

  private calculateBoundingBox(cornerPoints: any[]): BarcodeDetection['boundingBox'] {
    if (cornerPoints.length < 4) {
      return { x: 0, y: 0, width: 0, height: 0, topLeft: { x: 0, y: 0 }, topRight: { x: 0, y: 0 }, bottomLeft: { x: 0, y: 0 }, bottomRight: { x: 0, y: 0 } };
    }

    const xs = cornerPoints.map(p => p.x);
    const ys = cornerPoints.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      topLeft: cornerPoints[0],
      topRight: cornerPoints[1],
      bottomRight: cornerPoints[2],
      bottomLeft: cornerPoints[3],
    };
  }

  private normalizeFormat(format: string): BarcodeDetection['format'] {
    const formatMap: Record<string, BarcodeDetection['format']> = {
      'ean_13': 'EAN_13',
      'ean_8': 'EAN_8',
      'upc_a': 'UPC_A',
      'upc_e': 'UPC_E',
      'code_128': 'CODE_128',
      'code_39': 'CODE_39',
      'code_93': 'CODE_93',
      'codabar': 'CODABAR',
      'itf': 'ITF',
      'qr_code': 'QR_CODE',
      'data_matrix': 'DATA_MATRIX',
      'aztec': 'AZTEC',
      'pdf417': 'PDF_417',
    };
    return formatMap[format.toLowerCase()] || 'UNKNOWN';
  }

  private async fallbackZXingDetection(): Promise<BarcodeDetection[]> {
    return [];
  }

  private addError(error: ScanError): void {
    this.state.errors = [error, ...this.state.errors.slice(0, 9)];
    this.events.emit('error', error);
    this.events.emit('stateChange', { errors: this.state.errors });
  }

  getState(): ScanEngineState {
    return { ...this.state };
  }

  getConfig(): ScanEngineConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<ScanEngineConfig>): void {
    this.config = { ...this.config, ...config };
    this.clusteringEngine.updateConfig(this.config);
  }

  async toggleTorch(): Promise<boolean> {
    if (!this.video || !('torch' in this.video)) return false;

    try {
      const videoWithTorch = this.video as any;
      const currentState = videoWithTorch.torch?.state || 'off';
      await videoWithTorch.torch?.toggle?.();
      this.config.torchEnabled = currentState === 'off';
      return this.config.torchEnabled;
    } catch {
      return false;
    }
  }

  async setZoom(zoom: number): Promise<void> {
    if (!this.stream) return;

    const track = this.stream.getVideoTracks()[0];
    if (!track || !('getCapabilities' in track)) return;

    const capabilities = track.getCapabilities() as MediaTrackCapabilities & { zoom?: MediaSettingsRange };
    const zoomCaps = capabilities.zoom as MediaSettingsRange;
    if (!zoomCaps) return;

    const min = zoomCaps.min as number;
    const max = zoomCaps.max as number;
    const clampedZoom = Math.max(min, Math.min(max, zoom));
    await track.applyConstraints({ advanced: [{ zoom: clampedZoom }] } as unknown as MediaTrackConstraints);
    this.config.zoomLevel = clampedZoom;
  }

  getCapabilities(): CameraCapabilities | null {
    if (!this.stream) return null;

    const track = this.stream.getVideoTracks()[0];
    if (!track || !('getCapabilities' in track)) return null;

    const caps = track.getCapabilities();
    return {
      facingMode: 'environment',
      resolution: [{ width: (caps.width?.max ?? 1920) as number, height: (caps.height?.max ?? 1080) as number }],
      frameRate: [{ min: (caps.frameRate?.min ?? 15) as number, max: (caps.frameRate?.max ?? 60) as number }],
      torch: 'torch' in caps,
      zoom: { min: (caps.zoom?.min ?? 1) as number, max: (caps.zoom?.max ?? 1) as number, step: (caps.zoom?.step ?? 0.1) as number },
      focusMode: (caps.focusMode || ['continuous']) as ('auto' | 'continuous' | 'manual')[],
      exposureMode: (caps.exposureMode || ['auto']) as ('auto' | 'manual')[],
      whiteBalanceMode: (caps.whiteBalanceMode || ['auto']) as ('auto' | 'manual')[],
    };
  }

  captureFrame(): string | null {
    if (!this.canvas) return null;
    return this.canvas.toDataURL('image/jpeg', 0.8);
  }

  getClusteringEngine(): SpatialClusteringEngine {
    return this.clusteringEngine;
  }
}

export function createScanEngine(config?: Partial<ScanEngineConfig>): ScanEngine {
  return new ScanEngine(config);
}