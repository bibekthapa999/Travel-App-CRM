import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException

from auth import get_current_user, require_roles
from database import db
from htmlutil import sanitize_html

routes_router = APIRouter(prefix="/api/routes", tags=["routes"])
settings_router = APIRouter(prefix="/api/settings", tags=["settings"])

ROUTE_FIELDS = {"from_place", "to_place", "description", "image_url"}
TERM_FIELDS = {"name", "inclusions", "exclusions", "payment_policy", "cancellation_policy", "important_notes"}


# --- Route Master ---

@routes_router.get("")
async def list_routes(user: dict = Depends(get_current_user)):
    return await db.routes.find({}, {"_id": 0}).sort("from_place", 1).to_list(500)


@routes_router.get("/lookup")
async def lookup_route(from_place: str = "", to_place: str = "", user: dict = Depends(get_current_user)):
    if not from_place or not to_place:
        raise HTTPException(status_code=400, detail="from_place and to_place are required")
    route = await db.routes.find_one(
        {
            "from_place": {"$regex": f"^{from_place}$", "$options": "i"},
            "to_place": {"$regex": f"^{to_place}$", "$options": "i"},
        },
        {"_id": 0},
    )
    if not route:
        return {"found": False, "description": "", "image_url": ""}
    return {"found": True, "description": route.get("description", ""), "image_url": route.get("image_url", "")}


@routes_router.post("")
async def create_route(payload: dict = Body(...), user: dict = Depends(require_roles("admin", "operations"))):
    if not (payload.get("from_place") or "").strip() or not (payload.get("to_place") or "").strip():
        raise HTTPException(status_code=400, detail="From and To are required")
    doc = {k: payload.get(k) for k in ROUTE_FIELDS if k in payload}
    doc.setdefault("description", "")
    doc["description"] = sanitize_html(doc["description"])
    doc.setdefault("image_url", "")
    doc.update(id=str(uuid.uuid4()), created_at=datetime.now(timezone.utc).isoformat())
    await db.routes.insert_one({**doc})
    return doc


@routes_router.patch("/{route_id}")
async def update_route(route_id: str, payload: dict = Body(...), user: dict = Depends(require_roles("admin", "operations"))):
    updates = {k: v for k, v in payload.items() if k in ROUTE_FIELDS}
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")
    if "description" in updates:
        updates["description"] = sanitize_html(updates["description"])
    await db.routes.update_one({"id": route_id}, {"$set": updates})
    route = await db.routes.find_one({"id": route_id}, {"_id": 0})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    return route


@routes_router.delete("/{route_id}")
async def delete_route(route_id: str, user: dict = Depends(require_roles("admin", "operations"))):
    result = await db.routes.delete_one({"id": route_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Route not found")
    return {"status": "ok"}


# --- Terms & Policies Templates ---

@settings_router.get("/terms")
async def list_terms(user: dict = Depends(get_current_user)):
    return await db.terms_templates.find({}, {"_id": 0}).sort("name", 1).to_list(100)


@settings_router.post("/terms")
async def create_terms(payload: dict = Body(...), user: dict = Depends(require_roles("admin"))):
    if not (payload.get("name") or "").strip():
        raise HTTPException(status_code=400, detail="Template name is required")
    doc = {k: sanitize_html(payload.get(k, "")) if k != "name" else payload.get(k, "") for k in TERM_FIELDS}
    doc.update(id=str(uuid.uuid4()), created_at=datetime.now(timezone.utc).isoformat())
    await db.terms_templates.insert_one({**doc})
    return doc


@settings_router.patch("/terms/{template_id}")
async def update_terms(template_id: str, payload: dict = Body(...), user: dict = Depends(require_roles("admin"))):
    updates = {k: (sanitize_html(v) if k != "name" else v) for k, v in payload.items() if k in TERM_FIELDS}
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")
    await db.terms_templates.update_one({"id": template_id}, {"$set": updates})
    doc = await db.terms_templates.find_one({"id": template_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Template not found")
    return doc


@settings_router.delete("/terms/{template_id}")
async def delete_terms(template_id: str, user: dict = Depends(require_roles("admin"))):
    result = await db.terms_templates.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"status": "ok"}


# --- Company profile ---

@settings_router.get("/company")
async def get_company_route(user: dict = Depends(get_current_user)):
    return await get_company()


@settings_router.put("/company")
async def put_company(payload: dict = Body(...), user: dict = Depends(require_roles("admin"))):
    whatsapp = "".join(ch for ch in str(payload.get("whatsapp", "")) if ch.isdigit())
    await db.settings.update_one({"_id": "company"}, {"$set": {"whatsapp": whatsapp}}, upsert=True)
    return await get_company()


async def get_company() -> dict:
    doc = await db.settings.find_one({"_id": "company"})
    return {"whatsapp": (doc or {}).get("whatsapp", "")}


# --- Sector branding ---

@settings_router.get("/branding")
async def list_branding(user: dict = Depends(get_current_user)):
    return await _branding_list()


async def _branding_list():
    docs = await db.branding.find({}, {"_id": 0}).to_list(100)
    return [
        {"id": d["id"], "sector": d["sector"], "header_banner": d.get("header_banner", ""), "footer_banner": d.get("footer_banner", "")}
        for d in docs
    ]


@settings_router.post("/branding")
async def save_branding(payload: dict = Body(...), user: dict = Depends(require_roles("admin"))):
    sector = (payload.get("sector") or "").strip()
    if not sector:
        raise HTTPException(status_code=400, detail="Sector is required")
    for key in ("header_banner", "footer_banner"):
        val = payload.get(key, "")
        if val:
            if not val.startswith("data:image/"):
                raise HTTPException(status_code=400, detail=f"{key} must be an image data URL")
            if len(val) > 3_500_000:
                raise HTTPException(status_code=400, detail=f"{key} exceeds the 2 MB limit")
    doc = {
        "sector": sector,
        "header_banner": payload.get("header_banner", ""),
        "footer_banner": payload.get("footer_banner", ""),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    existing = await db.branding.find_one({"sector": {"$regex": f"^{sector}$", "$options": "i"}})
    if existing:
        await db.branding.update_one({"id": existing["id"]}, {"$set": doc})
        doc["id"] = existing["id"]
    else:
        doc["id"] = str(uuid.uuid4())
        await db.branding.insert_one({**doc})
    return doc


@settings_router.delete("/branding/{branding_id}")
async def delete_branding(branding_id: str, user: dict = Depends(require_roles("admin"))):
    result = await db.branding.delete_one({"id": branding_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Branding record not found")
    return {"status": "ok"}


async def match_branding(destination: str) -> dict:
    """Match an itinerary destination to a sector branding record (case-insensitive substring, either way)."""
    dest = (destination or "").strip().lower()
    if not dest:
        return {}
    for doc in await db.branding.find({}, {"_id": 0}).to_list(100):
        sector = (doc.get("sector") or "").strip().lower()
        if not sector:
            continue
        parts = [p.strip() for p in sector.split("/") if p.strip()]
        hit = dest == sector or dest in parts or any(len(p) >= 4 and (p in dest or dest in p) for p in parts)
        if hit:
            return {"header_banner": doc.get("header_banner", ""), "footer_banner": doc.get("footer_banner", ""), "sector": doc.get("sector", "")}
    return {}
