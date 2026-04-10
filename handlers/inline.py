import random
from aiogram import Router, F
from aiogram.types import InlineQuery, InlineQueryResultArticle, InputTextMessageContent, InlineKeyboardMarkup, InlineKeyboardButton

router = Router()

# List of promotional messages
PROMO_MESSAGES = [
    "✨ هل تحلم بقناة تليجرام نشطة ومليئة بالأعضاء المشاركين؟ لقد وصلت إلى المكان الصحيح! مع بوتنا، يمكنك زيادة أعضاء قناتك بسهولة وفعالية، مما يضمن لك تفاعل أكبر ووصولاً أوسع. لنبدأ الرحلة نحو النجاح معاً! ✨",
    "🌟 تحول قناتك إلى مركز للتفاعل والمحتوى المثير! استمتع بزيادة عدد الأعضاء وتحقيق مستوى جديد من التفاعل مع جمهورك. 🌟",
    "🎊 لا شيء يضاهي الإحساس بنجاح القناة الخاصة بك! اجعلها تحدث مع بوتنا وشاهد قناتك تزدهر أمام عينيك. 🎊",
    "✨ اكتشف الإمكانيات مع بوتنا وابدأ رحلة نجاح قناتك! أعضاء جدد، تفاعل أكبر، وتجربة تليجرام فريدة من نوعها تنتظرك! ✨",
    "🚀 مرحباً بك في بوت زيادة الأعضاء لقنوات التليجرام! نحن هنا لمساعدتك في تحقيق نمو مذهل لقناتك والوصول إلى أكبر عدد ممكن من الأعضاء المهتمين والنشطين. لا تفوت الفرصة لتصبح قناتك واحدة من القنوات الرائدة! 🚀",
    "💥 تحقيق النجاح لقناتك لم يكن بهذه السهولة من قبل! اكتشف الطرق الجديدة لزيادة الأعضاء والتفاعل في قناتك مع بوتنا! 💥",
    "🚀 الطريق إلى نجاح قناتك على تليجرام بات أقرب! استخدم بوتنا لجلب أعضاء جدد وبناء مجتمع نابض بالحياة حول محتواك المدهش. 🚀",
    "🎉 مرحباً في عالم تليجرام النابض بالحياة! مع بوتنا، يمكنك ضخ حياة جديدة في قناتك بجلب المزيد من الأعضاء المتحمسين والنشطين. دعنا ننمي قناتك معاً! 🎉",
    "🎈 انطلق نحو الأفق مع بوتنا! جذب أعضاء جدد ونشطين لقناتك لم يكن بهذه السهولة والفعالية من قبل. 🎈",
    "✨ اكتشف الإمكانيات مع بوتنا وابدأ رحلة نجاح قناتك! أعضاء جدد، تفاعل أكبر، وتجربة تليجرام فريدة من نوعها تنتظرك! ✨"
]

# List of button texts transcribed from images
BUTTON_LABELS = [
    "اركب أمواج النجاح معنا! 🌊",
    "انطلق لتصبح نجم تليجرام! 🚀",
    "اكتشف أسرار التفوق الآن! 🔍",
    "اجعل قناتك تتألق! 🌟",
    "انضم للحفلة وابدأ النجاح! 🎉",
    "انطلق نحو الإبداع معنا! 🚀"
]

@router.inline_query()
async def inline_handler(query: InlineQuery):
    from database import get_session
    import crud
    
    async for session in get_session():
        settings = await crud.get_settings(session)
        ref_reward = settings.referral_reward or 100
        
        user_id = query.from_user.id
        bot_info = await query.bot.get_me()
        bot_link = f"https://t.me/{bot_info.username}?start=REF{user_id}"
        
        # Pick random message and button label
        promo_text = random.choice(PROMO_MESSAGES)
        btn_text = random.choice(BUTTON_LABELS)
        
        # The button that will appear UNDER the shared message
        kbd = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text=btn_text, url=bot_link)]
        ])
        
        # Result: Advertising / Referral Template (Optimized for Clarity)
        result_ref = InlineQueryResultArticle(
            id=f"ref_v7_{user_id}",
            title=f"🎁 الحصول على {ref_reward} نقطة لكل صديق",
            description="مشاركة رابط الدعوة مع اصدقائك",
            thumbnail_url="https://img.icons8.com/color/48/add-user-male.png",
            input_message_content=InputTextMessageContent(
                message_text=promo_text
            ),
            reply_markup=kbd
        )
        
        # Send only the referral result as a clear article
        # Use switch_pm for the first option 'Start Bot' which preserves the query text on top
        await query.answer(
            results=[result_ref], 
            cache_time=1, 
            is_personal=True,
            switch_pm_text="اضغط هنا للدخول الى البوت !",
            switch_pm_parameter="start"
        )
