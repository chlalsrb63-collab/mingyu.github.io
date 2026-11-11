/**
 * The bindings the platform injects at deploy.
 *
 * These are NOT declared by this repo's `wrangler.jsonc` in production — the
 * deploy generates an authoritative config from `app.manifest.json` plus the app
 * row and ignores the committed one.
 */
export interface Env {
  /** Static client files (dist/client), served asset-first. */
  ASSETS: Fetcher;
  /** One Durable Object instance per channel, plus the character vault. */
  ROOMS: DurableObjectNamespace;
  /** "dev" | "prod" — the CODE's environment label. */
  HF_ENV?: string;
  /** This app's subdomain label. */
  APP_SLUG?: string;
}
