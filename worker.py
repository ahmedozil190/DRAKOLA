import asyncio
import logging
import datetime
from sqlalchemy import select, or_
from aiogram import Bot
from database import engine, get_session
from models import User

async def start_user_sync_worker(bot: Bot):
    """
    Background worker that periodically syncs user info from Telegram.
    Syncs users who haven't been updated in over 24 hours.
    """
    logging.info("Background User Sync Worker started.")
    
    while True:
        try:
            async for session in get_session():
                # Find users to sync: never synced or stale (Older than 24 hours)
                stale_threshold = datetime.datetime.utcnow() - datetime.timedelta(hours=24)
                
                stmt = select(User).where(
                    or_(
                        User.last_synced == None,
                        User.last_synced < stale_threshold
                    )
                ).limit(20) # Batch size to stay safe with rate limits
                
                result = await session.execute(stmt)
                users_to_sync = result.scalars().all()
                
                if not users_to_sync:
                    # No stale users, sleep and check later
                    break 

                logging.info(f"[Worker] Syncing batch of {len(users_to_sync)} users...")
                
                for user in users_to_sync:
                    try:
                        # Fetch latest info from Telegram
                        chat = await bot.get_chat(user.user_id)
                        
                        changed = False
                        if user.first_name != chat.first_name:
                            user.first_name = chat.first_name
                            changed = True
                        
                        if user.username != chat.username:
                            user.username = chat.username
                            changed = True
                            
                        user.last_synced = datetime.datetime.utcnow()
                        
                        if changed:
                            logging.info(f"[Worker] Updated User {user.user_id}: {user.first_name} (@{user.username})")
                        
                        await session.commit()
                    except Exception as e:
                        # Handle cases where user blocked the bot or doesn't exist anymore
                        user.last_synced = datetime.datetime.utcnow() # Mark as synced to skip next time
                        await session.commit()
                        logging.warning(f"[Worker] Could not sync user {user.user_id}: {e}")
                    
                    # Tiny sleep between individual user calls to avoid flooding
                    await asyncio.sleep(0.5)
                
                break # Exit session loop and wait for next main cycle
                
        except Exception as e:
            logging.error(f"[Worker] Critical Error: {e}")
        
        # Sleep for a while before the next check (e.g., 5 minutes)
        await asyncio.sleep(300) 
