import os
import json
from aiohttp import web
from database import get_session
import crud
from config import ADMIN_ID
import asyncio
import logging

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
    bot = request.app['bot']
    async for session in get_session():
        users = await crud.get_all_users(session)
        
        # Simple sync: update info for everyone on load (safe for reasonable user counts)
        # For large bots, this should be batches, but keeping it simple as requested
        for u in users:
            try:
                # Use a small timeout or try to avoid blocking if many users
                chat = await bot.get_chat(u.user_id)
                new_name = chat.full_name
                new_username = chat.username
                
                if u.first_name != new_name or u.username != new_username:
                    u.first_name = new_name
                    u.username = new_username
                    await session.commit()
            except Exception as e:
                # User might have blocked the bot or chat not found, skip
                continue

        return web.json_response([{
            "user_id": u.user_id,
            "first_name": u.first_name or "Unknown",
            "username": u.username or "",
            "points": u.points,
            "is_banned": u.is_banned,
            "invites_count": u.invites_count or 0,
            "transfers_count": u.transfers_count or 0,
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

async def handle_index(request):
    async for session in get_session():
        # Fetch ONLY stats for rapid injection
        stats = await crud.get_admin_stats(session)
        
        try:
            with open(os.path.join(STATIC_DIR, "index.html"), "r", encoding="utf-8") as f:
                content = f.read()
            
            # Inject only stats as a JS object
            script_tag = f"<script>window.serverStats = {json.dumps(stats)};</script>"
            content = content.replace("<!-- STATS_INJECTION -->", script_tag)
            
            return web.Response(text=content, content_type='text/html')
        except Exception as e:
            logging.error(f"Error injecting stats: {e}")
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
