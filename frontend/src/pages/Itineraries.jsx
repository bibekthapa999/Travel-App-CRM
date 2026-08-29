import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Pencil, Plus, Search, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { inr, fmtDate } from "@/lib/format";
import ShareModal from "@/components/ShareModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function Itineraries() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [search, setSearch] = useState("");
  const [share, setShare] = useState(null);

  const load = () => api.get("/itineraries", { params: { search: search || undefined } }).then((r) => setItems(r.data)).catch((e) => toast.error(apiError(e)));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [search]);

  const del = async (id) => {
    try {
      await api.delete(`/itineraries/${id}`);
      toast.success("Itinerary deleted");
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div className="space-y-6" data-testid="itineraries-page">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Itineraries & Proposals</h1>
          <p className="text-sm text-muted-foreground mt-1">Auto-costed day-by-day proposals with live share links and PDF print.</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9 w-56 bg-card" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="itineraries-search-input" />
        </div>
        <Button onClick={() => navigate("/itineraries/new")} data-testid="new-itinerary-btn"><Plus className="w-4 h-4 mr-2" /> New Itinerary</Button>
      </div>

      {!items ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead><TableHead>Customer</TableHead><TableHead>Destination</TableHead>
                <TableHead>Start</TableHead><TableHead>Days</TableHead><TableHead className="text-right">Package price</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody data-testid="itineraries-table">
              {items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="font-medium max-w-56 truncate">{it.title}</TableCell>
                  <TableCell>{it.customer_name}</TableCell>
                  <TableCell>{it.destination}</TableCell>
                  <TableCell>{fmtDate(it.start_date)}</TableCell>
                  <TableCell><Badge variant="secondary" className="rounded-full">{it.days?.length || 0}</Badge></TableCell>
                  <TableCell className="text-right font-semibold">{inr(it.costing?.total)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon" title="Share" onClick={() => setShare(it)} data-testid={`itinerary-share-${it.id}`}>
                      <Share2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Edit" onClick={() => navigate(`/itineraries/${it.id}/edit`)} data-testid={`itinerary-edit-${it.id}`}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" title="Delete" onClick={() => del(it.id)} data-testid={`itinerary-delete-${it.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    No itineraries yet. <Link to="/itineraries/new" className="text-primary hover:underline">Build your first proposal →</Link>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <ShareModal
        open={Boolean(share)}
        onOpenChange={(o) => !o && setShare(null)}
        title={`Share proposal — ${share?.customer_name || ""}`}
        messageUrl={share ? `/itineraries/${share.id}/message` : null}
        emailTemplate={share ? "proposal" : null}
        emailRefId={share?.id}
      />
    </div>
  );
}
