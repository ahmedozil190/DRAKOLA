from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.exceptions import TelegramAPIError
from database import get_session
import crud
from keyboard import main_keyboard, cancel_keyboard
from sqlalchemy import select
from models import Order

router = Router()

class FundState(StatesGroup):
    waiting_for_members = State()
    waiting_for_type = State()
    waiting_for_chat = State()

@router.callback_query(F.data == "fund_channel")
async def start_funding(call: CallbackQuery, state: FSMContext):
    async for session in get_session():
        user = await crud.get_user(session, call.from_user.id)
        if not user: return
        
        settings = await crud.get_settings(session)
        min_p = settings.min_points_to_order or 300
        
        if user.points < min_p:
            text = f"<b>• عليك تجميع نقاط اكثر من {min_p} نقطه </b>!"
            kbd = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="تجميع النقاط", callback_data="collect_points")],
                [InlineKeyboardButton(text="• رجوع •", callback_data="cancel_action")]
            ])
            await call.message.edit_text(text, parse_mode="HTML", reply_markup=kbd)
            await call.answer()
            return
            
        settings = await crud.get_settings(session)
        cost_per = settings.member_cost or 15
        
        text = "• <b>ارسل عدد الاعضاء المراد تمويلهم او يمكنك الاختيار من الازرار 🌐</b>\n\n"
        text += f"- <b>ملاحضة</b> : كل 1 عضو يساوي <b>{cost_per}</b> نقطه \n\n"
        text += f"<b>- عدد نقاطك : <b>{user.points}</b></b>"
        
        kbd = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="تمويل جميع نقاطك", callback_data="fund_max")],
            [InlineKeyboardButton(text="تمويل 10 عضو", callback_data="fund_10")],
            [InlineKeyboardButton(text="• رجوع •", callback_data="cancel_action")]
        ])
        
        await call.message.edit_text(text, parse_mode="HTML", reply_markup=kbd)
        await state.set_state(FundState.waiting_for_members)
        await call.answer()

async def send_type_selection(call_or_message, members_count: int, state: FSMContext):
    user_id = call_or_message.from_user.id
    
    text = f"رائع لقد اخترت تمويل '<b>{members_count}</b>' عضو 💜\n\n"
    text += "- الان اختر ماذا تريد ان تقوم بتمويله <b>؟</b>"
    
    btns = []
    
    # Fetch active orders for top-up
    async for session in get_session():
        q = select(Order).where(Order.user_id == user_id, Order.status == 'active')
        result = await session.execute(q)
        active_orders = result.scalars().all()
        
        for order in active_orders:
            btns.append([InlineKeyboardButton(text=f"{order.chat_name}", callback_data=f"topup_order_{order.id}")])
            
    # Add standard types
    btns.extend([
        [
            InlineKeyboardButton(text="قناة خاصة", callback_data="type_private_channel"),
            InlineKeyboardButton(text="قناة عامة", callback_data="type_public_channel")
        ],
        [InlineKeyboardButton(text="مجموعة", callback_data="type_group")],
        [InlineKeyboardButton(text="• رجوع •", callback_data="cancel_action")]
    ])
    
    kbd = InlineKeyboardMarkup(inline_keyboard=btns)
    
    await state.update_data(members=members_count)
    if isinstance(call_or_message, CallbackQuery):
        await call_or_message.message.edit_text(text, parse_mode="HTML", reply_markup=kbd)
        await call_or_message.answer()
    else:
        await call_or_message.answer(text, parse_mode="HTML", reply_markup=kbd)
    await state.set_state(FundState.waiting_for_type)

@router.callback_query(FundState.waiting_for_members, F.data.in_(["fund_max", "fund_10"]))
async def process_members_buttons(call: CallbackQuery, state: FSMContext):
    async for session in get_session():
        user = await crud.get_user(session, call.from_user.id)
        if not user: return
        
        settings = await crud.get_settings(session)
        cost_per = settings.member_cost or 15
        
        members = 0
        if call.data == "fund_max":
            members = user.points // cost_per
        elif call.data == "fund_10":
            members = 10
            if user.points < (10 * cost_per):
                await call.answer(f"نقاطك غير كافية لتمويل 10 أعضاء! (تحتاج {10 * cost_per} نقطة)", show_alert=True)
                return
        
        min_m = settings.min_order_members or 5
        if members < min_m:
            await call.answer(f"عدد النقاط لا يكفي لتمويل الحد الأدنى ({min_m} أعضاء)!", show_alert=True)
            return
            
        await send_type_selection(call, members, state)

@router.message(FundState.waiting_for_members)
async def process_members_input(message: Message, state: FSMContext):
    if not message.text.isdigit():
        await message.reply("يرجى إرسال رقم صحيح.", parse_mode="HTML")
        return
        
    members = int(message.text)
    min_m = 5
    async for session in get_session():
        settings = await crud.get_settings(session)
        min_m = settings.min_order_members or 5

    if members < min_m:
        await message.reply(f"الحد الأدنى للتمويل هو <b>{min_m}</b> مشتركين.", parse_mode="HTML")
        return
        
    async for session in get_session():
        user = await crud.get_user(session, message.from_user.id)
        settings = await crud.get_settings(session)
        cost_per = settings.member_cost or 15
        cost = members * cost_per
        if user.points < cost:
            await message.reply(f"نقاطك غير كافية لتمويل <b>{members}</b> عضو.\nالتكلفة: <b>{cost}</b> نقطة\nرصيدك: <b>{user.points}</b>", parse_mode="HTML")
            return
            
        await send_type_selection(message, members, state)

@router.callback_query(FundState.waiting_for_type, F.data.startswith("type_"))
async def process_chat_type(call: CallbackQuery, state: FSMContext):
    selected_type = call.data.replace("type_", "")
    await state.update_data(chat_type=selected_type)
    
    if selected_type == "public_channel":
        text = "<b>- عليك اضافة هذا البوت ( @DRAKOLA1BOT ) الى القناة ومن ثم ترقية البوت الى مشرف فيها مع اعطاء البوت صلاحية دعوة المستخدمين🐝\n\n"
        text += "- ثم ارسل معرف القناة او رابط القناة العام\n\n"
        text += "~ اقرأ الخطوات جيدا ❤️</b>"
    elif selected_type == "private_channel":
        text = "<b>- عليك اضافة هذا البوت ( @DRAKOLA1BOT ) الى القناة ومن ثم ترقية البوت الى مشرف فيها مع اعطاء البوت صلاحية دعوة المستخدمين🐝\n\n"
        text += "- ثم ارسل توجيه من القناة رساله نصيه الى هنا\n\n"
        text += "~ اقرأ الخطوات جيدا ❤️</b>"
    else: # Group
        text = "- عليك اضافة هذه البوتات الى المجموعة ومن ثم ترقيتها الى مشرف في المجموعة مع اعطائها صلاحية دعوة المستخدمين 🐝\n\n"
        text += "البوت الاول : @DRAKOLA1BOT\n\n"
        text += "- بعد اضافة البوتات ارسل في المجموعة هذه الرساله : <code>تمويل الكروب</code>\n\n"
        text += "<b>~ اقرأ الخطوات جيدا ❤️</b>"
    
    await state.update_data(chat_type=selected_type, msg_id=call.message.message_id)
    await call.message.edit_text(text, parse_mode="HTML", reply_markup=cancel_keyboard())
    await state.set_state(FundState.waiting_for_chat)
    await call.answer()

@router.callback_query(FundState.waiting_for_type, F.data.startswith("topup_order_"))
async def process_topup(call: CallbackQuery, state: FSMContext):
    order_id = int(call.data.replace("topup_order_", ""))
    data = await state.get_data()
    members = data.get('members', 0)
    
    async for session in get_session():
        settings = await crud.get_settings(session)
        cost_per = settings.member_cost or 15
        cost = members * cost_per
        
        user = await crud.get_user(session, call.from_user.id)
        if user.points < cost:
            await call.answer("رصيدك غير كافٍ لإتمام التزويد!", show_alert=True)
            return
            
        q = select(Order).where(Order.id == order_id, Order.status == 'active')
        result = await session.execute(q)
        order = result.scalars().first()
        
        if not order:
            await call.answer("عذراً، هذا الطلب لم يعد نشطاً.", show_alert=True)
            return
            
        # Deduct and Update
        user.points -= cost
        user.points_used = (user.points_used or 0) + cost
        order.required_members += members
        await session.commit()
        
        text = f"• تم خصم (<b>{cost}</b>) نقاط\n"
        text += f"- وبدء تمويل قناتك <b>{members}</b> عضو 🚸\n\n"
        text += "<b>- اذا قمت بطرد البوت من القناة او تنزيله من الادمنيه اثناء التمويل سيتم استبعاد قناتك من التمويل !!!</b>"
        
        await call.message.edit_text(text, parse_mode="HTML", reply_markup=cancel_keyboard())
        await state.clear()
        await call.answer()

@router.message(FundState.waiting_for_chat)
async def process_chat(message: Message, state: FSMContext):
    data = await state.get_data()
    chat_type = data.get('chat_type')
    chat_id = None
    
    if chat_type == "private_channel":
        if message.forward_from_chat:
            chat_id = message.forward_from_chat.id
        else:
            # Show the same 'Not Admin' error even if they send a link or anything else
            text = "• البوت ليس ادمن في القناة \n\n- تأكد من رفع هذا البوت : @DRAKOLA1BOT"
            await message.reply(text, reply_markup=cancel_keyboard())
            return
    elif chat_type == "public_channel":
        if message.text:
            if message.text.startswith('@'):
                chat_id = message.text
            elif 't.me/' in message.text:
                chat_id = "@" + message.text.split('t.me/')[-1].split('/')[0]
            else:
                chat_id = "@" + message.text.strip()
        elif message.forward_from_chat:
            chat_id = message.forward_from_chat.id
            
    if not chat_id:
        await message.reply("<b>يرجى إرسال معرف القناة بشكل صحيح أو توجيه رسالة منها.</b>", parse_mode="HTML")
        return

    try:
        chat = await message.bot.get_chat(chat_id)
        bot_member = await message.bot.get_chat_member(chat.id, message.bot.id)
        
        if bot_member.status not in ["administrator", "creator"]:
            text = "• البوت ليس ادمن في القناة \n\n- تأكد من رفع هذا البوت : @DRAKOLA1BOT"
            await message.reply(text, reply_markup=cancel_keyboard())
            return
            
        if not bot_member.can_invite_users and bot_member.status != "creator":
            text = "• البوت ليس لديه صلاحية دعوة المستخدمين\n\n- تأكد من تفعيل هذه الصلاحية للبوت : @DRAKOLA1BOT"
            await message.reply(text, reply_markup=cancel_keyboard())
            return

        members = data['members']
        async for session in get_session():
            settings = await crud.get_settings(session)
            cost_per = settings.member_cost or 15
            join_reward = settings.join_reward or 10
            
            cost = members * cost_per
            reward_per_member = join_reward
            
            user = await crud.get_user(session, message.from_user.id)
            if user.points < cost:
                await message.reply("<b>عذراً، رصيدك غير كافٍ لإتمام هذه العملية.</b>", parse_mode="HTML")
                await state.clear()
                return

            # Check if an active order already exists for this chat and user
            # Convert chat.id to string for reliable comparison if needed, though BigInteger should match
            q = select(Order).where(Order.user_id == user.user_id, Order.chat_id == chat.id, Order.status == 'active')
            result = await session.execute(q)
            existing_order = result.scalars().first()

            user.points -= cost
            user.points_used = (user.points_used or 0) + cost
            
            if existing_order:
                existing_order.required_members += members
            else:
                order = Order(
                    user_id=user.user_id,
                    chat_id=chat.id,
                    chat_username=chat.username,
                    chat_name=chat.title,
                    chat_type="channel",
                    required_members=members,
                    reward_per_member=reward_per_member
                )
                session.add(order)
                
            await session.commit()
            
            text = f"• تم خصم (<b>{cost}</b>) نقاط\n"
            text += f"- وبدء تمويل قناتك <b>{members}</b> عضو 🚸\n\n"
            text += "<b>- اذا قمت بطرد البوت من القناة او تنزيله من الادمنيه اثناء التمويل سيتم استبعاد قناتك من التمويل !!!</b>"
            
            await message.reply(text, parse_mode="HTML", reply_markup=cancel_keyboard())
            await state.clear()
            
    except Exception:
        text = "• البوت ليس ادمن في القناة \n\n- تأكد من رفع هذا البوت : @DRAKOLA1BOT"
        await message.reply(text, reply_markup=cancel_keyboard())

from aiogram.fsm.storage.base import StorageKey

# ... (Existing code) ...

# Handler for "تمويل الكروب" inside Groups
@router.message(F.chat.type.in_(["group", "supergroup"]), F.text == "تمويل الكروب")
async def process_group_funding(message: Message, state: FSMContext):
    # Use StorageKey to access user's state in their private DM
    user_id = message.from_user.id
    key = StorageKey(bot_id=message.bot.id, chat_id=user_id, user_id=user_id)
    
    current_state = await state.storage.get_state(key=key)
    
    if current_state != FundState.waiting_for_chat:
        return # Not in funding flow or different user

    data = await state.storage.get_data(key=key)
    if data.get('chat_type') != "group":
        return

    try:
        bot_member = await message.bot.get_chat_member(message.chat.id, message.bot.id)
        if bot_member.status not in ["administrator", "creator"]:
            await message.reply("<b>عذراً، يجب ترقية البوت إلى مشرف في المجموعة أولاً!</b>", parse_mode="HTML")
            return
            
        if not bot_member.can_invite_users and bot_member.status != "creator":
            await message.reply("<b>يجب إعطاء البوت صلاحية 'دعوة المستخدمين' (Invite Users)!</b>", parse_mode="HTML")
            return

        members = data['members']
        async for session in get_session():
            settings = await crud.get_settings(session)
            cost_per = settings.member_cost or 15
            join_reward = settings.join_reward or 10
            
            cost = members * cost_per
            
            user = await crud.get_user(session, message.from_user.id)
            if user.points < cost:
                await message.answer("<b>رصيدك غير كافٍ!</b>", parse_mode="HTML")
                return

            # Check for existing active group order
            q = select(Order).where(Order.user_id == user.user_id, Order.chat_id == message.chat.id, Order.status == 'active')
            result = await session.execute(q)
            existing_order = result.scalars().first()

            user.points -= cost
            user.points_used = (user.points_used or 0) + cost
            
            if existing_order:
                existing_order.required_members += members
            else:
                order = Order(
                    user_id=user.user_id,
                    chat_id=message.chat.id,
                    chat_username=message.chat.username,
                    chat_name=message.chat.title,
                    chat_type="group",
                    required_members=members,
                    reward_per_member=join_reward
                )
                session.add(order)
                
            await session.commit()
            
            # Formatting the new confirmation message
            text = f"• تم خصم (<b>{cost}</b>) نقاط\n"
            text += f"- وبدء تمويل كروبك <b>{members}</b> عضو 🚸\n\n"
            text += "<b>- اذا قمت بطرد البوت من المجموعه او تنزيله من الادمنيه اثناء التمويل سيتم ستبعاد مجموعتك من التمويل !!!</b>"
            
            # Notify in Group with Reply
            await message.reply(text, parse_mode="HTML")
            
            # Notify in DM with Back button as a REPLY to the previous instruction message
            from keyboard import cancel_keyboard
            last_msg_id = data.get('msg_id')
            await message.bot.send_message(
                message.from_user.id, 
                text, 
                parse_mode="HTML", 
                reply_markup=cancel_keyboard(),
                reply_to_message_id=last_msg_id
            )
            await state.storage.set_state(key=key, state=None) # Clear user state

    except Exception as e:
        await message.reply(f"حدث خطأ أثناء معالجة الطلب: {e}")
