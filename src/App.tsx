import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import CEODashboard from "./pages/CEODashboard";
import RestaurantAdmin from "./pages/RestaurantAdmin";
import Menu from "./pages/Menu";
import Comanda from "./pages/Comanda";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/ceo" element={<CEODashboard />} />
          <Route path="/admin" element={<RestaurantAdmin />} />
          <Route path="/menu/:restaurantSlug/:tableNumber" element={<Menu />} />
          <Route path="/comanda/:restaurantSlug/:tableNumber" element={<Comanda />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
