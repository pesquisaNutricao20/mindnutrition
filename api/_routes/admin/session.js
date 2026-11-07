import { getAdminSessionSummary } from '../../_lib/admin.js';
import { methodNotAllowed, sendJson } from '../../_lib/http.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, 'GET');
  const session = getAdminSessionSummary(request);
  return sendJson(response, 200, session || { authorized: false });
}
