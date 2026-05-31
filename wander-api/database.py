import sqlite3
import json
import secrets
import os
from typing import Optional, Dict

DB_PATH = os.path.join(os.path.dirname(__file__), "wander.db")

def init_db():
    """Initialize the database and create the shares table if it doesn't exist."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS shares (
            id TEXT PRIMARY KEY,
            route_json TEXT NOT NULL,
            vibe TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def save_route(route_data: dict, vibe: str) -> str:
    """Save a route to the database and return a unique 6-character ID."""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Generate a unique 6-character hexadecimal ID
    # Verify uniqueness in a simple loop
    while True:
        share_id = secrets.token_hex(3) # 6 characters
        cursor.execute("SELECT 1 FROM shares WHERE id = ?", (share_id,))
        if not cursor.fetchone():
            break
            
    cursor.execute(
        "INSERT INTO shares (id, route_json, vibe) VALUES (?, ?, ?)",
        (share_id, json.dumps(route_data), vibe)
    )
    conn.commit()
    conn.close()
    return share_id

def get_route(share_id: str) -> Optional[dict]:
    """Retrieve a shared route by its ID."""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT route_json FROM shares WHERE id = ?", (share_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        try:
            return json.loads(row[0])
        except json.JSONDecodeError:
            return None
    return None
