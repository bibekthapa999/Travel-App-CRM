import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_current_user, require_roles
from database import db, next_seq

router = APIRouter(prefix="/api/bookings", tags=["bookings"])

BOOKING_ROLES = ("admin", "sales", "operations")


def _rs(x) -> str:
    return f"Rs.{int(float(x or 0) + 0.5):,}"


class BookingIn(BaseModel):
    itinerary_id: str
    lead_id: Optional[str] = ""


@router.get("")
async def list_bookings(user: dict = Depends(get_current_user)):
    return await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("")
async def create_booking(data: BookingIn, user: dict = Depends(require_roles("admin", "sales"))):
    itin = await db.itineraries.find_one({"id": data.itinerary_id}, {"_id": 0})
    if not itin:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    if await db.bookings.find_one({"itinerary_id": data.itinerary_id}):
        raise HTTPException(status_code=400, detail="A booking already exists for this itinerary")
    confs = []
    seen_hotels, seen_vehicles = set(), set()
    for d in itin.get("days", []):
        hid = d.get("hotel_id") or ""
        if hid and hid not in seen_hotels:
            seen_hotels.add(hid)
            hotel = await db.hotels.find_one({"id": hid}, {"_id": 0})
            if hotel:
                confs.append({
                    "id": str(uuid.uuid4()),
                    "vendor_type": "hotel",
                    "ref_id": hid,
                    "vendor_name": hotel.get("name", ""),
                    "phone": hotel.get("phone", ""),
                    "email": hotel.get("email", ""),
                    "detail": f"{d.get('room_category', '')} room, {d.get('meal_plan', 'CP').upper()} plan, {sum(1 for x in itin['days'] if x.get('hotel_id') == hid)} night(s)",
                    "status": "pending",
                })
        vid = d.get("vehicle_id") or ""
        if vid and vid not in seen_vehicles:
            seen_vehicles.add(vid)
            vehicle = await db.vehicles.find_one({"id": vid}, {"_id": 0})
            if vehicle:
                confs.append({
                    "id": str(uuid.uuid4()),
                    "vendor_type": "vehicle",
                    "ref_id": vid,
                    "vendor_name": vehicle.get("vendor_name", ""),
                    "phone": vehicle.get("phone", ""),
                    "email": vehicle.get("email", ""),
                    "detail": f"{vehicle.get('vehicle_type', '')}, {vehicle.get('route_from', '')} to {vehicle.get('route_to', '')}, {sum(1 for x in itin['days'] if x.get('vehicle_id') == vid)} day(s)",
                    "status": "pending",
                })
    seq = await next_seq("booking")
    now = datetime.now(timezone.utc).isoformat()
    c = itin.get("costing", {})
    doc = {
        "id": str(uuid.uuid4()),
        "booking_no": f"BK-{seq:04d}",
        "itinerary_id": itin["id"],
        "lead_id": data.lead_id or itin.get("lead_id") or "",
        "customer_name": itin.get("customer_name", ""),
        "customer_email": itin.get("customer_email", ""),
        "customer_phone": itin.get("customer_phone", ""),
        "destination": itin.get("destination", ""),
        "start_date": itin.get("start_date", ""),
        "pax": itin.get("pax", 2),
        "num_days": len(itin.get("days", [])),
        "total": c.get("total", 0),
        "cost": c.get("base_cost", 0),
        "profit": round(c.get("margin_amount", 0) - c.get("discount", 0), 2),
        "status": "confirmed",
        "vendor_confirmations": confs,
        "created_by": user["id"],
        "created_at": now,
    }
    await db.bookings.insert_one({**doc})
    if doc["lead_id"]:
        await db.leads.update_one({"id": doc["lead_id"]}, {"$set": {"status": "won", "updated_at": now}})
    return doc


@router.get("/{booking_id}")
async def get_booking(booking_id: str, user: dict = Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking


@router.patch("/{booking_id}/vendors/{conf_id}")
async def update_vendor_status(booking_id: str, conf_id: str, payload: dict, user: dict = Depends(require_roles(*BOOKING_ROLES))):
    status = payload.get("status")
    if status not in ("pending", "confirmed", "rejected"):
        raise HTTPException(status_code=400, detail="Invalid status")
    result = await db.bookings.update_one(
        {"id": booking_id, "vendor_confirmations.id": conf_id},
        {"$set": {"vendor_confirmations.$.status": status}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking or vendor confirmation not found")
    return await db.bookings.find_one({"id": booking_id}, {"_id": 0})


@router.get("/{booking_id}/message")
async def booking_message(booking_id: str, user: dict = Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    lines = [
        "*Thapa Holidays — Booking Confirmed*",
        f"Hi {booking.get('customer_name', '')}, your booking {booking['booking_no']} is confirmed!",
        "",
        f"Destination: {booking.get('destination', '')}",
        f"Travel date: {booking.get('start_date', '')} | {booking.get('num_days', 0)} days | {booking.get('pax', 2)} travellers",
        f"Package value: {_rs(booking.get('total'))}",
        "",
        "Your hotel and transport vouchers will follow shortly. Have a great trip!",
    ]
    return {"text": "\n".join(lines), "phone": booking.get("customer_phone", "")}


@router.get("/{booking_id}/vendors/{conf_id}/message")
async def vendor_message(booking_id: str, conf_id: str, user: dict = Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    conf = next((c for c in booking.get("vendor_confirmations", []) if c["id"] == conf_id), None)
    if not conf:
        raise HTTPException(status_code=404, detail="Vendor confirmation not found")
    lines = [
        "*Thapa Holidays — Booking Request*",
        f"Dear {conf.get('vendor_name', 'Partner')},",
        "",
        "Please confirm availability:",
        f"Booking ref: {booking['booking_no']}",
        f"Guest: {booking.get('customer_name', '')} ({booking.get('pax', 2)} pax)",
        f"Date: {booking.get('start_date', '')}",
        f"Details: {conf.get('detail', '')}",
        "",
        "Kindly reply CONFIRMED or share alternate options.",
    ]
    return {"text": "\n".join(lines), "phone": conf.get("phone", "")}
