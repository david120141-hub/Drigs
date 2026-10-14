// Type declarations for browser APIs not included in standard lib.dom.d.ts

interface BarcodeDetector {
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
}

interface DetectedBarcode {
  rawValue: string;
  format: string;
  cornerPoints?: ReadonlyArray<Point2D>;
  boundingBox?: DOMRectReadOnly;
}

interface Point2D {
  x: number;
  y: number;
}

interface BarcodeDetectorOptions {
  formats?: string[];
}

declare var BarcodeDetector: {
  prototype: BarcodeDetector;
  new(options?: BarcodeDetectorOptions): BarcodeDetector;
  getSupportedFormats(): Promise<string[]>;
};

interface MediaTrackCapabilities {
  zoom?: MediaSettingsRange;
  focusMode?: string[];
  exposureMode?: string[];
  whiteBalanceMode?: string[];
}

interface MediaTrackConstraints {
  zoom?: number | ConstrainDouble;
  focusMode?: ConstrainDOMString;
  exposureMode?: ConstrainDOMString;
  whiteBalanceMode?: ConstrainDOMString;
}

interface MediaSettingsRange {
  min: number;
  max: number;
  step: number;
}

interface ConstrainDouble {
  exact?: number;
  ideal?: number;
  min?: number;
  max?: number;
}

interface ConstrainDOMString {
  exact?: string | string[];
  ideal?: string | string[];
}