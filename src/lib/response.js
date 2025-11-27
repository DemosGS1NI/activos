// Centralized response helpers (internal API formatting)
// All API handlers should use these instead of returning raw objects.

function baseHeaders(extra) {
  return { 'Content-Type': 'application/json', ...extra };
}

export class ResponseError extends Error {
  constructor(response) {
    const status = response?.status ?? 500;
    super(`HTTP ${status}`);
    this.name = 'ResponseError';
    this.response = response;
  }
}

export function success(data = null, meta = {}, status = 200, headers = {}) {
  return new Response(
    JSON.stringify({ success: true, data, meta }),
    { status, headers: baseHeaders(headers) }
  );
}

export function error(code = 'error', message = 'Error', status = 400, details = null, headers = {}) {
  return new Response(
    JSON.stringify({ success: false, error: { code, message, details } }),
    { status, headers: baseHeaders(headers) }
  );
}

export function notImplemented() {
  return error('not_implemented', 'Not implemented', 501);
}

export function unauthorized(message = 'Unauthorized') {
  return error('unauthorized', message, 401);
}

export function forbidden(message = 'Forbidden') {
  return error('forbidden', message, 403);
}

export function notFound(message = 'Not found') {
  return error('not_found', message, 404);
}

export function badRequest(message = 'Bad request', details = null) {
  return error('bad_request', message, 400, details);
}

// Helper to wrap try/catch around handler logic uniformly.
export async function handle(handler) {
  try {
    const result = await handler();
    if (result instanceof Response) return result;
    return success(result);
  } catch (e) {
    return error('internal', e.message || 'Internal error', 500);
  }
}
