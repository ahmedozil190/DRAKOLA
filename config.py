import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "YOUR_BOT_TOKEN")
ADMIN_ID = int(os.getenv("ADMIN_ID", "123456789"))

# Define sqlite database path
# /data folder will be created locally, and it is usually a mapped volume on Railway.
DB_PATH = "sqlite+aiosqlite:///data/bot_database.sqlite3"

# Mandatory subscription channels
MANDATORY_CHANNELS = [
    {"id": "@DRAKOLA1CHANNEL", "link": "https://t.me/DRAKOLA1CHANNEL"},
    {"id": "@DRAKOLA2CHANNEL", "link": "https://t.me/DRAKOLA2CHANNEL"},
]
