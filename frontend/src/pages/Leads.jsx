import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, MapPin, MessageCircle, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { inr, fmtDate, digits } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUSES = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "proposal_sent", label: "Proposal Sent" },
  { key: "negotiation", label: "Negotiation" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];
const STATUS_BADGE = {
  new: "bg-blue-500/10 text-blue-600", contacted: "bg-amber-500/10 text-amber-600",
  proposal_sent: "bg-violet-500/10 text-violet-600", negotiation: "bg-orange-500/10 text-orange-600",
  won: "bg-emerald-500/10 text-emerald-600", lost: "bg-red-500/10 text-red-600",
};

const EMPTY = { customer_name: "", email: "", phone: "", destination: "", travel_start: "", travel_end: "", pax: 2, adults: 2, cwb: 0, cnb: 0, budget: "", source: "", notes: "" };

function LeadDialog({ open, onOpenChange, initial, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initial?.id);

  useEffect(() => {
    if (open) setForm(initial?.id ? { ...EMPTY, ...initial } : EMPTY);
  }, [open, initial]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.customer_name.trim()) return toast.error("Customer name is required");
    setSaving(true);
    try {
      const payload = { ...form, pax: Number(form.pax) || 2, adults: Number(form.adults) || 0, cwb: Number(form.cwb) || 0, cnb: Number(form.cnb) || 0, budget: Number(form.budget) || 0 };
      if (isEdit) await api.patch(`/leads/${initial.id}`, payload);
      else await api.post("/leads", payload);
      toast.success(isEdit ? "Lead updated" : "Lead created — welcome email triggered");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="lead-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading">{isEdit ? "Edit lead" : "New inquiry"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Customer name *</Label>
            <Input value={form.customer_name} onChange={set("customer_name")} data-testid="lead-name-input" />
          </div>
          <div className="space-y-1.5">
            <Label>Phone (WhatsApp)</Label>
            <Input value={form.phone} onChange={set("phone")} placeholder="919876543210" data-testid="lead-phone-input" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={set("email")} data-testid="lead-email-input" />
          </div>
          <div className="space-y-1.5">
            <Label>Destination</Label>
            <Input value={form.destination} onChange={set("destination")} data-testid="lead-destination-input" />
          </div>
          <div className="space-y-1.5">
            <Label>Travel start</Label>
            <Input type="date" value={form.travel_start} onChange={set("travel_start")} data-testid="lead-start-input" />
          </div>
          <div className="space-y-1.5">
            <Label>Travel end</Label>
            <Input type="date" value={form.travel_end} onChange={set("travel_end")} data-testid="lead-end-input" />
          </div>
          <div className="space-y-1.5">
            <Label>Headcount (pax)</Label>
            <Input type="number" min="1" value={form.pax} onChange={set("pax")} data-testid="lead-pax-input" />
          </div>
          <div className="space-y-1.5">
            <Label>Adults</Label>
            <Input type="number" min="1" value={form.adults} onChange={set("adults")} data-testid="lead-adults-input" />
          </div>
          <div className="space-y-1.5">
            <Label>Child with bed (CWB)</Label>
            <Input type="number" min="0" value={form.cwb} onChange={set("cwb")} data-testid="lead-cwb-input" />
          </div>
          <div className="space-y-1.5">
            <Label>Child no bed (CNB)</Label>
            <Input type="number" min="0" value={form.cnb} onChange={set("cnb")} data-testid="lead-cnb-input" />
          </div>
          <div className="space-y-1.5">
            <Label>Budget (₹)</Label>
            <Input type="number" min="0" value={form.budget} onChange={set("budget")} data-testid="lead-budget-input" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Source</Label>
            <Input value={form.source} onChange={set("source")} placeholder="Instagram, Referral, Walk-in…" data-testid="lead-source-input" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={set("notes")} rows={2} data-testid="lead-notes-input" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground border-t border-border pt-3" data-testid="lead-privacy-disclaimer">
          Your data will be used in a professional manner and will not be disclosed to any third party.
        </p>
        <Button onClick={save} disabled={saving} className="w-full" data-testid="lead-save-btn">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} {isEdit ? "Save changes" : "Create lead"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export default function Leads() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState(null);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState({ open: false, initial: null });
  const [detail, setDetail] = useState(null);
  const [dragOver, setDragOver] = useState("");

  const load = () => api.get("/leads", { params: { search: search || undefined } }).then((r) => setLeads(r.data)).catch((e) => toast.error(apiError(e)));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [search]);

  const grouped = useMemo(() => {
    const g = Object.fromEntries(STATUSES.map((s) => [s.key, []]));
    (leads || []).forEach((l) => (g[l.status] || g.new).push(l));
    return g;
  }, [leads]);

  const move = async (id, status) => {
    const lead = (leads || []).find((l) => l.id === id);
    if (!lead || lead.status === status) return;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
    try {
      await api.patch(`/leads/${id}`, { status });
    } catch (e) {
      toast.error(apiError(e));
      load();
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/leads/${id}`);
      toast.success("Lead deleted");
      setDetail(null);
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const sendWelcomeEmail = async () => {
    try {
      const { data } = await api.post("/email/send", { template: "welcome", ref_id: detail.id });
      toast.success(`Welcome email sent to ${data.to}`);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div className="space-y-6" data-testid="leads-page">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Leads & Inquiries</h1>
          <p className="text-sm text-muted-foreground mt-1">Drag cards between stages. New leads get an instant welcome email.</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9 w-56 bg-card" placeholder="Search leads…" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="leads-search-input" />
        </div>
        <Button onClick={() => setDialog({ open: true, initial: null })} data-testid="new-lead-btn">
          <Plus className="w-4 h-4 mr-2" /> New Inquiry
        </Button>
      </div>

      {!leads ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 kanban-scroll" data-testid="kanban-board">
          {STATUSES.map((s) => (
            <div
              key={s.key}
              className={`w-64 shrink-0 rounded-lg p-2 bg-muted/50 border transition-colors ${dragOver === s.key ? "border-primary" : "border-transparent"}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(s.key); }}
              onDragLeave={() => setDragOver("")}
              onDrop={(e) => { e.preventDefault(); setDragOver(""); move(e.dataTransfer.getData("text/plain"), s.key); }}
              data-testid={`kanban-col-${s.key}`}
            >
              <div className="flex items-center justify-between px-2 py-1.5">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">{s.label}</p>
                <Badge variant="secondary" className="rounded-full text-[10px]">{grouped[s.key].length}</Badge>
              </div>
              <div className="space-y-2 min-h-16">
                {grouped[s.key].map((l) => (
                  <div
                    key={l.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", l.id)}
                    onClick={() => setDetail(l)}
                    className="rounded-lg border border-border bg-card p-3 cursor-grab hover:-translate-y-1 hover:shadow-lg transition-all active:cursor-grabbing"
                    data-testid={`kanban-card-${l.id}`}
                  >
                    <p className="text-sm font-semibold leading-tight">{l.customer_name}</p>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" />{l.destination || "—"}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-medium text-primary">{inr(l.budget)}</span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" />{l.pax}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <LeadDialog open={dialog.open} initial={dialog.initial} onOpenChange={(o) => setDialog({ open: o, initial: null })} onSaved={load} />

      <Dialog open={Boolean(detail)} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg" data-testid="lead-detail-dialog">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading flex items-center gap-2">
                  {detail.customer_name}
                  <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-0.5 ${STATUS_BADGE[detail.status]}`}>{STATUSES.find((s) => s.key === detail.status)?.label}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Phone</p><p className="font-medium">{detail.phone || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Email</p><p className="font-medium break-all">{detail.email || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Destination</p><p className="font-medium">{detail.destination || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Dates</p><p className="font-medium">{fmtDate(detail.travel_start)} → {fmtDate(detail.travel_end)}</p></div>
                <div><p className="text-xs text-muted-foreground">Pax</p><p className="font-medium">{detail.pax}</p></div>
                <div><p className="text-xs text-muted-foreground">Budget</p><p className="font-medium">{inr(detail.budget)}</p></div>
                {detail.notes && <div className="col-span-2"><p className="text-xs text-muted-foreground">Notes</p><p className="font-medium">{detail.notes}</p></div>}
              </div>
              <div className="space-y-1.5">
                <Label>Stage</Label>
                <Select value={detail.status} onValueChange={(v) => { move(detail.id, v); setDetail({ ...detail, status: v }); }}>
                  <SelectTrigger data-testid="lead-status-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" size="sm" asChild={Boolean(digits(detail.phone))} disabled={!digits(detail.phone)} data-testid="lead-whatsapp-btn">
                  {digits(detail.phone) ? (
                    <a
                      href={`https://wa.me/${digits(detail.phone)}?text=${encodeURIComponent(`Hi ${detail.customer_name}, thank you for your travel enquiry with Thapa Holidays${detail.destination ? ` for ${detail.destination}` : ""}. Our team is crafting a personalised itinerary for you and will reach out shortly!`)}`}
                      target="_blank" rel="noopener noreferrer"
                    >
                      <MessageCircle className="w-4 h-4 mr-1.5" /> WhatsApp
                    </a>
                  ) : (
                    <span><MessageCircle className="w-4 h-4 mr-1.5" /> WhatsApp</span>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={sendWelcomeEmail} disabled={!detail.email} data-testid="lead-welcome-email-btn">Welcome email</Button>
                <Button variant="outline" size="sm" onClick={() => navigate(`/itineraries/new?lead_id=${detail.id}`)} data-testid="lead-create-itinerary-btn">
                  Create itinerary
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setDialog({ open: true, initial: detail }); setDetail(null); }} data-testid="lead-edit-btn">
                  <Pencil className="w-4 h-4 mr-1.5" /> Edit
                </Button>
                {user?.role === "admin" && (
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(detail.id)} data-testid="lead-delete-btn">
                    <Trash2 className="w-4 h-4 mr-1.5" /> Delete
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
