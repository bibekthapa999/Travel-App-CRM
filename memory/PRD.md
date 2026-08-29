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

## Backlog
- P0: (none pending)
- P1: WhatsApp Business Cloud API interactive messages (needs Meta credentials); true PDF generation via @react-pdf/renderer (currently print-to-PDF); editable email body composer (blocked by managed-email G4 guardrails — currently fixed templates)
- P2: Lead assignment to agents, activity timeline per lead, multi-currency, booking calendar view, password-reset UI (backend endpoints exist), shadcn Calendar date pickers (currently native date inputs), booking/invoice re-sync when a linked itinerary is edited (currently snapshot at creation)
