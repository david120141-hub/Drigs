export function generateId(prefix = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}${prefix ? '_' : ''}${timestamp}_${random}`;
}

export function generateSessionId(): string {
  return generateId('sess');
}

export function generateItemId(): string {
  return generateId('item');
}

export function generateClusterId(): string {
  return generateId('cluster');
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}

export function distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

export function normalizePoint(
  point: { x: number; y: number },
  width: number,
  height: number
): { x: number; y: number } {
  return {
    x: clamp(point.x / width, 0, 1),
    y: clamp(point.y / height, 0, 1),
  };
}

export function denormalizePoint(
  point: { x: number; y: number },
  width: number,
  height: number
): { x: number; y: number } {
  return {
    x: point.x * width,
    y: point.y * height,
  };
}

export function calculateCentroid(points: { x: number; y: number }[]): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

export function boxesOverlap(
  box1: { x: number; y: number; width: number; height: number },
  box2: { x: number; y: number; width: number; height: number },
  threshold = 0.3
): boolean {
  const xOverlap = Math.max(0, Math.min(box1.x + box1.width, box2.x + box2.width) - Math.max(box1.x, box2.x));
  const yOverlap = Math.max(0, Math.min(box1.y + box1.height, box2.y + box2.height) - Math.max(box1.y, box2.y));
  const overlapArea = xOverlap * yOverlap;
  const box1Area = box1.width * box1.height;
  const box2Area = box2.width * box2.height;
  const minArea = Math.min(box1Area, box2Area);
  return overlapArea / minArea > threshold;
}

export function calculateIOU(
  box1: { x: number; y: number; width: number; height: number },
  box2: { x: number; y: number; width: number; height: number }
): number {
  const x1 = Math.max(box1.x, box2.x);
  const y1 = Math.max(box1.y, box2.y);
  const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
  const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const area1 = box1.width * box1.height;
  const area2 = box2.width * box2.height;
  const union = area1 + area2 - intersection;

  return union > 0 ? intersection / union : 0;
}

export function formatTimestamp(timestamp: number, locale = 'pt-BR'): string {
  return new Date(timestamp).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatRelativeTime(timestamp: number, locale = 'pt-BR'): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d atrás`;
  if (hours > 0) return `${hours}h atrás`;
  if (minutes > 0) return `${minutes}min atrás`;
  return `${seconds}s atrás`;
}

export function formatNumber(value: number, locale = 'pt-BR'): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatCurrency(value: number, locale = 'pt-BR', currency = 'BRL'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
}

export function formatPercentage(value: number, locale = 'pt-BR'): string {
  return new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value / 100);
}

export function calculateDivergencePercentage(expected: number, actual: number): number {
  if (expected === 0) return actual > 0 ? 100 : 0;
  return ((actual - expected) / expected) * 100;
}

export function getDivergenceSeverity(percentage: number): 'low' | 'medium' | 'high' | 'critical' {
  const abs = Math.abs(percentage);
  if (abs >= 50) return 'critical';
  if (abs >= 20) return 'high';
  if (abs >= 5) return 'medium';
  return 'low';
}

export function getExpirySeverity(daysToExpiry: number): 'expired' | 'critical' | 'warning' | 'info' {
  if (daysToExpiry < 0) return 'expired';
  if (daysToExpiry <= 30) return 'critical';
  if (daysToExpiry <= 90) return 'warning';
  return 'info';
}

export function parseGTIN(barcode: string): string | null {
  const cleaned = barcode.replace(/\D/g, '');
  if (cleaned.length === 13 || cleaned.length === 14 || cleaned.length === 8 || cleaned.length === 12) {
    return cleaned.padStart(14, '0');
  }
  return null;
}

export function validateGTIN(gtin: string): boolean {
  if (!/^\d{8,14}$/.test(gtin)) return false;
  const digits = gtin.split('').map(Number);
  const checkDigit = digits.pop()!;
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += digits[i] * ((digits.length - i) % 2 === 0 ? 3 : 1);
  }
  const calculatedCheck = (10 - (sum % 10)) % 10;
  return calculatedCheck === checkDigit;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function retry<T>(
  fn: () => Promise<T>,
  options: { retries: number; delay: number; backoff?: number; onRetry?: (error: Error, attempt: number) => void } = { retries: 3, delay: 1000 }
): Promise<T> {
  const { retries, delay, backoff = 2, onRetry } = options;
  return fn().catch(async (error) => {
    if (retries <= 0) throw error;
    onRetry?.(error, retries);
    await sleep(delay);
    return retry(fn, { retries: retries - 1, delay: delay * backoff, backoff, onRetry });
  });
}

export function createEventEmitter<T extends Record<string, any>>() {
  type EventMap = { [K in keyof T]: T[K] };
  type Listener<K extends keyof T> = (data: T[K]) => void;

  const listeners: Map<keyof T, Set<Listener<any>>> = new Map();

  return {
    on<K extends keyof T>(event: K, listener: Listener<K>): () => void {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener);
      return () => this.off(event, listener);
    },
    off<K extends keyof T>(event: K, listener: Listener<K>): void {
      listeners.get(event)?.delete(listener);
    },
    emit<K extends keyof T>(event: K, data: T[K]): void {
      listeners.get(event)?.forEach(listener => listener(data));
    },
    clear(): void {
      listeners.clear();
    },
  };
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export function onOnline(callback: () => void): () => void {
  window.addEventListener('online', callback);
  return () => window.removeEventListener('online', callback);
}

export function onOffline(callback: () => void): () => void {
  window.addEventListener('offline', callback);
  return () => window.removeEventListener('offline', callback);
}

export function getDeviceInfo(): {
  userAgent: string;
  platform: string;
  screenResolution: string;
  isPWA: boolean;
} {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    screenResolution: `${screen.width}x${screen.height}`,
    isPWA: window.matchMedia('(display-mode: standalone)').matches,
  };
}

export function getCameraConstraints(facingMode: 'environment' | 'user' = 'environment'): MediaStreamConstraints {
  return {
    video: {
      facingMode: { exact: facingMode },
      width: { ideal: 1920, max: 3840 },
      height: { ideal: 1080, max: 2160 },
      frameRate: { ideal: 30, max: 60 },
      focusMode: 'continuous',
      exposureMode: 'auto',
      whiteBalanceMode: 'auto',
    },
    audio: false,
  };
}

export function supportsBarcodeDetection(): boolean {
  return 'BarcodeDetector' in window;
}

export function getSupportedBarcodeFormats(): string[] {
  if (!supportsBarcodeDetection()) return [];
  return [
    'ean_13',
    'ean_8',
    'upc_a',
    'upc_e',
    'code_128',
    'code_39',
    'code_93',
    'codabar',
    'itf',
    'qr_code',
    'data_matrix',
    'aztec',
    'pdf417',
  ];
}

export function createCanvasFromVideo(video: HTMLVideoElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, 0, 0);
  return canvas;
}

export function drawDetectionBoxes(
  ctx: CanvasRenderingContext2D,
  detections: Array<{ boundingBox: { x: number; y: number; width: number; height: number }; code: string; confidence: number }>,
  scaleX: number,
  scaleY: number
): void {
  ctx.strokeStyle = '#0ea5e9';
  ctx.lineWidth = 2;
  ctx.font = '12px JetBrains Mono, monospace';
  ctx.fillStyle = '#0ea5e9';

  detections.forEach(detection => {
    const x = detection.boundingBox.x * scaleX;
    const y = detection.boundingBox.y * scaleY;
    const width = detection.boundingBox.width * scaleX;
    const height = detection.boundingBox.height * scaleY;

    ctx.strokeRect(x, y, width, height);
    ctx.fillRect(x, y - 20, ctx.measureText(detection.code).width + 8, 20);
    ctx.fillStyle = '#0f172a';
    ctx.fillText(detection.code, x + 4, y - 5);
    ctx.fillStyle = '#0ea5e9';
  });
}

export function getContrastColor(hexColor: string): string {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#0f172a' : '#f8fafc';
}

export function hapticFeedback(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light'): void {
  if ('vibrate' in navigator) {
    const patterns: Record<string, number[]> = {
      light: [10],
      medium: [20],
      heavy: [30],
      success: [10, 50, 10],
      warning: [20, 100, 20],
      error: [50, 50, 50, 50, 50],
    };
    navigator.vibrate(patterns[type] || patterns.light);
  }
}

export function playSound(frequency: number, duration: number, type: OscillatorType = 'sine'): void {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gainNode.gain.value = 0.1;

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      audioContext.close();
    }, duration);
  } catch {
    // Silently fail if audio not available
  }
}

export function copyToClipboard(text: string): Promise<boolean> {
  return navigator.clipboard.writeText(text).then(
    () => true,
    () => false
  );
}

export function downloadJSON(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadCSV(data: Record<string, unknown>[], filename: string): void {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(obj => headers.map(h => JSON.stringify(obj[h] ?? '')).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}