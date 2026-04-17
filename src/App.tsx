import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Public / marketing pages
import Home from "./pages/Home";
import About from "./pages/About";
import Pricing from "./pages/Pricing";
import Contact from "./pages/Contact";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AdminSignup from "./pages/AdminSignup";
import OffMarket from "./pages/OffMarket";
import ListCompany from "./pages/ListCompany";
import SubmitDeal from "./pages/SubmitDeal";
import Dashboard from "./pages/Dashboard";
import CreateMandate from "./pages/CreateMandate";
import MandateWorkspace from "./pages/MandateWorkspace";

// Platform / admin pages
import AdminDashboard from "./pages/AdminDashboard";
import AdminCompanies from "./pages/AdminCompanies";
import AdminListings from "./pages/AdminListings";
import AdminMandateView from "./pages/AdminMandateView";
import AdminSubmissions from "./pages/AdminSubmissions";
import AdminCorgiAI from "./pages/AdminCorgiAI";
import CompanyDetails from "./pages/CompanyDetails";
import Clients from "./pages/Clients";
import Pipeline from "./pages/Pipeline";
import Outreach from "./pages/Outreach";
import OnMarket from "./pages/OnMarket";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public / marketing */}
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/admin-signup" element={<AdminSignup />} />
          <Route path="/off-market" element={<OffMarket />} />
          <Route path="/on-market" element={<OnMarket />} />
          <Route path="/list-company" element={<ListCompany />} />
          <Route path="/submit-deal" element={<SubmitDeal />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/mandate/create" element={<CreateMandate />} />
          <Route path="/mandate/:id" element={<MandateWorkspace />} />

          {/* Platform / admin */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/companies" element={<AdminCompanies />} />
          <Route path="/admin/listings" element={<AdminListings />} />
          <Route path="/admin/mandate/:id" element={<AdminMandateView />} />
          <Route path="/admin/submissions" element={<AdminSubmissions />} />
          <Route path="/admin/corgi-ai" element={<AdminCorgiAI />} />
          <Route path="/company/:id" element={<CompanyDetails />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/outreach" element={<Outreach />} />
          <Route path="/settings" element={<Settings />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
