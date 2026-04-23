import { useEffect } from "react";

/**
 * Dynamically updates the page favicon and title based on the restaurant.
 * Used in public-facing pages (menu, comanda, kiosk, reservations, order confirmation)
 * so each restaurant's customers see their own brand in the browser tab and on
 * shared link previews.
 *
 * On unmount, restores the original favicon and title (Menu's defaults).
 */
export function useDynamicFavicon(logoUrl?: string | null, restaurantName?: string | null) {
  useEffect(() => {
    if (!logoUrl && !restaurantName) return;

    const head = document.head;

    // --- Snapshot current state to restore later ---
    const originalTitle = document.title;
    const existingIcons = Array.from(
      head.querySelectorAll<HTMLLinkElement>(
        "link[rel='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon']"
      )
    );
    const originalIconsSnapshot = existingIcons.map((el) => ({
      el,
      rel: el.rel,
      href: el.href,
      type: el.type,
      sizes: el.sizes?.value,
    }));

    // --- Update title ---
    if (restaurantName) {
      document.title = `${restaurantName} - Cardápio Digital`;
    }

    // --- Update favicon ---
    let injectedIcon: HTMLLinkElement | null = null;
    let injectedAppleIcon: HTMLLinkElement | null = null;

    if (logoUrl) {
      // Remove existing icons
      existingIcons.forEach((el) => el.parentNode?.removeChild(el));

      // Inject new favicon
      injectedIcon = document.createElement("link");
      injectedIcon.rel = "icon";
      injectedIcon.href = logoUrl;
      injectedIcon.type = guessMimeType(logoUrl);
      head.appendChild(injectedIcon);

      // Apple touch icon (for iOS bookmarks)
      injectedAppleIcon = document.createElement("link");
      injectedAppleIcon.rel = "apple-touch-icon";
      injectedAppleIcon.href = logoUrl;
      head.appendChild(injectedAppleIcon);
    }

    // --- Cleanup: restore original state ---
    return () => {
      document.title = originalTitle;

      if (injectedIcon?.parentNode) injectedIcon.parentNode.removeChild(injectedIcon);
      if (injectedAppleIcon?.parentNode)
        injectedAppleIcon.parentNode.removeChild(injectedAppleIcon);

      // Re-attach original icons
      originalIconsSnapshot.forEach(({ rel, href, type, sizes }) => {
        const link = document.createElement("link");
        link.rel = rel;
        link.href = href;
        if (type) link.type = type;
        if (sizes) link.sizes.value = sizes;
        head.appendChild(link);
      });
    };
  }, [logoUrl, restaurantName]);
}

function guessMimeType(url: string): string {
  const lower = url.split("?")[0].toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".ico")) return "image/x-icon";
  return "image/png";
}
