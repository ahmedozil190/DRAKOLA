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
            
        
        async for session in get_session():
            channels = await crud.get_mandatory_channels(session)
            if not channels:
                return await handler(event, data)
                
            unsubscribed_info = []
            for ch in channels:
                try:
                    # Check membership
                    member = await bot.get_chat_member(ch.channel_id, user_id)
                    if member.status in ["left", "kicked"]:
                        # Get Chat Title for the button
                        try:
                            chat = await bot.get_chat(ch.channel_id)
                            name = chat.title or "قناة/مجموعة"
                        except:
                            name = "قناة/مجموعة"
                        unsubscribed_info.append({"link": ch.channel_link, "name": name})
                except Exception as e:
                    logging.error(f"Error checking sub for {ch.channel_id}: {e}")
                    # If we can't check, we assume they need to subscribe? 
                    # Or we skip? Usually safer to assume they need to join if it's mandatory.
                    unsubscribed_info.append({"link": ch.channel_link, "name": "قناة مطلوبة"})
            
            if unsubscribed_info:
                # User is not subscribed to all channels!
                text = "<b>• عذراً، يجب عليك الاشتراك في القنوات التالية لاستخدام البوت 🔐:</b>\n\n"
                text += "- يرجى الاشتراك ثم الضغط على زر 'تم الاشتراك ✅' بالأسفل."
                
                btns = []
                for info in unsubscribed_info:
                    btns.append([InlineKeyboardButton(text=f"{info['name']}", url=info['link'])])
                
                btns.append([InlineKeyboardButton(text="تم الاشتراك ✅", callback_data="check_mandatory")])
                kbd = InlineKeyboardMarkup(inline_keyboard=btns)
                
                if isinstance(event, Message):
                    await event.answer(text, reply_markup=kbd, parse_mode="HTML")
                else:
                    await event.message.answer(text, reply_markup=kbd, parse_mode="HTML")
                    await event.answer()
                return # Block execution of the actual handler

        return await handler(event, data)
