import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Palmtree } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="flex items-center justify-center p-6 sm:p-12 noise-bg">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-11 h-11 rounded-lg bg-primary grid place-items-center">
              <Palmtree className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-heading text-xl font-bold tracking-tight">Thapa Holidays</h1>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Travel CRM</p>
            </div>
          </div>
          <h2 className="font-heading text-3xl font-bold tracking-tight mb-2">Welcome back</h2>
          <p className="text-sm text-muted-foreground mb-8">Sign in to manage leads, itineraries and bookings.</p>
          <form onSubmit={submit} className="space-y-4" data-testid="login-form">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com" data-testid="login-email-input" className="bg-white" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" data-testid="login-password-input" className="bg-white" />
            </div>
            {error && <p className="text-sm text-destructive" data-testid="login-error">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading} data-testid="login-submit-button">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Sign in
            </Button>
          </form>
          <div className="mt-8 rounded-lg border border-border bg-muted/50 p-4 text-xs text-muted-foreground space-y-1" data-testid="demo-credentials">
            <p className="font-semibold text-foreground uppercase tracking-wider text-[10px]">Demo accounts</p>
            <p>Admin: thapa.holidays09@gmail.com / Admin@123</p>
            <p>Sales: priya@thapaholidays.com / Agent@123</p>
            <p>Operations: ops@thapaholidays.com / Ops@12345</p>
            <p>Finance: finance@thapaholidays.com / Finance@123</p>
          </div>
        </div>
      </div>
      <div className="hidden lg:block relative">
        <img
          src="https://images.unsplash.com/photo-1773393776477-61773dfc8a09?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MDV8MHwxfHNlYXJjaHw0fHx0cmF2ZWwlMjBkZXN0aW5hdGlvbiUyMGx1eHVyeSUyMGhvdGVsJTIwc3Vuc2V0fGVufDB8fHx8MTc4Nzk5MTI2MHww&ixlib=rb-4.1.0&q=85"
          alt="Luxury travel destination at sunset"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <p className="font-heading text-3xl font-bold tracking-tight" style={{ textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
            Every journey, perfectly organised.
          </p>
          <p className="text-sm text-white/80 mt-2">Leads · Itineraries · Vendors · Bookings · Payments — one dashboard.</p>
        </div>
      </div>
    </div>
  );
}
