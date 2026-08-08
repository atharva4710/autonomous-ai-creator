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

