import asyncio
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from sqlalchemy import select, or_, and_, func
from database import get_session
import crud
from models import Order, Subscription, SkipRecord
import datetime
from keyboard import collect_menu_keyboard, collect_back_keyboard

router = Router()

async def show_no_channels(message=None, callback_query=None):
    text = "<b>لا يوجد قنوات في الوقت الحالي , قم يتجميع النقاط بطريقه مختلفه </b>!"
    
    kbd = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="رابط الدعوة", callback_data="invite_link")],
        [InlineKeyboardButton(text="• رجوع •", callback_data="collect_points")]
    ])
    
    if message:
        await message.answer(text, parse_mode="HTML", reply_markup=kbd)
    elif callback_query:
        await callback_query.message.edit_text(text, parse_mode="HTML", reply_markup=kbd)

@router.callback_query(F.data == "collect_points")
async def collect_points(call: CallbackQuery):
    text = "<b>مرحبا بك في قسم تجميع النقاط 📥 .</b>\n\n"
    text += "• <b>يمكنك الحصول على نقاط بطريقتين :</b>\n\n"
    text += "1 - عن طريق الاشتراك في القنوات او المجموعات\n\n"
    text += "2 - عن طريق مشاركة رابط الدعوة الى اصدقائك و سوف تحصل على 100 نقطه عند دخول اي شخص الى الرابط الخاص بك\n\n"
    text += "\n<b>~ اذ كانت طريقه التجميع صعبه راسل المطور لشراء النقاط 💰 .</b>\n\n"
    text += "<b>~ المطـور :</b> @A_M_E_15"
    
    await call.message.edit_text(text, parse_mode="HTML", reply_markup=collect_menu_keyboard())
    await call.answer()

@router.callback_query(F.data == "join_channels_turbo")
async def join_channels_turbo(call: CallbackQuery):
    await call.message.edit_text("<b>• انتظر بعض الوقت </b>.....", parse_mode="HTML")
    await asyncio.sleep(1)
    await send_turbo_channels(call.from_user.id, call.bot, callback_query=call)
    await call.answer()

async def send_turbo_channels(user_id: int, bot, message=None, callback_query=None, last_id: int = 0):
    async for session in get_session():
        now = datetime.datetime.utcnow()
        cooldown = now - datetime.timedelta(minutes=5)
        
        # Subqueries for exclusion
        sub_stmt = select(Subscription.order_id).where(Subscription.user_id == user_id)
        skip_stmt = select(SkipRecord.order_id).where(
            (SkipRecord.user_id == user_id) & (SkipRecord.skipped_at >= cooldown)
        )
        
        q = select(Order).where(
            Order.status == 'active', 
            Order.current_members < Order.required_members,
            Order.chat_type == 'channel',
            Order.user_id != user_id,
            ~Order.id.in_(sub_stmt),
            ~Order.id.in_(skip_stmt)
        ).order_by(Order.id.desc()).limit(40)
        
        result = await session.execute(q)
        candidates = result.scalars().all()
        
        if not candidates and last_id > 0:
            return await send_turbo_channels(user_id, bot, message, callback_query, 0)

        # Smart Filtering: Live Membership Check
        valid_orders = []
        for o in candidates:
            try:
                member = await bot.get_chat_member(o.chat_id, user_id)
                if member.status in ["left", "kicked"]:
                    valid_orders.append(o)
                if len(valid_orders) >= 10:
                    break
            except:
                continue

        if not valid_orders:
            await show_no_channels(message, callback_query)
            return

        order_ids = ",".join([str(o.id) for o in valid_orders])
        total_reward = len(valid_orders) * 10
        
        text = "• <b>اشترك في جميع القنوات التي تظهر في الازرار ادناه ✈️</b>\n"
        text += f"<b>- لكي تحصل على : {total_reward} نقطه</b>"
        
        kbd_rows = []
        for o in valid_orders:
            try:
                chat = await bot.get_chat(o.chat_id)
                url = chat.invite_link or (f"https://t.me/{chat.username}" if chat.username else f"https://t.me/c/{str(o.chat_id).replace('-100', '')}/1")
                kbd_rows.append([
                    InlineKeyboardButton(text=f"{o.chat_name}", url=url), 
                    InlineKeyboardButton(text="ابلاغ", callback_data=f"report_{o.id}")
                ])
            except:
                continue
            
        kbd_rows.append([InlineKeyboardButton(text="تحقق", callback_data=f"tv_{order_ids}")])
        kbd_rows.append([InlineKeyboardButton(text="• رجوع •", callback_data="collect_points")])
        
        kbd = InlineKeyboardMarkup(inline_keyboard=kbd_rows)
        
        if message:
            await message.answer(text, parse_mode="HTML", reply_markup=kbd, disable_web_page_preview=True)
        elif callback_query:
            await callback_query.message.edit_text(text, parse_mode="HTML", reply_markup=kbd, disable_web_page_preview=True)

@router.callback_query(F.data.startswith("tn_"))
async def turbo_next(call: CallbackQuery):
    data_parts = call.data.split("_")
    last_id = int(data_parts[1]) if len(data_parts) > 1 else 0
    await call.message.edit_text("<b>• انتظر بعض الوقت </b>.....", parse_mode="HTML")
    await asyncio.sleep(1)
    await send_turbo_channels(call.from_user.id, call.bot, callback_query=call, last_id=last_id)
    await call.answer()

@router.callback_query(F.data.startswith("tv_"))
async def turbo_verify(call: CallbackQuery):
    await call.message.edit_text("<b>• انتظر بعض الوقت </b>.....", parse_mode="HTML")
    await asyncio.sleep(1)
    
    ids_str = call.data[3:]
    if not ids_str:
        await call.answer("لا توجد قنوات للتحقق!", show_alert=True)
        return
        
    order_ids = [int(i) for i in ids_str.split(",") if i.strip()]
    success_count = 0
    total_reward = 0
    
    try:
        async for session in get_session():
            user = await crud.get_user(session, call.from_user.id)
            if not user: continue
            
            for oid in order_ids:
                order = await session.get(Order, oid)
                if not order or order.status != 'active': continue
                try:
                    member = await call.bot.get_chat_member(order.chat_id, call.from_user.id)
                    if member.status in ["member", "administrator", "creator"]:
                        sub_q = select(Subscription).where(Subscription.user_id == call.from_user.id, Subscription.order_id == order.id)
                        sub_res = await session.execute(sub_q)
                        if not sub_res.scalar_one_or_none():
                            sub = Subscription(user_id=call.from_user.id, order_id=order.id)
                            session.add(sub)
                        
                        user.points = (user.points or 0) + 10
                        order.current_members = (order.current_members or 0) + 1
                        if order.current_members >= order.required_members:
                            order.status = 'completed'
                        
                        session.add(user)
                        session.add(order)
                        success_count += 1
                        total_reward += 10
                except:
                    pass
            
            if success_count > 0:
                await session.commit()
                # Notify milestones
                for oid in order_ids:
                    try:
                        await notify_progress_milestones(session, call.bot, oid)
                    except: pass
                
                summary_text = f"<b>• تم اضافة {{{total_reward}}} نقاط الى حسابك </b>✅\n"
                summary_text += f"• بسبب الاشتراك في <b>{success_count}</b> قنوات \n\n"
                summary_text += "- (<b>اذا قمت بمغادرة اي قناة سيتم خصم ضعف النقاط</b>)"
                reward_kbd = InlineKeyboardMarkup(inline_keyboard=[
                    [InlineKeyboardButton(text="التالي", callback_data=f"tn_{order_ids[-1]}")], 
                    [InlineKeyboardButton(text="• رجوع •", callback_data="collect_points")]
                ])
                await call.message.edit_text(summary_text, parse_mode="HTML", reply_markup=reward_kbd)
            else:
                fail_text = "<b>• لم تشترك في قناة !</b>"
                fail_kbd = InlineKeyboardMarkup(inline_keyboard=[
                    [InlineKeyboardButton(text="اعد المحاوله", callback_data=f"tn_{order_ids[-1]}")], 
                    [InlineKeyboardButton(text="• رجوع •", callback_data="collect_points")]
                ])
                await call.message.edit_text(fail_text, parse_mode="HTML", reply_markup=fail_kbd)
            break
    except Exception as e:
        print(f"Critical error in turbo_verify: {e}")
        await call.message.edit_text("<b>• حدث خطأ أثناء التحقق، يرجى المحاولة لاحقاً</b>", parse_mode="HTML")
    
    await call.answer()

@router.callback_query(F.data == "join_channels")
async def join_channels(call: CallbackQuery):
    await send_next_channel(call.from_user.id, call.bot, callback_query=call)
    await call.answer()

async def send_next_channel(user_id: int, bot, message=None, callback_query=None, skip_id: int | None = None):
    async for session in get_session():
        now = datetime.datetime.utcnow()
        cooldown = now - datetime.timedelta(minutes=5)
        
        # Subqueries for exclusion
        sub_stmt = select(Subscription.order_id).where(Subscription.user_id == user_id)
        skip_stmt = select(SkipRecord.order_id).where(
            (SkipRecord.user_id == user_id) & (SkipRecord.skipped_at >= cooldown)
        )
        
        q = select(Order).where(
            Order.status == 'active', 
            Order.current_members < Order.required_members,
            Order.user_id != user_id,
            ~Order.id.in_(sub_stmt),
            ~Order.id.in_(skip_stmt)
        )
        
        if skip_id:
            q = q.where(Order.id > skip_id)
            
        q = q.order_by(Order.id).limit(50)
            
        result = await session.execute(q)
        candidates = result.scalars().all()
        
        # Wrap around: if nothing found > skip_id, try from the beginning (still filtering out recent skips)
        if not candidates and skip_id:
            q_wrap = select(Order).where(
                Order.status == 'active', 
                Order.current_members < Order.required_members,
                Order.user_id != user_id,
                ~Order.id.in_(sub_stmt),
                ~Order.id.in_(skip_stmt)
            ).order_by(Order.id.desc()).limit(50)
            
            result = await session.execute(q_wrap)
            candidates = result.scalars().all()
            
        order_to_show = candidates[0] if candidates else None
        
        if not order_to_show:
            await show_no_channels(message, callback_query)
            return

        try:
            chat = await bot.get_chat(order_to_show.chat_id)
            url = chat.invite_link or (f"https://t.me/{chat.username}" if chat.username else f"https://t.me/c/{str(order_to_show.chat_id).replace('-100', '')}/1")
            
            user = await crud.get_user(session, user_id)
            user_points = user.points if user else 0
            
            chat_type_text = "المجموعة" if chat.type in ["group", "supergroup"] else "القناة"
            
            text = f"• <b>اشترك في {chat_type_text} : </b><a href='{url}'>{order_to_show.chat_name}</a>\n\n"
            text += f"<b>- من ثم اضغط على تحقق لكي تحصل على </b>10<b> نقطه 🌎</b>\n\n"
            text += f"• نقاطك الحاليه : <b>{user_points}</b>"
            
            kbd = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text=f"{order_to_show.chat_name}", url=url)],
                [
                    InlineKeyboardButton(text="التالي", callback_data=f"skip_{order_to_show.id}"),
                    InlineKeyboardButton(text="تحقق", callback_data=f"verify_{order_to_show.id}")
                ],
                [InlineKeyboardButton(text="ابلاغ", callback_data=f"report_{order_to_show.id}")],
                [InlineKeyboardButton(text="• رجوع •", callback_data="collect_points")]
            ])
            
            if message:
                await message.answer(text, parse_mode="HTML", reply_markup=kbd, disable_web_page_preview=True)
            elif callback_query:
                await callback_query.message.edit_text(text, parse_mode="HTML", reply_markup=kbd, disable_web_page_preview=True)
        except:
            # If displaying this channel fails, automatically try the next one
            await send_next_channel(user_id, bot, message, callback_query, skip_id=order_to_show.id)

@router.callback_query(F.data.startswith("skip_"))
async def skip_channel(call: CallbackQuery):
    data = call.data.split("_")
    order_id = int(data[1]) if len(data) > 1 else None
    
    await call.answer("• جاري التحقق ...", show_alert=False)
    
    if order_id:
        async for session in get_session():
            order = await session.get(Order, order_id)
            if order and order.status == 'active':
                try:
                    member = await call.bot.get_chat_member(order.chat_id, call.from_user.id)
                    if member.status in ["member", "administrator", "creator"]:
                        # User joined! Reward them before skipping
                        sub_q = select(Subscription).where(Subscription.user_id == call.from_user.id, Subscription.order_id == order.id)
                        sub_res = await session.execute(sub_q)
                        if not sub_res.scalar_one_or_none():
                            sub = Subscription(user_id=call.from_user.id, order_id=order.id)
                            session.add(sub)
                        
                        user = await crud.get_user(session, call.from_user.id)
                        user.points = (user.points or 0) + 10
                        order.current_members = (order.current_members or 0) + 1
                        if order.current_members >= order.required_members:
                            order.status = 'completed'
                        await session.commit()
                        try:
                            await call.answer("تم التحقق! حصلت على 10 نقاط ✅", show_alert=True)
                        except: pass
                except:
                    pass
            
            # Safely notify milestones
            try:
                await notify_progress_milestones(session, call.bot, order_id)
            except Exception as e:
                print(f"Error in milestone notification (normal): {e}")
            
            # Simple Skip Recording
            skip_q = select(SkipRecord).where(SkipRecord.user_id == call.from_user.id, SkipRecord.order_id == order_id)
            skip_res = await session.execute(skip_q)
            skip_rec = skip_res.scalar_one_or_none()
            
            if skip_rec:
                skip_rec.skipped_at = datetime.datetime.utcnow()
            else:
                skip_rec = SkipRecord(user_id=call.from_user.id, order_id=order_id)
                session.add(skip_rec)
            
            await session.commit()
                    
    await send_next_channel(call.from_user.id, call.bot, callback_query=call, skip_id=order_id)

@router.callback_query(F.data.startswith("verify_"))
async def verify_sub(call: CallbackQuery):
    order_id = int(call.data.split("_")[1])
    await call.answer("• جاري التحقق ...", show_alert=False)
    
    async for session in get_session():
        order = await session.get(Order, order_id)
        user = await crud.get_user(session, call.from_user.id)
        
        if not order or order.status != 'active':
            await call.answer("هذه المهمة لم تعد نشطة!", show_alert=True)
            await send_next_channel(call.from_user.id, call.bot, callback_query=call)
            return
            
        try:
            member = await call.bot.get_chat_member(order.chat_id, call.from_user.id)
            if member.status in ["member", "administrator", "creator"]:
                sub_q = select(Subscription).where(Subscription.user_id == call.from_user.id, Subscription.order_id == order.id)
                sub_res = await session.execute(sub_q)
                if not sub_res.scalar_one_or_none():
                    sub = Subscription(user_id=call.from_user.id, order_id=order.id)
                    session.add(sub)
                
                user.points = (user.points or 0) + 10
                order.current_members = (order.current_members or 0) + 1
                if order.current_members >= order.required_members:
                    order.status = 'completed'
                    
                await session.commit()
                
                # Safely notify milestones
                try:
                    await notify_progress_milestones(session, call.bot, order.id)
                except Exception as e:
                    print(f"Error in milestone notification (single): {e}")

                try:
                    await call.answer("تم التحقق! حصلت على 10 نقاط ✅", show_alert=True)
                except: pass
                await send_next_channel(call.from_user.id, call.bot, callback_query=call, skip_id=order.id)
                return 
            else:
                # User did not join! Re-display the message with the warning
                chat = await call.bot.get_chat(order.chat_id)
                url = chat.invite_link or (f"https://t.me/{chat.username}" if chat.username else f"https://t.me/c/{str(order.chat_id).replace('-100', '')}/1")
                chat_type_text = "المجموعة" if chat.type in ["group", "supergroup"] else "القناة"
                
                text = f"• <b>اشترك في {chat_type_text} : </b><a href='{url}'>{order.chat_name}</a>\n\n"
                text += f"<b>- من ثم اضغط على تحقق لكي تحصل على </b>10<b> نقطه 🌎</b>\n\n"
                text += f"• نقاطك الحاليه : <b>{user.points}</b>\n\n"
                text += "<b>• اشترك في القناة اولا ❗️</b>"
                
                kbd = InlineKeyboardMarkup(inline_keyboard=[
                    [InlineKeyboardButton(text=f"{order.chat_name}", url=url)],
                    [
                        InlineKeyboardButton(text="التالي", callback_data=f"skip_{order.id}"),
                        InlineKeyboardButton(text="تحقق", callback_data=f"verify_{order.id}")
                    ],
                    [InlineKeyboardButton(text="ابلاغ", callback_data=f"report_{order.id}")],
                    [InlineKeyboardButton(text="• رجوع •", callback_data="collect_points")]
                ])
                
                await call.message.edit_text(text, parse_mode="HTML", reply_markup=kbd, disable_web_page_preview=True)
                await call.answer()
                return
        except:
            await call.answer("حدث خطأ أثناء التحقق.", show_alert=True)
            return
            
    # Fallback if session/order logic fails
    await send_next_channel(call.from_user.id, call.bot, callback_query=call)

@router.callback_query(F.data.startswith("report_"))
async def report_channel(call: CallbackQuery):
    await call.answer("✅ تم استلام بلاغك، سيتم مراجعته من قبل الإدارة. شكراً لك!", show_alert=True)

import html
async def notify_progress_milestones(session, bot, order_id: int):
    try:
        # Fetch fresh order state
        order = await session.get(Order, order_id)
        if not order or not order.required_members: return

        percentage = (order.current_members / order.required_members) * 100
        
        # Target Milestones
        milestones = [10, 30, 50, 70, 90, 100]
        reached_milestone = 0
        for m in milestones:
            if percentage >= m:
                reached_milestone = m
            else:
                break
                
        # Reset tracking if percentage dropped (e.g. order increased)
        if reached_milestone < order.last_milestone_sent:
            order.last_milestone_sent = reached_milestone
            session.add(order)
            await session.commit()
            return

        # Trigger notification only on NEW milestone reached
        if reached_milestone > order.last_milestone_sent:
            order.last_milestone_sent = reached_milestone
            session.add(order)
            await session.commit()
            
            # Prepare blue link for channel/group
            chat_url = f"https://t.me/{order.chat_username}" if order.chat_username else f"https://t.me/c/{str(order.chat_id).replace('-100', '')}/1"
            safe_name = html.escape(order.chat_name or "المهمة")
            chat_link = f"<a href='{chat_url}'>{safe_name}</a>"
            
            text = f"• نسبة التمويل الحالي (<b>{reached_milestone}%</b>)\n"
            text += f"- تم اضافة <b>{order.current_members}</b> علئ قيد الانتهاء\n"
            text += f"- {chat_link}\n"
            text += f"- العدد المطلوب : <b>{order.required_members}</b> 👤"
            
            try:
                await bot.send_message(order.user_id, text, parse_mode="HTML", disable_web_page_preview=True)
            except Exception as e:
                print(f"Failed to send milestone message: {e}")
    except Exception as e:
        print(f"Critical error in notify_progress_milestones: {e}")
