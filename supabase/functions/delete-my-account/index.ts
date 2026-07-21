import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { deleteAuthIdentity } from './accountDeletionWorkflow.ts';

const ENTRY_PHOTO_BUCKET = 'entry-photos';
const STORAGE_LIST_LIMIT = 1_000;
const STORAGE_REMOVE_CHUNK_SIZE = 100;
const MAX_DIRECTORY_DEPTH = 12;

type StorageListItem = {
  id: string | null;
  name: string;
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const accessToken = getBearerToken(request.headers.get('Authorization'));
  const projectUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = getProjectKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY');
  const secretKey = getProjectKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY');

  if (!accessToken) return jsonResponse({ error: 'authentication_required' }, 401);
  if (!projectUrl || !publishableKey || !secretKey) {
    console.error('account_deletion_configuration_missing');
    return jsonResponse({ error: 'account_deletion_failed' }, 500);
  }

  const userClient = createClient(projectUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const adminClient = createClient(projectUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
  const user = userData.user;
  if (userError || !user) return jsonResponse({ error: 'authentication_required' }, 401);

  try {
    const storagePaths = await getUserStoragePaths(adminClient, user.id);
    await removeStoragePaths(adminClient, storagePaths);

    const { error: roomPreparationError } = await adminClient.rpc('prepare_account_deletion', { p_user_id: user.id });
    if (roomPreparationError) throw new Error('room_preparation_failed');

    await deleteAuthIdentity({
      accessToken,
      adminAuth: adminClient.auth.admin,
      userId: user.id,
    });

    return jsonResponse({ deleted: true }, 200);
  } catch {
    console.error('account_deletion_failed');
    return jsonResponse({ error: 'account_deletion_failed' }, 500);
  }
});

async function getUserStoragePaths(client: SupabaseClient, userId: string): Promise<string[]> {
  const paths: string[] = [];
  await collectStoragePaths(client, userId, paths, 0);
  return paths;
}

async function collectStoragePaths(client: SupabaseClient, folder: string, paths: string[], depth: number): Promise<void> {
  if (depth > MAX_DIRECTORY_DEPTH) throw new Error('storage_path_depth_exceeded');

  for (let offset = 0; ; offset += STORAGE_LIST_LIMIT) {
    const { data, error } = await client.storage.from(ENTRY_PHOTO_BUCKET).list(folder, {
      limit: STORAGE_LIST_LIMIT,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error('storage_list_failed');

    const items = (data ?? []) as StorageListItem[];
    for (const item of items) {
      const path = `${folder}/${item.name}`;
      if (item.id) {
        paths.push(path);
      } else {
        await collectStoragePaths(client, path, paths, depth + 1);
      }
    }

    if (items.length < STORAGE_LIST_LIMIT) return;
  }
}

async function removeStoragePaths(client: SupabaseClient, paths: readonly string[]): Promise<void> {
  const removals: Promise<{ error: unknown | null }>[] = [];
  for (let index = 0; index < paths.length; index += STORAGE_REMOVE_CHUNK_SIZE) {
    removals.push(client.storage.from(ENTRY_PHOTO_BUCKET).remove(paths.slice(index, index + STORAGE_REMOVE_CHUNK_SIZE)));
  }

  const results = await Promise.all(removals);
  if (results.some((result) => result.error)) {
    throw new Error('storage_remove_failed');
  }
}

function getProjectKey(keysEnvironmentName: string, singleKeyEnvironmentName: string, legacyEnvironmentName: string): string | null {
  const keysValue = Deno.env.get(keysEnvironmentName);
  if (keysValue) {
    try {
      const parsed: unknown = JSON.parse(keysValue);
      if (typeof parsed === 'object' && parsed !== null) {
        const defaultKey = (parsed as Record<string, unknown>).default;
        if (typeof defaultKey === 'string' && defaultKey.length > 0) return defaultKey;
      }
    } catch {
      // Fall through to the legacy environment variable during key migrations.
    }
  }

  return Deno.env.get(singleKeyEnvironmentName) ?? Deno.env.get(legacyEnvironmentName) ?? null;
}

function getBearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

function jsonResponse(body: Record<string, boolean | string>, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}
