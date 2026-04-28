// Meta (Facebook) Pixel — utilidades centralizadas para tracking de eventos
// Pixel ID fixo do MenusApp.
export const META_PIXEL_ID = "2148494139250147";

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
    __meta_pixel_initialized?: boolean;
  }
}

/**
 * Injeta o script base do Meta Pixel uma única vez (idempotente).
 * Deve ser chamado o mais cedo possível (em main.tsx).
 */
export function initMetaPixel(pixelId: string = META_PIXEL_ID) {
  if (typeof window === "undefined") return;
  if (window.__meta_pixel_initialized) return;

  /* eslint-disable */
  // @ts-ignore
  !(function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(
    window,
    document,
    "script",
    "https://connect.facebook.net/en_US/fbevents.js"
  );
  /* eslint-enable */

  window.fbq?.("init", pixelId);
  window.fbq?.("track", "PageView");

  // Fallback noscript no body (não em head)
  const noscript = document.createElement("noscript");
  const img = document.createElement("img");
  img.height = 1;
  img.width = 1;
  img.style.display = "none";
  img.src = `https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`;
  noscript.appendChild(img);
  document.body.appendChild(noscript);

  window.__meta_pixel_initialized = true;
}

/** Dispara um PageView (use em mudanças de rota SPA). */
export function trackPageView() {
  window.fbq?.("track", "PageView");
}

/** Evento padrão do Pixel. */
export function trackEvent(
  eventName:
    | "ViewContent"
    | "Lead"
    | "CompleteRegistration"
    | "AddToCart"
    | "InitiateCheckout"
    | "Purchase"
    | "Subscribe",
  params?: Record<string, any>
) {
  window.fbq?.("track", eventName, params || {});
}

/** Evento customizado. */
export function trackCustom(eventName: string, params?: Record<string, any>) {
  window.fbq?.("trackCustom", eventName, params || {});
}
