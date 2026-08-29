import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_current_user, require_roles
from database import db
from emailer import build_email, send_email

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/leads", tags=["leads"])

STATUSES = ["new", "contacted", "proposal_sent", "negotiation", "won", "lost"]


class LeadIn(BaseModel):
    customer_name: str
    email: Optional[str] = ""
    phone: Optional[str] = ""
    destination: Optional[str] = ""
    travel_start: Optional[str] = ""
    travel_end: Optional[str] = ""
    pax: int = 2
    adults: Optional[int] = 0
    cwb: Optional[int] = 0
    cnb: Optional[int] = 0
    budget: float = 0
    source: Optional[str] = ""
    notes: Optional[str] = ""


async def _send_welcome(lead_id: str):
    try:
        to, subject, html = await build_email("welcome", lead_id)
        await send_email(to=to, subject=subject, html=html)
    except Exception as e:
        logger.warning("Welcome email failed for lead %s: %s", lead_id, e)


@router.get("")
async def list_leads(status: str = "", search: str = "", user: dict = Depends(get_current_user)):
    q = {}
    if status:
        q["status"] = status
    if search:
        q["$or"] = [
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"destination": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]
    return await db.leads.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)


@router.post("")
async def create_lead(data: LeadIn, user: dict = Depends(require_roles("admin", "sales"))):
    now = datetime.now(timezone.utc).isoformat()
    doc = data.model_dump()
    doc.update(
        id=str(uuid.uuid4()),
        email=(doc.get("email") or "").lower().strip(),
        status="new",
        created_by=user["id"],
        created_at=now,
        updated_at=now,
    )
    await db.leads.insert_one({**doc})
    if doc.get("email"):
        asyncio.create_task(_send_welcome(doc["id"]))
    return doc


@router.get("/{lead_id}")
async def get_lead(lead_id: str, user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.patch("/{lead_id}")
async def update_lead(lead_id: str, data: dict, user: dict = Depends(require_roles("admin", "sales"))):
    lead = await db.leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    allowed = {"customer_name", "email", "phone", "destination", "travel_start", "travel_end", "pax", "adults", "cwb", "cnb", "budget", "source", "notes", "status"}
    updates = {k: v for k, v in data.items() if k in allowed}
    if "status" in updates and updates["status"] not in STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    if "email" in updates:
        updates["email"] = (updates["email"] or "").lower().strip()
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.leads.update_one({"id": lead_id}, {"$set": updates})
    return await db.leads.find_one({"id": lead_id}, {"_id": 0})


@router.delete("/{lead_id}")
async def delete_lead(lead_id: str, user: dict = Depends(require_roles("admin"))):
    await db.leads.delete_one({"id": lead_id})
    return {"status": "ok"}
