# App Lock security verification

Automated policy and contract tests run with:

```bash
npm test
npm run lint
npm run build
npx -y deno check --node-modules-dir=auto supabase/functions/security/index.ts
```

WebAuthn ceremonies must also be tested on real hardware because browsers do not expose biometric sensors to synthetic test runners. Complete this matrix against the deployed HTTPS Vercel origin after the Supabase schema, Edge Function, and WebAuthn secrets are configured.

## Device matrix

| Platform | Browser / mode | Authentication configuration | Result |
|---|---|---|---|
| Android | Chrome | Fingerprint | Pending real-device test |
| Android | Installed PWA | Fingerprint or screen lock | Pending real-device test |
| iPhone | Safari | Face ID / Touch ID / device passcode | Pending real-device test |
| iPhone | Home Screen Web App | Face ID / Touch ID / device passcode | Pending real-device test |
| Windows | Chrome | Windows Hello | Pending real-device test |
| Windows | Edge | Windows Hello | Pending real-device test |
| macOS | Chrome | Touch ID or login password | Pending real-device test |
| macOS | Safari | Touch ID or login password | Pending real-device test |
| Any | Supported browser | Device PIN only | Pending real-device test |
| Any | Browser without platform authenticator | None | Pending real-device test |

Do not label a result as fingerprint or face authentication unless the platform explicitly identifies it. The application should continue to use “Device Security.”

## Acceptance scenarios

1. App Lock off: sign in and confirm the normal app opens.
2. Enable App Lock: register Device Security, create and confirm a 6-digit PIN, choose 5 minutes, and confirm both methods appear enabled.
3. Immediately: background or close the installed PWA, reopen it, and confirm `/unlock` appears before private UI or `app_data` requests.
4. WebAuthn unlock: use the platform prompt and confirm successful server verification unlocks immediately.
5. Cancel WebAuthn: cancel the platform prompt and confirm the app stays locked without an alarming error; PIN remains available.
6. Valid PIN: enter six correct digits and confirm automatic unlock.
7. Failed PIN: enter five invalid PINs and confirm a 30-second delay; continue to eight and ten failures to verify progressive delays.
8. Five-minute grace: return after two minutes and confirm the session remains available.
9. Five-minute expiry: return after six minutes and confirm authentication is required before private UI is restored.
10. Refresh while locked: refresh and confirm the app remains at `/unlock` with no dashboard flash.
11. Change PIN: confirm fresh Device Security or PIN verification is required and the old PIN no longer works.
12. Disable App Lock: confirm fresh verification and the destructive confirmation dialog are both required.
13. Remove credential: remove one authenticator and confirm App PIN still works.
14. Unsupported platform: confirm the app offers App PIN and does not render a fake biometric action.
15. Export all data: confirm verification is required if the last strong verification is older than five minutes.
16. Logout: confirm unlock grants, runtime data, cached financial records, and pending challenges are cleared.
17. Multiple authenticators: add two or more devices, rename them, authenticate with each, and remove one without affecting the others.
18. Recovery: use Device Security when available; otherwise re-enter the Supabase account password, create a new PIN, and confirm a recovery event appears.
19. Offline: confirm Device Security explains that a connection is needed and no insecure bypass appears.
20. RLS: while signed in as a second account, verify that `app_data` and security event queries cannot read the first account’s rows.

## Privacy inspection

- Confirm the database contains only WebAuthn credential ID, public key, sign counter, transport information, labels, and timestamps—never biometric data or private keys.
- Confirm `security_profiles` contains only an Argon2id hash, unique salt/configuration, counters, and timestamps—never a raw PIN.
- Confirm logs, analytics, network URLs, and `security_events.metadata` never contain PINs, challenges, credentials, unlock grants, secrets, or biometric data.
- Confirm the app-switcher privacy cover appears when the page becomes hidden where the browser gives the PWA enough time to paint it. Do not claim native screenshot blocking.
