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
