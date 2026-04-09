from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from models import User, Order, Subscription, MandatoryChannel, GlobalSettings, FinancialRecord, Coupon, CouponUsage, UserReport

async def get_user(session: AsyncSession, user_id: int):
    result = await session.execute(select(User).where(User.user_id == user_id))
    return result.scalar_one_or_none()

async def get_all_users(session: AsyncSession, limit: int = 100, offset: int = 0):
    result = await session.execute(
        select(User).order_by(User.user_id.desc()).limit(limit).offset(offset)
    )
    return result.scalars().all()

async def toggle_ban_user(session: AsyncSession, user_id: int):
    user = await get_user(session, user_id)
    if user:
        user.is_banned = not user.is_banned
        await session.commit()
    return user

async def add_points_to_user(session: AsyncSession, user_id: int, points: int):
    user = await get_user(session, user_id)
    if user:
        user.points += points
        await session.commit()
    return user

async def create_user(session: AsyncSession, user_id: int, first_name: str, username: str = None):
    import datetime
    user = User(user_id=user_id, first_name=first_name, username=username)
    try:
        user.joined_at = datetime.datetime.utcnow()  # v73: safe set
    except Exception:
        pass
    session.add(user)
    await session.commit()
    return user

async def get_or_create_user(session: AsyncSession, user_id: int, first_name: str, username: str = None):
    user = await get_user(session, user_id)
    if not user:
        user = await create_user(session, user_id, first_name, username)
    else:
        # Update user info if it changed
        if user.first_name != first_name or user.username != username:
            user.first_name = first_name
            user.username = username
            await session.commit()
    return user

async def update_user_points(session: AsyncSession, user_id: int, points_to_add: int):
    user = await get_user(session, user_id)
    if user:
        user.points += points_to_add
        await session.commit()
    return user

async def get_admin_stats(session: AsyncSession):
    # User Stats
    q_total_users = await session.execute(select(func.count(User.user_id)))
    total_users = q_total_users.scalar() or 0
    
    q_banned_users = await session.execute(select(func.count(User.user_id)).where(User.is_banned == True))
    banned_users = q_banned_users.scalar() or 0
    
    q_points = await session.execute(select(func.sum(User.points)))
    total_points = q_points.scalar() or 0
    
    # Order/Task Stats
    q_total_orders = await session.execute(select(func.count(Order.id)))
    total_orders = q_total_orders.scalar() or 0
    
    q_active_orders = await session.execute(select(func.count(Order.id)).where(Order.status == 'active'))
    active_orders = q_active_orders.scalar() or 0
    
    q_completed_orders = await session.execute(select(func.count(Order.id)).where(Order.status == 'completed'))
    completed_orders = q_completed_orders.scalar() or 0
    
    q_cancelled_orders = await session.execute(select(func.count(Order.id)).where(Order.status == 'cancelled'))
    cancelled_orders = q_cancelled_orders.scalar() or 0

    # Finance Stats (v99)
    # Sum of amount_usd where type = 'sale'
    q_revenue = await session.execute(select(func.sum(FinancialRecord.amount_usd)).where(FinancialRecord.record_type == 'sale'))
    total_revenue = q_revenue.scalar() or 0
    
    # Sum of amount_usd where type = 'expense'
    q_expenses = await session.execute(select(func.sum(FinancialRecord.amount_usd)).where(FinancialRecord.record_type == 'expense'))
    total_expenses = q_expenses.scalar() or 0
    
    # Count of sales
    q_sales_count = await session.execute(select(func.count(FinancialRecord.id)).where(FinancialRecord.record_type == 'sale'))
    total_sales_count = q_sales_count.scalar() or 0

    # Coupon Stats (v101)
    # Active coupons: is_active=True AND current_uses < max_uses
    q_active_coupons = await session.execute(select(func.count(Coupon.id)).where(Coupon.is_active == True, Coupon.current_uses < Coupon.max_uses))
    active_coupons = q_active_coupons.scalar() or 0
    
    # Finished coupons: is_active=False OR current_uses >= max_uses
    q_finished_coupons = await session.execute(select(func.count(Coupon.id)).where((Coupon.is_active == False) | (Coupon.current_uses >= Coupon.max_uses)))
    finished_coupons = q_finished_coupons.scalar() or 0
    
    return {
        "total_users": total_users,
        "banned_users": banned_users,
        "total_points": total_points,
        "total_orders": total_orders,
        "active_orders": active_orders,
        "completed_orders": completed_orders,
        "cancelled_orders": cancelled_orders,
        "total_revenue": total_revenue,
        "total_expenses": total_expenses,
        "total_sales": total_sales_count,
        "active_coupons": active_coupons,
        "finished_coupons": finished_coupons
    }

async def get_mandatory_channels(session: AsyncSession):
    result = await session.execute(select(MandatoryChannel))
    return result.scalars().all()

async def add_mandatory_channel(session: AsyncSession, channel_id: str, link: str):
    channel = MandatoryChannel(channel_id=channel_id, channel_link=link)
    session.add(channel)
    await session.commit()
    return channel

async def delete_mandatory_channel(session: AsyncSession, channel_id: str):
    q = select(MandatoryChannel).where(MandatoryChannel.channel_id == channel_id)
    result = await session.execute(q)
    channel = result.scalar_one_or_none()
    if channel:
        await session.delete(channel)
        await session.commit()
    return channel

async def get_settings(session: AsyncSession):
    result = await session.execute(select(GlobalSettings))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = GlobalSettings()
        session.add(settings)
        await session.commit()
    return settings

async def update_settings(session: AsyncSession, **kwargs):
    settings = await get_settings(session)
    for key, value in kwargs.items():
        setattr(settings, key, value)
    await session.commit()
    return settings

async def increment_broadcast_stat(session: AsyncSession, stat_type: str):
    # stat_type is either 'global' or 'targeted'
    settings = await get_settings(session)
    if stat_type == 'global':
        settings.total_global_broadcasts = (settings.total_global_broadcasts or 0) + 1
    elif stat_type == 'targeted':
        settings.total_targeted_broadcasts = (settings.total_targeted_broadcasts or 0) + 1
    await session.commit()
    return settings

# --- Financial Dashboard Features ---
from models import FinancialRecord

async def add_financial_record(session: AsyncSession, amount: int, points: int, description: str, user_id: int = None, record_type: str = "sale"):
    # 1. Add points to user if it's a SALE and user_id is provided
    if record_type == "sale" and user_id and points > 0:
        user = await get_user(session, user_id)
        if user:
            user.points = (user.points or 0) + points
    
    # 2. Save the record
    record = FinancialRecord(
        amount_usd=amount,
        points_added=points,
        user_id=user_id,
        description=description,
        record_type=record_type
    )
    session.add(record)
    await session.commit()
    return record

async def get_financial_history(session: AsyncSession, limit: int = 50):
    result = await session.execute(
        select(FinancialRecord).order_by(FinancialRecord.created_at.desc()).limit(limit)
    )
    return result.scalars().all()

async def get_financial_stats(session: AsyncSession):
    # Total Revenue (Sales)
    q_rev = await session.execute(
        select(func.sum(FinancialRecord.amount_usd)).where(FinancialRecord.record_type == 'sale')
    )
    total_revenue = q_rev.scalar() or 0
    
    # Total Expenses
    q_exp = await session.execute(
        select(func.sum(FinancialRecord.amount_usd)).where(FinancialRecord.record_type == 'expense')
    )
    total_expenses = q_exp.scalar() or 0
    
    # Sales Count
    q_count = await session.execute(
        select(func.count(FinancialRecord.id)).where(FinancialRecord.record_type == 'sale')
    )
    total_sales = q_count.scalar() or 0
    
    return {
        "total_revenue": total_revenue,
        "total_expenses": total_expenses,
        "total_sales": total_sales
    }

# --- Coupons ---
async def create_coupon(session: AsyncSession, code: str, points: int, max_uses: int):
    coupon = Coupon(code=code, points=points, max_uses=max_uses)
    session.add(coupon)
    await session.commit()
    return coupon

async def get_all_coupons(session: AsyncSession):
    result = await session.execute(
        select(Coupon).order_by(Coupon.id.desc())
    )
    return result.scalars().all()

async def delete_coupon(session: AsyncSession, code: str):
    result = await session.execute(select(Coupon).where(Coupon.code == code))
    coupon = result.scalar_one_or_none()
    if coupon:
        coupon.is_active = False
        await session.commit()
        return True
    return False

# --- Coupon Usage Restriction (v85) ---
async def check_coupon_already_used(session: AsyncSession, user_id: int, coupon_id: int):
    q = select(CouponUsage).where(CouponUsage.user_id == user_id, CouponUsage.coupon_id == coupon_id)
    result = await session.execute(q)
    return result.scalar_one_or_none() is not None

async def record_coupon_usage(session: AsyncSession, user_id: int, coupon_id: int):
    usage = CouponUsage(user_id=user_id, coupon_id=coupon_id)
    session.add(usage)
    # Note: caller should commit
    return usage

# --- Orders & Tasks Management (v113) ---
async def get_all_orders(session: AsyncSession, limit: int = 50, offset: int = 0):
    result = await session.execute(
        select(Order).order_by(Order.id.desc()).limit(limit).offset(offset)
    )
    return result.scalars().all()

async def update_order_status(session: AsyncSession, order_id: int, status: str):
    # status can be 'active', 'cancelled', 'completed', or 'delete'
    result = await session.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if order:
        if status == 'delete':
            await session.delete(order)
        else:
            order.status = status
        await session.commit()
    return order

# --- User Reports Management (v113) ---
async def get_all_reports(session: AsyncSession, limit: int = 50, offset: int = 0):
    result = await session.execute(
        select(UserReport).order_by(UserReport.id.desc()).limit(limit).offset(offset)
    )
    return result.scalars().all()

async def delete_report(session: AsyncSession, report_id: int):
    result = await session.execute(select(UserReport).where(UserReport.id == report_id))
    report = result.scalar_one_or_none()
    if report:
        await session.delete(report)
        await session.commit()
        return True
    return False
