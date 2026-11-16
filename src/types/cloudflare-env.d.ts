declare namespace Cloudflare {
  interface Env {
    ADMIN_PASSWORD: string;
    VAPID_SUBJECT?: string;
    VAPID_PUBLIC_KEY?: string;
    VAPID_PRIVATE_KEY?: string;
  }
}
