import asyncio
from database import engine
from models import Base, Coupon

async def upgrade_db():
    print("Starting Coupon table creation...")
    async with engine.begin() as conn:
        # Provide the list of tables we want created to ensure it only creates coupons 
        # or anything else missing instead of dropping. 
        # However, create_all handles "IF NOT EXISTS" implicitly.
        await conn.run_sync(Base.metadata.create_all)
    print("Coupon table created successfully.")

if __name__ == "__main__":
    asyncio.run(upgrade_db())
