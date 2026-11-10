// Vite convierte las imágenes importadas en URL (en el build único, en data: URL).
declare module '*.jpg' {
  const src: string;
  export default src;
}
declare module '*.webp' {
  const src: string;
  export default src;
}
declare module '*.glb' {
  const src: string;
  export default src;
}
declare module '*.vrm' {
  const src: string;
  export default src;
}
declare module '*.m4a' {
  const src: string;
  export default src;
}
declare module '*.png' {
  const src: string;
  export default src;
}
// import.meta.glob de Vite (sin traer todos los tipos de vite/client, que chocan con los de arriba)
interface ImportMeta {
  glob<T = unknown>(pattern: string, opts: { eager: true; query?: string; import?: string }): Record<string, T>;
}
