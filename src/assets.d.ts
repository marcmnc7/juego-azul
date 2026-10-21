// Vite convierte las imágenes importadas en URL (en el build único, en data: URL).
declare module '*.jpg' {
  const src: string;
  export default src;
}
declare module '*.webp' {
  const src: string;
  export default src;
}
