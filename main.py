import asyncio
import logging
from aiogram import Bot, Dispatcher
from config import BOT_TOKEN
from database import engine, Base
from aiogram.types import BotCommand

import handlers

# Setup logging
logging.basicConfig(level=logging.INFO)

async def set_commands(bot: Bot):
    commands = [
        BotCommand(command="start", description="رساله البدء")
    ]
    await bot.set_my_commands(commands)

async def init_db():
    from config import DATA_DIR
    import os
    import sqlite3
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR, exist_ok=True)
        logging.info(f"Created persistent data directory at: {DATA_DIR}")
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logging.info("Database initialized successfully.")
    
    # Consolidated Database Migrations (v73)
    from config import DB_PATH
    db_file = DB_PATH.replace("sqlite+aiosqlite:///", "")
    if os.path.exists(db_file):
        conn_sync = sqlite3.connect(db_file)
        cur = conn_sync.cursor()
        
        # Migrations List: (Table, Column, Definition)
        migrations = [
            ("users", "total_earned", "INTEGER DEFAULT 0"),
            ("users", "joined_at", "DATETIME DEFAULT CURRENT_TIMESTAMP"),
            ("global_settings", "bot_name", "TEXT DEFAULT 'Billion Bot'"),
            ("global_settings", "total_global_broadcasts", "INTEGER DEFAULT 0"),
            ("global_settings", "total_targeted_broadcasts", "INTEGER DEFAULT 0"),
            ("financial_records", "record_type", "TEXT DEFAULT 'sale'"),
            ("users", "last_synced", "DATETIME")
        ]
        
        for table, col, definition in migrations:
            try:
                cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {definition}")
                logging.info(f"Migration: Added {table}.{col}")
            except Exception:
                pass # Already exists
        
        conn_sync.commit()
        conn_sync.close()
        logging.info("Database migrations check complete.")

async def main():
    await init_db()
    
    # Initialize Bot
    if BOT_TOKEN == "YOUR_BOT_TOKEN_HERE" or not BOT_TOKEN:
        logging.error("Please configure BOT_TOKEN in .env or config.")
        return
        
    bot = Bot(token=BOT_TOKEN)
    await set_commands(bot)
    dp = Dispatcher()
    
    # Include handler routers
    dp.include_router(handlers.user.router)
    dp.include_router(handlers.actions.router)
    dp.include_router(handlers.fund.router)
    dp.include_router(handlers.collect.router)
    dp.include_router(handlers.admin.router)
    dp.include_router(handlers.inline.router)
    
    import os
    logging.info("Starting Web Dashboard server...")
    from web_app import setup_web_app, start_web_server
    app = setup_web_app(bot)
    port = int(os.environ.get("PORT", 8080))
    asyncio.create_task(start_web_server(app, port=port)) # Run web server in background
    
    logging.info("Starting bot pooling...")
    from worker import start_user_sync_worker
    asyncio.create_task(start_user_sync_worker(bot))

    await bot.delete_webhook(drop_pending_updates=True)
    me = await bot.get_me()
    logging.info(f"✅ Bot @{me.username} is now online and listening for updates!")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
