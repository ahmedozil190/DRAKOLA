from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from models import User, Order, Subscription, MandatoryChannel, GlobalSettings

async def get_user(session: AsyncSession, user_id: int):
    result = await session.execute(select(User).where(User.user_id == user_id))
    return result.scalar_one_or_none()

async def get_all_users(session: AsyncSession, limit: int = 100, offset: int = 0):
    result = await session.execute(
        select(User).order_by(User.user_id.desc()).limit(limit).offset(offset) # v73: Newest first (by ID)
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
    
    return {
        "total_users": total_users,
        "banned_users": banned_users,
        "total_points": total_points,
        "total_orders": total_orders,
        "active_orders": active_orders,
        "completed_orders": completed_orders,
        "cancelled_orders": cancelled_orders
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
