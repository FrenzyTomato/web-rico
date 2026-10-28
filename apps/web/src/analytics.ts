/**
 * Cloudflare Web Analytics (free, cookie-free daily visits). Loaded only when the build has a beacon token,
 * so local development and builds without the variable send nothing. Set VITE_CF_BEACON_TOKEN in Vercel.
 */
export function startAnalytics(token = import.meta.env.VITE_CF_BEACON_TOKEN as string | undefined) {
  if (!token?.trim() || typeof document === 'undefined') return;
  const script = document.createElement('script');
  script.defer = true;
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.dataset.cfBeacon = JSON.stringify({ token: token.trim() });
  document.head.appendChild(script);
}
