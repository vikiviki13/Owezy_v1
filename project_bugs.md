# Owezy — Project Bug Report

**Analyzed:** 2026-09-23  
**Basis:** Full source review (`src/`, `services/`, `supabase/`), `tsc -b`, `vite build`, `vitest run`, `oxlint`.

## P0 — RESOLVED

All five P0 items were fixed in the following commits (fix + regression tests):

| ID | Fix |
|----|-----|
| H1 | `financialSummary.ts` per-friend attribution: uses the friend's own `share_amount − amountPaidBy(expense, friend)` instead of the whole `recoverable_amount`; 2 new multi-participant/third-party-payer tests |
| H2 | `clearFriendData` no longer tombstones the friend (moved to `deleteFriend`); removed participant rows on shared expenses and group memberships are now tombstoned + queued for sync |
| H3 | Direction-aware ledger: `LedgerEntry.sign/direction`, `to_friend` = "Paid to friend" (+), `from_friend` = "Payment received" (−); `StatementResult.periodPaidToFriend`/`periodAdvanced`; friend-paid expenses appear as "Advanced for you"; updated Statement, FriendDetail, Home, Activity, and `share.ts` |
| H4 | `recordRepayment` validation + allocation now capped at the contribution-aware net outstanding (`pending_amount − amountPaidBy`, clamped ≥ 0) |
| H8 | `mergeAppData(nowMs)` injectable clock; tests pass deterministic `NOW_MS`; vitest excludes `.kilo/**` in `vite.config.ts` (`.kilo` now also gitignored) |

**Verification after fixes:** ✅ `vitest run` — 76/76 pass (was 72 with 4 failures) · ✅ `vite build` · ✅ `oxlint` 0 errors.

## Verification status

| Check | Result |
|-------|--------|
| TypeScript / production build | ✅ Passes |
| Lint (oxlint) | ✅ 0 errors (1 "file too long" info on `SecurityPages.tsx`) |
| Unit tests | ✅ 76/76 pass (P0 fixes + regression tests) |
| Bundle size | ⚠️ 1.30 MB (416 KB gzip); >500 KB chunk warning |

---

## CRITICAL / HIGH

### H1. Export financial summary double-counts every multi-participant expense
**Files:** `src/lib/export/financialSummary.ts:27-38, 84-88` (root cause `src/lib/db.ts:443`)
**Verified:** `recoverable_amount` = sum of **all** participants' shares (`db.ts:443`), but `initialOwed()` (`financialSummary.ts:28`) adds the whole amount to **each** friend's report, and `buildFinancialSummary` sums those per-friend reports (`:51-52`). A ₹3000 expense split 3 ways reports ₹9000 "friends owe me".
**Impact:** Every CSV/PDF/JSON export and summary is inflated by the number of participants; statements are materially wrong.
**Fix:** Use the friend's own `share_amount`/`paid_amount` from `expenseParticipants` instead of `recoverable_amount`; add a multi-participant regression test.

### H2. "Clear financial history" tombstones (deletes) the friend on every device
**Files:** `src/lib/db.ts:365-368`, `src/pages/ManageFriend.tsx:52-56`
**Verified:** `clearFriendData()` records a `friend` tombstone + `SERIES 'DELETE'` but never removes the friend from the local cache. In cloud merges, `isDeletedByTombstone` (`conflictResolver.ts:128-134`) drops the friend from the merged doc, so the contact silently vanishes app-wide and the sync layer flip-flops pushing a stale local copy.
**Impact:** User asked for history to be cleared; the friend (and on non-originating devices, the friend entirely) is deleted. Silent data loss.
**Fix:** "Clear financial history" must NOT tombstone/enqueue the friend — only clear expenses/repayments/dues (use `clearFriendDues`-style money-only wipe).

### H3. Repayment direction ignored — "paid to friend" shown as "payment received" and reverses statements
**Files:** `src/lib/db.ts:799-838`, `src/pages/Home.tsx:23`, `src/pages/Activity.tsx:32`, `src/pages/Statement.tsx:125`, `src/pages/FriendDetail.tsx:121`, `src/pages/RecordRepayment.tsx:48/102` (`to_friend` is a supported flow)
**Verified:** `friendLedger` (`db.ts:806`) hard-codes title `'Payment received'` and subtracts **all** repayments from the running balance (`running - entry.amount`), so a `to_friend` repayment (money you paid OUT) increases the friend's owed amount in the ledger, is shown green `+₹` in Home/Activity/FriendDetail, and `calculateStatement` (`:837`) treats it as received money.
**Impact:** Balances, statements, and activity feeds are financially reversed for every "Paid to friend" repayment.
**Fix:** Branch on `r.direction` in `friendLedger`, `calculateStatement`, `Home`, `Activity`, `Statement`, and `FriendDetail`.

### H4. Repayment over-payment validation uses gross `pending_amount` instead of net debt
**Files:** `src/lib/db.ts:577-580` vs `:664-673`
**Verified:** When a friend contributed at purchase time, `calculateFriendBalance` nets the contribution (`totalPaidByYou = share_amount − amountPaidBy`), but `recordRepayment` validates `amount` against the participant's gross `pending_amount`. The extra is recorded as a repayment but credited nowhere in balances.
**Impact:** Over-repayment silently accepted; friend's owed amount, displayed balance, and validation ceiling disagree.
**Fix:** Validate against the same net figure `calculateFriendBalance` uses (or cap per-participant by `max(0, share − paid − contributed)`).

### H5. WhatsApp / share links broken for manually added friends (no country code)
**Files:** `src/lib/share.ts:40`, `src/pages/AddExpense.tsx:201`, `src/pages/Friends.tsx:128` (`whatsapp_number = phone.trim()`)
**Verified:** Manual friends store a raw local number (e.g. `98765 43210`); `shareToWhatsApp` strips non-digits → `wa.me/9876543210` (missing `+91`), which WhatsApp cannot resolve. Imported friends only work because `friendImportService` stores E.164.
**Impact:** Share/reminder buttons open a blank/wrong chat for the most common friend-creation path.
**Fix:** Normalize to E.164 on save and prefer `whatsapp_e164` first everywhere.

### H6. GitHub "New update available" fires on the current version (and may hit the wrong repo)
**Files:** `src/services/githubNotifications.ts:84-106`, `:15-16`
**Verified:** No comparison to `APP_VERSION`; any release with notes notifies "New update available: 1.0.0" to users already on 1.0.0. Also `REPO_OWNER = 'anomalyco'`, while the app remote is `vikiviki13/Owezy_v1`.
**Impact:** Misleading update toasts; potential fetch of a non-existent/foreign repo release.
**Fix:** Compare `notes.version` to `APP_VERSION` (semver-aware); confirm the repo owner.

### H7. PWA auto-update silently hard-reloads the app; manual update prompt is dead code
**Files:** `vite.config.ts:12` (`registerType: 'autoUpdate'`), `src/components/AppUpdatePrompt.tsx:51-60`
**Verified:** With `autoUpdate`, `needRefresh` is never set, so the "Update Now" UI is unreachable; meanwhile `controllerchange` triggers `window.location.reload()` the instant a new build activates.
**Impact:** Users can lose in-progress form state (e.g. composing an expense) with no warning or opt-out.
**Fix:** Either set `registerType: 'prompt'` and wire the UI, or remove the reload-on-controllerchange behavior.

### H8. Test suite is failing — tombstone retention is wall-clock dependent (flaky by date)
**Files:** `src/services/sync/conflictResolver.ts:123-125`, `src/services/sync/conflictResolver.test.ts:60-91`
**Verified:** `mergeTombstones` computes `cutoff = new Date(Date.now() - 30d)`. The tests use tombstone dates that are now >30 days old, so `mergeTombstones` drops them and the "drops tombstoned records / reconciles children" assertions fail. Tests passed only when their fixed dates were inside the window.
**Impact:** CI is red; also a correctness risk — tombstone expiry can resurrect deleted records for devices offline >30 days.
**Fix:** Inject `now` into `mergeTombstones` (deterministic), fix tests, and document the offline >retention-window edge case.

### H9. Contact import is re-entrant — double-click creates duplicate friends
**Files:** `src/pages/ContactImport.tsx:164-205`
**Verified:** `runImport` has no in-flight guard; the import button isn't disabled while saving. Two rapid clicks each call `createImportedFriendsBatch`, inserting fresh server rows with new IDs (dedupe by `friend.id` can't catch them).
**Impact:** Duplicate friend profiles from one import.
**Fix:** Add an `isImporting` ref/guard and disable the button during `saving`.

### H10. Archived group members silently included in group expense splits (and unremovable)
**Files:** `src/pages/AddExpense.tsx:48-63, 152-155, 302`
**Verified:** `getGroupMembers` doesn't filter archived friends; URL `?group=` pre-selects them, they don't appear in the picker (`friends` excludes archived), the chip skips render (`if (!f) return null`), and they're still charged a share.
**Impact:** Hidden participant silently pays/owes; shown friends' split math is wrong.
**Fix:** Filter/guard archived members in group preset for expense splits.

---

## MEDIUM

### M1. `deleteExpense` unlinks repayments without bumping `updated_at` or enqueueing — cross-device sync divergence
**Files:** `src/lib/db.ts:516-518`
Verified: rep `expense_id` changed in place, no `enqueue('repayment', id, 'UPDATE')`. `mergeRecordArray` keeps the local side on equal timestamps → devices permanently disagree, cloud record flip-flops.
**Fix:** Bump `updated_at` and enqueue the update.

### M2. Orphan attachments survive `deleteExpense` / offline cache
**Files:** `src/lib/db.ts:514-518` (no attachments filter), `:254-258`, `src/pages/settings/AccountSettingsPages.tsx:81-90`
**Impact:** "Stored receipts"/storage stats and JSON backups stay inflated for deleted expenses; wasted localStorage.

### M3. Password length policy blocks legitimate sign-ins
**Files:** `src/pages/Auth.tsx:26-33`
Verified: 8–128 char check runs on **sign-in** too; Supabase minimum is 6. Users with 6–7 char passwords can never log in from this client.

### M4. Export date range "Last month" is off-by-one in UTC+ timezones (default IST)
**Files:** `src/pages/settings/AccountSettingsPages.tsx:113-123`
Verified: local-midnight `Date` → `.toISOString()` shifts the previous month one day earlier for UTC+ regions.

### M5. Sign-out leaves the previous user's financial dataset in localStorage
**Files:** `src/App.tsx:55-75`, `src/pages/Profile.tsx:29-38`
Verified: `clearSensitiveLocalData()` runs only on user **switch**, not on sign-out. Plaintext expenses/repayments remain under `tab_db_session_v2`.
**Impact:** Privacy gap on shared devices.

### M6. Offline first launch with cleared cache opens the app unlocked
**Files:** `src/components/SecurityProvider.tsx:51-78`
Verified: when offline and no cached lock flag, fallback sets `locked = null→false` and never schedules the auto-lock timer.
**Fix:** Fail closed (lock) when the lock preference can't be confirmed.

### M7. `runImport` rejection has no handler — import stuck on spinner
**Files:** `src/pages/ContactImport.tsx:164-205`
Verified: no try/catch around `createImportedFriendsBatch`/`commitImportedFriends`; callers use `void runImport(...)`.

### M8. PDF export truncates text at 120 chars with no wrapping
**Files:** `src/lib/export/pdfExport.ts:22`
Long titles/notes clip off the A4 page edge.

### M9. `normalizePhoneToE164` accepts invalid numbers / mangles leading-zero 10-digit inputs
**Files:** `src/lib/contactImport.ts:169-183`
Verified: `0987654321` → `+910987654321` (invalid but passes regex); `+9876543210` passes with no country code.

### M10. GitHub notification repo owner mismatch
**Files:** `src/services/githubNotifications.ts:15-16`
Remote is `vikiviki13/Owezy_v1`, code queries `anomalyco/Owezy_v1` releases.

### M11. `markQueueSynced()` wipes the whole queue, dropping items enqueued mid-push
**Files:** `src/services/sync/syncQueue.ts:77-79`
A mutation enqueued while a push is in flight is silently removed → badge shows "Synced" while the newest edit is local-only.

### M12. Import chunk failure treated as full-batch failure on ambiguous network error
**Files:** `src/lib/friendImportService.ts:105-108`
If the RPC succeeded but the response was lost, all rows are reported failed and a retry re-runs the same `clientId`s server-side → duplicate friends.

---

## LOW

- **L1.** Custom split validation rounds parsed sums but persists rounded per-share values → shares can overshoot total by paise. `src/pages/AddExpense.tsx:146-155`, `src/lib/db.ts:478`.
- **L2.** "Multiple" payer check compares rounded `paymentTotal` to unrounded `totalNum` → rejects a fully-assigned bill (e.g. ₹100.005). `src/pages/AddExpense.tsx:169-172`.
- **L3.** Friends audience allows zero friends selected → personal expense mislabeled `for_friend`. `src/pages/AddExpense.tsx:225`.
- **L4.** Statement "Last 3 months" rolls into the wrong month when the target month has fewer days. `src/pages/Statement.tsx:22-25`.
- **L5.** RecordRepayment "specific expense" list includes settled-for-this-friend expenses showing ₹0 pending (dead-end/confusing). `src/pages/RecordRepayment.tsx:29, 147-169`.
- **L6.** Friends list: friends you OWE money to show as "settled ₹0" under the Settled tab with a "Pending" badge — never shows how much you owe. `src/pages/Friends.tsx:14, 103-104`, `src/lib/db.ts:684/698`.
- **L7.** WhatsApp bug-report body contains literal `\n` text instead of newlines. `src/pages/settings/BugReportPage.tsx:32-37`.
- **L8.** LockScreen countdown freezes on "00:00" after a failed PIN extends the lock (stale `retryUntil`, `now` ticker stops). `src/components/security/LockScreen.tsx:15-28`.
- **L9.** App-update check races SW install; reports "up to date" while an update is installing. `src/lib/pwaUpdate.ts:1-7`.
- **L10.** Install prompt never cleared on dismiss; re-invoking `prompt()` throws silently. `src/lib/install.ts:3-17`.
- **L11.** "App protection is off" mislabeled when lock uses device security (WebAuthn) only. `src/pages/settings/SecurityPages.tsx:50-61`.
- **L12.** `load()` throws on a stored doc without `profile` → app unusable until manual storage wipe. `src/lib/db.ts:92-96`.
- **L13.** `RequireReauthentication` renders the PIN/choose UI before the freshness check resolves; auto-completing mid-entry. `src/components/security/RequireReauthentication.tsx:19-32`.
- **L14.** Toast cleanup captures a stale timers array; later timers aren't cleared on unmount. `src/components/Toast.tsx:14-17, 23`.
- **L15.** `SecurityProvider` effect double-runs on cold start (extra server round-trip + duplicated side effects). `src/components/SecurityProvider.tsx:31, 51-78`.
- **L16.** Onboarding hard-codes `default_currency: 'INR'`, resetting returning users. `src/pages/Onboarding.tsx:522`.
- **L17.** CSV/PDF exports hard-code `en-IN` grouping, ignoring the number-format preference. `src/lib/export/csvExport.ts:6-8`, `pdfExport.ts:4-6`.
- **L18.** `.kilo/worktrees/wheat-carrot/` is scanned by vitest (duplicated tests / doubled failures). Fix `vitest` config `exclude` or delete the worktree.

---

## Recommended priority
1. **P0 (do first):** H1, H2, H3, H4 (wrong money math / data loss), H8 (red CI).
2. **P1:** H5, H6, H7, H9, H10, M3, M5, M6.
3. **P2:** M1, M2, M4, M7–M12.
4. **P3:** Low tier + `.kilo` cleanup.