import { lazy, Suspense } from "react";

// Auto-recover from stale chunk errors after a redeploy.
// When index.html references a JS hash that no longer exists, force one reload.
const lazyWithRetry = <T,>(factory: () => Promise<{ default: T }>) =>
  lazy(() =>
    factory().catch((err) => {
      const msg = String(err?.message || err);
      if (
        /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(
          msg
        )
      ) {
        const key = "__chunk_reloaded__";
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          window.location.reload();
          return new Promise(() => {}) as any;
        }
      }
      throw err;
    })
  );
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { isOnRestaurantSubdomain } from "@/lib/slugResolver";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const RestaurantLogin = lazy(() => import("./pages/RestaurantLogin"));
const CEOLogin = lazy(() => import("./pages/CEOLogin"));
const CEODashboard = lazy(() => import("./pages/CEODashboard"));
const RestaurantAdmin = lazy(() => import("./pages/RestaurantAdmin"));
const Menu = lazy(() => import("./pages/Menu"));
const Comanda = lazy(() => import("./pages/Comanda"));
const DeliveryMenu = lazy(() => import("./pages/DeliveryMenu"));
const OrderConfirmation = lazy(() => import("./pages/OrderConfirmation"));
const Reservations = lazy(() => import("./pages/Reservations"));
const NotFound = lazy(() => import("./pages/NotFound"));
const StaffLogin = lazy(() => import("./pages/StaffLogin"));
const TableDetailView = lazy(() =>
  import("./components/admin/TableDetailView").then((m) => ({ default: m.TableDetailView }))
);
const MercadoPagoCallback = lazy(() => import("./pages/MercadoPagoCallback"));
const RestaurantRegistration = lazy(() => import("./pages/RestaurantRegistration"));
const PaymentPending = lazy(() => import("./pages/PaymentPending"));
const Kiosk = lazy(() => import("./pages/Kiosk"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3">
      <div className="h-10 w-10 rounded-full border-2 border-muted border-t-primary animate-spin" />
      <p className="text-sm text-muted-foreground">Carregando...</p>
    </div>
  </div>
);

const App = () => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Sonner />

          <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/*
                Quando acessado via subdomínio do restaurante (ex.: rods.menusapp.com.br/),
                a raiz "/" carrega o cardápio delivery; caso contrário mostra a landing.
              */}
              <Route
                path="/"
                element={isOnRestaurantSubdomain() ? <DeliveryMenu /> : <LandingPage />}
              />

              {/* Auth routes */}
              <Route path="/login" element={<RestaurantLogin />} />
              <Route path="/login/staff" element={<StaffLogin />} />
              <Route path="/login/ceo" element={<CEOLogin />} />

              {/* CEO Dashboard */}
              <Route path="/ceo" element={<CEODashboard />} />

              {/* MercadoPago callback */}
              <Route path="/admin/mercadopago/callback" element={<MercadoPagoCallback />} />

              {/* Registration routes (post-payment redirect) */}
              <Route path="/registro/:planSlug" element={<RestaurantRegistration />} />
              <Route path="/pagamento-pendente/:slug" element={<PaymentPending />} />

              {/* Restaurant-scoped routes (slug-based) */}
              <Route path="/:slug/kiosk" element={<Kiosk />} />
              <Route path="/:slug" element={<DeliveryMenu />} />
              {/* Pretty alias for subdomain links: rods.menusapp.com.br/menus */}
              <Route path="/:slug/menus" element={<DeliveryMenu />} />
              <Route path="/:slug/mesa/:tableNumber" element={<Menu />} />
              <Route path="/:slug/comanda/:tableNumber" element={<Comanda />} />
              <Route path="/:slug/pedido/:orderId" element={<OrderConfirmation />} />
              <Route path="/:slug/reservas" element={<Reservations />} />
              <Route
                path="/:slug/admin"
                element={
                  <ProtectedRoute>
                    <RestaurantAdmin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/:slug/admin/mesa/:tableId"
                element={
                  <ProtectedRoute>
                    <TableDetailView />
                  </ProtectedRoute>
                }
              />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </BrowserRouter>
);

export default App;
