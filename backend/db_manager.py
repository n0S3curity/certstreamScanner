from pymongo import MongoClient, ASCENDING
from datetime import datetime
import json


class DBManager:
    """
    Manages MongoDB connections and operations for domain storage.
    """

    def __init__(self, mongodb_uri, database_name, collection_name):
        """
        Initialize MongoDB connection.

        Args:
            mongodb_uri: MongoDB connection string
            database_name: Name of the database
            collection_name: Name of the collection
        """
        self.client = MongoClient(mongodb_uri)
        self.db = self.client[database_name]
        self.collection = self.db[collection_name]
        self._create_indexes()

    def _create_indexes(self):
        """Create indexes for better query performance."""
        self.collection.create_index([("domain", ASCENDING)], unique=True)
        self.collection.create_index([("time_issued", ASCENDING)])

    def save_domain(self, domain, subdomains, time_issued, issuer_cn, log_name, cert_id):
        """
        Save a domain with its subdomains to MongoDB.

        Args:
            domain: Main domain name
            subdomains: List of subdomains
            time_issued: Certificate issue timestamp
            issuer_cn: Certificate issuer common name
            log_name: CT log name
            cert_id: Certificate serial number

        Returns:
            bool: True if saved successfully, False otherwise
        """
        try:
            # Check if domain already exists
            existing = self.collection.find_one({"domain": domain})

            if existing:
                # Domain exists - merge subdomains without duplicates
                existing_subdomains = set(existing.get("subdomains", []))
                new_subdomains = existing_subdomains.union(set(subdomains))

                # Update with merged subdomains
                self.collection.update_one(
                    {"domain": domain},
                    {
                        "$set": {
                            "subdomains": list(new_subdomains),
                            "time_issued": time_issued,
                            "issuer_cn": issuer_cn,
                            "log_name": log_name,
                            "cert_id": cert_id,
                            "last_seen": datetime.utcnow()
                        }
                    }
                )
            else:
                # New domain - insert fresh
                document = {
                    "domain": domain,
                    "subdomains": list(set(subdomains)),  # Remove duplicates
                    "time_issued": time_issued,
                    "issuer_cn": issuer_cn,
                    "log_name": log_name,
                    "cert_id": cert_id,
                    "last_seen": datetime.utcnow()
                }
                self.collection.insert_one(document)

            return True

        except Exception as e:
            print(f"Error saving domain {domain}: {e}")
            return False

    def get_all_domains(self):
        """
        Retrieve all domains and subdomains from the database.

        Returns:
            str: JSON string of all domains and subdomains
        """
        try:
            domains = list(self.collection.find({}, {"_id": 0}).sort("time_issued", -1))

            # Convert datetime objects to ISO format strings
            for domain in domains:
                if isinstance(domain.get('time_issued'), datetime):
                    domain['time_issued'] = domain['time_issued'].isoformat()
                if isinstance(domain.get('last_seen'), datetime):
                    domain['last_seen'] = domain['last_seen'].isoformat()

            return json.dumps(domains, indent=2)

        except Exception as e:
            print(f"Error retrieving domains: {e}")
            return json.dumps({"error": str(e)})

    def close(self):
        """Close the MongoDB connection."""
        self.client.close()