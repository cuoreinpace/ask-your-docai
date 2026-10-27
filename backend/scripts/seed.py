"""Seed demo accounts for local development.

Usage:
    cd backend && python -m scripts.seed

Accounts created:
    paziente@demo.it / password123  (PATIENT, BASIC)
    medico@demo.it   / password123  (PHYSICIAN, STRONG)
"""

import asyncio
import os
import sys
from datetime import date, timedelta

import asyncpg
import bcrypt

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings  # noqa: E402

USERS = [
    {
        "id": "usr_demo_patient",
        "email": "paziente@demo.it",
        "password": "password123",
        "role": "PATIENT",
        "identity_level": "BASIC",
    },
    {
        "id": "usr_demo_physician",
        "email": "medico@demo.it",
        "password": "password123",
        "role": "PHYSICIAN",
        "identity_level": "STRONG",
    },
]


async def main() -> None:
    conn = await asyncpg.connect(settings.database_url)
    try:
        for u in USERS:
            password_hash = bcrypt.hashpw(u["password"].encode(), bcrypt.gensalt()).decode()
            await conn.execute(
                """INSERT INTO users (id, email, password_hash, role, email_verified, identity_level)
                   VALUES ($1, $2, $3, $4, TRUE, $5)
                   ON CONFLICT (id) DO UPDATE
                     SET email = EXCLUDED.email,
                         password_hash = EXCLUDED.password_hash,
                         role = EXCLUDED.role,
                         identity_level = EXCLUDED.identity_level""",
                *[u["id"], u["email"], password_hash, u["role"], u["identity_level"]],
            )
            print(f"seeded {u['role']}: {u['email']} / {u['password']}")

        await conn.execute(
            """INSERT INTO patient_profiles (user_id, birth_date, country, locale)
               VALUES ('usr_demo_patient', $1, 'ITA', 'it-IT')
               ON CONFLICT (user_id) DO NOTHING""",
            *[date(1990, 1, 1)],
        )
        await conn.execute(
            """INSERT INTO physician_profiles
               (user_id, professional_registration, specialty, verification_status, insurance_expiry)
               VALUES ('usr_demo_physician', 'DEMO-12345', 'Medicina interna', 'VERIFIED', $1)
               ON CONFLICT (user_id) DO NOTHING""",
            *[date.today() + timedelta(days=365)],
        )
        print("seed completed")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
