import type {
  BarcodeDetection,
  SpatialCluster,
  NormalizedPoint,
  Point,
  ScanEngineConfig,
} from '../types';
import { generateClusterId, distance, calculateCentroid, normalizePoint, boxesOverlap } from '@utils/helpers';

export class SpatialClusteringEngine {
  private clusters: Map<string, SpatialCluster> = new Map();
  private config: ScanEngineConfig;
  private frameId = 0;

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
  }

  updateConfig(config: Partial<ScanEngineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  processFrame(detections: BarcodeDetection[], frameWidth: number, frameHeight: number): SpatialCluster[] {
    this.frameId++;

    const validDetections = detections.filter(d =>
      d.confidence >= this.config.minConfidence &&
      this.config.formats.includes(d.format)
    );

    const normalizedDetections = validDetections.map(d => ({
      ...d,
      normalizedPosition: normalizePoint(d.position, frameWidth, frameHeight),
    }));

    this.updateClusters(normalizedDetections);
    this.cleanupStaleClusters();

    return Array.from(this.clusters.values());
  }

  private updateClusters(detections: (BarcodeDetection & { normalizedPosition: NormalizedPoint })[]): void {
    const detectionClusters = new Map<string, typeof detections>();

    detections.forEach(detection => {
      let matchedClusterId: string | null = null;
      let minDistance = Infinity;

      this.clusters.forEach((cluster, clusterId) => {
        if (cluster.barcode !== detection.code) return;

        const dist = distance(cluster.normalizedCentroid, detection.normalizedPosition);
        if (dist < this.config.spatialClusteringRadius && dist < minDistance) {
          minDistance = dist;
          matchedClusterId = clusterId;
        }
      });

      if (matchedClusterId) {
        if (!detectionClusters.has(matchedClusterId)) {
          detectionClusters.set(matchedClusterId, []);
        }
        detectionClusters.get(matchedClusterId)!.push(detection);
      } else {
        const newClusterId = generateClusterId();
        detectionClusters.set(newClusterId, [detection]);
      }
    });

    detectionClusters.forEach((clusterDetections, clusterId) => {
      const existingCluster = this.clusters.get(clusterId);
      const positions = clusterDetections.map(d => d.normalizedPosition);
      const centroid = calculateCentroid(positions);
      const codes = clusterDetections.map(d => d.code);
      const formats = clusterDetections.map(d => d.format);
      const confidences = clusterDetections.map(d => d.confidence);

      if (existingCluster) {
        const allDetections = [...existingCluster.detections, ...clusterDetections];
        const uniqueByPosition = this.deduplicateByPosition(allDetections);

        existingCluster.detections = uniqueByPosition.slice(-this.config.maxConcurrentCodes);
        existingCluster.centroid = { x: centroid.x * frameWidth, y: centroid.y * frameHeight };
        existingCluster.normalizedCentroid = centroid;
        existingCluster.count = this.estimateCount(uniqueByPosition);
        existingCluster.confidence = Math.max(...confidences);
        existingCluster.lastSeen = Date.now();
        existingCluster.stabilityScore = this.calculateStability(existingCluster);
        existingCluster.isStable = existingCluster.stabilityScore >= this.config.stabilityFramesRequired;
      } else {
        const firstDetection = clusterDetections[0];
        this.clusters.set(clusterId, {
          id: clusterId,
          barcode: firstDetection.code,
          format: firstDetection.format,
          detections: clusterDetections,
          centroid: { x: centroid.x * frameWidth, y: centroid.y * frameHeight },
          normalizedCentroid: centroid,
          count: clusterDetections.length,
          confidence: Math.max(...confidences),
          firstSeen: Date.now(),
          lastSeen: Date.now(),
          stabilityScore: 1,
          isStable: false,
        });
      }
    });
  }

  private deduplicateByPosition(detections: BarcodeDetection[]): BarcodeDetection[] {
    const unique: BarcodeDetection[] = [];

    detections.forEach(detection => {
      const isDuplicate = unique.some(existing =>
        boxesOverlap(existing.boundingBox, detection.boundingBox, 0.5)
      );
      if (!isDuplicate) {
        unique.push(detection);
      }
    });

    return unique;
  }

  private estimateCount(detections: BarcodeDetection[]): number {
    if (detections.length <= 1) return detections.length;

    const positions = detections.map(d => d.normalizedPosition);
    const distances: number[] = [];

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        distances.push(distance(positions[i], positions[j]));
      }
    }

    if (distances.length === 0) return detections.length;

    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
    const minDistance = Math.min(...distances);

    const estimatedCount = Math.max(
      detections.length,
      Math.round(detections.length * (avgDistance / Math.max(minDistance, 0.01)))
    );

    return Math.min(estimatedCount, detections.length * 3);
  }

  private calculateStability(cluster: SpatialCluster): number {
    const now = Date.now();
    const age = now - cluster.firstSeen;
    const recentDetections = cluster.detections.filter(d => now - d.timestamp < 2000);
    const uniquePositions = new Set(
      recentDetections.map(d => `${Math.round(d.normalizedPosition.x * 100)},${Math.round(d.normalizedPosition.y * 100)}`)
    ).size;

    const timeFactor = Math.min(age / 3000, 1);
    const positionFactor = Math.min(uniquePositions / 3, 1);
    const detectionFactor = Math.min(recentDetections.length / 10, 1);

    return (timeFactor + positionFactor + detectionFactor) / 3 * 10;
  }

  private cleanupStaleClusters(): void {
    const now = Date.now();
    const maxAge = 5000;

    this.clusters.forEach((cluster, id) => {
      if (now - cluster.lastSeen > maxAge) {
        this.clusters.delete(id);
      }
    });
  }

  getClusters(): SpatialCluster[] {
    return Array.from(this.clusters.values());
  }

  getCluster(id: string): SpatialCluster | undefined {
    return this.clusters.get(id);
  }

  getStableClusters(): SpatialCluster[] {
    return Array.from(this.clusters.values()).filter(c => c.isStable);
  }

  getAccumulatedCounts(): Map<string, number> {
    const counts = new Map<string, number>();
    this.clusters.forEach(cluster => {
      counts.set(cluster.barcode, Math.max(counts.get(cluster.barcode) || 0, cluster.count));
    });
    return counts;
  }

  reset(): void {
    this.clusters.clear();
    this.frameId = 0;
  }

  getFrameId(): number {
    return this.frameId;
  }
}

let frameWidth = 1920;
let frameHeight = 1080;

export function setFrameDimensions(width: number, height: number): void {
  frameWidth = width;
  frameHeight = height;
}

export function createSpatialClusteringEngine(config?: Partial<ScanEngineConfig>): SpatialClusteringEngine {
  return new SpatialClusteringEngine(config);
}