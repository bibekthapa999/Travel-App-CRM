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
from settings_routes import routes_router, settings_router
from vendors import hotels_router, vehicles_router

app = FastAPI()

for r in (auth_router, users_router, email_router, leads_router, hotels_router, vehicles_router, itineraries_router, share_router, bookings_router, invoices_router, dashboard_router, routes_router, settings_router):
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
                    {"category": "Deluxe",
                     "cp_single": 2800, "cp_double": 3500, "cp_extra_bed": 1200, "cp_cwb": 900, "cp_cnb": 400,
                     "map_single": 3400, "map_double": 4200, "map_extra_bed": 1500, "map_cwb": 1100, "map_cnb": 500,
                     "ap_single": 3900, "ap_double": 4800, "ap_extra_bed": 1800, "ap_cwb": 1300, "ap_cnb": 600},
                    {"category": "Premium Valley View",
                     "cp_single": 4200, "cp_double": 5200, "cp_extra_bed": 1500, "cp_cwb": 1100, "cp_cnb": 500,
                     "map_single": 5000, "map_double": 6000, "map_extra_bed": 1800, "map_cwb": 1300, "map_cnb": 600,
                     "ap_single": 5600, "ap_double": 6800, "ap_extra_bed": 2100, "ap_cwb": 1500, "ap_cnb": 700},
                ],
                "image_url": "https://images.unsplash.com/photo-1779547011126-c646b7de93b5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODh8MHwxfHNlYXJjaHwzfHxsdXh1cnklMjBtb3VudGFpbiUyMGhvdGVsJTIwcmVzb3J0JTIwcm9vbXxlbnwwfHx8fDE3ODc5OTkyNzJ8MA&ixlib=rb-4.1.0&q=85",
                "seasons": [{"label": "Peak Winter", "start": "2025-12-20", "end": "2026-01-10", "surcharge_pct": 25}],
                "active": True, "created_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "id": str(uuid.uuid4()), "name": "Goa Palms Beach Resort", "destination": "Goa", "star": 4,
                "contact_name": "Maria D'Souza", "phone": "919822045678", "email": "delivered+hotel-goapalms@resend.dev",
                "rooms": [
                    {"category": "Deluxe Garden View",
                     "cp_single": 3400, "cp_double": 4200, "cp_extra_bed": 1400, "cp_cwb": 1000, "cp_cnb": 500,
                     "map_single": 4200, "map_double": 5000, "map_extra_bed": 1700, "map_cwb": 1200, "map_cnb": 600,
                     "ap_single": 5000, "ap_double": 5800, "ap_extra_bed": 2000, "ap_cwb": 1400, "ap_cnb": 700},
                    {"category": "Sea View Suite",
                     "cp_single": 6000, "cp_double": 7500, "cp_extra_bed": 1800, "cp_cwb": 1300, "cp_cnb": 600,
                     "map_single": 7000, "map_double": 8500, "map_extra_bed": 2100, "map_cwb": 1500, "map_cnb": 700,
                     "ap_single": 8000, "ap_double": 9500, "ap_extra_bed": 2400, "ap_cwb": 1700, "ap_cnb": 800},
                ],
                "image_url": "https://images.unsplash.com/photo-1718359759373-1b2670b7478b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODh8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBtb3VudGFpbiUyMGhvdGVsJTIwcmVzb3J0JTIwcm9vbXxlbnwwfHx8fDE3ODc5OTkyNzJ8MA&ixlib=rb-4.1.0&q=85",
                "seasons": [{"label": "New Year Rush", "start": "2025-12-24", "end": "2026-01-05", "surcharge_pct": 40}],
                "active": True, "created_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "id": str(uuid.uuid4()), "name": "Jaipur Heritage Haveli", "destination": "Jaipur", "star": 3,
                "contact_name": "Vikram Singh", "phone": "919829078901", "email": "delivered+hotel-jaipur@resend.dev",
                "rooms": [{"category": "Royal Deluxe",
                           "cp_single": 2200, "cp_double": 2800, "cp_extra_bed": 900, "cp_cwb": 700, "cp_cnb": 300,
                           "map_single": 2800, "map_double": 3400, "map_extra_bed": 1100, "map_cwb": 850, "map_cnb": 350,
                           "ap_single": 3200, "ap_double": 3900, "ap_extra_bed": 1300, "ap_cwb": 1000, "ap_cnb": 400}],
                "image_url": "https://images.unsplash.com/photo-1595161695996-f746349f4945?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODh8MHwxfHNlYXJjaHwyfHxsdXh1cnklMjBtb3VudGFpbiUyMGhvdGVsJTIwcmVzb3J0JTIwcm9vbXxlbnwwfHx8fDE3ODc5OTkyNzJ8MA&ixlib=rb-4.1.0&q=85",
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


async def seed_extras():
    now = datetime.now(timezone.utc).isoformat()
    if await db.routes.count_documents({}) == 0:
        await db.routes.insert_many([
            {
                "id": str(uuid.uuid4()), "from_place": "IXB/NJP", "to_place": "Gangtok",
                "image_url": "https://images.unsplash.com/photo-1724600458551-7144f78ec0c0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzB8MHwxfHNlYXJjaHwxfHxHYW5ndG9rJTIwU2lra2ltJTIwbW91bnRhaW5zJTIwbW9uYXN0ZXJ5fGVufDB8fHx8MTc4Nzk5OTI3Mnww&ixlib=rb-4.1.0&q=85",
                "description": "<p>Upon arrival at <strong>IXB Airport / NJP Railway Station</strong>, you will be warmly received by our representative and driven through the emerald corridors of the Teesta valley towards <strong>Gangtok</strong> (approx. 125 km / 4.5 hrs). Watch the landscape transform from lush subtropical forests to crisp Himalayan ridges as you ascend. On arrival, check in to your hotel and unwind. The evening is free to stroll along the famous <em>MG Marg</em>, Gangtok's charming pedestrian promenade lined with cafes and local boutiques.</p>",
                "created_at": now,
            },
            {
                "id": str(uuid.uuid4()), "from_place": "NJP/IXB", "to_place": "Darjeeling",
                "image_url": "https://images.unsplash.com/photo-1661970072086-b7b1c3d7c787?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NDh8MHwxfHNlYXJjaHwxfHxEYXJqZWVsaW5nJTIwdGVhJTIwZ2FyZGVuJTIwaGlsbHN8ZW58MHx8fHwxNzg3OTk5MjcxMA&ixlib=rb-4.1.0&q=85",
                "description": "<p>Meet our driver at <strong>NJP / IXB</strong> and begin your scenic ascent to the Queen of the Hills, <strong>Darjeeling</strong> (approx. 75 km / 3 hrs). The route winds past rolling tea gardens, misty ridgelines and quaint hill hamlets. Check in to your hotel and spend the evening at <em>Chowrasta</em>, the lively mall square with sweeping views of the Kanchenjunga range.</p>",
                "created_at": now,
            },
            {
                "id": str(uuid.uuid4()), "from_place": "Phuentsholing", "to_place": "Thimphu",
                "image_url": "https://images.unsplash.com/photo-1772203228933-2d0f06bc36e7?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzR8MHwxfHNlYXJjaHwyfHxCaHV0YW4lMjB0aWdlciUyMG5lc3QlMjBtb25hc3Rlcnl8ZW58MHx8fHwxNzg3OTk5MjcyfDA&ixlib=rb-4.1.0&q=85",
                "description": "<p>After completing border formalities at <strong>Phuentsholing</strong>, drive into the Kingdom of Bhutan towards the capital <strong>Thimphu</strong> (approx. 165 km / 5 hrs). The mountain highway follows the Wang Chhu river past waterfalls, prayer-flag-draped bridges and terraced farms. Check in and take an evening walk through Thimphu's craft bazaars and the clock tower square.</p>",
                "created_at": now,
            },
        ])
    combo_routes = [
        {
            "from_place": "Gangtok", "to_place": "Pelling", "via": "Ravangla", "excursion": "",
            "day_title": "Transfer to Pelling via Ravangla Sightseeing",
            "image_url": "https://images.unsplash.com/photo-1661970072086-b7b1c3d7c787?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NDh8MHwxfHNlYXJjaHwxfHxEYXJqZWVsaW5nJTIwdGVhJTIwZ2FyZGVuJTIwaGlsbHN8ZW58MHx8fHwxNzg3OTk5MjcxMA&ixlib=rb-4.1.0&q=85",
            "description": "<p>After breakfast, check out and drive towards <strong>Pelling</strong> in West Sikkim, breaking the journey at the serene town of <strong>Ravangla</strong>. Visit the majestic <strong>Buddha Park (Tathagata Tsal)</strong> with its 130-ft statue of Lord Buddha set against the Himalayan panorama, and stroll through the manicured gardens. Continue the scenic drive through cardamom forests and terraced valleys to Pelling. On arrival, check in to your hotel. Evening at leisure with views of the Kanchenjunga range (weather permitting).</p>",
        },
        {
            "from_place": "Gangtok", "to_place": "", "via": "", "excursion": "Tsomgo Lake & Baba Mandir",
            "day_title": "Full Day Excursion to Tsomgo Lake & Baba Mandir",
            "image_url": "https://images.unsplash.com/photo-1697999145250-3cb1eca225c3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzB8MHwxfHNlYXJjaHwyfHxHYW5ndG9rJTIwU2lra2ltJTIwbW91bnRhaW5zJTIwbW9uYXN0ZXJ5fGVufDB8fHx8MTc4Nzk5OTI3Mnww&ixlib=rb-4.1.0&q=85",
            "description": "<p>After an early breakfast, set out on a full-day excursion to the sacred <strong>Tsomgo Lake</strong> (12,313 ft), a glacial lake whose colours shift with the seasons — locals believe monks once foretold the future from its waters. Continue to the revered <strong>Baba Harbhajan Singh Mandir</strong>, a shrine steeped in legend and maintained by the Indian Army. Return to Gangtok by evening. Overnight stay at your Gangtok hotel.</p>",
        },
    ]
    for cr in combo_routes:
        exists = await db.routes.find_one(
            {"from_place": cr["from_place"], "to_place": cr["to_place"], "via": cr["via"], "excursion": cr["excursion"]}
        )
        if not exists:
            cr.update(id=str(uuid.uuid4()), created_at=now)
            await db.routes.insert_one({**cr})
    if await db.terms_templates.count_documents({}) == 0:
        await db.terms_templates.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Standard Domestic Tour",
            "inclusions": "<ul><li>Accommodation in the listed hotels on the selected meal plan</li><li>All transfers & sightseeing by private vehicle as per itinerary</li><li>Driver allowance, tolls, parking and fuel</li><li>All applicable hotel taxes</li></ul>",
            "exclusions": "<ul><li>Airfare / train tickets unless mentioned</li><li>Entry fees, guide charges, camera fees and adventure activities</li><li>Personal expenses: laundry, tips, beverages, room service</li><li>Anything not explicitly mentioned under Inclusions</li></ul>",
            "payment_policy": "<p><strong>30% advance</strong> at the time of booking confirmation. <strong>Balance 70%</strong> payable at least 7 days before the travel start date. Bookings made within 7 days of travel require 100% payment.</p>",
            "cancellation_policy": "<ul><li>30+ days before travel: 10% of package cost</li><li>15–29 days: 30% of package cost</li><li>7–14 days: 50% of package cost</li><li>Under 7 days / no-show: 100% of package cost</li></ul>",
            "important_notes": "<ul><li>Hotels are subject to availability at the time of confirmation; equivalent alternatives may be offered.</li><li>Valid government photo ID is mandatory for all travellers.</li><li>Your data will be used in a professional manner and will not be disclosed to any third party.</li></ul>",
            "created_at": now,
        })
    if not await db.settings.find_one({"_id": "company"}):
        await db.settings.insert_one({"_id": "company", "whatsapp": "919876543210"})


async def fix_hotel_matrix():
    matrix = {
        "Hotel Himalayan View": {
            "image_url": "https://images.unsplash.com/photo-1779547011126-c646b7de93b5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODh8MHwxfHNlYXJjaHwzfHxsdXh1cnklMjBtb3VudGFpbiUyMGhvdGVsJTIwcmVzb3J0JTIwcm9vbXxlbnwwfHx8fDE3ODc5OTkyNzJ8MA&ixlib=rb-4.1.0&q=85",
            "rooms": {
                "Deluxe": {"cp_single": 2800, "cp_double": 3500, "cp_extra_bed": 1200, "cp_cwb": 900, "cp_cnb": 400,
                           "map_single": 3400, "map_double": 4200, "map_extra_bed": 1500, "map_cwb": 1100, "map_cnb": 500,
                           "ap_single": 3900, "ap_double": 4800, "ap_extra_bed": 1800, "ap_cwb": 1300, "ap_cnb": 600},
                "Premium Valley View": {"cp_single": 4200, "cp_double": 5200, "cp_extra_bed": 1500, "cp_cwb": 1100, "cp_cnb": 500,
                                        "map_single": 5000, "map_double": 6000, "map_extra_bed": 1800, "map_cwb": 1300, "map_cnb": 600,
                                        "ap_single": 5600, "ap_double": 6800, "ap_extra_bed": 2100, "ap_cwb": 1500, "ap_cnb": 700},
            },
        },
        "Goa Palms Beach Resort": {
            "image_url": "https://images.unsplash.com/photo-1718359759373-1b2670b7478b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODh8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBtb3VudGFpbiUyMGhvdGVsJTIwcmVzb3J0JTIwcm9vbXxlbnwwfHx8fDE3ODc5OTkyNzJ8MA&ixlib=rb-4.1.0&q=85",
            "rooms": {
                "Deluxe Garden View": {"cp_single": 3400, "cp_double": 4200, "cp_extra_bed": 1400, "cp_cwb": 1000, "cp_cnb": 500,
                                       "map_single": 4200, "map_double": 5000, "map_extra_bed": 1700, "map_cwb": 1200, "map_cnb": 600,
                                       "ap_single": 5000, "ap_double": 5800, "ap_extra_bed": 2000, "ap_cwb": 1400, "ap_cnb": 700},
                "Sea View Suite": {"cp_single": 6000, "cp_double": 7500, "cp_extra_bed": 1800, "cp_cwb": 1300, "cp_cnb": 600,
                                   "map_single": 7000, "map_double": 8500, "map_extra_bed": 2100, "map_cwb": 1500, "map_cnb": 700,
                                   "ap_single": 8000, "ap_double": 9500, "ap_extra_bed": 2400, "ap_cwb": 1700, "ap_cnb": 800},
            },
        },
        "Jaipur Heritage Haveli": {
            "image_url": "https://images.unsplash.com/photo-1595161695996-f746349f4945?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODh8MHwxfHNlYXJjaHwyfHxsdXh1cnklMjBtb3VudGFpbiUyMGhvdGVsJTIwcmVzb3J0JTIwcm9vbXxlbnwwfHx8fDE3ODc5OTkyNzJ8MA&ixlib=rb-4.1.0&q=85",
            "rooms": {
                "Royal Deluxe": {"cp_single": 2200, "cp_double": 2800, "cp_extra_bed": 900, "cp_cwb": 700, "cp_cnb": 300,
                                 "map_single": 2800, "map_double": 3400, "map_extra_bed": 1100, "map_cwb": 850, "map_cnb": 350,
                                 "ap_single": 3200, "ap_double": 3900, "ap_extra_bed": 1300, "ap_cwb": 1000, "ap_cnb": 400},
            },
        },
    }
    for name, fx in matrix.items():
        hotel = await db.hotels.find_one({"name": name})
        if not hotel:
            continue
        rooms = hotel.get("rooms", [])
        for r in rooms:
            m = fx["rooms"].get(r.get("category"))
            if m:
                r.update(m)
        await db.hotels.update_one({"id": hotel["id"]}, {"$set": {"rooms": rooms, "image_url": fx["image_url"]}})


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier")
    await db.itineraries.create_index("share_token", unique=True)
    await seed_users()
    await seed_inventory()
    await seed_extras()
    await fix_hotel_matrix()
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
