import threading

import certstream
import logging
import datetime
import sys
import json
from db_manager import DBManager
from flask_api import DomainAPI

logging.basicConfig(format='[%(levelname)s:%(name)s] %(asctime)s - %(message)s', level=logging.WARNING)


class CertMonitor:
    """
    Manages the CertStream connection and filtering logic.
    """

    def __init__(self, config_path='config.json'):
        """
        Initialize CertMonitor with configuration.
        
        Args:
            config_path: Path to the configuration file
        """
        self.config = self._load_config(config_path)
        self.url = self.config['certstream_url']
        self.israeli_tld_suffixes = self.config['israeli_tld_suffixes']
        self.exclude_suffixes = self.config['exclude_suffixes']
        self.blacklisted_domains = self.config.get('blacklisted_domains', [])
        
        # Initialize database manager
        self.db_manager = DBManager(
            mongodb_uri=self.config['mongodb_uri'],
            database_name=self.config['database_name'],
            collection_name=self.config['collection_name']
        )

    def _load_config(self, config_path):
        """Load configuration from JSON file."""
        try:
            with open(config_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"Error: Configuration file '{config_path}' not found!")
            sys.exit(1)
        except json.JSONDecodeError as e:
            print(f"Error: Invalid JSON in configuration file: {e}")
            sys.exit(1)

    def _clean_domain(self, domain):
        """
        Remove wildcards and clean domain name.
        
        Args:
            domain: Raw domain name from certificate
            
        Returns:
            str: Cleaned domain name
        """
        # Remove wildcard prefix
        if domain.startswith('*.'):
            domain = domain[2:]
        
        return domain.strip().lower()

    def _is_target_domain(self, domain_lower):
        """
        Check if the domain matches Israeli TLDs and is not excluded or blacklisted.
        
        Args:
            domain_lower: Lowercase domain name
            
        Returns:
            bool: True if domain should be monitored
        """
        # 1. Check for Israeli TLD
        is_israeli_tld = any(domain_lower.endswith(tld) for tld in self.israeli_tld_suffixes)
        
        if not is_israeli_tld:
            return False

        # 2. Check for exclusion suffixes
        is_excluded = any(suffix in domain_lower for suffix in self.exclude_suffixes)
        
        if is_excluded:
            return False

        # 3. Check blacklist
        is_blacklisted = domain_lower in self.blacklisted_domains
        
        if is_blacklisted:
            return False

        return True

    def _extract_base_domain(self, domain):
        """
        Extract the base domain from a subdomain.
        
        Args:
            domain: Full domain name
            
        Returns:
            str: Base domain (e.g., 'example.co.il' from 'www.example.co.il')
        """
        parts = domain.split('.')
        
        # For Israeli TLDs like .co.il, we need at least 3 parts
        for suffix in self.israeli_tld_suffixes:
            if domain.endswith(suffix):
                suffix_parts = suffix.lstrip('.').split('.')
                needed_parts = len(suffix_parts) + 1
                
                if len(parts) >= needed_parts:
                    return '.'.join(parts[-needed_parts:])
        
        return domain

    def _format_message(self, message):
        """Extracts and formats the necessary data from the CertStream message."""
        data = message.get('data', {})
        cert = data.get('leaf_cert', {})
        domain_names = cert.get('all_domains', [])

        # Date Conversion Fix (from milliseconds to seconds)
        not_before_timestamp = cert.get('not_before')
        time_issued = datetime.datetime.utcnow()
        if not_before_timestamp:
            try:
                if len(str(not_before_timestamp)) > 10:
                    time_issued = datetime.datetime.fromtimestamp(not_before_timestamp / 1000.0)
                else:
                    time_issued = datetime.datetime.fromtimestamp(not_before_timestamp)
            except Exception:
                pass

        # Safely get issuer name
        issuer_cn = 'N/A'
        chain = data.get('chain')
        if chain and len(chain) > 0:
            issuer_cn = chain[0].get('subject', {}).get('CN', 'N/A')

        log_name = data.get('seen_in', [{}])[0].get('name', 'N/A')

        return {
            "domain_names": domain_names,
            "time_issued": time_issued,
            "issuer_cn": issuer_cn,
            "log_name": log_name,
            "cert_id": cert.get('serial_number', 'N/A')
        }

    def process_certificate(self, message, context):
        """The main callback function passed to certstream.listen_for_events."""
        if message.get('message_type') != "certificate_update":
            return

        data = self._format_message(message)

        # Clean and filter domains
        valid_domains = {}  # base_domain -> [subdomains]
        
        for raw_domain in data['domain_names']:
            # Clean the domain (remove wildcards)
            clean = self._clean_domain(raw_domain)
            
            # Check if it meets our criteria
            if not self._is_target_domain(clean):
                continue
            
            # Extract base domain
            base = self._extract_base_domain(clean)
            
            # Add to our collection
            if base not in valid_domains:
                valid_domains[base] = []
            
            if clean != base:  # It's a subdomain
                valid_domains[base].append(clean)

        # Save to database
        for base_domain, subdomains in valid_domains.items():
            try:
                self.db_manager.save_domain(
                    domain=base_domain,
                    subdomains=subdomains,
                    time_issued=data['time_issued'],
                    issuer_cn=data['issuer_cn'],
                    log_name=data['log_name'],
                    cert_id=data['cert_id']
                )
                print(f"[+] Saved: {base_domain} with {len(subdomains)} subdomain(s)")
            except Exception as e:
                print(f"[-] Error saving {base_domain}: {e}")

    def start(self):
        """Initiates the CertStream connection."""
        print(f"Connecting to CertStream at {self.url} for real-time CT log monitoring...")
        print(f"Filtering for Israeli TLDs ({', '.join(self.israeli_tld_suffixes)})")
        print(f"Excluding suffixes: {', '.join(self.exclude_suffixes)}")
        print(f"Blacklisted domains: {len(self.blacklisted_domains)}")
        print(f"Connected to MongoDB: {self.config['database_name']}/{self.config['collection_name']}\n")

        try:
            certstream.listen_for_events(self.process_certificate, url=self.url)
        except KeyboardInterrupt:
            print("\nMonitoring stopped by user.")
            self.db_manager.close()
            sys.exit(0)
        except Exception as e:
            print(f"An unexpected error occurred in CertStream listener: {e}")
            self.db_manager.close()
            sys.exit(1)


if __name__ == '__main__':

    monitor = CertMonitor('config.json')
    monitorT = threading.Thread(target=monitor.start,daemon=True)
    monitorT.start()

    api = DomainAPI(
        mongodb_uri=monitor.config['mongodb_uri'],
        database_name=monitor.config['database_name'],
        collection_name=monitor.config['collection_name'],
        port=monitor.config['api_port'],
        host=monitor.config['api_host']
    )
    api.run(debug=True)
