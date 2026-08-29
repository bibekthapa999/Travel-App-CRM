import secrets
import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user, require_roles
from database import db

router = APIRouter(prefix="/api/itineraries", tags=["itineraries"])
share_router = APIRouter(prefix="/api/share", tags=["share"])

MEAL_LABELS = {"cp": "Breakfast only (CP)", "map": "Breakfast + Dinner (MAP)", "ap": "All meals (AP)"}


def _rs(x) -> str:
    return f"Rs.{int(float(x or 0) + 0.5):,}"


def _f(v) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


async def compute_costing(payload: dict) -> dict:
    days = payload.get("days") or []
    start = None
    if payload.get("start_date"):
        try:
            start = date.fromisoformat(payload["start_date"])
        except ValueError:
            start = None
    hotel_cost = transport_cost = activity_cost = 0.0
    hotel_cache, vehicle_cache = {}, {}
    for d in days:
        day_date = start + timedelta(days=int(d.get("day", 1)) - 1) if start else None
        hid = d.get("hotel_id") or ""
        if hid:
            if hid not in hotel_cache:
                hotel_cache[hid] = await db.hotels.find_one({"id": hid}, {"_id": 0})
            hotel = hotel_cache[hid]
            if hotel:
                room = next((r for r in hotel.get("rooms", []) if r.get("category") == d.get("room_category")), None)
                if room:
                    rate = _f(room.get(d.get("meal_plan") or "cp"))
                    mult = 1.0
                    for s in hotel.get("seasons", []):
                        try:
                            if day_date and date.fromisoformat(s["start"]) <= day_date <= date.fromisoformat(s["end"]):
                                mult = max(mult, 1 + _f(s.get("surcharge_pct")) / 100)
                        except (ValueError, KeyError):
                            continue
                    hotel_cost += rate * mult
        vid = d.get("vehicle_id") or ""
        if vid:
            if vid not in vehicle_cache:
                vehicle_cache[vid] = await db.vehicles.find_one({"id": vid}, {"_id": 0})
            vehicle = vehicle_cache[vid]
            if vehicle:
                transport_cost += _f(vehicle.get("per_day_rate")) + _f(vehicle.get("driver_charge"))
        activity_cost += _f(d.get("activity_cost"))
    pricing = payload.get("pricing") or {}
    base = hotel_cost + transport_cost + activity_cost
    margin = base * _f(pricing.get("margin_pct", 25)) / 100
    discount = _f(pricing.get("discount"))
    subtotal = max(base + margin - discount, 0)
    tax = subtotal * _f(pricing.get("gst_pct", 5)) / 100 if pricing.get("gst_enabled", True) else 0.0
    total = subtotal + tax
    pax = max(int(payload.get("pax") or 2), 1)
    r = lambda x: round(x, 2)
    return {
        "hotel_cost": r(hotel_cost),
        "transport_cost": r(transport_cost),
        "activity_cost": r(activity_cost),
        "base_cost": r(base),
        "margin_amount": r(margin),
        "discount": r(discount),
        "subtotal": r(subtotal),
        "tax_amount": r(tax),
        "total": r(total),
        "per_person": r(total / pax),
    }


FIELDS = {"title", "customer_name", "customer_email", "customer_phone", "destination", "start_date", "pax", "days", "pricing", "lead_id", "notes"}


@router.get("")
async def list_itineraries(search: str = "", user: dict = Depends(get_current_user)):
    q = {}
    if search:
        q["$or"] = [{"title": {"$regex": search, "$options": "i"}}, {"customer_name": {"$regex": search, "$options": "i"}}, {"destination": {"$regex": search, "$options": "i"}}]
    return await db.itineraries.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("/preview-cost")
async def preview_cost(payload: dict, user: dict = Depends(get_current_user)):
    return await compute_costing(payload)


@router.post("")
async def create_itinerary(payload: dict, user: dict = Depends(require_roles("admin", "sales"))):
    doc = {k: payload.get(k) for k in FIELDS if k in payload}
    if not (doc.get("title") or "").strip():
        doc["title"] = f"{doc.get('destination', 'Trip')} — {doc.get('customer_name', 'Customer')}"
    doc.setdefault("days", [])
    doc.setdefault("pricing", {"margin_pct": 25, "gst_enabled": True, "gst_pct": 5, "discount": 0})
    for i, d in enumerate(doc["days"]):
        d["day"] = i + 1
    doc.update(
        id=str(uuid.uuid4()),
        share_token=secrets.token_urlsafe(8),
        created_by=user["id"],
        created_at=datetime.now(timezone.utc).isoformat(),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    doc["costing"] = await compute_costing(doc)
    await db.itineraries.insert_one({**doc})
    if doc.get("lead_id"):
        await db.leads.update_one({"id": doc["lead_id"]}, {"$set": {"status": "proposal_sent", "updated_at": doc["updated_at"]}})
    return doc


@router.get("/{itin_id}")
async def get_itinerary(itin_id: str, user: dict = Depends(get_current_user)):
    itin = await db.itineraries.find_one({"id": itin_id}, {"_id": 0})
    if not itin:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    return itin


@router.patch("/{itin_id}")
async def update_itinerary(itin_id: str, payload: dict, user: dict = Depends(require_roles("admin", "sales"))):
    itin = await db.itineraries.find_one({"id": itin_id}, {"_id": 0})
    if not itin:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    updates = {k: v for k, v in payload.items() if k in FIELDS}
    merged = {**itin, **updates}
    for i, d in enumerate(merged.get("days", [])):
        d["day"] = i + 1
    updates["costing"] = await compute_costing(merged)
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.itineraries.update_one({"id": itin_id}, {"$set": updates})
    return await db.itineraries.find_one({"id": itin_id}, {"_id": 0})


@router.delete("/{itin_id}")
async def delete_itinerary(itin_id: str, user: dict = Depends(require_roles("admin", "sales"))):
    await db.itineraries.delete_one({"id": itin_id})
    orphan_bookings = await db.bookings.find({"itinerary_id": itin_id}, {"id": 1}).to_list(200)
    booking_ids = [b["id"] for b in orphan_bookings]
    if booking_ids:
        await db.invoices.delete_many({"booking_id": {"$in": booking_ids}})
        await db.bookings.delete_many({"id": {"$in": booking_ids}})
    return {"status": "ok", "cascade_deleted": len(booking_ids)}


@router.get("/{itin_id}/message")
async def itinerary_message(itin_id: str, user: dict = Depends(get_current_user)):
    itin = await db.itineraries.find_one({"id": itin_id}, {"_id": 0})
    if not itin:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    import os

    share_url = f"{os.environ.get('FRONTEND_URL', '')}/share/{itin['share_token']}"
    c = itin.get("costing", {})
    lines = [
        f"*Thapa Holidays — Travel Proposal*",
        f"Hi {itin.get('customer_name', '')}, here is your personalised itinerary:",
        f"",
        f"Destination: {itin.get('destination', '')}",
        f"Travel date: {itin.get('start_date', '')} | {len(itin.get('days', []))} days | {itin.get('pax', 2)} travellers",
        f"Package price: {_rs(c.get('total'))} ({_rs(c.get('per_person'))} per person)",
        f"",
        f"View full proposal: {share_url}",
        f"",
        f"Reply to this message to confirm or request changes.",
    ]
    return {"text": "\n".join(lines), "share_url": share_url, "phone": itin.get("customer_phone", "")}


async def _resolve_day(day: dict) -> dict:
    out = {
        "day": day.get("day"),
        "title": day.get("title", ""),
        "description": day.get("description", ""),
        "activities": day.get("activities", ""),
        "hotel_name": "",
        "room_category": day.get("room_category", ""),
        "meal_plan": MEAL_LABELS.get(day.get("meal_plan"), ""),
        "vehicle_label": "",
    }
    if day.get("hotel_id"):
        hotel = await db.hotels.find_one({"id": day["hotel_id"]}, {"_id": 0})
        if hotel:
            out["hotel_name"] = hotel.get("name", "")
    if day.get("vehicle_id"):
        vehicle = await db.vehicles.find_one({"id": day["vehicle_id"]}, {"_id": 0})
        if vehicle:
            out["vehicle_label"] = f"{vehicle.get('vehicle_type', '')} — {vehicle.get('vendor_name', '')}"
    return out


@share_router.get("/{token}")
async def public_share(token: str):
    itin = await db.itineraries.find_one({"share_token": token}, {"_id": 0})
    if not itin:
        raise HTTPException(status_code=404, detail="Proposal not found")
    days = [await _resolve_day(d) for d in itin.get("days", [])]
    c = itin.get("costing", {})
    return {
        "title": itin.get("title", ""),
        "customer_name": itin.get("customer_name", ""),
        "destination": itin.get("destination", ""),
        "start_date": itin.get("start_date", ""),
        "pax": itin.get("pax", 2),
        "days": days,
        "total": c.get("total", 0),
        "per_person": c.get("per_person", 0),
        "brand": "Thapa Holidays",
    }
