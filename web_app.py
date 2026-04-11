import os
import json
from aiohttp import web
from aiohttp.web import FileResponse
from database import get_session
import crud
import datetime
from config import ADMIN_ID
import asyncio
import logging
from sqlalchemy import select, func
from models import Order, UserReport

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
            "total_global": settings.total_global_broadcasts or 0,
            "total_targeted": settings.total_targeted_broadcasts or 0,
            "instruction_link": settings.instruction_link or "https://",
            "rules_link": settings.rules_link or "https://",
            "buy_points_link": settings.buy_points_link or "",
            "referral_reward": settings.referral_reward or 100,
            "join_reward": settings.join_reward or 10,
            "member_cost": settings.member_cost or 15,
            "min_order_members": settings.min_order_members or 5,
            "min_points_to_order": settings.min_points_to_order or 300,
            "leave_penalty_multiplier": settings.leave_penalty_multiplier or 2,
            "penalty_enabled": settings.penalty_enabled if settings.penalty_enabled is not None else True,
            "support_username": settings.support_username or "",
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
        users = await crud.get_all_users(session) # Returns all users
        
        # Live Sync for a batch of users to ensure "Immediate" updates (v123)
        # We sync first 30 to keep it fast.
        sync_batch = users[:30] 
        updates_made = False
        
        async def sync_user_info(u):
            nonlocal updates_made
            try:
                chat = await bot.get_chat(u.user_id)
                if chat.full_name and u.first_name != chat.full_name:
                    u.first_name = chat.full_name
                    updates_made = True
                if chat.username != u.username:
                    u.username = chat.username
                    updates_made = True
            except Exception:
                pass
        
        # Sync in batches of 10
        for i in range(0, len(sync_batch), 10):
            batch = sync_batch[i:i+10]
            await asyncio.gather(*(sync_user_info(u) for u in batch))

        if updates_made:
            await session.commit()

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
                await asyncio.sleep(0.05) 
            except Exception:
                continue
        
        # Increment global stats helper (v44)
        if count > 0:
            async for s in get_session():
                await crud.increment_broadcast_stat(s, 'global')
                
        return web.json_response({"status": "ok", "sent_count": count})

async def send_broadcast_user(request):
    data = await request.json()
    user_id = data.get('user_id')
    message = data.get('message')
    bot = request.app['bot']
    
    try:
        await bot.send_message(int(user_id), message, parse_mode='HTML')
        # Increment targeted stats (v44)
        async for s in get_session():
            await crud.increment_broadcast_stat(s, 'targeted')
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
                "record_type": h.record_type,
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
            user_id=int(data.get('user_id')) if data.get('user_id') else None,
            record_type=data.get('type', 'sale')
        )
        return web.json_response({"status": "ok"})

async def get_coupons_data(request):
    async for session in get_session():
        coupons = await crud.get_all_coupons(session)
        return web.json_response({
            "coupons": [
                {
                    "code": str(c.code),
                    "points": c.points,
                    "max_uses": c.max_uses,
                    "current_uses": c.current_uses,
                    "is_active": c.is_active,
                    "created_at": c.created_at.strftime("%Y-%m-%d")
                } for c in coupons
            ]
        })

async def add_coupon_api(request):
    data = await request.json()
    points = int(data.get('points', 0))
    uses = int(data.get('uses', 1))
    code = data.get('code', '').strip()
    
    if not code:
        import string
        import random
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))
        
    async for session in get_session():
        await crud.create_coupon(session, code=code, points=points, max_uses=uses)
        return web.json_response({"status": "ok", "code": code})

async def delete_coupon_api(request):
    data = await request.json()
    code = data.get('code')
    async for session in get_session():
        success = await crud.delete_coupon(session, code)
        return web.json_response({"status": "ok", "deleted": success})

# --- Orders API (v113) ---
async def get_orders_api(request):
    bot = request.app['bot']
    async for session in get_session():
        orders = await crud.get_all_orders(session)
        
        # Live Sync for Active Orders ONLY
        active_orders = [o for o in orders if o.status == 'active']
        updates_made = False
        
        async def sync_order(o):
            nonlocal updates_made
            try:
                chat = await bot.get_chat(o.chat_id)
                if chat.title and o.chat_name != chat.title:
                    o.chat_name = chat.title
                    updates_made = True
                # If chat has username, or it used to have one, sync it
                if chat.username != o.chat_username:
                    o.chat_username = chat.username
                    updates_made = True
            except Exception:
                pass
                
        # Limit parallel execution if many active orders (batch of 15)
        for i in range(0, len(active_orders), 15):
            batch = active_orders[i:i+15]
            await asyncio.gather(*(sync_order(o) for o in batch))
            
        if updates_made:
            session.add_all(active_orders)
            await session.commit()
            
        return web.json_response([{
            "id": o.id,
            "user_id": o.user_id,
            "chat_name": o.chat_name or "Unknown",
            "chat_username": o.chat_username or "",
            "chat_type": o.chat_type,
            "required_members": o.required_members,
            "current_members": o.current_members,
            "status": o.status
        } for o in orders], headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0"
        })

async def update_order_api(request):
    data = await request.json()
    async for session in get_session():
        await crud.update_order_status(session, int(data['id']), data['status'])
        return web.json_response({"status": "ok"})

# --- Reports API (v113) ---
async def get_reports_api(request):
    bot = request.app['bot']
    import asyncio
    async for session in get_session():
        reports = await crud.get_all_reports(session)
        
        pending_reports = [r for r in reports if r.status == 'pending']
        updates_made = False

        async def sync_report_data(r):
            nonlocal updates_made
            try:
                # Sync Reporter User
                db_user = await crud.get_user(session, r.user_id)
                if db_user:
                    try:
                        tg_user = await bot.get_chat(r.user_id)
                        # Use full_name (first + last)
                        full_name = tg_user.first_name
                        if tg_user.last_name:
                            full_name += f" {tg_user.last_name}"
                        
                        if full_name and db_user.first_name != full_name:
                            db_user.first_name = full_name
                            updates_made = True
                    except Exception:
                        pass
                
                # Sync Target Order
                db_order = await session.get(Order, r.order_id)
                if db_order:
                    try:
                        tg_chat = await bot.get_chat(db_order.chat_id)
                        if tg_chat.title and db_order.chat_name != tg_chat.title:
                            db_order.chat_name = tg_chat.title
                            updates_made = True
                        if tg_chat.username != db_order.chat_username:
                            db_order.chat_username = tg_chat.username
                            updates_made = True
                    except Exception:
                        pass
            except Exception:
                pass
                
        # Handle parallel live sync
        for i in range(0, len(pending_reports), 10):
            batch = pending_reports[i:i+10]
            await asyncio.gather(*(sync_report_data(r) for r in batch))
            
        if updates_made:
            await session.commit()

        data = []
        for r in reports:
            res_user = await crud.get_user(session, r.user_id)
            res_order = await session.get(Order, r.order_id)
            
            data.append({
                "id": r.id,
                "user_id": r.user_id,
                "user_name": res_user.first_name if res_user else str(r.user_id),
                "order_id": r.order_id,
                "chat_name": res_order.chat_name if res_order else "Deleted Order",
                "chat_username": res_order.chat_username if res_order and res_order.chat_username else "",
                "chat_type": res_order.chat_type if res_order else "channel",
                "created_at": r.created_at.strftime("%Y-%m-%d %H:%M"),
                "status": r.status
            })
            
        return web.json_response(data, headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0"
        })

async def update_report_api(request):
    data = await request.json()
    async for session in get_session():
        # Pass order_id to bulk update reports and cancel the order if accepted
        await crud.update_report_status(session, int(data['order_id']), data['status'])
        return web.json_response({"status": "ok"})

# --- Admins API ---
async def get_admins_api(request):
    bot = request.app['bot']
    async for session in get_session():
        admins = await crud.get_admins(session)
        
        # v137/v138: Fresh sync - try to update admin info from TG in background
        for admin in admins:
            try:
                chat = await bot.get_chat(admin.user_id)
                # Combine first and last name for "Full Name" display (v138)
                full_name = chat.first_name + (f" {chat.last_name}" if chat.last_name else "")
                admin.first_name = full_name
                admin.username = chat.username
            except Exception:
                pass
        
        await session.commit()
        
        return web.json_response([{
            "user_id": a.user_id,
            "first_name": a.first_name, # This now contains the full name
            "username": a.username
        } for a in admins])

async def add_admin_api(request):
    data = await request.json()
    user_id_str = data.get('user_id')
    if not user_id_str:
        return web.json_response({"status": "error", "message": "Missing user_id"}, status=400)
        
    try:
        user_id = int(str(user_id_str).strip())
    except (ValueError, TypeError):
        return web.json_response({"status": "error", "message": "Invalid user ID format"}, status=400)
        
    bot = request.app['bot']
    async for session in get_session():
        # Promote admin only if user exists in DB (v139)
        user = await crud.set_user_admin(session, user_id, True)
        if user:
            return web.json_response({"status": "ok"})
        else:
            return web.json_response({"status": "error", "message": "User not found. They must start the bot first."}, status=404)

async def remove_admin_api(request):
    data = await request.json()
    user_id = int(data.get('user_id'))
    if user_id == ADMIN_ID:
        return web.json_response({"status": "error", "message": "Cannot remove the Super Admin."}, status=400)
        
    async for session in get_session():
        await crud.set_user_admin(session, user_id, False)
        return web.json_response({"status": "ok"})

async def get_admin_profile(request):
    user_id = request.query.get('user_id')
    if not user_id:
        return web.json_response({"status": "error", "message": "Missing user_id"}, status=400)
    
    bot = request.app['bot']
    try:
        chat = await bot.get_chat(int(user_id))
        
        # Try to get photo
        photo_url = None
        try:
            photos = await bot.get_user_profile_photos(int(user_id), limit=1)
            if photos.total_count > 0:
                file_id = photos.photos[0][-1].file_id
                file = await bot.get_file(file_id)
                # Note: this requires the bot's TOKEN if you want to construct the URL directly, 
                # or we just rely on the bot token we have.
                token = bot.token
                photo_url = f"https://api.telegram.org/file/bot{token}/{file.file_path}"
        except Exception:
            pass
            
        return web.json_response({
            "id": chat.id,
            "first_name": chat.first_name + (f" {chat.last_name}" if chat.last_name else ""),
            "last_name": chat.last_name or "",
            "username": chat.username or "",
            "photo_url": photo_url
        })
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=400)

async def backup_database(request):
    # Verify Admin (Simplistic for now, assuming front-end checks first)
    from config import DATA_DIR
    db_file = os.path.join(DATA_DIR, 'bot_database.sqlite3')
    
    if not os.path.exists(db_file):
        return web.json_response({"status": "error", "message": "Database file not found"}, status=404)
        
    return FileResponse(
        path=db_file,
        status=200,
        headers={
            'Content-Disposition': f'attachment; filename="bot_database_{datetime.datetime.now().strftime("%Y%m%d_%H%M%S")}.sqlite3"'
        }
    )

async def restore_database(request):
    # This involves overwriting the DB file. 
    # Warning: Sessions might be active.
    from config import DATA_DIR
    db_file = os.path.join(DATA_DIR, 'bot_database.sqlite3')
    
    reader = await request.multipart()
    field = await reader.next()
    
    if not field or field.name != 'database':
        return web.json_response({"status": "error", "message": "Invalid field name"}, status=400)
    
    filename = field.filename
    if not filename.endswith('.sqlite3'):
        return web.json_response({"status": "error", "message": "Invalid file type. Must be .sqlite3"}, status=400)
        
    # Read the file data
    data = await field.read()
    
    # Backup current DB just in case before overwriting
    if os.path.exists(db_file):
        os.rename(db_file, db_file + ".bak")
        
    try:
        with open(db_file, 'wb') as f:
            f.write(data)
        
        # v149: Extremely Important Fix - SQLite Inode/Locking Issue
        # We must forcefully restart the python process after restoring the database.
        # Otherwise, SQLAlchemy's active sessions will continue writing to the old file
        # descriptor in memory, ignoring the newly uploaded file!
        async def restart_server():
            await asyncio.sleep(1.5) # Give enough time for the HTTP response to be sent
            import os
            import sys
            print("🔄 Triggering auto-restart to apply restored database...")
            # Use os._exit to immediately kill and let Railway/Supervisor restart it
            os._exit(0)
            
        asyncio.create_task(restart_server())

        return web.json_response({"status": "ok", "message": "Database restored successfully. Bot is restarting..."})
    except Exception as e:
        # Restore backup if failed
        if os.path.exists(db_file + ".bak"):
            os.replace(db_file + ".bak", db_file)
        return web.json_response({"status": "error", "message": str(e)}, status=500)

async def handle_index(request):
    path = os.path.join(STATIC_DIR, "index.html")
    try:
        with open(path, 'rb') as f:
            content = f.read()
        logging.info(f"Manual Serve Success: {path} ({len(content)} bytes)")
        return web.Response(body=content, content_type='text/html')
    except Exception as e:
        logging.error(f"Manual Serve Error: {e}")
        return web.Response(text=f"Error loading index: {e}", status=500)

async def handle_js(request):
    path = os.path.join(STATIC_DIR, "app.js")
    with open(path, 'rb') as f:
        return web.Response(body=f.read(), content_type='application/javascript')

async def handle_css(request):
    path = os.path.join(STATIC_DIR, "style.css")
    with open(path, 'rb') as f:
        return web.Response(body=f.read(), content_type='text/css')

def setup_web_app(bot):
    app = web.Application()
    app['bot'] = bot
    
    app.router.add_get('/', handle_index)
    app.router.add_get('/static/app.js', handle_js)
    app.router.add_get('/static/style.css', handle_css)
    
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
    
    # Coupons API
    app.router.add_get('/api/coupons', get_coupons_data)
    app.router.add_post('/api/coupons/add', add_coupon_api)
    app.router.add_post('/api/coupons/delete', delete_coupon_api)
    
    # New Orders & Reports API (v113)
    app.router.add_get('/api/orders', get_orders_api)
    app.router.add_post('/api/orders/update', update_order_api)
    app.router.add_get('/api/reports', get_reports_api)
    app.router.add_post('/api/reports/update', update_report_api)
    
    app.router.add_get('/api/admins', get_admins_api)
    app.router.add_post('/api/admins/add', add_admin_api)
    app.router.add_post('/api/admins/delete', remove_admin_api)
    app.router.add_get('/api/admin/profile', get_admin_profile)
    
    # Backup & Restore (v148)
    app.router.add_get('/api/admin/backup', backup_database)
    app.router.add_post('/api/admin/restore', restore_database)
    
    # Static Files (Manual + Fallback)
    app.router.add_static('/static/', path=STATIC_DIR, name='static')
    
    return app

async def start_web_server(app, host='0.0.0.0', port=8080):
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host, port)
    await site.start()
    logging.info(f"✅ Web Dashboard running at http://{host}:{port}")
