"""Database models and initialization for BattleScope."""
import sqlite3
import os
from typing import Optional


class Database:
    """SQLite database manager for BattleScope."""

    def __init__(self, db_path: str = 'data/battlescope.db'):
        """Initialize database connection."""
        self.db_path = db_path
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.conn = None
        self.cursor = None

    def connect(self):
        """Connect to the database."""
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        self.cursor = self.conn.cursor()

    def close(self):
        """Close database connection."""
        if self.conn:
            self.conn.close()

    def init_db(self):
        """Initialize database schema."""
        self.connect()

        # Create scans table to track uploaded files
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS scans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                scan_type TEXT NOT NULL,
                upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Create hosts table
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS hosts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scan_id INTEGER NOT NULL,
                ip_address TEXT NOT NULL,
                hostname TEXT,
                mac_address TEXT,
                status TEXT,
                FOREIGN KEY (scan_id) REFERENCES scans(id),
                UNIQUE(scan_id, ip_address)
            )
        ''')

        # Create operating_systems table
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS operating_systems (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                host_id INTEGER NOT NULL,
                os_name TEXT NOT NULL,
                accuracy INTEGER,
                FOREIGN KEY (host_id) REFERENCES hosts(id)
            )
        ''')

        # Create ports table
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS ports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                host_id INTEGER NOT NULL,
                port_number INTEGER NOT NULL,
                protocol TEXT NOT NULL,
                state TEXT,
                service_name TEXT,
                service_product TEXT,
                service_version TEXT,
                FOREIGN KEY (host_id) REFERENCES hosts(id)
            )
        ''')

        # Create vulnerabilities table (for Nessus scans)
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS vulnerabilities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                host_id INTEGER NOT NULL,
                port_id INTEGER,
                plugin_id TEXT,
                plugin_name TEXT,
                severity TEXT,
                risk_factor TEXT,
                description TEXT,
                solution TEXT,
                synopsis TEXT,
                cve TEXT,
                cvss_score REAL,
                FOREIGN KEY (host_id) REFERENCES hosts(id),
                FOREIGN KEY (port_id) REFERENCES ports(id)
            )
        ''')

        self.conn.commit()
        self.close()

    def clear_db(self):
        """Clear all data from the database."""
        self.connect()
        tables = ['vulnerabilities', 'ports', 'operating_systems', 'hosts', 'scans']
        for table in tables:
            self.cursor.execute(f'DELETE FROM {table}')
        self.conn.commit()
        self.close()

    def execute_query(self, query: str):
        """Execute a SQL query and return results."""
        self.connect()
        try:
            self.cursor.execute(query)
            if query.strip().upper().startswith('SELECT'):
                results = self.cursor.fetchall()
                columns = [description[0] for description in self.cursor.description]
                # Convert Row objects to lists for JSON serialization
                rows = [list(row) for row in results]
                self.close()
                return {'columns': columns, 'rows': rows}
            else:
                self.conn.commit()
                self.close()
                return {'message': 'Query executed successfully'}
        except Exception as e:
            self.close()
            raise e
