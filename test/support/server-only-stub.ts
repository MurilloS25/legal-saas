// Stub de `server-only` para vitest.
//
// El paquete real lanza un error cuando se resuelve fuera de un bundler
// consciente de React Server Components (como en el entorno de vitest/Node).
// Los módulos server-only del proyecto lo importan como guardia de build;
// en las pruebas se sustituye por este módulo vacío para poder ejercitar la
// lógica pura (generación de DOCX, filename) sin arrancar Next.js.
export {};
