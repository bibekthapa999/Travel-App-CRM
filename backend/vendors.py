import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException

from auth import get_current_user, require_roles
from database import db

hotels_router = APIRouter(prefix="/api/hotels", tags=["hotels"])
vehicles_router = APIRouter(prefix="/api/vehicles", tags=["vehicles"])

HOTEL_FIELDS = {"name", "destination", "star", "contact_name", "phone", "email", "rooms", "seasons", "active", "image_url"}
VEHICLE_FIELDS = {"vendor_name", "vehicle_type", "route_from", "route_to", "per_day_rate", "driver_charge", "phone", "email", "active"}


@hotels_router.get("")
async def list_hotels(search: str = "", user: dict = Depends(get_current_user)):
    q = {}
    if search:
        q["$or"] = [{"name": {"$regex": search, "$options": "i"}}, {"destination": {"$regex": search, "$options": "i"}}]
    return await db.hotels.find(q, {"_id": 0}).sort("name", 1).to_list(500)


@hotels_router.post("")
async def create_hotel(payload: dict = Body(...), user: dict = Depends(require_roles("admin", "operations"))):
    if not (payload.get("name") or "").strip():
        raise HTTPException(status_code=400, detail="Hotel name is required")
    doc = {k: payload.get(k) for k in HOTEL_FIELDS if k in payload}
    doc.setdefault("rooms", [])
    doc.setdefault("seasons", [])
    doc.setdefault("active", True)
    doc.update(id=str(uuid.uuid4()), created_at=datetime.now(timezone.utc).isoformat())
    await db.hotels.insert_one({**doc})
    return doc


@hotels_router.patch("/{hotel_id}")
async def update_hotel(hotel_id: str, payload: dict = Body(...), user: dict = Depends(require_roles("admin", "operations"))):
    updates = {k: v for k, v in payload.items() if k in HOTEL_FIELDS}
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")
    await db.hotels.update_one({"id": hotel_id}, {"$set": updates})
    hotel = await db.hotels.find_one({"id": hotel_id}, {"_id": 0})
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
    return hotel


@hotels_router.delete("/{hotel_id}")
async def delete_hotel(hotel_id: str, user: dict = Depends(require_roles("admin", "operations"))):
    await db.hotels.delete_one({"id": hotel_id})
    return {"status": "ok"}


@vehicles_router.get("")
async def list_vehicles(search: str = "", user: dict = Depends(get_current_user)):
    q = {}
    if search:
        q["$or"] = [{"vendor_name": {"$regex": search, "$options": "i"}}, {"route_from": {"$regex": search, "$options": "i"}}, {"route_to": {"$regex": search, "$options": "i"}}]
    return await db.vehicles.find(q, {"_id": 0}).sort("vendor_name", 1).to_list(500)


@vehicles_router.post("")
async def create_vehicle(payload: dict = Body(...), user: dict = Depends(require_roles("admin", "operations"))):
    if not (payload.get("vendor_name") or "").strip():
        raise HTTPException(status_code=400, detail="Vendor name is required")
    doc = {k: payload.get(k) for k in VEHICLE_FIELDS if k in payload}
    doc.setdefault("active", True)
    doc.update(id=str(uuid.uuid4()), created_at=datetime.now(timezone.utc).isoformat())
    await db.vehicles.insert_one({**doc})
    return doc


@vehicles_router.patch("/{vehicle_id}")
async def update_vehicle(vehicle_id: str, payload: dict = Body(...), user: dict = Depends(require_roles("admin", "operations"))):
    updates = {k: v for k, v in payload.items() if k in VEHICLE_FIELDS}
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")
    await db.vehicles.update_one({"id": vehicle_id}, {"$set": updates})
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle


@vehicles_router.delete("/{vehicle_id}")
async def delete_vehicle(vehicle_id: str, user: dict = Depends(require_roles("admin", "operations"))):
    await db.vehicles.delete_one({"id": vehicle_id})
    return {"status": "ok"}
