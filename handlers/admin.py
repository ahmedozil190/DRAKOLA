from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from aiogram.filters import Command
from sqlalchemy import select, func
from database import get_session
import crud
from config import ADMIN_ID, ADMIN_WEB_APP_URL
from models import User, Order

router = Router()

# Admin Dashboard URL now comes from config.py
def is_admin(user_id: int):
    return user_id == ADMIN_ID

@router.message(Command("admin"))
async def admin_panel(message: Message):
    if not is_admin(message.from_user.id):
        return
        
    async for session in get_session():
        users_count = await session.scalar(select(func.count()).select_from(User))
        orders_count = await session.scalar(select(func.count()).select_from(Order))
        
        text = "📊 <b>لوحة تحكم الإدارة:</b>\n\n"
        text += f"👤 عدد المستخدمين: <b>{users_count}</b>\n"
        text += f"📦 عدد التمويلات الكلية: <b>{orders_count}</b>\n\n"
        text += "اضغط على الزر أدناه لفتح اللوحة الرسومية الجديدة والتحكم في كل شيء. 😊🚀🏁"
        
        kbd = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🚀 فتح لوحة التحكم", web_app=WebAppInfo(url=ADMIN_WEB_APP_URL))]
        ])
        
        await message.reply(text, parse_mode="HTML", reply_markup=kbd)

@router.callback_query(F.data == "admin_broadcast_legacy")
async def admin_broadcast_legacy_start(call: CallbackQuery):
    if not is_admin(call.from_user.id): return
    await call.message.answer("📢 أرسل الرسالة التي تريد إذاعتها لجميع المستخدمين (نص فقط):")
    await call.answer()



@router.message(Command("add_points"))
async def admin_add_points(message: Message):
    if not is_admin(message.from_user.id):
        return
        
    args = message.text.split()
    try:
        target_id_str = "".join(filter(str.isdigit, args[1]))
        amount_str = "".join(filter(str.isdigit, args[2]))
        target_id = int(target_id_str)
        amount = int(amount_str)
    except (ValueError, IndexError):
        await message.reply("استخدام خاطئ. الصيغة: `/add_points [الايدي] [النقاط]`")
        return
    
    async for session in get_session():
        user = await crud.get_user(session, target_id)
        if not user:
            await message.reply("المستخدم غير موجود.")
            return
        user.points += amount
        await session.commit()
        await message.reply(f"✅ تمت إضافة {amount} نقطة بنجاح.\nرصيد المستخدم الحالى: {user.points}")

@router.message(Command("broadcast"))
async def admin_broadcast_cmd(message: Message):
    if not is_admin(message.from_user.id): return
    text_to_send = message.text.replace("/broadcast", "").strip()
    if not text_to_send:
        await message.reply("يرجى كتابة الرسالة بعد الأمر.")
        return
        
    async for session in get_session():
        users = await session.execute(select(User))
        success = 0
        for u in users.scalars().all():
            try:
                await message.bot.send_message(u.user_id, text_to_send)
                success += 1
            except: pass
        await message.reply(f"✅ تمت الإذاعة بنجاح لـ {success} مستخدم.")
