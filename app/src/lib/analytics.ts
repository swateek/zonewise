declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

let ready = false;

/** Load gtag when a measurement ID is baked in at build time; no-op otherwise. */
export function initAnalytics(): void {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
  if (!measurementId) return;

  window.dataLayer = window.dataLayer || [];
  // Must push the Arguments object — rest-param arrays are ignored by gtag.js.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId);
  ready = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
}

/** Fire a GA4 custom event when analytics is configured; no-op otherwise. */
export function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean>,
): void {
  if (!ready || typeof window.gtag !== "function") return;
  window.gtag("event", name, params);
}
