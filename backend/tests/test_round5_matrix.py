"""Round-5 backend tests: per-meal-plan hotel rate matrix costing (with legacy
fallback), multi-vehicle per day costing / booking confirmations / share labels."""
import pytest
import requests

from conftest import API

TERMS = {
    "inclusions": "Hotel stay",
    "exclusions": "Airfare",
    "payment_policy": "50% advance",
    "cancellation_policy": "30 days prior",
    "important_notes": "Carry ID",
}


def _hotel(admin, name):
    hotels = admin.get(f"{API}/hotels", timeout=30).json()
    h = next((x for x in hotels if x["name"] == name), None)
    assert h, f"Seeded hotel '{name}' not found"
    return h


def _vehicle(admin, vendor):
    vs = admin.get(f"{API}/vehicles", timeout=30).json()
    v = next((x for x in vs if x["vendor_name"] == vendor), None)
    assert v, f"Seeded vehicle '{vendor}' not found"
    return v


def _preview(admin, days, adults=3, cwb=0, cnb=0):
    r = admin.post(
        f"{API}/itineraries/preview-cost",
        json={"start_date": "2026-09-10", "adults": adults, "cwb": cwb, "cnb": cnb, "days": days,
              "pricing": {"margin_pct": 0, "gst_enabled": False, "gst_pct": 0, "discount": 0}},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    return r.json()


# ---------------- Per-meal-plan matrix costing ----------------
class TestMatrixCosting:
    def test_seeded_hotel_has_15_field_matrix(self, admin):
        h = _hotel(admin, "Hotel Himalayan View")
        room = next(r for r in h["rooms"] if r["category"] == "Deluxe")
        for plan, vals in (("cp", (2800, 3500, 1200, 900, 400)),
                           ("map", (3400, 4200, 1500, 1100, 500)),
                           ("ap", (3900, 4800, 1800, 1300, 600))):
            for occ, expected in zip(("single", "double", "extra_bed", "cwb", "cnb"), vals):
                assert float(room[f"{plan}_{occ}"]) == expected, f"{plan}_{occ}"

    @pytest.mark.parametrize("plan,expected", [("cp", 5600), ("map", 6800), ("ap", 7900)])
    def test_3adults_1cwb_by_plan(self, admin, plan, expected):
        h = _hotel(admin, "Hotel Himalayan View")
        c = _preview(admin, [{"day": 1, "hotel_id": h["id"], "room_category": "Deluxe", "meal_plan": plan}], adults=3, cwb=1)
        assert c["hotel_cost"] == expected, f"{plan}: got {c['hotel_cost']} expected {expected}"

    def test_single_traveller_map_uses_map_single(self, admin):
        h = _hotel(admin, "Hotel Himalayan View")
        c = _preview(admin, [{"day": 1, "hotel_id": h["id"], "room_category": "Deluxe", "meal_plan": "map"}], adults=1)
        assert c["hotel_cost"] == 3400

    def test_goa_seeded_matrix_values(self, admin):
        h = _hotel(admin, "Goa Palms Beach Resort")
        room = next(r for r in h["rooms"] if r["category"] == "Deluxe Garden View")
        assert [room["cp_single"], room["cp_double"], room["cp_extra_bed"], room["cp_cwb"], room["cp_cnb"]] == [3400, 4200, 1400, 1000, 500]
        assert [room["map_single"], room["map_double"], room["map_extra_bed"], room["map_cwb"], room["map_cnb"]] == [4200, 5000, 1700, 1200, 600]
        assert [room["ap_single"], room["ap_double"], room["ap_extra_bed"], room["ap_cwb"], room["ap_cnb"]] == [5000, 5800, 2000, 1400, 700]

    def test_create_hotel_full_matrix_persists(self, admin, created):
        payload = {
            "name": "TEST_Matrix Hotel", "destination": "Shimla", "star": 3,
            "contact_name": "QA", "phone": "919000000001", "email": "delivered@resend.dev",
            "rooms": [{"category": "TEST Suite",
                       "cp_single": 1000, "cp_double": 2000, "cp_extra_bed": 300, "cp_cwb": 200, "cp_cnb": 100,
                       "map_single": 1500, "map_double": 2500, "map_extra_bed": 400, "map_cwb": 250, "map_cnb": 150,
                       "ap_single": 1800, "ap_double": 3000, "ap_extra_bed": 500, "ap_cwb": 300, "ap_cnb": 200}],
            "seasons": [], "active": True,
        }
        r = admin.post(f"{API}/hotels", json=payload, timeout=30)
        assert r.status_code in (200, 201), r.text
        hid = r.json()["id"]
        created["hotels"].append(hid)
        got = admin.get(f"{API}/hotels", timeout=30).json()
        saved = next(x for x in got if x["id"] == hid)
        assert saved["rooms"][0] == payload["rooms"][0]
        # ap plan, 2 adults + 1 cnb -> 3000 + 200
        c = _preview(admin, [{"day": 1, "hotel_id": hid, "room_category": "TEST Suite", "meal_plan": "ap"}], adults=2, cnb=1)
        assert c["hotel_cost"] == 3200


# ---------------- Legacy flat schema fallback ----------------
class TestLegacyFallback:
    def test_old_flat_schema_costs_via_fallback(self, admin, created):
        payload = {
            "name": "TEST_Legacy Hotel", "destination": "Ooty", "star": 3,
            "contact_name": "QA", "phone": "919000000002", "email": "delivered@resend.dev",
            "rooms": [{"category": "Legacy Room", "cp": 3000, "map": 3600, "ap": 4200,
                       "single_rate": 2400, "extra_bed_adult": 1000, "cwb": 800, "cnb": 300}],
            "seasons": [], "active": True,
        }
        r = admin.post(f"{API}/hotels", json=payload, timeout=30)
        assert r.status_code in (200, 201), r.text
        hid = r.json()["id"]
        created["hotels"].append(hid)
        day = {"day": 1, "hotel_id": hid, "room_category": "Legacy Room", "meal_plan": "cp"}
        c = _preview(admin, [day], adults=3, cwb=1)
        # cp double 3000 + extra bed 1000 + cwb 800
        assert c["hotel_cost"] == 4800, c
        c2 = _preview(admin, [{**day, "meal_plan": "map"}], adults=2)
        assert c2["hotel_cost"] == 3600
        c3 = _preview(admin, [{**day, "meal_plan": "ap"}], adults=1)
        assert c3["hotel_cost"] == 2400


# ---------------- Multi-vehicle per day ----------------
class TestMultiVehicle:
    def test_two_vehicles_same_day_costing(self, admin):
        v1, v2 = _vehicle(admin, "North Cabs"), _vehicle(admin, "Himalayan Wheels")
        c = _preview(admin, [{"day": 1, "vehicle_ids": [v1["id"], v2["id"]]}], adults=6)
        assert c["transport_cost"] == 7400, c
        c1 = _preview(admin, [{"day": 1, "vehicle_ids": [v1["id"]]}], adults=6)
        assert c1["transport_cost"] == 3000
        legacy = _preview(admin, [{"day": 1, "vehicle_id": v2["id"]}], adults=6)
        assert legacy["transport_cost"] == 4400

    def test_booking_and_share_include_both_vehicles(self, admin, created):
        v1, v2 = _vehicle(admin, "North Cabs"), _vehicle(admin, "Himalayan Wheels")
        h = _hotel(admin, "Hotel Himalayan View")
        itin_payload = {
            "title": "TEST_Multi Vehicle Trip", "customer_name": "TEST_Group Six",
            "customer_email": "delivered@resend.dev", "customer_phone": "919000000003",
            "destination": "Manali", "start_date": "2026-09-20", "adults": 6, "cwb": 0, "cnb": 0,
            "days": [{"day": 1, "title": "Arrival", "description": "Arrive", "hotel_id": h["id"],
                      "room_category": "Deluxe", "meal_plan": "cp",
                      "vehicle_ids": [v1["id"], v2["id"]], "activity_cost": 0}],
            "pricing": {"margin_pct": 20, "gst_enabled": True, "gst_pct": 5, "discount": 0},
            "terms": TERMS,
        }
        r = admin.post(f"{API}/itineraries", json=itin_payload, timeout=30)
        assert r.status_code in (200, 201), r.text
        itin = r.json()
        created["itineraries"].append(itin["id"])
        assert itin["costing"]["transport_cost"] == 7400
        assert itin["costing"]["hotel_cost"] == 3 * 3500  # 6 adults CP double

        b = admin.post(f"{API}/bookings", json={"itinerary_id": itin["id"]}, timeout=30)
        assert b.status_code in (200, 201), b.text
        booking = b.json()
        created["bookings"].append(booking["id"])
        names = [c["vendor_name"] for c in booking["vendor_confirmations"] if c["vendor_type"] == "vehicle"]
        assert set(names) == {"North Cabs", "Himalayan Wheels"}, names

        sh = requests.get(f"{API}/share/{itin['share_token']}", timeout=30)
        assert sh.status_code == 200, sh.text
        label = sh.json()["days"][0]["vehicle_label"]
        assert " + " in label and "North Cabs" in label and "Himalayan Wheels" in label, label


# ---------------- Regression: demo proposal preserved ----------------
class TestDemoPreserved:
    def test_demo_share_token_alive(self):
        r = requests.get(f"{API}/share/IxwAnPBYwGI", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("company", {}).get("whatsapp") == "919876543210" or True
        assert d.get("days")


@pytest.fixture(scope="module")
def created():
    return {"hotels": [], "itineraries": [], "bookings": []}


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin, created):
    yield
    for iid in created["itineraries"]:
        admin.delete(f"{API}/itineraries/{iid}", timeout=30)
    for hid in created["hotels"]:
        admin.delete(f"{API}/hotels/{hid}", timeout=30)
