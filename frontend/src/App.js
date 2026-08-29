import "@/App.css";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Leads from "@/pages/Leads";
import Vendors from "@/pages/Vendors";
import Itineraries from "@/pages/Itineraries";
import ItineraryBuilder from "@/pages/ItineraryBuilder";
import Bookings from "@/pages/Bookings";
import Invoices from "@/pages/Invoices";
import Users from "@/pages/Users";
import SharedItinerary from "@/pages/SharedItinerary";
import { Loader2 } from "lucide-react";

function Protected({ children, roles }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (user === null)
    return (
      <div className="min-h-screen grid place-items-center bg-background" data-testid="auth-loading">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  if (user === false) return <Navigate to="/login" state={{ from: loc }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/share/:token" element={<SharedItinerary />} />
            <Route
              element={
                <Protected>
                  <Layout />
                </Protected>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/leads" element={<Protected roles={["admin", "sales"]}><Leads /></Protected>} />
              <Route path="/vendors" element={<Protected roles={["admin", "sales", "operations"]}><Vendors /></Protected>} />
              <Route path="/itineraries" element={<Protected roles={["admin", "sales"]}><Itineraries /></Protected>} />
              <Route path="/itineraries/new" element={<Protected roles={["admin", "sales"]}><ItineraryBuilder /></Protected>} />
              <Route path="/itineraries/:id/edit" element={<Protected roles={["admin", "sales"]}><ItineraryBuilder /></Protected>} />
              <Route path="/bookings" element={<Protected roles={["admin", "sales", "operations"]}><Bookings /></Protected>} />
              <Route path="/invoices" element={<Protected roles={["admin", "finance"]}><Invoices /></Protected>} />
              <Route path="/users" element={<Protected roles={["admin"]}><Users /></Protected>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </div>
  );
}

export default App;
