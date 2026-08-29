import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BedDouble, Bus, Loader2, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const EMPTY_DAY = () => ({ day: 1, title: "", description: "", hotel_id: "", room_category: "", meal_plan: "cp", vehicle_id: "", activities: "", activity_cost: "" });

export default function ItineraryBuilder() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [hotels, setHotels] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState({
    title: "", customer_name: "", customer_email: "", customer_phone: "",
    destination: "", start_date: "", pax: 2, lead_id: "", notes: "",
    days: [EMPTY_DAY()], pricing: { margin_pct: 25, gst_enabled: true, gst_pct: 5, discount: 0 },
  });
  const [costing, setCosting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const debounce = useRef(null);

  useEffect(() => {
    api.get("/hotels").then((r) => setHotels(r.data)).catch(() => {});
    api.get("/vehicles").then((r) => setVehicles(r.data)).catch(() => {});
    if (isEdit) {
      api.get(`/itineraries/${id}`).then((r) => {
        const d = r.data;
        setForm({
          title: d.title || "", customer_name: d.customer_name || "", customer_email: d.customer_email || "",
          customer_phone: d.customer_phone || "", destination: d.destination || "", start_date: d.start_date || "",
          pax: d.pax || 2, lead_id: d.lead_id || "", notes: d.notes || "",
          days: d.days?.length ? d.days : [EMPTY_DAY()],
          pricing: { margin_pct: 25, gst_enabled: true, gst_pct: 5, discount: 0, ...(d.pricing || {}) },
        });
        setCosting(d.costing || null);
        setLoading(false);
      }).catch((e) => { toast.error(apiError(e)); navigate("/itineraries"); });
    } else {
      const leadId = params.get("lead_id");
      if (leadId) {
        api.get(`/leads/${leadId}`).then((r) => {
          const l = r.data;
          setForm((f) => ({
            ...f, lead_id: l.id, customer_name: l.customer_name, customer_email: l.email || "",
            customer_phone: l.phone || "", destination: l.destination || "", start_date: l.travel_start || "",
            pax: l.pax || 2, title: `${l.destination || "Trip"} — ${l.customer_name}`,
          }));
        }).catch(() => {});
      }
    }
    // eslint-disable-next-line
  }, [id]);

  const payload = useMemo(
    () => ({ ...form, pax: Number(form.pax) || 2, days: form.days.map((d, i) => ({ ...d, day: i + 1, activity_cost: Number(d.activity_cost) || 0 })) }),
    [form]
  );

  useEffect(() => {
    if (loading) return;
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      api.post("/itineraries/preview-cost", payload).then((r) => setCosting(r.data)).catch(() => {});
    }, 400);
    return () => clearTimeout(debounce.current);
    // eslint-disable-next-line
  }, [payload, loading]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setDay = (i, k, v) => setForm((f) => { const days = [...f.days]; days[i] = { ...days[i], [k]: v }; return { ...f, days }; });
  const setPricing = (k, v) => setForm((f) => ({ ...f, pricing: { ...f.pricing, [k]: v } }));

  const save = async () => {
    if (!form.customer_name.trim()) return toast.error("Customer name is required");
    setSaving(true);
    try {
      if (isEdit) await api.patch(`/itineraries/${id}`, payload);
      else await api.post("/itineraries", payload);
      toast.success("Itinerary saved — ready to share");
      navigate("/itineraries");
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start" data-testid="itinerary-builder">
      <div className="xl:col-span-2 space-y-6">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">{isEdit ? "Edit Itinerary" : "Itinerary Builder"}</h1>
          <p className="text-sm text-muted-foreground mt-1">Pick hotels & vehicles per day — costing updates live on the right.</p>
        </div>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="font-heading text-lg">Trip basics</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2"><Label>Proposal title</Label><Input value={form.title} onChange={set("title")} placeholder="Manali honeymoon — 5D/4N" data-testid="itin-title-input" /></div>
            <div className="space-y-1.5"><Label>Customer name *</Label><Input value={form.customer_name} onChange={set("customer_name")} data-testid="itin-customer-input" /></div>
            <div className="space-y-1.5"><Label>Destination</Label><Input value={form.destination} onChange={set("destination")} data-testid="itin-destination-input" /></div>
            <div className="space-y-1.5"><Label>Customer email</Label><Input value={form.customer_email} onChange={set("customer_email")} data-testid="itin-email-input" /></div>
            <div className="space-y-1.5"><Label>Customer WhatsApp</Label><Input value={form.customer_phone} onChange={set("customer_phone")} data-testid="itin-phone-input" /></div>
            <div className="space-y-1.5"><Label>Start date</Label><Input type="date" value={form.start_date} onChange={set("start_date")} data-testid="itin-start-input" /></div>
            <div className="space-y-1.5"><Label>Travellers (pax)</Label><Input type="number" min="1" value={form.pax} onChange={set("pax")} data-testid="itin-pax-input" /></div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold">Day-by-day plan</h2>
            <Button variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, days: [...f.days, EMPTY_DAY()] }))} data-testid="add-day-btn">
              <Plus className="w-4 h-4 mr-1.5" /> Add day
            </Button>
          </div>
          {form.days.map((d, i) => {
            const hotel = hotels.find((h) => h.id === d.hotel_id);
            return (
              <Card key={i} className="relative" data-testid={`day-card-${i + 1}`}>
                <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                  <CardTitle className="font-heading text-base">Day {i + 1}</CardTitle>
                  {form.days.length > 1 && (
                    <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => setForm((f) => ({ ...f, days: f.days.filter((_, j) => j !== i) }))} data-testid={`day-remove-${i + 1}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Day title</Label><Input value={d.title} onChange={(e) => setDay(i, "title", e.target.value)} placeholder="Arrival & local sightseeing" data-testid={`day-title-${i + 1}`} /></div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" /> Hotel</Label>
                    <Select value={d.hotel_id || "none"} onValueChange={(v) => setForm((f) => { const days = [...f.days]; days[i] = { ...days[i], hotel_id: v === "none" ? "" : v, room_category: "" }; return { ...f, days }; })}>
                      <SelectTrigger data-testid={`day-hotel-${i + 1}`}><SelectValue placeholder="No hotel" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No hotel</SelectItem>
                        {hotels.map((h) => <SelectItem key={h.id} value={h.id}>{h.name} ({h.destination})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {hotel && (
                    <>
                      <div className="space-y-1.5">
                        <Label>Room category</Label>
                        <Select value={d.room_category || "none"} onValueChange={(v) => setDay(i, "room_category", v === "none" ? "" : v)}>
                          <SelectTrigger data-testid={`day-room-${i + 1}`}><SelectValue placeholder="Select room" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Select room</SelectItem>
                            {hotel.rooms.map((r) => <SelectItem key={r.category} value={r.category}>{r.category} — {inr(r[d.meal_plan] || r.cp)}/night</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Meal plan</Label>
                        <Select value={d.meal_plan} onValueChange={(v) => setDay(i, "meal_plan", v)}>
                          <SelectTrigger data-testid={`day-meal-${i + 1}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cp">CP — Breakfast only</SelectItem>
                            <SelectItem value="map">MAP — Breakfast + Dinner</SelectItem>
                            <SelectItem value="ap">AP — All meals</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1"><Bus className="w-3.5 h-3.5" /> Vehicle</Label>
                    <Select value={d.vehicle_id || "none"} onValueChange={(v) => setDay(i, "vehicle_id", v === "none" ? "" : v)}>
                      <SelectTrigger data-testid={`day-vehicle-${i + 1}`}><SelectValue placeholder="No vehicle" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No vehicle</SelectItem>
                        {vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.vehicle_type} — {v.vendor_name} ({inr(v.per_day_rate)}/day)</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Activity cost (₹)</Label><Input type="number" min="0" value={d.activity_cost} onChange={(e) => setDay(i, "activity_cost", e.target.value)} data-testid={`day-activity-cost-${i + 1}`} /></div>
                  <div className="space-y-1.5 sm:col-span-2"><Label>Activities / notes</Label><Textarea rows={2} value={d.activities} onChange={(e) => setDay(i, "activities", e.target.value)} placeholder="Solang Valley visit, paragliding, mall road…" data-testid={`day-activities-${i + 1}`} /></div>
                  <div className="space-y-1.5 sm:col-span-2"><Label>Day description (shown on proposal)</Label><Textarea rows={2} value={d.description} onChange={(e) => setDay(i, "description", e.target.value)} data-testid={`day-desc-${i + 1}`} /></div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Card className="xl:sticky xl:top-6" data-testid="cost-calculator">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-lg flex items-center gap-2"><Sparkles className="w-4 h-4 text-accent" /> Live rate calculator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><Label>Profit margin</Label><span className="font-semibold" data-testid="margin-value">{form.pricing.margin_pct}%</span></div>
            <Slider value={[form.pricing.margin_pct]} min={0} max={60} step={1} onValueChange={([v]) => setPricing("margin_pct", v)} data-testid="margin-slider" />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="gst-toggle">GST</Label>
            <div className="flex items-center gap-2">
              {form.pricing.gst_enabled && (
                <Input type="number" className="w-16 h-8" min="0" max="28" value={form.pricing.gst_pct} onChange={(e) => setPricing("gst_pct", Number(e.target.value) || 0)} data-testid="gst-pct-input" />
              )}
              <Switch id="gst-toggle" checked={form.pricing.gst_enabled} onCheckedChange={(v) => setPricing("gst_enabled", v)} data-testid="gst-toggle" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Manual discount (₹)</Label>
            <Input type="number" min="0" value={form.pricing.discount} onChange={(e) => setPricing("discount", Number(e.target.value) || 0)} data-testid="discount-input" />
          </div>
          <div className="border-t border-border pt-4 space-y-2 text-sm" data-testid="cost-breakdown">
            <div className="flex justify-between"><span className="text-muted-foreground">Hotels</span><span>{inr(costing?.hotel_cost)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Transport</span><span>{inr(costing?.transport_cost)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Activities</span><span>{inr(costing?.activity_cost)}</span></div>
            <div className="flex justify-between font-medium"><span>Base cost</span><span>{inr(costing?.base_cost)}</span></div>
            <div className="flex justify-between text-emerald-600"><span>Margin</span><span>+ {inr(costing?.margin_amount)}</span></div>
            {Number(form.pricing.discount) > 0 && <div className="flex justify-between text-destructive"><span>Discount</span><span>− {inr(costing?.discount)}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span>{inr(costing?.tax_amount)}</span></div>
            <div className="flex justify-between font-heading text-xl font-bold pt-2 border-t border-border"><span>Total</span><span data-testid="cost-total">{inr(costing?.total)}</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>Per person</span><span>{inr(costing?.per_person)}</span></div>
          </div>
          <Button className="w-full" onClick={save} disabled={saving} data-testid="save-itinerary-btn">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {isEdit ? "Save changes" : "Save itinerary"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
