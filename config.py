import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "YOUR_BOT_TOKEN_HERE")
ADMIN_ID = int(os.getenv("ADMIN_ID", "123456789"))

# Define sqlite database path
# Using absolute path for better Railway Volume compatibility
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
DB_PATH = f"sqlite+aiosqlite:///{os.path.join(DATA_DIR, 'bot_database.sqlite3')}"

# Mandatory subscription channels
MANDATORY_CHANNELS = []

# Admin Dashboard URL
ADMIN_WEB_APP_URL = os.getenv("ADMIN_WEB_APP_URL", "https://web-production-435fd.up.railway.app")

