import { useEffect, useState } from "react";
import { ImagePlus, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import RichTextEditor from "@/components/RichTextEditor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

const TERM_SECTIONS = [
  ["inclusions", "Inclusions"],
  ["exclusions", "Exclusions"],
  ["payment_policy", "Payment Policy"],
  ["cancellation_policy", "Cancellation Policy"],
  ["important_notes", "Important Notes"],
];
const EMPTY_TERMS = { name: "", inclusions: "", exclusions: "", payment_policy: "", cancellation_policy: "", important_notes: "" };
const EMPTY_ROUTE = { from_place: "", to_place: "", via: "", excursion: "", day_title: "", image_url: "", description: "" };

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    if (file.size > 2 * 1024 * 1024) return reject(new Error("Image must be under 2 MB"));
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Settings() {
  const [routes, setRoutes] = useState(null);
  const [terms, setTerms] = useState(null);
  const [branding, setBranding] = useState(null);
  const [company, setCompany] = useState({ whatsapp: "" });
  const [routeDialog, setRouteDialog] = useState({ open: false, initial: null });
  const [routeForm, setRouteForm] = useState(EMPTY_ROUTE);
  const [termDialog, setTermDialog] = useState({ open: false, initial: null });
  const [termForm, setTermForm] = useState(EMPTY_TERMS);
  const [brandForm, setBrandForm] = useState({ sector: "", header_banner: "", footer_banner: "" });
  const [busy, setBusy] = useState(false);

  const loadRoutes = () => api.get("/routes").then((r) => setRoutes(r.data)).catch((e) => toast.error(apiError(e)));
  const loadTerms = () => api.get("/settings/terms").then((r) => setTerms(r.data)).catch((e) => toast.error(apiError(e)));
  const loadBranding = () => api.get("/settings/branding").then((r) => setBranding(r.data)).catch((e) => toast.error(apiError(e)));
  useEffect(() => {
    loadRoutes();
    loadTerms();
    loadBranding();
    api.get("/settings/company").then((r) => setCompany(r.data)).catch(() => {});
  }, []);

  const saveRoute = async () => {
    if (!routeForm.from_place.trim() || (!routeForm.to_place.trim() && !routeForm.excursion.trim())) return toast.error("From plus a To or an Excursion are required");
    setBusy(true);
    try {
      if (routeDialog.initial?.id) await api.patch(`/routes/${routeDialog.initial.id}`, routeForm);
      else await api.post("/routes", routeForm);
      toast.success("Route saved");
      setRouteDialog({ open: false, initial: null });
      loadRoutes();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };

  const saveTerms = async () => {
    if (!termForm.name.trim()) return toast.error("Template name is required");
    setBusy(true);
    try {
      if (termDialog.initial?.id) await api.patch(`/settings/terms/${termDialog.initial.id}`, termForm);
      else await api.post("/settings/terms", termForm);
      toast.success("Template saved");
      setTermDialog({ open: false, initial: null });
      loadTerms();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };

  const saveBranding = async () => {
    if (!brandForm.sector.trim()) return toast.error("Sector is required");
    setBusy(true);
    try {
      await api.post("/settings/branding", brandForm);
      toast.success(`Branding saved for ${brandForm.sector}`);
      setBrandForm({ sector: "", header_banner: "", footer_banner: "" });
      loadBranding();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };

  const saveCompany = async () => {
    setBusy(true);
    try {
      const { data } = await api.put("/settings/company", company);
      setCompany(data);
      toast.success("Company settings saved");
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };

  const upload = async (e, key) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await fileToBase64(file);
      setBrandForm((f) => ({ ...f, [key]: b64 }));
    } catch (err) { toast.error(err.message); }
  };

  const stripHtml = (html) => (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  return (
    <div className="space-y-6" data-testid="settings-page">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Route masters, policy templates, sector branding and company profile.</p>
      </div>

      <Tabs defaultValue="routes">
        <TabsList className="flex-wrap">
          <TabsTrigger value="routes" data-testid="settings-tab-routes">Route Master</TabsTrigger>
          <TabsTrigger value="terms" data-testid="settings-tab-terms">Terms & Policies</TabsTrigger>
          <TabsTrigger value="branding" data-testid="settings-tab-branding">Sector Branding</TabsTrigger>
          <TabsTrigger value="company" data-testid="settings-tab-company">Company</TabsTrigger>
        </TabsList>

        <TabsContent value="routes" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Button onClick={() => { setRouteForm(EMPTY_ROUTE); setRouteDialog({ open: true, initial: null }); }} data-testid="add-route-btn">
              <Plus className="w-4 h-4 mr-2" /> Add Route
            </Button>
          </div>
          {!routes ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : (
            <div className="rounded-lg border border-border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Via</TableHead><TableHead>Excursion</TableHead><TableHead>Auto Day Title</TableHead><TableHead>Image</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                </TableHeader>
                <TableBody data-testid="routes-table">
                  {routes.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.from_place}</TableCell>
                      <TableCell>{r.to_place || "—"}</TableCell>
                      <TableCell>{r.via || "—"}</TableCell>
                      <TableCell>{r.excursion || "—"}</TableCell>
                      <TableCell className="max-w-52 truncate text-xs text-muted-foreground">{r.day_title || "—"}</TableCell>
                      <TableCell>{r.image_url ? <img src={r.image_url} alt="" className="w-16 h-10 object-cover rounded" /> : "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => { setRouteForm({ ...EMPTY_ROUTE, ...r }); setRouteDialog({ open: true, initial: r }); }} data-testid={`route-edit-${r.id}`}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={async () => { await api.delete(`/routes/${r.id}`); loadRoutes(); }} data-testid={`route-delete-${r.id}`}><Trash2 className="w-4 h-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {routes.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No routes yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="terms" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Button onClick={() => { setTermForm(EMPTY_TERMS); setTermDialog({ open: true, initial: null }); }} data-testid="add-terms-btn">
              <Plus className="w-4 h-4 mr-2" /> New Template
            </Button>
          </div>
          {!terms ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="terms-list">
              {terms.map((t) => (
                <Card key={t.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-4 space-y-3">
                    <p className="font-heading font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{stripHtml(t.inclusions)}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setTermForm({ ...EMPTY_TERMS, ...t }); setTermDialog({ open: true, initial: t }); }} data-testid={`terms-edit-${t.id}`}>
                        <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={async () => { await api.delete(`/settings/terms/${t.id}`); loadTerms(); }} data-testid={`terms-delete-${t.id}`}>
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="branding" className="space-y-6 pt-4">
          <Card>
            <CardContent className="p-5 space-y-4" data-testid="branding-form">
              <div className="space-y-1.5 max-w-sm">
                <Label>Sector / Destination (e.g. Sikkim/Darjeeling, Bhutan, Nepal)</Label>
                <Input value={brandForm.sector} onChange={(e) => setBrandForm({ ...brandForm, sector: e.target.value })} placeholder="Sikkim/Darjeeling" data-testid="branding-sector-input" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {["header_banner", "footer_banner"].map((key) => (
                  <div key={key} className="space-y-2">
                    <Label>{key === "header_banner" ? "Header banner" : "Footer banner"}</Label>
                    <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-4 cursor-pointer hover:border-primary transition-colors min-h-28" data-testid={`branding-upload-${key}`}>
                      {brandForm[key] ? (
                        <img src={brandForm[key]} alt="" className="w-full h-24 object-cover rounded" />
                      ) : (
                        <>
                          <ImagePlus className="w-6 h-6 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Click to upload image (max 2 MB)</span>
                        </>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e, key)} />
                    </label>
                  </div>
                ))}
              </div>
              <Button onClick={saveBranding} disabled={busy} data-testid="branding-save-btn">
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save branding
              </Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="branding-list">
            {(branding || []).map((b) => (
              <Card key={b.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-heading font-semibold">{b.sector}</p>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={async () => { await api.delete(`/settings/branding/${b.id}`); loadBranding(); }} data-testid={`branding-delete-${b.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  {b.header_banner && <img src={b.header_banner} alt="header" className="w-full h-20 object-cover rounded" />}
                  {b.footer_banner && <img src={b.footer_banner} alt="footer" className="w-full h-20 object-cover rounded" />}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="company" className="pt-4">
          <Card className="max-w-md">
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label>Company WhatsApp number (guest view "Chat on WhatsApp")</Label>
                <Input value={company.whatsapp} onChange={(e) => setCompany({ whatsapp: e.target.value })} placeholder="919876543210" data-testid="company-whatsapp-input" />
              </div>
              <Button onClick={saveCompany} disabled={busy} data-testid="company-save-btn">
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={routeDialog.open} onOpenChange={(o) => setRouteDialog({ open: o, initial: null })}>
        <DialogContent className="max-w-2xl" data-testid="route-dialog">
          <DialogHeader><DialogTitle className="font-heading">{routeDialog.initial ? "Edit route" : "Add route"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>From *</Label><Input value={routeForm.from_place} onChange={(e) => setRouteForm({ ...routeForm, from_place: e.target.value })} placeholder="IXB/NJP" data-testid="route-from-input" /></div>
            <div className="space-y-1.5"><Label>To (leave blank for excursions)</Label><Input value={routeForm.to_place} onChange={(e) => setRouteForm({ ...routeForm, to_place: e.target.value })} placeholder="Gangtok" data-testid="route-to-input" /></div>
            <div className="space-y-1.5"><Label>Via (en-route stop, optional)</Label><Input value={routeForm.via} onChange={(e) => setRouteForm({ ...routeForm, via: e.target.value })} placeholder="Ravangla" data-testid="route-via-input" /></div>
            <div className="space-y-1.5"><Label>Excursion (day trip, optional)</Label><Input value={routeForm.excursion} onChange={(e) => setRouteForm({ ...routeForm, excursion: e.target.value })} placeholder="Tsomgo Lake & Baba Mandir" data-testid="route-excursion-input" /></div>
            <div className="space-y-1.5 col-span-2"><Label>Day title (auto-fetched into itineraries; auto-generated if blank)</Label><Input value={routeForm.day_title} onChange={(e) => setRouteForm({ ...routeForm, day_title: e.target.value })} placeholder="Transfer to Pelling via Ravangla Sightseeing" data-testid="route-title-input" /></div>
            <div className="space-y-1.5 col-span-2"><Label>Image URL (optional)</Label><Input value={routeForm.image_url} onChange={(e) => setRouteForm({ ...routeForm, image_url: e.target.value })} data-testid="route-image-input" /></div>
            <div className="space-y-1.5 col-span-2">
              <Label>Default description (auto-loads into itineraries)</Label>
              <RichTextEditor value={routeForm.description} onChange={(v) => setRouteForm({ ...routeForm, description: v })} testid="route-description-editor" placeholder="Beautifully written route description…" minHeight="min-h-36" />
            </div>
          </div>
          <Button onClick={saveRoute} disabled={busy} className="w-full" data-testid="route-save-btn">
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save route
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={termDialog.open} onOpenChange={(o) => setTermDialog({ open: o, initial: null })}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="terms-dialog">
          <DialogHeader><DialogTitle className="font-heading">{termDialog.initial ? "Edit template" : "New terms template"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Template name *</Label><Input value={termForm.name} onChange={(e) => setTermForm({ ...termForm, name: e.target.value })} placeholder="Standard Domestic Tour" data-testid="terms-name-input" /></div>
            {TERM_SECTIONS.map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label>{label}</Label>
                <RichTextEditor value={termForm[key]} onChange={(v) => setTermForm({ ...termForm, [key]: v })} testid={`terms-editor-${key}`} />
              </div>
            ))}
          </div>
          <Button onClick={saveTerms} disabled={busy} className="w-full" data-testid="terms-save-btn">
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save template
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
