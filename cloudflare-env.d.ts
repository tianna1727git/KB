declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    STUDIO_AUTH_MODE?: 'chatgpt' | 'password' | 'gateway';
    AUTH_WORKSPACE?: 'kb' | 'pmi';
    AUTH_PUBLIC_ORIGIN?: string;
    AUTH_PROXY_SECRET?: string;
    AUTH_KB_ORIGIN?: string;
    AUTH_PMI_ORIGIN?: string;
    AUTH_HANDOFF_SECRET?: string;
    AUTH_ACCOUNTS_JSON?: string;
    ASSETS?: Fetcher;
  }
}
