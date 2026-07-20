const TOKEN_KEY = 'yoshi_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export async function api(path, { method = 'GET', body, formData } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const resp = await fetch(`/api${path}`, {
    method,
    headers,
    body: formData || (body ? JSON.stringify(body) : undefined),
  });
  if (resp.status === 401 && !path.startsWith('/auth/')) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Session expired');
  }
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || `Request failed (${resp.status})`);
  return data;
}

export function downloadUrl(fileId) {
  return `/api/files/${fileId}/download?token=${encodeURIComponent(getToken() || '')}`;
}

/** Opens the SSE stream; returns an unsubscribe function. */
export function openEvents(onEvent) {
  const token = getToken();
  if (!token) return () => {};
  const es = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
  const types = ['task.updated', 'task.event', 'task.message', 'notification', 'approval.requested'];
  for (const type of types) {
    es.addEventListener(type, (e) => {
      let data = {};
      try { data = JSON.parse(e.data); } catch { /* ignore */ }
      onEvent(type, data);
    });
  }
  return () => es.close();
}

export const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString() : '—');
export const fmtSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export const STATUS_LABELS = {
  planning: 'Planning', queued: 'Queued', running: 'Running', paused: 'Paused',
  awaiting_input: 'Needs your input', awaiting_approval: 'Needs approval',
  completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled',
  pending: 'Pending', skipped: 'Skipped',
};
