// Punto de entrada propio para el Toaster: importarlo con `import()` directo del barril
// '@yewdiel21/motion-kit/react' obligaría a Rollup a emitir el namespace completo del kit.
// Desde este módulo solo viaja el Toaster (y GSAP) en su chunk diferido.
export { Toaster } from '@yewdiel21/motion-kit/react';
