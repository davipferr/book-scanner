import { MAX_PAGE_SIDE, fitWithin } from './size';

export type CameraError = 'insecure' | 'unsupported' | 'denied' | 'not-found' | 'failed';

export class CameraUnavailable extends Error {
  constructor(readonly reason: CameraError, message: string) {
    super(message);
  }
}

/** The phone's back camera streamed into a <video>, with still capture and optional torch. */
export class Camera {
  private stream: MediaStream | null = null;
  private torchOn = false;

  constructor(private readonly video: HTMLVideoElement) {}

  get active(): boolean {
    return this.stream !== null;
  }

  async start(): Promise<void> {
    if (this.stream) return;
    if (!window.isSecureContext) {
      throw new CameraUnavailable('insecure', 'The camera only works over HTTPS (or on localhost).');
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new CameraUnavailable('unsupported', 'This browser cannot open the camera.');
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          // Ask for a high resolution; the browser picks the closest the camera supports.
          width: { ideal: 3840 },
          height: { ideal: 2160 },
        },
      });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        throw new CameraUnavailable('denied', 'Camera permission was denied.');
      }
      if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        throw new CameraUnavailable('not-found', 'No camera was found on this device.');
      }
      throw new CameraUnavailable('failed', `Could not open the camera (${name || String(err)}).`);
    }
    this.video.srcObject = this.stream;
    await this.video.play();
    // Wait until the first frame gives the real video size.
    if (this.video.videoWidth === 0) {
      await new Promise<void>((resolve) =>
        this.video.addEventListener('loadedmetadata', () => resolve(), { once: true }),
      );
    }
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.torchOn = false;
    this.video.srcObject = null;
  }

  private get track(): MediaStreamTrack | null {
    return this.stream?.getVideoTracks()[0] ?? null;
  }

  get hasTorch(): boolean {
    const caps = this.track?.getCapabilities?.() as { torch?: boolean } | undefined;
    return caps?.torch === true;
  }

  get torch(): boolean {
    return this.torchOn;
  }

  async setTorch(on: boolean): Promise<void> {
    const track = this.track;
    if (!track || !this.hasTorch) return;
    await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
    this.torchOn = on;
  }

  /** Grabs the current frame as a JPEG. */
  async capture(): Promise<Blob> {
    const { videoWidth, videoHeight } = this.video;
    if (!this.stream || videoWidth === 0) throw new Error('Camera is not running.');
    const size = fitWithin({ width: videoWidth, height: videoHeight }, MAX_PAGE_SIDE);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.getContext('2d')!.drawImage(this.video, 0, 0, size.width, size.height);
    return canvasToJpeg(canvas);
  }
}

/** Re-encodes a picked photo file to the same max size and format as camera captures. */
export async function normalizePhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const size = fitWithin({ width: bitmap.width, height: bitmap.height }, MAX_PAGE_SIDE);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  return canvasToJpeg(canvas);
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the photo.'))), 'image/jpeg', 0.9),
  );
}
