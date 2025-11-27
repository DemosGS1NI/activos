import { ping, canConnect } from '$lib/db';

export async function GET() {
  try {
    const ok = await canConnect();
    const now = await ping();
    return new Response(JSON.stringify({ ok, now }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}