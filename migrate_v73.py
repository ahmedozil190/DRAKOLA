import sqlite3
import os

db_path = "data/database.db"

def run_migration():
    if not os.path.exists(db_path):
        print("Error: Database not found at " + db_path)
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("Starting Migration v73 on " + db_path + "...")

    try:
        # Add total_earned
        cursor.execute("ALTER TABLE users ADD COLUMN total_earned INTEGER DEFAULT 0")
        print("Success: Added column total_earned")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("Info: total_earned column already exists.")
        else:
            print("Error adding total_earned: " + str(e))

    try:
        # Add joined_at
        cursor.execute("ALTER TABLE users ADD COLUMN joined_at DATETIME DEFAULT CURRENT_TIMESTAMP")
        print("Success: Added column joined_at")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("Info: joined_at column already exists.")
        else:
            print("Error adding joined_at: " + str(e))

    conn.commit()
    conn.close()
    print("Migration v73 completed successfully!")

if __name__ == "__main__":
    run_migration()
