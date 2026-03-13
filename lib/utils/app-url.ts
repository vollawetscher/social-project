/**
 * Returns the canonical base URL of the app.
 * Priority: NEXT_PUBLIC_APP_URL → VERCEL_URL → RAILWAY_PUBLIC_DOMAIN → localhost
 */
export function getAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null) ||
    'http://localhost:3000'
  )
}
