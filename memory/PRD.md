# PRD — Thapa Holidays Travel CRM

## Original Problem Statement
Production-ready Travel CRM web app with: Omni-Channel Sharing Engine (one-click WhatsApp/Email share of itineraries, vouchers, invoices; mobile-friendly share links; PDF), Leads Kanban (New → Contacted → Proposal Sent → Negotiation → Won/Lost) with auto welcome messages, Vendor & Inventory masters (hotels with room categories, meal plans CP/MAP/AP, seasonal pricing; vehicles with routes, per-day + driver rates), Automated Itinerary Builder & Rate Calculator (auto-costing, margin slider, GST toggle, discount), Automated Bookings & Vendor Confirmations (vendor vouchers, Pending/Confirmed/Rejected tracker), Invoices & Payments (split schedules, reminders, receipts, profitability dashboard), RBAC (Admin, Sales, Operations, Finance).

## User Choices
- JWT custom auth (chosen). WhatsApp: click-to-WhatsApp wa.me deep links (default, no Meta API keys). Email: Emergent-managed Resend (default). Stack: React + FastAPI + MongoDB (environment default). Scope: full MVP (default).

## Architecture
- Backend: FastAPI modular routers — auth.py (JWT cookies, RBAC, brute-force lockout), emailer.py (managed Resend proxy + guardrail gate + server-side templates), leads.py, vendors.py (hotels/vehicles), itineraries.py (costing engine + public share), bookings.py (vendor confirmations), invoices.py (splits/payments), dashboard.py (KPIs). MongoDB via motor, uuid string ids.
- Frontend: React 19 + Tailwind + Shadcn, Outfit/Inter typography, Swiss high-contrast light/dark theme, collapsible sidebar, Kanban with HTML5 drag-drop, live cost calculator, ShareModal (WhatsApp/Email/Link tabs), public /share/:token proposal page with print-to-PDF.

## User Personas
- Admin (owner): full access incl. team management
- Sales Agent: leads, itineraries, bookings
- Operations: vendors, bookings/vendor confirmations
- Finance: invoices, payments

## Implemented (2026-08-29)
- JWT auth (httpOnly cookies, refresh, lockout), admin + 3 role users seeded
- Leads Kanban + CRUD + auto welcome email on creation + WhatsApp quick message
- Hotels master (rooms with CP/MAP/AP rates, seasonal surcharges) + Vehicles master
- Itinerary builder: day-by-day hotels/vehicles/activities, live costing (margin slider, GST toggle, discount), per-person pricing
- Public mobile share link /share/:token + WhatsApp pre-formatted messages + email proposal templates
- Bookings from itineraries with auto-generated vendor confirmations (hotel/vehicle), vendor request via WhatsApp/email, status tracker
- Invoices with 30/70 split schedule, payment recording, receipts/reminders, profitability on bookings
- Dashboard KPIs (pipeline value, revenue, collected, outstanding, profit, pending vendor confirms) + upcoming departures + recent leads
- Team/user management (admin)

## Implemented (2026-08-29, round 2 — fixes)
- Email provider error propagation + visible error states; deliverable seed vendor emails; X-Forwarded-For brute-force keying; anchor-based WhatsApp CTAs; itinerary cascade delete; payment prefill/over-payment guard; invoice auto-select; due-date clamping

## Implemented (2026-08-29, round 3 — enhancements)
- Dynamic Route Master (CRUD + lookup): per-day From/To selects auto-fetch rich default route descriptions into a WYSIWYG editor (RichTextEditor, contentEditable toolbar)
- Advanced Hotel Costing Matrix: rooms carry CP/MAP/AP double base + single occupancy + Extra Bed (adult) + CWB + CNB; auto-costing factors headcount (adults/CWB/CNB): pairs × double + odd adult extra bed + children add-ons; per-person over total travellers
- Terms & Policies master (Settings): rich-text templates; mandatory 5-block terms section in builder (enforced client + server side); template loader; privacy disclaimer on lead form (exact copy)
- Sector-specific branding: admin uploads header/footer banners per sector (base64, validated server-side); share view auto-injects by destination/sector match
- Premium magazine-style guest view /share/:token: sector banner, full-bleed hero (route image preferred), editorial timeline with image grids + rich text, pricing card, policies accordions, sticky mobile action bar (Accept Quote → accepted + lead won; Download PDF via print; Chat on WhatsApp to company number)
- Company WhatsApp setting; bleach-based HTML sanitization at write + share time (XSS protection)

## Implemented (2026-08-29, round 4 — advanced routing & guest UI v2)
- Route Master upgraded with Via (en-route stop), Excursion (day trip), and Day Title fields; lookup scores From+To+Via / Base+Excursion combos and always returns an auto-generated day title (e.g. "Transfer to Pelling via Ravangla Sightseeing", "Full Day Excursion to Tsomgo Lake & Baba Mandir"); seeded combo routes
- Builder: per-day routing type select (Transfer / Transfer via stop / Day excursion) with conditional From/To/Via/Excursion selects; auto-fetches day title + rich description into editable fields
- Guest view v2: day dates + via/excursion map-pin badges, "Your Hotels" stay cards (image, room, meal plan, check-in/out, nights), transparent price-breakdown table (accommodation, extra bed/CWB/CNB lines, transport, activities, services & handling, GST — sums exactly to total), sticky bar with Approve Itinerary / Share to WhatsApp / Download PDF / Chat
- Costing engine now tracks extra_bed/cwb/cnb cost components

## Backlog
- P0: (none pending)
- P1: WhatsApp Business Cloud API interactive messages (needs Meta credentials); true PDF generation via @react-pdf/renderer (currently print-to-PDF); editable email body composer (blocked by managed-email G4 guardrails — currently fixed templates); move branding banners to object storage (currently base64 in Mongo)
- P2: Lead assignment to agents, activity timeline per lead, multi-currency, booking calendar view, password-reset UI (backend endpoints exist), shadcn Calendar date pickers (currently native date inputs), booking/invoice re-sync when a linked itinerary is edited (currently snapshot at creation), migrate RichTextEditor to Tiptap/Lexical
