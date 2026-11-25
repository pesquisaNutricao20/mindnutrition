import { methodNotAllowed, sendJson } from '../_lib/http.js';

export default function handler(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, 'GET');

  return sendJson(response, 200, { ok: true });
}
