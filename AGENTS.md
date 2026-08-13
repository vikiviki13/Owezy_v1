# AGENTS.md — Project Rules for AI Coding Agents

## Project

**Tab** — mobile-first friend-expense tracker PWA (React 19 + TypeScript, Vite 8, Tailwind CSS v4, Supabase sync, local-first storage).

Always read `design.md` before making UI changes — it documents the design tokens, component inventory, brand constraints, and the migration plan.

## UI Library Rules (MANDATORY)

This project uses **shadcn/ui** (Radix base, Tailwind v4). Follow these rules for every UI change:

1. **Use `npx shadcn@latest add <component>` to add components.** Never hand-write a new component that already exists in shadcn's registry (button, input, card, dialog, sheet, badge, switch, avatar, tabs, skeleton, toast, etc.).
2. **All shadcn components live in `src/components/ui/`** with the standard structure: Radix primitive + `data-slot` + `cn()` from `@/lib/utils`.
3. **Use existing components before writing custom UI.** Compose: settings = SettingsPage/Section/Row + shadcn controls; lists = Card + rows; forms = Label + Input + Button.
4. **Use semantic tokens, never raw colors.** `bg-primary`, `text-muted-foreground`, `border-border`, `bg-destructive`, `bg-card` etc. Dark mode is automatic via `.dark` — never hard-code hex values.
5. **Tokens are the source of truth.** Edit ONLY `src/index.css` (the `:root` / `.dark` variable blocks and `@theme inline` mappings). See `design.md` §4 for the full palette. Do not add ad-hoc arbitrary values (`bg-[#...]`, `text-[13px]`) when a token exists.
6. **Variants before custom styles.** Use shadcn variants (`variant="outline"`, `size="sm"`) instead of overriding classes.

## Legacy Components — Migration Targets

These custom components predate shadcn and must be REPLACED with shadcn equivalents when touched (see `design.md` §10 for known drift/issues):

- `src/components/BottomSheet.tsx` → shadcn `sheet` + `dialog` (confirms)
- `src/components/Toast.tsx` → shadcn `sonner`/`toast` (needs error/warning variants)
- `src/components/StatusBadge.tsx` → shadcn `badge` + status tokens (raw hex bug — dark mode broken)
- `src/components/EmptyState.tsx`, `src/components/Avatar.tsx`, `src/components/SettingsUI.tsx`, `src/components/security/PinPad.tsx` → shadcn `avatar`, `badge`, `switch`, `radio-group`, `pin-input` + keep app-specific composition
- `src/pages/AddExpense.tsx` hand-rolled toggle → shadcn `switch`

When migrating: **preserve the brand assets** listed in `design.md` §11 (warm paper palette, torn-receipt edge, tabular money numerals, pill filters, sheet drag handles).

## Known Tooling Quirks

- **Windows CLI bug:** `npx shadcn@latest init` fails after writing `components.json` ("Could not load the workspace config") and `add` writes files to a stray `@\components\` folder. Workaround: after `add`, move generated files from `@\components\ui\*` to `src/components/ui/`.
- shadcn's new registry emits `data-checked:` selectors, but installed `radix-ui` 1.6.7 emits `data-state="checked"`. When adding Radix-based components, rewrite `data-checked:` → `data-[state=checked]:` and `data-unchecked:` → `data-[state=unchecked]:`.
- Import aliases: `@/*` → `src/*` (tsconfig.app.json + vite.config.ts). Utils: `@/lib/utils` (re-exports `cn`; do not delete, components.json aliases it).

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — `tsc -b && vite build` (always run before finishing UI work)
- `npm run lint` — oxlint
- `npm run test` — vitest
- Add component: `npx shadcn@latest add <name> -y` (then fix the `@\` path + `data-*` selectors as above)

## Data & State Rules

- Money: always render through `formatCurrency()` and add class `amount-tabular` (tabular numerals).
- Currency/date/time/theme preferences come from `usePreferences()` — never hard-code INR or light theme.
- Data layer is local-first (`src/lib/db.ts`) with optional Supabase sync; UI components must not import Supabase directly.
- Dark mode is driven by the `.dark` class on `<html>` — test both themes for every UI change.
