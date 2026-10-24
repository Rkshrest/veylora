const API = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || (import.meta.env.DEV ? 'http://localhost:4000/api' : null);
async function request(path, options) {
  if (!API) throw new Error('The API URL is not configured for this deployment. Set VITE_API_URL to the backend URL ending in /api.');
  let response;
  try {
    response = await fetch(`${API}${path}`, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
  } catch {
    throw new Error(`Cannot reach the Veylora API at ${API}. Start the backend and make sure MongoDB connects.`);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
export const api = {
  me: () => request('/auth/me'),
  login: body => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  register: body => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  publicImpact: () => request('/public/impact'),
  dashboard: () => request('/dashboard'), donations: () => request('/donations'),
  create: body => request('/donations', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => request(`/donations/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  reserve: (id, body) => request(`/donations/${id}/reservations`, { method: 'POST', body: JSON.stringify(body) }),
  collect: (id, reservationId, actor) => request(`/donations/${id}/reservations/${reservationId}/collect`, { method: 'PATCH', body: JSON.stringify({ actor }) }),
  verify: () => request('/audit/verify')
};
