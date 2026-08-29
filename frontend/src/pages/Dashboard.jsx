import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarCheck, CircleDollarSign, HandCoins, KanbanSquare, Loader2,
  TrendingUp, Users, Wallet, AlertCircle,
} from "lucide-react";
import api from "@/lib/api";
import { inr, fmtDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS_LABELS = { new: "New", contacted: "Contacted", proposal_sent: "Proposal Sent", negotiation: "Negotiation", won: "Won", lost: "Lost" };
const STATUS_COLORS = { new: "bg-blue-500", contacted: "bg-amber-500", proposal_sent: "bg-violet-500", negotiation: "bg-orange-500", won: "bg-emerald-500", lost: "bg-red-400" };

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/dashboard/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  if (!stats)
    return (
      <div className="flex items-center gap-2 text-muted-foreground" data-testid="dashboard-loading">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading dashboard…
      </div>
    );

  const kpis = [
    { label: "Total Leads", value: stats.total_leads, icon: Users, testid: "kpi-leads" },
    { label: "Pipeline Value", value: inr(stats.pipeline_value), icon: TrendingUp, testid: "kpi-pipeline" },
    { label: "Bookings", value: stats.bookings_count, icon: CalendarCheck, testid: "kpi-bookings" },
    { label: "Revenue Invoiced", value: inr(stats.revenue), icon: CircleDollarSign, testid: "kpi-revenue" },
    { label: "Collected", value: inr(stats.collected), icon: Wallet, testid: "kpi-collected" },
    { label: "Outstanding", value: inr(stats.outstanding), icon: AlertCircle, testid: "kpi-outstanding" },
    { label: "Net Profit", value: inr(stats.profit), icon: HandCoins, testid: "kpi-profit" },
    { label: "Pending Vendor Confirms", value: stats.pending_vendor_confirmations, icon: KanbanSquare, testid: "kpi-vendor-pending" },
  ];

  const maxStatus = Math.max(1, ...Object.values(stats.leads_by_status));

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Business at a glance — leads, bookings, money.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, testid }, i) => (
          <Card key={label} className="hover:shadow-lg transition-shadow" style={{ animationDelay: `${i * 40}ms` }} data-testid={testid}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
                <p className="font-heading text-xl font-bold truncate">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-lg">Lead Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3" data-testid="pipeline-chart">
            {Object.entries(stats.leads_by_status).map(([k, v]) => (
              <div key={k} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{STATUS_LABELS[k]}</span>
                  <span className="text-muted-foreground">{v}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${STATUS_COLORS[k]} transition-[width]`} style={{ width: `${(v / maxStatus) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-lg">Upcoming Departures</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.upcoming_departures.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="no-departures">No upcoming departures yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Departure</TableHead>
                    <TableHead className="text-right">Pax</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody data-testid="departures-table">
                  {stats.upcoming_departures.map((b) => (
                    <TableRow key={b.booking_no}>
                      <TableCell className="font-mono text-xs">{b.booking_no}</TableCell>
                      <TableCell>{b.customer_name}</TableCell>
                      <TableCell>{b.destination}</TableCell>
                      <TableCell>{fmtDate(b.start_date)}</TableCell>
                      <TableCell className="text-right">{b.pax}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="font-heading text-lg">Recent Leads</CardTitle>
          <Link to="/leads" className="text-sm text-primary hover:underline" data-testid="view-all-leads-link">View board →</Link>
        </CardHeader>
        <CardContent className="space-y-2" data-testid="recent-leads">
          {stats.recent_leads.length === 0 && <p className="text-sm text-muted-foreground">No leads yet.</p>}
          {stats.recent_leads.map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded-md border border-border p-3 hover:-translate-y-0.5 transition-transform">
              <div>
                <p className="text-sm font-medium">{l.customer_name}</p>
                <p className="text-xs text-muted-foreground">{l.destination || "—"} · {l.pax} pax · budget {inr(l.budget)}</p>
              </div>
              <Badge variant="secondary" className="rounded-full">{STATUS_LABELS[l.status]}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
