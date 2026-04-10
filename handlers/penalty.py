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

        # 3. Apply penalty for each subscription found (usually just one)
        settings = await crud.get_settings(session)
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
                await update.bot.send_message(
                    user_id,
                    f"⚠️ <b>تنبيه مغادرة</b> : لقد قمت بمغادرة القناة/المجموعة المموله <b>{update.chat.title or ''}</b>.\n"
                    f"تم خصم <b>{penalty_points}</b> نقطه من رصيدك كعقوبة.",
                    parse_mode="HTML"
                )
            except Exception:
                pass
