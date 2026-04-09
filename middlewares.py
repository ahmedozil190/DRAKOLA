from typing import Any, Awaitable, Callable, Dict
from aiogram import BaseMiddleware
from aiogram.types import Message, CallbackQuery, Update
from database import get_session
import crud

class UserSyncMiddleware(BaseMiddleware):
    async def __call__(
        self,
        handler: Callable[[Update, Dict[str, Any]], Awaitable[Any]],
        event: Message | CallbackQuery,
        data: Dict[str, Any],
    ) -> Any:
        # Get Telegram user details
        user = event.from_user
        if not user:
            return await handler(event, data)

        # Update or create user in background
        async for session in get_session():
            try:
                # get_or_create_user already handles updating if name/username changed
                db_user = await crud.get_or_create_user(
                    session,
                    user_id=user.id,
                    first_name=user.full_name,
                    username=user.username
                )
                # Attach db_user to data for convenience in handlers if needed later
                data['db_user'] = db_user
            except Exception as e:
                print(f"UserSyncMiddleware error: {e}")
            break # Exit after one session grab
            
        return await handler(event, data)
