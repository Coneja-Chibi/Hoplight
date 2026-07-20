/** Ambient declarations for dependencies that do not publish the TypeScript surface we consume. */
// Ambient type shims for the untyped png-chunks* libraries.
declare module "png-chunks-extract" {
  const extract: (data: Uint8Array) => { name: string; data: Uint8Array }[];
  export default extract;
}
declare module "png-chunks-encode" {
  const encode: (chunks: { name: string; data: Uint8Array }[]) => Uint8Array;
  export default encode;
}
declare module "png-chunk-text" {
  const text: {
    encode: (keyword: string, text: string) => { name: string; data: Uint8Array };
    decode: (data: Uint8Array) => { keyword: string; text: string };
  };
  export default text;
}
