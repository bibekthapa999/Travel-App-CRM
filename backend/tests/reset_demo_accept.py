"""Reset the demo share proposal's accepted flag so the owner demo link stays pristine."""
import asyncio
import os

from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient

env = dotenv_values("/app/backend/.env")
MONGO_URL = os.environ.get("MONGO_URL") or env["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME") or env["DB_NAME"]
TOKEN = "IxwAnPBYwGI"


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    res = await db.itineraries.update_one(
        {"share_token": TOKEN},
        {"$set": {"accepted": False}, "$unset": {"accepted_at": ""}},
    )
    doc = await db.itineraries.find_one({"share_token": TOKEN}, {"_id": 0, "accepted": 1, "status": 1})
    print("matched:", res.matched_count, "modified:", res.modified_count, "doc:", doc)
    client.close()


asyncio.run(main())
