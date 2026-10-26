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
declare module '*.hdr' {
  const src: string;
  export default src;
}
declare module '*.png' {
  const src: string;
  export default src;
}
