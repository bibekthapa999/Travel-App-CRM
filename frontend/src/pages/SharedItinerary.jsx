import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BadgeCheck, BedDouble, Bus, CalendarDays, Check, CheckCircle2, Download, Headphones,
  Loader2, MapPin, MessageCircle, Share2, ShieldCheck, SlidersHorizontal, Users, X,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { inr, fmtDate, digits } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FALLBACK_HERO = "https://images.unsplash.com/photo-1604223190546-a43e4c7f29d7?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODh8MHwxfHNlYXJjaHwxfHxoaW1hbGF5YW4lMjBtb3VudGFpbiUyMGxhbmRzY2FwZSUyMHN1bnNldHxlbnwwfHx8fDE3ODc5OTkyMTh8MA&ixlib=rb-4.1.0&q=85";

const TRUST = [
  { icon: SlidersHorizontal, label: "100% Customisation" },
  { icon: Headphones, label: "24×7 Assistance" },
  { icon: ShieldCheck, label: "Safety & Security" },
  { icon: BadgeCheck, label: "Value & Transparency" },
];

const POLICY_ACCORDIONS = [
  ["payment_policy", "Payment Policy"],
  ["cancellation_policy", "Cancellation Policy"],
  ["important_notes", "Important Notes"],
];

function decodeEntities(txt) {
  const el = document.createElement("textarea");
  el.innerHTML = txt;
  return el.value;
}

function htmlToItems(html) {
  if (!html) return [];
  const items = [];
  const re = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = re.exec(html))) {
    const txt = decodeEntities(m[1].replace(/<[^>]+>/g, "")).trim();
    if (txt) items.push(txt);
  }
  if (!items.length) {
    const txt = decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if (txt) items.push(txt);
  }
  return items;
}

const fade = { initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-60px" }, transition: { duration: 0.5 } };

const Overline = ({ children }) => (
  <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-primary mb-2">{children}</p>
);

export default function SharedItinerary() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [openPolicies, setOpenPolicies] = useState([]);

  const expandPoliciesSync = () => flushSync(() => setOpenPolicies(POLICY_ACCORDIONS.map(([k]) => k)));

  useEffect(() => {
    window.addEventListener("beforeprint", expandPoliciesSync);
    return () => window.removeEventListener("beforeprint", expandPoliciesSync);
  }, []);

  const downloadPdf = () => {
    expandPoliciesSync();
    setTimeout(() => window.print(), 50);
  };

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

  const nights = Math.max(data.days.length - 1, 0);
  const mealPlan = data.days.find((d) => d.meal_plan)?.meal_plan || "—";
  const vehicleType = (data.days.find((d) => d.vehicle_label)?.vehicle_label || "").split(" — ")[0] || "—";
  const groupSize = `${data.adults} adult${data.adults > 1 ? "s" : ""}${data.cwb ? ` · ${data.cwb} child (bed)` : ""}${data.cnb ? ` · ${data.cnb} child (no bed)` : ""}`;
  const dayDate = (day) =>
    data.start_date
      ? new Date(new Date(data.start_date).getTime() + (day - 1) * 86400000).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
      : "";

  const summaryRows = [
    ["Destination", data.destination],
    ["Start date", fmtDate(data.start_date)],
    ["Duration", `${data.days.length} day${data.days.length > 1 ? "s" : ""}${nights ? ` / ${nights} night${nights > 1 ? "s" : ""}` : ""}`],
    ["Group size", groupSize],
    ["Meal inclusion", mealPlan],
    ["Vehicle type", vehicleType],
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] pb-28 overflow-x-hidden" data-testid="shared-itinerary">
      {data.header_banner && (
        <img src={data.header_banner} alt={`${data.sector || data.destination} banner`} className="w-full h-20 sm:h-28 object-cover" data-testid="share-header-banner" />
      )}

      {/* Cinematic hero */}
      <header className="relative min-h-[55vh] sm:min-h-[72vh] flex items-end" data-testid="share-hero">
        <img src={data.hero_image || FALLBACK_HERO} alt={data.destination} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
        <div className="absolute top-5 left-5 sm:left-8">
          <p className="font-heading text-white font-bold text-sm tracking-wide drop-shadow">{data.brand}</p>
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/70 italic normal-case tracking-wide">With {data.brand}, your adventure awakens.</p>
        </div>
        <div className="relative z-10 max-w-5xl mx-auto w-full px-5 sm:px-8 pb-10 sm:pb-14 text-white">
          <p className="text-xs uppercase tracking-[0.35em] text-white/80 mb-2">A journey crafted for {data.customer_name}</p>
          <h1 className="font-heading text-4xl sm:text-6xl font-black tracking-tight leading-[0.95] break-words" style={{ textShadow: "0 2px 24px rgba(0,0,0,0.5)" }} data-testid="share-title">
            {data.title || data.destination}
          </h1>
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-5 text-sm text-white/90">
            <span className="flex items-center gap-1.5"><CalendarDays className="w-4 h-4" />{fmtDate(data.start_date)}</span>
            <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{data.days.length} days{nights ? ` · ${nights} night${nights > 1 ? "s" : ""}` : ""}</span>
            <span className="flex items-center gap-1.5"><Users className="w-4 h-4" />{groupSize}</span>
          </div>
        </div>
      </header>

      {/* Trust strip */}
      <div className="border-b border-slate-200 bg-white" data-testid="trust-strip">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {TRUST.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <Icon className="w-4 h-4 text-primary shrink-0" />{label}
            </div>
          ))}
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-5 sm:px-8">
        {/* Greeting + trip summary */}
        <motion.section {...fade} className="pt-12 sm:pt-16">
          <p className="text-base leading-relaxed text-slate-600">
            Dear <strong className="text-[#0F172A]">{data.customer_name}</strong>, thank you for choosing {data.brand}.
            Here is your personalised travel plan — everything is arranged, day by day.
          </p>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white overflow-hidden" data-testid="trip-summary-box">
            <div className="grid grid-cols-1 sm:grid-cols-2">
              {summaryRows.map(([label, value], i) => (
                <div key={label} className={`px-5 py-3.5 ${i % 2 === 0 ? "sm:border-r" : ""} border-b border-slate-100`}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</p>
                  <p className="text-sm font-semibold mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Pricing */}
        <motion.section {...fade} className="mt-14 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8" data-testid="share-price-box">
          <Overline>Package pricing</Overline>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Transparent package pricing</h2>
          <div className="flex items-end justify-between flex-wrap gap-3 mt-5 rounded-xl bg-primary/5 border border-primary/15 px-5 py-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Total package cost</p>
              <p className="font-heading text-4xl sm:text-5xl font-black tracking-tight text-primary" data-testid="share-total">{inr(data.total)}</p>
            </div>
            <p className="text-sm text-slate-500">{inr(data.per_person)} per person · all taxes included</p>
          </div>
          <p className="text-xs text-slate-400 mt-4">Valid for 7 days. Prices may vary with hotel availability and seasonal surcharges.</p>
          {accepted && (
            <div className="mt-5 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 font-medium" data-testid="accepted-banner">
              <CheckCircle2 className="w-4 h-4" /> Itinerary approved — we are preparing your booking!
            </div>
          )}
        </motion.section>

        {/* Hotels */}
        {data.stays?.length > 0 && (
          <motion.section {...fade} className="mt-14" data-testid="share-stays">
            <Overline>Where you'll stay</Overline>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight mb-6">Hotels & Accommodation</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {data.stays.map((s, i) => (
                <div key={i} className="rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-lg transition-shadow" data-testid={`stay-card-${i}`}>
                  {s.image_url && <img src={s.image_url} alt={s.hotel_name} loading="lazy" className="w-full h-44 object-cover" />}
                  <div className="p-4 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-heading font-bold">{s.hotel_name}</p>
                      <span className="shrink-0 rounded-full bg-primary/10 text-primary text-[10px] font-bold px-2.5 py-0.5 uppercase tracking-wider">{s.nights} night{s.nights > 1 ? "s" : ""}</span>
                    </div>
                    {(s.room_category || s.meal_plan) && (
                      <p className="text-sm text-slate-600">{s.room_category}{s.room_category && s.meal_plan ? " · " : ""}{s.meal_plan}</p>
                    )}
                    {s.check_in && (
                      <p className="text-xs text-slate-400 flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5" />Check-in {fmtDate(s.check_in)} · Check-out {fmtDate(s.check_out)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Day-wise itinerary */}
        <section className="mt-16" data-testid="share-days">
          <Overline>Your journey, day by day</Overline>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight mb-8">Day-Wise Itinerary</h2>
          <div className="space-y-6">
            {data.days.map((d) => (
              <motion.article
                key={d.day}
                {...fade}
                className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                data-testid={`share-day-${d.day}`}
              >
                <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-5">
                  <span className="inline-flex items-center rounded-md bg-primary px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-white" data-testid={`day-chip-${d.day}`}>
                    Day {String(d.day).padStart(2, "0")}
                  </span>
                  {data.start_date && (
                    <span className="text-xs text-slate-400" data-testid={`share-day-date-${d.day}`}>{dayDate(d.day)}</span>
                  )}
                </div>
                <div className="px-5 sm:px-6 pb-6 pt-3">
                  {(d.from_place || d.to_place || d.excursion) && (
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary">
                        {d.excursion ? `${d.from_place} · day trip` : `${d.from_place}${d.from_place && d.to_place ? " → " : ""}${d.to_place}`}
                      </span>
                      {d.via && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 text-orange-600 border border-orange-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider" data-testid={`share-day-via-${d.day}`}>
                          <MapPin className="w-3 h-3" /> via {d.via}
                        </span>
                      )}
                      {d.excursion && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 text-orange-600 border border-orange-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider" data-testid={`share-day-excursion-${d.day}`}>
                          <MapPin className="w-3 h-3" /> Excursion: {d.excursion}
                        </span>
                      )}
                    </div>
                  )}
                  <h3 className="font-heading text-xl sm:text-2xl font-bold tracking-tight" data-testid={`share-day-title-${d.day}`}>{d.title || `Day ${d.day}`}</h3>
                  {d.images?.length > 0 && (
                    <div className={`grid gap-2 mt-4 ${d.images.length > 1 ? "grid-cols-3" : "grid-cols-2"}`}>
                      {d.images.slice(0, 3).map((img, j) => (
                        <img
                          key={j} src={img} alt="" loading="lazy"
                          className={`rounded-lg object-cover w-full hover:opacity-95 transition-opacity ${j === 0 ? "col-span-2 h-44 sm:h-52" : "h-44 sm:h-52"}`}
                        />
                      ))}
                    </div>
                  )}
                  {d.description && (
                    <div className="rich-text text-sm sm:text-base text-slate-600 leading-relaxed mt-4" dangerouslySetInnerHTML={{ __html: d.description }} data-testid={`share-day-desc-${d.day}`} />
                  )}
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-slate-600 border-t border-slate-100 pt-3">
                    {d.hotel_name && <p className="flex items-center gap-2"><BedDouble className="w-4 h-4 text-primary shrink-0" />Stay: {d.hotel_name}{d.room_category ? ` · ${d.room_category}` : ""}{d.meal_plan ? ` · ${d.meal_plan}` : ""}</p>}
                    {d.vehicle_label && <p className="flex items-center gap-2"><Bus className="w-4 h-4 text-primary shrink-0" />{d.vehicle_label}</p>}
                    {d.activities && <p className="text-slate-500">{d.activities}</p>}
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        {/* Included / Excluded */}
        {(data.terms?.inclusions || data.terms?.exclusions) && (
          <motion.section {...fade} className="mt-16" data-testid="included-excluded">
            <Overline>Know exactly what you get</Overline>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight mb-6">What's Included & Excluded</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {data.terms?.inclusions && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5" data-testid="inclusions-card">
                  <p className="flex items-center gap-2 font-heading font-bold text-emerald-700 mb-3"><CheckCircle2 className="w-5 h-5" /> Included</p>
                  <ul className="space-y-2">
                    {htmlToItems(data.terms.inclusions).map((item, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-700"><Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {data.terms?.exclusions && (
                <div className="rounded-2xl border border-red-200 bg-red-50/60 p-5" data-testid="exclusions-card">
                  <p className="flex items-center gap-2 font-heading font-bold text-red-600 mb-3"><X className="w-5 h-5" /> Not included</p>
                  <ul className="space-y-2">
                    {htmlToItems(data.terms.exclusions).map((item, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-700"><X className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.section>
        )}

        {/* Remaining policies */}
        {POLICY_ACCORDIONS.some(([key]) => data.terms?.[key]) && (
          <section className="mt-14" data-testid="policies-section">
            <Overline>Good to know</Overline>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight mb-6">Policies & Terms</h2>
            <Accordion type="multiple" value={openPolicies} onValueChange={setOpenPolicies} className="border-t border-slate-200" data-testid="policies-accordion">
              {POLICY_ACCORDIONS.filter(([key]) => data.terms?.[key]).map(([key, label]) => (
                <AccordionItem key={key} value={key} className="border-b border-slate-200">
                  <AccordionTrigger className="font-heading text-base font-semibold hover:text-primary" data-testid={`policy-trigger-${key}`}>{label}</AccordionTrigger>
                  <AccordionContent forceMount>
                    <div className="rich-text text-sm text-slate-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: data.terms[key] }} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        )}

        {data.footer_banner && (
          <img src={data.footer_banner} alt="" className="w-full h-24 sm:h-32 object-cover rounded-xl mt-16" data-testid="share-footer-banner" />
        )}

        {/* Contact footer */}
        <footer className="mt-16 rounded-2xl bg-[#0F172A] text-white p-6 sm:p-8 mb-10" data-testid="share-footer">
          <p className="font-heading text-xl font-bold">Ready to pack your bags?</p>
          <p className="text-sm text-slate-300 mt-1">Approve the itinerary below or chat with your travel consultant — we usually reply within minutes.</p>
          {waLink && (
            <Button asChild className="mt-4 bg-emerald-500 hover:bg-emerald-600 text-white">
              <a href={waLink} target="_blank" rel="noopener noreferrer" data-testid="footer-whatsapp-btn">
                <MessageCircle className="w-4 h-4 mr-2" /> Chat with {data.brand}
              </a>
            </Button>
          )}
          <p className="text-[11px] text-slate-400 mt-6 pt-4 border-t border-white/10">
            Crafted with care by {data.brand} · Your data will be used in a professional manner and will not be disclosed to any third party.
          </p>
        </footer>
      </main>

      {/* Sticky action bar */}
      <div className="no-print fixed bottom-0 inset-x-0 z-50 bg-white/85 backdrop-blur-xl border-t border-slate-200" data-testid="sticky-action-bar">
        <div className="max-w-3xl mx-auto px-4 py-3 flex gap-2 sm:gap-3">
          <Button className="flex-1" onClick={acceptQuote} disabled={accepted || accepting} data-testid="accept-quote-btn">
            {accepting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : accepted ? <CheckCircle2 className="w-4 h-4 mr-2" /> : null}
            {accepted ? "Itinerary Approved" : "Approve Itinerary"}
          </Button>
          <Button variant="outline" asChild>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${data.brand} — ${data.destination} proposal: ${typeof window !== "undefined" ? window.location.href : ""}`)}`}
              target="_blank" rel="noopener noreferrer" data-testid="share-whatsapp-btn"
            >
              <Share2 className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Share</span>
            </a>
          </Button>
          <Button variant="outline" onClick={downloadPdf} data-testid="download-pdf-btn">
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
