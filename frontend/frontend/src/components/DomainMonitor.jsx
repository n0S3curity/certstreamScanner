import React, { useState, useEffect, useCallback } from 'react';
import { Search, ExternalLink, Globe, Server, RefreshCw, Filter } from 'lucide-react';

const DomainMonitor = () => {
  const [domains, setDomains] = useState([]);
  const [filteredDomains, setFilteredDomains] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // Now used in the UI

  // Filter presets
  const filterButtons = [
    { id: 'all', label: 'All Domains', icon: Globe },
    { id: 'co.il', label: '.co.il', icon: Server },
    { id: 'org.il', label: '.org.il', icon: Server },
    { id: 'ac.il', label: '.ac.il', icon: Server },
    { id: 'many-subs', label: '3+ Subdomains', icon: Filter }
  ];

  const fetchDomains = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://127.0.0.1:5000/api/domains');

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} - ${response.statusText}`);
      }

      const result = await response.json();

      // Expecting structure: { success: true, data: [...], count: number }
      if (result.success && Array.isArray(result.data)) {
        setDomains(result.data);
      } else {
        console.error("API returned successfully but data format was unexpected:", result);
        setError("API data format is incorrect. Expected {success: true, data: []}.");
        setDomains([]); // Set to empty array
      }
    } catch (err) {
      console.error("Error fetching domains:", err.message);
      setError(`Failed to connect to API: ${err.message}. Please ensure the backend is running.`);
      setDomains([]); // Set to empty array
    } finally {
      setLoading(false);
    }
  };

  // Wrapped in useCallback to make it a stable dependency for useEffect
  const applyFilters = useCallback(() => {
    let filtered = [...domains];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(d =>
        d.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.subdomains.some(sub => sub.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply preset filter
    if (selectedFilter !== 'all') {
      if (selectedFilter === 'many-subs') {
        filtered = filtered.filter(d => d.subdomains.length >= 3);
      } else {
        // Corrected filter to ensure it only filters by TLD suffix
        filtered = filtered.filter(d => d.domain.endsWith(`.${selectedFilter}`));
      }
    }

    setFilteredDomains(filtered);
  }, [domains, searchTerm, selectedFilter]);

  useEffect(() => {
    fetchDomains();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [domains, searchTerm, selectedFilter, applyFilters]); // applyFilters is now a stable dependency

  const openDomain = (domain) => {
    window.open(`https://${domain}`, '_blank', 'noopener,noreferrer');
  };

  const formatDate = (dateString) => {
    // Check if dateString is valid before creating Date object
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date)) return 'Invalid Date';
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const uniqueDomainsCount = filteredDomains.length;
  const totalSubdomainsCount = filteredDomains.reduce((acc, d) => acc + d.subdomains.length, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
          <p className="text-white text-xl">Loading domains...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">

      {/* ERROR DISPLAY */}
      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-300 p-4 sticky top-0 z-20 text-center">
          <p className="font-bold">Connection Error:</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Header */}
      <div className="bg-black/30 backdrop-blur-lg border-b border-purple-500/20 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Globe className="w-8 h-8 text-purple-400" />
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Israeli Domain Monitor
                </h1>
                <p className="text-gray-400 text-sm">Real-time certificate transparency tracking</p>
              </div>
            </div>
            <button
              onClick={fetchDomains}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-all transform hover:scale-105"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search domains or subdomains..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white/10 border border-purple-500/30 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur-sm"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2 mt-4">
            {filterButtons.map((filter) => {
              const Icon = filter.icon;
              return (
                <button
                  key={filter.id}
                  onClick={() => setSelectedFilter(filter.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all transform hover:scale-105 ${
                    selectedFilter === filter.id
                      ? 'bg-purple-600 shadow-lg shadow-purple-500/50'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{filter.label}</span>
                </button>
              );
            })}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 backdrop-blur-sm border border-purple-500/30 rounded-xl p-4">
              <p className="text-gray-400 text-sm">Unique Domains</p>
              <p className="text-3xl font-bold text-purple-400">{uniqueDomainsCount}</p>
            </div>
            <div className="bg-gradient-to-br from-pink-600/20 to-purple-600/20 backdrop-blur-sm border border-pink-500/30 rounded-xl p-4">
              <p className="text-gray-400 text-sm">Total Subdomains</p>
              <p className="text-3xl font-bold text-pink-400">{totalSubdomainsCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Domain Cards */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {filteredDomains.length === 0 ? (
          <div className="text-center py-20">
            <Globe className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-xl">No domains found</p>
            <p className="text-gray-500 text-sm mt-2">Try adjusting your filters or search term. (Check the error message above if the API failed to connect.)</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDomains.map((domain, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-purple-500/20 rounded-xl p-6 hover:border-purple-500/50 transition-all transform hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20"
              >
                {/* Domain Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <button
                      onClick={() => openDomain(domain.domain)}
                      className="group flex items-center space-x-2 text-left"
                    >
                      <h3 className="text-lg font-bold text-purple-300 group-hover:text-purple-400 transition-colors break-all">
                        {domain.domain}
                      </h3>
                      <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-purple-400 flex-shrink-0" />
                    </button>
                    <p className="text-xs text-gray-500 mt-1">{formatDate(domain.time_issued)}</p>
                  </div>
                </div>

                {/* Subdomain Count Badge */}
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {domain.subdomains.length} subdomain{domain.subdomains.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs text-gray-500 truncate ml-2">{domain.issuer_cn}</span>
                </div>

                {/* Subdomains List */}
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                  {domain.subdomains.map((subdomain, subIndex) => (
                    <button
                      key={subIndex}
                      onClick={() => openDomain(subdomain)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-slate-700/30 hover:bg-slate-700/50 rounded-lg transition-all group text-left"
                    >
                      <span className="text-sm text-gray-300 group-hover:text-white truncate">
                        {subdomain}
                      </span>
                      <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-purple-400 flex-shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom Scrollbar Styles (Essential for styling the subdomains list) */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(51, 51, 51, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(147, 51, 234, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(147, 51, 234, 0.7);
        }
      `}</style>
    </div>
  );
};

export default DomainMonitor;