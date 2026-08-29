import secrets
import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user, require_roles
from database import db
from htmlutil import sanitize_html
from settings_routes import get_company, match_branding

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
    extra_bed_total = cwb_total = cnb_total = 0.0
    hotel_cache, vehicle_cache = {}, {}
    raw_adults = payload.get("adults")
    adults = int(raw_adults) if raw_adults not in (None, "") else int(payload.get("pax") or 2)
    cwb_n = int(payload.get("cwb") or 0)
    cnb_n = int(payload.get("cnb") or 0)
    if adults < 1 or cwb_n < 0 or cnb_n < 0:
        raise HTTPException(status_code=400, detail="Invalid headcount: adults must be at least 1, children counts cannot be negative")
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
                    double_rate = _f(room.get(d.get("meal_plan") or "cp"))
                    pairs, rem = divmod(max(adults, 1), 2)
                    if adults <= 1:
                        occ = _f(room.get("single_rate")) or double_rate
                        extra = cb = cn = 0.0
                    else:
                        occ = pairs * double_rate
                        extra = _f(room.get("extra_bed_adult")) if rem else 0.0
                        occ += extra
                        cb = cwb_n * _f(room.get("cwb"))
                        cn = cnb_n * _f(room.get("cnb"))
                        occ += cb + cn
                    mult = 1.0
                    for s in hotel.get("seasons", []):
                        try:
                            if day_date and date.fromisoformat(s["start"]) <= day_date <= date.fromisoformat(s["end"]):
                                mult = max(mult, 1 + _f(s.get("surcharge_pct")) / 100)
                        except (ValueError, KeyError):
                            continue
                    hotel_cost += occ * mult
                    extra_bed_total += extra * mult
                    cwb_total += cb * mult
                    cnb_total += cn * mult
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
    travellers = max(adults + cwb_n + cnb_n, 1)
    r = lambda x: round(x, 2)
    return {
        "hotel_cost": r(hotel_cost),
        "extra_bed_cost": r(extra_bed_total),
        "cwb_cost": r(cwb_total),
        "cnb_cost": r(cnb_total),
        "transport_cost": r(transport_cost),
        "activity_cost": r(activity_cost),
        "base_cost": r(base),
        "margin_amount": r(margin),
        "discount": r(discount),
        "subtotal": r(subtotal),
        "tax_amount": r(tax),
        "total": r(total),
        "per_person": r(total / travellers),
    }


FIELDS = {"title", "customer_name", "customer_email", "customer_phone", "destination", "start_date", "pax", "adults", "cwb", "cnb", "days", "pricing", "lead_id", "notes", "terms"}

TERM_KEYS = ("inclusions", "exclusions", "payment_policy", "cancellation_policy", "important_notes")


def sanitize_payload(doc: dict) -> dict:
    for d in doc.get("days") or []:
        d["description"] = sanitize_html(d.get("description", ""))
    if "terms" in doc:
        terms = doc.get("terms") or {}
        doc["terms"] = {k: sanitize_html(terms.get(k, "")) for k in TERM_KEYS}
    return doc


def validate_terms(doc: dict):
    terms = doc.get("terms") or {}
    missing = [k.replace("_", " ") for k in TERM_KEYS if not sanitize_html(terms.get(k, "")).replace("<br>", "").strip()]
    if missing:
        raise HTTPException(status_code=400, detail=f"Terms section is mandatory — missing: {', '.join(missing)}")


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
    doc = sanitize_payload(doc)
    validate_terms(doc)
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
    merged = sanitize_payload(merged)
    validate_terms(merged)
    for i, d in enumerate(merged.get("days", [])):
        d["day"] = i + 1
    updates = {k: merged[k] for k in updates}
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
        "from_place": day.get("from_place", ""),
        "to_place": day.get("to_place", ""),
        "via": day.get("via", ""),
        "excursion": day.get("excursion", ""),
        "route_type": day.get("route_type", "transfer"),
        "hotel_name": "",
        "room_category": day.get("room_category", ""),
        "meal_plan": MEAL_LABELS.get(day.get("meal_plan"), ""),
        "vehicle_label": "",
        "images": [],
    }
    if day.get("from_place") and day.get("to_place"):
        route = await db.routes.find_one(
            {
                "from_place": {"$regex": f"^{day['from_place']}$", "$options": "i"},
                "to_place": {"$regex": f"^{day['to_place']}$", "$options": "i"},
            },
            {"_id": 0},
        )
        if route and route.get("image_url"):
            out["images"].append(route["image_url"])
    if day.get("hotel_id"):
        hotel = await db.hotels.find_one({"id": day["hotel_id"]}, {"_id": 0})
        if hotel:
            out["hotel_name"] = hotel.get("name", "")
            if hotel.get("image_url"):
                out["images"].append(hotel["image_url"])
    if day.get("vehicle_id"):
        vehicle = await db.vehicles.find_one({"id": day["vehicle_id"]}, {"_id": 0})
        if vehicle:
            out["vehicle_label"] = f"{vehicle.get('vehicle_type', '')} — {vehicle.get('vendor_name', '')}"
    out["description"] = sanitize_html(out["description"])
    return out


def _price_breakdown(c: dict) -> list:
    rows = []
    extras = sum(c.get(k) or 0 for k in ("extra_bed_cost", "cwb_cost", "cnb_cost"))
    room_only = round((c.get("hotel_cost") or 0) - extras, 2)
    if room_only:
        rows.append({"label": "Accommodation (double occupancy, selected meal plans)", "amount": room_only})
    for key, label in (("extra_bed_cost", "Extra bed — adult"), ("cwb_cost", "Child with bed (CWB)"), ("cnb_cost", "Child without bed (CNB)")):
        if c.get(key):
            rows.append({"label": label, "amount": c[key]})
    if c.get("transport_cost"):
        rows.append({"label": "Private transport & driver", "amount": c["transport_cost"]})
    if c.get("activity_cost"):
        rows.append({"label": "Activities & experiences", "amount": c["activity_cost"]})
    service = round(c.get("margin_amount", 0) - c.get("discount", 0), 2)
    if service:
        rows.append({"label": "Tour services & handling" if service > 0 else "Special discount", "amount": service})
    if c.get("tax_amount"):
        rows.append({"label": "GST", "amount": c["tax_amount"]})
    return rows


def _compute_stays(itin: dict, resolved_days: list) -> list:
    try:
        start = date.fromisoformat(itin.get("start_date", ""))
    except ValueError:
        start = None
    stays = []
    for d in resolved_days:
        if not d.get("hotel_name"):
            continue
        idx = int(d.get("day") or 1) - 1
        if stays and stays[-1]["hotel_name"] == d["hotel_name"]:
            stays[-1]["nights"] += 1
            if start:
                stays[-1]["check_out"] = (start + timedelta(days=idx + 1)).isoformat()
        else:
            stays.append({
                "hotel_name": d["hotel_name"],
                "image_url": d["images"][0] if d.get("images") else "",
                "room_category": d.get("room_category", ""),
                "meal_plan": d.get("meal_plan", ""),
                "nights": 1,
                "check_in": (start + timedelta(days=idx)).isoformat() if start else "",
                "check_out": (start + timedelta(days=idx + 1)).isoformat() if start else "",
            })
    return stays


@share_router.get("/{token}")
async def public_share(token: str):
    itin = await db.itineraries.find_one({"share_token": token}, {"_id": 0})
    if not itin:
        raise HTTPException(status_code=404, detail="Proposal not found")
    days = [await _resolve_day(d) for d in itin.get("days", [])]
    c = itin.get("costing", {})
    branding = await match_branding(itin.get("destination", ""))
    company = await get_company()
    hero_image = next((img for d in days for img in d.get("images", [])), "")
    return {
        "title": itin.get("title", ""),
        "customer_name": itin.get("customer_name", ""),
        "destination": itin.get("destination", ""),
        "start_date": itin.get("start_date", ""),
        "pax": itin.get("pax", 2),
        "adults": itin.get("adults") or itin.get("pax", 2),
        "cwb": itin.get("cwb", 0),
        "cnb": itin.get("cnb", 0),
        "days": days,
        "total": c.get("total", 0),
        "per_person": c.get("per_person", 0),
        "price_breakdown": _price_breakdown(c),
        "stays": _compute_stays(itin, days),
        "terms": {k: sanitize_html(v) for k, v in (itin.get("terms") or {}).items()},
        "accepted": itin.get("accepted", False),
        "header_banner": branding.get("header_banner", ""),
        "footer_banner": branding.get("footer_banner", ""),
        "sector": branding.get("sector", ""),
        "hero_image": hero_image,
        "company_whatsapp": company.get("whatsapp", ""),
        "brand": "Thapa Holidays",
    }


@share_router.post("/{token}/accept")
async def accept_quote(token: str):
    itin = await db.itineraries.find_one({"share_token": token})
    if not itin:
        raise HTTPException(status_code=404, detail="Proposal not found")
    now = datetime.now(timezone.utc).isoformat()
    await db.itineraries.update_one({"id": itin["id"]}, {"$set": {"accepted": True, "accepted_at": now}})
    if itin.get("lead_id"):
        await db.leads.update_one({"id": itin["lead_id"]}, {"$set": {"status": "won", "updated_at": now}})
    return {"status": "accepted"}
