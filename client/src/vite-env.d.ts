/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Pełny URL katalogu API, np. http://127.0.0.1:3001/api — gdy puste, używane jest /api (proxy Vite). */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
