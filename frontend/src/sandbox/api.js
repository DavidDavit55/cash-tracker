let token = '';
export function setSandboxToken(value) { token = value || ''; }
export async function request(path, { method = 'GET', body, binary = false } = {}) {
  const response = await fetch(`/sandbox-api${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.error || `שגיאת שרת (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return binary ? response.arrayBuffer() : response.json();
}

export async function loadClient(clientId = '') {
  const root = clientId ? `/admin/clients/${encodeURIComponent(clientId)}` : '/client-profile';
  // Failed or missing financial data must never fall back to demo data.
  const financial = await request(`${root}/financial-data`);
  const profileResult = await request(root).then(data => ({ data })).catch(error => ({ error: error.message }));
  return {
    source: 'live',
    pension_data: financial?.pension_data || [], insurance_data: financial?.insurance_data || [],
    har_bituach_data: financial?.har_bituach_data || [], client_info: financial?.client_info || {},
    profile: profileResult.data || {}, warnings: profileResult.error ? ['פרטי הפרופיל לא נטענו'] : [],
    loadedAt: new Date().toISOString(), clientId,
  };
}
