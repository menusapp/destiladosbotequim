import { useEffect, ReactNode } from "react";

interface KioskLayoutProps {
  children: ReactNode;
  primaryColor: string;
}

export function KioskLayout({ children, primaryColor }: KioskLayoutProps) {
  useEffect(() => {
    // Prevent context menu
    const onContext = (e: Event) => e.preventDefault();
    // Prevent text selection
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";
    document.addEventListener("contextmenu", onContext);

    // Attempt fullscreen
    const requestFS = () => {
      const el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    };
    const onFirstTouch = () => { requestFS(); document.removeEventListener("touchstart", onFirstTouch); };
    document.addEventListener("touchstart", onFirstTouch);

    return () => {
      document.removeEventListener("contextmenu", onContext);
      document.removeEventListener("touchstart", onFirstTouch);
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
    };
  }, []);

  return (
    <div className="min-h-screen bg-background overflow-hidden touch-manipulation select-none" style={{ "--kiosk-primary": primaryColor } as any}>
      {children}
    </div>
  );
}
