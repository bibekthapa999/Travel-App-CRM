import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BedDouble, Bus, CalendarDays, Download, Loader2, MapPin, Palmtree, Users } from "lucide-react";
import api from "@/lib/api";
import { inr, fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";

export default function SharedItinerary() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/share/${token}`).then((r) => setData(r.data)).catch(() => setError("This proposal link is invalid or has expired."));
  }, [token]);

  if (error)
    return (
      <div className="min-h-screen grid place-items-center bg-background p-6" data-testid="share-error">
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  if (!data)
    return (
      <div className="min-h-screen grid place-items-center bg-background" data-testid="share-loading">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="min-h-screen bg-background noise-bg" data-testid="shared-itinerary">
      <div className="relative h-56 sm:h-72">
        <img
          src="https://images.unsplash.com/photo-1596003903067-bf5762ad5c19?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1Mjh8MHwxfHNlYXJjaHwzfHxiZWF1dGlmdWwlMjBsYW5kc2NhcGUlMjBtb3VudGFpbiUyMGxha2V8ZW58MHx8fHwxNzg3OTkxMjYwfDA&ixlib=rb-4.1.0&q=85"
          alt={data.destination}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
        <div className="absolute top-4 left-4 flex items-center gap-2 text-white">
          <div className="w-8 h-8 rounded-md bg-white/20 backdrop-blur grid place-items-center"><Palmtree className="w-4 h-4" /></div>
          <span className="font-heading font-bold text-sm">{data.brand}</span>
        </div>
        <div className="absolute bottom-5 left-4 right-4 text-white">
          <p className="text-xs uppercase tracking-[0.25em] text-white/80">Your travel proposal</p>
          <h1 className="font-heading text-3xl sm:text-5xl font-black tracking-tight" style={{ textShadow: "0 2px 16px rgba(0,0,0,0.6)" }} data-testid="share-title">
            {data.destination}
          </h1>
          <div className="flex flex-wrap gap-4 mt-2 text-sm text-white/90">
            <span className="flex items-center gap-1.5"><CalendarDays className="w-4 h-4" />{fmtDate(data.start_date)}</span>
            <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{data.days.length} days</span>
            <span className="flex items-center gap-1.5"><Users className="w-4 h-4" />{data.pax} travellers</span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <p className="text-base">Hi <strong>{data.customer_name}</strong>, here is your personalised day-by-day plan. Review it below — no downloads needed.</p>

        <div className="space-y-0" data-testid="share-days">
          {data.days.map((d) => (
            <div key={d.day} className="relative pl-8 pb-8 border-l-2 border-border last:pb-0">
              <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary border-4 border-background" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Day {d.day}</p>
              <h3 className="font-heading text-lg font-semibold mt-0.5">{d.title || `Day ${d.day}`}</h3>
              {d.description && <p className="text-sm text-muted-foreground mt-1">{d.description}</p>}
              <div className="mt-2 space-y-1 text-sm">
                {d.hotel_name && (
                  <p className="flex items-center gap-2"><BedDouble className="w-4 h-4 text-muted-foreground" />{d.hotel_name}{d.room_category ? ` · ${d.room_category}` : ""}{d.meal_plan ? ` · ${d.meal_plan}` : ""}</p>
                )}
                {d.vehicle_label && <p className="flex items-center gap-2"><Bus className="w-4 h-4 text-muted-foreground" />{d.vehicle_label}</p>}
                {d.activities && <p className="text-muted-foreground">{d.activities}</p>}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-3" data-testid="share-price-box">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Package price</p>
          <div className="flex items-end justify-between flex-wrap gap-2">
            <p className="font-heading text-3xl sm:text-4xl font-black tracking-tight" data-testid="share-total">{inr(data.total)}</p>
            <p className="text-sm text-muted-foreground">{inr(data.per_person)} per person · taxes included</p>
          </div>
          <p className="text-xs text-muted-foreground">Valid for 7 days. Prices may vary with hotel availability & seasonal surcharges.</p>
        </div>

        <div className="no-print flex flex-col sm:flex-row gap-3">
          <Button className="flex-1" onClick={() => window.print()} data-testid="share-download-btn">
            <Download className="w-4 h-4 mr-2" /> Download PDF
          </Button>
        </div>

        <footer className="text-center text-xs text-muted-foreground pt-4 border-t border-border">
          Crafted with care by {data.brand} · We never ask for passwords or card details over email or chat.
        </footer>
      </div>
    </div>
  );
}
