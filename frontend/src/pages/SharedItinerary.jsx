import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { BedDouble, Bus, CalendarDays, CheckCircle2, Download, Loader2, MapPin, MessageCircle, Users } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { inr, fmtDate, digits } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FALLBACK_HERO = "https://images.unsplash.com/photo-1604223190546-a43e4c7f29d7?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODh8MHwxfHNlYXJjaHwxfHxoaW1hbGF5YW4lMjBtb3VudGFpbiUyMGxhbmRzY2FwZSUyMHN1bnNldHxlbnwwfHx8fDE3ODc5OTkyMTh8MA&ixlib=rb-4.1.0&q=85";

const POLICY_SECTIONS = [
  ["inclusions", "What's Included"],
  ["exclusions", "What's Not Included"],
  ["payment_policy", "Payment Policy"],
  ["cancellation_policy", "Cancellation Policy"],
  ["important_notes", "Important Notes"],
];

export default function SharedItinerary() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    api
      .get(`/share/${token}`)
      .then((r) => { setData(r.data); setAccepted(Boolean(r.data.accepted)); })
      .catch(() => setError("This proposal link is invalid or has expired."));
  }, [token]);

  const acceptQuote = async () => {
    setAccepting(true);
    try {
      await api.post(`/share/${token}/accept`);
      setAccepted(true);
      toast.success("Quote accepted — our team will confirm your booking shortly!");
    } catch {
      toast.error("Could not accept the quote. Please try again.");
    } finally {
      setAccepting(false);
    }
  };

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

  const waText = encodeURIComponent(`Hi ${data.brand}, I'm reviewing my ${data.destination} proposal (${data.days.length} days, from ${data.start_date}) and would like to discuss it.`);
  const waLink = data.company_whatsapp ? `https://wa.me/${digits(data.company_whatsapp)}?text=${waText}` : null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] pb-28 overflow-x-hidden" data-testid="shared-itinerary">
      {data.header_banner && (
        <img src={data.header_banner} alt={`${data.sector || data.destination} banner`} className="w-full h-20 sm:h-28 object-cover" data-testid="share-header-banner" />
      )}

      <header className="relative min-h-[60vh] sm:min-h-[80vh] flex items-end" data-testid="share-hero">
        <img src={data.hero_image || FALLBACK_HERO} alt={data.destination} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
        <div className="absolute top-5 left-5 sm:left-8">
          <p className="font-heading text-white font-bold text-sm tracking-wide drop-shadow">{data.brand}</p>
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/70">Travel Curators</p>
        </div>
        <div className="relative z-10 max-w-5xl mx-auto w-full px-5 sm:px-8 pb-10 sm:pb-14 text-white">
          <p className="text-xs uppercase tracking-[0.35em] text-white/80 mb-2">A journey crafted for {data.customer_name}</p>
          <h1 className="font-heading text-4xl sm:text-6xl font-black tracking-tight leading-[0.95] break-words" style={{ textShadow: "0 2px 24px rgba(0,0,0,0.5)" }} data-testid="share-title">
            {data.destination}
          </h1>
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-5 text-sm text-white/90">
            <span className="flex items-center gap-1.5"><CalendarDays className="w-4 h-4" />{fmtDate(data.start_date)}</span>
            <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{data.days.length} days</span>
            <span className="flex items-center gap-1.5"><Users className="w-4 h-4" />{data.adults} adults{data.cwb ? ` · ${data.cwb} child (bed)` : ""}{data.cnb ? ` · ${data.cnb} child (no bed)` : ""}</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 sm:px-8">
        <motion.p
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="py-16 sm:py-24 text-lg leading-relaxed text-slate-600"
        >
          Dear <strong className="text-[#0F172A]">{data.customer_name}</strong>, every detail of this journey has been
          hand-planned by our travel curators — scroll through your day-by-day story below.
        </motion.p>

        <section className="space-y-16 sm:space-y-20" data-testid="share-days">
          {data.days.map((d, i) => (
            <motion.article
              key={d.day}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5 }}
              className="relative pl-14 sm:pl-20"
              data-testid={`share-day-${d.day}`}
            >
              <div className="absolute left-0 top-0 bottom-0 w-px bg-slate-200" />
              <span className="absolute -left-2 top-0 font-heading text-5xl sm:text-6xl font-black text-slate-200 select-none">
                {String(d.day).padStart(2, "0")}
              </span>
              <div className="absolute left-[-5px] top-14 w-2.5 h-2.5 rounded-full bg-primary" />
              <div className="pt-1">
                {(d.from_place || d.to_place) && (
                  <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-1">
                    {d.from_place}{d.from_place && d.to_place ? " → " : ""}{d.to_place}
                  </p>
                )}
                <h3 className="font-heading text-xl sm:text-2xl font-bold tracking-tight">{d.title || `Day ${d.day}`}</h3>
                {d.images?.length > 0 && (
                  <div className={`grid gap-2 mt-4 ${d.images.length > 1 ? "grid-cols-3" : "grid-cols-2"}`}>
                    {d.images.slice(0, 3).map((img, j) => (
                      <img
                        key={j} src={img} alt="" loading="lazy"
                        className={`rounded-lg object-cover w-full hover:opacity-95 transition-opacity ${j === 0 ? "col-span-2 h-44 sm:h-56" : "h-44 sm:h-56"}`}
                      />
                    ))}
                  </div>
                )}
                {d.description && (
                  <div className="rich-text text-sm sm:text-base text-slate-600 leading-relaxed mt-4" dangerouslySetInnerHTML={{ __html: d.description }} data-testid={`share-day-desc-${d.day}`} />
                )}
                <div className="mt-3 space-y-1.5 text-sm text-slate-600">
                  {d.hotel_name && <p className="flex items-center gap-2"><BedDouble className="w-4 h-4 text-primary shrink-0" />{d.hotel_name}{d.room_category ? ` · ${d.room_category}` : ""}{d.meal_plan ? ` · ${d.meal_plan}` : ""}</p>}
                  {d.vehicle_label && <p className="flex items-center gap-2"><Bus className="w-4 h-4 text-primary shrink-0" />{d.vehicle_label}</p>}
                  {d.activities && <p className="text-slate-500">{d.activities}</p>}
                </div>
              </div>
            </motion.article>
          ))}
        </section>

        <motion.section
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="mt-24 sm:mt-32 rounded-2xl border border-slate-200 bg-white p-6 sm:p-10"
          data-testid="share-price-box"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-primary">Investment</p>
          <div className="flex items-end justify-between flex-wrap gap-3 mt-3">
            <p className="font-heading text-4xl sm:text-5xl font-black tracking-tight" data-testid="share-total">{inr(data.total)}</p>
            <p className="text-sm text-slate-500">{inr(data.per_person)} per person · all taxes included</p>
          </div>
          <p className="text-xs text-slate-400 mt-4">Valid for 7 days. Prices may vary with hotel availability and seasonal surcharges.</p>
          {accepted && (
            <div className="mt-5 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 font-medium" data-testid="accepted-banner">
              <CheckCircle2 className="w-4 h-4" /> Quote accepted — we are preparing your booking!
            </div>
          )}
        </motion.section>

        {Object.values(data.terms || {}).some((v) => v) && (
          <section className="mt-16 sm:mt-24" data-testid="policies-section">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-primary mb-2">Good to know</p>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight mb-6">Policies & Terms</h2>
            <Accordion type="multiple" className="border-t border-slate-200" data-testid="policies-accordion">
              {POLICY_SECTIONS.filter(([key]) => data.terms?.[key]).map(([key, label]) => (
                <AccordionItem key={key} value={key} className="border-b border-slate-200">
                  <AccordionTrigger className="font-heading text-base font-semibold hover:text-primary" data-testid={`policy-trigger-${key}`}>{label}</AccordionTrigger>
                  <AccordionContent>
                    <div className="rich-text text-sm text-slate-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: data.terms[key] }} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        )}

        {data.footer_banner && (
          <img src={data.footer_banner} alt="" className="w-full h-24 sm:h-32 object-cover rounded-xl mt-16 sm:mt-24" data-testid="share-footer-banner" />
        )}

        <footer className="text-center text-xs text-slate-400 pt-16 pb-6">
          Crafted with care by {data.brand} · Your data will be used in a professional manner and will not be disclosed to any third party.
        </footer>
      </main>

      <div className="no-print fixed bottom-0 inset-x-0 z-50 bg-white/85 backdrop-blur-xl border-t border-slate-200" data-testid="sticky-action-bar">
        <div className="max-w-3xl mx-auto px-4 py-3 flex gap-2 sm:gap-3">
          <Button className="flex-1" onClick={acceptQuote} disabled={accepted || accepting} data-testid="accept-quote-btn">
            {accepting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : accepted ? <CheckCircle2 className="w-4 h-4 mr-2" /> : null}
            {accepted ? "Quote Accepted" : "Accept Quote"}
          </Button>
          <Button variant="outline" onClick={() => window.print()} data-testid="download-pdf-btn">
            <Download className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Download PDF</span>
          </Button>
          {waLink && (
            <Button variant="outline" asChild className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
              <a href={waLink} target="_blank" rel="noopener noreferrer" data-testid="whatsapp-chat-btn">
                <MessageCircle className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Chat on WhatsApp</span>
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
