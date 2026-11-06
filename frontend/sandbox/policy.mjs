// An explicit, fail-closed list. No production data writes or notification APIs.
const reads = [
  /^\/health$/, /^\/auth\/me$/, /^\/client-profile(?:\/financial-data)?$/,
  /^\/admin\/clients$/, /^\/admin\/clients\/[a-zA-Z0-9-]+(?:\/financial-data)?$/,
  /^\/admin\/raw-uploads$/, /^\/admin\/raw-uploads\/[a-zA-Z0-9-]+\/file$/,
  /^\/expenses$/, /^\/expenses\/stats\/summary$/, /^\/incomes$/,
  /^\/incomes\/stats\/summary$/, /^\/budgets$/, /^\/categories$/,
];
export function allowedRequest(method, pathname) {
  if (method === 'GET') return reads.some(pattern => pattern.test(pathname));
  // Only the user-triggered, existing SMS sign-in flow may use POST.
  return method === 'POST' && ['/auth/login/send', '/auth/login/check'].includes(pathname);
}

export function trustedBrowserRequest(headers, port = 5175) {
  if (headers['sec-fetch-site'] === 'cross-site') return false;
  if (!headers.origin) return true;
  return [`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(headers.origin);
}
