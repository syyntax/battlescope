# BattleScope - Quick Start Guide

## Running with Docker (Recommended)

### Prerequisites
- Docker installed on your system
- Docker Compose (usually included with Docker Desktop)

### Steps

1. **Navigate to the project directory:**
```bash
cd /mnt/c/Users/jgs85/OneDrive/Projects/BattleScope
```

2. **Build and start the container:**
```bash
docker-compose up -d
```

3. **Access the application:**
Open your browser and go to: `http://localhost:5000`

4. **View logs (optional):**
```bash
docker-compose logs -f
```

5. **Stop the application:**
```bash
docker-compose down
```

## Running without Docker

### Prerequisites
- Python 3.11 or higher
- pip (Python package manager)

### Steps

1. **Install dependencies:**
```bash
pip install -r requirements.txt
```

2. **Run the application:**
```bash
python app/app.py
```

3. **Access the application:**
Open your browser and go to: `http://localhost:5000`

## Using BattleScope

### 1. Upload a Scan File
- Click the upload area or drag & drop a `.nessus` or `.xml` file
- The file will be parsed automatically
- Statistics will appear in the right panel

### 2. Run Queries
- **Quick Queries**: Click any button in the left panel
- **Custom Queries**: Type SQL in the middle panel and click "Execute Query"
- Use `Ctrl+Enter` (or `Cmd+Enter` on Mac) to execute queries quickly

### 3. Export Results
- After running a query, click "Export CSV" to download results

### 4. Toggle Theme
- Click the theme toggle button (◐) in the top-right to switch between dark/light mode

## Example SQL Queries

### All hosts:
```sql
SELECT ip_address, hostname, status FROM hosts
```

### Open ports by host:
```sql
SELECT h.ip_address, p.port_number, p.protocol, p.service_name
FROM hosts h
JOIN ports p ON h.id = p.host_id
WHERE p.state = 'open'
ORDER BY h.ip_address
```

### Critical vulnerabilities (Nessus only):
```sql
SELECT h.ip_address, v.plugin_name, v.risk_factor, v.cvss_score
FROM hosts h
JOIN vulnerabilities v ON h.id = v.host_id
WHERE v.risk_factor = 'Critical'
ORDER BY v.cvss_score DESC
```

## Troubleshooting

### Port 5000 already in use
Change the port in `docker-compose.yml`:
```yaml
ports:
  - "8080:5000"  # Change 8080 to any available port
```

### Database issues
Remove the database file and restart:
```bash
rm data/battlescope.db
docker-compose restart
```

### Permission issues with volumes
Ensure the `data` and `uploads` directories have proper permissions:
```bash
chmod 755 data uploads
```

## Support

Created by: **syyntax**
Email: **syyntax@protonmail.com**
