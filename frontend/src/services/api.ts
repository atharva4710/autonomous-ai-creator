const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export interface HealthResponse {
  status: string;
}

/**
 * Checks the health status of the backend API.
 * Calls GET /health and returns the parsed JSON response.
 */
export async function checkHealth(): Promise<HealthResponse> {
  // Trim trailing slash from BASE_URL if present to avoid double slash
  const baseUrlClean = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const response = await fetch(`${baseUrlClean}/health`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP health check failed with status: ${response.status}`);
  }

  return response.json();
}

export interface InitAgentResponse {
  agentId: string;
}

export interface PersonaData {
  name: string;
  domain: string;
  role?: string;
  description?: string;
  interests?: string[];
  expertise?: string[];
  tone?: string[];
  editorialPrinciples?: string[];
}

/**
 * Initializes a new AI agent with the given persona.
 * Calls POST /api/agent/init and returns the unique agentId.
 */
export async function initAgent(persona: PersonaData): Promise<InitAgentResponse> {
  const baseUrlClean = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const response = await fetch(`${baseUrlClean}/api/agent/init`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ persona }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `Failed to initialize agent: status ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}

export interface DiscoverResponse {
  discovered: number;
}

export interface TopicsResponse {
  topics: DiscoveredTopic[];
}

/**
 * Triggers the Live Topic Discovery cycle for an agent.
 * Calls POST /api/agent/discover
 */
export async function discoverTopics(agentId: string): Promise<DiscoverResponse> {
  const baseUrlClean = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const response = await fetch(`${baseUrlClean}/api/agent/discover`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ agentId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `Failed to trigger discovery: status ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}

/**
 * Retrieves the discovered topics for an agent.
 * Calls GET /api/agent/topics?agentId=...
 */
export async function fetchTopics(agentId: string): Promise<TopicsResponse> {
  const baseUrlClean = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const response = await fetch(`${baseUrlClean}/api/agent/topics?agentId=${encodeURIComponent(agentId)}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `Failed to fetch topics: status ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}

export interface DecisionScores {
  relevance: number;
  personaAlignment: number;
  timeliness: number;
  importance: number;
  novelty: number;
  sourceQuality: number;
  overall: number;
}

export interface EditorialDecision {
  id: string;
  topicId: string;
  decision: 'ACCEPT' | 'REJECT';
  scores: DecisionScores;
  reason: string;
  evaluatedAt: string;
}

export interface DiscoveredTopic {
  id: string;
  agentId: string;
  title: string;
  summary: string;
  source: {
    name: string;
    url: string;
  };
  publishedAt: string;
  discoveredAt: string;
  decision?: EditorialDecision;
}

export interface AgentPersona {
  name: string;
  role: string;
  domain: string;
  description: string;
  interests: string[];
  expertise: string[];
  tone: string[];
  editorialPrinciples: string[];
}

export interface PersonaResponse {
  persona: AgentPersona;
}

/**
 * Retrieves the AI agent's persona.
 * Calls GET /api/agent/persona?agentId=...
 */
export async function getPersona(agentId: string): Promise<PersonaResponse> {
  const baseUrlClean = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const response = await fetch(`${baseUrlClean}/api/agent/persona?agentId=${encodeURIComponent(agentId)}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `Failed to fetch persona: status ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}

/**
 * Updates the AI agent's persona.
 * Calls PATCH /api/agent/persona
 */
export async function updatePersona(
  agentId: string,
  persona: Partial<AgentPersona>
): Promise<PersonaResponse> {
  const baseUrlClean = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const response = await fetch(`${baseUrlClean}/api/agent/persona`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      agentId,
      persona,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `Failed to update persona: status ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}

export interface MemoryItem {
  id: string;
  type: 'DISCOVERED_TOPIC' | 'EVALUATED_TOPIC' | 'ACCEPTED_TOPIC' | 'REJECTED_TOPIC' | 'PUBLISHED_POST';
  topicId: string;
  title: string;
  decision?: 'ACCEPT' | 'REJECT';
  score?: number;
  createdAt: string;
}

export interface MemoryListResponse {
  memories: MemoryItem[];
}

export interface MemoryCheckResponse {
  memory: {
    isKnown: boolean;
    matchType?: 'NORMALIZED_TITLE';
    matchedMemoryId?: string;
  };
}

export interface MemorySummary {
  totalMemories: number;
  topicsDiscovered: number;
  topicsEvaluated: number;
  acceptedTopics: number;
  rejectedTopics: number;
  publishedPosts: number;
}

export interface MemorySummaryResponse {
  summary: MemorySummary;
}

/**
 * Retrieves the AI agent's memories.
 * Calls GET /api/agent/memory?agentId=...
 */
export async function getMemory(agentId: string): Promise<MemoryListResponse> {
  const baseUrlClean = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const response = await fetch(`${baseUrlClean}/api/agent/memory?agentId=${encodeURIComponent(agentId)}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `Failed to fetch memory: status ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}

/**
 * Checks if a topic has been encountered before.
 * Calls POST /api/agent/memory/check
 */
export async function checkTopicMemory(
  agentId: string,
  topicId: string
): Promise<MemoryCheckResponse> {
  const baseUrlClean = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const response = await fetch(`${baseUrlClean}/api/agent/memory/check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      agentId,
      topicId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `Failed to check topic memory: status ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}

/**
 * Retrieves the AI agent's memory summary stats.
 * Calls GET /api/agent/memory/summary?agentId=...
 */
export async function getMemorySummary(agentId: string): Promise<MemorySummaryResponse> {
  const baseUrlClean = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const response = await fetch(`${baseUrlClean}/api/agent/memory/summary?agentId=${encodeURIComponent(agentId)}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `Failed to fetch memory summary: status ${response.status}`;
    throw new Error(message);
  }
  return response.json();
}

export interface PostItem {
  id: string;
  agentId: string;
  topicId: string;
  decisionId: string;
  status: 'DRAFT' | 'VALIDATED' | 'PUBLISHED' | 'FAILED';
  text: string;
  createdAt: string;
  content?: {
    blog: {
      title: string;
      text: string;
    };
    linkedin: {
      text: string;
    };
    x: {
      text: string;
    };
  };
  selectedFormat?: 'blog' | 'linkedin' | 'x';
}

export interface PostResponse {
  post: PostItem;
}

export interface PostsResponse {
  posts: PostItem[];
}

/**
 * Request content generation for an accepted topic.
 */
export async function generateContent(agentId: string, topicId: string): Promise<PostResponse> {
  const baseUrlClean = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const response = await fetch(`${baseUrlClean}/api/agent/content/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ agentId, topicId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `Failed to generate content: status ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}

/**
 * Request content regeneration.
 */
export async function regenerateContent(agentId: string, topicId: string): Promise<PostResponse> {
  const baseUrlClean = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const response = await fetch(`${baseUrlClean}/api/agent/content/regenerate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ agentId, topicId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `Failed to regenerate content: status ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}

/**
 * Request format selection for content draft.
 */
export async function selectFormat(
  agentId: string,
  topicId: string,
  format: 'blog' | 'linkedin' | 'x'
): Promise<PostResponse> {
  const baseUrlClean = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const response = await fetch(`${baseUrlClean}/api/agent/content/select-format`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ agentId, topicId, format }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `Failed to select format: status ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}

/**
 * Request post publishing for a draft.
 */
export async function publishPostApi(agentId: string, topicId: string): Promise<PostResponse> {
  const baseUrlClean = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const response = await fetch(`${baseUrlClean}/api/agent/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ agentId, topicId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `Failed to publish post: status ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}

/**
 * Fetch all generated posts.
 */
export async function getGeneratedContent(agentId: string): Promise<PostsResponse> {
  const baseUrlClean = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const response = await fetch(`${baseUrlClean}/api/agent/content?agentId=${encodeURIComponent(agentId)}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `Failed to fetch generated content: status ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}

/**
 * Fetch single generated draft.
 */
export async function getContent(postId: string, agentId: string): Promise<PostResponse> {
  const baseUrlClean = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const response = await fetch(`${baseUrlClean}/api/agent/content/${encodeURIComponent(postId)}?agentId=${encodeURIComponent(agentId)}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `Failed to fetch single content: status ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}

export interface PublishedPost {
  id: string;
  createdAt: string;
  text: string;
  rationale: string;
  sources: string[];
  content?: {
    blog: {
      title: string;
      text: string;
    };
    linkedin: {
      text: string;
    };
    x: {
      text: string;
    };
  };
  selectedFormat?: 'blog' | 'linkedin' | 'x';
}

export interface FeedResponse {
  posts: PublishedPost[];
}

export interface AgentStatusInfo {
  id: string;
  status: 'RUNNING' | 'INITIALIZED' | 'PAUSED' | 'STOPPED' | 'ERROR' | 'DEGRADED' | 'IDLE';
  persona?: AgentPersona;
  createdAt?: string;
  lastCycleAt?: string | null;
  lastPublishedAt?: string | null;
  nextCycleAt?: string | null;
  nextPublishAt?: string | null;
  intervalMinutes?: number;
  currentStage?: string;
  lastActivityType?: string | null;
  latestPublishedPost?: {
    id: string;
    title: string;
    publishedAt: string;
  } | null;
}

export interface AgentStatusResponse {
  agent: AgentStatusInfo;
}

/**
 * Fetch autonomous agent cycle details and status.
 */
export async function getAgentStatus(agentId: string): Promise<AgentStatusResponse> {
  const baseUrlClean = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const response = await fetch(`${baseUrlClean}/api/agent/status?agentId=${encodeURIComponent(agentId)}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `Failed to fetch agent status: status ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}

/**
 * Fetch published posts for the live feed.
 */
export async function getFeed(agentId: string): Promise<FeedResponse> {
  const baseUrlClean = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const response = await fetch(`${baseUrlClean}/api/agent/feed?agentId=${encodeURIComponent(agentId)}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `Failed to fetch feed: status ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}

export interface ActivityEvent {
  id: string;
  agentId: string;
  type: string;
  details: string;
  createdAt: string;
}

export interface ActivityListResponse {
  activity: ActivityEvent[];
}

export interface ActivitySummary {
  cycles: number;
  topicsDiscovered: number;
  topicsAccepted: number;
  topicsRejected: number;
  contentGenerated: number;
  postsPublished: number;
  failures: number;
}

export interface ActivitySummaryResponse {
  summary: ActivitySummary;
}

export interface LatestActivityResponse {
  latest: ActivityEvent | null;
}

export interface PostExplanationDecision {
  id?: string;
  topicId?: string;
  decision?: 'ACCEPT' | 'REJECT';
  scores?: DecisionScores;
  reason?: string;
  evaluatedAt?: string;
  selectionRank?: number;
  comparativeAlternatives?: any[];
}

export interface PostExplanation {
  post: PublishedPost;
  topic: DiscoveredTopic;
  decision: PostExplanationDecision | null;
  memory: {
    isKnown: boolean;
    matchType?: string;
  };
}

export interface PostExplanationResponse {
  explanation: PostExplanation;
}

/**
 * Fetch agent activity logs.
 */
export async function getAgentActivity(agentId: string, limit: number = 50): Promise<ActivityListResponse> {
  const baseUrlClean = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const response = await fetch(`${baseUrlClean}/api/agent/activity?agentId=${encodeURIComponent(agentId)}&limit=${limit}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `Failed to fetch activity list: status ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}

/**
 * Fetch activity summary counters.
 */
export async function getActivitySummary(agentId: string): Promise<ActivitySummaryResponse> {
  const baseUrlClean = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const response = await fetch(`${baseUrlClean}/api/agent/activity/summary?agentId=${encodeURIComponent(agentId)}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `Failed to fetch activity summary: status ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}

/**
 * Fetch latest activity event.
 */
export async function getLatestActivity(agentId: string): Promise<LatestActivityResponse> {
  const baseUrlClean = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const response = await fetch(`${baseUrlClean}/api/agent/activity/latest?agentId=${encodeURIComponent(agentId)}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `Failed to fetch latest activity: status ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}

/**
 * Fetch post select explanation and metadata.
 */
export async function getPostExplanation(agentId: string, postId: string): Promise<PostExplanationResponse> {
  const baseUrlClean = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const response = await fetch(`${baseUrlClean}/api/agent/posts/${encodeURIComponent(postId)}/explanation?agentId=${encodeURIComponent(agentId)}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `Failed to fetch post explanation: status ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}



