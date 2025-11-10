# BattleScope

A modern web application for parsing and analyzing Nessus and Nmap scan files. BattleScope provides an intuitive interface to visualize discovery information including hostnames, open ports, services, and vulnerabilities.

**Author:** syyntax
**Email:** syyntax@protonmail.com

## Features

- 📁 **File Upload**: Support for Nessus (.nessus) and Nmap (.xml) files
- 🗄️ **SQLite Database**: Efficient storage and querying of scan data
- 🔍 **SQL Queries**: Pre-built queries and custom SQL query execution
- 📊 **Statistics Dashboard**: Real-time scan statistics and insights
- 📤 **CSV Export**: Export query results to CSV format
- 🌓 **Dark/Light Mode**: Toggle between themes (defaults to system preference)
- 🎨 **Modern UI**: Sleek design with purple/blue color scheme
- 🐳 **Dockerized**: Easy deployment with Docker

## Quick Start

### Using Docker (Recommended)

1. Clone the repository:
```bash
git clone <repository-url>
cd BattleScope
```

2. Build and run with Docker Compose:
```bash
docker-compose up -d
```

3. Access the application at `http://localhost:5000`

### Manual Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the application:
```bash
python app/app.py
```

3. Access the application at `http://localhost:5000`

## Usage

### Uploading Scan Files

1. Click the upload area or drag and drop a `.nessus` or `.xml` file
2. The file will be automatically parsed and stored in the SQLite database
3. Statistics will appear in the right pane

### Running Queries

**Pre-built Queries:**
- Click any query button in the left pane to execute common queries
- Results appear in the middle pane with row count and export option

**Custom Queries:**
- Type your SQL query in the text area
- Click "Execute Query" or press `Ctrl/Cmd + Enter`
- Only SELECT queries are allowed for security

**Example Queries:**
```sql
-- Get all hosts with their status
SELECT ip_address, hostname, status FROM hosts

-- Find open ports on a specific host
SELECT port_number, protocol, service_name
FROM ports
WHERE host_id = (SELECT id FROM hosts WHERE ip_address = '192.168.1.1')

-- Get critical vulnerabilities
SELECT h.ip_address, v.plugin_name, v.risk_factor
FROM vulnerabilities v
JOIN hosts h ON v.host_id = h.id
WHERE v.risk_factor = 'Critical'
```

### Exporting Results

1. Execute a query to display results
2. Click the "Export CSV" button
3. Save the downloaded CSV file

## Database Schema

### Tables

- **scans**: Tracks uploaded scan files
- **hosts**: Stores host information (IP, hostname, MAC, status)
- **ports**: Port details (number, protocol, state, service)
- **operating_systems**: OS detection results
- **vulnerabilities**: Vulnerability findings (Nessus scans only)

### Schema Diagram

```
scans
├── id (PK)
├── filename
├── scan_type
└── upload_date

hosts
├── id (PK)
├── scan_id (FK)
├── ip_address
├── hostname
├── mac_address
└── status

ports
├── id (PK)
├── host_id (FK)
├── port_number
├── protocol
├── state
├── service_name
├── service_product
└── service_version

operating_systems
├── id (PK)
├── host_id (FK)
├── os_name
└── accuracy

vulnerabilities
├── id (PK)
├── host_id (FK)
├── port_id (FK)
├── plugin_id
├── plugin_name
├── severity
├── risk_factor
├── description
├── solution
├── synopsis
├── cve
└── cvss_score
```

## Technology Stack

**Backend:**
- Python 3.11
- Flask 3.0
- SQLite3

**Frontend:**
- HTML5
- CSS3 (with CSS Variables for theming)
- Vanilla JavaScript

**Fonts:**
- Genos (headings)
- PT Sans (subheadings)
- Google Sans Code (query input)
- JetBrains Mono (general text)

## Project Structure

```
BattleScope/
├── app/
│   ├── __init__.py
│   ├── app.py                 # Main Flask application
│   ├── database/
│   │   ├── __init__.py
│   │   └── models.py          # Database models
│   ├── parsers/
│   │   ├── __init__.py
│   │   ├── nessus_parser.py   # Nessus XML parser
│   │   └── nmap_parser.py     # Nmap XML parser
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css      # Application styles
│   │   └── js/
│   │       └── script.js      # Frontend JavaScript
│   └── templates/
│       └── index.html         # Main HTML template
├── data/                      # SQLite database storage
├── uploads/                   # Temporary file upload storage
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── README.md
└── PROJECT_REQUIREMENTS.md
```

## API Endpoints

- `GET /` - Main application page
- `POST /api/upload` - Upload and parse scan file
- `POST /api/query` - Execute SQL query
- `POST /api/export-csv` - Export query results to CSV
- `GET /api/statistics` - Get scan statistics

## Security Features

- File type validation (only .nessus and .xml allowed)
- SQL query restriction (SELECT only)
- Secure filename handling
- Input sanitization

## Development

To run in development mode:

```bash
export FLASK_ENV=development
python app/app.py
```

## Docker Commands

Build the image:
```bash
docker build -t battlescope .
```

Run the container:
```bash
docker run -p 5000:5000 -v $(pwd)/data:/app/data battlescope
```

Or use Docker Compose:
```bash
docker-compose up -d    # Start in detached mode
docker-compose logs -f  # View logs
docker-compose down     # Stop and remove containers
```

## License

This project is created by syyntax (syyntax@protonmail.com).

## Contributing

Feel free to submit issues or pull requests for improvements and bug fixes.
