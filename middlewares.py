from typing import Any, Awaitable, Callable, Dict
import logging
from aiogram import BaseMiddleware
from aiogram.types import TelegramObject, Message, CallbackQuery
from database import get_session
import crud

class UserSyncMiddleware(BaseMiddleware):
    async def __call__(
        self,
        handler: Callable[[TelegramObject, Dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: Dict[str, Any],
    ) -> Any:
        # Check if the event is a message or callback query
        user = None
        if isinstance(event, (Message, CallbackQuery)):
            user = event.from_user

        if user:
            # Update user info in the database
            async for session in get_session():
                try:
                    # crud.get_or_create_user also handles updates for existing users
                    db_user = await crud.get_or_create_user(
                        session,
                        user_id=user.id,
                        first_name=user.full_name,
                        username=user.username
                    )
                    logging.info(f"UserSync: Synced user {user.id} ({user.full_name})")
                    # data['db_user'] = db_user # Optional: pass to handlers
                except Exception as e:
                    logging.error(f"UserSync Error for {user.id}: {e}")
                break # Ensure only one session usage

        return await handler(event, data)
