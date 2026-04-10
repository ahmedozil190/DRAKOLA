from typing import Any, Callable, Dict, Awaitable
from aiogram import BaseMiddleware
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from database import get_session
import crud
from config import ADMIN_ID
import logging

class MandatorySubMiddleware(BaseMiddleware):
    async def __call__(
        self,
        handler: Callable[[Any, Dict[str, Any]], Awaitable[Any]],
        event: Any,
        data: Dict[str, Any]
    ) -> Any:
        # We only handle Messages and CallbackQueries
        if not isinstance(event, (Message, CallbackQuery)):
            return await handler(event, data)

        user_id = event.from_user.id
        bot = data['bot']
        
        # 1. Exempt Admins and Start Command (deep linking)
        if user_id == ADMIN_ID:
            return await handler(event, data)
        
        if isinstance(event, Message) and event.text:
            if event.text.startswith("/admin") or event.text.startswith("/id"):
                return await handler(event, data)
            
        # 2. Skip for callback data starting with 'check_mandatory' or 'rules_' etc if needed
        if isinstance(event, CallbackQuery) and event.data == "check_mandatory":
            return await handler(event, data)

        async for session in get_session():
            channels = await crud.get_mandatory_channels(session)
            if not channels:
                return await handler(event, data)
                
            unsubscribed = []
            for ch in channels:
                try:
                    # Check membership
                    # For private channels, the bot must be an admin to check non-admins?
                    # No, if the bot is in the channel, it can check.
                    member = await bot.get_chat_member(ch.channel_id, user_id)
                    if member.status in ["left", "kicked"]:
                        unsubscribed.append(ch)
                except Exception as e:
                    logging.error(f"Error checking sub for {ch.channel_id}: {e}")
                    unsubscribed.append(ch)
            
            if unsubscribed:
                # User is not subscribed to all channels!
                text = "<b>• عذراً، يجب عليك الاشتراك في القنوات التالية لاستخدام البوت 🔐:</b>\n\n"
                text += "- يرجى الاشتراك ثم الضغط على زر 'تم الاشتراك ✅' بالأسفل."
                
                btns = []
                for ch in unsubscribed:
                    btns.append([InlineKeyboardButton(text="اضغط هنا للاشتراك ➕", url=ch.channel_link)])
                
                btns.append([InlineKeyboardButton(text="تم الاشتراك ✅", callback_data="check_mandatory")])
                kbd = InlineKeyboardMarkup(inline_keyboard=btns)
                
                if isinstance(event, Message):
                    await event.answer(text, reply_markup=kbd, parse_mode="HTML")
                else:
                    await event.message.answer(text, reply_markup=kbd, parse_mode="HTML")
                    await event.answer()
                return # Block execution of the actual handler

        return await handler(event, data)
