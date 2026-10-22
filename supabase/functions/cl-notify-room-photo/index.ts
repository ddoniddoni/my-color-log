import { createClient } from 'npm:@supabase/supabase-js@2.110.6';
import { getProjectKey } from '../_shared/environment.ts';

// Compatibility for installed apps. Every send uses the durable DB outbox.
Deno.serve(async (request) => {
  if (request.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 });
  const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
  const url = Deno.env.get('SUPABASE_URL');
  const key = getProjectKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY');
  if (!token || !url || !key) return Response.json({ error: 'authentication_required' }, { status: 401 });
  let photoId: string;
  try {
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || !('photoId' in body) || typeof body.photoId !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.photoId)) {
      return Response.json({ error: 'invalid_request' }, { status: 400 });
    }
    photoId = body.photoId;
  } catch { return Response.json({ error: 'invalid_request' }, { status: 400 }); }
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  try {
    const { data, error: authError } = await client.auth.getUser(token);
    if (authError || !data.user) return Response.json({ error: 'authentication_required' }, { status: 401 });
    const { error } = await client.rpc('cl_enqueue_my_room_photo_push', { p_photo_id: photoId });
    if (error) return Response.json({ error: 'enqueue_failed' }, { status: error.code === '42501' ? 403 : 500 });
    return Response.json({ queued: true });
  } catch { return Response.json({ error: 'enqueue_failed' }, { status: 500 }); }
});
