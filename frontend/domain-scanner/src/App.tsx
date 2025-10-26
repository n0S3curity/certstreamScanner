import React, { useState, useEffect, useMemo } from 'react';

// --- Type Definitions for TypeScript ---

interface RawDomainData {
    cert_id: string;
    domain: string;
    issuer_cn: string;
    last_seen: string;
    log_name: string;
    subdomains: string[];
    time_issued: string;
}

interface ApiResponse {
    count: number;
    data: RawDomainData[];
    success: boolean;
}

interface Domain {
    id: string;
    name: string;
    subdomains: string[];
    fullSubdomains: string[];
    tags: string[];
    timestamp: string;
}

type StyleMap = {
    [key: string]: React.CSSProperties;
};

// --- Static Filters ---
const PREPARED_SUBDOMAIN_FILTERS = [
    { label: 'All Subs', value: 'all' },
    { label: '0 Subs', value: '0' },
    { label: '1-3 Subs', value: '1-3' },
    { label: '4+ Subs', value: '4+' },
];


// --- Tagging Logic Function ---
function generateTags(domainName: string, subdomains: string[]): string[] {
    const allNames = [domainName, ...subdomains].map(s => s.toLowerCase());
    const tags = new Set<string>();

    const keywordMap: { [key: string]: string } = {
        'admin': 'admin',
        'dev': 'dev',
        'staging': 'staging',
        'prod': 'prod',
        'test': 'test',
        'api': 'api',
        'auth': 'security',
        'vpn': 'security',
        'db': 'db',
        'mail': 'email',
        'beta': 'beta',
        'billing': 'finance',
        'checkout': 'ecom',
        'shop': 'ecom',
        'cdn': 'network',
        'internal': 'internal',
        'hr': 'internal',
        'docs': 'docs',
    };

    allNames.forEach(name => {
        for (const [keyword, tag] of Object.entries(keywordMap)) {
            if (name.includes(keyword)) {
                tags.add(tag);
            }
        }
    });

    return Array.from(tags).filter(t => t.length > 0);
}


function App() {
    // --- State ---
    const [allDomains, setAllDomains] = useState<Domain[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [activeSuffixFilter, setActiveSuffixFilter] = useState<string>('All');
    const [activeSubdomainFilter, setActiveSubdomainFilter] = useState<string>('all');
    const [activeTagFilter, setActiveTagFilter] = useState<string>('All Tags');

    // --- Dynamic Filters ---

    // 1. Dynamic Tags
    const availableTags: string[] = useMemo(() => {
        const tags = new Set<string>(['All Tags']);
        allDomains.forEach(domain => domain.tags.forEach(tag => tags.add(tag)));
        return Array.from(tags).sort((a, b) => {
            if (a === 'All Tags') return -1;
            if (b === 'All Tags') return 1;
            return a.localeCompare(b);
        });
    }, [allDomains]);

    // 2. Dynamic Suffixes
    const availableSuffixes: string[] = useMemo(() => {
        const suffixes = new Set<string>(['All']);
        allDomains.forEach(domain => {
            const parts = domain.name.split('.');
            if (parts.length >= 2) {
                suffixes.add('.' + parts[parts.length - 1]);
                if (parts.length >= 3) {
                     suffixes.add('.' + parts[parts.length - 2] + '.' + parts[parts.length - 1]);
                }
            }
        });
        return Array.from(suffixes).sort((a, b) => {
            if (a === 'All') return -1;
            if (b === 'All') return 1;
            return a.localeCompare(b);
        });
    }, [allDomains]);


    // --- Data Fetching ---
    useEffect(() => {
        const fetchDomains = async () => {
            setLoading(true);
            setError(null);

            const apiUrl = 'http://localhost:5000/api/domains';

            try {
                const response = await fetch(apiUrl);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const apiData: ApiResponse = await response.json();

                const processedData: Domain[] = apiData.data.map(item => {
                    const simpleSubdomains = item.subdomains.map(fullSub => {
                        return fullSub.replace(new RegExp(`\\.?${item.domain}$`, 'i'), '').trim();
                    }).filter(s => s.length > 0 && s !== 'www');

                    return {
                        id: item.cert_id,
                        name: item.domain,
                        subdomains: simpleSubdomains,
                        fullSubdomains: item.subdomains,
                        timestamp: item.last_seen,
                        tags: generateTags(item.domain, item.subdomains),
                    }
                });

                setAllDomains(processedData);
            } catch (e: any) {
                setError(`Failed to fetch data: ${e.message}. Is the API running at ${apiUrl}?`);
                console.error("Failed to fetch domains:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchDomains();
    }, []);

    // --- Filtering Logic ---
    const filteredDomains = useMemo(() => {
        let currentDomains = allDomains;

        if (searchTerm) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            currentDomains = currentDomains.filter(domain =>
                domain.name.toLowerCase().includes(lowerSearchTerm) ||
                domain.subdomains.some(sub => sub.toLowerCase().includes(lowerSearchTerm)) ||
                domain.tags.some(tag => tag.toLowerCase().includes(lowerSearchTerm))
            );
        }

        if (activeSuffixFilter !== 'All') {
            currentDomains = currentDomains.filter(domain => domain.name.toLowerCase().endsWith(activeSuffixFilter));
        }

        if (activeSubdomainFilter !== 'all') {
            currentDomains = currentDomains.filter(domain => {
                const count = domain.subdomains.length;
                if (activeSubdomainFilter === '0') return count === 0;
                if (activeSubdomainFilter === '1-3') return count >= 1 && count <= 3;
                if (activeSubdomainFilter === '4+') return count >= 4;
                return true;
            });
        }

        if (activeTagFilter !== 'All Tags') {
            currentDomains = currentDomains.filter(domain => domain.tags.includes(activeTagFilter));
        }

        return currentDomains;
    }, [allDomains, searchTerm, activeSuffixFilter, activeSubdomainFilter, activeTagFilter]);


    const getTagColorStyle = (tag: string): React.CSSProperties => {
        if (tag === 'admin' || tag === 'internal' || tag === 'security') return { backgroundColor: '#f56565', color: '#1a202c' };
        if (tag === 'dev' || tag === 'staging' || tag === 'test' || tag === 'beta') return { backgroundColor: '#f6e05e', color: '#1a202c' };
        if (tag === 'prod' || tag === 'ecom' || tag === 'finance') return { backgroundColor: '#48bb78', color: '#1a202c' };
        if (tag === 'network' || tag === 'docs' || tag === 'email' || tag === 'api') return { backgroundColor: '#90cdf4', color: '#1a202c' };
        return { backgroundColor: '#63b3ed', color: '#1a202c' };
    };

    // --- Render Content ---
    const renderContent = () => {
        if (loading) {
            return <div style={styles.message}>Loading domains from API...</div>;
        }
        if (error) {
            return <div style={{...styles.message, color: '#f56565'}}>Error: {error}</div>;
        }

        return (
            <div style={styles.domainGrid}>
                {filteredDomains.length === 0 ? (
                    <div style={styles.message}>No domains found matching your criteria.</div>
                ) : (
                    filteredDomains.map(domain => (
                        <div key={domain.id} style={styles.domainCard}>
                            <a
                                href={`https://${domain.name}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={styles.domainNameLink}
                            >
                                <h3 style={styles.domainName}>{domain.name}</h3>
                            </a>

                            {domain.tags.length > 0 && (
                                <div style={styles.tagList}>
                                    {domain.tags.map(tag => (
                                        <span
                                            key={`${domain.id}-${tag}`}
                                            style={{...styles.tagBadge, ...getTagColorStyle(tag)}}
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <p style={styles.subdomainTitle}>
                                Subdomains ({domain.fullSubdomains.length}):
                            </p>

                            {domain.fullSubdomains.length > 0 ? (
                                <div style={styles.subdomainList}>
                                    {domain.fullSubdomains.map(fullSub => (
                                        <a
                                            key={`${domain.id}-${fullSub}`}
                                            href={`https://${fullSub}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={styles.subdomainTagLink}
                                        >
                                            <span style={styles.subdomainTag}>
                                                {fullSub}
                                            </span>
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <p style={styles.noSubMessage}>No subdomains found in certificate.</p>
                            )}

                            <small style={styles.timestamp}>Last Seen: {new Date(domain.timestamp).toLocaleString()}</small>
                        </div>
                    ))
                )}
            </div>
        );
    };

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <h1 style={styles.mainTitle}>Certstream Domain Scanner 🌐</h1>
                <p style={styles.subTitle}>Real-time Certificate Transparency Monitoring</p>
            </header>

            <div style={styles.controls}>
                <input
                    type="text"
                    placeholder="Search domains, subdomains, or tags..."
                    style={styles.searchBar}
                    value={searchTerm}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* --- COMPACT FILTERS SECTION --- */}
            <div style={styles.allFiltersWrapper}>
                <div style={styles.filterSection}>
                    <h2 style={styles.filterSectionTitle}>Suffix</h2>
                    <div style={styles.filterButtonGroup}>
                        {availableSuffixes.map(filter => (
                            <button
                                key={filter}
                                style={
                                    activeSuffixFilter === filter
                                        ? { ...styles.filterButton, ...styles.filterButtonActive }
                                        : styles.filterButton
                                }
                                onClick={() => setActiveSuffixFilter(filter)}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={styles.filterSection}>
                    <h2 style={styles.filterSectionTitle}>Subdomain Count</h2>
                    <div style={styles.filterButtonGroup}>
                        {PREPARED_SUBDOMAIN_FILTERS.map(filter => (
                            <button
                                key={filter.value}
                                style={
                                    activeSubdomainFilter === filter.value
                                        ? { ...styles.filterButton, ...styles.filterButtonActive }
                                        : styles.filterButton
                                }
                                onClick={() => setActiveSubdomainFilter(filter.value)}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Dynamically Generated Tag Filters */}
                <div style={styles.filterSection}>
                    <h2 style={styles.filterSectionTitle}>Tags</h2>
                    <div style={styles.filterButtonGroup}>
                        {availableTags.map(filter => (
                            <button
                                key={filter}
                                style={
                                    activeTagFilter === filter
                                        ? { ...styles.filterButton, ...styles.filterButtonActive }
                                        : styles.filterButton
                                }
                                onClick={() => setActiveTagFilter(filter)}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Domain Counts Display */}
            <div style={styles.countBar}>
                <span style={styles.countItem}>
                    Total Domains: <strong style={{ color: '#68d391' }}>{allDomains.length}</strong>
                </span>
                <span style={styles.countItem}>
                    Filtered Results: <strong style={{ color: '#90cdf4' }}>{filteredDomains.length}</strong>
                </span>
            </div>

            <main style={styles.resultsContainer}>
                {renderContent()}
            </main>
        </div>
    );
}

// --- Styles (Final Verified Structure) ---
const styles: StyleMap = {
    // Global & Layout
    container: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        minHeight: '100vh',
        backgroundColor: '#1a202c',
        color: '#e2e8f0',
        padding: '20px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    header: {
        textAlign: 'center',
        marginBottom: '30px',
        paddingBottom: '20px',
        borderBottom: '1px solid #2d3748',
        width: '100%',
        maxWidth: '1200px',
    },
    mainTitle: {
        fontSize: '2.5em',
        color: '#63b3ed',
        marginBottom: '5px',
    },
    subTitle: {
        fontSize: '1.1em',
        color: '#a0aec0',
    },
    controls: {
        marginBottom: '25px',
        width: '100%',
        maxWidth: '800px',
    },
    searchBar: {
        width: '100%',
        padding: '12px 15px',
        fontSize: '16px',
        borderRadius: '8px',
        border: '1px solid #4a5568',
        backgroundColor: '#2d3748',
        color: '#e2e8f0',
        boxSizing: 'border-box',
    },

    // Filter Grouping
    allFiltersWrapper: {
        width: '100%',
        maxWidth: '1200px',
        marginBottom: '20px',
        padding: '15px 0',
        backgroundColor: '#2d3748',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-around',
    },
    filterSection: {
        flex: '1 1 300px',
        padding: '0 15px',
        marginBottom: '10px',
        borderRight: '1px solid #4a5568',
    },
    filterSectionTitle: {
        fontSize: '1em',
        color: '#90cdf4',
        marginBottom: '8px',
        textAlign: 'center',
        fontWeight: 'normal',
        textTransform: 'uppercase',
    },
    filterButtonGroup: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        justifyContent: 'center',
        maxHeight: '100px',
        overflowY: 'auto',
        padding: '5px',
    },
    filterButton: {
        padding: '6px 10px',
        fontSize: '12px',
        border: '1px solid #4a5568',
        borderRadius: '15px',
        backgroundColor: 'transparent',
        color: '#e2e8f0',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        flexShrink: 0,
    },
    filterButtonActive: {
        backgroundColor: '#63b3ed',
        borderColor: '#63b3ed',
        color: '#1a202c',
        fontWeight: 'bold',
    },

    // Domain Counts Display
    countBar: {
        width: '100%',
        maxWidth: '1200px',
        marginBottom: '20px',
        padding: '10px 20px',
        backgroundColor: '#4a5568',
        borderRadius: '8px',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '1.1em',
    },
    countItem: {
        color: '#a0aec0',
    },

    // Domain Cards
    resultsContainer: {
        width: '100%',
        maxWidth: '1200px',
        flexGrow: 1,
    },
    domainGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '20px',
        padding: '20px 0',
    },
    domainCard: {
        backgroundColor: '#2d3748',
        borderRadius: '10px',
        padding: '20px',
        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
        border: '1px solid #4a5568',
        display: 'flex',
        flexDirection: 'column',
    },
    domainNameLink: {
        textDecoration: 'none',
        color: 'inherit',
    },
    domainName: {
        fontSize: '1.4em',
        color: '#90cdf4',
        marginBottom: '8px',
        wordBreak: 'break-word',
        cursor: 'pointer',
        transition: 'color 0.2s',
    },
    tagList: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        marginBottom: '15px',
    },
    tagBadge: {
        padding: '4px 8px',
        borderRadius: '10px',
        fontSize: '0.75em',
        fontWeight: 'bold',
        textTransform: 'capitalize',
    },
    subdomainTitle: {
        fontSize: '0.9em',
        color: '#a0aec0',
        marginTop: '10px',
        marginBottom: '5px',
        borderTop: '1px dashed #4a5568',
        paddingTop: '10px',
    },
    subdomainList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        maxHeight: '120px',
        overflowY: 'auto',
        padding: '5px',
        border: '1px dashed #4a5568',
        borderRadius: '5px',
    },
    subdomainTagLink: {
        textDecoration: 'none',
        color: 'inherit',
    },
    subdomainTag: {
        backgroundColor: '#4a5568',
        color: '#e2e8f0',
        padding: '5px 10px',
        borderRadius: '5px',
        fontSize: '0.85em',
        cursor: 'pointer',
        wordBreak: 'break-all',
        transition: 'background-color 0.2s',
    },
    noSubMessage: {
        color: '#718096',
        fontStyle: 'italic',
        fontSize: '0.9em',
        padding: '10px 0',
    },
    timestamp: {
        fontSize: '0.7em',
        color: '#718096',
        marginTop: 'auto', // Keep this for flex alignment
        paddingTop: '10px',
        borderTop: '1px solid #4a5568',
        // Removed the duplicate 'marginTop: '15px',' here to fix TS1117
    },

    // Messages
    message: {
        textAlign: 'center',
        padding: '40px',
        color: '#a0aec0',
        fontSize: '1.1em',
    },
};

export default App;
