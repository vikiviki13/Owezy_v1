import { createClient } from '@supabase/supabase-js';
import { argon2id } from 'hash-wasm';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';

const encoder = new TextEncoder();
const PIN_CONFIG = { memorySize: 65_536, iterations: 3, parallelism: 1, hashLength: 32 } as const;
const REAUTH_WINDOW_MS = 5 * 60_000;
const CHALLENGE_TTL_MS = 5 * 60_000;
const GRANT_TTL_MS = 24 * 60 * 60_000;
const STEP_UP_TTL_MS = 5 * 60_000;
const MAX_REQUEST_BYTES = 2_200_000;
const MAX_APP_DATA_BYTES = 2_097_152;
const MAX_IMPORT_SIZE = 100;
const APP_DATA_ARRAY_KEYS = [
  'friends', 'groups', 'groupMembers', 'expenses', 'expenseParticipants',
  'expenseItems', 'expenseItemAssignments', 'expenseAdjustments', 'repayments', 'attachments',
] as const;
const APP_DATA_KEYS = new Set(['profile', 'preferences', ...APP_DATA_ARRAY_KEYS]);

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: Record<string, unknown>) {
    super(message);
  }
}

function allowedOrigins() {
  return (Deno.env.get('WEBAUTHN_ALLOWED_ORIGINS') || 'http://localhost:5173')
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function checkedOrigin(request: Request) {
  const origin = request.headers.get('origin')?.replace(/\/$/, '');
  if (!origin) throw new HttpError(400, 'origin_missing', 'This security request must come from the app.');
  if (!allowedOrigins().includes(origin)) {
    throw new HttpError(403, 'origin_not_allowed', 'This app address is not allowed to use the security service.');
  }
  return origin;
}

function responseHeaders(request: Request) {
  const origin = checkedOrigin(request);
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store, max-age=0',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
  };
}

function reply(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(request) });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError(500, 'server_configuration', 'Security service is not configured.');
  return value;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

async function sha256(value: string) {
  return toBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

function randomToken() {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

function constantTimeEqual(left: string, right: string) {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) difference |= (a[index % a.length] ?? 0) ^ (b[index % b.length] ?? 0);
  return difference === 0;
}

function validatePin(pin: unknown) {
  if (typeof pin !== 'string' || !/^\d{6}$/.test(pin)) {
    throw new HttpError(400, 'invalid_pin', 'Use a 6-digit PIN.');
  }
  return pin;
}

async function hashPin(pin: string, encodedSalt?: string, storedConfig?: Record<string, unknown> | null) {
  const salt = encodedSalt ? fromBase64Url(encodedSalt) : crypto.getRandomValues(new Uint8Array(16));
  const config = {
    memorySize: Number(storedConfig?.memorySize || PIN_CONFIG.memorySize),
    iterations: Number(storedConfig?.iterations || PIN_CONFIG.iterations),
    parallelism: Number(storedConfig?.parallelism || PIN_CONFIG.parallelism),
    hashLength: Number(storedConfig?.hashLength || PIN_CONFIG.hashLength),
  };
  const hash = await argon2id({ password: pin, salt, ...config, outputType: 'hex' });
  return { hash, salt: toBase64Url(salt), config: { algorithm: 'argon2id', version: 1, ...config } };
}

function durationMs(value: string) {
  if (value === '1m') return 60_000;
  if (value === '5m') return 5 * 60_000;
  if (value === '15m') return 15 * 60_000;
  if (value === '30m') return 30 * 60_000;
  return 0;
}

function webAuthnContext(request: Request) {
  const origin = checkedOrigin(request);
  const parsed = new URL(origin);
  const configuredRpID = Deno.env.get('WEBAUTHN_RP_ID')?.trim();
  const rpID = configuredRpID && (parsed.hostname === configuredRpID || parsed.hostname.endsWith(`.${configuredRpID}`))
    ? configuredRpID
    : parsed.hostname;
  return { origin, rpID };
}

async function userFromRequest(request: Request) {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) throw new HttpError(401, 'session_missing', 'Please sign in again.');
  const client = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new HttpError(401, 'session_expired', 'Your session expired. Please sign in again.');
  return { user: data.user };
}

function adminClient() {
  return createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function ensureProfile(admin: ReturnType<typeof adminClient>, userId: string) {
  const { data, error } = await admin.from('security_profiles').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw new HttpError(500, 'security_storage', 'Security settings could not be loaded.');
  if (data) return data;
  const { data: created, error: createError } = await admin
    .from('security_profiles')
    .insert({ user_id: userId })
    .select('*')
    .single();
  if (createError) throw new HttpError(500, 'security_storage', 'Security settings could not be created.');
  return created;
}

async function recordEvent(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  eventType: string,
  deviceLabel?: string | null,
  metadata: Record<string, unknown> = {},
) {
  const safeMetadata = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !/pin|challenge|credential|public_key|token|secret/i.test(key)),
  );
  const { error } = await admin.from('security_events').insert({
    user_id: userId,
    event_type: eventType,
    device_label: deviceLabel?.slice(0, 80) || null,
    metadata: safeMetadata,
  });
  if (error) console.error('security_event_write_failed', { code: error.code, eventType });
}

async function recordAlert(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  alertType: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  metadata: Record<string, unknown> = {},
) {
  const safeMetadata = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !/email|password|pin|challenge|credential|public_key|token|secret|authorization|raw_ip/i.test(key)),
  );
  const { error } = await admin.from('security_alerts').insert({
    user_id: userId,
    alert_type: alertType.slice(0, 80),
    severity,
    metadata: safeMetadata,
  });
  if (error) console.error('security_alert_write_failed', { code: error.code, alertType });
}

async function consumeRateLimit(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  bucket: string,
  limit: number,
  windowSeconds: number,
  blockSeconds: number,
) {
  const { data, error } = await admin.rpc('consume_security_rate_limit', {
    p_user_id: userId,
    p_bucket: bucket.slice(0, 120),
    p_limit: limit,
    p_window_seconds: windowSeconds,
    p_block_seconds: blockSeconds,
  });
  if (error || !data?.[0]) throw new HttpError(503, 'rate_limit_unavailable', 'The security service is temporarily unavailable.');
  const result = data[0] as { allowed: boolean; attempts: number; retry_after: number };
  if (!result.allowed) {
    await recordEvent(admin, userId, 'security_rate_limited', null, { bucket, attempts: result.attempts });
    await recordAlert(admin, userId, 'security_rate_limited', 'medium', { bucket, attempts: result.attempts });
    throw new HttpError(429, 'rate_limited', 'Too many requests. Try again shortly.', {
      retryAfter: Math.max(1, Number(result.retry_after || blockSeconds)),
    });
  }
}

async function clientAddressBucket(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('cf-connecting-ip')?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown';
  return (await sha256(forwarded)).slice(0, 20);
}

async function readRequestBody(request: Request) {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_REQUEST_BYTES) throw new HttpError(413, 'request_too_large', 'The request is too large.');
  const raw = await request.text();
  if (encoder.encode(raw).byteLength > MAX_REQUEST_BYTES) throw new HttpError(413, 'request_too_large', 'The request is too large.');
  let parsed: unknown;
  try { parsed = JSON.parse(raw || '{}'); } catch { throw new HttpError(400, 'invalid_json', 'The request format is invalid.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new HttpError(400, 'invalid_request', 'The request format is invalid.');
  return parsed as Record<string, unknown>;
}

async function issueGrant(admin: ReturnType<typeof adminClient>, userId: string, method: 'device' | 'pin' | 'recovery') {
  const token = randomToken();
  const now = new Date();
  const { error } = await admin.from('app_unlock_sessions').insert({
    user_id: userId,
    token_hash: await sha256(token),
    authentication_method: method,
    last_active_at: now.toISOString(),
    last_verified_at: now.toISOString(),
    expires_at: new Date(now.getTime() + GRANT_TTL_MS).toISOString(),
  });
  if (error) throw new HttpError(500, 'grant_failed', 'The app could not be unlocked.');
  return { token, lastVerifiedAt: now.toISOString() };
}

async function getGrant(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  token: unknown,
  options: { requireFresh?: boolean; applyAutoLock?: boolean } = {},
) {
  if (typeof token !== 'string' || token.length < 32) return null;
  const profile = await ensureProfile(admin, userId);
  const { data, error } = await admin
    .from('app_unlock_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('token_hash', await sha256(token))
    .is('revoked_at', null)
    .maybeSingle();
  if (error || !data) return null;
  const now = Date.now();
  if (new Date(data.expires_at).getTime() <= now) return null;
  if (options.applyAutoLock !== false) {
    const allowedIdle = durationMs(profile.auto_lock_duration);
    if (allowedIdle > 0 && now - new Date(data.last_active_at).getTime() >= allowedIdle) return null;
  }
  if (options.requireFresh && now - new Date(data.last_verified_at).getTime() > REAUTH_WINDOW_MS) return null;
  return data;
}

async function requireFreshGrant(admin: ReturnType<typeof adminClient>, userId: string, token: unknown) {
  const grant = await getGrant(admin, userId, token, { requireFresh: true, applyAutoLock: true });
  if (!grant) throw new HttpError(401, 'reauthentication_required', 'Verify your identity again to continue.');
  return grant;
}

async function issueStepUpProof(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  purpose: 'security_setup' | 'pin_recovery',
) {
  const token = randomToken();
  const { error } = await admin.from('security_step_up_proofs').insert({
    user_id: userId,
    token_hash: await sha256(token),
    purpose,
    expires_at: new Date(Date.now() + STEP_UP_TTL_MS).toISOString(),
  });
  if (error) throw new HttpError(500, 'reauthentication_failed', 'Account verification could not be completed.');
  return token;
}

async function getStepUpProof(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  token: unknown,
  purpose: 'security_setup' | 'pin_recovery',
  consume = false,
) {
  if (typeof token !== 'string' || token.length < 32) return null;
  const { data, error } = await admin.from('security_step_up_proofs')
    .select('id, expires_at')
    .eq('user_id', userId)
    .eq('token_hash', await sha256(token))
    .eq('purpose', purpose)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (error || !data) return null;
  if (consume) {
    const { data: consumed, error: consumeError } = await admin.from('security_step_up_proofs')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', data.id)
      .is('consumed_at', null)
      .select('id')
      .maybeSingle();
    if (consumeError || !consumed) return null;
  }
  return data;
}

async function requireFreshGrantOrSetupProof(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  unlockToken: unknown,
  stepUpToken: unknown,
  consumeProof = false,
) {
  if (stepUpToken) {
    const proof = await getStepUpProof(admin, userId, stepUpToken, 'security_setup', consumeProof);
    if (proof) return;
  }
  await requireFreshGrant(admin, userId, unlockToken);
}

async function requirePrivateDataAccess(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  unlockToken: unknown,
) {
  const profile = await ensureProfile(admin, userId);
  if (!profile.app_lock_enabled) return null;
  const grant = await getGrant(admin, userId, unlockToken, { applyAutoLock: true });
  if (!grant) {
    await recordEvent(admin, userId, 'private_data_access_denied');
    throw new HttpError(401, 'unlock_required', 'Unlock the app to access private data.');
  }
  await admin.from('app_unlock_sessions').update({ last_active_at: new Date().toISOString() }).eq('id', grant.id);
  return grant;
}

function validateAppData(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'invalid_app_data', 'Application data is invalid.');
  const data = value as Record<string, unknown>;
  if (encoder.encode(JSON.stringify(data)).byteLength > MAX_APP_DATA_BYTES) throw new HttpError(413, 'app_data_too_large', 'Application data exceeds the account limit.');
  if (!data.profile || typeof data.profile !== 'object' || Array.isArray(data.profile)) throw new HttpError(400, 'invalid_app_data', 'Application profile data is invalid.');
  if (!data.preferences || typeof data.preferences !== 'object' || Array.isArray(data.preferences)) throw new HttpError(400, 'invalid_app_data', 'Application preference data is invalid.');
  if (Object.keys(data).some((key) => !APP_DATA_KEYS.has(key))) throw new HttpError(400, 'invalid_app_data', 'Application data contains an unsupported section.');
  for (const key of APP_DATA_ARRAY_KEYS) {
    if (!Array.isArray(data[key]) || (data[key] as unknown[]).length > 10_000) throw new HttpError(400, 'invalid_app_data', `Application ${key} data is invalid.`);
  }
  return data;
}

async function verifyPin(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  pinValue: unknown,
  request: Request,
) {
  const pin = validatePin(pinValue);
  const profile = await ensureProfile(admin, userId);
  if (!profile.pin_hash || !profile.pin_salt) throw new HttpError(400, 'pin_not_configured', 'App PIN is not set up.');
  const addressBucket = await clientAddressBucket(request);
  await consumeRateLimit(admin, userId, 'pin:user', 20, 300, 300);
  await consumeRateLimit(admin, userId, `pin:ip:${addressBucket}`, 40, 300, 300);
  const { data: claims, error: claimError } = await admin.rpc('claim_pin_attempt', { p_user_id: userId });
  if (claimError || !claims?.[0]) throw new HttpError(503, 'pin_protection_unavailable', 'PIN verification is temporarily unavailable.');
  const claim = claims[0] as { attempts: number; locked_until: string | null; allowed: boolean };
  if (!claim.allowed) {
    const retryAfter = Math.max(1, Math.ceil((new Date(claim.locked_until || Date.now()).getTime() - Date.now()) / 1000));
    throw new HttpError(429, 'pin_temporarily_blocked', 'Too many attempts. Try again shortly.', {
      retryAfter,
    });
  }
  const candidate = await hashPin(pin, profile.pin_salt, profile.pin_hash_config);
  if (!constantTimeEqual(candidate.hash, profile.pin_hash)) {
    const attempts = Number(claim.attempts || 0);
    const delay = claim.locked_until ? Math.max(1, Math.ceil((new Date(claim.locked_until).getTime() - Date.now()) / 1000)) : 0;
    await recordEvent(admin, userId, 'pin_failed', null, { attempt_count: attempts, delay_seconds: delay });
    if (delay) await recordAlert(admin, userId, 'pin_lockout', 'medium', { attempts, delay_seconds: delay });
    throw new HttpError(delay ? 429 : 401, delay ? 'pin_temporarily_blocked' : 'pin_incorrect', delay ? `Too many attempts. Try again in ${delay} seconds.` : 'Incorrect PIN.', {
      attempts,
      retryAfter: delay,
    });
  }
  await admin.from('security_profiles').update({
    failed_pin_attempt_count: 0,
    locked_until: null,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId);
  return profile;
}

async function securityStatus(admin: ReturnType<typeof adminClient>, userId: string, token: unknown, request: Request) {
  const profile = await ensureProfile(admin, userId);
  const currentRpID = webAuthnContext(request).rpID;
  const { data: authenticators, error } = await admin
    .from('user_authenticators')
    .select('id, rp_id, device_name, authenticator_type, backed_up, transports, created_at, last_used_at, is_active')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new HttpError(500, 'security_storage', 'Security devices could not be loaded.');
  const grant = await getGrant(admin, userId, token, { applyAutoLock: true });
  return {
    appLockEnabled: Boolean(profile.app_lock_enabled),
    pinEnabled: Boolean(profile.pin_hash),
    webAuthnEnabled: (authenticators || []).some((item) => item.is_active),
    webAuthnAvailableHere: (authenticators || []).some((item) => item.is_active && item.rp_id === currentRpID),
    autoLockDuration: profile.auto_lock_duration,
    preferredUnlockMethod: profile.preferred_unlock_method,
    failedPinAttempts: Number(profile.failed_pin_attempt_count || 0),
    lockedUntil: profile.locked_until,
    grantValid: Boolean(grant),
    lastVerifiedAt: grant?.last_verified_at || null,
    authenticators: (authenticators || []).map((item) => ({
      id: item.id,
      deviceName: item.device_name,
      authenticatorType: item.authenticator_type,
      backedUp: item.backed_up,
      transports: item.transports,
      createdAt: item.created_at,
      lastUsedAt: item.last_used_at,
      isActive: item.is_active,
      usableHere: item.rp_id === currentRpID,
    })),
  };
}

Deno.serve(async (request) => {
  let actionLabel = 'unknown';
  try {
    webAuthnContext(request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: responseHeaders(request) });
    if (request.method !== 'POST') return reply(request, { error: { code: 'method_not_allowed', message: 'Method not allowed.' } }, 405);
    const { user } = await userFromRequest(request);
    const admin = adminClient();
    const body = await readRequestBody(request);
    const action = typeof body.action === 'string' ? body.action : '';
    actionLabel = action.slice(0, 80) || 'missing';
    const unlockToken = body.unlockToken;
    const stepUpToken = body.stepUpToken;
    await consumeRateLimit(admin, user.id, 'api:general', 180, 60, 60);

    if (action === 'status') return reply(request, await securityStatus(admin, user.id, unlockToken, request));

    if (action === 'reauth/password') {
      const purpose = body.purpose;
      if (purpose !== 'security_setup' && purpose !== 'pin_recovery') throw new HttpError(400, 'invalid_reauthentication_purpose', 'Account verification request is invalid.');
      const password = typeof body.password === 'string' ? body.password : '';
      if (!password || password.length > 1024 || !user.email) throw new HttpError(400, 'invalid_password', 'Enter your account password.');
      const addressBucket = await clientAddressBucket(request);
      await consumeRateLimit(admin, user.id, 'reauth:user', 5, 900, 900);
      await consumeRateLimit(admin, user.id, `reauth:ip:${addressBucket}`, 20, 900, 900);
      const authClient = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_ANON_KEY'), {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data: verification, error: verificationError } = await authClient.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (verificationError || verification.user?.id !== user.id) {
        await recordEvent(admin, user.id, 'password_reauthentication_failed');
        await recordAlert(admin, user.id, 'password_reauthentication_failed', 'medium');
        throw new HttpError(401, 'account_verification_failed', 'The password is incorrect or account verification is unavailable.');
      }
      const proof = await issueStepUpProof(admin, user.id, purpose);
      await recordEvent(admin, user.id, 'password_reauthentication_succeeded');
      return reply(request, { proof, expiresIn: Math.floor(STEP_UP_TTL_MS / 1000) });
    }

    if (action === 'data/read') {
      await requirePrivateDataAccess(admin, user.id, unlockToken);
      const { data, error } = await admin.from('app_data').select('data, updated_at').eq('user_id', user.id).maybeSingle();
      if (error) throw new HttpError(503, 'data_read_failed', 'Your private data could not be loaded.');
      return reply(request, { data: data?.data || null, updatedAt: data?.updated_at || null });
    }

    if (action === 'data/write') {
      await requirePrivateDataAccess(admin, user.id, unlockToken);
      await consumeRateLimit(admin, user.id, 'data:write', 120, 60, 60);
      const submitted = validateAppData(body.data);
      const data = {
        ...submitted,
        profile: { ...(submitted.profile as Record<string, unknown>), id: user.id, email: user.email },
        preferences: { ...(submitted.preferences as Record<string, unknown>), user_id: user.id },
      };
      const { error } = await admin.from('app_data').upsert({
        user_id: user.id,
        data,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (error) throw new HttpError(error.code === '23514' ? 413 : 503, error.code === '23514' ? 'app_data_too_large' : 'data_write_failed', error.code === '23514' ? 'Application data exceeds the account limit.' : 'Your changes could not be synchronized.');
      return reply(request, { ok: true });
    }

    if (action === 'friends/import') {
      await requirePrivateDataAccess(admin, user.id, unlockToken);
      await consumeRateLimit(admin, user.id, 'friends:import', 10, 300, 300);
      if (!Array.isArray(body.friends) || body.friends.length < 1 || body.friends.length > MAX_IMPORT_SIZE) {
        throw new HttpError(400, 'invalid_friend_batch', `Choose between 1 and ${MAX_IMPORT_SIZE} friends.`);
      }
      const successes: Array<Record<string, unknown>> = [];
      const failures: Array<Record<string, unknown>> = [];
      for (const candidate of body.friends) {
        const input = candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? candidate as Record<string, unknown> : {};
        const clientId = typeof input.clientId === 'string' ? input.clientId.slice(0, 100) : '';
        const name = typeof input.name === 'string' ? input.name.trim() : '';
        const nickname = typeof input.nickname === 'string' ? input.nickname.trim() : '';
        const whatsapp = typeof input.whatsappE164 === 'string' ? input.whatsappE164.trim() : '';
        const phone = typeof input.phoneNumber === 'string' ? input.phoneNumber.trim() : '';
        const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
        if (!clientId || !name || name.length > 120 || nickname.length > 80 || !/^\+[1-9][0-9]{7,14}$/.test(whatsapp) || !phone || phone.length > 32 || email.length > 254) {
          failures.push({ clientId, name: name.slice(0, 120), reason: 'Name and a valid WhatsApp number are required.' });
          continue;
        }
        const { data: row, error } = await admin.from('friends').insert({
          owner_id: user.id,
          name,
          nickname: nickname || null,
          whatsapp_e164: whatsapp,
          phone_number: phone,
          email: email || null,
        }).select('id, owner_id, name, nickname, whatsapp_e164, phone_number, email, created_at').single();
        if (error || !row) {
          failures.push({
            clientId,
            name,
            reason: error?.code === '23505' ? 'This WhatsApp number is already being used.' : 'This friend could not be added.',
          });
          continue;
        }
        successes.push({ clientId, row });
      }
      if (failures.length) {
        await recordEvent(admin, user.id, 'friend_import_failed', null, { failed_count: failures.length, requested_count: body.friends.length });
      }
      return reply(request, { successes, failures });
    }

    if (action === 'pin/create') {
      const pin = validatePin(body.pin);
      const profile = await ensureProfile(admin, user.id);
      if (profile.pin_hash) await requireFreshGrant(admin, user.id, unlockToken);
      else await requireFreshGrantOrSetupProof(admin, user.id, unlockToken, stepUpToken);
      const material = await hashPin(pin);
      const now = new Date().toISOString();
      const { error } = await admin.from('security_profiles').update({
        pin_hash: material.hash,
        pin_salt: material.salt,
        pin_hash_config: material.config,
        pin_created_at: profile.pin_created_at || now,
        pin_updated_at: now,
        failed_pin_attempt_count: 0,
        locked_until: null,
        updated_at: now,
      }).eq('user_id', user.id);
      if (error) throw new HttpError(500, 'pin_save_failed', 'The PIN could not be saved.');
      await recordEvent(admin, user.id, profile.pin_hash ? 'pin_changed' : 'pin_created');
      const grant = await issueGrant(admin, user.id, 'recovery');
      return reply(request, { ok: true, grant });
    }

    if (action === 'pin/verify') {
      await verifyPin(admin, user.id, body.pin, request);
      const grant = await issueGrant(admin, user.id, 'pin');
      return reply(request, { ok: true, grant });
    }

    if (action === 'pin/change') {
      await requireFreshGrant(admin, user.id, unlockToken);
      const pin = validatePin(body.pin);
      const material = await hashPin(pin);
      const now = new Date().toISOString();
      const { error } = await admin.from('security_profiles').update({
        pin_hash: material.hash,
        pin_salt: material.salt,
        pin_hash_config: material.config,
        pin_updated_at: now,
        failed_pin_attempt_count: 0,
        locked_until: null,
        updated_at: now,
      }).eq('user_id', user.id);
      if (error) throw new HttpError(500, 'pin_save_failed', 'The PIN could not be changed.');
      await recordEvent(admin, user.id, 'pin_changed');
      return reply(request, { ok: true });
    }

    if (action === 'pin/recover') {
      const freshGrant = await getGrant(admin, user.id, unlockToken, { requireFresh: true, applyAutoLock: true });
      if (!freshGrant) {
        const proof = await getStepUpProof(admin, user.id, stepUpToken, 'pin_recovery', true);
        if (!proof) throw new HttpError(401, 'account_reauthentication_required', 'Verify your account again before resetting your PIN.');
      }
      const pin = validatePin(body.pin);
      const material = await hashPin(pin);
      const now = new Date().toISOString();
      await ensureProfile(admin, user.id);
      const { error } = await admin.from('security_profiles').update({
        pin_hash: material.hash,
        pin_salt: material.salt,
        pin_hash_config: material.config,
        pin_updated_at: now,
        failed_pin_attempt_count: 0,
        locked_until: null,
        updated_at: now,
      }).eq('user_id', user.id);
      if (error) throw new HttpError(500, 'pin_save_failed', 'The PIN could not be reset.');
      await recordEvent(admin, user.id, 'account_recovery');
      const grant = await issueGrant(admin, user.id, 'recovery');
      return reply(request, { ok: true, grant });
    }

    if (action === 'webauthn/registration-options') {
      await requireFreshGrantOrSetupProof(admin, user.id, unlockToken, stepUpToken);
      const { origin, rpID } = webAuthnContext(request);
      const { data: credentials } = await admin.from('user_authenticators')
        .select('credential_id, transports')
        .eq('user_id', user.id)
        .eq('rp_id', rpID)
        .eq('is_active', true);
      const options = await generateRegistrationOptions({
        rpName: 'Tab Expense Tracker',
        rpID,
        userID: encoder.encode(user.id),
        userName: user.email || user.id,
        userDisplayName: user.user_metadata?.full_name || user.email || 'Tab user',
        attestationType: 'none',
        supportedAlgorithmIDs: [-7, -257],
        excludeCredentials: (credentials || []).map((item) => ({ id: item.credential_id, transports: item.transports || [] })),
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          residentKey: 'preferred',
          userVerification: 'required',
        },
      });
      await admin.from('webauthn_challenges').delete().eq('user_id', user.id).eq('ceremony', 'registration');
      const { error } = await admin.from('webauthn_challenges').insert({
        user_id: user.id,
        ceremony: 'registration',
        challenge: options.challenge,
        origin,
        rp_id: rpID,
        expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
      });
      if (error) throw new HttpError(500, 'challenge_save_failed', 'Device Security setup could not start.');
      return reply(request, { options });
    }

    if (action === 'webauthn/registration-verify') {
      await requireFreshGrantOrSetupProof(admin, user.id, unlockToken, stepUpToken);
      const context = webAuthnContext(request);
      const { data: challenge } = await admin.from('webauthn_challenges')
        .select('*')
        .eq('user_id', user.id)
        .eq('ceremony', 'registration')
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!challenge || challenge.origin !== context.origin || challenge.rp_id !== context.rpID) {
        throw new HttpError(400, 'challenge_expired', 'Device Security setup expired. Please try again.');
      }
      await admin.from('webauthn_challenges').update({ used_at: new Date().toISOString() }).eq('id', challenge.id);
      const verification = await verifyRegistrationResponse({
        response: body.response as never,
        expectedChallenge: challenge.challenge,
        expectedOrigin: challenge.origin,
        expectedRPID: challenge.rp_id,
        requireUserVerification: true,
      });
      if (!verification.verified || !verification.registrationInfo) {
        throw new HttpError(401, 'device_verification_failed', 'Device Security could not be verified.');
      }
      const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
      const deviceName = typeof body.deviceName === 'string' && body.deviceName.trim()
        ? body.deviceName.trim().slice(0, 80)
        : 'This Device';
      const { error } = await admin.from('user_authenticators').insert({
        user_id: user.id,
        credential_id: credential.id,
        rp_id: context.rpID,
        public_key: toBase64Url(credential.publicKey),
        sign_count: credential.counter,
        transports: credential.transports || [],
        authenticator_type: credentialDeviceType,
        backed_up: credentialBackedUp,
        device_name: deviceName,
      });
      if (error) throw new HttpError(409, 'credential_exists', 'This security device is already registered.');
      await recordEvent(admin, user.id, 'webauthn_registered', deviceName);
      return reply(request, { ok: true });
    }

    if (action === 'webauthn/authentication-options') {
      const { origin, rpID } = webAuthnContext(request);
      const { data: credentials, error } = await admin.from('user_authenticators')
        .select('credential_id, transports')
        .eq('user_id', user.id)
        .eq('rp_id', rpID)
        .eq('is_active', true);
      if (error || !credentials?.length) throw new HttpError(404, 'credential_not_found', 'No Device Security method is available here.');
      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: credentials.map((item) => ({ id: item.credential_id, transports: item.transports || [] })),
        userVerification: 'required',
      });
      await admin.from('webauthn_challenges').delete().eq('user_id', user.id).eq('ceremony', 'authentication');
      await admin.from('webauthn_challenges').insert({
        user_id: user.id,
        ceremony: 'authentication',
        challenge: options.challenge,
        origin,
        rp_id: rpID,
        expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
      });
      return reply(request, { options });
    }

    if (action === 'webauthn/authentication-verify') {
      const context = webAuthnContext(request);
      const response = body.response as { id?: string };
      if (!response?.id) throw new HttpError(400, 'credential_missing', 'Device Security response is missing.');
      const { data: challenge } = await admin.from('webauthn_challenges')
        .select('*')
        .eq('user_id', user.id)
        .eq('ceremony', 'authentication')
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!challenge || challenge.origin !== context.origin || challenge.rp_id !== context.rpID) {
        throw new HttpError(400, 'challenge_expired', 'Device verification expired. Please try again.');
      }
      await admin.from('webauthn_challenges').update({ used_at: new Date().toISOString() }).eq('id', challenge.id);
      const { data: credential } = await admin.from('user_authenticators')
        .select('*')
        .eq('user_id', user.id)
        .eq('credential_id', response.id)
        .eq('rp_id', context.rpID)
        .eq('is_active', true)
        .maybeSingle();
      if (!credential) throw new HttpError(404, 'credential_not_found', 'This security method is no longer registered.');
      const verification = await verifyAuthenticationResponse({
        response: body.response as never,
        expectedChallenge: challenge.challenge,
        expectedOrigin: challenge.origin,
        expectedRPID: challenge.rp_id,
        requireUserVerification: true,
        credential: {
          id: credential.credential_id,
          publicKey: fromBase64Url(credential.public_key),
          counter: Number(credential.sign_count),
          transports: credential.transports || [],
        },
      });
      if (!verification.verified) throw new HttpError(401, 'device_verification_failed', "Couldn't verify your identity.");
      const usedAt = new Date().toISOString();
      await admin.from('user_authenticators').update({
        sign_count: verification.authenticationInfo.newCounter,
        last_used_at: usedAt,
      }).eq('id', credential.id);
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60_000).toISOString();
      const { data: recentUnlock } = await admin.from('security_events')
        .select('id')
        .eq('user_id', user.id)
        .eq('event_type', 'webauthn_verified')
        .eq('device_label', credential.device_name)
        .gt('created_at', twelveHoursAgo)
        .limit(1)
        .maybeSingle();
      if (!recentUnlock) await recordEvent(admin, user.id, 'webauthn_verified', credential.device_name);
      const grant = await issueGrant(admin, user.id, 'device');
      return reply(request, { ok: true, grant });
    }

    if (action === 'lock/enable') {
      await requireFreshGrantOrSetupProof(admin, user.id, unlockToken, stepUpToken, Boolean(stepUpToken));
      const profile = await ensureProfile(admin, user.id);
      if (!profile.pin_hash) throw new HttpError(400, 'fallback_required', 'Create an App PIN fallback before enabling App Lock.');
      const duration = typeof body.autoLockDuration === 'string' ? body.autoLockDuration : '5m';
      if (!['immediately', '1m', '5m', '15m', '30m'].includes(duration)) throw new HttpError(400, 'invalid_auto_lock', 'Choose a valid auto-lock duration.');
      await admin.from('security_profiles').update({
        app_lock_enabled: true,
        auto_lock_duration: duration,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id);
      await recordEvent(admin, user.id, 'app_lock_enabled');
      const grant = await issueGrant(admin, user.id, 'recovery');
      return reply(request, { ok: true, grant });
    }

    if (action === 'lock/disable') {
      // A fresh unlock grant is the normal path, but a step-up proof from
      // account-password verification is accepted too so a user who enabled
      // App Lock but can no longer unlock can regain access with the
      // strongest credential they have.
      await requireFreshGrantOrSetupProof(admin, user.id, unlockToken, stepUpToken, Boolean(stepUpToken));
      await admin.from('security_profiles').update({ app_lock_enabled: false, updated_at: new Date().toISOString() }).eq('user_id', user.id);
      await admin.from('app_unlock_sessions').update({ revoked_at: new Date().toISOString() }).eq('user_id', user.id).is('revoked_at', null);
      await recordEvent(admin, user.id, 'app_lock_disabled');
      return reply(request, { ok: true });
    }

    if (action === 'lock/touch') {
      const grant = await getGrant(admin, user.id, unlockToken);
      if (!grant) throw new HttpError(401, 'unlock_required', 'Unlock the app to continue.');
      await admin.from('app_unlock_sessions').update({ last_active_at: new Date().toISOString() }).eq('id', grant.id);
      return reply(request, { ok: true });
    }

    if (action === 'lock/revoke') {
      const grant = await getGrant(admin, user.id, unlockToken);
      if (grant) await admin.from('app_unlock_sessions').update({ revoked_at: new Date().toISOString() }).eq('id', grant.id);
      return reply(request, { ok: true });
    }

    if (action === 'lock/revoke-all') {
      await admin.from('app_unlock_sessions').update({ revoked_at: new Date().toISOString() }).eq('user_id', user.id).is('revoked_at', null);
      await admin.from('webauthn_challenges').delete().eq('user_id', user.id);
      await admin.from('security_step_up_proofs').update({ consumed_at: new Date().toISOString() }).eq('user_id', user.id).is('consumed_at', null);
      await recordEvent(admin, user.id, 'all_sessions_revoked');
      return reply(request, { ok: true });
    }

    if (action === 'lock/auto-lock') {
      const grant = await getGrant(admin, user.id, unlockToken, { applyAutoLock: true });
      if (!grant) throw new HttpError(401, 'unlock_required', 'Unlock the app to change security settings.');
      const duration = body.autoLockDuration;
      if (typeof duration !== 'string' || !['immediately', '1m', '5m', '15m', '30m'].includes(duration)) {
        throw new HttpError(400, 'invalid_auto_lock', 'Choose a valid auto-lock duration.');
      }
      await admin.from('security_profiles').update({ auto_lock_duration: duration, updated_at: new Date().toISOString() }).eq('user_id', user.id);
      return reply(request, { ok: true });
    }

    if (action === 'devices/list') return reply(request, await securityStatus(admin, user.id, unlockToken, request));

    if (action === 'devices/rename') {
      const grant = await getGrant(admin, user.id, unlockToken, { applyAutoLock: true });
      if (!grant) throw new HttpError(401, 'unlock_required', 'Unlock the app to change security devices.');
      const deviceId = typeof body.deviceId === 'string' ? body.deviceId : '';
      const deviceName = typeof body.deviceName === 'string' ? body.deviceName.trim().slice(0, 80) : '';
      if (!deviceId || !deviceName) throw new HttpError(400, 'invalid_device', 'Enter a device name.');
      await admin.from('user_authenticators').update({ device_name: deviceName }).eq('id', deviceId).eq('user_id', user.id);
      return reply(request, { ok: true });
    }

    if (action === 'devices/remove') {
      await requireFreshGrant(admin, user.id, unlockToken);
      const deviceId = typeof body.deviceId === 'string' ? body.deviceId : '';
      const profile = await ensureProfile(admin, user.id);
      const { data: active } = await admin.from('user_authenticators').select('id, device_name').eq('user_id', user.id).eq('is_active', true);
      const target = active?.find((item) => item.id === deviceId);
      if (!target) throw new HttpError(404, 'credential_not_found', 'This security device was not found.');
      if (!profile.pin_hash && (active?.length || 0) <= 1) {
        throw new HttpError(409, 'last_method', 'Set up another unlock method before removing this device.');
      }
      await admin.from('user_authenticators').update({ is_active: false }).eq('id', deviceId).eq('user_id', user.id);
      await recordEvent(admin, user.id, 'webauthn_removed', target.device_name);
      return reply(request, { ok: true });
    }

    if (action === 'activity/list') {
      await requirePrivateDataAccess(admin, user.id, unlockToken);
      const { data, error } = await admin.from('security_events')
        .select('id, event_type, device_label, metadata, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(40);
      if (error) throw new HttpError(500, 'activity_failed', 'Security activity could not be loaded.');
      return reply(request, { events: data || [] });
    }

    if (action === 'reauth/status') {
      const grant = await getGrant(admin, user.id, unlockToken, { requireFresh: true });
      return reply(request, { fresh: Boolean(grant), lastVerifiedAt: grant?.last_verified_at || null });
    }

    if (action === 'event/export') {
      await requireFreshGrant(admin, user.id, unlockToken);
      await recordEvent(admin, user.id, 'data_export_verified');
      return reply(request, { ok: true });
    }

    throw new HttpError(404, 'unknown_action', 'This security action is not available.');
  } catch (caught) {
    const error = caught instanceof HttpError
      ? caught
      : new HttpError(500, 'security_error', 'The security request could not be completed.');
    if (error.status >= 500) console.error('security_request_failed', { action: actionLabel, code: error.code, status: error.status });
    try {
      return reply(request, { error: { code: error.code, message: error.message, ...error.details } }, error.status);
    } catch {
      return new Response(JSON.stringify({ error: { code: error.code, message: error.message } }), {
        status: error.status,
        headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' },
      });
    }
  }
});
