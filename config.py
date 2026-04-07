import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "YOUR_BOT_TOKEN")
ADMIN_ID = int(os.getenv("ADMIN_ID", "123456789"))

# Define sqlite database path
# Using absolute path for better Railway Volume compatibility
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = f"sqlite+aiosqlite:///{os.path.join(BASE_DIR, 'data', 'bot_database.sqlite3')}"

# Mandatory subscription channels
MANDATORY_CHANNELS = [
    {"id": "@DRAKOLA1CHANNEL", "link": "https://t.me/DRAKOLA1CHANNEL"},
    {"id": "@DRAKOLA2CHANNEL", "link": "https://t.me/DRAKOLA2CHANNEL"},
]
