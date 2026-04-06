/**
 * Performance monitoring utility for Menus admin panel.
 * Tracks initial load time, active subscriptions, and query counts.
 */

interface PerformanceReport {
  initialLoadMs: number;
  activeSubscriptions: number;
  initialQueries: number;
}

let loadStart = performance.now();
let queryCount = 0;
let subscriptionCount = 0;

export function trackQuery() {
  queryCount++;
}

export function trackSubscription(delta: 1 | -1 = 1) {
  subscriptionCount += delta;
}

export function getActiveSubscriptions() {
  return subscriptionCount;
}

export function printPerformanceReport() {
  const loadTime = Math.round(performance.now() - loadStart);
  console.log(`
=== MENUS PERFORMANCE REPORT ===
Tempo de carregamento: ${loadTime}ms
Subscriptions ativas: ${subscriptionCount}
Queries na inicialização: ${queryCount}
================================
  `.trim());
}

// Auto-print after initial load settles (dev only)
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.addEventListener('load', () => {
    setTimeout(printPerformanceReport, 3000);
  });
}
