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
    
    # v73: Auto-migration for new columns
    from config import DB_PATH
    db_file = DB_PATH.replace("sqlite+aiosqlite:///", "")
    if os.path.exists(db_file):
        conn_sync = sqlite3.connect(db_file)
        cur = conn_sync.cursor()
        for col, definition in [("total_earned", "INTEGER DEFAULT 0"), ("joined_at", "DATETIME DEFAULT CURRENT_TIMESTAMP")]:
            try:
                cur.execute(f"ALTER TABLE users ADD COLUMN {col} {definition}")
                logging.info(f"Migration v73 (Users): Added column '{col}'")
            except Exception:
                pass  # Column already exists
        
        # v73: Finance Table Migration
        try:
            cur.execute("ALTER TABLE financial_records ADD COLUMN record_type TEXT DEFAULT 'sale'")
            logging.info("Migration v73 (Finance): Added column 'record_type'")
        except Exception:
            pass # Already exists
            
        conn_sync.commit()
        conn_sync.close()
        logging.info("Migration v73 complete.")

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
    await bot.delete_webhook(drop_pending_updates=True)
    me = await bot.get_me()
    logging.info(f"✅ Bot @{me.username} is now online and listening for updates!")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
