import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_current_user, require_roles
from database import db, next_seq

router = APIRouter(prefix="/api/invoices", tags=["invoices"])

INVOICE_ROLES = ("admin", "finance")


class InvoiceIn(BaseModel):
    booking_id: str


class PaymentIn(BaseModel):
    amount: float
    method: str = "UPI"
    note: str = ""


def _rs(x) -> str:
    return f"Rs.{int(float(x or 0) + 0.5):,}"


def _invoice_status(total: float, paid: float) -> str:
    if paid <= 0:
        return "unpaid"
    if paid + 0.01 >= total:
        return "paid"
    return "partial"


def _refresh_splits(splits, paid):
    remaining = paid
    for s in splits:
        if remaining + 0.01 >= float(s.get("amount", 0)):
            s["status"] = "paid"
            remaining -= float(s.get("amount", 0))
        else:
            s["status"] = "pending"
    return splits


@router.get("")
async def list_invoices(user: dict = Depends(get_current_user)):
    return await db.invoices.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("")
async def create_invoice(data: InvoiceIn, user: dict = Depends(require_roles(*INVOICE_ROLES, "sales"))):
    booking = await db.bookings.find_one({"id": data.booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if await db.invoices.find_one({"booking_id": data.booking_id}):
        raise HTTPException(status_code=400, detail="An invoice already exists for this booking")
    total = float(booking.get("total", 0))
    advance = round(total * 0.3, 2)
    try:
        balance_due = max(date.today(), date.fromisoformat(booking["start_date"]) - timedelta(days=7)).isoformat()
    except (ValueError, KeyError):
        balance_due = ""
    seq = await next_seq("invoice")
    doc = {
        "id": str(uuid.uuid4()),
        "invoice_no": f"INV-{seq:04d}",
        "booking_id": booking["id"],
        "booking_no": booking["booking_no"],
        "customer_name": booking.get("customer_name", ""),
        "customer_email": booking.get("customer_email", ""),
        "customer_phone": booking.get("customer_phone", ""),
        "destination": booking.get("destination", ""),
        "total": total,
        "paid": 0.0,
        "status": "unpaid",
        "splits": [
            {"label": "Advance (30%)", "amount": advance, "due_date": date.today().isoformat(), "status": "pending"},
            {"label": "Balance (70%)", "amount": round(total - advance, 2), "due_date": balance_due, "status": "pending"},
        ],
        "payments": [],
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.invoices.insert_one({**doc})
    return doc


@router.get("/{invoice_id}")
async def get_invoice(invoice_id: str, user: dict = Depends(get_current_user)):
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.post("/{invoice_id}/payments")
async def record_payment(invoice_id: str, data: PaymentIn, user: dict = Depends(require_roles(*INVOICE_ROLES))):
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    outstanding = round(float(invoice.get("total", 0)) - float(invoice.get("paid", 0)), 2)
    if data.amount > outstanding:
        raise HTTPException(status_code=400, detail=f"Amount exceeds outstanding balance of {_rs(outstanding)}")
    data.amount = round(data.amount, 2)
    payment = {
        "id": str(uuid.uuid4()),
        "amount": round(data.amount, 2),
        "method": data.method,
        "note": data.note,
        "date": datetime.now(timezone.utc).isoformat(),
        "recorded_by": user["id"],
    }
    paid = round(float(invoice.get("paid", 0)) + data.amount, 2)
    splits = _refresh_splits(invoice.get("splits", []), paid)
    await db.invoices.update_one(
        {"id": invoice_id},
        {"$push": {"payments": payment}, "$set": {"paid": paid, "status": _invoice_status(float(invoice["total"]), paid), "splits": splits}},
    )
    return await db.invoices.find_one({"id": invoice_id}, {"_id": 0})


@router.get("/{invoice_id}/message")
async def invoice_message(invoice_id: str, user: dict = Depends(get_current_user)):
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    outstanding = float(invoice.get("total", 0)) - float(invoice.get("paid", 0))
    lines = [
        f"*Thapa Holidays — Invoice {invoice['invoice_no']}*",
        f"Hi {invoice.get('customer_name', '')},",
        "",
        f"Booking: {invoice.get('booking_no', '')} ({invoice.get('destination', '')})",
        f"Invoice total: {_rs(invoice.get('total'))}",
        f"Paid: {_rs(invoice.get('paid'))}",
        f"Balance due: {_rs(outstanding)}",
    ]
    if outstanding <= 0:
        lines += ["", "Thank you! Your invoice is fully paid."]
    else:
        lines += ["", "Payment schedule:"]
        for s in invoice.get("splits", []):
            if s.get("status") != "paid":
                lines.append(f"- {s.get('label', '')}: {_rs(s.get('amount'))} due {s.get('due_date', '')}")
    return {"text": "\n".join(lines), "phone": invoice.get("customer_phone", "")}
