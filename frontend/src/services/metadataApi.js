const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getToken() { return localStorage.getItem('kerv_token'); }

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` };
}

export async function fetchVideoMetadata(videoId) {
  const res = await fetch(`${API_BASE}/videos/${videoId}/metadata`, { headers: authHeaders() });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
  return res.json();
}

export async function fetchMetadata() {
  const res = await fetch(`${API_BASE}/metadata`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchVideos() {
  const res = await fetch(`${API_BASE}/videos`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// FIX: token in query string so <video src> and EventSource work (can't set headers)
export function videoStreamUrl(videoId) {
  return `${API_BASE}/videos/${videoId}/stream?token=${getToken()}`;
}

export function progressSseUrl(videoId) {
  return `${API_BASE}/videos/${videoId}/progress?token=${getToken()}`;
}

export { API_BASE };
