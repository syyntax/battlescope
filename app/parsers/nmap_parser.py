"""Nmap XML parser for BattleScope."""
import xml.etree.ElementTree as ET
from typing import Dict, List
import sqlite3


class NmapParser:
    """Parser for Nmap XML files."""

    def __init__(self, db_conn: sqlite3.Connection):
        """Initialize parser with database connection."""
        self.conn = db_conn
        self.cursor = db_conn.cursor()

    def parse_file(self, file_path: str, scan_id: int):
        """Parse Nmap XML file and store in database."""
        tree = ET.parse(file_path)
        root = tree.getroot()

        # Parse each host
        for host in root.findall('.//host'):
            self._parse_host(host, scan_id)

        self.conn.commit()

    def _parse_host(self, host: ET.Element, scan_id: int):
        """Parse a single host from Nmap scan."""
        # Get status
        status_elem = host.find('status')
        status = status_elem.get('state') if status_elem is not None else 'unknown'

        # Get IP address
        ip_address = None
        for address in host.findall('address'):
            if address.get('addrtype') == 'ipv4':
                ip_address = address.get('addr')
                break

        if not ip_address:
            # Try IPv6 or MAC
            address_elem = host.find('address')
            if address_elem is not None:
                ip_address = address_elem.get('addr')

        if not ip_address:
            return  # Skip hosts without IP address

        # Get hostname
        hostname = None
        hostnames = host.find('hostnames')
        if hostnames is not None:
            hostname_elem = hostnames.find('hostname')
            if hostname_elem is not None:
                hostname = hostname_elem.get('name')

        # Get MAC address
        mac_address = None
        for address in host.findall('address'):
            if address.get('addrtype') == 'mac':
                mac_address = address.get('addr')
                break

        # Insert host
        self.cursor.execute('''
            INSERT OR IGNORE INTO hosts (scan_id, ip_address, hostname, mac_address, status)
            VALUES (?, ?, ?, ?, ?)
        ''', (scan_id, ip_address, hostname, mac_address, status))

        host_id = self.cursor.lastrowid
        if host_id == 0:
            # Host already exists, get the ID
            self.cursor.execute('''
                SELECT id FROM hosts WHERE scan_id = ? AND ip_address = ?
            ''', (scan_id, ip_address))
            host_id = self.cursor.fetchone()[0]

        # Parse operating system detection
        os_elem = host.find('os')
        if os_elem is not None:
            for osmatch in os_elem.findall('osmatch'):
                os_name = osmatch.get('name')
                accuracy = int(osmatch.get('accuracy', 0))

                self.cursor.execute('''
                    INSERT INTO operating_systems (host_id, os_name, accuracy)
                    VALUES (?, ?, ?)
                ''', (host_id, os_name, accuracy))

                # Only take the highest accuracy match
                break

        # Parse ports
        ports_elem = host.find('ports')
        if ports_elem is not None:
            for port in ports_elem.findall('port'):
                self._parse_port(port, host_id)

    def _parse_port(self, port: ET.Element, host_id: int):
        """Parse a single port from Nmap scan."""
        port_number = int(port.get('portid', 0))
        protocol = port.get('protocol', 'tcp')

        # Get state
        state_elem = port.find('state')
        state = state_elem.get('state') if state_elem is not None else 'unknown'

        # Get service information
        service_elem = port.find('service')
        service_name = ''
        service_product = ''
        service_version = ''

        if service_elem is not None:
            service_name = service_elem.get('name', '')
            service_product = service_elem.get('product', '')
            service_version = service_elem.get('version', '')

        # Insert port
        self.cursor.execute('''
            INSERT INTO ports (
                host_id, port_number, protocol, state,
                service_name, service_product, service_version
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (host_id, port_number, protocol, state,
              service_name, service_product, service_version))
