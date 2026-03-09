import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import LandingPage from "./pages/LandingPage";
import RestaurantLogin from "./pages/RestaurantLogin";

import AdminPanel from "./pages/AdminPanel";
import CEODashboard from "./pages/CEODashboard";
import DevDashboard from "./pages/DevDashboard";
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

const queryClient = new QueryClient();

const App = () => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            {/* Landing page comercial */}
            <Route path="/" element={<LandingPage />} />
            
            {/* Auth routes */}
            <Route path="/login" element={<RestaurantLogin />} />
            <Route path="/login/staff" element={<StaffLogin />} />

            {/* Admin Panel - Dev/CEO Login */}
            <Route path="/admin-panel" element={<AdminPanel />} />
            <Route path="/admin-panel/ceo" element={
              <ProtectedRoute>
                <CEODashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin-panel/dev" element={
              <ProtectedRoute>
                <DevDashboard />
              </ProtectedRoute>
            } />

            {/* MercadoPago callback */}
            <Route path="/admin/mercadopago/callback" element={<MercadoPagoCallback />} />

            {/* Restaurant-scoped routes (slug-based) */}
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
