import os

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
_base = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not _base:
    raise RuntimeError("REACT_APP_BACKEND_URL missing from env and /app/frontend/.env")
BASE_URL = _base.rstrip("/")
API = f"{BASE_URL}/api"

CREDS = {
    "admin": ("thapa.holidays09@gmail.com", "Admin@123"),
    "sales": ("priya@thapaholidays.com", "Agent@123"),
    "operations": ("ops@thapaholidays.com", "Ops@12345"),
    "finance": ("finance@thapaholidays.com", "Finance@123"),
}


def _client(role):
    s = requests.Session()
    email, password = CREDS[role]
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Login failed for {role}: {r.status_code} {r.text[:300]}")
    return s


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    return s


@pytest.fixture(scope="session")
def admin():
    return _client("admin")


@pytest.fixture(scope="session")
def sales():
    return _client("sales")


@pytest.fixture(scope="session")
def ops():
    return _client("operations")


@pytest.fixture(scope="session")
def finance():
    return _client("finance")
