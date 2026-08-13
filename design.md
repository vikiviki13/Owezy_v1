# Tab — Design System Analysis & Handoff Document

> **Purpose of this document:** This is a complete analysis of the current UI/design state of **Tab**, a mobile-first friend-expense tracker (Splitwise-style PWA). Share this file with a design engineer or AI assistant to generate a **better, unified design system** for the app.

---

## 1. Product Overview

| | |
|---|---|
| **App name** | Tab |
| **Category** | Social expense tracker ("Who owes you what") |
| **Platform** | Web app, installed as PWA; mobile-first but responsive to desktop |
| **Core flow** | Add friend → add expense (split bill) → track balance → record repayment → share statement |
| **Market** | Primarily Indian users (INR default, UPI payment methods, WhatsApp share statements) |
| **Key differentiators** | Privacy-first (app lock, PIN, passkeys, auto-lock), local-first storage with optional Supabase sync, onboarding, rich preferences (currency/date/time/theme) |

### Screens inventory
- **Auth** — sign in / create account with segmented toggle
- **Onboarding** — 3-slide carousel + name capture
- **Home (Dashboard)** — greeting header, hero "You'll get back" balance card, quick actions, "friends who owe you" horizontal scroller, recent activity list
- **Friends** — search, filter tabs (all/pending/settled), friend balance rows, add-friend bottom sheet
- **FriendDetail** — balance card, 3 action buttons, tabs (overview/transactions/repayments), stats grid, ledger list
- **Groups** — group list with avatar stacks, create-group bottom sheet
- **AddExpense** — 3-step wizard (pick people → amount + split → details/category), split modes equal/custom
- **RecordRepayment** — friend picker, amount, payment method, optional per-expense targeting
- **ExpenseDetail** — big amount card, participants with statuses, share/delete
- **Statement** — shareable text statement per friend
- **Activity** — date-grouped feed (Today/Yesterday/This Week/Earlier), filter chips
- **Profile + 14 settings sub-pages** — currency, date-time, appearance, language, notifications, security (PIN/passkeys/app lock), privacy, data storage, export, install, help, about
- **Security screens** — PIN pad, lock screen, PIN creation flow, re-auth gate

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 19 + TypeScript 6, Vite 8 |
| Styling | **Tailwind CSS v4** (CSS-first config via `@theme` in `src/index.css`) |
| Icons | lucide-react |
| Routing | react-router-dom v7 (HashRouter) |
| Components | Radix UI (only `@radix-ui/react-switch`), custom hand-rolled everything else |
| State | Local-first IndexedDB-ish store (`src/lib/db.ts`) + custom event bus (`onDBChange`), optional Supabase sync |
| Misc | PWA (vite-plugin-pwa), i18n-ready (`src/lib/i18n.ts`), libphonenumber-js |
| Testing | Vitest (logic only), oxlint |

---

## 3. Current Visual Language (Summary)

The app has a distinctive, cohesive-but-informal aesthetic:

- **Warm, paper-like neutral palette** — off-white cream backgrounds (`#fbfaf7`), warm stone/greige text tones (`#1c1917`, `#57534e`, `#a8a29e`), warm borders (`#e7e3d8`). This "receipt / notebook paper" warmth is the brand's best feature.
- **Single emerald accent** (`#059669` / `#10b981` dark) used for everything positive: primary buttons, "you'll get back" amounts, success, active states, links.
- **Generous radius everywhere** — `rounded-xl` (12px) for buttons/inputs, `rounded-2xl` (16px) for cards, `rounded-3xl` (24px) for hero cards and sheets. Soft, friendly, mobile-app feel.
- **Big numerals for money** — hero amounts use `text-4xl font-extrabold` with `tabular-nums`; money is the hero of every screen.
- **iOS-style bottom sheets** with drag handle (`h-1.5 w-10 rounded-full`), rounded top corners, springy `sheet-up` animation.
- **Pill chips** (`rounded-full`) for filter tabs and selected people; active = filled emerald, inactive = soft warm gray.
- **Signature motif:** torn-receipt edge on the hero balance card (`receipt-edge` radial-gradient scallop) — a lovely unique brand element worth preserving.
- **Ghost decorative circles** — soft white/10 radial blob on hero cards for depth.

---

## 4. Design Tokens (Current State)

### 4.1 Color tokens — Light mode (`src/index.css`)
```css
--color-primary:        #059669  /* emerald-600 — actions, positive money, links */
--color-primary-hover:  #047857  /* emerald-700 */
--color-primary-soft:   #ecfdf5  /* emerald-50 tint — active nav, icon chips, selected pills */
--color-bg:             #fbfaf7  /* warm off-white page background */
--color-surface:        #ffffff  /* cards, sheets, nav bars */
--color-surface-secondary: #f4f2ec /* warm gray — icon tiles, inactive pills, keypads */
--color-border:         #e7e3d8  /* warm hairline borders, dividers */
--color-text-primary:   #1c1917  /* stone-900 warm near-black */
--color-text-secondary: #57534e  /* stone-600 */
--color-text-muted:     #a8a29e  /* stone-400 — captions, timestamps */
--color-success:        #059669
--color-warning:        #d97706
--color-error:          #dc2626
--color-info:           #0284c7
```

### 4.2 Dark mode (`.dark` class on `<html>`, applied by `PreferencesProvider`)
```css
--color-primary:        #10b981
--color-primary-hover:  #34d399
--color-primary-soft:   #052e23
--color-bg:             #14120f
--color-surface:        #1c1a16
--color-surface-secondary: #26221c
--color-border:         #34302a
--color-text-primary:   #f5f4f0
--color-text-secondary: #b8b3a8
--color-text-muted:     #756e63
```
> Note: success/warning/error/info are **not redefined in dark mode** — they keep light-mode values.

### 4.3 Tokens that are MISSING (must be added)
- No spacing scale tokens
- No radius scale tokens
- No typography scale / font-size tokens
- No shadow tokens (hard-coded `shadow-lg`, `shadow-sm`, `shadow-2xl`, `shadow-black/20` inline)
- No motion/duration/easing tokens (only one keyframe: `sheet-up`)
- No z-index scale (hard-coded: 20/30/40/50/100/2147483647)
- No status semantic colors (pending/partial/settled hard-coded in `StatusBadge.tsx` as raw hex)
- No "danger soft" token (`bg-red-50 dark:bg-red-950/30` hard-coded in SettingsUI)
- No gradient tokens (Appearance settings uses `bg-gradient-to-br from-[var(--color-primary-soft)] to-[var(--color-surface)]` inline)
- Dark mode lacks semantic variants for success/warning/error/info and red/danger surfaces

---

## 5. Typography

- Font family: `Inter` (falls back to system-ui/sans-serif) — set in `@theme` as `--font-sans`
- **No font-size / weight tokens** — all sizing is ad-hoc Tailwind utilities:

| Usage | Current classes |
|---|---|
| Hero money amount | `text-4xl font-extrabold` |
| Screen titles (Home/Friends/Activity) | `text-xl font-semibold` |
| Page headers (settings/detail) | `text-lg font-semibold` |
| Card titles / rows | `text-[15px] font-medium` (settings rows) or default `font-medium` |
| Body secondary | `text-sm text-[var(--color-text-secondary)]` |
| Captions / timestamps | `text-xs text-[var(--color-text-muted)]` |
| Micro labels | `text-[10px]` and `text-[11px]` |
| Section labels (settings) | `text-[12px] uppercase tracking-[0.08em] font-bold text-muted` |
| Money everywhere | `font-semibold`/`font-extrabold` + class `.amount-tabular` (`font-variant-numeric: tabular-nums`) |

> Inconsistency: arbitrary values `text-[10px]`, `text-[11px]`, `text-[15px]`, `text-[12px]` are used ad-hoc rather than a scale.

---

## 6. Spacing & Layout Patterns

### Page structure (mobile-first)
- Content column: `max-w-2xl mx-auto`, page padding `px-4 pt-6`, plus `safe-top` (env safe-area) class
- Settings pages: sticky header `h-14` with back button + title, `backdrop-blur` over `bg/95`
- Bottom nav (mobile) / left sidebar 256px (desktop, `hidden md:flex`) — same 5 items: Home, Friends, Activity, Groups, Profile

### Component spacing conventions observed
- Card padding: `p-4` (16px) typical; hero cards `p-5`–`p-6`
- Vertical gaps: `mb-4`/`mb-6`/`mb-8` between blocks; `flex flex-col gap-2`/`gap-3` for lists
- Icon tiles: `w-9 h-9 rounded-xl` (settings rows), `w-11 h-11 rounded-xl` (quick actions), `w-14 h-14 rounded-2xl` (empty states)
- Avatar sizes: 28 (stacked groups), 32, 38, 40, 44, 46, 72 (profile)
- Hit targets: primary buttons `py-3.5` (56px); settings rows `min-h-14`–`min-h-[72px]`
- Corner radius usage: chips/pills `rounded-full`; buttons/inputs/cards `rounded-xl`–`rounded-2xl`; hero/sheets/`rounded-3xl`

### Horizontal-scroll pattern (Home "friends who owe you")
- `flex gap-3 overflow-x-auto -mx-4 px-4` with fixed min-width cards (`min-w-[104px]`)

---

## 7. Component Inventory & Patterns

### 7.1 Buttons
| Variant | Classes | Usage |
|---|---|---|
| **Primary** | `bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium rounded-xl py-3.5` | CTAs, sticky "Continue", submit |
| **Primary (disabled)** | `disabled:opacity-40` (AddExpense wizard) vs `disabled:opacity-60` (Auth/onboarding) — **inconsistent** |
| **Secondary/Soft** | `bg-[var(--color-surface-secondary)] font-medium rounded-xl py-3` | Share, Cancel, Add New Friend |
| **Outline danger** | `border border-[var(--color-border)] text-[var(--color-error)]` | Sign out (Profile) |
| **Soft danger** | `bg-red-50 text-[var(--color-error)]` | Delete (ExpenseDetail) |
| **Ghost** | `text-[var(--color-text-muted)]` | Skip links, "See all" (`text-[var(--color-primary)]`) |
| **Icon button** | `w-9 h-9 rounded-full bg-surface border` (back) or solid emerald (add) |
| **FAB** | `fixed bottom-20 right-5 w-14 h-14 rounded-full bg-primary shadow-lg active:scale-95` |

> Inconsistencies: disabled opacity differs (40 vs 60); danger styles use raw `bg-red-50`; no button component exists — repeated in every file.

### 7.2 Inputs (`.input` global class)
```css
.input {
  width: 100%;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  padding: 0.65rem 0.9rem;
  font-size: 0.9rem;
  color: var(--color-text-primary);
}
.input:focus { border-color: var(--color-color-primary); }  /* no ring, no transition */
```
- Search inputs follow a custom pattern: `pl-9/pl-10` + absolutely positioned `<Search>` icon at `left-3.5 top-1/2 -translate-y-1/2`
- Big amount input (AddExpense step 2): bare `bg-transparent text-4xl font-extrabold` with currency symbol prefix
- Custom share inputs: `w-24 text-right font-semibold bg-transparent`
- No `focus-visible` ring on `.input`; no placeholder token styling

### 7.3 Cards & lists
- List card: `bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl divide-y divide-[var(--color-border)]`
- Row items: `p-4 flex items-center justify-between`
- Tile cards (friends): `bg-surface border rounded-2xl p-3.5 flex items-center gap-3`
- Hero balance card (Home): `rounded-3xl bg-primary text-white p-6 receipt-edge` with `border-t border-white/20` stats row
- Secondary stats card: `bg-surface-secondary rounded-xl p-3`
- `hover:border-[var(--color-primary)] transition-colors` on tappable cards

### 7.4 Bottom sheet (`BottomSheet.tsx`)
- `fixed inset-0 z-50`, scrim `bg-black/40`, panel `w-full max-w-md rounded-t-3xl animate-sheet-up max-h-[88vh]`
- Drag handle + optional title row with close button; body scrolls
- Also used for confirm dialogs (sign-out, delete-expense is a custom centered modal `rounded-2xl max-w-xs`)

### 7.5 Toasts (`ToastProvider`)
- Single success toast type only: dark pill `bg-[#1c1917] text-white rounded-2xl shadow-lg` + green `CheckCircle2`, bottom-center, 2.6s, `animate-sheet-up`
- **Hard-coded color** `#1c1917` instead of token; no error/warning/info variants; no action buttons; no toast queue animation

### 7.6 Status badge (`StatusBadge.tsx`)
```ts
pending:  { bg: '#fef3c7', fg: '#92400e' }   // amber
partial:  { bg: '#dbeafe', fg: '#1e40af' }   // blue
settled:  { bg: 'var(--color-primary-soft)', fg: 'var(--color-primary-hover)' }
```
- **Raw hex** for two of three states — breaks dark mode (no dark variants). Should become tokens.

### 7.7 Avatar (`Avatar.tsx`)
- Image or initials (`initials()` = first + last letter, up to 2), deterministic HSL color from name hash (`AVATAR_HUES = [160,190,25,340,260,45,200,10]`, 55% sat, 45% light)
- `AvatarGroup`: `-space-x-2` overlap, ring `ring-[var(--color-surface)]`, `+N` overflow chip

### 7.8 Empty states (`EmptyState.tsx`)
- Icon in `w-14 h-14 rounded-2xl` warm tile, title, muted subtitle, optional action button; generous `py-14`

### 7.9 Settings system (`SettingsUI.tsx`) — closest thing to a component library
- `SettingsPage` — sticky blurred header, back button, title, optional description
- `SettingsSection` — uppercase micro-label + `rounded-2xl` card with dividers
- `SettingsRow` — 36px icon tile, 15px title, 12px description, optional value + chevron; danger variant; link or button
- `ChoiceRow` — radio-style selection (circle check)
- `ToggleRow` / `Toggle` — Radix switch (`h-6 w-11`, checked = primary, `size-5` white thumb with shadow)

### 7.10 PIN pad (`PinPad.tsx`)
- 6-dot progress indicator, 3×3 grid of `rounded-2xl bg-surface-secondary` keys (h-14 min), delete key, "Forgot PIN?" ghost link, error slot with reserved height

### 7.11 Misc patterns
- Segmented control (Auth): `grid grid-cols-2 bg-surface-secondary rounded-xl p-1`, active = white pill `shadow-sm`
- Pills: active `bg-primary text-white`, inactive `bg-surface-secondary text-secondary`
- Stepper dots (wizard/onboarding): active `w-6 h-1.5 bg-primary`, inactive `w-1.5 bg-border`
- Toggle switch inline (AddExpense "Include my share") — hand-rolled duplicate of Radix switch
- Selected-friend chips: `bg-primary-soft text-primary-hover rounded-full` with ✕
- Check circles: `w-5 h-5 rounded-full bg-primary` + white check

---

## 8. Motion & Interaction

| Pattern | Spec |
|---|---|
| Sheet entrance | `sheet-up` 220ms cubic-bezier(0.32, 0.72, 0, 1) — only keyframe in the app |
| Hover (desktop) | `transition-colors`; primary buttons `hover:bg-primary-hover`; cards `hover:border-primary` |
| Active (mobile) | `active:bg-surface-secondary` on rows; FAB `active:scale-95` |
| Toast | same sheet-up, auto-dismiss 2.6s |
| None | Page transitions, route transitions, list enter/exit, skeleton loaders, pull-to-refresh, press ripple |

---

## 9. Accessibility (Current State)

Good:
- All interactive elements are real `<button>`/`<a>`
- `aria-label` on icon-only buttons (FAB, PIN digits)
- Focus-visible rings on PIN pad and switch; `role="alert"`/`role="status"` on auth errors
- `motion-reduce` respected in switch

Gaps:
- No focus-visible styling on most buttons/cards/inputs (`.input` has none)
- Status is conveyed **only by color** (StatusBadge has text, but amounts/balances are color-only)
- Hard-coded hex with no dark variants breaks WCAG contrast in dark mode (e.g., pending badge `#92400e` on `#fef3c7` is fine, but same pair in dark bg is not; `text-white/80` on emerald may fail)
- `text-white` on `#059669` is ~3.0:1 contrast — below 4.5:1 AA for normal text
- No `prefers-reduced-motion` handling except switch
- Tap targets generally ≥44px (good), but 9px back buttons `w-9 h-9` (36px) are under target

---

## 10. Inconsistencies & Pain Points (what a redesign must fix)

1. **No shared component library** — buttons, inputs, cards, chips, dialogs are copy-pasted across 20+ files with drift (disabled opacity 40 vs 60, danger = `bg-red-50` vs outline vs filled).
2. **Color handling** — status colors, toasts (`#1c1917`), danger reds, and dark-mode shadows are raw hex; dark mode has no semantic red/amber/blue variants.
3. **Tokens incomplete** — no spacing/radius/typography/shadow/z-index/motion scales; radius is inconsistent (`rounded-xl` inputs vs `rounded-2xl` search inputs vs `rounded-3xl` cards).
4. **Focus styles inconsistent** — `.input` and most cards lack focus-visible rings; PIN pad has them.
5. **Two different toggle implementations** — Radix `Switch` in settings vs hand-rolled span toggle in AddExpense.
6. **Confirmation UI split** — bottom sheet (sign-out) vs centered modal (delete expense); should be one system.
7. **Toast is single-purpose** — only success, hard-coded dark color, no stacking.
8. **Typography drift** — arbitrary `text-[10px]`–`text-[15px]` instead of a scale; no letter-spacing/lining scale.
9. **Hero card uses raw `text-white`/`text-white/80`** — needs accessible on-primary tokens.
10. **Search input pattern** duplicated manually in 4 places.
11. **No loading skeletons** — only full-screen spinner (`LoaderCircle animate-spin`).
12. **Avatar colors** — fixed 8-hue rotation; collisions likely with many friends; no dark-mode adjust.
13. **Mobile-only feel on desktop** — max-w-2xl column is fine, but cards/rows don't adapt; desktop sidebar is minimal.
14. **Bottom-sheet and FAB overlap bottom nav** — FAB sits at `bottom-20` to clear nav; toast at `bottom-24`; these magic offsets need tokens.

---

## 11. Brand Assets to PRESERVE (do not lose these)

1. **Warm paper/cream neutral palette** (`#fbfaf7` bg, warm greys) — the brand's signature.
2. **Emerald as the single accent** color for money/positive/primary.
3. **Torn-receipt edge** on the hero balance card.
4. **Big, bold tabular money numerals** as the hero of every screen.
5. **Rounded, soft, iOS-like surfaces** (rounded-2xl/3xl, sheets with drag handles).
6. **Inter typeface**.
7. **Deterministic colored initial avatars** + overlapping avatar stacks.
8. **Pill-based filters/selection** interaction language.

---

## 12. Requirements for the New Design System

Generate a complete, documented system that delivers:

1. **Token architecture (3 layers):**
   - Primitives (scale: spacing 4px base, radius, typography, shadow, z-index, motion, border widths)
   - Semantic tokens (color: bg/surface/surface-secondary/border/text-primary/secondary/muted, primary+interactive states, status: success/warning/error/info, danger-soft, on-primary, overlay) — **with full light + dark variants for every semantic color**
   - Component tokens (button heights, input heights, card padding, nav heights, sheet radii)
2. **Component library spec** with variants & states (hover/active/disabled/focus) for: Button (primary/secondary/ghost/danger/link + sizes + loading + icon), Input (+search, +amount, error state), Card, ListRow, Chip/Pill, Toggle, Radio/Choice, Badge (status, dark-safe), Toast (success/error/warning/info, stacking), BottomSheet, Modal/Dialog (unified confirm), EmptyState, Avatar (+expanded palette), Skeleton, Stepper, SegmentedControl, TabBar, Sidebar, PIN pad, Avatar stack.
3. **Accessibility spec** — 4.5:1 contrast pairs (verify `#059669`/white), focus-visible ring tokens for every interactive element, color + icon + text for status, `prefers-reduced-motion` policy, 44px min tap targets.
4. **Motion system** — durations/easings per surface type (sheet, toast, overlay, list), entry/exit pairs, reduced-motion fallbacks.
5. **Typography scale** — sizes for display/hero-money/title/body/caption/micro + tabular-nums money treatment + letter-spacing for labels.
6. **Dark mode completion** — complete semantic palette, shadow adjustments, avatar hue adjustments.
7. **Layout tokens** — page gutter, content max-width, bottom-nav height, FAB offset, sheet radii, sticky-header height, safe-area handling.
8. **Migration-ready output** — ideally Tailwind v4 `@theme` tokens + a `components/` file structure (e.g., shadcn-style) that drops into this codebase, with a mapping table from current utilities → new tokens/components.

---

## 13. Code Reference Map (most valuable files)

| File | Why |
|---|---|
| `src/index.css` | All current tokens + global styles (start here) |
| `src/components/SettingsUI.tsx` | Best-organized component patterns (row/section/page) |
| `src/components/Shell.tsx` | Nav system (mobile tab bar + desktop sidebar + FAB + quick-add sheet) |
| `src/components/BottomSheet.tsx` | Sheet pattern |
| `src/components/Toast.tsx` | Toast pattern |
| `src/components/StatusBadge.tsx` | Badge + the raw-hex dark-mode bug |
| `src/pages/Home.tsx` | Hero card, quick actions, horizontal scroller |
| `src/pages/AddExpense.tsx` | Wizard, big amount input, split modes, custom toggle |
| `src/pages/Auth.tsx` | Segmented control + form |
| `src/pages/settings/PreferencePages.tsx` | Choice rows, preview cards, sheets-in-settings |
| `src/components/security/PinPad.tsx` | PIN UI + good focus-visible example |
| `src/components/ui/switch.tsx` | Radix switch (the only library component) |
| `src/lib/utils.ts` | Currency/date/initials/avatar-color formatting |
| `src/types/index.ts` | Domain model (affects display patterns) |
