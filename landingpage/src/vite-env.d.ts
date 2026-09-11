/// <reference types="vite/client" />

// Declared so they can be read as plain properties under
// noPropertyAccessFromIndexSignature. See .env.example.
interface ImportMetaEnv {
  readonly VITE_CLIENT_URL?: string;
  readonly VITE_BUSINESS_URL?: string;
}
