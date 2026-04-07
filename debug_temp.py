import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, func
from config import DB_PATH
from models import User

async def check_db():
    print(f"Checking database at: {DB_PATH}")
    # Using the path directly to avoid any issues
    db_file = os.path.join("data", "bot_database.sqlite3")
    if not os.path.exists(db_file):
        print(f"DATABASE FILE NOT FOUND AT {db_file}")
        return

    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}")
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            result = await session.execute(select(func.count(User.user_id)))
            count = result.scalar()
            print(f"SUCCESS: TOTAL USERS IN DB: {count}")
        except Exception as e:
            print(f"ERROR READING DB: {e}")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check_db())
