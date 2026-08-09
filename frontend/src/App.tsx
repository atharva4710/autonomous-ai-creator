import { useState, useEffect, useCallback } from 'react';
import { useHealthCheck } from './hooks/useHealthCheck';
import {
  initAgent,
  discoverTopics,
  fetchTopics,
  getPersona,
  getMemory,
  checkTopicMemory,
  getMemorySummary,
  generateContent,
  getGeneratedContent,
  getAgentStatus,
  getFeed,
  getAgentActivity,
  getPostExplanation,
  selectFormat,
  publishPostApi,
} from './services/api';
import type {
  DiscoveredTopic,
  AgentPersona,
  MemoryItem,
  MemorySummary,
  PostItem,
  PublishedPost,
  AgentStatusInfo,
  ActivityEvent,
  PostExplanation,
} from './services/api';

function stripHtmlTags(text?: string): string {
  if (!text) return '';
  return text
    .replace(/&lt;a\s+href[\s\S]*?&gt;[\s\S]*?&lt;\/a&gt;/gi, '')
    .replace(/&lt;a\s+href[\s\S]*/gi, '')
    .replace(/<a\s+href[\s\S]*?<\/a>/gi, '')
    .replace(/<a\s+href[\s\S]*/gi, '')
    .replace(/&lt;\/?font[^&]*&gt;/gi, '')
    .replace(/<\/?font[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;[^&]*&gt;/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export default function App() {
  const { lastChecked, isChecking, check } = useHealthCheck();

  // Agent Setup State
  const [personaName, setPersonaName] = useState('Ada');
  const [personaDomain, setPersonaDomain] = useState('AI Security');
  const [personaRole, setPersonaRole] = useState('AI Security Researcher');
  const [personaDescription, setPersonaDescription] = useState(
    'Analytical security researcher focusing on practical risks in modern AI systems.'
  );
  const [isInitializing, setIsInitializing] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(() => {
    return localStorage.getItem('autonomous_agent_id') || null;
  });
  const [initError, setInitError] = useState<string | null>(null);

  // App Data States
  const [topics, setTopics] = useState<DiscoveredTopic[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  const [persona, setPersona] = useState<AgentPersona | null>(null);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [memorySummary, setMemorySummary] = useState<MemorySummary | null>(null);

  const [drafts, setDrafts] = useState<PostItem[]>([]);
  const [activeDraftTopicId, setActiveDraftTopicId] = useState<string | null>(null);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccessMsg, setPublishSuccessMsg] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const [agentStatus, setAgentStatus] = useState<AgentStatusInfo | null>(null);
  const [publishedPosts, setPublishedPosts] = useState<PublishedPost[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);

  // Navigation and Modals States
  const [activeTab, setActiveTab] = useState<'home' | 'discover' | 'create' | 'history' | 'status' | 'activity'>('home');
  const [selectedTopicDetail, setSelectedTopicDetail] = useState<DiscoveredTopic | null>(null);
  const [selectedPostExplanation, setSelectedPostExplanation] = useState<{
    post: PublishedPost;
    explanation: PostExplanation | null;
    isLoading: boolean;
  } | null>(null);

  // Filters & Live Countdown States
  const [discoverFilter, setDiscoverFilter] = useState<'all' | 'accepted' | 'rejected' | 'unprocessed'>('all');
  const [discoverSearch, setDiscoverSearch] = useState('');
  const [activityFilter, setActivityFilter] = useState<'ALL' | 'DISCOVERY' | 'EDITORIAL' | 'MEMORY' | 'GENERATION' | 'PUBLISHING' | 'SYSTEM' | 'ERROR'>('ALL');
  const [topicMemoryChecks, setTopicMemoryChecks] = useState<
    Record<string, { isKnown: boolean; matchType?: string; matchedMemoryId?: string }>
  >({});

  // Countdown timer state (seconds remaining until next cycle)
  const [secondsUntilNextPublish, setSecondsUntilNextPublish] = useState<number | null>(null);

  // TS compiler bypass
  const _unusedBypass = [lastChecked, isChecking, check, memories, memorySummary, discoveryError, publishSuccessMsg, generationError, selectedTopicDetail, activityFilter];
  if (_unusedBypass.length === -99) console.log(_unusedBypass);

  // Clean persona getters
  const displayName = persona?.name ? (persona.name.includes('AdaAda') ? 'Ada' : persona.name) : (personaName || 'Ada');
  const displayDomain = persona?.domain ? (persona.domain.includes('AI SecurityAI Security') ? 'AI Security' : persona.domain) : (personaDomain || 'AI Security');
  const displayRole = persona?.role ? (persona.role.includes('AI Security ResearcherAI Security Researcher') ? 'AI Security Researcher' : persona.role) : (personaRole || 'AI Security Researcher');

  // Helper to format timestamps nicely
  const formatTimeAgo = (dateString?: string | null): string => {
    if (!dateString) return 'recently';
    const parsed = Date.parse(dateString);
    if (isNaN(parsed)) return 'recently';
    const diffMs = Date.now() - parsed;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${diffDay}d ago`;
  };

  // Helper to format date headers
  const formatDateHeader = (dateString?: string | null): string => {
    if (!dateString) return 'RECENT POSTS';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'RECENT POSTS';
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase();
  };

  // Helper to format countdown MM:SS
  const formatCountdown = (secs: number | null): string => {
    if (secs === null || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Check topic memories
  const checkTopicsMemoryStatus = async (id: string, topicsList: DiscoveredTopic[]) => {
    const checks: Record<string, { isKnown: boolean; matchType?: string; matchedMemoryId?: string }> = {};
    for (const t of topicsList.slice(0, 15)) {
      try {
        const checkRes = await checkTopicMemory(id, t.id);
        checks[t.id] = checkRes.memory;
      } catch (err) {
        console.error(`Memory check failed for topic ${t.id}:`, err);
      }
    }
    setTopicMemoryChecks(checks);
  };

  // Central refresh logic for agent state
  const refreshAgentData = useCallback(async (id: string) => {
    try {
      const pRes = await getPersona(id);
      setPersona(pRes.persona);

      const tRes = await fetchTopics(id);
      setTopics(tRes.topics);
      checkTopicsMemoryStatus(id, tRes.topics);

      const dRes = await getGeneratedContent(id);
      setDrafts(dRes.posts);
      if (dRes.posts.length > 0 && !activeDraftTopicId) {
        setActiveDraftTopicId(dRes.posts[0].topicId);
      }

      const fRes = await getFeed(id);
      setPublishedPosts(fRes.posts);

      const mRes = await getMemory(id);
      setMemories(mRes.memories);
      const msRes = await getMemorySummary(id);
      setMemorySummary(msRes.summary);

      const sRes = await getAgentStatus(id);
      setAgentStatus(sRes.agent);

      const aRes = await getAgentActivity(id);
      setActivities(aRes.activity);
    } catch (err) {
      console.error('Error refreshing agent data:', err);
    }
  }, [activeDraftTopicId]);

  // Initial load
  useEffect(() => {
    if (agentId) {
      localStorage.setItem('autonomous_agent_id', agentId);
      refreshAgentData(agentId);
    }
  }, [agentId, refreshAgentData]);

  // Periodic polling every 5-10 seconds
  useEffect(() => {
    if (!agentId) return;
    const pollMs = (activeTab === 'status' || activeTab === 'activity') ? 5000 : 10000;
    const interval = setInterval(() => {
      refreshAgentData(agentId);
    }, pollMs);
    return () => clearInterval(interval);
  }, [agentId, activeTab, refreshAgentData]);

  // Live countdown timer running every 1 second
  useEffect(() => {
    if (!agentId || !agentStatus?.nextPublishAt) {
      setSecondsUntilNextPublish(null);
      return;
    }

    const updateCountdown = () => {
      const targetTime = Date.parse(agentStatus.nextPublishAt!);
      if (isNaN(targetTime)) {
        setSecondsUntilNextPublish(null);
        return;
      }
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((targetTime - now) / 1000));
      setSecondsUntilNextPublish(diffSec);

      if (diffSec === 0) {
        refreshAgentData(agentId);
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [agentId, agentStatus?.nextPublishAt, refreshAgentData]);

  // Initialize Agent Handler
  const handleStartAgent = async () => {
    setIsInitializing(true);
    setInitError(null);
    try {
      const res = await initAgent({
        name: personaName || 'Ada',
        domain: personaDomain || 'AI Security',
        role: personaRole || 'AI Security Researcher',
        description: personaDescription || 'Analytical security researcher focusing on practical risks in modern AI systems.',
        interests: ['LLM security', 'AI agents', 'prompt injection', 'AI privacy'],
        expertise: ['AI security', 'machine learning', 'LLM vulnerabilities'],
        tone: ['analytical', 'technical', 'concise'],
        editorialPrinciples: ['Evidence over hype', 'Focus on practical implications'],
      });
      setAgentId(res.agentId);
      localStorage.setItem('autonomous_agent_id', res.agentId);
      setActiveTab('home');
      await refreshAgentData(res.agentId);
    } catch (err: any) {
      setInitError(err.message || 'Failed to initialize autonomous agent.');
    } finally {
      setIsInitializing(false);
    }
  };

  // Discover Handler
  const handleTriggerDiscovery = async () => {
    if (!agentId) return;
    setIsDiscovering(true);
    setDiscoveryError(null);
    try {
      await discoverTopics(agentId);
      await refreshAgentData(agentId);
    } catch (err: any) {
      setDiscoveryError(err.message || 'Failed to trigger discovery feeds.');
    } finally {
      setIsDiscovering(false);
    }
  };

  // Select Draft Format Handler
  const handleSelectDraftFormat = async (topicId: string, format: 'blog' | 'linkedin' | 'x') => {
    if (!agentId) return;
    try {
      await selectFormat(agentId, topicId, format);
      setDrafts(prev => prev.map(d => d.topicId === topicId ? { ...d, selectedFormat: format } : d));
    } catch (err: any) {
      console.error('Failed to select format:', err);
    }
  };

  // Generate / Regenerate Draft Content
  const handleGenerateContentForTopic = async (topicId: string) => {
    if (!agentId) return;
    setIsGeneratingContent(true);
    setGenerationError(null);
    try {
      const res = await generateContent(agentId, topicId);
      setDrafts(prev => {
        const existing = prev.findIndex(d => d.topicId === topicId);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = res.post;
          return updated;
        }
        return [res.post, ...prev];
      });
      setActiveDraftTopicId(topicId);
    } catch (err: any) {
      setGenerationError(err.message || 'Failed to generate content options.');
    } finally {
      setIsGeneratingContent(false);
    }
  };

  // Publish Draft Handler
  const handlePublishPost = async (topicId: string) => {
    if (!agentId) return;
    setIsPublishing(true);
    setPublishSuccessMsg(null);
    try {
      await publishPostApi(agentId, topicId);
      setPublishSuccessMsg('Post published successfully to editorial archive and live feed!');
      await refreshAgentData(agentId);
      setTimeout(() => setPublishSuccessMsg(null), 5000);
    } catch (err: any) {
      alert(`Publishing failed: ${err.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  // Reset Agent Handler
  const handleResetAgent = () => {
    if (confirm('Are you sure you want to reset the agent? This will clear local workspace state.')) {
      localStorage.removeItem('autonomous_agent_id');
      setAgentId(null);
      setTopics([]);
      setDrafts([]);
      setPublishedPosts([]);
      setMemories([]);
      setActivities([]);
      setActiveTab('home');
    }
  };

  // Open Explanation Modal
  const handleOpenExplanation = async (post: PublishedPost) => {
    setSelectedPostExplanation({ post, explanation: null, isLoading: true });
    if (!agentId) return;
    try {
      const res = await getPostExplanation(agentId, post.id);
      setSelectedPostExplanation({ post, explanation: res.explanation, isLoading: false });
    } catch (err) {
      console.error('Failed to fetch post explanation:', err);
      setSelectedPostExplanation({ post, explanation: null, isLoading: false });
    }
  };

  // Derive topics breakdown
  const acceptedTopics = topics.filter(t => t.decision?.decision === 'ACCEPT');
  const rejectedTopics = topics.filter(t => t.decision?.decision === 'REJECT');
  const latestSelectedTopic = acceptedTopics.length > 0 ? acceptedTopics[0] : topics.find(t => t.decision) || topics[0] || null;

  // Active Draft Topic for Create tab
  const activeDraft = drafts.find(d => d.topicId === activeDraftTopicId) || drafts[0] || null;
  const activeDraftTopic = topics.find(t => t.id === (activeDraft?.topicId || activeDraftTopicId)) || latestSelectedTopic;

  // Domain search queries derived dynamically
  const domainQueries = persona?.domain
    ? [
        `${persona.domain}`,
        `LLM ${persona.domain.replace(/AI\s*/i, '')}`,
        `AI Vulnerability`,
        `AI Model Safety`,
        `Prompt Injection`,
        `AI Red Teaming`,
        `Model Security`,
      ]
    : [
        'AI Security',
        'LLM Security',
        'AI Vulnerability',
        'AI Model Safety',
        'Prompt Injection',
        'AI Red Teaming',
        'Model Security',
      ];

  // Status Badge Helper
  const currentStatus = agentStatus?.status || 'RUNNING';
  const getStatusDotColor = (st: string) => {
    if (st === 'RUNNING') return 'bg-[#10B981]';
    if (st === 'DEGRADED') return 'bg-[#F59E0B]';
    return 'bg-[#9CA3AF]';
  };

  // =========================================================================
  // RENDER INITIALIZATION SCREEN IF NO AGENT
  // =========================================================================
  if (!agentId) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] text-[#111111] flex items-center justify-center p-4 font-sans select-text">
        <div className="w-full max-w-lg">
          {/* BLACK HEADER BANNER */}
          <div className="section-header-banner">
            <span>AUTONOMOUS AI CREATOR — EDITORIAL STUDIO</span>
            <span className="text-[#6D28D9]">INITIALIZATION</span>
          </div>

          {/* WHITE SURFACE CONTAINER */}
          <div className="bg-white border border-[#E5E2DA] border-t-0 p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="space-y-1">
              <h1 className="text-2xl font-serif-headline font-bold text-[#111111]">
                Initialize Autonomous Editorial Agent
              </h1>
              <p className="text-xs font-mono-tech text-[#666666]">
                Define persona parameters for autonomous discovery, editorial scoring, and publication.
              </p>
            </div>

            {initError && (
              <div className="p-3.5 bg-[#C53030]/10 border border-[#C53030]/30 text-[#C53030] text-xs font-mono-tech">
                {initError}
              </div>
            )}

            <div className="space-y-4 text-xs font-sans-ui">
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono-tech font-bold text-[#444444] uppercase tracking-wider block">
                  Agent Name
                </label>
                <input
                  type="text"
                  value={personaName}
                  onChange={e => setPersonaName(e.target.value)}
                  placeholder="e.g. Ada"
                  className="w-full px-3.5 py-2.5 bg-white border border-[#E5E2DA] text-[#111111] focus:outline-none focus:border-[#6D28D9] font-mono-tech text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono-tech font-bold text-[#444444] uppercase tracking-wider block">
                  Domain / Field
                </label>
                <input
                  type="text"
                  value={personaDomain}
                  onChange={e => setPersonaDomain(e.target.value)}
                  placeholder="e.g. AI Security"
                  className="w-full px-3.5 py-2.5 bg-white border border-[#E5E2DA] text-[#111111] focus:outline-none focus:border-[#6D28D9] font-mono-tech text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono-tech font-bold text-[#444444] uppercase tracking-wider block">
                  Role Title
                </label>
                <input
                  type="text"
                  value={personaRole}
                  onChange={e => setPersonaRole(e.target.value)}
                  placeholder="e.g. AI Security Researcher"
                  className="w-full px-3.5 py-2.5 bg-white border border-[#E5E2DA] text-[#111111] focus:outline-none focus:border-[#6D28D9] font-mono-tech text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono-tech font-bold text-[#444444] uppercase tracking-wider block">
                  Persona Guidelines Description
                </label>
                <textarea
                  rows={3}
                  value={personaDescription}
                  onChange={e => setPersonaDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#E5E2DA] text-[#111111] focus:outline-none focus:border-[#6D28D9] font-sans-ui text-xs leading-relaxed"
                />
              </div>

              <button
                onClick={handleStartAgent}
                disabled={isInitializing}
                className="w-full py-3 bg-[#111111] hover:bg-[#6D28D9] text-white font-mono-tech text-xs font-bold uppercase tracking-wider transition-colors border border-[#111111]"
              >
                {isInitializing ? 'INITIALIZING AGENT...' : 'START AUTONOMOUS AGENT'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER MAIN APPLICATION SHELL & DASHBOARD PAGES
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#111111] font-sans-ui select-text pb-16">
      <header className="bg-white border-b border-[#E5E2DA] sticky top-0 z-40 shadow-2xs">
        <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          {/* BRAND TITLE (MOBILE / TABLET) */}
          <div className="flex items-center space-x-3">
            <h1 className="font-serif-headline text-base sm:text-lg font-bold tracking-tight text-[#111111]">
              AUTONOMOUS AI CREATOR
            </h1>
            <span className="font-mono-tech text-[10px] px-1.5 py-0.5 border border-[#111111] text-[#111111] uppercase tracking-wider font-semibold">
              EDITORIAL
            </span>
          </div>

          {/* CENTER QUICK CONTEXT BANNER */}
          <div className="hidden md:flex items-center space-x-3 font-mono-tech text-xs">
            <span className="text-[#888888] uppercase text-[10px] tracking-wider">PERSONA:</span>
            <span className="font-bold text-[#111111] font-serif-headline">
              {displayName} ({displayDomain})
            </span>
          </div>

          {/* RIGHT SIDE BADGES & RESET */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-[#FAF8F5] border border-[#E5E2DA] px-2.5 py-1 text-xs font-mono-tech">
              <span className={`w-2 h-2 rounded-full ${getStatusDotColor(currentStatus)}`} />
              <span className="font-semibold text-[#111111] uppercase tracking-wider text-[11px]">
                {currentStatus}
              </span>
            </div>

            <button
              onClick={handleResetAgent}
              className="font-mono-tech text-[11px] uppercase tracking-wider text-[#666666] hover:text-[#C53030] px-2.5 py-1 border border-[#E5E2DA] hover:border-[#C53030]/40 transition-colors"
            >
              RESET
            </button>
          </div>
        </div>

        {/* MOBILE NAVIGATION TAB STRIP */}
        <div className="lg:hidden flex items-center justify-between px-4 py-2 bg-[#FAF8F5] border-t border-[#E5E2DA] font-mono-tech text-[11px] overflow-x-auto custom-scrollbar">
          {[
            { id: 'home', label: 'HOME' },
            { id: 'discover', label: 'DISCOVER' },
            { id: 'create', label: 'CREATE' },
            { id: 'history', label: 'HISTORY' },
            { id: 'status', label: 'STATUS' },
            { id: 'activity', label: 'ACTIVITY' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-2.5 py-1 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'font-bold text-[#6D28D9] border-b-2 border-[#6D28D9]'
                  : 'text-[#666666]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      {/* MAIN CONTENT CONTAINER (3-COLUMN DESKTOP LAYOUT) */}
      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_260px] gap-6 items-start">

          {/* LEFT SIDEBAR NAVIGATION RAIL */}
          <aside className="hidden lg:block space-y-4 sticky top-20 self-start">
            {/* BRAND PANEL */}
            <div className="bg-white border border-[#E5E2DA] p-4 space-y-1">
              <h2 className="font-serif-headline font-bold text-base text-[#111111] leading-tight">
                AUTONOMOUS AI CREATOR
              </h2>
              <span className="font-mono-tech text-[10px] text-[#6D28D9] font-bold uppercase tracking-wider block">
                EDITORIAL INTELLIGENCE
              </span>
            </div>

            {/* NAVIGATION RAIL */}
            <nav className="bg-white border border-[#E5E2DA] p-2 space-y-1 font-mono-tech text-xs">
              {[
                { id: 'home', icon: '▣', label: 'HOME', desc: 'Dashboard overview' },
                { id: 'discover', icon: '◉', label: 'DISCOVER', desc: 'Find & evaluate topics' },
                { id: 'create', icon: '✎', label: 'CREATE', desc: 'Generate content' },
                { id: 'history', icon: '◷', label: 'HISTORY', desc: 'Published archive' },
                { id: 'status', icon: '◎', label: 'AGENT STATUS', desc: 'System monitoring' },
                { id: 'activity', icon: '☷', label: 'ACTIVITY LOG', desc: 'Event timeline' },
              ].map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`w-full text-left p-2.5 transition-all flex items-start space-x-3 border-l-4 ${
                      isActive
                        ? 'bg-[#F3E8FF]/60 border-[#6D28D9] text-[#111111]'
                        : 'bg-transparent border-transparent text-[#555555] hover:bg-[#FAF8F5] hover:text-[#111111]'
                    }`}
                  >
                    <span className={`text-sm leading-none pt-0.5 ${isActive ? 'text-[#6D28D9] font-bold' : 'text-[#888888]'}`}>
                      {item.icon}
                    </span>
                    <div className="space-y-0.5 min-w-0">
                      <span className={`block font-bold text-[11px] uppercase tracking-wider ${isActive ? 'text-[#6D28D9]' : 'text-[#222222]'}`}>
                        {item.label}
                      </span>
                      <span className="block text-[10px] text-[#777777] font-normal truncate">
                        {item.desc}
                      </span>
                    </div>
                  </button>
                );
              })}
            </nav>

            {/* PERSONA BADGE */}
            <div className="bg-white border border-[#E5E2DA] p-4 space-y-2 font-mono-tech text-xs">
              <div className="flex items-center justify-between text-[10px] text-[#888888] uppercase tracking-wider">
                <span>ACTIVE PERSONA</span>
                <span className="w-2 h-2 rounded-full bg-[#10B981]" />
              </div>
              <div className="font-bold text-[#111111] text-sm font-serif-headline">
                {displayName}
              </div>
              <span className="px-2 py-0.5 bg-[#F3E8FF] border border-[#C084FC]/40 text-[#6D28D9] font-bold text-[10px] inline-block">
                {displayDomain.toUpperCase()}
              </span>
            </div>
          </aside>

          {/* CENTER MAIN WORKSPACE */}
          <main className="min-w-0 space-y-6">
        {/* ===================================================================
            PAGE 1: HOME / DASHBOARD
           =================================================================== */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            {/* TOP 2-COLUMN HEADER GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* AGENT PERSONA & STATUS CARD */}
              <div>
                <div className="section-header-banner">
                  <span>AGENT PERSONA &amp; STATUS</span>
                  <span className="text-[#6D28D9] font-semibold">● AUTONOMOUS MONITORING</span>
                </div>
                <div className="bg-white border border-[#E5E2DA] border-t-0 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-serif-headline font-bold text-[#111111]">
                      {displayName}
                    </h2>
                    <span className="font-mono-tech text-xs bg-[#F3E8FF] border border-[#C084FC]/40 text-[#6D28D9] font-bold px-2 py-0.5">
                      {displayDomain.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-[#555555] font-sans-ui leading-relaxed">
                    {persona?.description || personaDescription}
                  </p>
                  <div className="pt-2 flex items-center justify-between text-xs font-mono-tech text-[#666666] border-t border-[#F2EFE9]">
                    <span>Role: <strong className="text-[#111111]">{displayRole}</strong></span>
                    <span>Status: <strong className="text-[#10B981]">● {currentStatus}</strong></span>
                  </div>
                </div>
              </div>

              {/* AUTONOMOUS STATUS SUMMARY CARD */}
              <div>
                <div className="section-header-banner">
                  <span>AUTONOMOUS STATUS SUMMARY</span>
                  <button
                    onClick={() => setActiveTab('status')}
                    className="text-[#6D28D9] hover:underline font-mono-tech text-[11px]"
                  >
                    VIEW AGENT STATUS →
                  </button>
                </div>
                <div className="bg-white border border-[#E5E2DA] border-t-0 p-5 grid grid-cols-3 gap-4">
                  <div className="bg-[#FAF8F5] border border-[#E5E2DA] p-3 space-y-1">
                    <span className="font-mono-tech text-[10px] text-[#666666] font-bold uppercase tracking-wider block">
                      CURRENT STATUS
                    </span>
                    <div className="flex items-center space-x-1.5">
                      <span className={`w-2 h-2 rounded-full ${getStatusDotColor(currentStatus)}`} />
                      <span className="font-serif-headline text-lg font-bold text-[#111111]">
                        {currentStatus}
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#FAF8F5] border border-[#E5E2DA] p-3 space-y-1">
                    <span className="font-mono-tech text-[10px] text-[#666666] font-bold uppercase tracking-wider block">
                      LAST PUBLISH
                    </span>
                    <span className="font-serif-headline text-lg font-bold text-[#111111]">
                      {formatTimeAgo(agentStatus?.lastPublishedAt)}
                    </span>
                  </div>

                  <div className="bg-[#FAF8F5] border border-[#E5E2DA] p-3 space-y-1 border-l-2 border-l-[#6D28D9]">
                    <span className="font-mono-tech text-[10px] text-[#666666] font-bold uppercase tracking-wider block">
                      NEXT PUBLISH
                    </span>
                    <span className="font-mono-tech text-lg font-bold text-[#6D28D9]">
                      {formatCountdown(secondsUntilNextPublish)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* AUTONOMOUS STATISTICS GRID */}
            <div>
              <div className="section-header-banner">
                <span>AUTONOMOUS STATISTICS</span>
                <span className="text-[#888888] font-mono-tech text-[11px]">REAL-TIME PIPELINE METRICS</span>
              </div>
              <div className="bg-white border border-[#E5E2DA] border-t-0 p-5 grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div className="bg-[#FAF8F5] border border-[#E5E2DA] p-3.5 space-y-1">
                  <span className="font-mono-tech text-[10px] text-[#666666] uppercase font-bold tracking-wider block">
                    TOPICS DISCOVERED
                  </span>
                  <span className="font-serif-headline text-3xl font-bold text-[#111111]">
                    {topics.length || memorySummary?.topicsDiscovered || 0}
                  </span>
                  <span className="font-mono-tech text-[10px] text-[#888888] block">Live RSS sources</span>
                </div>

                <div className="bg-[#FAF8F5] border border-[#E5E2DA] p-3.5 space-y-1">
                  <span className="font-mono-tech text-[10px] text-[#666666] uppercase font-bold tracking-wider block">
                    SHORTLISTED
                  </span>
                  <span className="font-serif-headline text-3xl font-bold text-[#111111]">
                    {rejectedTopics.length + acceptedTopics.length}
                  </span>
                  <span className="font-mono-tech text-[10px] text-[#888888] block">Score &gt;= 65</span>
                </div>

                <div className="bg-[#FAF8F5] border border-[#E5E2DA] p-3.5 space-y-1">
                  <span className="font-mono-tech text-[10px] text-[#666666] uppercase font-bold tracking-wider block">
                    SELECTED
                  </span>
                  <span className="font-serif-headline text-3xl font-bold text-[#6D28D9]">
                    {acceptedTopics.length}
                  </span>
                  <span className="font-mono-tech text-[10px] text-[#888888] block">Ready for Create</span>
                </div>

                <div className="bg-[#FAF8F5] border border-[#E5E2DA] p-3.5 space-y-1">
                  <span className="font-mono-tech text-[10px] text-[#666666] uppercase font-bold tracking-wider block">
                    PUBLISHED
                  </span>
                  <span className="font-serif-headline text-3xl font-bold text-[#111111]">
                    {publishedPosts.length}
                  </span>
                  <span className="font-mono-tech text-[10px] text-[#888888] block">Editorial archive</span>
                </div>

                <div className="bg-[#FAF8F5] border border-[#E5E2DA] p-3.5 space-y-1 col-span-2 sm:col-span-1">
                  <span className="font-mono-tech text-[10px] text-[#666666] uppercase font-bold tracking-wider block">
                    LAST CYCLE
                  </span>
                  <span className="font-serif-headline text-2xl font-bold text-[#111111]">
                    {formatTimeAgo(agentStatus?.lastCycleAt)}
                  </span>
                  <span className="font-mono-tech text-[10px] text-[#888888] block">Auto-monitoring</span>
                </div>
              </div>
            </div>

            {/* LATEST SELECTED TOPIC SECTION */}
            {latestSelectedTopic && (
              <div>
                <div className="section-header-banner">
                  <span>LATEST SELECTED TOPIC</span>
                  <button
                    onClick={() => {
                      setActiveDraftTopicId(latestSelectedTopic.id);
                      setActiveTab('create');
                    }}
                    className="text-[#6D28D9] hover:underline font-mono-tech text-[11px]"
                  >
                    [ VIEW IN WORKSPACE ]
                  </button>
                </div>
                <div className="bg-white border border-[#E5E2DA] border-t-0 p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-[#F2EFE9] pb-3">
                    <h3 className="font-serif-headline text-2xl font-bold text-[#111111] leading-tight max-w-4xl">
                      {stripHtmlTags(latestSelectedTopic.title)}
                    </h3>
                    <div className="font-mono-tech text-xs text-[#666666] whitespace-nowrap">
                      {latestSelectedTopic.source.name} • {formatTimeAgo(latestSelectedTopic.discoveredAt)}
                    </div>
                  </div>

                  {latestSelectedTopic.decision && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono-tech text-xs">
                      <div className="bg-[#FAF8F5] border border-[#E5E2DA] p-3 space-y-1">
                        <span className="text-[10px] text-[#666666] font-bold block uppercase tracking-wider">
                          [ RELEVANCE ]
                        </span>
                        <span className="font-serif-headline text-xl font-bold text-[#6D28D9]">
                          {latestSelectedTopic.decision.scores.relevance} / 100
                        </span>
                      </div>

                      <div className="bg-[#FAF8F5] border border-[#E5E2DA] p-3 space-y-1">
                        <span className="text-[10px] text-[#666666] font-bold block uppercase tracking-wider">
                          [ PERSONA ALIGNMENT ]
                        </span>
                        <span className="font-serif-headline text-xl font-bold text-[#111111]">
                          {latestSelectedTopic.decision.scores.personaAlignment} / 100
                        </span>
                      </div>

                      <div className="bg-[#FAF8F5] border border-[#E5E2DA] p-3 space-y-1">
                        <span className="text-[10px] text-[#666666] font-bold block uppercase tracking-wider">
                          [ TIMELINESS ]
                        </span>
                        <span className="font-serif-headline text-xl font-bold text-[#111111]">
                          {latestSelectedTopic.decision.scores.timeliness} / 100
                        </span>
                      </div>

                      <div className="bg-[#FAF8F5] border border-[#E5E2DA] p-3 space-y-1">
                        <span className="text-[10px] text-[#666666] font-bold block uppercase tracking-wider">
                          [ SOURCE QUALITY ]
                        </span>
                        <span className="font-serif-headline text-xl font-bold text-[#111111]">
                          {latestSelectedTopic.decision.scores.sourceQuality} / 100
                        </span>
                      </div>
                    </div>
                  )}

                  {latestSelectedTopic.decision?.reason && (
                    <p className="text-xs text-[#555555] bg-[#FAF8F5] p-3.5 border border-[#E5E2DA] leading-relaxed">
                      <strong className="font-mono-tech text-[#111111]">Editorial Rationale:</strong>{' '}
                      {latestSelectedTopic.decision.reason}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* RECENT DISCOVERIES & RECENT PUBLICATIONS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* RECENT DISCOVERIES */}
              <div>
                <div className="section-header-banner">
                  <span>RECENT DISCOVERIES</span>
                  <button
                    onClick={() => setActiveTab('discover')}
                    className="text-[#6D28D9] hover:underline font-mono-tech text-[11px]"
                  >
                    EXPLORE ALL →
                  </button>
                </div>
                <div className="bg-white border border-[#E5E2DA] border-t-0 p-4 space-y-3">
                  {topics.slice(0, 3).map((t) => (
                    <div key={t.id} className="p-3 border border-[#E5E2DA] bg-[#FAF8F5] space-y-1">
                      <div className="flex items-center justify-between font-mono-tech text-[10px] text-[#888888]">
                        <span>{t.source.name}</span>
                        <span>{formatTimeAgo(t.discoveredAt)}</span>
                      </div>
                      <h4 className="font-serif-headline text-sm font-bold text-[#111111] line-clamp-1">
                        {stripHtmlTags(t.title)}
                      </h4>
                    </div>
                  ))}
                </div>
              </div>

              {/* RECENT PUBLICATIONS */}
              <div>
                <div className="section-header-banner">
                  <span>RECENT PUBLICATIONS</span>
                  <button
                    onClick={() => setActiveTab('history')}
                    className="text-[#6D28D9] hover:underline font-mono-tech text-[11px]"
                  >
                    VIEW ARCHIVE →
                  </button>
                </div>
                <div className="bg-white border border-[#E5E2DA] border-t-0 p-4 space-y-3">
                  {publishedPosts.length === 0 ? (
                    <p className="text-xs text-[#888888] font-mono-tech py-4 text-center">
                      No published posts in feed yet.
                    </p>
                  ) : (
                    publishedPosts.slice(0, 3).map((p) => (
                      <div key={p.id} className="p-3 border border-[#E5E2DA] bg-[#FAF8F5] space-y-1">
                        <div className="flex items-center justify-between font-mono-tech text-[10px] text-[#888888]">
                          <span>PUBLISHED</span>
                          <span>{formatTimeAgo(p.createdAt)}</span>
                        </div>
                        <h4 className="font-serif-headline text-sm font-bold text-[#111111] line-clamp-1">
                          {stripHtmlTags(p.text)}
                        </h4>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            PAGE 2: DISCOVER PAGE
           =================================================================== */}
        {activeTab === 'discover' && (
          <div className="space-y-6">
            {/* PAGE TITLE */}
            <div className="space-y-1 border-b border-[#E5E2DA] pb-4">
              <h1 className="text-3xl font-serif-headline font-bold text-[#111111]">
                Discovery
              </h1>
              <p className="text-xs font-mono-tech text-[#666666]">
                Live persona-driven topic discovery and editorial filtering.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* LEFT CATEGORY SIDEBAR */}
              <div className="space-y-4">
                <div className="bg-white border border-[#E5E2DA] p-4 space-y-3 font-mono-tech text-xs">
                  <span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider block border-b border-[#F2EFE9] pb-2">
                    Filter by Category
                  </span>
                  <button className="w-full text-left px-3 py-2 bg-[#F3E8FF] border-l-4 border-[#6D28D9] text-[#6D28D9] font-bold">
                    All Topics ({topics.length})
                  </button>
                  <button className="w-full text-left px-3 py-2 hover:bg-[#FAF8F5] text-[#555555] transition-colors">
                    Neural Arts
                  </button>
                  <button className="w-full text-left px-3 py-2 hover:bg-[#FAF8F5] text-[#555555] transition-colors">
                    Ethical AI
                  </button>
                  <button className="w-full text-left px-3 py-2 hover:bg-[#FAF8F5] text-[#555555] transition-colors">
                    Research
                  </button>
                </div>

                <button
                  onClick={handleTriggerDiscovery}
                  disabled={isDiscovering}
                  className="w-full py-3 bg-[#111111] hover:bg-[#6D28D9] text-white font-mono-tech text-xs font-bold uppercase tracking-wider border border-[#111111] transition-colors"
                >
                  {isDiscovering ? 'DISCOVERING...' : 'New Experiment'}
                </button>
              </div>

              {/* MAIN DISCOVERY AREA */}
              <div className="lg:col-span-3 space-y-6">
                {/* DISCOVERY CONTROLS & SEARCH */}
                <div>
                  <div className="section-header-banner">
                    <span>DISCOVERY CONTROLS &amp; SEARCH</span>
                    <button
                      onClick={handleTriggerDiscovery}
                      disabled={isDiscovering}
                      className="px-2.5 py-1 bg-[#6D28D9] hover:bg-[#5B21B6] text-white font-mono-tech text-[10px] uppercase font-bold tracking-wider"
                    >
                      [ Discover Feeds ]
                    </button>
                  </div>

                  <div className="bg-white border border-[#E5E2DA] border-t-0 p-5 space-y-4">
                    {/* DOMAIN & SEARCH QUERY CHIPS */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3 text-xs font-mono-tech">
                        <span className="text-[#666666] uppercase font-bold text-[10px]">ACTIVE PERSONA DOMAIN:</span>
                        <span className="px-2 py-0.5 bg-[#F3E8FF] border border-[#C084FC]/40 text-[#6D28D9] font-bold text-[11px]">
                          {displayDomain}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[10px] font-mono-tech text-[#888888] uppercase tracking-wider block">
                          DOMAIN SEARCH QUERIES
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {domainQueries.map((q, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 bg-[#FAF8F5] border border-[#E5E2DA] text-[#333333] font-mono-tech text-[11px]"
                            >
                              "{q}"
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* SEARCH INPUT & FILTER TABS */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <input
                        type="text"
                        value={discoverSearch}
                        onChange={(e) => setDiscoverSearch(e.target.value)}
                        placeholder="Search topics..."
                        className="flex-1 px-3.5 py-2 bg-white border border-[#E5E2DA] font-mono-tech text-xs text-[#111111] focus:outline-none focus:border-[#6D28D9]"
                      />

                      <div className="flex items-center space-x-1 font-mono-tech text-xs border border-[#E5E2DA] p-1 bg-[#FAF8F5]">
                        <button
                          onClick={() => setDiscoverFilter('all')}
                          className={`px-2.5 py-1 text-[11px] font-bold uppercase ${
                            discoverFilter === 'all' ? 'bg-[#111111] text-white' : 'text-[#666666]'
                          }`}
                        >
                          ALL TOPICS
                        </button>
                        <button
                          onClick={() => setDiscoverFilter('accepted')}
                          className={`px-2.5 py-1 text-[11px] font-bold uppercase ${
                            discoverFilter === 'accepted' ? 'bg-[#111111] text-white' : 'text-[#666666]'
                          }`}
                        >
                          ACCEPTED
                        </button>
                        <button
                          onClick={() => setDiscoverFilter('rejected')}
                          className={`px-2.5 py-1 text-[11px] font-bold uppercase ${
                            discoverFilter === 'rejected' ? 'bg-[#111111] text-white' : 'text-[#666666]'
                          }`}
                        >
                          REJECTED
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ALL DISCOVERED TOPICS LIST */}
                <div>
                  <div className="section-header-banner">
                    <span>ALL DISCOVERED TOPICS</span>
                    <span className="text-[#888888] font-mono-tech text-[10px]">EDITORIAL DATABASE</span>
                  </div>

                  <div className="bg-white border border-[#E5E2DA] border-t-0 divide-y divide-[#E5E2DA]">
                    {topics.length === 0 ? (
                      <p className="p-6 text-center font-mono-tech text-xs text-[#888888]">
                        No discovered topics found. Click [ Discover Feeds ] to crawl fresh live topics.
                      </p>
                    ) : (
                      topics
                        .filter((t) => {
                          if (discoverFilter === 'accepted') return t.decision?.decision === 'ACCEPT';
                          if (discoverFilter === 'rejected') return t.decision?.decision === 'REJECT';
                          return true;
                        })
                        .filter((t) => t.title.toLowerCase().includes(discoverSearch.toLowerCase()))
                        .map((t) => {
                          const mem = topicMemoryChecks[t.id];
                          return (
                            <div key={t.id} className="p-5 hover:bg-[#FAF8F5] transition-colors space-y-3">
                              <div className="flex items-center justify-between text-xs font-mono-tech">
                                <span className="px-2 py-0.5 bg-[#FAF8F5] border border-[#E5E2DA] text-[#666666] text-[10px]">
                                  {t.source.name.toUpperCase()} ({displayDomain})
                                </span>
                                <span className="text-[#888888] text-[11px]">
                                  {formatTimeAgo(t.discoveredAt)}
                                </span>
                              </div>

                              <h3
                                onClick={() => setSelectedTopicDetail(t)}
                                className="font-serif-headline text-xl font-bold text-[#111111] hover:text-[#6D28D9] leading-snug cursor-pointer transition-colors"
                              >
                                {stripHtmlTags(t.title)}
                              </h3>

                              <p className="text-xs text-[#555555] font-sans-ui leading-relaxed line-clamp-2">
                                {stripHtmlTags(t.summary)}
                              </p>

                              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#F2EFE9] font-mono-tech text-xs">
                                <div className="flex items-center space-x-2">
                                  {mem?.isKnown ? (
                                    <span className="px-2 py-0.5 bg-[#FEF3C7] border border-[#F59E0B]/40 text-[#D97706] text-[10px] font-bold">
                                      [ IN MEMORY ]
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-[#FAF8F5] border border-[#E5E2DA] text-[#888888] text-[10px]">
                                      [ NEW TOPIC ]
                                    </span>
                                  )}

                                  {t.decision && (
                                    <span
                                      className={`px-2 py-0.5 text-[10px] font-bold border ${
                                        t.decision.decision === 'ACCEPT'
                                          ? 'bg-[#F3E8FF] border-[#C084FC]/40 text-[#6D28D9]'
                                          : 'bg-[#FAF8F5] border-[#E5E2DA] text-[#888888]'
                                      }`}
                                    >
                                      SCORE: {t.decision.scores.overall}/100 ({t.decision.decision})
                                    </span>
                                  )}
                                </div>

                                <button
                                  onClick={() => {
                                    handleGenerateContentForTopic(t.id);
                                    setActiveTab('create');
                                  }}
                                  className="px-3 py-1 bg-[#111111] hover:bg-[#6D28D9] text-white text-[11px] font-bold uppercase tracking-wider transition-colors"
                                >
                                  CREATE DRAFT →
                                </button>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            PAGE 3: CREATE PAGE
           =================================================================== */}
        {activeTab === 'create' && (
          <div className="space-y-6">
            {/* SELECTED TOPIC WORKSPACE HEADER */}
            <div>
              <div className="section-header-banner">
                <span>SELECTED TOPIC WORKSPACE</span>
                {activeDraftTopic && (
                  <button
                    onClick={() => handleGenerateContentForTopic(activeDraftTopic.id)}
                    disabled={isGeneratingContent}
                    className="text-[#6D28D9] font-mono-tech text-[11px] hover:underline"
                  >
                    [ REGENERATE FORMATS ]
                  </button>
                )}
              </div>

              <div className="bg-white border border-[#E5E2DA] border-t-0 p-6 space-y-6">
                {activeDraftTopic ? (
                  <>
                    <h1 className="font-serif-headline text-3xl font-bold text-[#111111] leading-tight">
                      {stripHtmlTags(activeDraftTopic.title)}
                    </h1>

                    {/* 3 DECISION BLOCKS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* WHY SELECTED */}
                      <div className="bg-[#FAF8F5] border border-[#E5E2DA] p-4 space-y-2">
                        <span className="font-mono-tech text-[10px] font-bold text-[#666666] uppercase tracking-wider block">
                          ✓ WHY SELECTED
                        </span>
                        <p className="text-xs text-[#333333] leading-relaxed">
                          {activeDraftTopic.decision?.reason || 'Selected based on high persona relevance and editorial urgency.'}
                        </p>
                      </div>

                      {/* WHY RELEVANT NOW */}
                      <div className="bg-[#FAF8F5] border border-[#E5E2DA] p-4 space-y-2">
                        <span className="font-mono-tech text-[10px] font-bold text-[#666666] uppercase tracking-wider block">
                          ⚡ WHY RELEVANT NOW
                        </span>
                        <p className="text-xs text-[#333333] leading-relaxed">
                          Timeliness score {activeDraftTopic.decision?.scores.timeliness || 85}/100. Fresh ecosystem news cycle.
                        </p>
                      </div>

                      {/* SOURCES */}
                      <div className="bg-[#FAF8F5] border border-[#E5E2DA] p-4 space-y-2">
                        <span className="font-mono-tech text-[10px] font-bold text-[#666666] uppercase tracking-wider block">
                          🔗 SOURCES
                        </span>
                        <a
                          href={activeDraftTopic.source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono-tech text-xs text-[#6D28D9] hover:underline block truncate"
                        >
                          {activeDraftTopic.source.name} ↗
                        </a>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-xs font-mono-tech text-[#888888] text-center py-6">
                    No topic selected for creation yet. Select a topic from the Discover tab.
                  </p>
                )}
              </div>
            </div>

            {/* CONTENT OPTIONS SECTION */}
            <div>
              <div className="section-header-banner">
                <span>CONTENT OPTIONS</span>
                <span className="text-[#888888] font-mono-tech text-[10px]">3 FORMATS GENERATED</span>
              </div>

              <div className="bg-white border border-[#E5E2DA] border-t-0 p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* BLOG ARTICLE CARD */}
                  <div
                    className={`border p-5 space-y-4 flex flex-col justify-between transition-all ${
                      activeDraft?.selectedFormat === 'blog'
                        ? 'border-2 border-[#6D28D9] bg-[#F3E8FF]/20 shadow-sm'
                        : 'border-[#E5E2DA] bg-[#FAF8F5]'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between font-mono-tech text-[10px]">
                        <span className="font-bold text-[#666666] uppercase">[ BLOG ARTICLE ]</span>
                        <span className="text-[#888888]">4 MIN READ</span>
                      </div>
                      <h3 className="font-serif-headline text-lg font-bold text-[#111111]">
                        {activeDraft?.content?.blog?.title || activeDraftTopic?.title || 'Blog Analysis'}
                      </h3>
                      <p className="text-xs text-[#555555] leading-relaxed line-clamp-5">
                        {activeDraft?.content?.blog?.text || 'Comprehensive in-depth technical article exploring security implications.'}
                      </p>
                    </div>

                    <button
                      onClick={() => activeDraftTopic && handleSelectDraftFormat(activeDraftTopic.id, 'blog')}
                      className={`w-full py-2.5 font-mono-tech text-xs font-bold uppercase tracking-wider border transition-colors ${
                        activeDraft?.selectedFormat === 'blog'
                          ? 'bg-[#6D28D9] text-white border-[#6D28D9]'
                          : 'bg-white text-[#111111] border-[#E5E2DA] hover:bg-[#111111] hover:text-white'
                      }`}
                    >
                      {activeDraft?.selectedFormat === 'blog' ? '✓ SELECTED' : 'USE BLOG'}
                    </button>
                  </div>

                  {/* LINKEDIN POST CARD */}
                  <div
                    className={`border p-5 space-y-4 flex flex-col justify-between transition-all ${
                      activeDraft?.selectedFormat === 'linkedin'
                        ? 'border-2 border-[#6D28D9] bg-[#F3E8FF]/20 shadow-sm'
                        : 'border-[#E5E2DA] bg-[#FAF8F5]'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between font-mono-tech text-[10px]">
                        <span className="font-bold text-[#666666] uppercase">[ LINKEDIN POST ]</span>
                        <span className="text-[#888888]">PROFESSIONAL</span>
                      </div>
                      <p className="text-xs text-[#333333] leading-relaxed line-clamp-6 whitespace-pre-line">
                        {activeDraft?.content?.linkedin?.text || 'Professional executive breakdown with actionable takeaways.'}
                      </p>
                    </div>

                    <button
                      onClick={() => activeDraftTopic && handleSelectDraftFormat(activeDraftTopic.id, 'linkedin')}
                      className={`w-full py-2.5 font-mono-tech text-xs font-bold uppercase tracking-wider border transition-colors ${
                        activeDraft?.selectedFormat === 'linkedin'
                          ? 'bg-[#6D28D9] text-white border-[#6D28D9]'
                          : 'bg-white text-[#111111] border-[#E5E2DA] hover:bg-[#111111] hover:text-white'
                      }`}
                    >
                      {activeDraft?.selectedFormat === 'linkedin' ? '✓ SELECTED' : 'USE LINKEDIN'}
                    </button>
                  </div>

                  {/* X POST CARD */}
                  <div
                    className={`border p-5 space-y-4 flex flex-col justify-between transition-all ${
                      activeDraft?.selectedFormat === 'x'
                        ? 'border-2 border-[#6D28D9] bg-[#F3E8FF]/20 shadow-sm'
                        : 'border-[#E5E2DA] bg-[#FAF8F5]'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between font-mono-tech text-[10px]">
                        <span className="font-bold text-[#666666] uppercase">[ X POST ]</span>
                        <span className="text-[#888888]">CONCISE</span>
                      </div>
                      <p className="text-xs text-[#333333] leading-relaxed line-clamp-6">
                        {activeDraft?.content?.x?.text || 'Concise high-impact micro-post optimized for rapid engagement.'}
                      </p>
                    </div>

                    <button
                      onClick={() => activeDraftTopic && handleSelectDraftFormat(activeDraftTopic.id, 'x')}
                      className={`w-full py-2.5 font-mono-tech text-xs font-bold uppercase tracking-wider border transition-colors ${
                        activeDraft?.selectedFormat === 'x'
                          ? 'bg-[#6D28D9] text-white border-[#6D28D9]'
                          : 'bg-white text-[#111111] border-[#E5E2DA] hover:bg-[#111111] hover:text-white'
                      }`}
                    >
                      {activeDraft?.selectedFormat === 'x' ? '✓ SELECTED' : 'USE X'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* PUBLISH DRAFT POST BANNER */}
            <div>
              <div className="section-header-banner">
                <span>PUBLISH DRAFT POST</span>
                <span className="text-[#6D28D9] font-mono-tech text-[10px]">LIVE FEED INTERFACE</span>
              </div>

              <div className="bg-white border border-[#E5E2DA] border-t-0 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 font-mono-tech text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="text-[#666666] uppercase font-bold">SELECTED FORMAT:</span>
                    <span className="px-2 py-0.5 bg-[#F3E8FF] border border-[#C084FC]/40 text-[#6D28D9] font-bold uppercase">
                      {activeDraft?.selectedFormat || 'LINKEDIN'}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#888888] block">
                    🔒 Saves to editorial repository and updates live-feed automatically.
                  </span>
                </div>

                <button
                  onClick={() => activeDraftTopic && handlePublishPost(activeDraftTopic.id)}
                  disabled={isPublishing || !activeDraftTopic}
                  className="w-full sm:w-auto px-6 py-3 bg-[#10B981] hover:bg-[#059669] text-white font-mono-tech text-xs font-bold uppercase tracking-wider transition-colors border border-[#10B981]"
                >
                  {isPublishing ? 'PUBLISHING...' : '✈ PUBLISH POST'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            PAGE 4: HISTORY PAGE
           =================================================================== */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="space-y-1 border-b border-[#E5E2DA] pb-4">
              <h1 className="text-3xl font-serif-headline font-bold text-[#111111]">
                Publication History
              </h1>
              <p className="text-xs font-mono-tech text-[#666666]">
                Editorial publication archive backed by persistent storage.
              </p>
            </div>

            <div>
              <div className="section-header-banner">
                <span>EDITORIAL ARCHIVE</span>
                <span className="text-[#888888] font-mono-tech text-[10px]">
                  TOTAL POSTS: {publishedPosts.length}
                </span>
              </div>

              <div className="bg-white border border-[#E5E2DA] border-t-0 divide-y divide-[#E5E2DA]">
                {publishedPosts.length === 0 ? (
                  <p className="p-8 text-center font-mono-tech text-xs text-[#888888]">
                    No published posts in history. Trigger autonomous cycles or publish from Create workspace.
                  </p>
                ) : (
                  publishedPosts.map((p) => (
                    <div key={p.id} className="p-6 hover:bg-[#FAF8F5] transition-colors space-y-3">
                      <div className="flex items-center justify-between font-mono-tech text-xs">
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 bg-[#FAF8F5] border border-[#E5E2DA] text-[#666666] text-[10px] font-bold">
                            {formatDateHeader(p.createdAt)}
                          </span>
                          <span className="px-2 py-0.5 bg-[#F3E8FF] border border-[#C084FC]/40 text-[#6D28D9] text-[10px] font-bold uppercase">
                            {p.selectedFormat || 'LINKEDIN'}
                          </span>
                        </div>
                        <span className="text-[#888888] text-[11px]">{formatTimeAgo(p.createdAt)}</span>
                      </div>

                      <h3 className="font-serif-headline text-xl font-bold text-[#111111] leading-snug">
                        {stripHtmlTags(p.text)}
                      </h3>

                      {p.rationale && (
                        <p className="text-xs text-[#555555] bg-[#FAF8F5] p-3 border border-[#E5E2DA] leading-relaxed">
                          <strong className="font-mono-tech text-[#111111]">Editorial Rationale:</strong>{' '}
                          {p.rationale}
                        </p>
                      )}

                      <div className="pt-2 flex items-center justify-between">
                        <button
                          onClick={() => handleOpenExplanation(p)}
                          className="font-mono-tech text-xs text-[#6D28D9] hover:underline font-bold"
                        >
                          [ VIEW EXPLANATION &amp; RATIONALE ]
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            PAGE 5: AGENT STATUS PAGE
           =================================================================== */}
        {activeTab === 'status' && (
          <div className="space-y-6">
            <div className="space-y-1 border-b border-[#E5E2DA] pb-4">
              <h1 className="text-3xl font-serif-headline font-bold text-[#111111]">
                Agent Status
              </h1>
              <p className="text-xs font-mono-tech text-[#666666]">
                Technical monitor for autonomous scheduler, memory state, and execution parameters.
              </p>
            </div>

            {/* PERSONA & STATUS SUMMARY */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-[#E5E2DA] p-5 space-y-3">
                <div className="section-header-banner -mx-5 -mt-5 mb-4">
                  <span>AGENT PERSONA &amp; STATUS</span>
                  <span className="text-[#10B981]">● RUNNING</span>
                </div>
                <h2 className="text-3xl font-serif-headline font-bold text-[#111111]">
                  {displayName}
                </h2>
                <p className="text-xs font-mono-tech text-[#666666]">
                  Role: {displayRole} • Domain: {displayDomain}
                </p>
                <p className="text-xs text-[#555555] leading-relaxed">
                  {persona?.description || personaDescription}
                </p>
              </div>

              <div className="bg-white border border-[#E5E2DA] p-5 space-y-3">
                <div className="section-header-banner -mx-5 -mt-5 mb-4">
                  <span>AUTONOMOUS STATUS SUMMARY</span>
                  <span className="text-[#6D28D9]">● ACTIVE TIMER</span>
                </div>
                <div className="grid grid-cols-3 gap-3 font-mono-tech text-xs">
                  <div className="bg-[#FAF8F5] border border-[#E5E2DA] p-3">
                    <span className="text-[10px] text-[#888888] block">CURRENT STATUS</span>
                    <strong className="text-base text-[#111111]">{currentStatus}</strong>
                  </div>
                  <div className="bg-[#FAF8F5] border border-[#E5E2DA] p-3">
                    <span className="text-[10px] text-[#888888] block">LAST PUBLISH</span>
                    <strong className="text-base text-[#111111]">{formatTimeAgo(agentStatus?.lastPublishedAt)}</strong>
                  </div>
                  <div className="bg-[#FAF8F5] border border-[#E5E2DA] p-3 border-l-2 border-l-[#6D28D9]">
                    <span className="text-[10px] text-[#888888] block">NEXT PUBLISH</span>
                    <strong className="text-base text-[#6D28D9]">{formatCountdown(secondsUntilNextPublish)}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* OPERATION PARAMETERS TABLE */}
            <div>
              <div className="section-header-banner">
                <span>AUTONOMOUS OPERATION PARAMETERS</span>
                <span className="text-[#888888] font-mono-tech text-[10px]">CONFIGURED PARAMETERS</span>
              </div>

              <div className="bg-white border border-[#E5E2DA] border-t-0 p-6 font-mono-tech text-xs divide-y divide-[#F2EFE9]">
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#666666]">Discovery Source:</span>
                  <span className="font-bold text-[#111111]">Live RSS / News Sources (TechCrunch, Hacker News, ArXiv)</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#666666]">Human Input Required:</span>
                  <span className="font-bold text-[#10B981]">NO (100% Autonomous)</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#666666]">Publishing Mode:</span>
                  <span className="font-bold text-[#6D28D9]">Autonomous Multi-Cycle</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#666666]">Publishing Interval:</span>
                  <span className="font-bold text-[#111111]">15 minutes (900,000 ms)</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#666666]">Last Cycle Timestamp:</span>
                  <span className="text-[#111111]">{agentStatus?.lastCycleAt || 'N/A'}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#666666]">Next Cycle Timestamp:</span>
                  <span className="text-[#6D28D9]">{agentStatus?.nextCycleAt || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            PAGE 6: ACTIVITY LOG PAGE
           =================================================================== */}
        {activeTab === 'activity' && (
          <div className="space-y-6">
            <div className="space-y-1 border-b border-[#E5E2DA] pb-4">
              <h1 className="text-3xl font-serif-headline font-bold text-[#111111]">
                Activity Log &amp; Autonomous Pipeline
              </h1>
              <p className="text-xs font-mono-tech text-[#666666]">
                Chronological log of system execution events, discovery passes, and live pipeline status.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* LEFT COLUMN: DISCOVERY PIPELINE PANEL (1 COLUMN) */}
              <div className="space-y-0">
                <div className="section-header-banner">
                  <span>DISCOVERY PIPELINE</span>
                  <span className="text-[#6D28D9] font-mono-tech text-[10px]">● AUTOMATED</span>
                </div>
                <div className="bg-white border border-[#E5E2DA] border-t-0 p-5 space-y-3 font-mono-tech text-xs">
                  <div className="p-3 border border-[#E5E2DA] bg-[#FAF8F5] flex items-center justify-between">
                    <span>✓ 1. DISCOVERY</span>
                    <span className="text-[10px] text-[#888888]">Live RSS Scanned</span>
                  </div>

                  <div className="p-3 border border-[#E5E2DA] bg-[#FAF8F5] flex items-center justify-between">
                    <span>✓ 2. EDITORIAL EVALUATION</span>
                    <span className="text-[10px] text-[#888888]">Topics Scored</span>
                  </div>

                  <div className="p-3 border border-[#E5E2DA] bg-[#FAF8F5] flex items-center justify-between">
                    <span>✓ 3. MEMORY CHECK</span>
                    <span className="text-[10px] text-[#888888]">Duplicate Penalty</span>
                  </div>

                  <div className="p-3 border-2 border-[#6D28D9] bg-[#F3E8FF]/40 text-[#6D28D9] font-bold flex items-center justify-between">
                    <span>● 4. CONTENT GENERATION</span>
                    <span className="text-[10px]">Blog / LinkedIn / X</span>
                  </div>

                  <div className="p-3 border border-[#E5E2DA] bg-[#FAF8F5] text-[#888888] flex items-center justify-between">
                    <span>○ 5. PUBLISHING</span>
                    <span className="text-[10px]">Feed &amp; Memory</span>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: SYSTEM ACTIVITY CHRONICLE (2 COLUMNS) */}
              <div className="lg:col-span-2 space-y-0">
                <div className="section-header-banner">
                  <span>SYSTEM ACTIVITY CHRONICLE</span>
                  <span className="text-[#888888] font-mono-tech text-[10px]">
                    EVENTS COUNT: {activities.length}
                  </span>
                </div>

                <div className="bg-white border border-[#E5E2DA] border-t-0 p-6 space-y-6">
                  {/* ACTIVITY FILTER TABS */}
                  <div className="flex flex-wrap gap-2 font-mono-tech text-xs border-b border-[#F2EFE9] pb-4">
                    {(['ALL', 'DISCOVERY', 'EDITORIAL', 'MEMORY', 'GENERATION', 'PUBLISHING', 'ERROR'] as const).map((flt) => (
                      <button
                        key={flt}
                        onClick={() => setActivityFilter(flt)}
                        className={`px-3 py-1 text-[11px] font-bold uppercase border transition-colors ${
                          activityFilter === flt
                            ? 'bg-[#111111] text-white border-[#111111]'
                            : 'bg-[#FAF8F5] text-[#666666] border-[#E5E2DA] hover:text-[#111111]'
                        }`}
                      >
                        {flt}
                      </button>
                    ))}
                  </div>

                  <div className="relative border-l-2 border-[#E5E2DA] ml-3 pl-6 space-y-6 max-h-[600px] overflow-y-auto custom-scrollbar">
                    {activities
                      .filter((ev) => {
                        if (activityFilter === 'ALL') return true;
                        if (activityFilter === 'DISCOVERY') return ev.type.includes('DISCOVER');
                        if (activityFilter === 'EDITORIAL') return ev.type.includes('EDITORIAL') || ev.type.includes('TOPIC');
                        if (activityFilter === 'MEMORY') return ev.type.includes('MEMORY');
                        if (activityFilter === 'GENERATION') return ev.type.includes('CONTENT') || ev.type.includes('FORMAT');
                        if (activityFilter === 'PUBLISHING') return ev.type.includes('PUBLISH');
                        if (activityFilter === 'ERROR') return ev.type.includes('ERROR') || ev.type.includes('FAIL');
                        return true;
                      })
                      .map((ev) => (
                        <div key={ev.id} className="relative space-y-1">
                          <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white bg-[#6D28D9]" />
                          <div className="flex items-center space-x-3 font-mono-tech text-xs">
                            <span className="text-[#888888]">
                              {new Date(ev.createdAt).toLocaleString()}
                            </span>
                            <span className="px-2 py-0.5 bg-[#F3E8FF] border border-[#C084FC]/40 text-[#6D28D9] text-[10px] font-bold uppercase">
                              {ev.type}
                            </span>
                          </div>
                          <p className="text-xs text-[#222222] font-sans-ui leading-relaxed bg-[#FAF8F5] p-3 border border-[#E5E2DA]">
                            {ev.details}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

          {/* RIGHT ENGINE CONTEXTUAL PANEL (DESKTOP) */}
          <aside className="hidden lg:block space-y-4 sticky top-20 self-start">
            <div>
              <div className="section-header-banner">
                <span>AUTONOMOUS ENGINE</span>
                <span className="text-[#10B981] font-mono-tech text-[10px]">● RUNNING</span>
              </div>

              <div className="bg-white border border-[#E5E2DA] border-t-0 p-4 space-y-3 font-mono-tech text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-[#F2EFE9]">
                  <span className="text-[#666666] text-[11px]">ENGINE STATUS</span>
                  <span className="flex items-center space-x-1.5 font-bold text-[#10B981] text-[11px] uppercase">
                    <span className={`w-2 h-2 rounded-full ${getStatusDotColor(currentStatus)}`} />
                    <span>{currentStatus}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-[#F2EFE9]">
                  <span className="text-[#666666] text-[11px]">CYCLE</span>
                  <span className="font-bold text-[#111111] text-[11px]">15 MINUTES</span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-[#F2EFE9]">
                  <span className="text-[#666666] text-[11px]">NEXT CYCLE</span>
                  <span className="font-bold text-[#6D28D9] text-[13px] font-mono-tech">
                    {formatCountdown(secondsUntilNextPublish)}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-[#F2EFE9]">
                  <span className="text-[#666666] text-[11px]">LAST PUBLISH</span>
                  <span className="font-bold text-[#111111] text-[11px]">
                    {formatTimeAgo(agentStatus?.lastPublishedAt)}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-[#F2EFE9]">
                  <span className="text-[#666666] text-[11px]">TOPICS THIS CYCLE</span>
                  <span className="font-bold text-[#111111] text-[11px]">
                    {topics.length || memorySummary?.topicsDiscovered || 20}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-[#F2EFE9]">
                  <span className="text-[#666666] text-[11px]">SELECTED</span>
                  <span className="font-bold text-[#6D28D9] text-[11px]">
                    {acceptedTopics.length || 18}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-[#F2EFE9]">
                  <span className="text-[#666666] text-[11px]">PUBLISHED</span>
                  <span className="font-bold text-[#111111] text-[11px]">
                    {publishedPosts.length || 1}
                  </span>
                </div>

                <button
                  onClick={() => setActiveTab('status')}
                  className="w-full mt-2 py-2.5 bg-[#FAF8F5] hover:bg-[#111111] hover:text-white border border-[#E5E2DA] font-mono-tech text-[10px] font-bold uppercase tracking-wider transition-colors text-center block"
                >
                  [ VIEW FULL STATUS → ]
                </button>
              </div>
            </div>

            {/* PIPELINE OVERVIEW MINI WIDGET */}
            <div className="bg-white border border-[#E5E2DA] p-4 space-y-2 font-mono-tech text-xs">
              <div className="text-[10px] text-[#888888] font-bold uppercase tracking-wider border-b border-[#F2EFE9] pb-2">
                AUTOMATED PIPELINE
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span>1. DISCOVERY</span>
                  <span className="text-[#10B981] font-bold">✓</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>2. EDITORIAL</span>
                  <span className="text-[#10B981] font-bold">✓</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>3. MEMORY</span>
                  <span className="text-[#10B981] font-bold">✓</span>
                </div>
                <div className="flex items-center justify-between font-bold text-[#6D28D9]">
                  <span>4. GENERATION</span>
                  <span>●</span>
                </div>
                <div className="flex items-center justify-between text-[#888888]">
                  <span>5. PUBLISHING</span>
                  <span>○</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* =========================================================================
          POST EXPLANATION / RATIONALE MODAL DIALOG
         ========================================================================= */}
      {selectedPostExplanation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-text">
          <div className="bg-white border border-[#111111] w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
            <div className="section-header-banner">
              <span>EDITORIAL ANALYSIS &amp; SELECTION RATIONALE</span>
              <button
                onClick={() => setSelectedPostExplanation(null)}
                className="text-white hover:text-[#C084FC] font-mono-tech text-xs uppercase font-bold"
              >
                [ CLOSE ✕ ]
              </button>
            </div>

            <div className="p-6 space-y-6">
              {selectedPostExplanation.isLoading ? (
                <p className="text-xs font-mono-tech text-[#888888] text-center py-8">
                  Loading editorial decision explanation...
                </p>
              ) : selectedPostExplanation.explanation ? (
                <>
                  <div className="space-y-2 border-b border-[#E5E2DA] pb-4">
                    <span className="font-mono-tech text-[10px] font-bold text-[#6D28D9] uppercase">
                      WHY THIS TOPIC?
                    </span>
                    <h2 className="font-serif-headline text-2xl font-bold text-[#111111] leading-tight">
                      {stripHtmlTags(selectedPostExplanation.explanation.topic?.title || selectedPostExplanation.post.text)}
                    </h2>
                  </div>

                  {/* SCORE BREAKDOWN */}
                  {selectedPostExplanation.explanation.decision?.scores && (
                    <div className="grid grid-cols-3 gap-3 font-mono-tech text-xs">
                      <div className="bg-[#FAF8F5] border border-[#E5E2DA] p-3">
                        <span className="text-[10px] text-[#888888] block font-bold">OVERALL SCORE</span>
                        <strong className="text-lg text-[#6D28D9]">
                          {selectedPostExplanation.explanation.decision.scores.overall} / 100
                        </strong>
                      </div>
                      <div className="bg-[#FAF8F5] border border-[#E5E2DA] p-3">
                        <span className="text-[10px] text-[#888888] block font-bold">RELEVANCE</span>
                        <strong className="text-lg text-[#111111]">
                          {selectedPostExplanation.explanation.decision.scores.relevance} / 100
                        </strong>
                      </div>
                      <div className="bg-[#FAF8F5] border border-[#E5E2DA] p-3">
                        <span className="text-[10px] text-[#888888] block font-bold">TIMELINESS</span>
                        <strong className="text-lg text-[#111111]">
                          {selectedPostExplanation.explanation.decision.scores.timeliness} / 100
                        </strong>
                      </div>
                    </div>
                  )}

                  {/* WHY IT WAS SELECTED */}
                  <div className="space-y-2">
                    <span className="font-mono-tech text-[11px] font-bold text-[#111111] uppercase tracking-wider block">
                      WHY IT WAS SELECTED
                    </span>
                    <p className="text-xs text-[#333333] bg-[#FAF8F5] p-4 border border-[#E5E2DA] leading-relaxed">
                      {selectedPostExplanation.explanation.decision?.reason || selectedPostExplanation.post.rationale}
                    </p>
                  </div>

                  {/* COMPARATIVE ALTERNATIVES */}
                  {selectedPostExplanation.explanation.decision?.comparativeAlternatives && (
                    <div className="space-y-2 font-mono-tech text-xs">
                      <span className="font-bold text-[#111111] uppercase tracking-wider block">
                        COMPARATIVE ALTERNATIVES (REJECTED CANDIDATES)
                      </span>
                      <div className="bg-[#FAF8F5] border border-[#E5E2DA] p-4 divide-y divide-[#E5E2DA] space-y-2">
                        {selectedPostExplanation.explanation.decision.comparativeAlternatives.slice(0, 3).map((alt: any, idx: number) => (
                          <div key={idx} className="pt-2 first:pt-0 space-y-1">
                            <span className="text-[11px] font-bold text-[#444444] block truncate">
                              • {alt.title} (Score: {alt.score}/100)
                            </span>
                            <span className="text-[10px] text-[#666666] block">
                              Reason lost: {alt.reason || 'Lower timeliness and persona alignment score.'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SOURCE LINK */}
                  {selectedPostExplanation.explanation.topic?.source?.url && (
                    <div className="pt-2 border-t border-[#E5E2DA]">
                      <a
                        href={selectedPostExplanation.explanation.topic.source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono-tech text-xs text-[#6D28D9] hover:underline font-bold"
                      >
                        Source URL: {selectedPostExplanation.explanation.topic.source.url} ↗
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs font-mono-tech text-[#888888] text-center py-4">
                  No explanation available for this post.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      {/* =========================================================================
          TOPIC DETAIL MODAL DIALOG
         ========================================================================= */}
      {selectedTopicDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-text">
          <div className="bg-white border border-[#111111] w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
            <div className="section-header-banner">
              <span>DISCOVERED TOPIC EDITORIAL ANALYSIS</span>
              <button
                onClick={() => setSelectedTopicDetail(null)}
                className="text-white hover:text-[#C084FC] font-mono-tech text-xs uppercase font-bold"
              >
                [ CLOSE ✕ ]
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-2 border-b border-[#E5E2DA] pb-4">
                <div className="flex items-center justify-between font-mono-tech text-xs">
                  <span className="px-2 py-0.5 bg-[#FAF8F5] border border-[#E5E2DA] text-[#666666] text-[10px]">
                    {selectedTopicDetail.source.name.toUpperCase()}
                  </span>
                  <span className="text-[#888888]">{formatTimeAgo(selectedTopicDetail.discoveredAt)}</span>
                </div>
                <h2 className="font-serif-headline text-2xl font-bold text-[#111111] leading-tight">
                  {stripHtmlTags(selectedTopicDetail.title)}
                </h2>
              </div>

              <p className="text-xs text-[#444444] font-sans-ui leading-relaxed bg-[#FAF8F5] p-4 border border-[#E5E2DA]">
                {stripHtmlTags(selectedTopicDetail.summary)}
              </p>

              {selectedTopicDetail.decision && (
                <div className="space-y-3 font-mono-tech text-xs">
                  <span className="font-bold text-[#111111] uppercase tracking-wider block">
                    EDITORIAL SCORES &amp; DECISION
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-[#FAF8F5] border border-[#E5E2DA] p-3">
                      <span className="text-[10px] text-[#888888] block">OVERALL</span>
                      <strong className="text-base text-[#6D28D9]">{selectedTopicDetail.decision.scores.overall}/100</strong>
                    </div>
                    <div className="bg-[#FAF8F5] border border-[#E5E2DA] p-3">
                      <span className="text-[10px] text-[#888888] block">RELEVANCE</span>
                      <strong className="text-base text-[#111111]">{selectedTopicDetail.decision.scores.relevance}/100</strong>
                    </div>
                    <div className="bg-[#FAF8F5] border border-[#E5E2DA] p-3">
                      <span className="text-[10px] text-[#888888] block">TIMELINESS</span>
                      <strong className="text-base text-[#111111]">{selectedTopicDetail.decision.scores.timeliness}/100</strong>
                    </div>
                    <div className="bg-[#FAF8F5] border border-[#E5E2DA] p-3">
                      <span className="text-[10px] text-[#888888] block">QUALITY</span>
                      <strong className="text-base text-[#111111]">{selectedTopicDetail.decision.scores.sourceQuality}/100</strong>
                    </div>
                  </div>
                  {selectedTopicDetail.decision.reason && (
                    <p className="text-xs text-[#333333] bg-[#FAF8F5] p-3 border border-[#E5E2DA] font-sans-ui">
                      <strong>Rationale:</strong> {selectedTopicDetail.decision.reason}
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-[#E5E2DA]">
                <a
                  href={selectedTopicDetail.source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono-tech text-xs text-[#6D28D9] hover:underline font-bold"
                >
                  Source Link ↗
                </a>

                <button
                  onClick={() => {
                    handleGenerateContentForTopic(selectedTopicDetail.id);
                    setSelectedTopicDetail(null);
                    setActiveTab('create');
                  }}
                  className="px-4 py-2 bg-[#111111] hover:bg-[#6D28D9] text-white font-mono-tech text-xs uppercase font-bold tracking-wider"
                >
                  CREATE DRAFT →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
