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
    async with engine.begin() as conn:
        # Create tables if not exists
        await conn.run_sync(Base.metadata.create_all)

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
    app = setup_web_app()
    port = int(os.environ.get("PORT", 8080))
    asyncio.create_task(start_web_server(app, port=port)) # Run web server in background
    
    logging.info("Starting bot pooling...")
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
