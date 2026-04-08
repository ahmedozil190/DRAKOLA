from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardRemove
from aiogram.filters import CommandStart, CommandObject
from aiogram.fsm.context import FSMContext
from database import get_session
import crud
from keyboard import main_keyboard
from config import MANDATORY_CHANNELS
from aiogram.enums import ChatMemberStatus

router = Router()

@router.callback_query(F.data == "cancel_action")
async def cancel_action_callback(call: CallbackQuery, state: FSMContext):
    await state.clear()
    async for session in get_session():
        user = await crud.get_user(session, call.from_user.id)
        
        user_mention = f'{{<a href="tg://user?id={call.from_user.id}">{call.from_user.full_name}</a>}}'
        greeting = f"<b>اهلاً بك </b>{user_mention}\n\n"
        greeting += "<b>ـ في بوت تمويل دراكولا➕🤖</b>\n\n"
        greeting += "<b>•البوت مخصص لتمويل القنوات</b>\n"
        greeting += "<b>والمجموعات عن طريق التجميع النقاط ✔️</b>\n\n"
        greeting += "<b>•أجمع نقاط وأستبدلها بـ مشتركين ♻️👤</b>\n"
        greeting += "<b>•العدد الكلي المستخدمين = 5m 🎖</b>\n" 
        greeting += "<b>• ارسل أمر /EeoK تعليماتي 📍</b>"
        
        await call.message.edit_text(greeting, parse_mode="HTML", reply_markup=main_keyboard(user.points if user else 0, is_start=False))
    await call.answer()

@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext, command: CommandObject):
    await state.clear()
    async for session in get_session():
        user = await crud.get_or_create_user(
            session, 
            user_id=message.from_user.id,
            first_name=message.from_user.full_name,
            username=message.from_user.username
        )
        
        # --- Mandatory Subscription Check ---
        db_channels = await crud.get_mandatory_channels(session)
        for channel in db_channels:
            try:
                member = await message.bot.get_chat_member(chat_id=channel.channel_id, user_id=message.from_user.id)
                if member.status in [ChatMemberStatus.LEFT, ChatMemberStatus.KICKED]:
                    raise Exception("Not a member")
            except Exception:
                # User is not in this channel, send mandatory subscription message as a reply
                text = (
                    "- لطفاً اشترك بالقناة واستخدم البوت .\n"
                    "- ثم اضغط /start ~\n"
                    "- قناة البوت 👾.👇🏻\n"
                    f"📬: {channel.channel_link}"
                )
                await message.reply(text, disable_web_page_preview=True)
                return
        # ------------------------------------

        if command.args and command.args.startswith("to"):
            code = command.args[2:]
            from models import TransferVoucher
            from sqlalchemy import select
            import datetime
            q = select(TransferVoucher).where(TransferVoucher.code == code)
            result = await session.execute(q)
            voucher = result.scalar_one_or_none()
            
            if voucher and voucher.is_active:
                now = datetime.datetime.utcnow()
                delta = now - voucher.created_at
                days_passed = delta.total_seconds() / 86400
                
                if days_passed > 30:
                    text = "- الرابط غير صحيح او انتهت مدة الرابط !"
                    kbd = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="• رجوع •", callback_data="cancel_action")]])
                    await message.reply(text, reply_markup=kbd)
                    return
                else:
                    if voucher.sender_id == user.user_id:
                        # Self refund
                        voucher.is_active = False
                        user.points += voucher.amount
                        await session.commit()
                        
                        # Show Recipient Success first
                        text_recipient = f"• تم اضافة {voucher.amount} نقاط الى حسابك ✅\n"
                        text_recipient += f"• بواسطه رابط التحويل من قبل : {voucher.sender_id} \n\n"
                        text_recipient += f"• اصبحت نقاطك : {user.points}"
                        
                        kbd = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="• رجوع •", callback_data="cancel_action")]])
                        await message.reply(text_recipient, reply_markup=kbd)
                        
                        # Then show Sender Notification
                        bot_info = await message.bot.get_me()
                        link = f"https://t.me/{bot_info.username}?start=to{voucher.code}"
                        text_sender = f"• تم اضافة {voucher.amount} نقاط الى حساب {user.user_id} ✅\n"
                        text_sender += f"• بواسطه رابط التحويل الخاص بك :\n {link}"
                        await message.reply(text_sender, disable_web_page_preview=True)
                        return
                    else:
                        # Someone else redeems
                        voucher.is_active = False
                        user.points += voucher.amount
                        await session.commit()
                        
                        # Notify Recipient
                        text_recipient = f"• تم اضافة {voucher.amount} نقاط الى حسابك ✅\n"
                        text_recipient += f"• بواسطه رابط التحويل من قبل : {voucher.sender_id} \n\n"
                        text_recipient += f"• اصبحت نقاطك : {user.points}"
                        
                        kbd = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="• رجوع •", callback_data="cancel_action")]])
                        await message.reply(text_recipient, reply_markup=kbd)
                        
                        # Notify Sender (different user)
                        try:
                            bot_info = await message.bot.get_me()
                            link = f"https://t.me/{bot_info.username}?start=to{voucher.code}"
                            text_sender = f"• تم اضافة {voucher.amount} نقاط الى حساب {user.user_id} ✅\n"
                            text_sender += f"• بواسطه رابط التحويل الخاص بك :\n {link}"
                            await message.bot.send_message(voucher.sender_id, text_sender, disable_web_page_preview=True)
                        except:
                            pass
                        
                        return
            else:
                text = "- الرابط غير صحيح او انتهت مدة الرابط !"
                kbd = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="• رجوع •", callback_data="cancel_action")]])
                await message.reply(text, reply_markup=kbd)
                return
        
        elif command.args and command.args.upper().startswith("REF"):
            try:
                referrer_id = int(command.args[3:])
                if referrer_id != user.user_id and not user.referred_by:
                    # New user and has a referrer
                    user.referred_by = referrer_id
                    
                    referrer = await crud.get_user(session, referrer_id)
                    if referrer:
                        referrer.points += 100
                        try:
                            referrer.total_earned = (referrer.total_earned or 0) + 100  # v73
                        except Exception:
                            pass
                        referrer.invites_count = (referrer.invites_count or 0) + 1
                        await session.commit()
                        
                        # Message to REFERRER (the one who shared the link)
                        new_user_name = message.from_user.first_name or "مستخدم"
                        new_user_id = message.from_user.id
                        referrer_text = (
                            f"🎉 هنيئاً لك! <a href='tg://user?id={new_user_id}'>{new_user_name}</a> قام بالانضمام عبر رابط الدعوة الخاص بك\n"
                            f"وقد حصلت على <b>100</b> نقطة/نقاط كمكافأة! ✨\n\n"
                            f"- رصيدك الحالي من النقاط هو: {referrer.points}"
                        )
                        try:
                            await message.bot.send_message(
                                referrer_id,
                                referrer_text,
                                parse_mode="HTML"
                            )
                        except:
                            pass
                        
                        # Message to NEW USER (the referred one) - reply to /start
                        referred_text = "• لقد دخلت بنجاح عبر الرابط الذي قدمه صديقك كدعوة، ونتيجة لذلك، حصل صديقك على 100 نقطة/نقاط كمكافأة ✨."
                        await message.reply(referred_text)
                        
                        # Welcome message (separate) - reply to /start
                        welcome_text = "مرحباً! لتبدأ التجربة مع البوت, فقط ارسل /start ودعونا نبدأ المغامرة معاً.. 🚀"
                        await message.reply(welcome_text)
            except:
                pass
        
        user_mention = f'{{<a href="tg://user?id={message.from_user.id}">{message.from_user.full_name}</a>}}'
        greeting = f"<b>اهلاً بك </b>{user_mention}\n\n"
        greeting += "<b>ـ في بوت تمويل دراكولا➕🤖</b>\n\n"
        greeting += "<b>•البوت مخصص لتمويل القنوات</b>\n"
        greeting += "<b>والمجموعات عن طريق التجميع النقاط ✔️</b>\n\n"
        greeting += "<b>•أجمع نقاط وأستبدلها بـ مشتركين ♻️👤</b>\n"
        greeting += "<b>•العدد الكلي المستخدمين = 5m 🎖</b>\n" 
        greeting += "<b>• ارسل أمر /EeoK تعليماتي 📍</b>"
        
        await message.reply(greeting, parse_mode="HTML", reply_markup=main_keyboard(user.points, is_start=True))

@router.message(F.text == "/EeoK")
async def cmd_eeok(message: Message):
    text = "📍 **تعليمات بوت تمويل دراكولا:**\n\n"
    text += "1. أجمع النقاط من خلال قسم 'تجميع النقاط' بالاشتراك في القنوات.\n"
    text += "2. استخدم النقاط لتمويل قناتك أو مجموعتك من خلال قسم 'تمويل قناتك'.\n"
    text += "3. يمكنك تحويل النقاط لأصدقائك عبر 'تحويل نقاط'.\n"
    text += "4. الحد الأدنى للتمويل هو 300 نقطة."
    await message.reply(text, parse_mode="Markdown")

@router.callback_query(F.data == "account_info")
async def account_info(call: CallbackQuery):
    async for session in get_session():
        from sqlalchemy import select, func
        from models import Order, Subscription
        user = await crud.get_user(session, call.from_user.id)
        if user:
            # Stats calculation
            ongoing_orders = await session.scalar(select(func.count(Order.id)).where(Order.user_id == user.user_id, Order.status == 'active'))
            joined_count = await session.scalar(select(func.count(Subscription.id)).where(Subscription.user_id == user.user_id))
            total_members_requested = await session.scalar(select(func.sum(Order.required_members)).where(Order.user_id == user.user_id)) or 0
            
            # Top Referrers
            from models import User
            top_q = select(User).where(User.invites_count > 0).order_by(User.invites_count.desc()).limit(4)
            top_res = await session.execute(top_q)
            top_users = top_res.scalars().all()
            
            ranks = ["🥇", "🥈", "🥉", "🏅"]
            top_text = ""
            if top_users:
                top_text += "\n- <b>المستخدمين الاكثر مشاركة لرابط الدعوى</b> : \n"
                for i, u in enumerate(top_users):
                    top_text += f"{ranks[i]}: ({u.invites_count or 0}) -> {u.user_id}\n"
            
            text = "• <b>مرحبا بك في معلومات حسابك في بوت التمويل 🌀</b>\n\n"
            text += f"- عدد القنوات او المجموعات الجاري تمويلها : {ongoing_orders}\n"
            text += f"- عدد نقاط حسابك : {user.points}\n\n"
            text += f"- عدد عمليات التحويل التي قمت بها : {user.transfers_count or 0}\n"
            text += f"- عدد القنوات التي شتركت بها : {joined_count}\n"
            text += f"- عدد الهدايا اليومية التي جمعتها : {user.daily_gifts_count or 0}\n"
            text += f"- عدد الاعضاء الذي قمت بطلبهم في عمليات التمويل : {total_members_requested}\n\n"
            text += f"- عدد مشاركاتك لرابط الدعوة : {user.invites_count or 0}\n"
            text += f"- عدد النقاط التي قمت بستخدامها : {user.points_used or 0}\n"
            text += top_text
            
            kbd = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="رابط الدعوة", callback_data="invite_link")],
                [InlineKeyboardButton(text="• رجوع •", callback_data="cancel_action")]
            ])
            await call.message.edit_text(text, reply_markup=kbd, parse_mode="HTML")
        await call.answer()
            
@router.callback_query(F.data == "my_points")
async def my_points_lbl(call: CallbackQuery):
    async for session in get_session():
        user = await crud.get_user(session, call.from_user.id)
        if user:
            await call.answer(f"نقاطك الحالية هي: {user.points}", show_alert=True)

@router.callback_query(F.data == "invite_link")
async def invite_link(call: CallbackQuery):
    async for session in get_session():
        user = await crud.get_user(session, call.from_user.id)
        bot_info = await call.message.bot.get_me()
        link = f"https://t.me/{bot_info.username}?start=REF{call.from_user.id}"
        
        # Top Referrers
        from sqlalchemy import select
        from models import User
        top_q = select(User).where(User.invites_count > 0).order_by(User.invites_count.desc()).limit(4)
        top_res = await session.execute(top_q)
        top_users = top_res.scalars().all()
        
        ranks = ["🥇", "🥈", "🥉", "🏅"]
        top_text = ""
        if top_users:
            top_text += "\n- المستخدمين الاكثر مشاركة لرابط الدعوى : \n"
            for i, u in enumerate(top_users):
                top_text += f"{ranks[i]}: ({u.invites_count or 0}) -> {u.user_id}\n"
        
        text = "انسخ الرابط ثم قم بمشاركته مع اصدقائك 📥 .\n\n"
        text += "- كل شخص يقوم بالدخول ستحصل على 100 نقطه 📊 .\n\n"
        text += "- بإمكانك عمل اعلان خاص برابط الدعوة الخاص بك 📬 .\n\n"
        text += "~ رابط الدعوة :\n\n"
        text += f"{link}\n\n"
        text += f"- مشاركتك للرابط : {user.invites_count or 0} 🌀\n"
        text += top_text
        
        kbd = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="مشاركة مع اصدقائك", switch_inline_query="")],
            [InlineKeyboardButton(text="• رجوع •", callback_data="cancel_action")]
        ])
        await call.message.edit_text(text, reply_markup=kbd)
        await call.answer()

@router.message(F.text & ~F.text.startswith("/"))
async def check_for_coupon(message: Message, state: FSMContext):
    # Only process if user is not in a specific state
    current_state = await state.get_state()
    if current_state is not None:
        return # Let State handlers do their job

    text = message.text.strip()
    async for session in get_session():
        from models import Coupon
        from sqlalchemy import select
        
        # 1. Fetch Coupon
        result = await session.execute(select(Coupon).where(Coupon.code == text))
        coupon = result.scalar_one_or_none()
        
        # 2. Validation Flow
        if not coupon:
            from handlers.admin import is_admin
            if is_admin(message.from_user.id):
                await message.reply(
                    "🚫 <b>عذراً، هذا الكود غير صحيح أو غير موجود.</b>\n"
                    "لعمل إذاعة، استخدم <code>/broadcast</code> يليه النص.",
                    parse_mode="HTML"
                )
            return

        # Check if Active
        if not coupon.is_active or coupon.current_uses >= coupon.max_uses:
            await message.reply(
                "⚠️ <b>عذراً، هذا الكوبون لم يعد متاحاً الآن!</b>\n\n"
                "• إما أنه انتهى وقته أو وصل للحد الأقصى من الاستخدامات.\n"
                "• حظاً أوفر في المرات القادمة! ✨", 
                parse_mode="HTML"
            )
            return

        # Check if Already Used
        already_used = await crud.check_coupon_already_used(session, message.from_user.id, coupon.id)
        if already_used:
            await message.reply(
                "❌ <b>عذراً، هذا الكود تم استخدامه مسبقاً من قبلك!</b>\n\n"
                "• نظامنا يسمح باستخدام كل كوبون مرة واحدة فقط لكل حساب.\n"
                "• يمكنك البحث عن كوبونات أخرى جديدة! 🔍", 
                parse_mode="HTML"
            )
            return

        # 3. Success Logic
        user = await crud.get_user(session, message.from_user.id)
        if not user: return
        
        user.points += coupon.points
        coupon.current_uses += 1
        if coupon.current_uses >= coupon.max_uses:
            coupon.is_active = False
            
        await crud.record_coupon_usage(session, user.user_id, coupon.id)
        await session.commit()
        
        # Success Message
        success_text = (
            f"🎁 <b>تهانينا! لقد استرددت الكوبون بنجاح ✨</b>\n\n"
            f"💰 تمت إضافة: <b>{coupon.points}</b> نقطة\n"
            f"📊 رصيدك الحالي: <b>{user.points}</b> نقطة\n\n"
            f"✅ استمتع بخدماتنا!"
        )
        await message.reply(success_text, parse_mode="HTML")
        return

