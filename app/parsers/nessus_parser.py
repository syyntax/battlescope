"""Nessus XML parser for BattleScope."""
import xml.etree.ElementTree as ET
from typing import Dict, List
import sqlite3


class NessusParser:
    """Parser for Nessus XML files."""

    def __init__(self, db_conn: sqlite3.Connection):
        """Initialize parser with database connection."""
        self.conn = db_conn
        self.cursor = db_conn.cursor()

    def parse_file(self, file_path: str, scan_id: int):
        """Parse Nessus XML file and store in database."""
        tree = ET.parse(file_path)
        root = tree.getroot()

        # Parse each report host
        for report_host in root.findall('.//ReportHost'):
            self._parse_host(report_host, scan_id)

        self.conn.commit()

    def _parse_host(self, report_host: ET.Element, scan_id: int):
        """Parse a single host from Nessus report."""
        # Get host properties
        host_properties = {}
        for tag in report_host.findall('.//HostProperties/tag'):
            name = tag.get('name')
            host_properties[name] = tag.text

        # Extract host information
        ip_address = report_host.get('name')
        hostname = host_properties.get('host-fqdn') or host_properties.get('hostname') or host_properties.get('netbios-name')
        mac_address = host_properties.get('mac-address')

        # Insert host
        self.cursor.execute('''
            INSERT OR IGNORE INTO hosts (scan_id, ip_address, hostname, mac_address, status)
            VALUES (?, ?, ?, ?, ?)
        ''', (scan_id, ip_address, hostname, mac_address, 'up'))

        host_id = self.cursor.lastrowid
        if host_id == 0:
            # Host already exists, get the ID
            self.cursor.execute('''
                SELECT id FROM hosts WHERE scan_id = ? AND ip_address = ?
            ''', (scan_id, ip_address))
            host_id = self.cursor.fetchone()[0]

        # Parse operating system
        os_name = host_properties.get('operating-system')
        if os_name:
            # Take first OS if multiple are listed
            os_name = os_name.split('\n')[0]
            self.cursor.execute('''
                INSERT INTO operating_systems (host_id, os_name, accuracy)
                VALUES (?, ?, ?)
            ''', (host_id, os_name, 100))

        # Parse report items (vulnerabilities)
        for item in report_host.findall('.//ReportItem'):
            self._parse_vulnerability(item, host_id)

    def _parse_vulnerability(self, item: ET.Element, host_id: int):
        """Parse a vulnerability report item."""
        port_number = int(item.get('port', 0))
        protocol = item.get('protocol', '')
        service_name = item.get('svc_name', '')

        # Insert or get port
        port_id = None
        if port_number > 0:
            self.cursor.execute('''
                INSERT OR IGNORE INTO ports (host_id, port_number, protocol, state, service_name)
                VALUES (?, ?, ?, ?, ?)
            ''', (host_id, port_number, protocol, 'open', service_name))

            port_id = self.cursor.lastrowid
            if port_id == 0:
                # Port already exists, get the ID
                self.cursor.execute('''
                    SELECT id FROM ports
                    WHERE host_id = ? AND port_number = ? AND protocol = ?
                ''', (host_id, port_number, protocol))
                result = self.cursor.fetchone()
                if result:
                    port_id = result[0]

        # Parse vulnerability details
        plugin_id = item.get('pluginID')
        plugin_name = item.get('pluginName')
        severity = item.get('severity')

        # Map severity to risk factor
        severity_map = {'0': 'Info', '1': 'Low', '2': 'Medium', '3': 'High', '4': 'Critical'}
        risk_factor = severity_map.get(severity, 'Info')

        # Get additional vulnerability details
        description = self._get_element_text(item, 'description')
        solution = self._get_element_text(item, 'solution')
        synopsis = self._get_element_text(item, 'synopsis')

        # Get CVE if available
        cve = self._get_element_text(item, 'cve')

        # Get CVSS score
        cvss_score = None
        cvss_base_score = self._get_element_text(item, 'cvss_base_score')
        if cvss_base_score:
            try:
                cvss_score = float(cvss_base_score)
            except ValueError:
                pass

        # Insert vulnerability
        self.cursor.execute('''
            INSERT INTO vulnerabilities (
                host_id, port_id, plugin_id, plugin_name, severity, risk_factor,
                description, solution, synopsis, cve, cvss_score
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (host_id, port_id, plugin_id, plugin_name, severity, risk_factor,
              description, solution, synopsis, cve, cvss_score))

    def _get_element_text(self, parent: ET.Element, tag: str) -> str:
        """Get text from an XML element."""
        element = parent.find(tag)
        return element.text if element is not None and element.text else ''
