declare module "jpeg-js" {
  export function decode(data: Uint8Array, options?: any): { width: number; height: number; data: Uint8Array };
  export function encode(data: any, quality?: number): { data: Uint8Array; width: number; height: number };
}
