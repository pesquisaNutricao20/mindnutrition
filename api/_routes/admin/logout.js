import { clearAdminSessionCookie } from '../../_lib/admin.js';
import { assertSameOrigin, handleApiError, methodNotAllowed, sendJson } from '../../_lib/http.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
  try {
    assertSameOrigin(request);
    clearAdminSessionCookie(request, response);
    return sendJson(response, 200, { authorized: false });
  } catch (error) {
    return handleApiError(response, error);
  }
}
