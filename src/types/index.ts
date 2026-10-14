export interface BarcodeDetection {
  code: string;
  format: BarcodeFormat;
  confidence: number;
  boundingBox: BoundingBox;
  timestamp: number;
  frameId: number;
  position: Point;
  normalizedPosition: NormalizedPoint;
}

export type BarcodeFormat =
  | 'EAN_13'
  | 'EAN_8'
  | 'UPC_A'
  | 'UPC_E'
  | 'CODE_128'
  | 'CODE_39'
  | 'CODE_93'
  | 'CODABAR'
  | 'ITF'
  | 'RSS_14'
  | 'RSS_EXPANDED'
  | 'QR_CODE'
  | 'DATA_MATRIX'
  | 'AZTEC'
  | 'PDF_417'
  | 'UNKNOWN';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  topLeft: Point;
  topRight: Point;
  bottomLeft: Point;
  bottomRight: Point;
}

export interface Point {
  x: number;
  y: number;
}

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface SpatialCluster {
  id: string;
  barcode: string;
  format: BarcodeFormat;
  detections: BarcodeDetection[];
  centroid: Point;
  normalizedCentroid: NormalizedPoint;
  count: number;
  confidence: number;
  firstSeen: number;
  lastSeen: number;
  stabilityScore: number;
  isStable: boolean;
}

export interface Product {
  id: string;
  gtin: string;
  name: string;
  description?: string;
  manufacturer?: string;
  presentation?: string;
  concentration?: string;
  unit: UnitOfMeasure;
  barcodeFormats: BarcodeFormat[];
  price?: number;
  cost?: number;
  requiresPrescription: boolean;
  controlledSubstance: boolean;
  temperatureRange?: TemperatureRange;
  images?: string[];
  createdAt: string;
  updatedAt: string;
}

export type UnitOfMeasure = 'UN' | 'CX' | 'FR' | 'ML' | 'G' | 'KG' | 'L';

export interface TemperatureRange {
  min: number;
  max: number;
  unit: 'C' | 'F';
}

export interface InventorySession {
  id: string;
  storeId: string;
  userId: string;
  status: SessionStatus;
  startedAt: string;
  completedAt?: string;
  pausedAt?: string;
  totalItemsScanned: number;
  uniqueProductsScanned: number;
  divergencesCount: number;
  expiredItemsCount: number;
  nearExpiryItemsCount: number;
  settings: SessionSettings;
  metadata?: SessionMetadata;
}

export type SessionStatus =
  | 'draft'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'synced';

export interface SessionSettings {
  autoSaveInterval: number;
  divergenceThreshold: number;
  expiryAlertDays: number;
  requireConfirmation: boolean;
  scanMode: ScanMode;
  roiEnabled: boolean;
  perspectiveCorrection: boolean;
}

export type ScanMode = 'continuous' | 'single' | 'matrix';

export interface SessionMetadata {
  deviceInfo: DeviceInfo;
  location?: GeoLocation;
  networkStatus: 'online' | 'offline' | 'syncing';
  appVersion: string;
}

export interface DeviceInfo {
  userAgent: string;
  platform: string;
  screenResolution: string;
  cameraResolution?: string;
  isPWA: boolean;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface ScannedItem {
  id: string;
  sessionId: string;
  productId?: string;
  gtin: string;
  productName?: string;
  quantity: number;
  systemQuantity?: number;
  divergence: number;
  divergencePercentage: number;
  unitCost?: number;
  totalValue?: number;
  batchNumber?: string;
  expiryDate?: string;
  daysToExpiry?: number;
  status: ItemStatus;
  detections: BarcodeDetection[];
  spatialCluster?: SpatialCluster;
  location?: ShelfLocation;
  notes?: string;
  scannedAt: string;
  confirmedAt?: string;
  confirmedBy?: string;
}

export type ItemStatus =
  | 'pending'
  | 'confirmed'
  | 'divergence'
  | 'expired'
  | 'near_expiry'
  | 'not_found'
  | 'manual_entry';

export interface ShelfLocation {
  aisle: string;
  shelf: string;
  position: string;
  zone?: string;
}

export interface DivergenceLog {
  id: string;
  sessionId: string;
  itemId: string;
  type: DivergenceType;
  severity: DivergenceSeverity;
  expectedQuantity: number;
  actualQuantity: number;
  difference: number;
  valueImpact: number;
  description: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: DivergenceResolution;
  createdAt: string;
}

export type DivergenceType =
  | 'quantity_mismatch'
  | 'product_not_found'
  | 'expired_product'
  | 'near_expiry_product'
  | 'wrong_location'
  | 'damaged_product'
  | 'batch_mismatch';

export type DivergenceSeverity = 'low' | 'medium' | 'high' | 'critical';

export type DivergenceResolution =
  | 'accepted'
  | 'corrected'
  | 'investigating'
  | 'write_off'
  | 'return_to_supplier';

export interface ExpiryAlert {
  id: string;
  sessionId: string;
  itemId: string;
  productId: string;
  gtin: string;
  productName: string;
  batchNumber: string;
  expiryDate: string;
  daysToExpiry: number;
  quantity: number;
  severity: ExpirySeverity;
  acknowledged: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  createdAt: string;
}

export type ExpirySeverity = 'expired' | 'critical' | 'warning' | 'info';

export interface Store {
  id: string;
  name: string;
  cnpj: string;
  address: Address;
  phone?: string;
  email?: string;
  timezone: string;
  settings: StoreSettings;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface StoreSettings {
  defaultExpiryAlertDays: number;
  autoSyncEnabled: boolean;
  requirePhotoEvidence: boolean;
  allowedScanModes: ScanMode[];
  maxSessionDuration: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  storeIds: string[];
  avatarUrl?: string;
  preferences: UserPreferences;
  lastActiveAt: string;
  createdAt: string;
}

export type UserRole = 'admin' | 'manager' | 'operator' | 'auditor';

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: 'pt-BR' | 'en' | 'es';
  hapticFeedback: boolean;
  soundEnabled: boolean;
  autoFocus: boolean;
  vibrationOnScan: boolean;
}

export interface ScanEngineConfig {
  targetFPS: number;
  maxConcurrentCodes: number;
  minConfidence: number;
  spatialClusteringRadius: number;
  stabilityFramesRequired: number;
  roi: ROIConfig;
  perspectiveCorrection: PerspectiveConfig;
  formats: BarcodeFormat[];
  torchEnabled: boolean;
  zoomLevel: number;
}

export interface ROIConfig {
  enabled: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  normalized: boolean;
}

export interface PerspectiveConfig {
  enabled: boolean;
  method: 'homography' | 'affine' | 'none';
  cornerDetection: boolean;
}

export interface ScanEngineState {
  isActive: boolean;
  isInitialized: boolean;
  hasPermission: boolean;
  currentFPS: number;
  frameCount: number;
  detectionsThisFrame: BarcodeDetection[];
  clusters: SpatialCluster[];
  accumulatedCounts: Map<string, number>;
  errors: ScanError[];
}

export interface ScanError {
  code: string;
  message: string;
  timestamp: number;
  recoverable: boolean;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  schema?: string;
}

export interface DatabaseSchema {
  products: Product;
  inventory_sessions: InventorySession;
  scanned_items: ScannedItem;
  divergence_logs: DivergenceLog;
  expiry_alerts: ExpiryAlert;
  stores: Store;
  users: User;
}

export interface APIResponse<T> {
  data: T | null;
  error: APIError | null;
  metadata?: ResponseMetadata;
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  hint?: string;
}

export interface ResponseMetadata {
  requestId: string;
  timestamp: string;
  duration: number;
  cached: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface SyncStatus {
  pending: number;
  synced: number;
  failed: number;
  lastSyncAt?: string;
  nextSyncAt?: string;
}

export interface OfflineQueueItem {
  id: string;
  type: 'session' | 'item' | 'divergence' | 'alert';
  payload: unknown;
  timestamp: number;
  retries: number;
  maxRetries: number;
}

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

export interface CameraCapabilities {
  facingMode: 'environment' | 'user';
  resolution: { width: number; height: number }[];
  frameRate: { min: number; max: number }[];
  torch: boolean;
  zoom: { min: number; max: number; step: number };
  focusMode: ('auto' | 'continuous' | 'manual')[];
  exposureMode: ('auto' | 'manual')[];
  whiteBalanceMode: ('auto' | 'manual')[];
}

export interface ScanEngineConfig {
  targetFPS: number;
  maxConcurrentCodes: number;
  minConfidence: number;
  spatialClusteringRadius: number;
  stabilityFramesRequired: number;
  roi: ROIConfig;
  perspectiveCorrection: PerspectiveConfig;
  formats: BarcodeFormat[];
  torchEnabled: boolean;
  zoomLevel: number;
}

export interface ScanEngineState {
  isActive: boolean;
  isInitialized: boolean;
  hasPermission: boolean;
  currentFPS: number;
  frameCount: number;
  detectionsThisFrame: BarcodeDetection[];
  clusters: SpatialCluster[];
  accumulatedCounts: Map<string, number>;
  errors: ScanError[];
}

export interface ROIConfig {
  enabled: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  normalized: boolean;
}

export interface PerspectiveConfig {
  enabled: boolean;
  method: 'homography' | 'affine' | 'none';
  cornerDetection: boolean;
}