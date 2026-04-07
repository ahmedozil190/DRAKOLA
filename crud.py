from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from models import User, Order, Subscription, MandatoryChannel, GlobalSettings

async def get_user(session: AsyncSession, user_id: int):
    result = await session.execute(select(User).where(User.user_id == user_id))
    return result.scalar_one_or_none()

async def create_user(session: AsyncSession, user_id: int, first_name: str, username: str = None):
    user = User(user_id=user_id, first_name=first_name, username=username)
    session.add(user)
    await session.commit()
    return user

async def get_or_create_user(session: AsyncSession, user_id: int, first_name: str, username: str = None):
    user = await get_user(session, user_id)
    if not user:
        user = await create_user(session, user_id, first_name, username)
    return user

async def update_user_points(session: AsyncSession, user_id: int, points_to_add: int):
    user = await get_user(session, user_id)
    if user:
        user.points += points_to_add
        await session.commit()
    return user

async def get_admin_stats(session: AsyncSession):
    q_users = await session.execute(select(func.count(User.user_id)))
    total_users = q_users.scalar()
    q_points = await session.execute(select(func.sum(User.points)))
    total_points = q_points.scalar() or 0
    q_orders = await session.execute(select(func.count(Order.id)).where(Order.status == 'active'))
    active_orders = q_orders.scalar()
    return {
        "total_users": total_users,
        "total_points": total_points,
        "active_orders": active_orders
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
