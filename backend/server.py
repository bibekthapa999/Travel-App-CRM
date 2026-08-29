import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from auth import hash_password, router as auth_router, users_router, verify_password
from bookings import router as bookings_router
from dashboard import router as dashboard_router
from database import client, db
from emailer import email_router
from invoices import router as invoices_router
from itineraries import router as itineraries_router, share_router
from leads import router as leads_router
from vendors import hotels_router, vehicles_router

app = FastAPI()

for r in (auth_router, users_router, email_router, leads_router, hotels_router, vehicles_router, itineraries_router, share_router, bookings_router, invoices_router, dashboard_router):
    app.include_router(r)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/")
async def root():
    return {"message": "Thapa Holidays Travel CRM API"}


async def seed_users():
    now = datetime.now(timezone.utc).isoformat()
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one(
            {"id": str(uuid.uuid4()), "email": admin_email, "name": "Thapa Holidays Admin", "role": "admin", "password_hash": hash_password(admin_password), "created_at": now}
        )
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password), "role": "admin"}})

    demo_users = [
        ("priya@thapaholidays.com", "Priya Sharma", "sales", "Agent@123"),
        ("ops@thapaholidays.com", "Rohan Thapa", "operations", "Ops@12345"),
        ("finance@thapaholidays.com", "Anita Gurung", "finance", "Finance@123"),
    ]
    for email, name, role, pwd in demo_users:
        if not await db.users.find_one({"email": email}):
            await db.users.insert_one(
                {"id": str(uuid.uuid4()), "email": email, "name": name, "role": role, "password_hash": hash_password(pwd), "created_at": now}
            )


async def seed_inventory():
    if await db.hotels.count_documents({}) == 0:
        await db.hotels.insert_many([
            {
                "id": str(uuid.uuid4()), "name": "Hotel Himalayan View", "destination": "Manali", "star": 4,
                "contact_name": "Ramesh Kumar", "phone": "919816012345", "email": "delivered+hotel-himalayan@resend.dev",
                "rooms": [
                    {"category": "Deluxe", "cp": 3500, "map": 4200, "ap": 4800},
                    {"category": "Premium Valley View", "cp": 5200, "map": 6000, "ap": 6800},
                ],
                "seasons": [{"label": "Peak Winter", "start": "2025-12-20", "end": "2026-01-10", "surcharge_pct": 25}],
                "active": True, "created_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "id": str(uuid.uuid4()), "name": "Goa Palms Beach Resort", "destination": "Goa", "star": 4,
                "contact_name": "Maria D'Souza", "phone": "919822045678", "email": "delivered+hotel-goapalms@resend.dev",
                "rooms": [
                    {"category": "Deluxe Garden View", "cp": 4200, "map": 5000, "ap": 5800},
                    {"category": "Sea View Suite", "cp": 7500, "map": 8500, "ap": 9500},
                ],
                "seasons": [{"label": "New Year Rush", "start": "2025-12-24", "end": "2026-01-05", "surcharge_pct": 40}],
                "active": True, "created_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "id": str(uuid.uuid4()), "name": "Jaipur Heritage Haveli", "destination": "Jaipur", "star": 3,
                "contact_name": "Vikram Singh", "phone": "919829078901", "email": "delivered+hotel-jaipur@resend.dev",
                "rooms": [{"category": "Royal Deluxe", "cp": 2800, "map": 3400, "ap": 3900}],
                "seasons": [],
                "active": True, "created_at": datetime.now(timezone.utc).isoformat(),
            },
        ])
    if await db.vehicles.count_documents({}) == 0:
        await db.vehicles.insert_many([
            {"id": str(uuid.uuid4()), "vendor_name": "North Cabs", "vehicle_type": "Sedan", "route_from": "Delhi", "route_to": "Manali", "per_day_rate": 2500, "driver_charge": 500, "phone": "919811022334", "email": "delivered+veh-northcabs@resend.dev", "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "vendor_name": "Himalayan Wheels", "vehicle_type": "SUV", "route_from": "Chandigarh", "route_to": "Manali", "per_day_rate": 3800, "driver_charge": 600, "phone": "919876055667", "email": "delivered+veh-himalayan@resend.dev", "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "vendor_name": "Rajasthan Tempo Travels", "vehicle_type": "Tempo Traveller", "route_from": "Jaipur", "route_to": "Udaipur", "per_day_rate": 5500, "driver_charge": 700, "phone": "919829011223", "email": "delivered+veh-rtempo@resend.dev", "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        ])
    if await db.leads.count_documents({}) == 0:
        now = datetime.now(timezone.utc).isoformat()
        await db.leads.insert_many([
            {"id": str(uuid.uuid4()), "customer_name": "Aarav Mehta", "email": "aarav.mehta@example.com", "phone": "919900112233", "destination": "Manali", "travel_start": "2026-07-10", "travel_end": "2026-07-15", "pax": 4, "budget": 85000, "source": "Instagram", "notes": "Honeymoon-plus family trip, wants valley view rooms", "status": "new", "created_by": "seed", "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "customer_name": "Sneha Kulkarni", "email": "sneha.k@example.com", "phone": "919911223344", "destination": "Goa", "travel_start": "2026-08-01", "travel_end": "2026-08-05", "pax": 2, "budget": 60000, "source": "Referral", "notes": "Prefers sea-facing room", "status": "contacted", "created_by": "seed", "created_at": now, "updated_at": now},
        ])


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier")
    await db.itineraries.create_index("share_token", unique=True)
    await seed_users()
    await seed_inventory()
    vendor_email_fixups = {
        "Hotel Himalayan View": "delivered+hotel-himalayan@resend.dev",
        "Goa Palms Beach Resort": "delivered+hotel-goapalms@resend.dev",
        "Jaipur Heritage Haveli": "delivered+hotel-jaipur@resend.dev",
    }
    for name, email in vendor_email_fixups.items():
        await db.hotels.update_one({"name": name}, {"$set": {"email": email}})
    vehicle_email_fixups = {
        "North Cabs": "delivered+veh-northcabs@resend.dev",
        "Himalayan Wheels": "delivered+veh-himalayan@resend.dev",
        "Rajasthan Tempo Travels": "delivered+veh-rtempo@resend.dev",
    }
    for name, email in vehicle_email_fixups.items():
        await db.vehicles.update_one({"vendor_name": name}, {"$set": {"email": email}})


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
