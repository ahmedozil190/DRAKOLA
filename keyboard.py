from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

def main_keyboard(points: int = 0, is_start: bool = False, instruction_link: str = "", rules_link: str = "", buy_points_link: str = "") -> InlineKeyboardMarkup:
    """Returns the main menu keyboard using inline buttons aligned under the message."""
    btns = [
        [InlineKeyboardButton(text=f"عدد نقاطك : {points}", callback_data="my_points")],
        [InlineKeyboardButton(text="تمويل قناتك او مجموعتك", callback_data="fund_channel")],
        [InlineKeyboardButton(text="تجميع النقاط", callback_data="collect_points"), 
         InlineKeyboardButton(text="تحويل نقاط", callback_data="transfer_points")],
        [InlineKeyboardButton(text="التمويلات الجارية", callback_data="ongoing_funds"), 
         InlineKeyboardButton(text="معلومات حسابك", callback_data="account_info")],
        [InlineKeyboardButton(text="الهدية اليومية 🎁", callback_data="daily_gift")]
    ]
    
    # These 4 bottom buttons only show up on /start
    if is_start:
        def get_btn(label, link):
            if not link or len(link) < 10 or link == "https://":
                return InlineKeyboardButton(text=label, callback_data="link_coming_soon")
            return InlineKeyboardButton(text=label, url=link)

        btns.append([
            InlineKeyboardButton(text="رابط الدعوة ♾", callback_data="invite_link"), 
            get_btn("التعليمات البوت 🛠", instruction_link)
        ])
        btns.append([
            get_btn("القوانين ⛔️", rules_link), 
            get_btn("شراء نقاط 💰💎", buy_points_link)
        ])
        
    return InlineKeyboardMarkup(inline_keyboard=btns)
    
def cancel_keyboard() -> InlineKeyboardMarkup:
    """Returns a simple back/cancel button."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="• رجوع •", callback_data="cancel_action")]
    ])

def collect_menu_keyboard() -> InlineKeyboardMarkup:
    """Returns the keyboard for the Collect Points landing menu."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="الاشتراك في القنوات او المجموعات", callback_data="join_channels")],
        [InlineKeyboardButton(text="الاشتراك في القنوات ( تيربو)", callback_data="join_channels_turbo")],
        [InlineKeyboardButton(text="رابط الدعوة", callback_data="invite_link")],
        [InlineKeyboardButton(text="• رجوع •", callback_data="cancel_action")]
    ])

def collect_back_keyboard() -> InlineKeyboardMarkup:
    """Returns a back button for the collect points sub-sections."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="• رجوع •", callback_data="collect_points")]
    ])
