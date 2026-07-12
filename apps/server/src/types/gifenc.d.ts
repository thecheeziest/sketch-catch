// gifenc는 자체 타입 선언(.d.ts)을 제공하지 않음 (JS-only 패키지) — ambient 선언으로 대체
// (참고: apps/server/src/types/hangul-js.d.ts와 동일한 패턴)
declare module 'gifenc' {
  export type GifEncoderWriteFrameOptions = {
    transparent?: boolean;
    transparentIndex?: number;
    delay?: number;
    palette?: number[][] | null;
    repeat?: number;
    colorDepth?: number;
    dispose?: number;
    first?: boolean;
  };

  export type GifEncoderInstance = {
    reset(): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: GifEncoderWriteFrameOptions
    ): void;
  };

  export function GIFEncoder(options?: { initialCapacity?: number; auto?: boolean }): GifEncoderInstance;

  export function quantize(
    data: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: Record<string, unknown>
  ): number[][];

  export function applyPalette(
    data: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: string
  ): Uint8Array;
}
