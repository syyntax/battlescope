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


@app.route('/api/vulnerability/details', methods=['POST'])
def get_vulnerability_details():
    """Get detailed information about a vulnerability."""
    try:
        data = request.get_json()
        plugin_name = data.get('plugin_name')

        if not plugin_name:
            return jsonify({'error': 'Missing plugin_name'}), 400

        db.connect()

        # Get vulnerability details (first occurrence for basic info)
        db.cursor.execute('''
            SELECT plugin_id, plugin_name, risk_factor, synopsis,
                   description, solution, cve
            FROM vulnerabilities
            WHERE plugin_name = ?
            LIMIT 1
        ''', (plugin_name,))

        vuln = db.cursor.fetchone()

        if not vuln:
            db.close()
            return jsonify({'error': 'Vulnerability not found'}), 404

        # Get affected hosts with port information
        db.cursor.execute('''
            SELECT DISTINCT h.hostname, h.ip_address,
                   p.port_number, p.protocol, p.service_name
            FROM vulnerabilities v
            JOIN hosts h ON v.host_id = h.id
            LEFT JOIN ports p ON v.port_id = p.id
            WHERE v.plugin_name = ?
            ORDER BY h.ip_address
        ''', (plugin_name,))

        affected_hosts = []
        for row in db.cursor.fetchall():
            affected_hosts.append({
                'hostname': row[0],
                'ip_address': row[1],
                'port': row[2],
                'protocol': row[3],
                'service_name': row[4]
            })

        # Note: plugin_output is not stored in our current schema
        # If you need it, you'd need to add a column to the vulnerabilities table

        db.close()

        return jsonify({
            'plugin_id': vuln[0],
            'plugin_name': vuln[1],
            'risk_factor': vuln[2],
            'synopsis': vuln[3],
            'description': vuln[4],
            'solution': vuln[5],
            'cve': vuln[6],
            'plugin_output': 'Plugin output not available',  # Placeholder
            'affected_hosts': affected_hosts
        }), 200

    except Exception as e:
        return jsonify({'error': f'Error fetching vulnerability: {str(e)}'}), 500


@app.route('/api/vulnerability/update-severity', methods=['POST'])
def update_vulnerability_severity():
    """Update the severity/risk factor of a vulnerability."""
    data = request.get_json()
    plugin_id = data.get('plugin_id')
    new_risk_factor = data.get('risk_factor')

    if not plugin_id or not new_risk_factor:
        return jsonify({'error': 'Missing plugin_id or risk_factor'}), 400

    # Validate risk_factor
    valid_severities = ['Critical', 'High', 'Medium', 'Low', 'Info', 'False Positive']
    if new_risk_factor not in valid_severities:
        return jsonify({'error': 'Invalid risk_factor'}), 400

    try:
        db.connect()

        # Update all instances of this vulnerability
        db.cursor.execute('''
            UPDATE vulnerabilities
            SET risk_factor = ?
            WHERE plugin_id = ?
        ''', (new_risk_factor, plugin_id))

        affected_rows = db.cursor.rowcount
        db.conn.commit()
        db.close()

        return jsonify({
            'message': f'Updated {affected_rows} vulnerability record(s)',
            'updated_count': affected_rows
        }), 200

    except Exception as e:
        return jsonify({'error': f'Error updating vulnerability: {str(e)}'}), 500


@app.route('/api/report/generate', methods=['GET'])
def generate_report():
    """Generate comprehensive vulnerability report data."""
    try:
        db.connect()

        # Check if we have scan data
        db.cursor.execute('SELECT id, filename, scan_type, upload_date FROM scans ORDER BY id DESC LIMIT 1')
        scan_info = db.cursor.fetchone()

        if not scan_info:
            db.close()
            return jsonify({'error': 'No scan data available'}), 404

        scan_id = scan_info[0]
        report_data = {
            'scan_info': {
                'filename': scan_info[1],
                'scan_type': scan_info[2],
                'scan_date': scan_info[3]
            }
        }

        # Host statistics
        db.cursor.execute('SELECT COUNT(DISTINCT ip_address) FROM hosts WHERE scan_id = ?', (scan_id,))
        total_hosts = db.cursor.fetchone()[0]

        db.cursor.execute('SELECT COUNT(DISTINCT ip_address) FROM hosts WHERE scan_id = ? AND status = "up"', (scan_id,))
        alive_hosts = db.cursor.fetchone()[0]

        report_data['host_stats'] = {
            'total_hosts': total_hosts,
            'alive_hosts': alive_hosts
        }

        # Vulnerability statistics by severity
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
                    ELSE 6
                END
        ''', (scan_id,))
        vuln_by_severity = {row[0]: row[1] for row in db.cursor.fetchall()}
        report_data['vulnerability_stats'] = vuln_by_severity

        # Total unique vulnerabilities
        db.cursor.execute('''
            SELECT COUNT(DISTINCT plugin_id)
            FROM vulnerabilities v
            JOIN hosts h ON v.host_id = h.id
            WHERE h.scan_id = ?
        ''', (scan_id,))
        total_unique_vulns = db.cursor.fetchone()[0]
        report_data['vulnerability_stats']['unique_vulnerabilities'] = total_unique_vulns

        # Critical and High Findings (Top 10)
        db.cursor.execute('''
            SELECT v.plugin_name, v.risk_factor, COUNT(*) as affected_hosts,
                   v.synopsis, v.cvss_score
            FROM vulnerabilities v
            JOIN hosts h ON v.host_id = h.id
            WHERE h.scan_id = ? AND v.risk_factor IN ('Critical', 'High')
            GROUP BY v.plugin_name
            ORDER BY
                CASE v.risk_factor WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 END,
                affected_hosts DESC
            LIMIT 10
        ''', (scan_id,))
        critical_findings = []
        for row in db.cursor.fetchall():
            critical_findings.append({
                'name': row[0],
                'severity': row[1],
                'affected_hosts': row[2],
                'synopsis': row[3],
                'cvss_score': row[4] or 'N/A'
            })
        report_data['critical_findings'] = critical_findings

        # Top 10 Vulnerable Hosts
        db.cursor.execute('''
            SELECT h.ip_address, h.hostname,
                   COUNT(CASE WHEN v.risk_factor = 'Critical' THEN 1 END) as critical,
                   COUNT(CASE WHEN v.risk_factor = 'High' THEN 1 END) as high,
                   COUNT(CASE WHEN v.risk_factor = 'Medium' THEN 1 END) as medium,
                   COUNT(CASE WHEN v.risk_factor = 'Low' THEN 1 END) as low,
                   COUNT(*) as total
            FROM hosts h
            LEFT JOIN vulnerabilities v ON h.id = v.host_id
            WHERE h.scan_id = ?
            GROUP BY h.ip_address, h.hostname
            ORDER BY critical DESC, high DESC, medium DESC
            LIMIT 10
        ''', (scan_id,))
        top_hosts = []
        for row in db.cursor.fetchall():
            top_hosts.append({
                'ip_address': row[0],
                'hostname': row[1] or 'N/A',
                'critical': row[2],
                'high': row[3],
                'medium': row[4],
                'low': row[5],
                'total': row[6]
            })
        report_data['top_vulnerable_hosts'] = top_hosts

        # Open Ports Summary (Top 20)
        db.cursor.execute('''
            SELECT p.port_number, p.protocol, p.service_name, COUNT(DISTINCT h.id) as count
            FROM ports p
            JOIN hosts h ON p.host_id = h.id
            WHERE h.scan_id = ? AND p.state = 'open'
            GROUP BY p.port_number, p.protocol, p.service_name
            ORDER BY count DESC
            LIMIT 20
        ''', (scan_id,))
        open_ports = []
        for row in db.cursor.fetchall():
            open_ports.append({
                'port': row[0],
                'protocol': row[1],
                'service': row[2] or 'unknown',
                'count': row[3]
            })
        report_data['open_ports'] = open_ports

        # All Vulnerabilities Summary (grouped by plugin)
        db.cursor.execute('''
            SELECT v.plugin_id, v.plugin_name, v.risk_factor,
                   COUNT(DISTINCT h.id) as affected_hosts,
                   v.synopsis, v.solution, v.cve
            FROM vulnerabilities v
            JOIN hosts h ON v.host_id = h.id
            WHERE h.scan_id = ?
            GROUP BY v.plugin_id
            ORDER BY
                CASE v.risk_factor
                    WHEN 'Critical' THEN 1
                    WHEN 'High' THEN 2
                    WHEN 'Medium' THEN 3
                    WHEN 'Low' THEN 4
                    WHEN 'Info' THEN 5
                    ELSE 6
                END,
                affected_hosts DESC
        ''', (scan_id,))
        all_vulnerabilities = []
        for row in db.cursor.fetchall():
            all_vulnerabilities.append({
                'plugin_id': row[0],
                'name': row[1],
                'severity': row[2],
                'affected_hosts': row[3],
                'synopsis': row[4],
                'solution': row[5],
                'cve': row[6]
            })
        report_data['all_vulnerabilities'] = all_vulnerabilities

        db.close()
        return jsonify(report_data), 200

    except Exception as e:
        return jsonify({'error': f'Error generating report: {str(e)}'}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
