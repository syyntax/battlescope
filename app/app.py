"""Main Flask application for BattleScope."""
from flask import Flask, render_template, request, jsonify, send_file
from werkzeug.utils import secure_filename
import os
import csv
import io
import sqlite3
from datetime import datetime

from database.models import Database
from parsers.nessus_parser import NessusParser
from parsers.nmap_parser import NmapParser


app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size
app.config['UPLOAD_FOLDER'] = 'uploads'

# Initialize database
db = Database()
db.init_db()


def allowed_file(filename):
    """Check if file extension is allowed."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ['nessus', 'xml']


def detect_file_type(file_path):
    """Detect if file is Nessus or Nmap format."""
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read(1000)  # Read first 1000 chars
        if 'NessusClientData' in content:
            return 'nessus'
        elif 'nmaprun' in content:
            return 'nmap'
    return None


@app.route('/')
def index():
    """Render main page."""
    return render_template('index.html')


@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Handle file upload and parsing."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type. Please upload .nessus or .xml file'}), 400

    try:
        # Save uploaded file
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        unique_filename = f"{timestamp}_{filename}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(file_path)

        # Detect file type
        scan_type = detect_file_type(file_path)
        if not scan_type:
            os.remove(file_path)
            return jsonify({'error': 'Unable to detect file format. Please upload a valid Nessus or Nmap XML file'}), 400

        # Clear existing data
        db.clear_db()

        # Create scan record
        db.connect()
        db.cursor.execute('''
            INSERT INTO scans (filename, scan_type)
            VALUES (?, ?)
        ''', (filename, scan_type))
        scan_id = db.cursor.lastrowid

        # Parse file based on type
        if scan_type == 'nessus':
            parser = NessusParser(db.conn)
            parser.parse_file(file_path, scan_id)
        else:  # nmap
            parser = NmapParser(db.conn)
            parser.parse_file(file_path, scan_id)

        db.conn.commit()
        db.close()

        # Clean up uploaded file
        os.remove(file_path)

        # Get statistics
        stats = get_statistics(scan_id)

        return jsonify({
            'message': 'File uploaded and parsed successfully',
            'scan_type': scan_type,
            'filename': filename,
            'statistics': stats
        }), 200

    except Exception as e:
        return jsonify({'error': f'Error processing file: {str(e)}'}), 500


@app.route('/api/query', methods=['POST'])
def execute_query():
    """Execute SQL query and return results."""
    data = request.get_json()
    query = data.get('query', '')

    if not query:
        return jsonify({'error': 'No query provided'}), 400

    # Security check - only allow SELECT statements
    if not query.strip().upper().startswith('SELECT'):
        return jsonify({'error': 'Only SELECT queries are allowed'}), 400

    try:
        result = db.execute_query(query)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': f'Query error: {str(e)}'}), 400


@app.route('/api/export-csv', methods=['POST'])
def export_csv():
    """Export query results to CSV."""
    data = request.get_json()
    columns = data.get('columns', [])
    rows = data.get('rows', [])

    if not columns or not rows:
        return jsonify({'error': 'No data to export'}), 400

    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)

    # Write headers
    writer.writerow(columns)

    # Write data rows
    for row in rows:
        writer.writerow(row)

    # Create response
    output.seek(0)
    return send_file(
        io.BytesIO(output.getvalue().encode('utf-8')),
        mimetype='text/csv',
        as_attachment=True,
        download_name='battlescope_export.csv'
    )


@app.route('/api/statistics', methods=['GET'])
def get_statistics_endpoint():
    """Get scan statistics."""
    db.connect()
    db.cursor.execute('SELECT id FROM scans ORDER BY id DESC LIMIT 1')
    result = db.cursor.fetchone()
    db.close()

    if not result:
        return jsonify({'error': 'No scan data available'}), 404

    scan_id = result[0]
    stats = get_statistics(scan_id)
    return jsonify(stats), 200


def get_statistics(scan_id):
    """Get statistics for a scan."""
    db.connect()

    # Get scan info
    db.cursor.execute('SELECT filename, scan_type FROM scans WHERE id = ?', (scan_id,))
    scan_info = db.cursor.fetchone()

    # Get host count
    db.cursor.execute('SELECT COUNT(*) FROM hosts WHERE scan_id = ?', (scan_id,))
    host_count = db.cursor.fetchone()[0]

    stats = {
        'filename': scan_info[0] if scan_info else 'Unknown',
        'scan_type': scan_info[1] if scan_info else 'Unknown',
        'host_count': host_count
    }

    # Get severity counts if Nessus scan
    if scan_info and scan_info[1] == 'nessus':
        db.cursor.execute('''
            SELECT risk_factor, COUNT(*) as count
            FROM vulnerabilities v
            JOIN hosts h ON v.host_id = h.id
            WHERE h.scan_id = ?
            GROUP BY risk_factor
            ORDER BY
                CASE risk_factor
                    WHEN 'Critical' THEN 1
                    WHEN 'High' THEN 2
                    WHEN 'Medium' THEN 3
                    WHEN 'Low' THEN 4
                    WHEN 'Info' THEN 5
                END
        ''', (scan_id,))
        severities = {row[0]: row[1] for row in db.cursor.fetchall()}
        stats['severities'] = severities

    # Get top 10 ports
    db.cursor.execute('''
        SELECT port_number, protocol, service_name, COUNT(*) as count
        FROM ports p
        JOIN hosts h ON p.host_id = h.id
        WHERE h.scan_id = ? AND state = 'open'
        GROUP BY port_number, protocol, service_name
        ORDER BY count DESC
        LIMIT 10
    ''', (scan_id,))
    top_ports = [
        {
            'port': row[0],
            'protocol': row[1],
            'service': row[2] or 'unknown',
            'count': row[3]
        }
        for row in db.cursor.fetchall()
    ]
    stats['top_ports'] = top_ports

    # Get top 10 operating systems
    db.cursor.execute('''
        SELECT os_name, COUNT(*) as count
        FROM operating_systems os
        JOIN hosts h ON os.host_id = h.id
        WHERE h.scan_id = ?
        GROUP BY os_name
        ORDER BY count DESC
        LIMIT 10
    ''', (scan_id,))
    top_os = [
        {'os': row[0], 'count': row[1]}
        for row in db.cursor.fetchall()
    ]
    stats['top_os'] = top_os

    db.close()
    return stats


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
