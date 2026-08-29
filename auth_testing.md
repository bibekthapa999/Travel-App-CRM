# Auth Testing Playbook

## Step 1: MongoDB Verification
```
mongosh
use test_database
db.users.find({role: "admin"}).pretty()
db.users.findOne({role: "admin"}, {password_hash: 1})
```
Verify: bcrypt hash starts with `$2b$`, indexes exist on users.email (unique), login_attempts.identifier, password_reset_tokens.expires_at (TTL).

## Step 2: API Testing
```
curl -c cookies.txt -X POST $REACT_APP_BACKEND_URL/api/auth/login -H "Content-Type: application/json" -d '{"email":"thapa.holidays09@gmail.com","password":"Admin@123"}'
cat cookies.txt
curl -b cookies.txt $REACT_APP_BACKEND_URL/api/auth/me
```
Login returns the user object and sets `access_token` + `refresh_token` cookies. `/me` returns the same user using those cookies.

## Credentials (see /app/memory/test_credentials.md)
- Admin: thapa.holidays09@gmail.com / Admin@123
- Sales: priya@thapaholidays.com / Agent@123
- Operations: ops@thapaholidays.com / Ops@12345
- Finance: finance@thapaholidays.com / Finance@123
