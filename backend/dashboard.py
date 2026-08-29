from datetime import date

from fastapi import APIRouter, Depends

from auth import get_current_user
from database import db

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
async def stats(user: dict = Depends(get_current_user)):
    leads = await db.leads.find({}, {"_id": 0, "status": 1, "budget": 1}).to_list(2000)
    by_status = {s: 0 for s in ["new", "contacted", "proposal_sent", "negotiation", "won", "lost"]}
    pipeline_value = 0.0
    for lead in leads:
        by_status[lead.get("status", "new")] = by_status.get(lead.get("status", "new"), 0) + 1
        if lead.get("status") not in ("won", "lost"):
            pipeline_value += float(lead.get("budget") or 0)

    bookings = await db.bookings.find({}, {"_id": 0}).to_list(1000)
    invoices = await db.invoices.find({}, {"_id": 0, "total": 1, "paid": 1}).to_list(1000)

    revenue = sum(float(i.get("total") or 0) for i in invoices)
    collected = sum(float(i.get("paid") or 0) for i in invoices)
    profit = sum(float(b.get("profit") or 0) for b in bookings)
    pending_vendor = sum(1 for b in bookings for c in b.get("vendor_confirmations", []) if c.get("status") == "pending")

    today = date.today().isoformat()
    upcoming = sorted(
        [b for b in bookings if (b.get("start_date") or "9999") >= today],
        key=lambda b: b.get("start_date") or "",
    )[:5]
    recent_leads = await db.leads.find({}, {"_id": 0}).sort("created_at", -1).to_list(5)

    return {
        "total_leads": len(leads),
        "leads_by_status": by_status,
        "pipeline_value": round(pipeline_value, 2),
        "bookings_count": len(bookings),
        "revenue": round(revenue, 2),
        "collected": round(collected, 2),
        "outstanding": round(revenue - collected, 2),
        "profit": round(profit, 2),
        "pending_vendor_confirmations": pending_vendor,
        "upcoming_departures": [
            {"booking_no": b["booking_no"], "customer_name": b.get("customer_name", ""), "destination": b.get("destination", ""), "start_date": b.get("start_date", ""), "pax": b.get("pax", 2)}
            for b in upcoming
        ],
        "recent_leads": recent_leads,
    }
