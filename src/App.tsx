import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import LandingPage from "./pages/LandingPage";
import RestaurantLogin from "./pages/RestaurantLogin";
import CEOLogin from "./pages/CEOLogin";

import CEODashboard from "./pages/CEODashboard";
import RestaurantAdmin from "./pages/RestaurantAdmin";
import Menu from "./pages/Menu";
import Comanda from "./pages/Comanda";
import DeliveryMenu from "./pages/DeliveryMenu";
import OrderConfirmation from "./pages/OrderConfirmation";
import Reservations from "./pages/Reservations";
import NotFound from "./pages/NotFound";
import StaffLogin from "./pages/StaffLogin";
import { TableDetailView } from "./components/admin/TableDetailView";
import MercadoPagoCallback from "./pages/MercadoPagoCallback";
import RestaurantRegistration from "./pages/RestaurantRegistration";
import PaymentPending from "./pages/PaymentPending";
import Kiosk from "./pages/Kiosk";


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Sonner />
          
          <Routes>
            {/* Landing page comercial */}
            <Route path="/" element={<LandingPage />} />
            
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
            <Route path="/:slug/mesa/:tableNumber" element={<Menu />} />
            <Route path="/:slug/comanda/:tableNumber" element={<Comanda />} />
            <Route path="/:slug/pedido/:orderId" element={<OrderConfirmation />} />
            <Route path="/:slug/reservas" element={<Reservations />} />
            <Route path="/:slug/admin" element={
              <ProtectedRoute>
                <RestaurantAdmin />
              </ProtectedRoute>
            } />
            <Route path="/:slug/admin/mesa/:tableId" element={
              <ProtectedRoute>
                <TableDetailView />
              </ProtectedRoute>
            } />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </BrowserRouter>
);

export default App;
