import { useEffect, useState } from "react";
import { Building2, Bus, CheckCircle2, Loader2, Plus, Share2, XCircle } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { inr, fmtDate } from "@/lib/format";
import ShareModal from "@/components/ShareModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const VSTATUS = {
  pending: "bg-amber-500/10 text-amber-600",
  confirmed: "bg-emerald-500/10 text-emerald-600",
  rejected: "bg-red-500/10 text-red-600",
};

export default function Bookings() {
  const [bookings, setBookings] = useState(null);
  const [selected, setSelected] = useState(null);
  const [itineraries, setItineraries] = useState([]);
  const [newOpen, setNewOpen] = useState(false);
  const [newItin, setNewItin] = useState("");
  const [creating, setCreating] = useState(false);
  const [vendorShare, setVendorShare] = useState(null);
  const [customerShare, setCustomerShare] = useState(false);

  const load = () =>
    api.get("/bookings").then((r) => {
      setBookings(r.data);
      setSelected((s) => (s ? r.data.find((b) => b.id === s.id) || s : r.data[0] || null));
    }).catch((e) => toast.error(apiError(e)));

  useEffect(() => {
    load();
    api.get("/itineraries").then((r) => setItineraries(r.data)).catch(() => {});
  }, []);

  const create = async () => {
    if (!newItin) return toast.error("Select an itinerary");
    setCreating(true);
    try {
      const { data } = await api.post("/bookings", { itinerary_id: newItin });
      toast.success(`Booking ${data.booking_no} created`);
      setNewOpen(false);
      setNewItin("");
      await load();
      setSelected(data);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setCreating(false);
    }
  };

  const setVendorStatus = async (confId, status) => {
    try {
      const { data } = await api.patch(`/bookings/${selected.id}/vendors/${confId}`, { status });
      setSelected(data);
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div className="space-y-6" data-testid="bookings-page">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Bookings & Vendor Confirmations</h1>
          <p className="text-sm text-muted-foreground mt-1">Dispatch vouchers to hotels & cab vendors, track confirmations in real time.</p>
        </div>
        <Button onClick={() => setNewOpen(true)} data-testid="new-booking-btn"><Plus className="w-4 h-4 mr-2" /> New Booking</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="space-y-2" data-testid="bookings-list">
          {!bookings ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bookings yet. Convert a proposal into a booking.</p>
          ) : (
            bookings.map((b) => {
              const pending = b.vendor_confirmations.filter((c) => c.status === "pending").length;
              return (
                <button
                  key={b.id}
                  onClick={() => setSelected(b)}
                  className={`w-full text-left rounded-lg border p-3 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                    selected?.id === b.id ? "border-primary bg-primary/5" : "border-border bg-card"
                  }`}
                  data-testid={`booking-item-${b.id}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted-foreground">{b.booking_no}</span>
                    {pending > 0 && <Badge className="rounded-full bg-amber-500/10 text-amber-600 border-0 text-[10px]">{pending} pending</Badge>}
                  </div>
                  <p className="text-sm font-semibold mt-1">{b.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{b.destination} · {fmtDate(b.start_date)} · {inr(b.total)}</p>
                </button>
              );
            })
          )}
        </div>

        <div className="lg:col-span-2">
          {!selected ? (
            <Card><CardContent className="py-16 text-center text-muted-foreground text-sm" data-testid="booking-empty">Select a booking to manage vendor confirmations.</CardContent></Card>
          ) : (
            <Card data-testid="booking-detail">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="font-heading text-lg">{selected.customer_name} — {selected.destination}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selected.booking_no} · {fmtDate(selected.start_date)} · {selected.num_days} days · {selected.pax} pax
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setCustomerShare(true)} data-testid="share-voucher-btn">
                  <Share2 className="w-4 h-4 mr-1.5" /> Share voucher
                </Button>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-md bg-muted/50 p-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Package</p><p className="font-heading font-bold">{inr(selected.total)}</p></div>
                  <div className="rounded-md bg-muted/50 p-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cost</p><p className="font-heading font-bold">{inr(selected.cost)}</p></div>
                  <div className="rounded-md bg-emerald-500/10 p-3"><p className="text-[10px] uppercase tracking-wider text-emerald-600">Profit</p><p className="font-heading font-bold text-emerald-600">{inr(selected.profit)}</p></div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Vendor confirmations</p>
                  {selected.vendor_confirmations.length === 0 && <p className="text-sm text-muted-foreground">No vendors attached to this itinerary.</p>}
                  {selected.vendor_confirmations.map((c) => (
                    <div key={c.id} className="rounded-lg border border-border p-3 space-y-2" data-testid={`vendor-conf-${c.id}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          {c.vendor_type === "hotel" ? <Building2 className="w-4 h-4 text-primary" /> : <Bus className="w-4 h-4 text-primary" />}
                          <p className="text-sm font-semibold">{c.vendor_name}</p>
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-0.5 ${VSTATUS[c.status]}`}>{c.status}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{c.detail}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => setVendorShare(c)} data-testid={`vendor-share-${c.id}`}>
                          <Share2 className="w-3.5 h-3.5 mr-1" /> Send request
                        </Button>
                        <Button variant="ghost" size="sm" className="text-emerald-600" onClick={() => setVendorStatus(c.id, "confirmed")} data-testid={`vendor-confirm-${c.id}`}>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Confirm
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setVendorStatus(c.id, "rejected")} data-testid={`vendor-reject-${c.id}`}>
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent data-testid="new-booking-dialog">
          <DialogHeader><DialogTitle className="font-heading">Convert proposal to booking</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Select itinerary (proposal)</Label>
            <Select value={newItin} onValueChange={setNewItin}>
              <SelectTrigger data-testid="booking-itinerary-select"><SelectValue placeholder="Choose itinerary…" /></SelectTrigger>
              <SelectContent>
                {itineraries.map((it) => (
                  <SelectItem key={it.id} value={it.id}>{it.title} — {it.customer_name} ({inr(it.costing?.total)})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="w-full" onClick={create} disabled={creating} data-testid="create-booking-btn">
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create booking & vendor vouchers
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ShareModal
        open={Boolean(vendorShare)}
        onOpenChange={(o) => !o && setVendorShare(null)}
        title={`Vendor request — ${vendorShare?.vendor_name || ""}`}
        messageUrl={vendorShare && selected ? `/bookings/${selected.id}/vendors/${vendorShare.id}/message` : null}
        emailTemplate={vendorShare ? "vendor_request" : null}
        emailRefId={selected?.id}
        emailVendorId={vendorShare?.id}
      />
      <ShareModal
        open={customerShare}
        onOpenChange={setCustomerShare}
        title={`Customer voucher — ${selected?.customer_name || ""}`}
        messageUrl={selected ? `/bookings/${selected.id}/message` : null}
      />
    </div>
  );
}
