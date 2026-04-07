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

async def handle_index(request):
    return web.FileResponse(os.path.join(STATIC_DIR, "index.html"))

def setup_web_app():
    app = web.Application()
    
    # API Routes
    app.router.add_get('/api/stats', get_stats)
    app.router.add_get('/api/settings', get_settings_data)
    app.router.add_post('/api/settings/update', update_settings_data)
    app.router.add_post('/api/channels/add', add_channel)
    app.router.add_post('/api/channels/delete', delete_channel)
    
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
