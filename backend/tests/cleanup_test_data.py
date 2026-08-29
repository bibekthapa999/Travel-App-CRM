"""One-off cleanup of TEST_ data created during round-3 testing (run manually, not a pytest module)."""
import requests
from dotenv import dotenv_values

BASE = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"
s = requests.Session()
s.post(f"{API}/auth/login", json={"email": "thapa.holidays09@gmail.com", "password": "Admin@123"}, timeout=30)


def purge(path, pred, label):
    items = s.get(f"{API}/{path}", timeout=30).json()
    n = 0
    for it in items:
        if pred(it):
            r = s.delete(f"{API}/{path}/{it['id']}", timeout=30)
            n += r.status_code in (200, 204)
    print(f"{label}: deleted {n} of {len(items)}")


def has_test(it, *keys):
    return any(str(it.get(k, "")).startswith("TEST_") or "TEST_" in str(it.get(k, "")) for k in keys)


purge("itineraries", lambda i: has_test(i, "title", "customer_name"), "itineraries")
purge("bookings", lambda b: has_test(b, "customer_name", "destination"), "bookings")
purge("invoices", lambda i: has_test(i, "customer_name"), "invoices")
purge("leads", lambda l: has_test(l, "customer_name"), "leads")
purge("hotels", lambda h: has_test(h, "name"), "hotels")
purge("vehicles", lambda v: has_test(v, "vendor_name", "vehicle_type"), "vehicles")
purge("routes", lambda r: has_test(r, "from_place", "to_place"), "routes")
purge("settings/terms", lambda t: has_test(t, "name"), "terms")
branding = s.get(f"{API}/settings/branding", timeout=30).json()
for b in branding:
    if b["sector"].startswith("TEST_"):
        s.delete(f"{API}/settings/branding/{b['id']}", timeout=30)
print("remaining branding:", [b["sector"] for b in s.get(f"{API}/settings/branding", timeout=30).json()])
for path in ["itineraries", "bookings", "invoices", "leads", "hotels", "routes"]:
    print(path, "remaining:", len(s.get(f"{API}/{path}", timeout=30).json()))
