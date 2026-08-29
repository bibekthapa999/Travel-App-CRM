import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { inr } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const EMPTY_HOTEL = { name: "", destination: "", star: 3, contact_name: "", phone: "", email: "", rooms: [{ category: "", cp: "", map: "", ap: "", single_rate: "", extra_bed_adult: "", cwb: "", cnb: "" }], seasons: [] };
const EMPTY_VEHICLE = { vendor_name: "", vehicle_type: "Sedan", route_from: "", route_to: "", per_day_rate: "", driver_charge: "", phone: "", email: "" };

function HotelDialog({ open, onOpenChange, initial, onSaved }) {
  const [form, setForm] = useState(EMPTY_HOTEL);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initial?.id);

  useEffect(() => {
    if (open) setForm(initial?.id ? JSON.parse(JSON.stringify(initial)) : JSON.parse(JSON.stringify(EMPTY_HOTEL)));
  }, [open, initial]);

  const setRoom = (i, k, v) => setForm((f) => { const rooms = [...f.rooms]; rooms[i] = { ...rooms[i], [k]: v }; return { ...f, rooms }; });
  const setSeason = (i, k, v) => setForm((f) => { const seasons = [...f.seasons]; seasons[i] = { ...seasons[i], [k]: v }; return { ...f, seasons }; });

  const save = async () => {
    if (!form.name.trim()) return toast.error("Hotel name is required");
    setSaving(true);
    try {
      const payload = {
        ...form,
        star: Number(form.star) || 3,
        rooms: form.rooms.filter((r) => r.category).map((r) => ({
          category: r.category,
          cp: Number(r.cp) || 0, map: Number(r.map) || 0, ap: Number(r.ap) || 0,
          single_rate: Number(r.single_rate) || 0, extra_bed_adult: Number(r.extra_bed_adult) || 0,
          cwb: Number(r.cwb) || 0, cnb: Number(r.cnb) || 0,
        })),
        seasons: form.seasons.filter((s) => s.label && s.start && s.end).map((s) => ({ ...s, surcharge_pct: Number(s.surcharge_pct) || 0 })),
      };
      if (isEdit) await api.patch(`/hotels/${initial.id}`, payload);
      else await api.post("/hotels", payload);
      toast.success("Hotel saved");
      onOpenChange(false);
      onSaved();
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="hotel-dialog">
        <DialogHeader><DialogTitle className="font-heading">{isEdit ? "Edit hotel" : "Add hotel"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="hotel-name-input" /></div>
          <div className="space-y-1.5"><Label>Destination</Label><Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} data-testid="hotel-destination-input" /></div>
          <div className="space-y-1.5">
            <Label>Star category</Label>
            <Select value={String(form.star)} onValueChange={(v) => setForm({ ...form, star: Number(v) })}>
              <SelectTrigger data-testid="hotel-star-select"><SelectValue /></SelectTrigger>
              <SelectContent>{[2, 3, 4, 5].map((s) => <SelectItem key={s} value={String(s)}>{s} star</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Contact person</Label><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>WhatsApp phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="919876543210" data-testid="hotel-phone-input" /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        </div>

        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold uppercase tracking-[0.15em]">Room categories & meal-plan rates (per night)</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, rooms: [...f.rooms, { category: "", cp: "", map: "", ap: "", single_rate: "", extra_bed_adult: "", cwb: "", cnb: "" }] }))} data-testid="hotel-add-room-btn"><Plus className="w-3 h-3 mr-1" /> Room</Button>
          </div>
          {form.rooms.map((r, i) => (
            <div key={i} className="rounded-md border border-border p-2 space-y-2" data-testid={`hotel-room-${i}`}>
              <div className="grid grid-cols-4 gap-2 items-center">
                <Input placeholder="Category" value={r.category} onChange={(e) => setRoom(i, "category", e.target.value)} data-testid={`hotel-room-cat-${i}`} />
                <Input type="number" placeholder="CP (dbl)" value={r.cp} onChange={(e) => setRoom(i, "cp", e.target.value)} data-testid={`hotel-room-cp-${i}`} />
                <Input type="number" placeholder="MAP (dbl)" value={r.map} onChange={(e) => setRoom(i, "map", e.target.value)} data-testid={`hotel-room-map-${i}`} />
                <Input type="number" placeholder="AP (dbl)" value={r.ap} onChange={(e) => setRoom(i, "ap", e.target.value)} data-testid={`hotel-room-ap-${i}`} />
              </div>
              <div className="grid grid-cols-4 gap-2 items-center">
                <Input type="number" placeholder="Single occ." value={r.single_rate} onChange={(e) => setRoom(i, "single_rate", e.target.value)} data-testid={`hotel-room-single-${i}`} />
                <Input type="number" placeholder="Extra bed (adult)" value={r.extra_bed_adult} onChange={(e) => setRoom(i, "extra_bed_adult", e.target.value)} data-testid={`hotel-room-extrabed-${i}`} />
                <Input type="number" placeholder="CWB" value={r.cwb} onChange={(e) => setRoom(i, "cwb", e.target.value)} data-testid={`hotel-room-cwb-${i}`} />
                <Input type="number" placeholder="CNB" value={r.cnb} onChange={(e) => setRoom(i, "cnb", e.target.value)} data-testid={`hotel-room-cnb-${i}`} />
              </div>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground">CP/MAP/AP are per-night double-occupancy base rates. Single occupancy, Extra Bed (adult), Child With Bed (CWB) and Child No Bed (CNB) are per-night add-ons used by the auto-costing engine.</p>
        </div>

        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold uppercase tracking-[0.15em]">Seasonal surcharges</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, seasons: [...f.seasons, { label: "", start: "", end: "", surcharge_pct: "" }] }))} data-testid="hotel-add-season-btn"><Plus className="w-3 h-3 mr-1" /> Season</Button>
          </div>
          {form.seasons.map((s, i) => (
            <div key={i} className="grid grid-cols-4 gap-2 items-center">
              <Input placeholder="Label" value={s.label} onChange={(e) => setSeason(i, "label", e.target.value)} />
              <Input type="date" value={s.start} onChange={(e) => setSeason(i, "start", e.target.value)} />
              <Input type="date" value={s.end} onChange={(e) => setSeason(i, "end", e.target.value)} />
              <Input type="number" placeholder="+ %" value={s.surcharge_pct} onChange={(e) => setSeason(i, "surcharge_pct", e.target.value)} />
            </div>
          ))}
        </div>
        <Button onClick={save} disabled={saving} className="w-full" data-testid="hotel-save-btn">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save hotel
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function VehicleDialog({ open, onOpenChange, initial, onSaved }) {
  const [form, setForm] = useState(EMPTY_VEHICLE);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initial?.id);

  useEffect(() => {
    if (open) setForm(initial?.id ? { ...initial } : { ...EMPTY_VEHICLE });
  }, [open, initial]);

  const save = async () => {
    if (!form.vendor_name.trim()) return toast.error("Vendor name is required");
    setSaving(true);
    try {
      const payload = { ...form, per_day_rate: Number(form.per_day_rate) || 0, driver_charge: Number(form.driver_charge) || 0 };
      if (isEdit) await api.patch(`/vehicles/${initial.id}`, payload);
      else await api.post("/vehicles", payload);
      toast.success("Vehicle saved");
      onOpenChange(false);
      onSaved();
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="vehicle-dialog">
        <DialogHeader><DialogTitle className="font-heading">{isEdit ? "Edit vehicle" : "Add vehicle vendor"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2"><Label>Vendor name *</Label><Input value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} data-testid="vehicle-name-input" /></div>
          <div className="space-y-1.5">
            <Label>Vehicle type</Label>
            <Select value={form.vehicle_type} onValueChange={(v) => setForm({ ...form, vehicle_type: v })}>
              <SelectTrigger data-testid="vehicle-type-select"><SelectValue /></SelectTrigger>
              <SelectContent>{["Sedan", "SUV", "Tempo Traveller", "Mini Bus", "Luxury"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Route from</Label><Input value={form.route_from} onChange={(e) => setForm({ ...form, route_from: e.target.value })} data-testid="vehicle-route-from-input" /></div>
          <div className="space-y-1.5"><Label>Route to</Label><Input value={form.route_to} onChange={(e) => setForm({ ...form, route_to: e.target.value })} data-testid="vehicle-route-to-input" /></div>
          <div className="space-y-1.5"><Label>Per-day rate (₹)</Label><Input type="number" value={form.per_day_rate} onChange={(e) => setForm({ ...form, per_day_rate: e.target.value })} data-testid="vehicle-rate-input" /></div>
          <div className="space-y-1.5"><Label>Driver charge / day (₹)</Label><Input type="number" value={form.driver_charge} onChange={(e) => setForm({ ...form, driver_charge: e.target.value })} data-testid="vehicle-driver-charge-input" /></div>
          <div className="space-y-1.5"><Label>WhatsApp phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="vehicle-phone-input" /></div>
          <div className="space-y-1.5 col-span-2"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="vehicle-email-input" /></div>
        </div>
        <Button onClick={save} disabled={saving} className="w-full" data-testid="vehicle-save-btn">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save vehicle
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export default function Vendors() {
  const { user } = useAuth();
  const canEdit = ["admin", "operations"].includes(user?.role);
  const [hotels, setHotels] = useState(null);
  const [vehicles, setVehicles] = useState(null);
  const [search, setSearch] = useState("");
  const [hotelDialog, setHotelDialog] = useState({ open: false, initial: null });
  const [vehicleDialog, setVehicleDialog] = useState({ open: false, initial: null });

  const loadHotels = () => api.get("/hotels", { params: { search: search || undefined } }).then((r) => setHotels(r.data)).catch((e) => toast.error(apiError(e)));
  const loadVehicles = () => api.get("/vehicles", { params: { search: search || undefined } }).then((r) => setVehicles(r.data)).catch((e) => toast.error(apiError(e)));
  useEffect(() => { loadHotels(); loadVehicles(); /* eslint-disable-next-line */ }, [search]);

  const del = async (kind, id) => {
    try {
      await api.delete(`/${kind}/${id}`);
      toast.success("Deleted");
      kind === "hotels" ? loadHotels() : loadVehicles();
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div className="space-y-6" data-testid="vendors-page">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Vendors & Inventory</h1>
          <p className="text-sm text-muted-foreground mt-1">Hotel rates by meal plan & season, vehicle routes and per-day pricing.</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9 w-56 bg-card" placeholder="Search vendors…" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="vendors-search-input" />
        </div>
      </div>

      <Tabs defaultValue="hotels">
        <TabsList>
          <TabsTrigger value="hotels" data-testid="vendors-tab-hotels">Hotels</TabsTrigger>
          <TabsTrigger value="vehicles" data-testid="vendors-tab-vehicles">Vehicles</TabsTrigger>
        </TabsList>

        <TabsContent value="hotels" className="space-y-4 pt-4">
          <div className="flex justify-end">
            {canEdit && <Button onClick={() => setHotelDialog({ open: true, initial: null })} data-testid="add-hotel-btn"><Plus className="w-4 h-4 mr-2" /> Add Hotel</Button>}
          </div>
          {!hotels ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : (
            <div className="rounded-lg border border-border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hotel</TableHead><TableHead>Destination</TableHead><TableHead>Category</TableHead>
                    <TableHead>Room rates (CP from)</TableHead><TableHead>Seasons</TableHead><TableHead>Contact</TableHead>
                    {canEdit && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody data-testid="hotels-table">
                  {hotels.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">{h.name}</TableCell>
                      <TableCell>{h.destination}</TableCell>
                      <TableCell><Badge variant="secondary" className="rounded-full">{h.star}★</Badge></TableCell>
                      <TableCell>{h.rooms?.length ? `${h.rooms[0].category} · ${inr(Math.min(...h.rooms.map((r) => r.cp || Infinity)))}+` : "—"}</TableCell>
                      <TableCell>{h.seasons?.length ? h.seasons.map((s) => `${s.label} +${s.surcharge_pct}%`).join(", ") : "—"}</TableCell>
                      <TableCell className="text-xs">{h.contact_name}<br />{h.phone}</TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => setHotelDialog({ open: true, initial: h })} data-testid={`hotel-edit-${h.id}`}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => del("hotels", h.id)} data-testid={`hotel-delete-${h.id}`}><Trash2 className="w-4 h-4" /></Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {hotels.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No hotels yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="vehicles" className="space-y-4 pt-4">
          <div className="flex justify-end">
            {canEdit && <Button onClick={() => setVehicleDialog({ open: true, initial: null })} data-testid="add-vehicle-btn"><Plus className="w-4 h-4 mr-2" /> Add Vehicle</Button>}
          </div>
          {!vehicles ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : (
            <div className="rounded-lg border border-border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead><TableHead>Vehicle</TableHead><TableHead>Route</TableHead>
                    <TableHead>Per-day</TableHead><TableHead>Driver/day</TableHead><TableHead>Contact</TableHead>
                    {canEdit && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody data-testid="vehicles-table">
                  {vehicles.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.vendor_name}</TableCell>
                      <TableCell><Badge variant="secondary" className="rounded-full">{v.vehicle_type}</Badge></TableCell>
                      <TableCell>{v.route_from} → {v.route_to}</TableCell>
                      <TableCell>{inr(v.per_day_rate)}</TableCell>
                      <TableCell>{inr(v.driver_charge)}</TableCell>
                      <TableCell className="text-xs">{v.phone}</TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => setVehicleDialog({ open: true, initial: v })} data-testid={`vehicle-edit-${v.id}`}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => del("vehicles", v.id)} data-testid={`vehicle-delete-${v.id}`}><Trash2 className="w-4 h-4" /></Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {vehicles.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No vehicles yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <HotelDialog open={hotelDialog.open} initial={hotelDialog.initial} onOpenChange={(o) => setHotelDialog({ open: o, initial: null })} onSaved={loadHotels} />
      <VehicleDialog open={vehicleDialog.open} initial={vehicleDialog.initial} onOpenChange={(o) => setVehicleDialog({ open: o, initial: null })} onSaved={loadVehicles} />
    </div>
  );
}
