from flask import Flask, jsonify
from db_manager import DBManager
import json


class DomainAPI:
    """
    Flask API for retrieving domain information.
    """

    def __init__(self, mongodb_uri, database_name, collection_name, host='0.0.0.0', port=5000):
        """
        Initialize Flask API.
        
        Args:
            mongodb_uri: MongoDB connection string
            database_name: Name of the database
            collection_name: Name of the collection
            host: Host to bind the server
            port: Port to bind the server
        """
        self.app = Flask(__name__)
        self.db_manager = DBManager(mongodb_uri, database_name, collection_name)
        self.host = host
        self.port = port
        self._setup_routes()

    def _setup_routes(self):
        """Setup API routes."""
        
        @self.app.route('/api/domains', methods=['GET'])
        def get_domains():
            """
            GET endpoint to retrieve all domains and subdomains.
            
            Returns:
                JSON response with all domains and subdomains
            """
            try:
                domains_json = self.db_manager.get_all_domains()
                domains = json.loads(domains_json)
                
                return jsonify({
                    "success": True,
                    "count": len(domains),
                    "data": domains
                }), 200
                
            except Exception as e:
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500

        @self.app.route('/api/health', methods=['GET'])
        def health_check():
            """Health check endpoint."""
            return jsonify({
                "status": "healthy",
                "service": "Domain Monitor API"
            }), 200

    def run(self, debug=False):
        """
        Start the Flask application.
        
        Args:
            debug: Enable debug mode
        """
        print(f"Starting API server on {self.host}:{self.port}")
        self.app.run(host=self.host, port=self.port, debug=debug)


if __name__ == '__main__':
    import sys
    
    # Load configuration
    try:
        with open('config.json', 'r') as f:
            config = json.load(f)
    except FileNotFoundError:
        print("Error: config.json not found!")
        sys.exit(1)
    
    # # Initialize and run API
    # api = DomainAPI(
    #     mongodb_uri=config['mongodb_uri'],
    #     database_name=config['database_name'],
    #     collection_name=config['collection_name']
    # )
    #
    # api.run(debug=True)
