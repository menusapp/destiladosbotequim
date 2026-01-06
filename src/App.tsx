import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";

import CEODashboard from "./pages/CEODashboard";
import RestaurantAdmin from "./pages/RestaurantAdmin";
import Menu from "./pages/Menu";
import Comanda from "./pages/Comanda";
import DeliveryMenu from "./pages/DeliveryMenu";
import OrderConfirmation from "./pages/OrderConfirmation";
import Reservations from "./pages/Reservations";
import NotFound from "./pages/NotFound";
import { TableDetailView } from "./components/admin/TableDetailView";

const queryClient = new QueryClient();

const App = () => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/" element={<Landing />} />
            
            <Route path="/ceo" element={
              <ProtectedRoute>
                <CEODashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute>
                <RestaurantAdmin />
              </ProtectedRoute>
            } />
            <Route path="/admin/table/:tableId" element={
              <ProtectedRoute>
                <TableDetailView />
              </ProtectedRoute>
            } />
            <Route path="/menu/:restaurantSlug/:tableNumber" element={<Menu />} />
            <Route path="/comanda/:restaurantSlug/:tableNumber" element={<Comanda />} />
            <Route path="/delivery/:restaurantSlug" element={<DeliveryMenu />} />
            <Route path="/delivery/:restaurantSlug/pedido/:orderId" element={<OrderConfirmation />} />
            <Route path="/reservas/:restaurantSlug" element={<Reservations />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </BrowserRouter>
);

export default App;
