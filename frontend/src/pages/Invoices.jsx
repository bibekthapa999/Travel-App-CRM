import { useEffect, useState } from "react";
import { IndianRupee, Loader2, Plus, Share2 } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { inr, fmtDate } from "@/lib/format";
import ShareModal from "@/components/ShareModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ISTATUS = {
  unpaid: "bg-red-500/10 text-red-600",
  partial: "bg-amber-500/10 text-amber-600",
  paid: "bg-emerald-500/10 text-emerald-600",
};

export default function Invoices() {
  const [invoices, setInvoices] = useState(null);
  const [selected, setSelected] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [newOpen, setNewOpen] = useState(false);
  const [newBooking, setNewBooking] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [payment, setPayment] = useState({ amount: "", method: "UPI", note: "" });
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState(false);

  const load = () =>
    api.get("/invoices").then((r) => {
      setInvoices(r.data);
      setSelected((s) => (s ? r.data.find((i) => i.id === s.id) || s : r.data[0] || null));
    }).catch((e) => toast.error(apiError(e)));

  useEffect(() => {
    load();
    api.get("/bookings").then((r) => setBookings(r.data)).catch(() => {});
  }, []);

  const create = async () => {
    if (!newBooking) return toast.error("Select a booking");
    setBusy(true);
    try {
      const { data } = await api.post("/invoices", { booking_id: newBooking });
      toast.success(`Invoice ${data.invoice_no} created`);
      setNewOpen(false);
      setNewBooking("");
      await load();
      setSelected(data);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const recordPayment = async () => {
    if (!Number(payment.amount)) return toast.error("Enter an amount");
    setBusy(true);
    try {
      const { data } = await api.post(`/invoices/${selected.id}/payments`, { ...payment, amount: Number(payment.amount) });
      toast.success("Payment recorded");
      setSelected(data);
      setPayOpen(false);
      setPayment({ amount: "", method: "UPI", note: "" });
      load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="invoices-page">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Invoices & Payments</h1>
          <p className="text-sm text-muted-foreground mt-1">Split-payment schedules, receipts and reminders over WhatsApp & email.</p>
        </div>
        <Button onClick={() => setNewOpen(true)} data-testid="new-invoice-btn"><Plus className="w-4 h-4 mr-2" /> New Invoice</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="space-y-2" data-testid="invoices-list">
          {!invoices ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet. Create one from a booking.</p>
          ) : (
            invoices.map((inv) => (
              <button
                key={inv.id}
                onClick={() => setSelected(inv)}
                className={`w-full text-left rounded-lg border p-3 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  selected?.id === inv.id ? "border-primary bg-primary/5" : "border-border bg-card"
                }`}
                data-testid={`invoice-item-${inv.id}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">{inv.invoice_no}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-0.5 ${ISTATUS[inv.status]}`}>{inv.status}</span>
                </div>
                <p className="text-sm font-semibold mt-1">{inv.customer_name}</p>
                <p className="text-xs text-muted-foreground">{inr(inv.paid)} / {inr(inv.total)}</p>
                <Progress value={(inv.paid / Math.max(inv.total, 1)) * 100} className="h-1.5 mt-2" />
              </button>
            ))
          )}
        </div>

        <div className="lg:col-span-2">
          {!selected ? (
            <Card><CardContent className="py-16 text-center text-muted-foreground text-sm" data-testid="invoice-empty">Select an invoice to view payment schedule.</CardContent></Card>
          ) : (
            <Card data-testid="invoice-detail">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="font-heading text-lg">{selected.invoice_no} — {selected.customer_name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Booking {selected.booking_no} · {selected.destination}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShare(true)} data-testid="invoice-share-btn">
                    <Share2 className="w-4 h-4 mr-1.5" /> Share / remind
                  </Button>
                  <Button size="sm" onClick={() => {
                    const next = (selected.splits || []).find((s) => s.status !== "paid");
                    setPayment({ amount: next ? String(next.amount) : "", method: "UPI", note: "" });
                    setPayOpen(true);
                  }} data-testid="record-payment-btn">
                    <IndianRupee className="w-4 h-4 mr-1" /> Record payment
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-muted-foreground">Collected {inr(selected.paid)} of {inr(selected.total)}</span>
                    <span className="font-semibold" data-testid="invoice-outstanding">Due {inr(selected.total - selected.paid)}</span>
                  </div>
                  <Progress value={(selected.paid / Math.max(selected.total, 1)) * 100} className="h-2" data-testid="invoice-progress" />
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Instalment</TableHead><TableHead>Due date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Status</TableHead></TableRow>
                    </TableHeader>
                    <TableBody data-testid="splits-table">
                      {selected.splits.map((s, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{s.label}</TableCell>
                          <TableCell>{fmtDate(s.due_date)}</TableCell>
                          <TableCell className="text-right">{inr(s.amount)}</TableCell>
                          <TableCell className="text-right">
                            <Badge className={`rounded-full border-0 text-[10px] ${s.status === "paid" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>{s.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Payment history</p>
                  {selected.payments.length === 0 && <p className="text-sm text-muted-foreground" data-testid="no-payments">No payments recorded yet.</p>}
                  {selected.payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm" data-testid={`payment-${p.id}`}>
                      <div>
                        <p className="font-medium">{inr(p.amount)} <span className="text-xs text-muted-foreground">via {p.method}</span></p>
                        {p.note && <p className="text-xs text-muted-foreground">{p.note}</p>}
                      </div>
                      <span className="text-xs text-muted-foreground">{fmtDate(p.date)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent data-testid="new-invoice-dialog">
          <DialogHeader><DialogTitle className="font-heading">Create invoice</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Select booking</Label>
            <Select value={newBooking} onValueChange={setNewBooking}>
              <SelectTrigger data-testid="invoice-booking-select"><SelectValue placeholder="Choose booking…" /></SelectTrigger>
              <SelectContent>
                {bookings.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.booking_no} — {b.customer_name} ({inr(b.total)})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">A 30% advance / 70% balance split schedule is created automatically.</p>
            <Button className="w-full" onClick={create} disabled={busy} data-testid="create-invoice-btn">
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create invoice
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent data-testid="payment-dialog">
          <DialogHeader><DialogTitle className="font-heading">Record payment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Amount (₹)</Label><Input type="number" min="1" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} data-testid="payment-amount-input" /></div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={payment.method} onValueChange={(v) => setPayment({ ...payment, method: v })}>
                <SelectTrigger data-testid="payment-method-select"><SelectValue /></SelectTrigger>
                <SelectContent>{["UPI", "Bank Transfer", "Cash", "Card", "Cheque"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Note</Label><Input value={payment.note} onChange={(e) => setPayment({ ...payment, note: e.target.value })} placeholder="UTR / reference" /></div>
            <Button className="w-full" onClick={recordPayment} disabled={busy} data-testid="payment-save-btn">
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ShareModal
        open={share}
        onOpenChange={setShare}
        title={`Invoice ${selected?.invoice_no || ""} — ${selected?.customer_name || ""}`}
        messageUrl={selected ? `/invoices/${selected.id}/message` : null}
        emailTemplate={selected ? (selected.paid > 0 ? "receipt" : "reminder") : null}
        emailRefId={selected?.id}
      />
    </div>
  );
}
