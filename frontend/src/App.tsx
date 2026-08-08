import { useState } from 'react';
import { useHealthCheck } from './hooks/useHealthCheck';
import { initAgent, discoverTopics, fetchTopics } from './services/api';
import type { DiscoveredTopic } from './services/api';

export default function App() {
  const { status, lastChecked, isChecking, check } = useHealthCheck();

  // Stage 1 State
  const [personaName, setPersonaName] = useState('');
  const [personaDomain, setPersonaDomain] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Stage 2 State
  const [topics, setTopics] = useState<DiscoveredTopic[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  // Helper to get status details
  const getStatusDetails = () => {
    switch (status) {
      case 'connected':
        return {
          label: 'Backend: Connected',
          colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          indicatorClass: 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]',
          message: 'Frontend is successfully connected to the Autonomous AI Creator backend.',
        };
      case 'offline':
        return {
          label: 'Backend: Offline',
          colorClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
          indicatorClass: 'bg-rose-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]',
          message: 'Unable to reach the backend. Check that the server is running and configuration is correct.',
        };
      case 'checking':
      default:
        return {
          label: 'Backend: Checking...',
          colorClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          indicatorClass: 'bg-amber-500 animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.5)]',
          message: 'Pinging backend health check endpoint...',
        };
    }
  };

  const statusDetails = getStatusDetails();
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

  // Form Submit Handler (Agent Initialization)
  const handleInitialize = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedName = personaName.trim();
    const trimmedDomain = personaDomain.trim();

    if (!trimmedName || !trimmedDomain) {
      setErrorMsg('Persona Name and Domain Focus are required fields.');
      return;
    }

    setIsInitializing(true);

    try {
      const response = await initAgent({
        name: trimmedName,
        domain: trimmedDomain,
      });

      if (response && response.agentId) {
        setAgentId(response.agentId);
        setPersonaName(trimmedName);
        setPersonaDomain(trimmedDomain);
      } else {
        throw new Error('Malformed backend response');
      }
    } catch (err: any) {
      console.error('Initialization error:', err);
      setErrorMsg(
        err.message || 'Unable to initialize the agent. Please check the connection and try again.'
      );
    } finally {
      setIsInitializing(false);
    }
  };

  // Stage 2: Discover Topics Trigger
  const handleDiscover = async () => {
    if (!agentId) return;

    setIsDiscovering(true);
    setDiscoveryError(null);

    try {
      // 1. Run discovery cycle
      await discoverTopics(agentId);

      // 2. Fetch discovered topics list
      const topicsRes = await fetchTopics(agentId);
      setTopics(topicsRes.topics);
    } catch (err: any) {
      console.error('Discovery error:', err);
      setDiscoveryError(
        err.message || 'Unable to discover topics. Please check the connection and try again.'
      );
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleReset = () => {
    setAgentId(null);
    setPersonaName('');
    setPersonaDomain('');
    setErrorMsg(null);
    setTopics([]);
    setDiscoveryError(null);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-violet-500/30 selection:text-violet-200">
      {/* Top Header Navigation */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" stroke="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-zinc-50 to-zinc-300 bg-clip-text text-transparent">
                Autonomous AI Creator
              </span>
              <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800">
                Stage 2
              </span>
            </div>
          </div>

          {/* Quick status pill in header */}
          <div className="flex items-center space-x-2">
            <span className={`flex items-center text-xs font-semibold px-3 py-1 rounded-full border ${statusDetails.colorClass}`}>
              <span className={`h-2.5 w-2.5 rounded-full mr-2 ${statusDetails.indicatorClass}`} />
              {statusDetails.label}
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-10 flex flex-col justify-center">
        {/* Banner/Hero area */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent mb-4">
            Autonomous AI Creator
          </h1>
          <p className="text-zinc-400 text-base sm:text-lg">
            Scan live feeds, capture candidate articles, and filter relevant technology topics in Stage 2.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Diagnostic Console Panel */}
          <div className="lg:col-span-1 bg-zinc-900/50 border border-zinc-900 rounded-2xl p-6 backdrop-blur-sm flex flex-col justify-between">
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-zinc-100 flex items-center">
                <svg className="h-5 w-5 mr-2 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" stroke="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                System Status
              </h3>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-900">
                  <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1 font-semibold">Active Status</div>
                  <div className="flex items-center space-x-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${statusDetails.indicatorClass}`} />
                    <span className="font-semibold text-sm text-zinc-200">{statusDetails.label}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-900">
                  <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1 font-semibold">Agent Status</div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        agentId
                          ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                          : 'bg-zinc-650'
                      }`}
                    />
                    <span className="font-semibold text-sm text-zinc-200">
                      {agentId ? '● Initialized' : '● Not Initialized'}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-900 space-y-2">
                  <div>
                    <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Configured Endpoint</div>
                    <code className="text-xs text-violet-400 break-all select-all font-mono block mt-1">
                      {apiBaseUrl}/api/agent/discover
                    </code>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-900">
                  <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1 font-semibold">Last Checked</div>
                  <div className="text-sm text-zinc-300 font-mono">
                    {lastChecked ? lastChecked.toLocaleTimeString() : 'Never'}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-zinc-900">
              <button
                type="button"
                onClick={check}
                disabled={isChecking}
                className="w-full flex items-center justify-center px-4 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-950 disabled:text-zinc-700 disabled:border-zinc-900 border border-zinc-800 text-zinc-300 font-medium text-sm transition-all duration-200 shadow-md cursor-pointer disabled:cursor-not-allowed"
              >
                {isChecking ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Pinging API...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" stroke="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3 3L22 4" />
                    </svg>
                    Check API Connection
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Action Center - Forms or Discovery List */}
          <div className="lg:col-span-2 space-y-6">
            {agentId ? (
              <div className="space-y-6 animate-fade-in">
                {/* Active Agent Info Card */}
                <div className="bg-zinc-900/50 border border-zinc-900 rounded-2xl p-6 sm:p-8 backdrop-blur-sm space-y-6">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                    <div className="flex items-center space-x-3.5">
                      <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-sm shadow-emerald-500/5">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" stroke="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-zinc-100">Agent Persona</h3>
                        <p className="text-xs text-zinc-500">Autonomous creator identity.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-800 text-zinc-500 hover:text-zinc-300 text-xs font-medium transition-all cursor-pointer"
                    >
                      Clear Agent
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-900">
                      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1 font-semibold">Persona Name</div>
                      <div className="font-semibold text-sm text-zinc-200">{personaName}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-900">
                      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1 font-semibold">Domain Focus</div>
                      <div className="font-semibold text-sm text-zinc-200">{personaDomain}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-900 md:col-span-2">
                      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1 font-semibold">Unique Agent ID</div>
                      <code className="text-xs text-violet-400 font-mono select-all break-all block mt-1">
                        {agentId}
                      </code>
                    </div>
                  </div>
                </div>

                {/* Topic Discovery Panel */}
                <div className="bg-zinc-900/50 border border-zinc-900 rounded-2xl p-6 sm:p-8 backdrop-blur-sm space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-zinc-100 flex items-center">
                        <svg className="h-5 w-5 mr-2 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" stroke="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 9.172V5L8 4z" />
                        </svg>
                        Topic Discovery
                      </h3>
                      <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                        Query configured tech RSS feeds. Hits matching <strong className="text-violet-400">{personaDomain}</strong> words will rise to the top.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleDiscover}
                      disabled={isDiscovering || status === 'offline'}
                      className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-900 disabled:text-zinc-600 disabled:border-zinc-900 border border-violet-500/20 text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-violet-500/10 cursor-pointer disabled:cursor-not-allowed shrink-0"
                    >
                      {isDiscovering ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-zinc-300" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Discovering topics...
                        </span>
                      ) : (
                        'Discover Topics'
                      )}
                    </button>
                  </div>

                  {discoveryError && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-xs flex items-start space-x-2.5">
                      <svg className="h-4 w-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" stroke="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>{discoveryError}</span>
                    </div>
                  )}

                  {/* Discovered Cards feed */}
                  {topics.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <span>{topics.length} topics discovered</span>
                        <span>Relevance sorted</span>
                      </div>

                      <div className="grid grid-cols-1 gap-4 max-h-[500px] overflow-y-auto pr-1 space-y-1">
                        {topics.map((topic) => (
                          <div
                            key={topic.id}
                            className="p-5 rounded-xl bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition-all duration-200 space-y-3"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <h4 className="font-bold text-zinc-200 text-sm sm:text-base leading-snug">
                                {topic.title}
                              </h4>
                              <a
                                href={topic.source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors whitespace-nowrap shrink-0 flex items-center"
                              >
                                View Source
                                <svg className="h-3 w-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" stroke="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            </div>
                            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                              {topic.summary}
                            </p>
                            <div className="flex items-center space-x-4 text-[10px] sm:text-xs text-zinc-500">
                              <span>Source: <strong className="text-zinc-400">{topic.source.name}</strong></span>
                              <span>•</span>
                              <span>Published: {new Date(topic.publishedAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Empty state card */
                    <div className="p-8 text-center bg-zinc-950 border border-zinc-900 rounded-xl space-y-3">
                      <div className="h-10 w-10 mx-auto rounded-xl bg-zinc-900 border border-zinc-850 flex items-center justify-center text-zinc-500">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" stroke="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-zinc-300">No topics discovered yet</h4>
                        <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 leading-relaxed">
                          Scan live AI and technology RSS feeds to collect matches for your persona.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Setup Form Panel */
              <div className="bg-zinc-900/50 border border-zinc-900 rounded-2xl p-6 sm:p-8 backdrop-blur-sm space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-zinc-100 mb-1 flex items-center">
                    <svg className="h-5 w-5 mr-2 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" stroke="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    Create Your AI Persona
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Define the name and specialized target domain for your autonomous creator instance.
                  </p>
                </div>

                {/* API Warning when Offline */}
                {status === 'offline' && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-xs leading-relaxed flex items-start space-x-2.5">
                    <svg className="h-4 w-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" stroke="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>
                      <strong>Backend Server Offline:</strong> You will not be able to initialize the agent until the backend server starts running at <code>{apiBaseUrl}</code>.
                    </span>
                  </div>
                )}

                {/* General Error Displays */}
                {errorMsg && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-xs leading-relaxed flex items-start space-x-2.5">
                    <svg className="h-4 w-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" stroke="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleInitialize} className="space-y-4">
                  <div>
                    <label htmlFor="persona-name" className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                      Persona Name
                    </label>
                    <input
                      id="persona-name"
                      type="text"
                      placeholder="e.g. Ada"
                      value={personaName}
                      onChange={(e) => setPersonaName(e.target.value)}
                      disabled={isInitializing || status === 'offline'}
                      className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label htmlFor="persona-domain" className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                      Domain Focus
                    </label>
                    <input
                      id="persona-domain"
                      type="text"
                      placeholder="e.g. AI Security"
                      value={personaDomain}
                      onChange={(e) => setPersonaDomain(e.target.value)}
                      disabled={isInitializing || status === 'offline'}
                      className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={isInitializing || status === 'offline'}
                      className="w-full flex items-center justify-center px-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-900 disabled:text-zinc-600 disabled:border-zinc-900 border border-violet-500/20 text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-violet-500/10 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {isInitializing ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-zinc-300" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Initializing Agent...
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" stroke="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Initialize Agent
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Stage Capabilities Roadmap */}
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-zinc-100 flex items-center">
                  <svg className="h-5 w-5 mr-2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" stroke="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Core Capabilities Roadmap
                </h3>
                <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Upcoming Stages</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Persona Engine */}
                <div className={`border rounded-xl p-5 select-none relative overflow-hidden group transition-all duration-300 bg-violet-950/10 border-violet-500/20 text-zinc-200`}>
                  <div className="absolute top-3 right-3 flex items-center space-x-1.5 bg-zinc-950 px-2 py-0.5 rounded text-[10px] text-zinc-500 border border-zinc-900">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" stroke="M5 13l4 4L19 7" />
                    </svg>
                    <span>COMPLETE</span>
                  </div>
                  <h4 className="font-semibold text-zinc-300 text-sm mb-1 flex items-center">
                    Persona & Branding Engine
                  </h4>
                  <p className="text-xs text-zinc-500">
                    Define voice parameters, styling rules, target demographics, and brand alignments for the creator.
                  </p>
                </div>

                {/* Topic Discovery Engine */}
                <div className={`border rounded-xl p-5 select-none relative overflow-hidden group transition-all duration-300 ${
                  topics.length > 0
                    ? 'bg-violet-950/10 border-violet-500/20 text-zinc-200'
                    : 'bg-zinc-900/25 border-zinc-900/60 opacity-40'
                }`}>
                  <div className="absolute top-3 right-3 flex items-center space-x-1.5 bg-zinc-950 px-2 py-0.5 rounded text-[10px] text-zinc-500 border border-zinc-900">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      {topics.length > 0 ? (
                        <path strokeLinecap="round" strokeLinejoin="round" stroke="M5 13l4 4L19 7" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" stroke="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      )}
                    </svg>
                    <span>{topics.length > 0 ? 'COMPLETE' : 'STAGE 2'}</span>
                  </div>
                  <h4 className="font-semibold text-zinc-300 text-sm mb-1">
                    Topic Discovery Engine
                  </h4>
                  <p className="text-xs text-zinc-500">
                    Parse technology and RSS research feeds concurrently and sanitize output content.
                  </p>
                </div>

                {/* Editorial Decision Room */}
                <div className="bg-zinc-900/25 border border-zinc-900/60 rounded-xl p-5 opacity-40 select-none relative overflow-hidden group">
                  <div className="absolute top-3 right-3 flex items-center space-x-1.5 bg-zinc-950 px-2 py-0.5 rounded text-[10px] text-zinc-500 border border-zinc-900">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" stroke="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>STAGE 3</span>
                  </div>
                  <h4 className="font-semibold text-zinc-300 text-sm mb-1">
                    Editorial Decision Room
                  </h4>
                  <p className="text-xs text-zinc-500">
                    Inspect generated outlines, confidence scores, sources checklist, and editing logs.
                  </p>
                </div>

                {/* Feed & Publication Stream */}
                <div className="bg-zinc-900/25 border border-zinc-900/60 rounded-xl p-5 opacity-40 select-none relative overflow-hidden group">
                  <div className="absolute top-3 right-3 flex items-center space-x-1.5 bg-zinc-950 px-2 py-0.5 rounded text-[10px] text-zinc-500 border border-zinc-900">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" stroke="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>STAGE 4</span>
                  </div>
                  <h4 className="font-semibold text-zinc-300 text-sm mb-1">
                    Creative Output Feed
                  </h4>
                  <p className="text-xs text-zinc-500">
                    Review generated posts, formatted copy, and scheduled release metadata.
                  </p>
                </div>
              </div>

              {/* Warning block about Stage 2 constraints */}
              <div className="bg-zinc-900/30 border border-zinc-900/80 rounded-xl p-5 flex items-start space-x-3.5">
                <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 mt-0.5">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" stroke="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Stage 2 Boundaries</h4>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Interactive post drafting, autonomous scheduler background intervals, duplicate semantic vector comparisons, and external API hooks are mocked or bypassed in Stage 2. This interface demonstrates live parsing and domain sorting.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-6">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-600">
          <div className="mb-4 sm:mb-0">
            &copy; 2026 Autonomous AI Creator. Hackathon Project.
          </div>
          <div className="flex space-x-6">
            <span>Developer 1: Backend & LLM Orchestrator</span>
            <span>Developer 2: Frontend Engineer</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
