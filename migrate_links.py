import sqlite3
from config import DB_PATH

path = DB_PATH.replace("sqlite+aiosqlite:///", "")
conn = sqlite3.connect(path)
cursor = conn.cursor()

queries = [
    "ALTER TABLE global_settings ADD COLUMN instruction_link VARCHAR DEFAULT 'https://'",
    "ALTER TABLE global_settings ADD COLUMN rules_link VARCHAR DEFAULT 'https://'",
    "ALTER TABLE global_settings ADD COLUMN buy_points_link VARCHAR DEFAULT 'https://'"
]

for q in queries:
    try:
        cursor.execute(q)
    except Exception as e:
        print(f"Error on {q}: {e}")

conn.commit()
conn.close()
print("Links migration done.")
