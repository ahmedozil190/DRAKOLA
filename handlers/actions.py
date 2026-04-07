import datetime
import uuid
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from database import get_session
import crud
from keyboard import main_keyboard, cancel_keyboard

router = Router()

class TransferState(StatesGroup):
    waiting_for_amount = State()

@router.callback_query(F.data == "daily_gift")
async def daily_gift(call: CallbackQuery):
    async for session in get_session():
        user = await crud.get_user(session, call.from_user.id)
        if not user:
            return
            
        # Reset at Midnight (Local Time - assuming UTC+2 for Egypt/Cairo)
        tz = datetime.timezone(datetime.timedelta(hours=2))
        now_local = datetime.datetime.now(tz)
        
        if user.last_daily_gift:
            # last_daily_gift is stored in UTC
            last_local = user.last_daily_gift.replace(tzinfo=datetime.timezone.utc).astimezone(tz)
            if last_local.date() == now_local.date():
                text = "• <b>لقد حصلت على الهدية مسبقا , انتظر يوم واعد المحاولة !</b>"
                kbd = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="• رجوع •", callback_data="cancel_action")]])
                await call.message.edit_text(text, reply_markup=kbd, parse_mode="HTML")
                await call.answer()
                return
                
        settings = await crud.get_settings(session)
        user.points += settings.daily_gift_amount
        user.total_earned = (user.total_earned or 0) + settings.daily_gift_amount  # v73
        user.last_daily_gift = datetime.datetime.utcnow()
        user.daily_gifts_count = (user.daily_gifts_count or 0) + 1
        await session.commit()
        
        text = f"• <b>لقد حصلت على {settings.daily_gift_amount} نقاط هدية يومية </b>🎁"
        kbd = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="• رجوع •", callback_data="cancel_action")]])
        await call.message.edit_text(text, reply_markup=kbd, parse_mode="HTML")
        await call.answer()

@router.callback_query(F.data == "transfer_points")
async def start_transfer(call: CallbackQuery, state: FSMContext):
    async for session in get_session():
        settings = await crud.get_settings(session)
        text = "• <b>يمكنك تحويل عدد من النقاط الى شخص اخر من هنا  🌐</b>\n\n"
        text += "- فقط ارسل عدد النقاط التي تريد ارسالها وسيتم صنع رابط ارسله الى الشخاص المراد استلام نقاط\n\n"
        text += f"- عموله التحويل : <b>{settings.transfer_fee}</b>"
        
        kbd = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="• رجوع •", callback_data="cancel_action")]
        ])
        await call.message.edit_text(text, reply_markup=kbd, parse_mode="HTML")
        await state.set_state(TransferState.waiting_for_amount)
        await call.answer()

@router.message(TransferState.waiting_for_amount)
async def process_transfer_amount(message: Message, state: FSMContext):
    if not message.text.isdigit():
        kbd = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="• رجوع •", callback_data="cancel_action")]])
        await message.answer("يرجى إرسال أرقام فقط.", reply_markup=kbd)
        return
        
    amount = int(message.text)
    
    async for session in get_session():
        settings = await crud.get_settings(session)
        fee = settings.transfer_fee
        min_transfer = settings.min_transfer_amount
        total_cost = amount + fee
        
        sender = await crud.get_user(session, message.from_user.id)
        
        # 1. Check for insufficient points first
        if sender.points < total_cost:
            text = "• ليس لديك هذه القدر من النقاط 🚫!\n"
            text += f"- عموله التحويل : <b>{fee}</b>"
            kbd = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="• رجوع •", callback_data="cancel_action")]
            ])
            await message.reply(text, reply_markup=kbd, parse_mode="HTML")
            await state.clear()
            return
            
        # 2. Check for minimum amount (if have enough points)
        if amount < min_transfer:
            kbd = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="• رجوع •", callback_data="cancel_action")]])
            await message.reply(f"• يجب ان تكون النقاط اكبر من {min_transfer} 🚫 !", reply_markup=kbd)
            return

        code = uuid.uuid4().hex
        
        sender.points -= total_cost
        sender.transfers_count = (sender.transfers_count or 0) + 1
        sender.points_used = (sender.points_used or 0) + fee
        
        from models import TransferVoucher
        voucher = TransferVoucher(
            code=code,
            sender_id=sender.user_id,
            amount=amount
        )
        session.add(voucher)
        await session.commit()
        
        bot_info = await message.bot.get_me()
        link = f"https://t.me/{bot_info.username}?start=to{code}"
        
        text = f"• تم خصم {total_cost} من نقاطك\n\n"
        text += f"- عموله التحويل : <b>{fee}</b>\n"
        text += f"- مبلغ التحويل : {amount} نقطة\n\n"
        text += f"• رابط تحويل النقاط : \n{link}\n\n"
        text += "• ارسل الرابط للشخص المراد تحويل النقاط له \n\n"
        text += "• الرابط صالح لمده 30 يوم\n\n"
        text += "- يمكنك الضغط على زر تعطيل الرابط بعد اقل من 30 يوم لكي تقوم بسترداد نقاطك او قم بدخول على الرابط لاسترداد نقاطك"
        
        kbd = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="تعطيل الرابط ❌", callback_data=f"revoke_{code}")]
        ])
        
        await message.reply(text, disable_web_page_preview=True, reply_markup=kbd, parse_mode="HTML")
        await state.clear()

@router.callback_query(F.data.startswith("revoke_"))
async def revoke_voucher(call: CallbackQuery):
    code = call.data.split("_")[1]
    async for session in get_session():
        from models import TransferVoucher
        from sqlalchemy import select
        q = select(TransferVoucher).where(TransferVoucher.code == code)
        result = await session.execute(q)
        voucher = result.scalar_one_or_none()
        
        if not voucher:
            await call.answer("خطأ: الرابط غير موجود.", show_alert=True)
            return
            
        if voucher.sender_id != call.from_user.id:
            await call.answer("لا يمكنك تعطيل رابط لم تقم بصنعه.", show_alert=True)
            return

        kbd = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="• رجوع •", callback_data="cancel_action")]])

        if not voucher.is_active:
            # CASE: Already used/expired - EDIT the message in place as requested
            await call.message.edit_text("- <b>انتهت مدة الرابط</b> !", parse_mode="HTML", reply_markup=kbd)
            await call.answer()
            return
            
        # Get the ID of the message the link was replying to (for the new reply below)
        reply_to_id = call.message.reply_to_message.message_id if call.message.reply_to_message else None
        
        # Delete the link message
        try:
            await call.message.delete()
        except: pass

        # If it's active, revoke it and refund
        voucher.is_active = False
        user = await crud.get_user(session, call.from_user.id)
        user.points += voucher.amount
        await session.commit()
        
        # CASE: Successfully revoked - SEND as a NEW REPLY to the original message
        await call.message.bot.send_message(
            call.from_user.id, 
            f"- <b>تم تعطيل الرابط , وسترداد {voucher.amount} نقطة</b>", 
            parse_mode="HTML", 
            reply_markup=kbd,
            reply_to_message_id=reply_to_id
        )
        await call.answer()

@router.callback_query(F.data == "ongoing_funds")
async def ongoing_funds(call: CallbackQuery):
    async for session in get_session():
        from sqlalchemy import select
        from models import Order
        q = select(Order).where(Order.user_id == call.from_user.id, Order.status == 'active')
        result = await session.execute(q)
        orders = result.scalars().all()
        
        user = await crud.get_user(session, call.from_user.id)
        user_points = user.points if user else 0
        
        text = "<b>• جميع القنوات او مجموعاتك الجاري تمويلها التابعه لك</b>\n\n"
        text += "- اذا اردت زيادة عدد التمويل فقط قم بتمويل قناتك مجددا سيتم اضافه التمويل الجديد على القديم"
        
        btns = []
        # Row for each active order
        for order in orders:
            # Build URL if username exists
            url = f"https://t.me/{order.chat_username.replace('@', '')}" if order.chat_username else None
            
            row = []
            if url:
                row.append(InlineKeyboardButton(text=f"{order.chat_name}", url=url))
            else:
                row.append(InlineKeyboardButton(text=f"{order.chat_name}", callback_data=f"order_info_{order.id}"))
                
            row.append(InlineKeyboardButton(text=f"{order.current_members}/{order.required_members}", callback_data=f"order_info_{order.id}"))
            btns.append(row)
            
        # Navigation buttons
        if orders:
            btns.append([InlineKeyboardButton(text="تحديث القائمة", callback_data="ongoing_funds")])
        
        btns.append([InlineKeyboardButton(text="تمويل قناتك او مجموعتك", callback_data="fund_channel")])
        btns.append([InlineKeyboardButton(text="• رجوع •", callback_data="cancel_action")])
        
        kbd = InlineKeyboardMarkup(inline_keyboard=btns)
        
        await call.message.edit_text(text, parse_mode="HTML", reply_markup=kbd)
        await call.answer()
