from aiogram import Router, F
from aiogram.types import ChatMemberUpdated
from database import get_session
import crud
from sqlalchemy import select
from models import Order, Subscription, User
import logging

router = Router()

@router.chat_member()
async def on_chat_member_update(update: ChatMemberUpdated):
    # We only care about users LEAVING
    # States that count as leaving: 'left', 'kicked'
    if update.new_chat_member.status not in ["left", "kicked"]:
        return

    user_id = update.from_user.id
    chat_id = update.chat.id
    
    logging.info(f"User {user_id} left chat {chat_id}. Checking for penalty...")

    async for session in get_session():
        # 1. Find the order(s) associated with this chat_id
        q_order = select(Order).where(Order.chat_id == chat_id)
        res_order = await session.execute(q_order)
        orders = res_order.scalars().all()
        
        if not orders:
            return

        order_ids = [o.id for o in orders]
        
        # 2. Check if this user has an active subscription for any of these orders
        q_sub = select(Subscription).where(
            Subscription.user_id == user_id,
            Subscription.order_id.in_(order_ids)
        )
        res_sub = await session.execute(q_sub)
        subs = res_sub.scalars().all()
        
        if not subs:
            return

        # 3. Check if penalty system is enabled
        settings = await crud.get_settings(session)
        if not settings.penalty_enabled:
            logging.info(f"Penalty system is disabled. Skipping penalty for user {user_id}.")
            return
        
        multiplier = settings.leave_penalty_multiplier or 2
        join_reward = settings.join_reward or 10
        penalty_points = join_reward * multiplier
        
        user = await crud.get_user(session, user_id)
        if user:
            user.points = max(0, (user.points or 0) - penalty_points)
            
            # 4. Remove the subscription so they aren't penalized again for the same order
            for sub in subs:
                await session.delete(sub)
            
            await session.commit()
            logging.info(f"Applied penalty of {penalty_points} to user {user_id} for leaving {chat_id}")
            
            # 5. Optionally notify the user
            try:
                # Prepare blue link for channel/group
                chat = update.chat
                url = f"https://t.me/{chat.username}" if chat.username else f"https://t.me/c/{str(chat.id).replace('-100', '')}/1"
                chat_link = f"<a href='{url}'>{chat.title or 'القناة/المجموعة'}</a>"
                
                await update.bot.send_message(
                    user_id,
                    f"🚫 <b>تنبيه: تم رصد مغادرة!</b>\n\n"
                    f"• لقد قمت للتو بمغادرة {chat_link}، وهو ما يخالف شروط البوت.\n"
                    f"• <b>العقوبة:</b> تم خصم <b>{penalty_points}</b> نقطة من رصيدك.\n\n"
                    f"<i>يرجى الالتزام بالبقاء في القنوات المموّلة لتجنب المزيد من الخصومات.</i>",
                    parse_mode="HTML",
                    disable_web_page_preview=True
                )
            except Exception:
                pass
