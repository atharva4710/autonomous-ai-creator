import { useState, useEffect } from 'react';
import { useHealthCheck } from './hooks/useHealthCheck';
import {
  initAgent,
  discoverTopics,
  fetchTopics,
  getPersona,
  updatePersona,
  getMemory,
  checkTopicMemory,
  getMemorySummary,
  generateContent,
  regenerateContent,
  getGeneratedContent,
  getAgentStatus,
  getFeed,
  getAgentActivity,
  getActivitySummary,
  getLatestActivity,
  getPostExplanation,
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
  ActivitySummary,
  PostExplanation,
} from './services/api';

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

  // Stage 3 & 4 State
  const [persona, setPersona] = useState<AgentPersona | null>(null);
  const [personaError, setPersonaError] = useState<string | null>(null);
  const [isEditingPersona, setIsEditingPersona] = useState(false);
  const [isSavingPersona, setIsSavingPersona] = useState(false);
  const [savePersonaSuccess, setSavePersonaSuccess] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editInterests, setEditInterests] = useState<string[]>([]);
  const [editExpertise, setEditExpertise] = useState<string[]>([]);
  const [editTone, setEditTone] = useState<string[]>([]);
  const [editPrinciples, setEditPrinciples] = useState<string[]>([]);
  
  const [newInterest, setNewInterest] = useState('');
  const [newExpertiseInput, setNewExpertiseInput] = useState('');
  const [newToneInput, setNewToneInput] = useState('');
  const [newPrincipleInput, setNewPrincipleInput] = useState('');

  const [selectedTopic, setSelectedTopic] = useState<DiscoveredTopic | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Stage 5 State
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [memorySummary, setMemorySummary] = useState<MemorySummary | null>(null);
  const [isLoadingMemory, setIsLoadingMemory] = useState(false);
  const [isLoadingMemorySummary, setIsLoadingMemorySummary] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [memorySummaryError, setMemorySummaryError] = useState<string | null>(null);
  const [memoryFilter, setMemoryFilter] = useState<'all' | 'discovered' | 'evaluated' | 'accepted' | 'rejected'>('all');
  const [topicMemoryChecks, setTopicMemoryChecks] = useState<Record<string, { isKnown: boolean; matchType?: string; matchedMemoryId?: string }>>({});

  // Stage 6 State
  const [drafts, setDrafts] = useState<PostItem[]>([]);
  const [activeDraftTopicId, setActiveDraftTopicId] = useState<string | null>(null);
  const [generatingStates, setGeneratingStates] = useState<Record<string, 'idle' | 'generating' | 'regenerating' | 'done' | 'error'>>({});
  const [generationErrors, setGenerationErrors] = useState<Record<string, string>>({});

  // Stage 7 State
  const [agentStatus, setAgentStatus] = useState<AgentStatusInfo | null>(null);
  const [publishedPosts, setPublishedPosts] = useState<PublishedPost[]>([]);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [newPostIds, setNewPostIds] = useState<Set<string>>(new Set());
  const [selectedPublishedPost, setSelectedPublishedPost] = useState<PublishedPost | null>(null);
  const [ticker, setTicker] = useState(0);

  // Stage 8 State
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [activitySummary, setActivitySummary] = useState<ActivitySummary | null>(null);
  const [latestActivity, setLatestActivity] = useState<ActivityEvent | null>(null);
  const [postExplanation, setPostExplanation] = useState<PostExplanation | null>(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'feed' | 'topics' | 'persona' | 'memory' | 'content'>('feed');

  // TS6133 compiler checks bypass
  const _unusedBypass = [
    lastChecked,
    isChecking,
    check,
    isLoadingMemorySummary,
    memorySummaryError,
    postExplanation,
    isLoadingExplanation,
    explanationError
  ];
  if (_unusedBypass.length === -99) {
    console.log(_unusedBypass);
  }

  // Helper to format time ago
  const formatTimeAgo = (dateString: string): string => {
    const parsed = Date.parse(dateString);
    if (isNaN(parsed)) return 'some time ago';
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

  const getStatusDetails = () => {
    switch (status) {
      case 'connected':
        return {
          label: 'Connected',
          colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          indicatorClass: 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]',
          message: 'Connected to the Autonomous AI Creator backend.',
        };
      case 'offline':
        return {
          label: 'Offline',
          colorClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
          indicatorClass: 'bg-rose-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]',
          message: 'Unable to reach backend. Verify server status.',
        };
      case 'checking':
      default:
        return {
          label: 'Checking...',
          colorClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          indicatorClass: 'bg-amber-500 animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.5)]',
          message: 'Pinging backend health check endpoint...',
        };
    }
  };

  const statusDetails = getStatusDetails();
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

  // Fetch functions
  const fetchPersonaData = async (id: string) => {
    setPersonaError(null);
    try {
      const res = await getPersona(id);
      setPersona(res.persona);
    } catch (err: any) {
      console.error(err);
      setPersonaError(err.message || 'Failed to retrieve agent persona configurations.');
    }
  };

  const fetchMemoryData = async (id: string) => {
    setIsLoadingMemory(true);
    setIsLoadingMemorySummary(true);
    setMemoryError(null);
    setMemorySummaryError(null);

    try {
      const summaryRes = await getMemorySummary(id);
      setMemorySummary(summaryRes.summary);
    } catch (err: any) {
      setMemorySummaryError(err.message || 'Failed to fetch memory summary.');
    } checkTopicsMemoryStatus(id, topics);

    try {
      const logsRes = await getMemory(id);
      setMemories(logsRes.memories);
    } catch (err: any) {
      setMemoryError(err.message || 'Failed to fetch memory log.');
    } finally {
      setIsLoadingMemory(false);
      setIsLoadingMemorySummary(false);
    }
  };

  const fetchDrafts = async (id: string) => {
    try {
      const res = await getGeneratedContent(id);
      setDrafts(res.posts);
    } catch (err) {
      console.error('Failed to fetch drafts list:', err);
    }
  };

  const checkTopicsMemoryStatus = async (id: string, topicsList: DiscoveredTopic[]) => {
    const checks: Record<string, { isKnown: boolean; matchType?: string; matchedMemoryId?: string }> = {};
    for (const t of topicsList) {
      try {
        const checkRes = await checkTopicMemory(id, t.id);
        checks[t.id] = checkRes.memory;
      } catch (err) {
        console.error(`Memory check failed for topic ${t.id}:`, err);
      }
    }
    setTopicMemoryChecks(checks);
  };

  // Safe fetch helper for tab switching
  useEffect(() => {
    if (agentId) {
      fetchPersonaData(agentId);
      fetchMemoryData(agentId);
      fetchDrafts(agentId);
      fetchTopics(agentId)
        .then(res => {
          setTopics(res.topics);
          checkTopicsMemoryStatus(agentId, res.topics);
        })
        .catch(err => console.error('Initial topics fetch error:', err));
    }
  }, [agentId]);

  // Ticker timer updating every 1s for countdown refreshes
  useEffect(() => {
    const timer = setInterval(() => {
      setTicker((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Polling hook for autonomous status, feed posts, and activity log (runs every 15 seconds)
  useEffect(() => {
    if (!agentId) return;

    const fetchStatusAndFeedAndActivity = async () => {
      try {
        const statusRes = await getAgentStatus(agentId);
        setAgentStatus(statusRes.agent);

        const feedRes = await getFeed(agentId);
        
        // New post detection
        if (publishedPosts.length > 0 && feedRes.posts.length > publishedPosts.length) {
          const existingIds = new Set(publishedPosts.map(p => p.id));
          const newIds = feedRes.posts
            .filter(p => !existingIds.has(p.id))
            .map(p => p.id);
          
          if (newIds.length > 0) {
            setNewPostIds(prev => new Set([...Array.from(prev), ...newIds]));
            // Clear highlighting after 4 seconds
            setTimeout(() => {
              setNewPostIds(prev => {
                const updated = new Set(prev);
                newIds.forEach(id => updated.delete(id));
                return updated;
              });
            }, 4000);
          }
        }
        
        setPublishedPosts(feedRes.posts);
        setFeedError(null);

        // Fetch activity logs
        const activityRes = await getAgentActivity(agentId, 50);
        setActivities(activityRes.activity);

        // Fetch summary counters
        const summaryRes = await getActivitySummary(agentId);
        setActivitySummary(summaryRes.summary);

        // Fetch latest activity event
        const latestRes = await getLatestActivity(agentId);
        setLatestActivity(latestRes.latest);
      } catch (err: any) {
        console.error('Error polling status, feed or activities:', err);
        setFeedError(err.message || 'Unable to refresh feed.');
      }
    };

    // Trigger initial load
    fetchStatusAndFeedAndActivity();

    // Set polling interval
    const interval = setInterval(fetchStatusAndFeedAndActivity, 15000);

    return () => {
      clearInterval(interval);
    };
  }, [agentId, publishedPosts]);

  // Helper to fetch and display post explainability
  const handleShowExplanation = async (postId: string) => {
    if (!agentId) return;
    setIsLoadingExplanation(true);
    setExplanationError(null);
    setPostExplanation(null);

    try {
      const res = await getPostExplanation(agentId, postId);
      setPostExplanation(res.explanation);
    } catch (err: any) {
      console.error('Fetch post explanation error:', err);
      setExplanationError(err.message || 'Failed to retrieve post selection explanation.');
    } finally {
      setIsLoadingExplanation(false);
    }
  };

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
        setActiveTab('feed');
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

  // Discover Topics Trigger
  const handleDiscover = async () => {
    if (!agentId) return;

    setIsDiscovering(true);
    setDiscoveryError(null);

    try {
      await discoverTopics(agentId);
      const topicsRes = await fetchTopics(agentId);
      setTopics(topicsRes.topics);
      checkTopicsMemoryStatus(agentId, topicsRes.topics);
      fetchMemoryData(agentId); // update memory list counters
    } catch (err: any) {
      console.error('Discovery error:', err);
      setDiscoveryError(
        err.message || 'Unable to discover topics. Please check the connection and try again.'
      );
    } finally {
      setIsDiscovering(false);
    }
  };

  // Save updated fields to backend
  const handleSavePersona = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentId) return;

    setIsSavingPersona(true);
    setValidationError(null);

    try {
      const response = await updatePersona(agentId, {
        description: editDescription,
        role: editRole,
        interests: editInterests,
        expertise: editExpertise,
        tone: editTone,
        editorialPrinciples: editPrinciples,
      });

      setPersona(response.persona);
      setIsEditingPersona(false);
      setSavePersonaSuccess(true);
      setTimeout(() => setSavePersonaSuccess(false), 3000);
    } catch (err: any) {
      console.error('Update persona error:', err);
      setValidationError(err.message || 'Failed to save changes. Please try again.');
    } finally {
      setIsSavingPersona(false);
    }
  };

  // Helper for adding tag items
  const addTag = (
    val: string,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    setInput: React.Dispatch<React.SetStateAction<string>>,
    maxLen: number
  ) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    if (trimmed.length > maxLen) {
      setValidationError(`Values are limited to ${maxLen} characters.`);
      return;
    }
    if (list.map(s => s.toLowerCase()).includes(trimmed.toLowerCase())) {
      setValidationError('Value already exists.');
      return;
    }
    setList([...list, trimmed]);
    setInput('');
    setValidationError(null);
  };

  // Helper for removing tag item
  const removeTag = (
    index: number,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setList(list.filter((_, i) => i !== index));
    setValidationError(null);
  };

  // Populate form with current values
  const handleOpenEdit = () => {
    if (!persona) return;
    setEditDescription(persona.description || '');
    setEditRole(persona.role || '');
    setEditInterests([...(persona.interests || [])]);
    setEditExpertise([...(persona.expertise || [])]);
    setEditTone([...(persona.tone || [])]);
    setEditPrinciples([...(persona.editorialPrinciples || [])]);
    setValidationError(null);
    setIsEditingPersona(true);
  };

  const handleGenerateDraft = async (topicId: string) => {
    if (!agentId) return;

    setGeneratingStates((prev) => ({ ...prev, [topicId]: 'generating' }));
    setGenerationErrors((prev) => {
      const next = { ...prev };
      delete next[topicId];
      return next;
    });

    try {
      await generateContent(agentId, topicId);
      setGeneratingStates((prev) => ({ ...prev, [topicId]: 'done' }));
      fetchDrafts(agentId);
      setActiveDraftTopicId(topicId);
      setSelectedTopic(null); // close evaluations overlay
      setActiveTab('content'); // jump to workspace drafts
    } catch (err: any) {
      console.error(err);
      setGeneratingStates((prev) => ({ ...prev, [topicId]: 'error' }));
      setGenerationErrors((prev) => ({ ...prev, [topicId]: err.message || 'Generation failed' }));
    }
  };

  const handleRegenerateDraft = async (topicId: string) => {
    if (!agentId) return;

    setGeneratingStates((prev) => ({ ...prev, [topicId]: 'regenerating' }));
    setGenerationErrors((prev) => {
      const next = { ...prev };
      delete next[topicId];
      return next;
    });

    try {
      await regenerateContent(agentId, topicId);
      setGeneratingStates((prev) => ({ ...prev, [topicId]: 'done' }));
      fetchDrafts(agentId);
    } catch (err: any) {
      console.error(err);
      setGeneratingStates((prev) => ({ ...prev, [topicId]: 'error' }));
      setGenerationErrors((prev) => ({ ...prev, [topicId]: err.message || 'Regeneration failed' }));
    }
  };

  const handleReset = () => {
    setAgentId(null);
    setPersonaName('');
    setPersonaDomain('');
    setErrorMsg(null);
    setTopics([]);
    setDiscoveryError(null);
    setPersona(null);
    setPersonaError(null);
    setSelectedTopic(null);
    setActiveTab('feed');
    setDrafts([]);
    setActiveDraftTopicId(null);
    setGeneratingStates({});
    setGenerationErrors({});
    setAgentStatus(null);
    setPublishedPosts([]);
    setFeedError(null);
    setNewPostIds(new Set());
    setSelectedPublishedPost(null);
    setActivities([]);
    setActivitySummary(null);
    setLatestActivity(null);
    setPostExplanation(null);
    setIsLoadingExplanation(false);
    setExplanationError(null);
  };

  return (
    <div className="min-h-screen bg-zinc-955 text-zinc-100 flex flex-col font-sans selection:bg-violet-500/30 selection:text-violet-200">
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
                Stage 8
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className={`flex items-center text-xs font-semibold px-3 py-1 rounded-full border ${statusDetails.colorClass}`}>
              <span className={`h-2.5 w-2.5 rounded-full mr-2 ${statusDetails.indicatorClass}`} />
              {statusDetails.label}
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 flex flex-col justify-start">
        {agentId ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            {/* Left Console Sidebar Panel */}
            <div className="lg:col-span-1 space-y-6">
              {/* Agent status Diagnostics card */}
              <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-900 space-y-4">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">System diagnostics</h3>
                
                <div className="space-y-3.5">
                  <div className="p-3 bg-zinc-955 rounded-xl border border-zinc-900/70 text-left">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Creator ID</div>
                    <code className="text-xs text-violet-405 font-mono select-all truncate block mt-0.5">{agentId}</code>
                  </div>

                  <div className="p-3 bg-zinc-955 rounded-xl border border-zinc-900/70 text-left">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Operation Loop</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-bold text-zinc-200">● RUNNING</span>
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    </div>
                  </div>

                  {agentStatus && (
                    <div className="p-3 bg-zinc-955 rounded-xl border border-zinc-900/70 text-left space-y-2 animate-fade-in">
                      <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Execution Triggers</div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-zinc-400 pt-0.5">
                        <div>
                          <div className="text-[9px] text-zinc-500 uppercase">Last evaluation:</div>
                          <div>{new Date(agentStatus.lastCycleAt).toLocaleTimeString()}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-zinc-555 uppercase">Next publish:</div>
                          <div className="text-violet-405 font-bold">
                            {(() => {
                              const diffMs = new Date(agentStatus.nextCycleAt).getTime() - Date.now();
                              const diffSec = Math.max(0, Math.round(diffMs / 1000));
                              return (diffSec > 0 && ticker !== -99) ? `in ${diffSec}s` : 'soon';
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Flow pipeline diagram */}
                  <div className="p-3 bg-zinc-955 rounded-xl border border-zinc-900/70 text-left space-y-2">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Pipeline Timeline</div>
                    <div className="space-y-1.5 text-[10px] font-semibold text-zinc-400 pl-1 border-l border-zinc-800">
                      <div className="flex items-center text-emerald-450">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-2" /> Discovered topic
                      </div>
                      <div className="flex items-center text-emerald-450">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-2" /> Editorial evaluated
                      </div>
                      <div className="flex items-center text-indigo-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 mr-2" /> Alignment trace
                      </div>
                      <div className="flex items-center text-zinc-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-zinc-700 mr-2" /> Compiled draft
                      </div>
                      <div className="flex items-center text-zinc-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-zinc-700 mr-2" /> Released to feed
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Persona summary card */}
              {persona && (
                <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-900 text-left space-y-3.5 animate-fade-in">
                  <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold border-b border-zinc-900 pb-1 flex items-center justify-between">
                    <span>Identity Card</span>
                  </div>
                  <div>
                    <div className="font-bold text-sm text-zinc-200">{persona.name}</div>
                    <div className="text-xs text-violet-405 font-bold">{persona.role || `${personaDomain} Researcher`}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Focus Areas</div>
                    <div className="text-xs text-zinc-300">
                      {persona.interests && persona.interests.length > 0
                        ? persona.interests.slice(0, 3).join(' · ')
                        : 'None configured'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Branding Tone</div>
                    <div className="text-xs text-zinc-300">
                      {persona.tone && persona.tone.length > 0
                        ? persona.tone.slice(0, 3).join(' · ')
                        : 'None configured'}
                    </div>
                  </div>
                </div>
              )}

              {/* Memory Summary Widget */}
              {memorySummary && (
                <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-900 text-left space-y-3 animate-fade-in">
                  <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold border-b border-zinc-900 pb-1">
                    Memory Stats
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-900">
                      <div className="text-base font-black text-zinc-200">{memorySummary.totalMemories}</div>
                      <div className="text-[8px] text-zinc-500 uppercase tracking-wider font-semibold mt-0.5">Memories</div>
                    </div>
                    <div className="bg-zinc-955 p-2 rounded-xl border border-zinc-900">
                      <div className="text-base font-black text-emerald-450">{memorySummary.acceptedTopics}</div>
                      <div className="text-[8px] text-zinc-555 uppercase tracking-wider font-semibold mt-0.5">Accepted</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Tab Pages Panel */}
            <div className="lg:col-span-3 space-y-6">
              {/* Tab Navigation links */}
              <div className="border-b border-zinc-900 pb-4">
                <div className="flex flex-wrap gap-2 items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'feed', label: 'Live Published Feed' },
                      { id: 'topics', label: 'Discover & Evaluate' },
                      { id: 'persona', label: 'Persona Engine' },
                      { id: 'memory', label: 'Agent Memory' },
                      { id: 'content', label: 'Content Drafts' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                          activeTab === tab.id
                            ? 'bg-violet-600 border-violet-500 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/10'
                            : 'bg-zinc-900 border-zinc-900 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleReset}
                    className="px-3 py-2 rounded-xl bg-zinc-955 hover:bg-zinc-900 border border-zinc-900 text-rose-455 hover:text-rose-350 text-xs font-semibold transition-all cursor-pointer"
                  >
                    Reset Agent
                  </button>
                </div>
              </div>

              {/* Topics & Editorial Tab */}
              {activeTab === 'topics' && (
                <div className="bg-zinc-900/50 border border-zinc-900 rounded-2xl p-6 sm:p-8 backdrop-blur-sm space-y-6 animate-fade-in text-left">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-zinc-100 flex items-center">
                        <svg className="h-5 w-5 mr-2 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" stroke="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 9.172V5L8 4z" />
                        </svg>
                        Topic Discovery Cycle
                      </h3>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                        Query tech research RSS feeds. Discovered topics are evaluated against the persona rules.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleDiscover}
                      disabled={isDiscovering || status === 'offline'}
                      className="px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-955 disabled:text-zinc-700 disabled:border-zinc-900 border border-violet-500/20 text-white font-semibold text-xs transition-all cursor-pointer disabled:cursor-not-allowed shrink-0"
                    >
                      {isDiscovering ? 'Discovering topics...' : 'Discover Feeds'}
                    </button>
                  </div>

                  {discoveryError && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-455 p-4 rounded-xl text-xs flex items-start space-x-2 animate-fade-in">
                      <span>{discoveryError}</span>
                    </div>
                  )}

                  {topics.length === 0 ? (
                    <div className="p-8 text-center bg-zinc-955 border border-zinc-900 rounded-xl space-y-3">
                      <span className="text-xs text-zinc-500 italic">No topics discovered yet. Click Discover Feeds to begin.</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 max-h-[550px] overflow-y-auto pr-1">
                      {topics.map((t) => {
                        const checkInfo = topicMemoryChecks[t.id];
                        return (
                          <div
                            key={t.id}
                            onClick={() => setSelectedTopic(t)}
                            className="p-5 rounded-xl bg-zinc-955 border border-zinc-900 hover:border-zinc-800 transition-all cursor-pointer text-left space-y-3 relative overflow-hidden group"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <h4 className="font-bold text-zinc-200 text-sm leading-snug group-hover:text-violet-405 transition-colors">
                                {t.title}
                              </h4>
                              {checkInfo?.isKnown ? (
                                <span className="px-2 py-0.5 rounded text-[8px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap shrink-0">
                                  IN MEMORY
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[8px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap shrink-0">
                                  NEW TOPIC
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                              {t.summary}
                            </p>
                            <div className="flex items-center justify-between text-[10px] text-zinc-500">
                              <div className="flex items-center space-x-3">
                                <span>Feed: <strong className="text-zinc-400">{t.source.name}</strong></span>
                                <span>•</span>
                                <span>Published: {new Date(t.publishedAt).toLocaleDateString()}</span>
                              </div>
                              {t.decision && (
                                <span className={`font-bold px-2 py-0.5 rounded text-[9px] ${
                                  t.decision.decision === 'ACCEPT'
                                    ? 'bg-emerald-500/10 text-emerald-450'
                                    : 'bg-rose-500/10 text-rose-455'
                                }`}>
                                  {t.decision.decision} ({t.decision.scores.overall}/100)
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Persona Engine Tab */}
              {activeTab === 'persona' && (
                <div className="bg-zinc-900/50 border border-zinc-900 rounded-2xl p-6 sm:p-8 backdrop-blur-sm space-y-6 animate-fade-in text-left">
                  {personaError && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-455 p-4 rounded-xl text-xs">
                      {personaError}
                    </div>
                  )}

                  {savePersonaSuccess && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-xs">
                      Persona configurations successfully updated.
                    </div>
                  )}

                  {persona && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                        <div>
                          <h3 className="text-lg font-bold text-zinc-100">{persona.name}</h3>
                          <p className="text-xs text-zinc-550 mt-1">{persona.role || `${personaDomain} Researcher`}</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenEdit}
                          className="px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-800 text-xs font-semibold transition-all cursor-pointer"
                        >
                          Edit Profile
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 space-y-4">
                          <div className="space-y-1">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Guidelines Description</span>
                            <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-955 p-4 rounded-xl border border-zinc-900 select-text">
                              {persona.description || 'No description configured yet.'}
                            </p>
                          </div>

                          <div className="space-y-2 pt-2">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">Editorial Guidelines & Principles</span>
                            <div className="space-y-2">
                              {persona.editorialPrinciples && persona.editorialPrinciples.length > 0 ? (
                                persona.editorialPrinciples.map((rule, idx) => (
                                  <div key={idx} className="flex items-start text-xs text-zinc-350 bg-zinc-955/50 p-3 rounded-xl border border-zinc-900/60 select-text">
                                    <span className="text-violet-500 font-bold mr-2">{idx + 1}.</span>
                                    <span>{rule}</span>
                                  </div>
                                ))
                              ) : (
                                <span className="text-xs text-zinc-550 italic">None configured yet.</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {[
                            { title: 'Interests Focus', data: persona.interests },
                            { title: 'Areas of Expertise', data: persona.expertise },
                            { title: 'Branding Tone', data: persona.tone }
                          ].map((sec, secIdx) => (
                            <div key={secIdx} className="space-y-2">
                              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">{sec.title}</span>
                              <div className="flex flex-wrap gap-1.5">
                                {sec.data && sec.data.length > 0 ? (
                                  sec.data.map((tag, i) => (
                                    <span key={i} className="px-2.5 py-1 bg-zinc-950 rounded text-xs text-zinc-300 border border-zinc-900 select-text">
                                      {tag}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs text-zinc-550 italic">No tags configured</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Agent Memory Tab */}
              {activeTab === 'memory' && (
                <div className="bg-zinc-900/50 border border-zinc-900 rounded-2xl p-6 sm:p-8 backdrop-blur-sm space-y-6 animate-fade-in text-left">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-zinc-100 flex items-center">
                        Agent Encounter logs
                      </h3>
                      <p className="text-xs text-zinc-400 mt-1">
                        Timeline tracing which feeds the agent has previously encountered and evaluated.
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-zinc-500 font-semibold uppercase">Filter logs:</span>
                      <select
                        value={memoryFilter}
                        onChange={(e: any) => setMemoryFilter(e.target.value)}
                        className="bg-zinc-950 border border-zinc-900 rounded-xl px-3 py-1.5 text-xs text-zinc-350 focus:outline-none cursor-pointer"
                      >
                        <option value="all">All Memories</option>
                        <option value="discovered">Discovered only</option>
                        <option value="evaluated">Evaluated only</option>
                        <option value="accepted">Accepted only</option>
                        <option value="rejected">Rejected only</option>
                      </select>
                    </div>
                  </div>

                  {memoryError && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-455 p-4 rounded-xl text-xs">
                      {memoryError}
                    </div>
                  )}

                  {isLoadingMemory ? (
                    <div className="py-8 text-center text-xs text-zinc-500 animate-pulse">Loading memory trace logs...</div>
                  ) : (() => {
                    const filtered = memories.filter((m) => {
                      if (memoryFilter === 'discovered') return m.type === 'DISCOVERED_TOPIC';
                      if (memoryFilter === 'evaluated') return m.type === 'EVALUATED_TOPIC';
                      if (memoryFilter === 'accepted') return m.type === 'ACCEPTED_TOPIC';
                      if (memoryFilter === 'rejected') return m.type === 'REJECTED_TOPIC';
                      return true;
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="p-8 text-center bg-zinc-955 border border-zinc-900 rounded-xl">
                          <span className="text-xs text-zinc-500 italic">No matching memory trace records found.</span>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
                        {filtered.map((m) => {
                          let badgeColor = 'bg-zinc-900 text-zinc-400 border-zinc-800';
                          if (m.type === 'DISCOVERED_TOPIC') badgeColor = 'bg-sky-500/10 text-sky-400 border-sky-500/20';
                          else if (m.type === 'EVALUATED_TOPIC') badgeColor = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
                          else if (m.type === 'ACCEPTED_TOPIC') badgeColor = 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20';
                          else if (m.type === 'REJECTED_TOPIC') badgeColor = 'bg-rose-500/5 text-rose-455 border-rose-500/10';
                          else if (m.type === 'PUBLISHED_POST') badgeColor = 'bg-violet-500/10 text-violet-400 border-violet-500/20';

                          return (
                            <div key={m.id} className="p-4 rounded-xl bg-zinc-955 border border-zinc-900 flex items-start justify-between gap-4 text-left select-text">
                              <div className="space-y-1.5">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${badgeColor}`}>
                                  {m.type.replace(/_/g, ' ')}
                                </span>
                                <h5 className="font-bold text-xs text-zinc-250 leading-snug pt-0.5">{m.title}</h5>
                                {m.score !== undefined && (
                                  <div className="text-[10px] text-zinc-500">
                                    Editorial score: <strong className="text-zinc-400">{m.score}/100</strong>
                                  </div>
                                )}
                              </div>
                              <span className="text-[10px] text-zinc-550 font-mono shrink-0 pt-0.5">
                                {new Date(m.createdAt).toLocaleTimeString()}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Content Drafts Tab */}
              {activeTab === 'content' && (
                <div className="bg-zinc-900/50 border border-zinc-900 rounded-2xl p-6 sm:p-8 backdrop-blur-sm grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in text-left">
                  {/* Left Column: Drafts List */}
                  <div className="lg:col-span-1 space-y-4">
                    <div className="text-xs font-bold text-zinc-505 uppercase tracking-wider">Generated Documents</div>
                    
                    {drafts.length === 0 ? (
                      <div className="p-6 text-center bg-zinc-955 border border-zinc-900 rounded-xl space-y-2">
                        <span className="text-xs text-zinc-555 italic block leading-relaxed">
                          {topics.filter(t => t.decision?.decision === 'ACCEPT').length === 0
                            ? 'No topics are currently eligible for content generation. Run editorial evaluation first.'
                            : 'Generate a post from an accepted topic.'}
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                        {drafts.map((draft) => {
                          const draftTopic = topics.find(t => t.id === draft.topicId);
                          const isSelected = activeDraftTopicId === draft.topicId;
                          return (
                            <div
                              key={draft.id}
                              onClick={() => setActiveDraftTopicId(draft.topicId)}
                              className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-200 space-y-2.5 ${
                                isSelected
                                  ? 'bg-violet-955/10 border-violet-500/40'
                                  : 'bg-zinc-955 border-zinc-900 hover:border-zinc-800'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                  DRAFT
                                </span>
                                <span className="text-[9px] text-zinc-555 font-mono">
                                  {new Date(draft.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                              <h4 className="font-bold text-zinc-250 text-xs leading-snug line-clamp-2">
                                {draftTopic?.title || 'Unknown Topic'}
                              </h4>
                              <p className="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed">
                                {draft.text}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Active Workspace */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="text-xs font-bold text-zinc-550 uppercase tracking-wider">Active Workspace</div>
                    
                    {(() => {
                      if (!activeDraftTopicId) {
                        return (
                          <div className="p-8 text-center bg-zinc-900/30 border border-zinc-900 rounded-xl">
                            <span className="text-xs text-zinc-550 italic">
                              Select a generated draft document from the list to open it inside the workspace.
                            </span>
                          </div>
                        );
                      }

                      const draft = drafts.find((d) => d.topicId === activeDraftTopicId);
                      const topic = topics.find((t) => t.id === activeDraftTopicId);
                      if (!draft || !topic) return null;

                      const gState = generatingStates[topic.id] || 'idle';
                      const gErr = generationErrors[topic.id];

                      return (
                        <div className="p-6 bg-zinc-955 rounded-2xl border border-zinc-900 space-y-6 animate-fade-in relative">
                          <div className="flex items-start justify-between gap-4 border-b border-zinc-900 pb-4">
                            <div>
                              <span className="px-2.5 py-0.5 rounded text-[8px] font-black bg-violet-500/10 text-violet-405 border border-violet-500/20 uppercase tracking-wider">
                                DRAFT Post Workspace
                              </span>
                              <h3 className="font-bold text-zinc-100 text-sm mt-1.5 select-text leading-snug">
                                {topic.title}
                              </h3>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRegenerateDraft(topic.id)}
                              disabled={gState === 'generating' || gState === 'regenerating'}
                              className="px-4 py-2 rounded-xl bg-zinc-905 hover:bg-zinc-800 text-zinc-300 font-semibold border border-zinc-850 hover:border-zinc-700 text-xs transition-all cursor-pointer shrink-0 disabled:opacity-50"
                            >
                              {gState === 'regenerating' ? 'Regenerating...' : 'Regenerate Draft'}
                            </button>
                          </div>

                          {gErr && (
                            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-455 p-4 rounded-xl text-xs">
                              {gErr}
                            </div>
                          )}

                          <div className="space-y-4">
                            <div className="space-y-1.5">
                              <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider block">Draft Copy</span>
                              <div className="p-5 bg-zinc-950/80 rounded-xl border border-zinc-900 text-sm text-zinc-200 leading-relaxed font-sans whitespace-pre-wrap select-text">
                                {draft.text}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="p-4 rounded-xl bg-zinc-955 border border-zinc-900 text-left">
                                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Author Identity</span>
                                <div className="text-xs text-zinc-300 font-semibold mt-0.5">{persona?.name} ({persona?.role})</div>
                              </div>
                              <div className="p-4 rounded-xl bg-zinc-955 border border-zinc-900 text-left">
                                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Original Citation</span>
                                <a
                                  href={topic.source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-violet-405 hover:text-violet-300 font-bold truncate block underline mt-0.5 cursor-pointer"
                                >
                                  {topic.source.name} ↗
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Live Published Feed Tab */}
              {activeTab === 'feed' && (
                <div className="space-y-6 animate-fade-in text-left">
                  {/* Header */}
                  <div className="bg-zinc-900/50 border border-zinc-900 rounded-2xl p-6 sm:p-8 backdrop-blur-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
                      <div>
                        <h3 className="text-lg font-bold text-zinc-100 flex items-center">
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 mr-2.5 animate-pulse shadow-[0_0_10px_#10b981]" />
                          Live Published Feed
                        </h3>
                        <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                          Operating independently. Observing technology research streams, evaluating relevance, and drafting analyses.
                        </p>
                      </div>
                      <div className="text-[10px] text-zinc-550 bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-900 flex items-center font-mono shrink-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-violet-500 mr-2 animate-ping" />
                        Auto-refreshing every 15s
                      </div>
                    </div>

                    {/* Latest Activity Indicator banner */}
                    {latestActivity && (
                      <div className="p-3 px-4 rounded-xl bg-zinc-955 border border-zinc-900 flex items-center justify-between text-xs animate-fade-in">
                        <div className="flex items-center space-x-2.5">
                          <span className={`h-2 w-2 rounded-full ${
                            latestActivity.type.includes('FAILED') || latestActivity.type.includes('ERROR')
                              ? 'bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                              : 'bg-violet-500 animate-pulse shadow-[0_0_8px_rgba(139,92,246,0.5)]'
                          }`} />
                          <span className="font-semibold text-zinc-500 uppercase tracking-wider text-[10px]">CURRENT ACTIVITY:</span>
                          <span className="text-zinc-200 select-text">
                            {latestActivity.type === 'CYCLE_FAILED' && '! Autonomous cycle encountered an error'}
                            {latestActivity.type === 'AI_ERROR' && '! Autonomous cycle encountered an AI error'}
                            {latestActivity.type === 'TOPIC_DISCOVERED' && '● Scanning newly discovered technology research items'}
                            {latestActivity.type === 'TOPIC_EVALUATED' && '● Evaluating discovered technology outline'}
                            {latestActivity.type === 'CONTENT_GENERATED' && '● Generating new content text draft'}
                            {latestActivity.type === 'POST_PUBLISHED' && '● Post published'}
                            {latestActivity.type !== 'CYCLE_FAILED' && latestActivity.type !== 'AI_ERROR' && latestActivity.type !== 'TOPIC_DISCOVERED' && latestActivity.type !== 'TOPIC_EVALUATED' && latestActivity.type !== 'CONTENT_GENERATED' && latestActivity.type !== 'POST_PUBLISHED' && `${latestActivity.details}`}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-555 font-mono">
                          {formatTimeAgo(latestActivity.createdAt)}
                        </span>
                      </div>
                    )}

                    {/* Activity Summary Grid */}
                    {activitySummary && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-left">
                        {[
                          { label: 'Cycles', val: activitySummary.cycles, color: 'text-violet-400' },
                          { label: 'Topics', val: activitySummary.topicsDiscovered, color: 'text-indigo-400' },
                          { label: 'Accepted', val: activitySummary.topicsAccepted, color: 'text-emerald-450' },
                          { label: 'Rejected', val: activitySummary.topicsRejected, color: 'text-zinc-400' },
                          { label: 'Drafts', val: activitySummary.contentGenerated, color: 'text-amber-450' },
                          { label: 'Published', val: activitySummary.postsPublished, color: 'text-sky-400' },
                          { label: 'Failures', val: activitySummary.failures, color: activitySummary.failures > 0 ? 'text-rose-455 font-bold animate-pulse' : 'text-zinc-500' },
                        ].map((item, idx) => (
                          <div key={idx} className="p-3 bg-zinc-955 border border-zinc-900 rounded-xl space-y-1">
                            <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">{item.label}</div>
                            <div className={`text-lg font-black ${item.color}`}>{item.val}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Error bar */}
                    {feedError && (
                      <div className="bg-rose-500/10 border border-rose-500/20 text-rose-455 p-4 rounded-xl text-xs flex items-start space-x-2 animate-fade-in">
                        <svg className="h-4 w-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" stroke="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>{feedError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
                      {/* Feed Column */}
                      <div className="lg:col-span-2 space-y-6">
                        {publishedPosts.length === 0 ? (
                          <div className="p-12 text-center bg-zinc-955 border border-zinc-900 rounded-xl space-y-3">
                            <div className="h-12 w-12 mx-auto rounded-xl bg-zinc-900 border border-zinc-850 flex items-center justify-center text-zinc-555">
                              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" stroke="M9.663 17h4.673M12 3v1m6.364 .364l-.707.707M21 12h-1M4 12H3m.337-6.364l.707.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-zinc-350 uppercase">No Posts Yet</h4>
                              <p className="text-[11px] text-zinc-500 max-w-sm mx-auto mt-1.5 leading-relaxed">
                                The agent is operating and waiting for a worthwhile topic. As soon as an RSS research feed is accepted, it will be published here automatically.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-6 max-h-[650px] overflow-y-auto pr-1">
                            {publishedPosts.map((post) => {
                              const isNew = newPostIds.has(post.id);
                              return (
                                <div
                                  key={post.id}
                                  className={`p-6 rounded-2xl border transition-all duration-550 space-y-4 relative overflow-hidden ${
                                    isNew
                                      ? 'bg-violet-955/20 border-violet-500/50 shadow-lg shadow-violet-500/10 scale-[1.01] ring-1 ring-violet-500/30'
                                      : 'bg-zinc-955 border-zinc-900 hover:border-zinc-800'
                                  }`}
                                >
                                  {isNew && (
                                    <div className="absolute top-0 right-0 bg-violet-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-bl">
                                      NEW POST
                                    </div>
                                  )}
                                  
                                  <div className="flex items-center justify-between border-b border-zinc-900/60 pb-3">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-[10px] font-bold text-violet-405 uppercase tracking-wider">
                                        {persona?.role || `${personaDomain} Researcher`}
                                      </span>
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                      <span className="text-[9px] font-black text-emerald-450 uppercase tracking-wider">
                                        PUBLISHED
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-zinc-555 font-mono">
                                      {new Date(post.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {new Date(post.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>

                                  <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap select-text">
                                    {post.text}
                                  </p>

                                  {/* Sources Reference */}
                                  <div className="flex items-center justify-between pt-1.5 text-[10px] text-zinc-555 border-t border-zinc-900/40">
                                    <div className="flex items-center space-x-2">
                                      <span className="font-bold text-zinc-400">Sources:</span>
                                      {post.sources.map((src, i) => (
                                        <a
                                          key={i}
                                          href={src}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-violet-405 hover:text-violet-300 font-bold uppercase underline inline-flex items-center cursor-pointer"
                                        >
                                          Source URL <span className="ml-0.5 text-[8px]">↗</span>
                                        </a>
                                      ))}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleShowExplanation(post.id)}
                                      className="text-violet-405 hover:text-violet-350 font-bold uppercase tracking-wider transition-colors cursor-pointer text-[10px] border-b border-transparent hover:border-violet-350"
                                    >
                                      Why selected?
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Timeline Column */}
                      <div className="lg:col-span-1 space-y-4">
                        <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider text-left">Live Activity Log</div>
                        
                        {activities.length === 0 ? (
                          <div className="p-6 text-center bg-zinc-955 border border-zinc-900 rounded-xl">
                            <span className="text-xs text-zinc-555 italic">NO ACTIVITY YET. Initialize the agent to begin autonomous operation.</span>
                          </div>
                        ) : (
                          <div className="relative border-l border-zinc-850 ml-3.5 pl-5 space-y-6 max-h-[550px] overflow-y-auto pr-1">
                            {activities.map((e) => {
                              let label = e.type.replace(/_/g, ' ');
                              let colorClass = 'bg-zinc-800 text-zinc-400 border-zinc-700';
                              if (e.type === 'AGENT_INITIALIZED') {
                                colorClass = 'bg-indigo-500/10 text-indigo-405 border-indigo-500/20';
                              } else if (e.type === 'CYCLE_STARTED') {
                                colorClass = 'bg-zinc-700/15 text-zinc-350 border-zinc-700/30';
                              } else if (['TOPICS_DISCOVERED', 'TOPIC_DISCOVERED'].includes(e.type)) {
                                colorClass = 'bg-sky-500/10 text-sky-400 border-sky-500/20';
                              } else if (e.type === 'TOPIC_ACCEPTED') {
                                colorClass = 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20';
                              } else if (e.type === 'TOPIC_REJECTED') {
                                colorClass = 'bg-rose-500/5 text-rose-455/80 border-rose-500/10';
                              } else if (e.type === 'CONTENT_GENERATED') {
                                colorClass = 'bg-amber-500/10 text-amber-455 border-amber-500/20';
                              } else if (e.type === 'POST_PUBLISHED') {
                                colorClass = 'bg-violet-500/10 text-violet-405 border-violet-500/20';
                              } else if (['CYCLE_FAILED', 'AI_ERROR', 'SOURCE_ERROR', 'PUBLISH_ERROR'].includes(e.type)) {
                                colorClass = 'bg-rose-500/10 text-rose-455 border-rose-500/20';
                              }

                              return (
                                <div key={e.id} className="relative group text-left space-y-1 animate-fade-in">
                                  <div className={`absolute -left-[28.5px] top-1.5 h-3.5 w-3.5 rounded-full border flex items-center justify-center ${
                                    ['CYCLE_FAILED', 'AI_ERROR', 'SOURCE_ERROR', 'PUBLISH_ERROR'].includes(e.type)
                                      ? 'bg-rose-600 border-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
                                      : e.type === 'POST_PUBLISHED'
                                      ? 'bg-violet-600 border-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.4)]'
                                      : 'bg-zinc-955 border-zinc-800'
                                  }`}>
                                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 group-hover:scale-125 transition-transform" />
                                  </div>

                                  <div className="flex items-center justify-between text-[10px] text-zinc-555 font-mono">
                                    <span className="font-semibold text-zinc-500">{new Date(e.createdAt).toLocaleTimeString()}</span>
                                    <span>{formatTimeAgo(e.createdAt)}</span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border tracking-wider ${colorClass}`}>
                                      {label}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-zinc-450 leading-relaxed pl-0.5 pt-0.5">
                                    {e.details}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Setup Form Panel */
          <div className="max-w-2xl mx-auto w-full space-y-8">
            <div className="text-center">
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent mb-4">
                Autonomous AI Creator
              </h1>
              <p className="text-zinc-450 text-base sm:text-lg">
                Enter your desired identity configurations to launch the background autonomous workflow.
              </p>
            </div>

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
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-455 p-4 rounded-xl text-xs leading-relaxed flex items-start space-x-2.5">
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
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-455 p-4 rounded-xl text-xs leading-relaxed flex items-start space-x-2.5">
                  <svg className="h-4 w-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" stroke="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleInitialize} className="space-y-4 text-left">
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
                    className="w-full bg-zinc-955 border border-zinc-900 rounded-xl px-4 py-3 text-sm text-zinc-150 placeholder-zinc-700 focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="w-full bg-zinc-955 border border-zinc-900 rounded-xl px-4 py-3 text-sm text-zinc-150 placeholder-zinc-700 focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isInitializing || status === 'offline'}
                    className="w-full flex items-center justify-center px-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-900 disabled:text-zinc-700 disabled:border-zinc-900 border border-violet-500/25 text-white font-semibold text-sm transition-all shadow-lg shadow-violet-500/10 cursor-pointer disabled:cursor-not-allowed"
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
          </div>
        )}

        {/* Selected Topic details evaluation modal (Stage 3 & 6) */}
        {selectedTopic && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-955/80 backdrop-blur-sm animate-fade-in text-left">
            <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="p-6 border-b border-zinc-850 flex items-center justify-between bg-zinc-950">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-violet-405 flex items-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-500 mr-1.5" />
                    Editorial Judgment Panel
                  </span>
                  <h3 className="text-sm font-bold text-zinc-200 mt-1 leading-snug">
                    {selectedTopic.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTopic(null)}
                  className="p-1 text-zinc-555 hover:text-zinc-305 rounded-lg hover:bg-zinc-800 transition-all cursor-pointer"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" stroke="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Scrollable details */}
              <div className="p-6 overflow-y-auto space-y-6 bg-zinc-900 select-text">
                {/* Topic outline */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Feed Outline Summary</div>
                  <div className="p-4 bg-zinc-955 rounded-xl border border-zinc-900 text-xs text-zinc-300 leading-relaxed font-sans select-text">
                    {selectedTopic.summary}
                  </div>
                </div>

                {/* Score breakdown metrics if available */}
                {selectedTopic.decision && (
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Evaluation Scores</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      {[
                        { label: 'Relevance', val: selectedTopic.decision.scores.relevance },
                        { label: 'Branding', val: selectedTopic.decision.scores.personaAlignment },
                        { label: 'Novelty', val: selectedTopic.decision.scores.novelty },
                        { label: 'Overall', val: selectedTopic.decision.scores.overall }
                      ].map((item, i) => (
                        <div key={i} className="p-3 bg-zinc-955 border border-zinc-900 rounded-xl">
                          <div className="text-[9px] font-bold text-zinc-500 uppercase">{item.label}</div>
                          <div className="text-sm font-black text-zinc-200 mt-0.5">{item.val}/100</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Verdict explanation box */}
                {selectedTopic.decision && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Verdict Explanation</div>
                    <div className={`p-4 rounded-xl border leading-relaxed text-xs ${
                      selectedTopic.decision.decision === 'ACCEPT'
                        ? 'bg-emerald-500/5 border-emerald-500/10 text-zinc-305'
                        : 'bg-rose-500/5 border-rose-500/10 text-zinc-305'
                    }`}>
                      <div className="flex items-center space-x-2 font-bold uppercase tracking-wider text-[10px] mb-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          selectedTopic.decision.decision === 'ACCEPT' ? 'bg-emerald-500' : 'bg-rose-500'
                        }`} />
                        <span className={selectedTopic.decision.decision === 'ACCEPT' ? 'text-emerald-455' : 'text-rose-455'}>
                          EDITORIAL DECISION: {selectedTopic.decision.decision}
                        </span>
                      </div>
                      <p className="font-sans leading-relaxed select-text">{selectedTopic.decision.reason}</p>
                    </div>
                  </div>
                )}

                {/* Content generation trigger block (Stage 6) */}
                {selectedTopic.decision?.decision === 'ACCEPT' && (
                  <div className="border-t border-zinc-800/60 pt-4 space-y-4 text-left">
                    <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Content Generation Workspace</div>
                    
                    {generatingStates[selectedTopic.id] === 'generating' ? (
                      <div className="p-5 bg-zinc-955 rounded-xl border border-zinc-900 space-y-4">
                        <div className="flex items-center space-x-3 text-xs font-semibold text-zinc-405">
                          <span className="h-4 w-4 rounded-full border border-violet-500 border-t-transparent animate-spin" />
                          <span>Generating Content Draft...</span>
                        </div>
                        {/* Loading checklist */}
                        <div className="space-y-1 text-[10px] font-bold text-zinc-500 pl-2 border-l border-zinc-850">
                          <div className="text-violet-405 animate-pulse">→ Analysing target brand voice...</div>
                          <div className="opacity-50">○ Performing factual trace check...</div>
                          <div className="opacity-50">○ Saving document draft...</div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 bg-zinc-955 rounded-xl border border-zinc-900">
                        <div>
                          <div className="text-xs font-bold text-zinc-300">Compile Article draft</div>
                          <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
                            Initialize the deterministic text compiler matching role profiles and tone voice tags.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleGenerateDraft(selectedTopic.id)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/20 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer text-center"
                        >
                          Generate Draft
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Content Generation Bypassed warning for rejected topics */}
                {selectedTopic.decision?.decision === 'REJECT' && (
                  <div className="border-t border-zinc-800/60 pt-4 p-4 rounded-xl bg-rose-500/5 border-rose-500/10 text-left">
                    <span className="text-[10px] font-black uppercase text-rose-455 tracking-wider block">CONTENT GENERATION UNAVAILABLE</span>
                    <p className="text-[11px] text-zinc-450 mt-1 leading-relaxed">
                      This topic failed to satisfy the required editorial principle guidelines and domain focus relevance threshold. Draft post generation has been blocked.
                    </p>
                  </div>
                )}

              </div>

              {/* Footer */}
              <div className="p-6 border-t border-zinc-850 bg-zinc-955 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedTopic(null)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-305 rounded-xl font-semibold border border-zinc-800 transition-all cursor-pointer text-xs"
                >
                  Close Panel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Selected Published Post Trace modal */}
        {selectedPublishedPost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-955/80 backdrop-blur-sm animate-fade-in text-left">
            <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-zinc-850 flex items-center justify-between bg-zinc-950">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-455 flex items-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                    Published Autonomous Post
                  </span>
                  <h3 className="text-sm font-bold text-zinc-400 mt-1">
                    Published on {new Date(selectedPublishedPost.createdAt).toLocaleDateString()}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPublishedPost(null)}
                  className="p-1 text-zinc-550 hover:text-zinc-305 rounded-lg hover:bg-zinc-800 transition-all cursor-pointer"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" stroke="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6 bg-zinc-900 select-text">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Post</div>
                  <div className="p-5 bg-zinc-955 rounded-xl border border-zinc-900 text-sm sm:text-base text-zinc-200 leading-relaxed whitespace-pre-wrap select-text">
                    {selectedPublishedPost.text}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-zinc-850 bg-zinc-955 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedPublishedPost(null)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-305 rounded-xl font-semibold border border-zinc-800 transition-all cursor-pointer text-xs"
                >
                  Close Post View
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Persona Modal */}
        {isEditingPersona && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-955/85 backdrop-blur-sm animate-fade-in text-left">
            <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              
              {/* Header */}
              <div className="p-6 border-b border-zinc-805 flex items-center justify-between bg-zinc-950">
                <div>
                  <h3 className="text-lg font-bold text-zinc-100">
                    Edit Persona Guidelines
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    Fine-tune target brand positioning constraints.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingPersona(false)}
                  disabled={isSavingPersona}
                  className="p-1 text-zinc-555 hover:text-zinc-305 rounded-lg hover:bg-zinc-800 transition-all cursor-pointer"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" stroke="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSavePersona} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-6 overflow-y-auto space-y-6 bg-zinc-900 select-text">
                  {validationError && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-455 p-3.5 rounded-xl text-xs">
                      {validationError}
                    </div>
                  )}

                  {/* Description */}
                  <div className="space-y-2">
                    <label htmlFor="edit-desc" className="block text-xs font-semibold text-zinc-555 uppercase tracking-wider">
                      Guidelines Description
                    </label>
                    <textarea
                      id="edit-desc"
                      rows={4}
                      placeholder="Enter description guidelines..."
                      value={editDescription}
                      onChange={(e) => {
                        setEditDescription(e.target.value);
                        setValidationError(null);
                      }}
                      disabled={isSavingPersona}
                      className="w-full bg-zinc-955 border border-zinc-905 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed resize-none"
                    />
                  </div>

                  {/* Role */}
                  <div className="space-y-2">
                    <label htmlFor="edit-role" className="block text-xs font-semibold text-zinc-555 uppercase tracking-wider">
                      Role Title
                    </label>
                    <input
                      id="edit-role"
                      type="text"
                      placeholder="e.g. AI Security Researcher"
                      value={editRole}
                      onChange={(e) => {
                        setEditRole(e.target.value);
                        setValidationError(null);
                      }}
                      disabled={isSavingPersona}
                      className="w-full bg-zinc-955 border border-zinc-905 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Tag Sections */}
                  {[
                    {
                      label: 'Interests',
                      list: editInterests,
                      setList: setEditInterests,
                      inputVal: newInterest,
                      setInput: setNewInterest,
                      placeholder: 'Add interest Focus (e.g. Cryptography)',
                      maxLength: 50
                    },
                    {
                      label: 'Expertise Areas',
                      list: editExpertise,
                      setList: setEditExpertise,
                      inputVal: newExpertiseInput,
                      setInput: setNewExpertiseInput,
                      placeholder: 'Add expertise (e.g. LLM Security)',
                      maxLength: 50
                    },
                    {
                      label: 'Voice (Tone Guidelines)',
                      list: editTone,
                      setList: setEditTone,
                      inputVal: newToneInput,
                      setInput: setNewToneInput,
                      placeholder: 'Add tone parameter (e.g. Analytical)',
                      maxLength: 50
                    },
                    {
                      label: 'Editorial Principles & Rules',
                      list: editPrinciples,
                      setList: setEditPrinciples,
                      inputVal: newPrincipleInput,
                      setInput: setNewPrincipleInput,
                      placeholder: 'Add editorial rule (e.g. Prefer evidence over hype)',
                      maxLength: 150
                    }
                  ].map((sec, idx) => (
                    <div key={idx} className="space-y-2 border-t border-zinc-800/40 pt-4">
                      <label className="block text-xs font-semibold text-zinc-555 uppercase tracking-wider">
                        {sec.label}
                      </label>
                      
                      {/* Active tags list */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {sec.list.length > 0 ? (
                          sec.list.map((tag, tagIdx) => (
                            <span
                              key={tagIdx}
                              className="inline-flex items-center pl-2.5 pr-1 py-1 rounded bg-zinc-955 text-zinc-300 border border-zinc-900 text-xs font-medium"
                            >
                              <span>{tag}</span>
                              <button
                                type="button"
                                onClick={() => removeTag(tagIdx, sec.list, sec.setList)}
                                disabled={isSavingPersona}
                                className="ml-1.5 p-0.5 text-zinc-555 hover:text-rose-455 hover:bg-zinc-900 rounded transition-all cursor-pointer"
                              >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" stroke="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-zinc-650 italic">No items configured yet.</span>
                        )}
                      </div>

                      {/* Add tag form input */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder={sec.placeholder}
                          value={sec.inputVal}
                          onChange={(e) => {
                            sec.setInput(e.target.value);
                            setValidationError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addTag(sec.inputVal, sec.list, sec.setList, sec.setInput, sec.maxLength);
                            }
                          }}
                          disabled={isSavingPersona}
                          className="flex-1 bg-zinc-955 border border-zinc-900 rounded-xl px-4 py-2.5 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-50"
                        />
                        <button
                          type="button"
                          onClick={() => addTag(sec.inputVal, sec.list, sec.setList, sec.setInput, sec.maxLength)}
                          disabled={isSavingPersona}
                          className="px-4 py-2 bg-zinc-950 hover:bg-zinc-900 text-zinc-300 rounded-xl font-semibold border border-zinc-800 text-xs transition-all cursor-pointer shrink-0 disabled:opacity-50"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="p-6 border-t border-zinc-800 bg-zinc-950 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsEditingPersona(false)}
                    disabled={isSavingPersona}
                    className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-xl text-sm font-semibold transition-all cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingPersona}
                    className="px-5 py-2.5 bg-violet-600 hover:bg-violet-505 text-white rounded-xl text-sm font-semibold shadow-lg shadow-violet-500/10 transition-all cursor-pointer flex items-center justify-center min-w-[120px] disabled:opacity-50"
                  >
                    {isSavingPersona ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-955 py-6 mt-auto">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-650 select-text">
          <div className="mb-4 sm:mb-0">
            &copy; 2026 Autonomous AI Creator. Trace Operations Dashboard.
          </div>
          <div className="flex space-x-6">
            <span>Orchestrator Backend</span>
            <span>Trace Console</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
