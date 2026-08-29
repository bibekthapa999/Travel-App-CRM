"""Round-2 regression for iteration_1 fixes: over-payment guard, itinerary cascade delete,
XFF-keyed brute-force lockout, half-up money rounding in WhatsApp messages."""
import os
import time
import uuid

import pytest
import requests
from dotenv import dotenv_values

_base = os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env").get("REACT_APP_BACKEND_URL")
API = _base.rstrip("/") + "/api"

CREDS = {
    "admin": ("thapa.holidays09@gmail.com", "Admin@123"),
    "finance": ("finance@thapaholidays.com", "Finance@123"),
}


def _client(role):
    s = requests.Session()
    email, password = CREDS[role]
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"login {role} -> {r.status_code} {r.text[:200]}")
    return s


@pytest.fixture(scope="module")
def admin():
    return _client("admin")


@pytest.fixture(scope="module")
def finance():
    return _client("finance")


@pytest.fixture(scope="module")
def vendor_ids(admin):
    hotels = admin.get(f"{API}/hotels", timeout=30).json()
    vehicles = admin.get(f"{API}/vehicles", timeout=30).json()
    hotel = next(h for h in hotels if h.get("name") == "Hotel Himalayan View")
    vehicle = next(v for v in vehicles if v.get("vendor_name") == "Himalayan Wheels")
    return {"hotel_id": hotel["id"], "vehicle_id": vehicle["id"]}


def _itin_payload(vendor_ids):
    return {
        "title": "TEST_R2 " + uuid.uuid4().hex[:6],
        "customer_name": "TEST_R2 Customer",
        "customer_email": "delivered@resend.dev",
        "customer_phone": "919812345678",
        "destination": "Manali",
        "start_date": "2026-10-05",
        "pax": 2,
        "days": [{
            "day": 1, "title": "Arrival", "hotel_id": vendor_ids["hotel_id"], "room_category": "Deluxe",
            "meal_plan": "map", "vehicle_id": vendor_ids["vehicle_id"], "activity_cost": 2000,
        }],
        "pricing": {"margin_pct": 25, "gst_enabled": True, "gst_pct": 5, "discount": 0},
        "terms": {"inclusions": "<p>TEST inc</p>", "exclusions": "<p>TEST exc</p>",
                  "payment_policy": "<p>TEST pay</p>", "cancellation_policy": "<p>TEST cxl</p>",
                  "important_notes": "<p>TEST notes</p>"},
    }


class TestRound2:
    """Full lifecycle: itinerary -> booking -> invoice -> over-payment guard -> cascade delete."""

    ids = {}

    def test_create_itinerary(self, admin, vendor_ids):
        r = admin.post(f"{API}/itineraries", json=_itin_payload(vendor_ids), timeout=30)
        assert r.status_code == 200, r.text
        itin = r.json()
        assert itin["costing"]["total"] == 13912.5
        TestRound2.ids["itin"] = itin["id"]

    def test_money_rounds_half_up_in_message(self, admin):
        """13912.5 must render as Rs.13,913 (was floored to 13,912)."""
        r = admin.get(f"{API}/itineraries/{TestRound2.ids['itin']}/message", timeout=30)
        assert r.status_code == 200, r.text
        text = r.json()["text"]
        assert "13,913" in text, text
        assert "13,912" not in text, text

    def test_create_booking_and_invoice(self, admin, finance):
        r = admin.post(f"{API}/bookings", json={"itinerary_id": TestRound2.ids["itin"]}, timeout=30)
        assert r.status_code == 200, r.text
        TestRound2.ids["booking"] = r.json()["id"]
        r = finance.post(f"{API}/invoices", json={"booking_id": TestRound2.ids["booking"]}, timeout=30)
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["total"] == 13912.5
        TestRound2.ids["invoice"] = inv["id"]
        TestRound2.ids["splits"] = inv["splits"]

    def test_overpayment_rejected(self, finance):
        inv_id = TestRound2.ids["invoice"]
        r = finance.post(f"{API}/invoices/{inv_id}/payments",
                         json={"amount": 99999, "method": "cash"}, timeout=30)
        assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text[:200]}"
        assert "exceeds outstanding" in r.json()["detail"].lower(), r.text
        # unchanged state
        g = finance.get(f"{API}/invoices/{inv_id}", timeout=30)
        assert g.json()["paid"] == 0

    def test_valid_partial_then_overpayment_of_remainder(self, finance):
        inv_id = TestRound2.ids["invoice"]
        r = finance.post(f"{API}/invoices/{inv_id}/payments", json={"amount": 4173.75, "method": "upi"}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["paid"] == 4173.75
        # backend allows a 0.01 float tolerance; anything meaningfully above outstanding must 400
        r = finance.post(f"{API}/invoices/{inv_id}/payments", json={"amount": 9739.75, "method": "upi"}, timeout=30)
        assert r.status_code == 400, r.text
        r = finance.post(f"{API}/invoices/{inv_id}/payments", json={"amount": 9738.75, "method": "upi"}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "paid"

    def test_delete_itinerary_cascades(self, admin):
        itin_id, bk_id, inv_id = TestRound2.ids["itin"], TestRound2.ids["booking"], TestRound2.ids["invoice"]
        r = admin.delete(f"{API}/itineraries/{itin_id}", timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "cascade_deleted" in body, body
        assert body["cascade_deleted"] >= 1, body
        assert admin.get(f"{API}/itineraries/{itin_id}", timeout=30).status_code == 404
        bookings = admin.get(f"{API}/bookings", timeout=30).json()
        assert all(b["id"] != bk_id for b in bookings), "orphan booking still present"
        invoices = admin.get(f"{API}/invoices", timeout=30).json()
        assert all(i["id"] != inv_id for i in invoices), "orphan invoice still present"


class TestBruteForceXFF:
    """5 wrong passwords from a single X-Forwarded-For must 429."""

    def test_lockout_by_xff(self):
        xff = f"203.0.113.{int(time.time()) % 200 + 10}"
        email = "thapa.holidays09@gmail.com"
        s = requests.Session()
        statuses = []
        for _ in range(6):
            r = s.post(f"{API}/auth/login", json={"email": email, "password": "WrongPass!1"},
                       headers={"X-Forwarded-For": xff}, timeout=30)
            statuses.append(r.status_code)
            if r.status_code == 429:
                break
        assert 429 in statuses, f"no lockout after 6 wrong attempts: {statuses}"
        assert statuses.index(429) <= 5, statuses
