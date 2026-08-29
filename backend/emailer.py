import ipaddress
import logging
import os
import re
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_current_user
from database import db

logger = logging.getLogger(__name__)
email_router = APIRouter(prefix="/api/email", tags=["email"])

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Thapa Holidays")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "")

# --- Guardrail gate (G2/G3 structural checks; do not modify) ---
_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str, reply_to: str | None = None) -> str | None:
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if reply_to or EMAIL_REPLY_TO:
        payload["contact_email"] = reply_to or EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        logger.error("Email send failed: %s %s", e.response.status_code, e.response.text)
        try:
            body = e.response.json()
            reason = body.get("message") or body.get("error") or body.get("detail") or ""
        except Exception:
            reason = ""
        reason = reason or (e.response.text or "")[:200] or "Unknown provider error"
        status = e.response.status_code if 400 <= e.response.status_code < 500 else 502
        raise HTTPException(status_code=status, detail=f"Email provider rejected the send: {reason}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Email send error: %s", str(e))
        raise HTTPException(status_code=500, detail="Failed to send email")


# --- Server-side templates (G4: callers pass IDs, never markup) ---


def _inr(amount) -> str:
    return "₹{:,.0f}".format(float(amount or 0))


def _layout(title: str, body: str) -> str:
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:24px 0">'
        '<tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" '
        'style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;max-width:100%">'
        f'<tr><td style="background:#0284C7;padding:16px 24px"><span style="font-family:Arial,sans-serif;font-size:18px;font-weight:bold;color:#FFFFFF">{escape(EMAIL_FROM_NAME)}</span></td></tr>'
        f'<tr><td style="padding:24px;font-family:Arial,sans-serif;font-size:14px;color:#0F172A;line-height:1.6">'
        f'<h2 style="margin:0 0 16px;font-size:18px">{escape(title)}</h2>{body}</td></tr>'
        f'<tr><td style="padding:16px 24px;background:#F8FAFC;font-family:Arial,sans-serif;font-size:11px;color:#64748B">'
        f'Sent by {escape(EMAIL_FROM_NAME)}. We never ask for passwords, OTPs or card details by email.</td></tr>'
        "</table></td></tr></table>"
    )


def _button(url: str, label: str) -> str:
    return (
        f'<p style="margin:20px 0"><a href="{escape(url)}" style="background:#0284C7;color:#FFFFFF;padding:10px 20px;'
        f'border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">{escape(label)}</a></p>'
    )


TEMPLATES = ["welcome", "proposal", "revised_quote", "vendor_request", "receipt", "reminder"]


async def build_email(template: str, ref_id: str, vendor_id: str | None = None):
    if template in ("proposal", "revised_quote"):
        itin = await db.itineraries.find_one({"id": ref_id}, {"_id": 0})
        if not itin:
            raise HTTPException(status_code=404, detail="Itinerary not found")
        to = itin.get("customer_email") or ""
        if not to:
            raise HTTPException(status_code=400, detail="Customer has no email address")
        share_url = f"{FRONTEND_URL}/share/{itin['share_token']}"
        pricing = itin.get("pricing", {})
        costing = itin.get("costing", {})
        subject_tag = "Updated travel proposal" if template == "revised_quote" else "Your travel proposal"
        subject = f"{subject_tag}: {itin.get('destination', '')} — {EMAIL_FROM_NAME}"
        body = (
            f"<p>Hi {escape(itin.get('customer_name', 'there'))},</p>"
            f"<p>Thank you for choosing {escape(EMAIL_FROM_NAME)}. Here is your itinerary for "
            f"<strong>{escape(itin.get('destination', ''))}</strong>"
            f" starting <strong>{escape(itin.get('start_date', ''))}</strong> ({len(itin.get('days', []))} days, {itin.get('pax', 2)} travellers).</p>"
            f'<p style="font-size:16px">Package price: <strong>{_inr(costing.get("total"))}</strong> '
            f'({_inr(costing.get("per_person"))} per person)</p>'
            + _button(share_url, "View full proposal")
            + "<p>Simply reply to this email to confirm or request changes.</p>"
        )
        return to, subject, _layout(subject_tag, body)

    if template == "vendor_request":
        booking = await db.bookings.find_one({"id": ref_id}, {"_id": 0})
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        conf = next((c for c in booking.get("vendor_confirmations", []) if c["id"] == vendor_id), None)
        if not conf:
            raise HTTPException(status_code=404, detail="Vendor confirmation not found")
        to = conf.get("email") or ""
        if not to:
            raise HTTPException(status_code=400, detail="Vendor has no email address")
        subject = f"Booking request {booking['booking_no']} — {EMAIL_FROM_NAME}"
        kind = "Hotel reservation" if conf.get("vendor_type") == "hotel" else "Transport booking"
        body = (
            f"<p>Dear {escape(conf.get('vendor_name', 'Partner'))},</p>"
            f"<p>Please confirm availability for the following {kind.lower()}:</p>"
            f'<table role="presentation" cellpadding="6" style="border-collapse:collapse;border:1px solid #E2E8F0;font-size:13px">'
            f'<tr><td style="border:1px solid #E2E8F0"><strong>Booking ref</strong></td><td style="border:1px solid #E2E8F0">{escape(booking["booking_no"])}</td></tr>'
            f'<tr><td style="border:1px solid #E2E8F0"><strong>Guest</strong></td><td style="border:1px solid #E2E8F0">{escape(booking.get("customer_name", ""))}</td></tr>'
            f'<tr><td style="border:1px solid #E2E8F0"><strong>Check-in / Start</strong></td><td style="border:1px solid #E2E8F0">{escape(booking.get("start_date", ""))}</td></tr>'
            f'<tr><td style="border:1px solid #E2E8F0"><strong>Details</strong></td><td style="border:1px solid #E2E8F0">{escape(conf.get("detail", ""))}</td></tr>'
            f'<tr><td style="border:1px solid #E2E8F0"><strong>Pax</strong></td><td style="border:1px solid #E2E8F0">{booking.get("pax", 2)}</td></tr>'
            "</table>"
            f"<p>Kindly reply to this email to confirm or decline availability.</p>"
        )
        return to, subject, _layout(f"Booking request {booking['booking_no']}", body)

    if template in ("receipt", "reminder"):
        invoice = await db.invoices.find_one({"id": ref_id}, {"_id": 0})
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        to = invoice.get("customer_email") or ""
        if not to:
            raise HTTPException(status_code=400, detail="Customer has no email address")
        outstanding = float(invoice.get("total", 0)) - float(invoice.get("paid", 0))
        if template == "receipt":
            last = (invoice.get("payments") or [{}])[-1]
            subject = f"Payment receipt {invoice['invoice_no']} — {EMAIL_FROM_NAME}"
            body = (
                f"<p>Hi {escape(invoice.get('customer_name', 'there'))},</p>"
                f"<p>We have received your payment of <strong>{_inr(last.get('amount'))}</strong>"
                f" ({escape(last.get('method', ''))}) towards invoice <strong>{escape(invoice['invoice_no'])}</strong>.</p>"
                f"<p>Paid so far: <strong>{_inr(invoice.get('paid'))}</strong> of {_inr(invoice.get('total'))}."
                + (f" Balance due: <strong>{_inr(outstanding)}</strong>.</p>" if outstanding > 0 else " Your invoice is fully paid. Thank you!</p>")
                + f"<p>Booking reference: {escape(invoice.get('booking_no', ''))}</p>"
            )
            return to, subject, _layout("Payment received", body)
        subject = f"Payment reminder {invoice['invoice_no']} — {EMAIL_FROM_NAME}"
        dues = "".join(
            f'<tr><td style="border:1px solid #E2E8F0;padding:6px">{escape(s.get("label", ""))}</td>'
            f'<td style="border:1px solid #E2E8F0;padding:6px">{_inr(s.get("amount"))}</td>'
            f'<td style="border:1px solid #E2E8F0;padding:6px">{escape(s.get("due_date", ""))}</td></tr>'
            for s in invoice.get("splits", [])
            if s.get("status") != "paid"
        )
        body = (
            f"<p>Hi {escape(invoice.get('customer_name', 'there'))},</p>"
            f"<p>This is a friendly reminder for invoice <strong>{escape(invoice['invoice_no'])}</strong> "
            f"(booking {escape(invoice.get('booking_no', ''))}). Outstanding balance: <strong>{_inr(outstanding)}</strong>.</p>"
            + (f'<table role="presentation" cellpadding="0" style="border-collapse:collapse;font-size:13px;margin:12px 0">'
               f'<tr><td style="border:1px solid #E2E8F0;padding:6px"><strong>Particular</strong></td>'
               f'<td style="border:1px solid #E2E8F0;padding:6px"><strong>Amount</strong></td>'
               f'<td style="border:1px solid #E2E8F0;padding:6px"><strong>Due date</strong></td></tr>{dues}</table>' if dues else "")
            + "<p>Please get in touch with us to complete the payment.</p>"
        )
        return to, subject, _layout("Payment reminder", body)

    if template == "welcome":
        lead = await db.leads.find_one({"id": ref_id}, {"_id": 0})
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        to = lead.get("email") or ""
        if not to:
            raise HTTPException(status_code=400, detail="Lead has no email address")
        subject = f"Thanks for your enquiry — {EMAIL_FROM_NAME}"
        body = (
            f"<p>Hi {escape(lead.get('customer_name', 'there'))},</p>"
            f"<p>Thank you for your travel enquiry with {escape(EMAIL_FROM_NAME)}"
            + (f" for <strong>{escape(lead.get('destination', ''))}</strong>" if lead.get("destination") else "")
            + ". Our travel experts are crafting a personalised itinerary for you and will reach out shortly.</p>"
            "<p>Simply reply to this email if you have any questions in the meantime.</p>"
        )
        return to, subject, _layout("We're on it!", body)

    raise HTTPException(status_code=400, detail="Unknown template")


class SendEmailIn(BaseModel):
    template: str
    ref_id: str
    vendor_id: str | None = None


@email_router.get("/preview")
async def preview_email(template: str, ref_id: str, vendor_id: str | None = None, user: dict = Depends(get_current_user)):
    to, subject, html = await build_email(template, ref_id, vendor_id)
    return {"to": to, "subject": subject, "html": html}


@email_router.post("/send")
async def send_template_email(data: SendEmailIn, user: dict = Depends(get_current_user)):
    if data.template not in TEMPLATES:
        raise HTTPException(status_code=400, detail="Unknown template")
    to, subject, html = await build_email(data.template, data.ref_id, data.vendor_id)
    email_id = await send_email(to=to, subject=subject, html=html)
    return {"status": "success", "email_id": email_id, "to": to}
