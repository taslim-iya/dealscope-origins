import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Home from "./pages/Home";
import OffMarket from "./pages/OffMarket";
import OnMarket from "./pages/OnMarket";

import Pricing from "./pages/Pricing";
import About from "./pages/About";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AdminSignup from "./pages/AdminSignup";
import Dashboard from "./pages/Dashboard";
import CreateMandate from "./pages/CreateMandate";
import MandateWorkspace from "./pages/MandateWorkspace";
import CompanyDetails from "./pages/CompanyDetails";
import AdminDashboard from "./pages/AdminDashboard";
import AdminCompanies from "./pages/AdminCompanies";
import AdminMandateView from "./pages/AdminMandateView";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/off-market" element={<OffMarket />} />
            <Route path="/on-market" element={<OnMarket />} />
            
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/about" element={<About />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/admin-signup" element={<AdminSignup />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/mandate/create" element={<CreateMandate />} />
            <Route path="/mandate/:id" element={<MandateWorkspace />} />
            <Route path="/company/:id" element={<CompanyDetails />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/companies" element={<AdminCompanies />} />
            <Route path="/admin/mandate/:id" element={<AdminMandateView />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
