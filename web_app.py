import os
import json
from aiohttp import web
from database import get_session
import crud
from config import ADMIN_ID
import asyncio
import logging
from sqlalchemy import select, func
from models import Order

# Directory for static files (Frontend)
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

async def get_stats(request):
    async for session in get_session():
        stats = await crud.get_admin_stats(session)
        # Mock user growth for the chart
        stats["user_growth"] = {
            "labels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            "values": [5, 12, 8, 15, 20, 18, 25]
        }
        return web.json_response(stats)

async def get_settings_data(request):
    async for session in get_session():
        settings = await crud.get_settings(session)
        channels = await crud.get_mandatory_channels(session)
        
        return web.json_response({
            "transfer_fee": settings.transfer_fee,
            "daily_gift_amount": settings.daily_gift_amount,
            "min_transfer_amount": settings.min_transfer_amount,
            "bot_name": settings.bot_name or "Billion Bot",
            "channels": [{"id": c.channel_id, "link": c.channel_link} for c in channels]
        })

async def update_settings_data(request):
    data = await request.json()
    async for session in get_session():
        await crud.update_settings(session, **data)
        return web.json_response({"status": "ok"})

async def add_channel(request):
    data = await request.json()
    async for session in get_session():
        await crud.add_mandatory_channel(session, data['id'], data['link'])
        return web.json_response({"status": "ok"})

async def delete_channel(request):
    data = await request.json()
    async for session in get_session():
        await crud.delete_mandatory_channel(session, data['id'])
        return web.json_response({"status": "ok"})

async def get_users(request):
    async for session in get_session():
        users = await crud.get_all_users(session)
        
        # Get orders count per user
        orders_q = await session.execute(
            select(Order.user_id, func.count(Order.id).label('cnt')).group_by(Order.user_id)
        )
        orders_map = {row.user_id: row.cnt for row in orders_q}
        
        return web.json_response([{
            "user_id": u.user_id,
            "first_name": u.first_name or "Unknown",
            "username": u.username or "",
            "points": u.points,
            "total_earned": (u.invites_count or 0) * 100,
            "is_banned": u.is_banned,
            "invites_count": u.invites_count or 0,
            "transfers_count": u.transfers_count or 0,
            "orders_count": orders_map.get(u.user_id, 0),
            "points_used": u.points_used or 0
        } for u in users])

async def toggle_ban(request):
    data = await request.json()
    async for session in get_session():
        user = await crud.toggle_ban_user(session, int(data['user_id']))
        if user:
            return web.json_response({"status": "ok", "is_banned": user.is_banned})
        return web.json_response({"status": "error"}, status=404)

async def add_points(request):
    data = await request.json()
    async for session in get_session():
        user = await crud.add_points_to_user(session, int(data['user_id']), int(data['points']))
        if user:
            return web.json_response({"status": "ok", "points": user.points})
        return web.json_response({"status": "error"}, status=404)

async def send_broadcast_all(request):
    data = await request.json()
    message = data.get('message')
    bot = request.app['bot']
    
    async for session in get_session():
        users = await crud.get_all_users(session)
        count = 0
        for u in users:
            try:
                await bot.send_message(u.user_id, message, parse_mode='HTML')
                count += 1
                # Small delay to keep Telegram happy
                await asyncio.sleep(0.05) 
            except Exception:
                continue
        return web.json_response({"status": "ok", "sent_count": count})

async def send_broadcast_user(request):
    data = await request.json()
    user_id = data.get('user_id')
    message = data.get('message')
    bot = request.app['bot']
    
    try:
        await bot.send_message(int(user_id), message, parse_mode='HTML')
        return web.json_response({"status": "ok"})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=400)

# --- Finance API ---
async def get_finance_data(request):
    async for session in get_session():
        stats = await crud.get_financial_stats(session)
        history = await crud.get_financial_history(session)
        
        return web.json_response({
            "stats": stats,
            "history": [{
                "id": h.id,
                "amount_usd": h.amount_usd,
                "points_added": h.points_added,
                "user_id": h.user_id,
                "description": h.description,
                "created_at": h.created_at.strftime("%Y-%m-%d %H:%M:%S")
            } for h in history]
        })

async def add_finance_record(request):
    data = await request.json()
    async for session in get_session():
        await crud.add_financial_record(
            session,
            amount=int(data.get('amount', 0)),
            points=int(data.get('points', 0)),
            description=data.get('description', ''),
            user_id=int(data.get('user_id')) if data.get('user_id') else None
        )
        return web.json_response({"status": "ok"})

async def handle_index(request):
    return web.FileResponse(os.path.join(STATIC_DIR, "index.html"))

def setup_web_app(bot):
    app = web.Application()
    app['bot'] = bot
    
    # API Routes
    app.router.add_get('/api/stats', get_stats)
    app.router.add_get('/api/settings', get_settings_data)
    app.router.add_post('/api/settings/update', update_settings_data)
    app.router.add_post('/api/channels/add', add_channel)
    app.router.add_post('/api/channels/delete', delete_channel)
    
    # Users API
    app.router.add_get('/api/users', get_users)
    app.router.add_post('/api/users/ban', toggle_ban)
    app.router.add_post('/api/users/points', add_points)
    
    # Broadcast API (v60)
    app.router.add_post('/api/broadcast/all', send_broadcast_all)
    app.router.add_post('/api/broadcast/user', send_broadcast_user)
    
    # Finance API (v73)
    app.router.add_get('/api/finance', get_finance_data)
    app.router.add_post('/api/finance/add', add_finance_record)
    
    # Static Files
    app.router.add_get('/', handle_index)
    app.router.add_static('/static/', path=STATIC_DIR, name='static')
    
    return app

async def start_web_server(app, host='0.0.0.0', port=8080):
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host, port)
    await site.start()
    logging.info(f"✅ Web Dashboard running at http://{host}:{port}")
