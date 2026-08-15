# APPLICATION SECURITY ASSESSMENT REPORT

**Application:** Tab — Friend Expense Tracker  
**Repository:** `D:\Projects\share`  
**Assessment date:** 2026-08-15  
**Assessment type:** Defensive static review, local build/test validation, dependency and secret audit  
**Initial code changes made:** None. Remediation changes and their validation are recorded in Section 22.

## 1. Executive Summary

**Overall posture: High Risk**  
**Production decision: YES, AFTER FIXES**  
**Overall security score: 61/100**

The primary Supabase row-level authorization model is sound on static review: `app_data`, `friends`, and preferences are scoped to `auth.uid()`, security tables are not directly writable by authenticated clients, secrets are not committed, React rendering avoids obvious XSS sinks, and the current npm dependency tree has no known advisories.

The main risk is the secondary **App Lock** security model. The UI presents App Lock as protection for financial records, but those records remain plaintext in browser storage and directly readable through the normal authenticated `app_data` API. Unlock grants are not part of the database authorization decision. In addition, an authenticated session can enroll a new WebAuthn credential without step-up authentication, recovery treats a recently issued/auto-refreshed JWT as proof of recent password entry, idle-expired grants can be revived, and the PIN lockout counter is raceable. Together, these issues mean a stolen Supabase session, refresh token, malicious same-origin script, or sufficiently capable local browser user can bypass the secondary lock.

No unauthenticated cross-user RLS bypass, hardcoded privileged credential, SQL injection, command injection, stored/reflected DOM XSS sink, SSRF primitive, backend file upload, payment flow, webhook, or admin privilege path was found in the reviewed repository.

### Severity totals

| Severity | Count |
| --- | ---: |
| Critical | 0 |
| High | 5 |
| Medium | 5 |
| Low | 5 |
| Informational / positive observations | 7 |

## 2. Scope, Methodology, and Limitations

### Reviewed

- All tracked source, configuration, documentation, test, schema, and deployment files.
- Generated PWA manifest and service worker after a clean production build.
- Current repository and Git-history filenames/signatures for common credential formats.
- Supabase RLS and Edge Function authorization logic.
- Authentication, App Lock, WebAuthn, PIN, recovery, logout, contact import, export, local storage, and PWA flows.
- Package lock provenance, package lifecycle-script metadata, current advisories, and outdated packages.

### Safe checks executed

| Check | Result |
| --- | --- |
| `npm.cmd test` | PASS — 3 files, 17 tests |
| `npm.cmd run lint` | PASS |
| `npm.cmd run build` | PASS — TypeScript, Vite, and PWA generation |
| `npm audit --omit=dev --json` | PASS — 0 advisories in production dependencies |
| `npm audit --json` | PASS — 0 advisories in full dependency tree |
| `npm outdated --json` | Only major dev-tool releases available: `@types/node` and TypeScript |
| Current-tree secret signature scan | No credential signature found |
| Git-history secret signature scan | No credential signature found; only `.env.example` matched a credential-like filename |
| Mirror integrity spot-check | PASS — WebAuthn, Radix, `clsx`, and `tailwind-merge` hashes match canonical npm |
| Deno Edge Function type-check | **NOT VERIFIED — requires runtime/staging verification**; `npx deno check` failed because the npm cache volume reported `ENOSPC` |
| Semgrep / Gitleaks | Not available locally; no installation attempted after `ENOSPC` |
| Live RLS isolation with two test users | **NOT VERIFIED — requires runtime/staging verification** |
| Supabase Auth dashboard settings and rate limits | **NOT VERIFIED — requires runtime/staging verification** |
| Real-device WebAuthn matrix | **NOT VERIFIED — requires runtime/staging verification** |
| Deployed application headers behind Vercel Authentication | **NOT VERIFIED — requires runtime/staging verification** |

The repository was not sent to a third-party analysis service. No destructive requests, external scanning, credential attacks, or database mutations were performed.

## 3. Project Architecture and Security Map

### Application architecture

| Layer | Actual implementation |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8, React Router hash routing, Tailwind CSS |
| Hosting | Vercel primary; Netlify documented alternative |
| PWA | `vite-plugin-pwa` / Workbox generated service worker, app-shell precache, document `NetworkFirst` cache |
| Authentication | Supabase Auth email/password; browser-persisted session with automatic refresh |
| Primary data API | Supabase PostgREST through `supabase-js` |
| Primary database | Supabase PostgreSQL with RLS |
| Domain persistence | One `app_data` JSON document per authenticated user; imported contacts also written to normalized `friends` rows |
| Security backend | One authenticated Supabase Edge Function, `security`, using service role only inside the function |
| App Lock | Server-hashed 6-digit PIN, WebAuthn platform authenticator, opaque unlock grants |
| Client persistence | `localStorage` for full domain document, Supabase session, unlock grants/activity; `sessionStorage` for handoffs; IndexedDB for selected contact draft |
| External services | Supabase, Google Fonts, WhatsApp URL/native share APIs |
| Payments/webhooks/admin | Not present |

### Data flow

```text
User / Device Contacts / Form Inputs
                |
                v
React SPA ---- client validation ---- localStorage domain document
   |                                      |
   | Supabase Auth session                | queued full-document sync
   v                                      v
Supabase Auth ----------------------> PostgREST app_data / friends
                                           |
                                           v
                                      PostgreSQL RLS

React SPA -- JWT + Origin + action --> security Edge Function
                                           |
                                           | service role; queries always scoped to JWT user.id
                                           v
 security_profiles / authenticators / challenges / unlock sessions / events

Service Worker --> static app shell and document cache only
```

### Roles

There are only two meaningful application roles:

- `anon`: may use Supabase Auth endpoints but receives no table grants.
- `authenticated`: may access only its own RLS-scoped rows. There is no app admin, moderator, organization, or super-admin UI/API.

The Edge Function service role is a backend implementation identity, not an end-user role.

## 4. Trust Boundaries and Untrusted Inputs

| Trust boundary / input | Destination | Required controls | Observed controls |
| --- | --- | --- | --- |
| Email, password, signup name | Supabase Auth and user metadata | Server auth policy, rate limits, neutral errors | Supabase-managed; dashboard policy not verified; raw SDK errors shown |
| Route/query/hash parameters | Client data selectors and handoffs | Existence/type validation | Partial; unknown IDs can corrupt only the caller's local document |
| Expense, repayment, profile, friend, group fields | `localStorage` then `app_data` JSON | Schema, type, range, size limits | Mostly UI validation only; server accepts arbitrary JSON |
| Contact Picker response | IndexedDB, review UI, `friends` insert | Explicit selection, E.164, duplicates, lifecycle cleanup | Good selection/confirmation; stale cache lifecycle issue |
| IndexedDB/local/session storage | Application startup and navigation | Treat as attacker-controlled, validate shape, bind to user | Partial validation; draft not user-bound; domain JSON largely trusted |
| Supabase access/refresh session | PostgREST and Edge Function | JWT validation, revocation, least privilege | Supabase `getUser()` plus RLS; tokens are JS-readable |
| App unlock token | Edge Function | Hashing, expiry, idle timeout, revocation, action binding | Hashed server-side; idle-grant revival flaw; not enforced on data API |
| WebAuthn responses | Edge Function | Origin/RP/challenge/user verification/counter | Strong verification; enrollment lacks step-up authorization |
| Avatar file | Data URL in `app_data`, rendered by `<img>` | Size/type/content validation | 3 MB client size limit and `<img>` sink; no signature validation |
| CSV export cells | Downloaded spreadsheet | Formula neutralization | Quoting only; formulas are not neutralized |
| Supabase/database errors | User-visible UI | Stable error mapping/redaction | Several paths display raw SDK/PostgREST messages |

## 5. Attack Surface Inventory

### Public surfaces

- Static PWA assets, manifest, and service worker.
- Supabase Auth signup and sign-in through `supabase.auth`.
- Edge Function CORS preflight (`OPTIONS`); functional requests require a valid Supabase bearer token and allowed Origin.
- Google Fonts stylesheet/font requests.
- WhatsApp/native share links initiated by the user.

### Authenticated data surfaces

| Surface | Operation | Authentication | Authorization | Validation / limits |
| --- | --- | --- | --- | --- |
| `app_data` | select/upsert | Supabase session | RLS `auth.uid() = user_id` | Arbitrary JSON; no explicit size/schema/quota |
| `friends` | select/insert/update/delete grants | Supabase session | RLS `auth.uid() = owner_id` | E.164 check, nonblank name, owner/number uniqueness; no text length limits |
| `user_preferences` | select/insert/update grants | Supabase session | RLS owner check | Several checks; current app keeps preferences in `app_data` |
| `security_events` | direct select grant | Supabase session | RLS owner check | Creation remains server-only |
| Auth user | email update/signout/get user | Supabase session | Supabase Auth | Dashboard configuration not verified |

### `security` Edge Function action inventory

Every action requires POST, a valid Supabase bearer token, and an Origin in `WEBAUTHN_ALLOWED_ORIGINS`. All service-role database queries reviewed were scoped to the JWT-derived `user.id`.

| Action(s) | Intended authorization | Review result |
| --- | --- | --- |
| `status`, `devices/list`, `activity/list`, `reauth/status` | Authenticated user | User scoped |
| `pin/create` | Session; fresh grant only when replacing an existing PIN | First enrollment lacks step-up (SEC-002) |
| `pin/verify` | Session + correct PIN | Argon2id; lockout race/rate-limit issue (SEC-004) |
| `pin/change` | Fresh unlock grant | Appropriate |
| `pin/recover` | Fresh grant or recent account reauth | JWT `iat` is not reauth (SEC-003) |
| `webauthn/registration-options`, `registration-verify` | Should require step-up | Session only (SEC-002) |
| `webauthn/authentication-options`, `authentication-verify` | Session + WebAuthn ceremony | Strong ceremony verification |
| `lock/enable` | Should require enrollment authorization | Session + existing PIN only (SEC-002) |
| `lock/disable` | Fresh unlock grant | Appropriate |
| `lock/touch` | Valid, non-idle-expired grant | Can revive idle-expired grant (SEC-005) |
| `lock/revoke`, `lock/revoke-all` | Session/current grant | User scoped |
| `lock/auto-lock` | Session | No step-up; lower impact |
| `devices/rename` | Session | User scoped; no step-up |
| `devices/remove` | Fresh unlock grant | Appropriate |
| `event/export` | Fresh unlock grant | Appropriate, but underlying data is still client/API accessible (SEC-001) |

### Client-side storage

| Store | Data |
| --- | --- |
| `localStorage.tab_db_v1` | Names, phone/email data, expenses, balances, notes, repayments, profile, preferences, attachments metadata |
| Supabase default auth storage | Access and refresh session material |
| `localStorage.tab_unlock_grant_v2_*` | App Lock unlock token for non-immediate durations |
| `localStorage.tab_last_active_v2_*` | Client activity timestamp |
| IndexedDB `tab-local-contact-cache` | Selected contact names, phone numbers, emails, review state |
| `sessionStorage` | Immediate unlock grant and expense contact handoff |
| Cache Storage | Static app shell and HTML document only |

## 6. Vulnerability Summary

| ID | Vulnerability | Severity | Status | Component | OWASP |
| --- | --- | --- | --- | --- | --- |
| SEC-001 | App Lock does not protect the actual data access paths | High | Confirmed | Browser storage, PostgREST, RLS | A01 Broken Access Control / A04 Insecure Design |
| SEC-002 | Security-method enrollment lacks step-up authentication | High | Confirmed | Security Edge Function | A01 / API5 Broken Function Level Authorization |
| SEC-003 | Auto-refreshed JWT can satisfy PIN recovery reauthentication | High | Confirmed | Recovery flow | A07 Identification and Authentication Failures |
| SEC-004 | PIN lockout is raceable and lacks a pre-hash rate limiter | High | Highly Likely | PIN verification | A07 / API4 Unrestricted Resource Consumption |
| SEC-005 | Idle-expired unlock grants can be revived | Medium | Confirmed | Unlock sessions | A07 Identification and Authentication Failures |
| SEC-006 | Logout cleanup depends on a successful security-service call | Medium | Confirmed | Logout/session cleanup | A07 / A04 Insecure Design |
| SEC-007 | Legacy data is automatically claimed by the first account | High | Confirmed design; conditional exploit | Cloud migration | A01 / A04 / privacy isolation |
| SEC-008 | Contact PII cache is not user-bound, expiring, or cleared on cancel | Medium | Confirmed | IndexedDB/contact import | A04 Insecure Design / privacy |
| SEC-009 | Public authenticated data APIs lack schema, size, and abuse quotas | Medium | Confirmed app gap; platform limits not verified | `app_data`, `friends`, Edge Function | API4 Unrestricted Resource Consumption |
| SEC-010 | Netlify deployment path omits security headers | Medium | Confirmed configuration; runtime not deployed | Deployment | A05 Security Misconfiguration |
| SEC-011 | CSV export does not neutralize spreadsheet formulas | Low | Potential exploitability | Export | A03 Injection |
| SEC-012 | Raw backend/auth errors reach the UI | Low | Confirmed disclosure; enumeration not verified | Auth/import/startup | A05 / A07 |
| SEC-013 | Auth and unlock tokens are readable by JavaScript | Low | Potential; no XSS sink found | Session storage | A07 / A02 Cryptographic Failures |
| SEC-014 | Mixed npm registry provenance and no Edge Function lockfile | Low | Confirmed; sampled integrity passed | Supply chain | A08 Software and Data Integrity Failures |
| SEC-015 | Security monitoring and alerting are incomplete | Low | Confirmed | Logging/operations | A09 Security Logging and Monitoring Failures |

## 7. Critical Vulnerabilities

No critical vulnerability was confirmed in the reviewed source.

## 8. High Vulnerabilities

### SEC-001 — App Lock Does Not Protect the Actual Data Access Paths

**Severity:** High  
**Status:** Confirmed  
**OWASP Category:** A01 Broken Access Control; A04 Insecure Design  
**Affected files:** `src/lib/db.ts:20`, `src/lib/db.ts:68`, `src/lib/db.ts:80`, `src/lib/db.ts:96`, `src/lib/cloudData.ts:77`, `src/lib/cloudData.ts:115`, `supabase/schema.sql:10-31`, `src/components/SecurityProvider.tsx:56-61`  
**Affected component:** App Lock, browser persistence, cloud-data authorization

**Description:** App Lock gates React routes and Edge Function security actions, but it is not part of the authorization decision for financial data. The full domain document remains plaintext in `localStorage`. Any valid Supabase session can read the user's `app_data` row because RLS checks only `auth.uid()`. Locking releases the in-memory cache but deliberately leaves the plaintext local document and Supabase session available.

**Attack scenario:** An attacker with a stolen/borrowed authenticated browser session, malicious same-origin script, browser extension access, or developer-tools access while the lock screen is shown reads `tab_db_v1` or calls the RLS-authorized PostgREST endpoint directly. No PIN, WebAuthn assertion, or unlock grant is required.

**Impact:** Disclosure and modification of names, contact information, expense history, notes, balances, repayments, and profile data; bypass of reauthentication around export by copying the same underlying data directly.

**Evidence:**

```ts
const KEY = 'tab_db_v1';
const raw = localStorage.getItem(KEY);
localStorage.setItem(KEY, JSON.stringify(cache));
```

```sql
grant select, insert, update, delete on table public.app_data to authenticated;
create policy ... using ((select auth.uid()) = user_id);
```

**Root cause:** The secondary lock is implemented as a presentation/security-function gate rather than a data-layer authorization or encryption boundary.

**Recommended remediation:** Choose and document a realistic threat model. If App Lock must resist a stolen Supabase session or local storage inspection, revoke direct authenticated access to `app_data` and route private reads/writes through a backend that validates a non-idle-expired unlock grant. Encrypt the locally persisted document with a key unavailable while locked. Do not keep plaintext domain data after lock. If that architecture is not adopted, relabel App Lock as a casual screen/privacy lock and do not claim it protects records from a malicious client.

**Secure implementation example:**

```sql
revoke all on table public.app_data from authenticated;
```

```ts
// In a scoped backend action, never trust a client-supplied user ID.
const grant = await getGrant(admin, user.id, body.unlockToken, {
  applyAutoLock: true,
});
if (!grant) throw new HttpError(401, 'unlock_required', 'Unlock the app.');

const { data } = await admin
  .from('app_data')
  .select('data')
  .eq('user_id', user.id)
  .single();
```

**Verification:** While App Lock is active, attempt to read `app_data` with only the normal Supabase session and inspect browser persistence. The request must be denied or return ciphertext that cannot be decrypted until a verified unlock occurs.

### SEC-002 — Security-Method Enrollment Lacks Step-Up Authentication

**Severity:** High  
**Status:** Confirmed  
**OWASP Category:** A01 Broken Access Control; OWASP API5 Broken Function Level Authorization  
**Affected files:** `supabase/functions/security/index.ts:313-333`, `supabase/functions/security/index.ts:382-459`, `supabase/functions/security/index.ts:545-557`, `src/pages/settings/SecurityPages.tsx:124`  
**Affected component:** PIN creation, WebAuthn enrollment, App Lock activation

**Description:** Registering a new WebAuthn credential requires only a valid Supabase session. The first PIN can also be created without fresh verification, and App Lock activation accepts any existing PIN record without a fresh grant. Existing-device removal and PIN replacement correctly require a fresh grant, making the enrollment gap inconsistent with the stronger controls elsewhere.

**Attack scenario:** An attacker who obtains a valid Supabase session loads the legitimate RP origin, enrolls a WebAuthn credential they control, authenticates with it, receives an unlock grant, and then performs actions intended to require the victim's PIN/device verification.

**Impact:** Secondary-lock takeover, unauthorized security device enrollment, generation of fresh unlock grants, and access to security-sensitive actions.

**Evidence:** The `webauthn/registration-options` and `webauthn/registration-verify` branches do not call `requireFreshGrant`; `pin/create` does so only when a PIN already exists.

**Root cause:** A base account session is treated as sufficient authorization to add a new factor, even when App Lock already exists.

**Recommended remediation:** Require a one-time, action-bound step-up proof before creating any PIN, adding any WebAuthn credential, or enabling the lock. Accept an existing fresh unlock grant when available. For first enrollment/recovery, require an explicit, server-verifiable password/MFA reauthentication proof—not merely a fresh access token.

**Secure implementation example:**

```ts
async function requireEnrollmentAuthorization(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  unlockToken: unknown,
  reauthProof: unknown,
) {
  if (await getGrant(admin, userId, unlockToken, { requireFresh: true, applyAutoLock: true })) return;
  await consumeOneTimeReauthProof(admin, userId, reauthProof, 'security_method_enrollment');
}
```

Call this before issuing registration options, verifying/storing a registration, first PIN creation, and lock enablement.

**Verification:** With a valid account session but no PIN/WebAuthn/recent explicit reauthentication, each enrollment action must fail. Reusing a consumed proof or using it for another action/user must fail.

### SEC-003 — Auto-Refreshed JWT Can Satisfy PIN Recovery Reauthentication

**Severity:** High  
**Status:** Confirmed  
**OWASP Category:** A07 Identification and Authentication Failures  
**Affected files:** `src/lib/supabase.ts:15-16`, `supabase/functions/security/index.ts:255-264`, `supabase/functions/security/index.ts:360-379`, `src/pages/settings/SecurityPages.tsx:168-183`  
**Affected component:** PIN/account recovery

**Description:** The server accepts a JWT whose `iat` is within five minutes as evidence that the account password was recently entered. Supabase sessions are configured to refresh automatically. Token issuance time proves only that a token was minted; it does not prove an interactive password, MFA, or WebAuthn event occurred.

**Attack scenario:** An attacker with a valid refresh session obtains or waits for a newly refreshed access token, calls `pin/recover`, chooses a new PIN, and receives a recovery unlock grant without knowing the victim's password or existing App PIN.

**Impact:** App PIN reset, secondary-lock bypass, fresh unlock grant issuance, and takeover of App Lock controls.

**Evidence:**

```ts
return typeof parsed.iat === 'number' &&
  Date.now() - parsed.iat * 1000 <= REAUTH_WINDOW_MS;
```

**Root cause:** JWT freshness is confused with user-authentication freshness.

**Recommended remediation:** Remove `jwtIssuedRecently`. Use a short-lived, one-time reauthentication proof produced only after an explicit password/MFA/WebAuthn ceremony. Bind it to user ID, intended action, nonce, and expiration, and consume it atomically. If Supabase claims expose a trustworthy authentication-method timestamp, validate that claim rather than token `iat`, but still prefer one-time action binding.

**Secure implementation example:**

```ts
const proof = await consumeOneTimeReauthProof(
  admin,
  user.id,
  body.reauthProof,
  'pin_recovery',
);
if (!proof) throw new HttpError(401, 'account_reauthentication_required', 'Verify your account again.');
```

**Verification:** Force an access-token refresh without entering a password. PIN recovery must remain denied. Explicit reauthentication should enable exactly one recovery within a short window.

### SEC-004 — PIN Lockout Is Raceable and Lacks a Pre-Hash Rate Limiter

**Severity:** High  
**Status:** Highly Likely (confirmed non-atomic code pattern; runtime concurrency not exercised)  
**OWASP Category:** A07 Identification and Authentication Failures; OWASP API4 Unrestricted Resource Consumption  
**Affected files:** `supabase/functions/security/index.ts:216-252`, `supabase/functions/security/index.ts:335-339`  
**Affected component:** PIN verification and Edge Function resource controls

**Description:** Failed-attempt state is read, incremented in application memory, and written back in separate database requests. Concurrent wrong-PIN requests can read the same counter and overwrite each other with the same increment, delaying or preventing thresholds from being reached. Argon2id runs before any independent IP/user/project rate limiter, so concurrent requests also consume substantial memory/CPU.

**Attack scenario:** An authenticated attacker sends parallel PIN attempts. Multiple invocations observe the same `failed_pin_attempt_count`, perform expensive Argon2id work, and write the same next count. The configured 5/8/10 attempt backoffs are not reliable under concurrency.

**Impact:** Increased feasibility of 6-digit PIN guessing, bypass of progressive lockout, and compute exhaustion/cost amplification.

**Evidence:**

```ts
const attempts = Number(profile.failed_pin_attempt_count || 0) + 1;
await admin.from('security_profiles').update({
  failed_pin_attempt_count: attempts,
  locked_until: nextLockedUntil,
}).eq('user_id', userId);
```

**Root cause:** Security counter updates are not atomic and there is no rate limit before the expensive hash operation.

**Recommended remediation:** Implement an atomic PostgreSQL RPC/transaction that locks the user's security-profile row or increments with `failed_pin_attempt_count = failed_pin_attempt_count + 1` and returns the authoritative value. Add a pre-hash per-user and per-IP sliding-window/token-bucket limit at the Edge gateway. Cap concurrency and alert on abnormal failures. Keep responses uniform.

**Secure implementation example:**

```sql
-- Conceptual RPC executed in one transaction.
update public.security_profiles
set failed_pin_attempt_count = failed_pin_attempt_count + 1,
    updated_at = now()
where user_id = p_user_id
returning failed_pin_attempt_count;
```

Compute and set `locked_until` from the returned authoritative count in the same transaction/function.

**Verification:** Fire a safe, low-volume concurrent test against a disposable account. The counter must increase once per failed request, lockout must trigger at the exact threshold, and requests beyond the gateway limit must be rejected before Argon2id executes.

### SEC-007 — Legacy Data Is Automatically Claimed by the First Account

**Severity:** High  
**Status:** Confirmed design; exploitability depends on residual pre-auth data/shared browser use  
**OWASP Category:** A01 Broken Access Control; A04 Insecure Design  
**Affected files:** `src/lib/cloudData.ts:6`, `src/lib/cloudData.ts:123-139`, `README.md:49`, `DEPLOYMENT.md:76-78`  
**Affected component:** Legacy-to-cloud migration

**Description:** When an authenticated user has no `app_data` row, the app automatically treats any existing `tab_db_v1` browser document as belonging to that account and uploads it. The migration marker is global to the browser, not bound to an owner or user ID.

**Attack scenario:** On a shared browser/device containing an earlier user's local-only expense history, a different person is the first to sign in after the cloud-enabled upgrade. The earlier user's financial and contact data is copied into the new account.

**Impact:** Cross-person privacy breach, incorrect data ownership, permanent cloud replication of residual local records, and possible data loss if the marker is set before a failed upload.

**Evidence:**

```ts
const legacy = localStorage.getItem(LOCAL_DB_KEY);
const legacyAlreadyClaimed = localStorage.getItem(LEGACY_MIGRATION_KEY) === '1';
if (legacy && !legacyAlreadyClaimed) data = prepareData(JSON.parse(legacy), user);
localStorage.setItem(LEGACY_MIGRATION_KEY, '1');
await upload(user.id, data);
```

**Root cause:** Presence in a browser profile is treated as proof of ownership.

**Recommended remediation:** Never upload legacy data silently. Show a clear preview and require explicit confirmation after account authentication. Bind migration state to the authenticated user, set the marker only after a successful upload, and provide a discard option that clears residual data. For higher assurance, require recovery knowledge or a migration code from the old version.

**Secure implementation example:**

```ts
const migrationKey = `${LEGACY_MIGRATION_KEY}:${user.id}`;
// Present metadata/record counts first; upload only after explicit confirmation.
await upload(user.id, confirmedLegacyData);
localStorage.setItem(migrationKey, '1');
```

**Verification:** Seed legacy data, then sign in as an unrelated test account. No legacy record may upload until the user explicitly confirms ownership. A failed upload must leave migration retryable.

## 9. Medium Vulnerabilities

### SEC-005 — Idle-Expired Unlock Grants Can Be Revived

**Severity:** Medium  
**Status:** Confirmed  
**OWASP Category:** A07 Identification and Authentication Failures  
**Affected files:** `supabase/functions/security/index.ts:182-207`, `supabase/functions/security/index.ts:568-573`, `src/lib/securityService.ts:158-166`  
**Affected component:** App unlock session idle timeout

**Description:** `getGrant` enforces idle timeout only when `applyAutoLock` is requested. `lock/touch` calls it without that option and then updates `last_active_at`. A token that should have expired due to inactivity can therefore be made active again as long as its 24-hour absolute expiry has not passed.

**Attack scenario:** An attacker obtains the browser-stored unlock token and Supabase session, waits beyond the configured auto-lock duration, calls `lock/touch`, and then uses the revived grant.

**Impact:** Auto-lock bypass and extension of a secondary-authenticated session.

**Evidence:** `lock/touch` uses `getGrant(admin, user.id, unlockToken)` instead of `{ applyAutoLock: true }`.

**Root cause:** Touching a session is allowed before verifying that the session is still touchable.

**Recommended remediation:** Apply server-side idle expiration on every grant-consuming path, especially `lock/touch` and fresh-grant checks. Do not permit an expired grant to update its own activity timestamp. Consider an absolute maximum lifetime shorter than 24 hours for browser-stored unlock grants.

**Secure implementation example:**

```ts
const grant = await getGrant(admin, user.id, unlockToken, { applyAutoLock: true });
if (!grant) throw new HttpError(401, 'unlock_required', 'Unlock the app to continue.');
```

**Verification:** Create a disposable grant, advance/alter its server `last_active_at` beyond the configured duration, and verify that `lock/touch` returns 401 and does not modify the row.

### SEC-006 — Logout Cleanup Depends on a Successful Security-Service Call

**Severity:** Medium  
**Status:** Confirmed  
**OWASP Category:** A07 Identification and Authentication Failures; A04 Insecure Design  
**Affected files:** `src/pages/Profile.tsx:30-44`, `src/lib/securityService.ts:173-175`, `src/App.tsx:44-53`  
**Affected component:** Logout and local-data cleanup

**Description:** Logout awaits `revokeAllSecuritySessions` before calling `supabase.auth.signOut()` and clearing sensitive local data. If the Edge Function is unavailable, blocked, or misconfigured, the error is caught by the outer handler and logout stops. Additionally, initial startup clears residual data on a null session only if `currentUserId` was set during that same React effect lifetime.

**Attack scenario:** A network failure or blocked security endpoint prevents a user from logging out on a shared device. The Supabase session and plaintext financial data remain available locally. On a fresh load where the auth session is already absent, stale domain/contact data can also remain on disk.

**Impact:** Residual authenticated session and local PII exposure on shared/lost devices; misleading logout behavior.

**Root cause:** Remote revocation is treated as a prerequisite for local logout instead of best effort.

**Recommended remediation:** Always clear the local Supabase session, unlock grants, domain data, handoffs, and contact draft in `finally`, regardless of remote failures. Attempt server revocation best-effort and surface that remote sessions may remain. On startup with no session, clear any sensitive unbound cache regardless of the in-memory `currentUserId` value.

**Secure implementation example:**

```ts
try {
  await revokeAllSecuritySessions(userId);
} catch {
  // Record/notify that remote revocation will require retry.
} finally {
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  clearCloudRuntimeState();
  clearLocalSecurityState(userId);
  clearSensitiveLocalData();
  await clearContactImportDraft();
}
```

**Verification:** Block the Edge Function and press Sign Out. The UI must return to authentication, local storage/IndexedDB must be cleared, and the app must not display private data offline.

### SEC-008 — Contact PII Cache Is Not User-Bound, Expiring, or Cleared on Cancel

**Severity:** Medium  
**Status:** Confirmed  
**OWASP Category:** A04 Insecure Design; privacy/data minimization  
**Affected files:** `src/lib/contactImport.ts:58-61`, `src/lib/contactImport.ts:225-275`, `src/pages/ContactImport.tsx:73-93`, `src/pages/ContactImport.tsx:219-226`  
**Affected component:** Contact Picker local cache

**Description:** Selected names, phone numbers, and emails are stored under one global IndexedDB key. The cache has no authenticated user ID, expiry, or maximum age. Navigating back/canceling the flow does not clear it; it is cleared only after complete success, explicit cache clearing, or a successful logout cleanup path.

**Attack scenario:** A user abandons an import on a shared browser. A later user or script on the same origin loads the stale draft and sees the selected contacts.

**Impact:** Local disclosure of third-party contact PII and accidental import into the wrong account.

**Root cause:** A workflow-resume cache is treated as global application state rather than user-scoped sensitive data.

**Recommended remediation:** Store `ownerUserId`, `createdAt`, and `expiresAt`; reject drafts for another user or older than a short period. Clear on cancel/back, signout (including failure cases), and initial unauthenticated startup. Consider session-only storage unless persistence is explicitly enabled by the user.

**Secure implementation example:**

```ts
type CachedDraft = ContactImportDraft & {
  ownerUserId: string;
  expiresAt: string;
};

if (draft.ownerUserId !== user.id || Date.parse(draft.expiresAt) <= Date.now()) {
  await clearContactImportDraft();
  return undefined;
}
```

**Verification:** Abandon a draft, sign out under forced Edge failure, and sign in as a second test user. The second user must not see the first user's contacts. Expired drafts must be deleted.

### SEC-009 — Public Authenticated APIs Lack Schema, Size, and Abuse Quotas

**Severity:** Medium  
**Status:** Confirmed application gap; Supabase platform limits are **NOT VERIFIED**  
**OWASP Category:** OWASP API4 Unrestricted Resource Consumption; A04 Insecure Design  
**Affected files:** `supabase/schema.sql:1-4`, `supabase/schema.sql:38-43`, `src/lib/cloudData.ts:75-83`, `src/lib/friendImportService.ts:58-83`, `supabase/functions/security/index.ts:299-310`  
**Affected component:** `app_data`, friend imports, security Edge Function

**Description:** Any authenticated user can upsert an arbitrary JSON document into `app_data`. There is no schema/shape/byte-size constraint, per-user storage quota, or application-layer write rate limit. Friend text fields have no maximum lengths. The Edge Function parses request JSON before action-specific validation and has no application rate limiter.

**Attack scenario:** A malicious signup repeatedly sends large JSON documents, unusually long friend fields, repeated full-document updates, or high-rate security actions to consume database, bandwidth, Edge CPU/memory, and project quota.

**Impact:** Service degradation, cost amplification, quota exhaustion, and self-account data corruption. Cross-tenant reads remain blocked by RLS.

**Root cause:** RLS enforces ownership but not resource consumption or data invariants.

**Recommended remediation:** Route writes through validated RPC/Edge actions or add database constraints for JSON byte size and text length. Introduce per-user/IP quotas and rate limits, cap batch sizes/concurrency, debounce full-document sync, and monitor high-volume accounts. Validate all numeric/date/relationship invariants if this becomes collaborative or authoritative financial data.

**Secure implementation example:**

```sql
alter table public.app_data
add constraint app_data_max_size
check (octet_length(data::text) <= 1048576);

alter table public.friends
add constraint friends_name_length check (char_length(name) between 1 and 120),
add constraint friends_email_length check (email is null or char_length(email) <= 320);
```

Use limits appropriate to product requirements rather than blindly adopting these sample values.

**Verification:** Test boundary-sized payloads against a disposable environment. Oversized/over-rate requests must fail predictably without expensive downstream work; normal sync/import must remain functional.

### SEC-010 — Netlify Deployment Path Omits Security Headers

**Severity:** Medium  
**Status:** Confirmed configuration; Netlify runtime not deployed/tested  
**OWASP Category:** A05 Security Misconfiguration  
**Affected files:** `netlify.toml:1-6`, `vercel.json:6-18`, `DEPLOYMENT.md:68-73`  
**Affected component:** Alternative production hosting

**Description:** Vercel receives a strong CSP, clickjacking protection, nosniff, referrer, and permissions headers. The documented Netlify alternative defines only build settings, so the same application deployed there would not receive those repository-defined protections. Neither repository configuration explicitly defines HSTS; platform behavior may add it but was not verified for the actual app response.

**Attack scenario:** A Netlify deployment is framed or runs without the CSP/nosniff/referrer restrictions developers assume are universal, increasing impact if an injection or third-party compromise is introduced later.

**Impact:** Clickjacking and reduced defense-in-depth against XSS/content-type/referrer leaks.

**Root cause:** Security headers are host-specific and duplicated incompletely.

**Recommended remediation:** Add equivalent Netlify `[[headers]]` rules and automated response-header tests for every supported host. Add HSTS after confirming HTTPS-only operation. Consider self-hosting Google Fonts so CSP can remove external style/font origins and narrow `img-src https:`.

**Secure implementation example:**

```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains"
    Content-Security-Policy = "default-src 'self'; object-src 'none'; frame-ancestors 'none'; ..."
```

**Verification:** Deploy to each supported host and assert headers on HTML, service worker, manifest, and asset responses. **NOT VERIFIED — requires runtime/staging verification.**

## 10. Low Vulnerabilities

### SEC-011 — CSV Export Does Not Neutralize Spreadsheet Formulas

**Severity:** Low  
**Status:** Potential exploitability; sink confirmed  
**OWASP Category:** A03 Injection  
**Affected files:** `src/pages/settings/AccountSettingsPages.tsx:111-115`  
**Affected component:** CSV export

**Description:** CSV values are quote-escaped but cells beginning with spreadsheet formula prefixes (`=`, `+`, `-`, `@`, tab, or carriage return) are not neutralized. Quoting does not prevent formula evaluation in many spreadsheet applications.

**Attack scenario:** A malicious value reaches an expense title or notes field through imported/synchronized data and the user opens the CSV in a spreadsheet application that evaluates formulas.

**Impact:** Formula execution in the spreadsheet security context, potentially causing external requests or misleading content. Current exploitability is reduced because the application is single-user and has no shared write source.

**Root cause:** CSV syntax escaping is mistaken for spreadsheet-content neutralization.

**Recommended remediation:** Prefix dangerous cells with an apostrophe or tab according to the target spreadsheet policy, then quote normally. Document that exports are data, not formulas.

**Secure implementation example:**

```ts
function spreadsheetSafe(value: unknown) {
  const text = String(value ?? '');
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

const quote = (value: unknown) =>
  `"${spreadsheetSafe(value).replace(/"/g, '""')}"`;
```

**Verification:** Export cells beginning with every dangerous prefix and confirm they display as literal text in supported spreadsheet applications.

### SEC-012 — Raw Backend/Auth Errors Reach the UI

**Severity:** Low  
**Status:** Confirmed disclosure; account enumeration is **NOT VERIFIED**  
**OWASP Category:** A05 Security Misconfiguration; A07 Identification and Authentication Failures  
**Affected files:** `src/pages/Auth.tsx:55`, `src/App.tsx:68`, `src/App.tsx:122`, `src/lib/friendImportService.ts:42-45`, `src/pages/settings/SecurityPages.tsx:168-183`  
**Affected component:** Error handling

**Description:** Several UI paths render raw Supabase SDK/PostgREST error messages. Unknown friend-insert errors return database messages directly. Auth message uniformity depends on Supabase dashboard behavior.

**Attack scenario:** An attacker submits edge-case inputs and observes constraint, table, configuration, or account-state details; differing auth responses may aid enumeration.

**Impact:** Internal information disclosure and possible account discovery.

**Root cause:** Backend errors are used as user-facing copy without a stable mapping layer.

**Recommended remediation:** Map known error codes to neutral product messages, log a correlation ID server-side, and avoid table/constraint details. Use the same external response for nonexistent accounts and invalid credentials. Confirm signup/reset/email-change enumeration behavior in staging.

**Secure implementation example:**

```ts
const publicMessage = knownErrors[error.code ?? ''] ??
  'The request could not be completed. Try again.';
```

**Verification:** Exercise invalid login, existing signup, malformed friend insert, and unavailable schema cases. Responses must not reveal whether an account exists or expose SQL/table details.

### SEC-013 — Auth and Unlock Tokens Are Readable by JavaScript

**Severity:** Low  
**Status:** Potential; no application XSS sink was found  
**OWASP Category:** A07 Identification and Authentication Failures; A02 Cryptographic Failures  
**Affected files:** `src/lib/supabase.ts:15-16`, `src/lib/securityService.ts:11`, `src/lib/securityService.ts:74-90`, `src/lib/securityService.ts:181-188`  
**Affected component:** Browser session storage

**Description:** Supabase sessions use persistent browser storage by default, and non-immediate App Lock grants are explicitly stored in `localStorage`. Any successful same-origin script execution or sufficiently privileged extension can steal both account and unlock tokens.

**Attack scenario:** A future XSS, compromised third-party script, or malicious extension reads the tokens and replays them.

**Impact:** Account/session compromise and secondary-lock bypass. Current exploitability is reduced by React escaping and a CSP without `unsafe-inline`/`unsafe-eval` for scripts.

**Root cause:** A pure SPA cannot set a true server-managed HttpOnly session, and unlock grants are intentionally persisted client-side.

**Recommended remediation:** For stronger protection, use a same-origin backend-for-frontend with Secure, HttpOnly, SameSite cookies and server-side refresh/session handling. Otherwise shorten token/grant lifetimes, prefer session/memory storage, rotate on sensitive changes, maintain the strict CSP, remove unnecessary third-party origins, and add XSS regression tests.

**Verification:** Confirm no session/unlock token appears in JavaScript-readable persistent storage under the chosen architecture; validate cookie flags if a BFF is introduced.

### SEC-014 — Mixed npm Registry Provenance and No Edge Function Lockfile

**Severity:** Low  
**Status:** Confirmed; sampled tarball integrity matched canonical npm  
**OWASP Category:** A08 Software and Data Integrity Failures  
**Affected files:** `package-lock.json:2056`, `package-lock.json:2947`, `package-lock.json:4177`, `package-lock.json:7049`, `supabase/functions/security/index.ts:1-8`  
**Affected component:** Software supply chain

**Description:** The npm lockfile mixes canonical npm and `registry.npmmirror.com`, including security-sensitive WebAuthn/browser code. Integrity hashes are present and the sampled packages matched canonical npm. The Edge Function pins npm versions but has no committed Deno lockfile.

**Attack scenario:** A future lockfile regeneration through an unexpected mirror or unreviewed Edge dependency resolution introduces a compromised artifact that remains integrity-pinned after the fact.

**Impact:** Supply-chain code execution in browser/build/Edge contexts.

**Root cause:** Non-uniform registry configuration and missing lock metadata for the Deno deployment unit.

**Recommended remediation:** Standardize on the organization-approved registry, regenerate the npm lockfile from that registry, review the diff, enforce `npm ci`, commit a Deno lockfile/vendor policy, and automate dependency provenance checks. Self-host or remove remote Google Fonts if minimizing third-party runtime dependencies.

**Verification:** CI must fail if lockfile `resolved` hosts are outside the allowlist or if Edge dependency resolution changes without lockfile review.

### SEC-015 — Security Monitoring and Alerting Are Incomplete

**Severity:** Low  
**Status:** Confirmed  
**OWASP Category:** A09 Security Logging and Monitoring Failures  
**Affected files:** `supabase/functions/security/index.ts:150-166`, `supabase/functions/security/index.ts:532-541`, `supabase/functions/security/index.ts:621-629`, `supabase/schema.sql:203-222`  
**Affected component:** Security event logging and operations

**Description:** The app records selected security events, but insert failures are ignored, repeated PIN failures do not trigger alerts, successful password account logins/email changes/logout failures are not represented in this application log, and there is no retention/alerting/central monitoring configuration in the repository.

**Attack scenario:** Credential abuse or repeated PIN attacks remain visible only in provider logs or a small in-app feed and are not detected promptly.

**Impact:** Longer attacker dwell time and reduced forensic confidence.

**Root cause:** Logging is implemented as a user-facing activity feature rather than a monitored security control.

**Recommended remediation:** Treat event-write failures as observable operational errors, add rate/threshold alerts, centralize redacted security telemetry, define retention, and record changes to auth factors, email, recovery, logout, and admin/deployment configuration. Never log PINs, JWTs, challenges, credentials, passwords, or raw contact/financial data.

**Verification:** Trigger safe test events and confirm ingestion, redaction, retention, correlation, and alert delivery; simulate logging failure and confirm it is operationally visible.

## 11. Informational Findings and Positive Controls

1. **Static RLS ownership is strong.** `app_data`, `friends`, and preferences use both `USING` and `WITH CHECK` where needed. No cross-user query omission was found. Runtime two-user testing remains required.
2. **Security tables are least-privileged.** Authenticated clients cannot write PIN hashes, WebAuthn material, challenges, or unlock sessions. The service-role key is referenced only via Edge environment variables.
3. **Secrets:** No real credential signature was found in the current tree or Git history. `.env` patterns are ignored and only `.env.example` is tracked. No `Secret detected — rotate immediately` condition was found.
4. **XSS/injection:** No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, command execution, raw dynamic SQL, XML parser, or server-side URL fetch was found. React text interpolation is used consistently.
5. **WebAuthn ceremony verification is strong.** Challenges are user-scoped, short-lived, origin/RP-bound, marked used, and require user verification. Private keys/biometrics are not stored.
6. **PIN storage is strong.** Argon2id uses a random salt and meaningful memory/iteration settings; only hashes/configuration are stored server-side.
7. **PWA cache review:** The generated worker precaches static assets and HTML only. Supabase API responses are not matched by the document runtime cache. No authenticated-response cache leak was found.
8. **CSP:** Vercel's CSP blocks plugin objects, frames, inline/eval scripts, and limits API connections to Supabase. `style-src 'unsafe-inline'` and `img-src https:` remain hardening opportunities.
9. **CSRF:** State-changing calls use bearer authorization rather than automatically attached auth cookies; Edge requests also validate Origin. No state-changing GET endpoint was found.
10. **CORS:** The Edge response uses `Access-Control-Allow-Origin: *`, but every functional request separately enforces an exact configured Origin and no credential cookies are used. Echoing the validated origin plus `Vary: Origin` would be cleaner defense-in-depth.
11. **SSRF:** No server-side URL-fetch feature exists. Avatar URLs are browser-side `<img>` sources only.
12. **File uploads:** There is no backend attachment upload. Profile photos are read into a data URL with a 3 MB client limit and rendered through `<img>`; signature/type validation should be added if storage/sharing is introduced.
13. **Payments/webhooks/email jobs/admin:** None are implemented, so payment verification, webhook signature, background job, and admin authorization attack surfaces are not applicable.
14. **Source maps:** No production `.map` files were generated.

## 12. Privacy and Sensitive Data Assessment

### Sensitive data processed

- Account email and display name.
- Friends' names, phone/WhatsApp numbers, optional email and notes.
- Expense titles, merchants, dates/times, amounts, participants, notes, and repayment references.
- Profile photo data URLs.
- WebAuthn credential IDs/public keys/transports/device labels and security events.
- Supabase access/refresh session and App Lock grant tokens.

### Privacy conclusions

- Only explicitly selected device contacts enter the review flow; the full address book is not uploaded.
- Only confirmed contacts are inserted into Supabase `friends`; however, confirmed friend PII is duplicated in `friends` and `app_data`.
- Contact drafts remain local but persist longer than necessary (SEC-008).
- Financial data is plaintext in local browser storage (SEC-001).
- The service worker does not cache private API responses.
- No analytics SDK or application logging of raw contact/financial data was found.
- Remote Google Fonts receives normal browser network metadata; self-hosting would improve privacy.

## 13. Authentication, Session, and Authorization Conclusions

### Authentication

- Password hashing, email verification, reset-token behavior, brute-force throttling, and credential enumeration are managed by Supabase Auth and were not visible in this repository.
- The UI requires eight characters, but production server policy, leaked-password checks, email confirmation, CAPTCHA, and Auth rate limits are **NOT VERIFIED**.
- App Lock WebAuthn is not account-login MFA. A Supabase session can access RLS data without it (SEC-001).
- No forgot-password UI is implemented; this is a product gap, not itself a vulnerability.

### Sessions/tokens

- Supabase validates bearer tokens with `getUser()` in the Edge Function.
- Unlock tokens are cryptographically random and stored hashed server-side.
- Absolute unlock-grant expiry is 24 hours; configured idle expiry is vulnerable to revival (SEC-005).
- Client-readable persistent tokens amplify any future XSS (SEC-013).
- Logout cleanup is not failure-safe (SEC-006).

### Authorization

- No horizontal privilege escalation was found in static RLS or service-role queries; all reviewed service-role queries use JWT-derived `user.id`.
- No vertical/admin role exists.
- The secondary App Lock authorization boundary is incomplete (SEC-001 through SEC-005).

## 14. File-by-File Security Review

| File(s) inspected | Security relevance | Findings / conclusion |
| --- | --- | --- |
| `package.json`, `package-lock.json` | Dependency and scripts | SEC-014; no advisories/install scripts found |
| `.env.example`, `.gitignore` | Secrets/config | Correct placeholder and ignores; no secret found |
| `vite.config.ts` | PWA caching/manifest | Static app shell only; no API runtime cache |
| `vercel.json` | CSP/headers | Strong Vercel headers; HSTS/runtime verification pending |
| `netlify.toml` | Alternate deployment | SEC-010 |
| `supabase/config.toml` | JWT enforcement | `verify_jwt = true` |
| `supabase/schema.sql` | Database/RLS | Strong owner RLS; SEC-001/SEC-009 architecture gaps |
| `supabase/functions/security/index.ts` | Privileged backend | SEC-002, SEC-003, SEC-004, SEC-005, SEC-009, SEC-015 |
| `src/lib/supabase.ts` | Auth client/session | SEC-003, SEC-013 |
| `src/lib/cloudData.ts` | Cloud sync/migration | SEC-001, SEC-007, SEC-009 |
| `src/lib/db.ts` | Local financial persistence/business logic | SEC-001; client-authoritative validation limits |
| `src/lib/securityService.ts` | Unlock-token storage/API client | SEC-005, SEC-013 |
| `src/lib/securityPolicy.ts` and tests | Time/lock policy | Client calculations correct; server enforcement gap remains |
| `src/lib/contactImport.ts` and tests | Device contact privacy/cache | SEC-008; selection/E.164/duplicate logic good |
| `src/lib/friendImportService.ts` | Confirmed Supabase inserts | RLS owner ID is derived from authenticated user; SEC-009/SEC-012 |
| `src/lib/share.ts` | External navigation/share | Phone sanitized to digits; consider explicit `noopener` |
| `src/App.tsx` | Auth startup/data gate | Private cloud initialization occurs after UI lock; SEC-006 residual cleanup |
| `src/pages/Auth.tsx` | Login/signup | SEC-012; Supabase dashboard controls not verified |
| `src/components/SecurityProvider.tsx` | Lock lifecycle | UI gate works; SEC-001 architectural limitation |
| `src/components/AppLockGuard.tsx`, `security/LockScreen.tsx` | Route gate/unlock UI | No UI bypass found; not a data-layer boundary |
| `security/SecuritySetupFlow.tsx`, `RequireReauthentication.tsx`, `SecurityPages.tsx` | Enrollment/recovery/sensitive actions | SEC-002, SEC-003 |
| `src/pages/Profile.tsx` | Signout | SEC-006 |
| `src/pages/ContactImport.tsx` | Bulk contact review | Only ready contacts sent; SEC-008 cancel lifecycle |
| `src/pages/settings/AccountSettingsPages.tsx` | Export/cache | SEC-011; export reauth is bypassed at underlying data layer by SEC-001 |
| `src/pages/settings/EditProfile.tsx`, `Avatar.tsx` | Email/photo | Client size limit; no backend file upload; raw auth errors |
| `AddExpense.tsx`, `RecordRepayment.tsx`, `ExpenseDetail.tsx` | Financial mutations | Client-only amount/relationship checks; no cross-user authority |
| `Friends.tsx`, `FriendDetail.tsx`, `Groups.tsx`, `Statement.tsx`, `Activity.tsx`, `Home.tsx` | Domain display/routes/share | React escaping; unknown IDs mostly cause self-data integrity issues only |
| `PreferencePages.tsx`, `SupportPages.tsx`, UI components | Settings/external links | No dynamic HTML or open redirect found |
| `src/types/*`, `utils.ts`, `preferences.ts`, `install.ts`, `i18n.ts`, `cn.ts` | Supporting logic | Cryptographic UUIDs used for IDs; `Math.random` only for toast keys |
| `index.html`, `src/index.css`, static SVG/PNG assets | Entry/CSP resources/privacy cover | HTTPS Google Fonts; no executable static SVG content found; PNG signatures valid |
| `securityContract.test.ts`, `securityPolicy.test.ts`, `contactImport.test.ts` | Security regression coverage | Useful positive contracts; missing negative auth/concurrency/RLS tests |
| `README.md`, `DEPLOYMENT.md`, `SECURITY_TESTING.md` | Operational security | Good secret/RLS guidance; device/RLS matrices remain pending |
| Generated `dist/sw.js`, `manifest.webmanifest`, `registerSW.js` | PWA runtime | Static cache only; no source maps or private API caching |

## 15. OWASP Mapping

| OWASP category | Relevant findings |
| --- | --- |
| A01 Broken Access Control | SEC-001, SEC-002, SEC-007 |
| A02 Cryptographic Failures | SEC-013; plaintext local data aspect of SEC-001 |
| A03 Injection | SEC-011; no SQL/command/DOM injection found |
| A04 Insecure Design | SEC-001, SEC-006, SEC-007, SEC-008, SEC-009 |
| A05 Security Misconfiguration | SEC-010, SEC-012 |
| A06 Vulnerable and Outdated Components | No current npm advisory; major dev-tool updates only |
| A07 Identification and Authentication Failures | SEC-003, SEC-004, SEC-005, SEC-006, SEC-013 |
| A08 Software and Data Integrity Failures | SEC-014 |
| A09 Security Logging and Monitoring Failures | SEC-015 |
| A10 SSRF | No SSRF surface found |
| OWASP API4 Unrestricted Resource Consumption | SEC-004, SEC-009 |
| OWASP API5 Broken Function Level Authorization | SEC-002 |

## 16. Security Remediation Roadmap

### P0 — Fix before production

1. **SEC-001:** Decide whether App Lock is a true security boundary. If yes, enforce unlock at the data layer and encrypt local data; otherwise change product claims and threat model.
2. **SEC-002:** Require action-bound step-up authentication for PIN/WebAuthn enrollment and lock enablement.
3. **SEC-003:** Replace JWT-`iat` recovery with explicit one-time reauthentication proof.
4. **SEC-004:** Make PIN failure counting/lockout atomic and add a pre-Argon rate limiter.
5. **SEC-007:** Replace automatic legacy claim/upload with explicit, user-bound migration confirmation.
6. Run two-account RLS tests and real-device WebAuthn tests in a disposable staging project.

### P1 — Fix immediately after P0

1. **SEC-005:** Reject idle-expired grants on touch and all grant-consuming actions.
2. **SEC-006:** Make local logout/cleanup unconditional and remote revocation best effort.
3. **SEC-008:** User-bind, expire, and clear contact drafts on cancel/signout/startup.
4. **SEC-009:** Add request/data size limits, quotas, schema validation, and rate limiting.
5. **SEC-010:** Apply equivalent headers to Netlify and verify actual production responses.
6. Verify Supabase email confirmation, redirect allowlists, password policy, CAPTCHA/rate limits, session duration, and recovery configuration.

### P2 — Security hardening

1. Fix CSV formula neutralization and raw error mapping.
2. Normalize npm registry provenance and commit Edge dependency lock metadata.
3. Improve central redacted security logging and alerts.
4. Consider a BFF/HttpOnly-cookie architecture for stronger session protection.
5. Self-host fonts, narrow CSP image/style sources, add explicit HSTS/COOP/CORP as compatible.
6. Add CI security gates, RLS integration tests, rate-limit/concurrency tests, and response-header checks.

## 17. Top 10 Security Improvements

1. Enforce App Lock on the data API or encrypt data so the lock protects real records.
2. Require step-up verification before adding any PIN or WebAuthn security method.
3. Replace JWT issuance-time recovery with one-time explicit reauthentication proofs.
4. Make PIN lockout atomic and rate-limit before Argon2id.
5. Stop automatic cross-account legacy-data claiming.
6. Make logout clear local data even when backend revocation fails.
7. Expire and user-scope contact drafts and other sensitive caches.
8. Add API payload limits, per-user quotas, and abuse monitoring.
9. Apply/test the same security headers on every supported host.
10. Add automated RLS, WebAuthn authorization, concurrency, secret, dependency, and header checks to CI.

## 18. Security Scorecard

| Security Area | Score |
| --- | ---: |
| Authentication | 5/10 |
| Authorization | 6/10 |
| API Security | 5/10 |
| Database Security | 7/10 |
| Input Validation | 6/10 |
| Secret Management | 9/10 |
| Dependency Security | 8/10 |
| Frontend Security | 7/10 |
| PWA Security | 7/10 |
| Privacy | 4/10 |
| Deployment Security | 7/10 |
| Logging & Monitoring | 3/10 |

**Overall Security Score: 61/100**

The score reflects good baseline RLS, secret hygiene, injection resistance, dependency health, WebAuthn ceremony verification, and CSP design, offset by multiple high-impact secondary-authentication design flaws, plaintext sensitive browser storage, migration/privacy risks, missing abuse controls, and limited operational verification.

## 19. If I Were an Attacker

### Attack Path 1 — Bypass App Lock through the normal data API

Obtain/reuse a valid Supabase session, ignore the React lock route, query the RLS-authorized `app_data` row directly, and copy/modify the victim's financial document without an unlock grant.

### Attack Path 2 — Add an attacker-controlled security credential

Use a stolen authenticated session on the legitimate RP origin to request WebAuthn registration options and store a new credential without first proving knowledge of the existing PIN/device factor; then authenticate to obtain a fresh grant.

### Attack Path 3 — Reset the PIN after token refresh

Use a valid refresh session to obtain a newly issued access token. Because the server equates recent JWT `iat` with recent password authentication, invoke PIN recovery and issue a new recovery grant.

### Attack Path 4 — Race PIN attempts

Send concurrent wrong-PIN attempts from an authenticated test/account context so multiple requests read the same attempt count and overwrite one another, weakening progressive lockout while forcing expensive Argon2id work.

### Attack Path 5 — Recover residual shared-device data

Use a shared browser containing legacy domain data or an abandoned contact draft. Sign in first after migration or revisit contact import to claim/read data not proven to belong to the current account.

These paths are supported by reviewed code. No destructive exploitation was performed.

## 20. Production Readiness

### YES, AFTER FIXES

Do not represent the current App Lock as a strong security control or deploy it for real sensitive financial/contact data until P0 findings are resolved. The primary account/RLS isolation appears materially better than the secondary lock and did not reveal a static cross-user bypass, but it still requires two-user runtime verification in the actual Supabase project.

Before public availability, complete the following manual/runtime checks:

- Two-user select/insert/update/delete RLS matrix for every table.
- Explicit Supabase Auth email-confirmation, redirect, password, rate-limit, recovery, and session policy review.
- Real-device WebAuthn registration/authentication/counter/recovery tests across supported browsers/PWAs.
- Concurrent PIN failure and Edge rate-limit tests against disposable accounts.
- Anonymous and authenticated production header/cache/TLS tests after Vercel protection configuration is finalized.
- Logout/offline/shared-device tests, including failed Edge calls and stale contact/legacy data.

## 21. Recommended Fix Order

| Priority | Finding | Files | Required change | Compatibility risk | Tests required |
| --- | --- | --- | --- | --- | --- |
| P0 | SEC-001 | `schema.sql`, `cloudData.ts`, `db.ts`, Edge Function | Put unlock enforcement at the data layer and protect local plaintext | High — architecture/data migration | RLS, offline, sync, lock/unlock, encryption recovery |
| P0 | SEC-002 | Edge Function, `SecurityPages.tsx`, service client | Require one-time step-up for factor enrollment/enablement | Medium | Enrollment/recovery matrix, replay tests |
| P0 | SEC-003 | Edge Function, recovery UI | Remove JWT-`iat` trust; add explicit reauth proof | Medium | Forced token refresh, proof expiry/replay/action binding |
| P0 | SEC-004 | Edge Function, PostgreSQL RPC/schema | Atomic counters plus pre-hash rate limiting | Medium | Concurrent failure, exact threshold, DoS-budget tests |
| P0 | SEC-007 | `cloudData.ts`, startup/migration UI | Explicit user-bound legacy import confirmation | Medium | Shared browser, failed upload, retry/discard tests |
| P1 | SEC-005 | Edge Function | Apply idle expiry on touch/all grant uses | Low | Server-time idle expiry and revival regression |
| P1 | SEC-006 | `Profile.tsx`, `App.tsx` | Unconditional local signout/cleanup | Low | Offline/blocked Edge/crash/shared-device tests |
| P1 | SEC-008 | `contactImport.ts`, `ContactImport.tsx`, auth cleanup | User-bind, expire, validate, clear drafts | Low | Account switch/cancel/expiry/IndexedDB failure tests |
| P1 | SEC-009 | Schema, Edge Function, sync/import service | Size/schema/quota/rate controls | Medium | Boundary and abuse tests |
| P1 | SEC-010 | `netlify.toml`, deployment tests | Match Vercel headers and add verified HSTS | Low | Automated header/TLS/CSP smoke tests |
| P2 | SEC-011 | `AccountSettingsPages.tsx` | Neutralize formula-prefixed CSV cells | Low | Spreadsheet fixture tests |
| P2 | SEC-012 | Auth/import/startup error mapping | Redact and normalize public errors | Low | Enumeration and error-contract tests |
| P2 | SEC-013 | Auth architecture / grant storage | Reduce JS-readable token exposure | High if BFF adopted | Session rotation/logout/XSS-defense tests |
| P2 | SEC-014 | Lockfiles/registry/CI | Canonical registry allowlist and Deno lock | Low | Reproducible clean install/build |
| P2 | SEC-015 | Edge/operations | Central redacted monitoring and alerts | Low | Event/redaction/alert failure tests |

---

**Assessment conclusion:** The repository shows deliberate security work and good foundational controls, especially RLS, secret handling, CSP, Argon2id, and WebAuthn verification. The remaining high-risk issues are concentrated in the boundary between the normal Supabase session and the advertised App Lock. Resolve that boundary first; hardening unrelated UI details will not compensate for it.

---

## 22. Remediation Update — 2026-08-15

The requested security remediation has been implemented in the repository. This update reflects code and configuration review after the changes; it is **not** a claim that the database policy or Edge Function is already deployed to production.

| Finding | Remediation status | Implemented control |
| --- | --- | --- |
| SEC-001 | Code remediated; deployment verification required | Private `app_data`, confirmed-friend imports, and the security activity feed now use App Lock-aware Edge Function actions. `security_enforcement.sql` revokes direct browser table access as the final staged rollout step. Runtime data is tab-scoped and cleared when locked. |
| SEC-002 | Code remediated; deployment verification required | First-time App Lock setup requires a short-lived, action-bound password proof; later device enrollment requires a fresh App PIN or WebAuthn grant. |
| SEC-003 | Code remediated; deployment verification required | PIN recovery no longer trusts JWT `iat`. It requires a fresh unlock grant or a one-time password-recovery proof. |
| SEC-004 | Code remediated; deployment verification required | Atomic PostgreSQL PIN-attempt claiming and server-side user/IP-bucket rate limiting happen before Argon2id verification. |
| SEC-005 | Code remediated | All grant uses, including touch, apply server-side idle expiry. |
| SEC-006 | Code remediated | Logout clears private runtime data, legacy data, contact drafts, grants, and local auth state in `finally`, even when remote revocation fails. |
| SEC-007 | Code remediated | Legacy browser data requires explicit signed-in-user confirmation before import and is removed only after a successful selected action. |
| SEC-008 | Code remediated | Contact drafts and expense handoffs are user-bound, time-limited, validated, and cleared on lock, exit, and sign-out. |
| SEC-009 | Code remediated | Request/body limits, app-document schema/size validation, controlled friend batches, database constraints, and rate-limit tables were added. |
| SEC-010 | Code remediated | Netlify now matches the Vercel security-header baseline, including CSP, HSTS, frame protection, and Permissions Policy. |
| SEC-011 | Code remediated | CSV cells with formula-like prefixes are neutralized before export. |
| SEC-012 | Partially remediated | Public auth, cloud-data, contact-picker, friend-import, and profile-update errors are normalized. Security-service errors remain controlled server messages. |
| SEC-013 | Risk reduced | Supabase and unlock tokens are now tab-scoped rather than persisted in `localStorage`. A BFF/HttpOnly-cookie architecture remains a defense-in-depth option. |
| SEC-014 | Code remediated | npm lockfile URLs use the canonical registry; security Edge Function dependencies are exact, mapped, and protected by a frozen `deno.lock`. |
| SEC-015 | Code remediated operationally | Sanitized security events, a server-only `security_alerts` queue, rate-limit alerts, and structured server error logs were added. An operator must connect the alert queue to their monitoring workflow. |

### Post-remediation validation

- `npm test`: passed — 4 files, 26 tests.
- `npm run lint`: passed.
- `npm run build`: passed.
- `deno check --frozen --config supabase/functions/security/deno.json supabase/functions/security/index.ts`: passed.
- Existing dependency integrity values were preserved while lockfile registry URLs were standardized.

### Required deployment verification

1. Run the additive `supabase/schema.sql` migration.
2. Deploy the frozen `security` Edge Function and updated frontend.
3. Confirm lock/unlock, import, recovery, logout, and two-user isolation with test accounts.
4. Run `supabase/security_enforcement.sql` only after those checks pass.
5. Verify deployed headers and configure a monitored operational path for `security_alerts`.
