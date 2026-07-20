import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

type PhotoRecord = {
  entry_id: string;
  owner_id: string;
  date_key: string;
};

type RoomRecord = {
  name: string;
  status: 'active' | 'draft' | 'ended';
};

type MembershipRecord = {
  joined_at: string;
  user_id: string;
};

type PushDeviceRecord = {
  expo_push_token: string;
};

type ExpoPushTicket = {
  details?: { error?: string };
  status?: string;
};

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const ROOM_ACTIVITY_CHANNEL_ID = 'room-activity';
const KST_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'Asia/Seoul',
  year: 'numeric',
});

Deno.serve(async (request) => {
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const accessToken = getBearerToken(request.headers.get('Authorization'));
  const projectUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = getProjectKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY');
  const secretKey = getProjectKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
  if (!accessToken || !projectUrl || !publishableKey || !secretKey) return jsonResponse({ error: 'configuration_or_authentication_required' }, 401);

  const photoId = await readPhotoId(request);
  if (!photoId) return jsonResponse({ error: 'invalid_request' }, 400);

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
    const photo = await getOwnedPhoto(adminClient, photoId, user.id);
    if (!photo) return jsonResponse({ error: 'photo_not_available' }, 404);

    await notifyRoomMembers(adminClient, photo, photoId, user.id);
    return jsonResponse({ queued: true }, 200);
  } catch {
    console.error('room_photo_push_failed');
    return jsonResponse({ error: 'room_photo_push_failed' }, 500);
  }
});

async function notifyRoomMembers(adminClient: SupabaseClient, photo: PhotoRecord, photoId: string, sourceUserId: string): Promise<void> {
  const [{ data: sourceProfile }, { data: shares, error: shareError }] = await Promise.all([
    adminClient.from('profiles').select('nickname').eq('id', sourceUserId).maybeSingle(),
    adminClient.from('entry_room_shares').select('room_id').eq('entry_id', photo.entry_id).is('revoked_at', null),
  ]);
  if (shareError) throw new Error('room_share_lookup_failed');

  const sourceNickname = readNickname(sourceProfile);
  for (const share of shares ?? []) {
    if (!isRoomShare(share)) continue;

    const { data: room } = await adminClient.from('rooms').select('name, status').eq('id', share.room_id).maybeSingle<RoomRecord>();
    if (!room || (room.status !== 'draft' && room.status !== 'active')) continue;

    const { data: sourceMembership } = await adminClient
      .from('room_members')
      .select('joined_at, user_id')
      .eq('room_id', share.room_id)
      .eq('user_id', sourceUserId)
      .eq('status', 'active')
      .maybeSingle<MembershipRecord>();
    if (!sourceMembership || getKstDateKey(sourceMembership.joined_at) > photo.date_key) continue;

    const { data: memberships, error: membershipError } = await adminClient
      .from('room_members')
      .select('joined_at, user_id')
      .eq('room_id', share.room_id)
      .eq('status', 'active');
    if (membershipError) throw new Error('room_member_lookup_failed');

    const recipients = (memberships ?? []).filter((membership): membership is MembershipRecord => (
      isMembership(membership)
      && membership.user_id !== sourceUserId
      && getKstDateKey(membership.joined_at) <= photo.date_key
    ));
    await Promise.all(recipients.map((recipient) => notifyRecipient({
      adminClient,
      dateKey: photo.date_key,
      photoId,
      recipientUserId: recipient.user_id,
      roomId: share.room_id,
      roomName: room.name,
      sourceNickname,
      sourceUserId,
    })));
  }
}

async function notifyRecipient(input: {
  adminClient: SupabaseClient;
  dateKey: string;
  photoId: string;
  recipientUserId: string;
  roomId: string;
  roomName: string;
  sourceNickname: string;
  sourceUserId: string;
}): Promise<void> {
  const { data: devices, error: deviceError } = await input.adminClient
    .from('push_devices')
    .select('expo_push_token')
    .eq('user_id', input.recipientUserId)
    .eq('is_enabled', true);
  if (deviceError) throw new Error('push_device_lookup_failed');

  const deviceRecords = (devices ?? []).filter(isPushDevice);
  if (deviceRecords.length === 0) return;

  const { data: claimed, error: claimError } = await input.adminClient.rpc('claim_room_photo_push_delivery', {
    p_date_key: input.dateKey,
    p_recipient_user_id: input.recipientUserId,
    p_room_id: input.roomId,
    p_source_user_id: input.sourceUserId,
  });
  if (claimError) throw new Error('room_push_delivery_claim_failed');
  if (claimed !== true) return;

  const tickets = await sendExpoPushes(deviceRecords, {
    body: `${input.sourceNickname} 님이 오늘의 사진을 한 장 추가했어요.`,
    data: { dateKey: input.dateKey, destination: 'room', photoId: input.photoId, roomId: input.roomId },
    title: input.roomName,
  });

  await Promise.all(tickets.flatMap((ticket, index) => (
    ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' && deviceRecords[index]
      ? [disableInvalidDevice(input.adminClient, deviceRecords[index].expo_push_token)]
      : []
  )));
}

async function sendExpoPushes(devices: readonly PushDeviceRecord[], content: { body: string; data: Record<string, string>; title: string }): Promise<ExpoPushTicket[]> {
  const response = await fetch(EXPO_PUSH_ENDPOINT, {
    body: JSON.stringify(devices.map((device) => ({
      ...content,
      channelId: ROOM_ACTIVITY_CHANNEL_ID,
      sound: 'default',
      to: device.expo_push_token,
    }))),
    headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate', 'Content-Type': 'application/json' },
    method: 'POST',
  });
  if (!response.ok) throw new Error('expo_push_request_failed');

  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.data)) throw new Error('expo_push_response_invalid');
  return payload.data.filter(isExpoPushTicket);
}

async function disableInvalidDevice(adminClient: SupabaseClient, expoPushToken: string): Promise<void> {
  await adminClient.from('push_devices').update({ is_enabled: false, updated_at: new Date().toISOString() }).eq('expo_push_token', expoPushToken);
}

async function getOwnedPhoto(adminClient: SupabaseClient, photoId: string, userId: string): Promise<PhotoRecord | null> {
  const { data, error } = await adminClient
    .from('entry_photos')
    .select('entry_id, owner_id, date_key')
    .eq('id', photoId)
    .eq('owner_id', userId)
    .maybeSingle<PhotoRecord>();
  if (error) throw new Error('photo_lookup_failed');
  return data ?? null;
}

async function readPhotoId(request: Request): Promise<string | null> {
  try {
    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.photoId !== 'string' || !isUuid(body.photoId)) return null;
    return body.photoId;
  } catch {
    return null;
  }
}

function getProjectKey(keysEnvironmentName: string, singleKeyEnvironmentName: string, legacyEnvironmentName: string): string | null {
  const keysValue = Deno.env.get(keysEnvironmentName);
  if (keysValue) {
    try {
      const parsed: unknown = JSON.parse(keysValue);
      if (isRecord(parsed) && typeof parsed.default === 'string' && parsed.default.length > 0) return parsed.default;
    } catch {
      // Fall through to a legacy key name during project-key rotation.
    }
  }
  return Deno.env.get(singleKeyEnvironmentName) ?? Deno.env.get(legacyEnvironmentName) ?? null;
}

function getBearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

function getKstDateKey(value: string): string {
  const parts = KST_DATE_FORMATTER.formatToParts(new Date(value));
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get('year')}-${byType.get('month')}-${byType.get('day')}`;
}

function readNickname(value: unknown): string {
  if (!isRecord(value) || typeof value.nickname !== 'string' || value.nickname.trim().length === 0) return '친구';
  return value.nickname.trim();
}

function isRoomShare(value: unknown): value is { room_id: string } {
  return isRecord(value) && typeof value.room_id === 'string' && isUuid(value.room_id);
}

function isMembership(value: unknown): value is MembershipRecord {
  return isRecord(value) && typeof value.joined_at === 'string' && typeof value.user_id === 'string' && isUuid(value.user_id);
}

function isPushDevice(value: unknown): value is PushDeviceRecord {
  return isRecord(value) && typeof value.expo_push_token === 'string' && value.expo_push_token.length > 0;
}

function isExpoPushTicket(value: unknown): value is ExpoPushTicket {
  return isRecord(value) && (value.status === 'ok' || value.status === 'error');
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function jsonResponse(body: Record<string, boolean | string>, status: number): Response {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' }, status });
}
