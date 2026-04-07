import sqlite3
import os

db_path = os.path.join("data", "bot_database.sqlite3")
if not os.path.exists(db_path):
    db_path = "bot_database.sqlite3" # Try local if no data dir

def migrate():
    print(f"Connecting to {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    columns_to_add = [
        ("transfers_count", "INTEGER DEFAULT 0"),
        ("daily_gifts_count", "INTEGER DEFAULT 0"),
        ("invites_count", "INTEGER DEFAULT 0"),
        ("points_used", "INTEGER DEFAULT 0"),
        ("referred_by", "BIGINT"),
        ("last_milestone_sent", "INTEGER DEFAULT 0")
    ]
    
    # Add columns to users table
    for col_name, col_type in columns_to_add:
        if col_name == "last_milestone_sent": continue # Skip here, add to orders instead
        try:
            print(f"Adding column {col_name} to users...")
            cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
            print(f"Column {col_name} added to users successfully.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print(f"Column {col_name} already exists in users.")
            else:
                print(f"Error adding {col_name} to users: {e}")

    # Add last_milestone_sent to orders table
    try:
        print("Adding column last_milestone_sent to orders...")
        cursor.execute("ALTER TABLE orders ADD COLUMN last_milestone_sent INTEGER DEFAULT 0")
        print("Column last_milestone_sent added to orders successfully.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("Column last_milestone_sent already exists in orders.")
        else:
            print(f"Error adding last_milestone_sent to orders: {e}")
                
    # Add skipped_tasks table
    try:
        print("Creating skipped_tasks table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS skipped_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id BIGINT,
                order_id INTEGER,
                skipped_at DATETIME,
                FOREIGN KEY(user_id) REFERENCES users(user_id),
                FOREIGN KEY(order_id) REFERENCES orders(id)
            )
        """)
        print("skipped_tasks table created successfully.")
    except sqlite3.OperationalError as e:
        print(f"Error creating skipped_tasks table: {e}")
        
    conn.commit()
    conn.close()
    print("Migration finished.")

if __name__ == "__main__":
    migrate()
