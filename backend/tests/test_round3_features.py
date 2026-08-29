"""Round-3 backend tests: Route Master, Terms templates, Company, Sector branding,
occupancy-based hotel costing, magazine share payload, accept-quote side effects."""
import pytest
import requests

from conftest import API

STATE = {}


# --- Route Master ---
class TestRouteMaster:
    def test_seeded_routes_present(self, admin):
        r = admin.get(f"{API}/routes", timeout=30)
        assert r.status_code == 200, r.text
        routes = r.json()
        assert isinstance(routes, list) and len(routes) >= 3
        pairs = {(x["from_place"], x["to_place"]) for x in routes}
        assert ("IXB/NJP", "Gangtok") in pairs
        assert ("NJP/IXB", "Darjeeling") in pairs
        assert ("Phuentsholing", "Thimphu") in pairs
        for x in routes:
            assert "_id" not in x
            assert "id" in x and isinstance(x["id"], str)

    def test_lookup_returns_rich_description(self, admin):
        r = admin.get(f"{API}/routes/lookup", params={"from_place": "ixb/njp", "to_place": "gangtok"}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["found"] is True
        assert "Teesta" in d["description"]
        assert "<" in d["description"]  # HTML rich text

    def test_lookup_unknown_pair(self, admin):
        r = admin.get(f"{API}/routes/lookup", params={"from_place": "Nowhere", "to_place": "Nothing"}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["found"] is False and d["description"] == "" and d["image_url"] == ""
        assert d["day_title"] == "Transfer to Nothing"  # auto-generated even without a route master match

    def test_lookup_requires_params(self, admin):
        assert admin.get(f"{API}/routes/lookup", params={"from_place": "IXB/NJP"}, timeout=30).status_code == 400

    def test_create_update_delete_route(self, admin):
        payload = {"from_place": "TEST_Siliguri", "to_place": "TEST_Kalimpong", "description": "<p>TEST_desc <strong>hill</strong></p>"}
        r = admin.post(f"{API}/routes", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        route = r.json()
        rid = route["id"]
        assert route["from_place"] == payload["from_place"]
        assert route["description"] == payload["description"]

        # GET verifies persistence
        found = next((x for x in admin.get(f"{API}/routes", timeout=30).json() if x["id"] == rid), None)
        assert found and found["to_place"] == "TEST_Kalimpong"

        # lookup roundtrip
        lk = admin.get(f"{API}/routes/lookup", params={"from_place": "TEST_Siliguri", "to_place": "TEST_Kalimpong"}, timeout=30).json()
        assert lk["found"] is True and "TEST_desc" in lk["description"]

        # PATCH
        up = admin.patch(f"{API}/routes/{rid}", json={"description": "<p>TEST_updated</p>"}, timeout=30)
        assert up.status_code == 200, up.text
        assert up.json()["description"] == "<p>TEST_updated</p>"
        again = next(x for x in admin.get(f"{API}/routes", timeout=30).json() if x["id"] == rid)
        assert again["description"] == "<p>TEST_updated</p>"

        # DELETE
        assert admin.delete(f"{API}/routes/{rid}", timeout=30).status_code == 200
        assert all(x["id"] != rid for x in admin.get(f"{API}/routes", timeout=30).json())

    def test_create_route_validation(self, admin):
        assert admin.post(f"{API}/routes", json={"from_place": "  ", "to_place": "X"}, timeout=30).status_code == 400

    def test_patch_unknown_route_404(self, admin):
        assert admin.patch(f"{API}/routes/nope-id", json={"description": "x"}, timeout=30).status_code == 404

    def test_routes_require_auth(self):
        assert requests.get(f"{API}/routes", timeout=30).status_code in (401, 403)

    def test_finance_cannot_create_route(self, finance):
        r = finance.post(f"{API}/routes", json={"from_place": "TEST_A", "to_place": "TEST_B"}, timeout=30)
        assert r.status_code == 403, r.text


# --- Terms & Policies templates ---
class TestTermsTemplates:
    def test_seeded_template(self, admin):
        r = admin.get(f"{API}/settings/terms", timeout=30)
        assert r.status_code == 200, r.text
        items = r.json()
        tpl = next((x for x in items if x["name"] == "Standard Domestic Tour"), None)
        assert tpl is not None, [x["name"] for x in items]
        for key in ("inclusions", "exclusions", "payment_policy", "cancellation_policy", "important_notes"):
            assert tpl.get(key), f"{key} empty in seeded template"
        assert "_id" not in tpl

    def test_terms_crud(self, admin):
        r = admin.post(f"{API}/settings/terms", json={
            "name": "TEST_Template", "inclusions": "<ul><li>TEST inc</li></ul>", "exclusions": "<p>TEST exc</p>",
            "payment_policy": "<p>50%</p>", "cancellation_policy": "<p>no refund</p>", "important_notes": "<p>carry id</p>",
        }, timeout=30)
        assert r.status_code == 200, r.text
        tid = r.json()["id"]
        got = next(x for x in admin.get(f"{API}/settings/terms", timeout=30).json() if x["id"] == tid)
        assert got["inclusions"] == "<ul><li>TEST inc</li></ul>"

        up = admin.patch(f"{API}/settings/terms/{tid}", json={"payment_policy": "<p>100%</p>"}, timeout=30)
        assert up.status_code == 200 and up.json()["payment_policy"] == "<p>100%</p>"

        assert admin.delete(f"{API}/settings/terms/{tid}", timeout=30).status_code == 200
        assert all(x["id"] != tid for x in admin.get(f"{API}/settings/terms", timeout=30).json())

    def test_terms_name_required(self, admin):
        assert admin.post(f"{API}/settings/terms", json={"name": " "}, timeout=30).status_code == 400

    def test_sales_cannot_write_terms(self, sales):
        assert sales.post(f"{API}/settings/terms", json={"name": "TEST_x"}, timeout=30).status_code == 403


# --- Company settings ---
class TestCompanySettings:
    def test_get_and_update_whatsapp(self, admin):
        r = admin.get(f"{API}/settings/company", timeout=30)
        assert r.status_code == 200 and r.json()["whatsapp"].isdigit()
        original = r.json()["whatsapp"]
        up = admin.put(f"{API}/settings/company", json={"whatsapp": "+91 98765-00001"}, timeout=30)
        assert up.status_code == 200, up.text
        assert up.json()["whatsapp"] == "919876500001", "digits should be normalised"
        assert admin.get(f"{API}/settings/company", timeout=30).json()["whatsapp"] == "919876500001"
        # restore
        admin.put(f"{API}/settings/company", json={"whatsapp": original}, timeout=30)
        assert admin.get(f"{API}/settings/company", timeout=30).json()["whatsapp"] == original

    def test_non_admin_cannot_update(self, sales):
        assert sales.put(f"{API}/settings/company", json={"whatsapp": "911111111111"}, timeout=30).status_code == 403


# --- Sector branding ---
PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=="


class TestBranding:
    def test_create_and_upsert_branding(self, admin):
        r = admin.post(f"{API}/settings/branding", json={"sector": "TEST_Sector", "header_banner": PNG, "footer_banner": PNG}, timeout=30)
        assert r.status_code == 200, r.text
        bid = r.json()["id"]
        items = admin.get(f"{API}/settings/branding", timeout=30).json()
        got = next(x for x in items if x["id"] == bid)
        assert got["sector"] == "TEST_Sector" and got["header_banner"].startswith("data:image/png;base64,")

        # upsert by same sector (case-insensitive) must not duplicate
        r2 = admin.post(f"{API}/settings/branding", json={"sector": "test_sector", "header_banner": PNG, "footer_banner": ""}, timeout=30)
        assert r2.status_code == 200 and r2.json()["id"] == bid
        assert sum(1 for x in admin.get(f"{API}/settings/branding", timeout=30).json() if x["sector"].lower() == "test_sector") == 1

        assert admin.delete(f"{API}/settings/branding/{bid}", timeout=30).status_code == 200
        assert all(x["id"] != bid for x in admin.get(f"{API}/settings/branding", timeout=30).json())

    def test_sector_required(self, admin):
        assert admin.post(f"{API}/settings/branding", json={"sector": ""}, timeout=30).status_code == 400


# --- Occupancy costing matrix ---
class TestOccupancyCosting:
    @pytest.fixture(scope="class", autouse=True)
    def hotel(self, admin):
        hotels = admin.get(f"{API}/hotels", timeout=30).json()
        h = next((x for x in hotels if x["name"] == "Hotel Himalayan View"), None)
        assert h, [x["name"] for x in hotels]
        STATE["hotel"] = h
        return h

    def test_seeded_room_matrix_fields(self):
        room = next(r for r in STATE["hotel"]["rooms"] if r["category"] == "Deluxe")
        assert room["cp"] == 3500 and room["map"] == 4200 and room["ap"] == 4800
        assert room["single_rate"] == 2800
        assert room["extra_bed_adult"] == 1200
        assert room["cwb"] == 900
        assert room["cnb"] == 400

    def _payload(self, adults, cwb=0, cnb=0, meal="map"):
        return {
            "destination": "Sikkim/Darjeeling", "start_date": "2026-10-05",
            "pax": adults + cwb + cnb, "adults": adults, "cwb": cwb, "cnb": cnb,
            "days": [{"day": 1, "hotel_id": STATE["hotel"]["id"], "room_category": "Deluxe", "meal_plan": meal}],
            "pricing": {"margin_pct": 25, "gst_enabled": True, "gst_pct": 5, "discount": 0},
        }

    def test_three_adults_one_cwb(self, admin):
        r = admin.post(f"{API}/itineraries/preview-cost", json=self._payload(3, 1), timeout=30)
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["hotel_cost"] == 6300  # 4200 double + 1200 extra adult + 900 cwb
        assert c["total"] == 8268.75
        assert c["per_person"] == round(8268.75 / 4, 2)

    def test_two_adults_only(self, admin):
        c = admin.post(f"{API}/itineraries/preview-cost", json=self._payload(2), timeout=30).json()
        assert c["hotel_cost"] == 4200
        assert c["total"] == 5512.5

    def test_single_occupancy_uses_single_rate(self, admin):
        c = admin.post(f"{API}/itineraries/preview-cost", json=self._payload(1), timeout=30).json()
        assert c["hotel_cost"] == 2800

    def test_cnb_and_meal_plans(self, admin):
        c = admin.post(f"{API}/itineraries/preview-cost", json=self._payload(4, 1, 1, meal="ap"), timeout=30).json()
        # 2 pairs * 4800 + 900 cwb + 400 cnb
        assert c["hotel_cost"] == 4800 * 2 + 900 + 400
        c2 = admin.post(f"{API}/itineraries/preview-cost", json=self._payload(2, meal="cp"), timeout=30).json()
        assert c2["hotel_cost"] == 3500


# --- Share payload + accept ---
class TestShareAndAccept:
    @pytest.fixture(scope="class", autouse=True)
    def setup_itinerary(self, admin):
        hotels = admin.get(f"{API}/hotels", timeout=30).json()
        hotel = next(x for x in hotels if x["name"] == "Hotel Himalayan View")
        lead = admin.post(f"{API}/leads", json={
            "customer_name": "TEST_R3 Lead", "phone": "9800000031", "email": "delivered@resend.dev",
            "destination": "Sikkim/Darjeeling", "pax": 4, "adults": 3, "cwb": 1, "cnb": 0, "source": "website",
        }, timeout=30)
        assert lead.status_code == 200, lead.text
        STATE["lead_id"] = lead.json()["id"]
        br = admin.post(f"{API}/settings/branding", json={
            "sector": "Sikkim/Darjeeling", "header_banner": PNG, "footer_banner": PNG}, timeout=30)
        assert br.status_code == 200, br.text
        STATE["branding_id"] = br.json()["id"]
        r = admin.post(f"{API}/itineraries", json={
            "title": "TEST_R3 Magazine Proposal", "customer_name": "TEST_R3 Customer",
            "customer_email": "delivered@resend.dev", "customer_phone": "9800000031",
            "destination": "Sikkim/Darjeeling", "start_date": "2026-10-05",
            "pax": 4, "adults": 3, "cwb": 1, "cnb": 0, "lead_id": STATE["lead_id"],
            "days": [{"day": 1, "title": "Arrival", "from_place": "IXB/NJP", "to_place": "Gangtok",
                      "description": "<p>Drive along the <strong>Teesta valley</strong></p>",
                      "hotel_id": hotel["id"], "room_category": "Deluxe", "meal_plan": "map"}],
            "pricing": {"margin_pct": 25, "gst_enabled": True, "gst_pct": 5, "discount": 0},
            "terms": {"inclusions": "<p>TEST inc</p>", "exclusions": "<p>TEST exc</p>",
                      "payment_policy": "<p>TEST pay</p>", "cancellation_policy": "<p>TEST cxl</p>",
                      "important_notes": "<p>TEST notes</p>"},
        }, timeout=30)
        assert r.status_code == 200, r.text
        itin = r.json()
        STATE["itin_id"] = itin["id"]
        STATE["token"] = itin["share_token"]
        yield
        admin.delete(f"{API}/itineraries/{STATE['itin_id']}", timeout=30)
        admin.delete(f"{API}/leads/{STATE['lead_id']}", timeout=30)
        admin.delete(f"{API}/settings/branding/{STATE['branding_id']}", timeout=30)

    def test_costing_saved_on_itinerary(self, admin):
        itin = admin.get(f"{API}/itineraries/{STATE['itin_id']}", timeout=30).json()
        assert itin["costing"]["hotel_cost"] == 6300
        assert itin["costing"]["total"] == 8268.75

    def test_lead_moved_to_proposal_sent(self, admin):
        lead = next(x for x in admin.get(f"{API}/leads", timeout=30).json() if x["id"] == STATE["lead_id"])
        assert lead["status"] == "proposal_sent"

    def test_public_share_payload(self):
        r = requests.get(f"{API}/share/{STATE['token']}", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["destination"] == "Sikkim/Darjeeling"
        assert d["total"] == 8268.75
        assert d["adults"] == 3 and d["cwb"] == 1
        assert d["header_banner"].startswith("data:image/png;base64,")
        assert d["footer_banner"].startswith("data:image/png;base64,")
        assert d["company_whatsapp"].isdigit(), "share payload must include the company WhatsApp number"
        assert d["accepted"] is False
        day = d["days"][0]
        assert "Teesta valley" in day["description"]
        assert day["hotel_name"] == "Hotel Himalayan View"
        assert day["meal_plan"] == "Breakfast + Dinner (MAP)"
        assert isinstance(day["images"], list) and len(day["images"]) >= 1
        assert d["hero_image"]
        for k in ("inclusions", "exclusions", "payment_policy", "cancellation_policy", "important_notes"):
            assert d["terms"][k].startswith("<p>TEST")

    def test_share_unknown_token_404(self):
        assert requests.get(f"{API}/share/nope-token", timeout=30).status_code == 404

    def test_accept_quote_sets_flags_and_lead_won(self, admin):
        r = requests.post(f"{API}/share/{STATE['token']}/accept", timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "accepted"

        share = requests.get(f"{API}/share/{STATE['token']}", timeout=30).json()
        assert share["accepted"] is True

        itin = admin.get(f"{API}/itineraries/{STATE['itin_id']}", timeout=30).json()
        assert itin["accepted"] is True and itin.get("accepted_at")

        lead = next(x for x in admin.get(f"{API}/leads", timeout=30).json() if x["id"] == STATE["lead_id"])
        assert lead["status"] == "won"

    def test_accept_is_idempotent(self):
        assert requests.post(f"{API}/share/{STATE['token']}/accept", timeout=30).status_code == 200
        assert requests.get(f"{API}/share/{STATE['token']}", timeout=30).json()["accepted"] is True

    def test_accept_unknown_token_404(self):
        assert requests.post(f"{API}/share/nope-token/accept", timeout=30).status_code == 404
