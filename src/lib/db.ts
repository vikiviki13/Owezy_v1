import {
  Attachment, Expense, ExpenseAdjustment, ExpenseItem, ExpenseItemAssignment,
  ExpenseParticipant, Friend, FriendBalance, Group, GroupMember, LedgerEntry,
  Profile, Repayment, UserPreferences, PaymentMethod,
} from '../types';
import { localDateTimeToUTC, roundCurrency, todayDate, nowTime, uid } from './utils';
import { defaultPreferences, setPreferenceSnapshot } from './preferences';
import { expenseDateError } from './expenseDraft';

// ---------------------------------------------------------------------------
// Storage engine
//
// This module is the ONLY place that touches persistence. Every read goes
// through a table getter, every write goes through a table setter, and all
// balance math lives in the calculate* functions below. To move this app to
// real Supabase: replace the body of each function in this file with the
// matching supabase-js call and keep every function's signature the same —
// no component or page needs to change.
// ---------------------------------------------------------------------------

const KEY = 'tab_db_session_v2';
const LEGACY_KEY = 'tab_db_v1';

interface DB {
  profile: Profile;
  preferences: UserPreferences;
  friends: Friend[];
  groups: Group[];
  groupMembers: GroupMember[];
  expenses: Expense[];
  expenseParticipants: ExpenseParticipant[];
  expenseItems: ExpenseItem[];
  expenseItemAssignments: ExpenseItemAssignment[];
  expenseAdjustments: ExpenseAdjustment[];
  repayments: Repayment[];
  attachments: Attachment[];
}

const OWNER_ID = 'local-user';

function emptyDB(): DB {
  const now = new Date().toISOString();
  return {
    profile: {
      id: OWNER_ID,
      full_name: 'Viki',
      default_currency: 'INR',
      created_at: now,
      updated_at: now,
    },
    preferences: defaultPreferences(OWNER_ID),
    friends: [],
    groups: [],
    groupMembers: [],
    expenses: [],
    expenseParticipants: [],
    expenseItems: [],
    expenseItemAssignments: [],
    expenseAdjustments: [],
    repayments: [],
    attachments: [],
  };
}

let cache: DB | null = null;

function load(): DB {
  if (cache) return cache;
  try {
    const raw = sessionStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as DB) : emptyDB();
  } catch {
    cache = emptyDB();
  }
  cache.preferences = { ...defaultPreferences(cache.profile.id), ...(cache.preferences || {}) };
  setPreferenceSnapshot(cache.preferences);
  return cache;
}

function persist() {
  if (!cache) return;
  sessionStorage.setItem(KEY, JSON.stringify(cache));
  window.dispatchEvent(new CustomEvent('tab-db-changed'));
}

export function resetDB() {
  cache = emptyDB();
  persist();
}

export function clearSensitiveLocalData() {
  cache = null;
  sessionStorage.removeItem(KEY);
  setPreferenceSnapshot(defaultPreferences());
  window.dispatchEvent(new CustomEvent('tab-db-changed'));
}

export function clearLegacyLocalData() {
  localStorage.removeItem(LEGACY_KEY);
  localStorage.removeItem('tab_legacy_migrated_v1');
}

export function releaseSensitiveMemory() {
  cache = null;
  setPreferenceSnapshot(defaultPreferences());
}

export function seedSampleData() {
  const db = load();
  if (db.friends.length > 0) return; // never clobber real data
  const names = ['Arun', 'Karthik', 'Vijay', 'Sneha', 'Priya'];
  const friends = names.map((n) => createFriend({ name: n }));
  const now = new Date();

  const [arun, karthik, vijay, sneha] = friends;

  const e1 = createExpense({
    title: 'Dinner',
    category: 'Food',
    merchant_name: 'Truffles',
    total_amount: 2460,
    expense_date: daysAgo(7),
    participants: [
      { friend_id: arun.id, share_amount: 650 },
      { friend_id: karthik.id, share_amount: 540 },
      { friend_id: vijay.id, share_amount: 650 },
    ],
    owner_share: 620,
  });
  recordRepayment({ friend_id: karthik.id, amount: 540, payment_method: 'UPI', expense_id: e1.id, repayment_date: daysAgo(5) });

  createExpense({
    title: 'Cab',
    category: 'Travel',
    total_amount: 300,
    expense_date: daysAgo(4),
    participants: [{ friend_id: arun.id, share_amount: 300 }],
    owner_share: 0,
  });

  recordRepayment({ friend_id: arun.id, amount: 500, payment_method: 'Cash', repayment_date: daysAgo(2) });

  createExpense({
    title: 'Lunch',
    category: 'Food',
    total_amount: 450,
    expense_date: todayDate(),
    participants: [{ friend_id: arun.id, share_amount: 450 }],
    owner_share: 0,
  });

  createExpense({
    title: 'Movie tickets',
    category: 'Movie',
    total_amount: 1200,
    expense_date: daysAgo(1),
    participants: [
      { friend_id: sneha.id, share_amount: 600 },
    ],
    owner_share: 600,
  });
  void now;
  persist();
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
export function getProfile(): Profile {
  return load().profile;
}
export function updateProfile(patch: Partial<Profile>) {
  const db = load();
  db.profile = { ...db.profile, ...patch, updated_at: new Date().toISOString() };
  persist();
  return db.profile;
}

export function getUserPreferences(): UserPreferences {
  return load().preferences;
}

export function updateUserPreferences(patch: Partial<UserPreferences>): UserPreferences {
  const db = load();
  db.preferences = { ...db.preferences, ...patch, updated_at: new Date().toISOString() };
  if (patch.currency_code) db.profile.default_currency = patch.currency_code;
  setPreferenceSnapshot(db.preferences);
  persist();
  return db.preferences;
}

export function getExportData() {
  const db = load();
  return {
    profile: db.profile,
    preferences: db.preferences,
    friends: db.friends,
    groups: db.groups,
    groupMembers: db.groupMembers,
    expenses: db.expenses,
    expenseParticipants: db.expenseParticipants,
    repayments: db.repayments,
  };
}

export function getStorageSummary() {
  const db = load();
  const bytes = new Blob([JSON.stringify(db)]).size;
  return { receiptCount: db.attachments.length, bytes };
}

// ---------------------------------------------------------------------------
// Friends
// ---------------------------------------------------------------------------
export function listFriends(includeArchived = false): Friend[] {
  const db = load();
  return db.friends.filter((f) => includeArchived || !f.is_archived);
}
export function getFriend(id: string): Friend | undefined {
  return load().friends.find((f) => f.id === id);
}
export function createFriend(input: Partial<Friend> & { name: string }): Friend {
  const db = load();
  const now = new Date().toISOString();
  const friend: Friend = {
    id: uid(),
    owner_id: OWNER_ID,
    name: input.name,
    nickname: input.nickname,
    phone: input.phone,
    whatsapp_number: input.whatsapp_number,
    phone_number: input.phone_number,
    whatsapp_e164: input.whatsapp_e164,
    email: input.email,
    avatar_url: input.avatar_url,
    notes: input.notes,
    is_archived: false,
    created_at: now,
    updated_at: now,
  };
  db.friends.push(friend);
  persist();
  return friend;
}
export function commitImportedFriends(friends: Friend[]): Friend[] {
  if (!friends.length) return [];
  const db = load();
  const committed: Friend[] = [];
  friends.forEach((friend) => {
    const existing = db.friends.find((item) => item.id === friend.id);
    if (existing) {
      Object.assign(existing, friend);
      committed.push(existing);
      return;
    }
    db.friends.push(friend);
    committed.push(friend);
  });
  persist();
  return committed;
}
export function updateFriend(id: string, patch: Partial<Friend>) {
  const db = load();
  const idx = db.friends.findIndex((f) => f.id === id);
  if (idx === -1) return;
  db.friends[idx] = { ...db.friends[idx], ...patch, updated_at: new Date().toISOString() };
  persist();
}

export function archiveFriend(id: string, archived = true) {
  updateFriend(id, { is_archived: archived });
}

// Settles a friend's complete outstanding balance by recording a repayment
// equal to the pending amount. Old expenses stay untouched and visible in
// history — this only creates the settlement transaction.
export function clearFriendDues(friendId: string, input: { repayment_date?: string; payment_method?: PaymentMethod; notes?: string } = {}): Repayment | undefined {
  const pending = calculateFriendBalance(friendId).pending;
  if (pending <= 0) return undefined;
  return recordRepayment({
    friend_id: friendId,
    amount: pending,
    payment_method: input.payment_method || 'Other',
    repayment_date: input.repayment_date,
    notes: input.notes,
  });
}

// Permanently removes a friend's financial history. Expenses the friend was
// the only participant of are deleted entirely (with items, adjustments,
// attachments); expenses shared with others only drop this friend's
// participant share. All repayments for the friend are removed.
export function clearFriendData(friendId: string) {
  const db = load();
  const friendExpenseIds = new Set(db.expenseParticipants.filter((p) => p.friend_id === friendId).map((p) => p.expense_id));
  const expenseIdsToDelete = new Set<string>();
  friendExpenseIds.forEach((expenseId) => {
    const otherParticipants = db.expenseParticipants.some((p) => p.expense_id === expenseId && p.friend_id !== friendId);
    if (!otherParticipants) expenseIdsToDelete.add(expenseId);
  });

  const deletedItemIds = new Set(db.expenseItems.filter((i) => expenseIdsToDelete.has(i.expense_id)).map((i) => i.id));
  db.expenseItems = db.expenseItems.filter((i) => !expenseIdsToDelete.has(i.expense_id));
  db.expenseItemAssignments = db.expenseItemAssignments.filter((a) => !deletedItemIds.has(a.expense_item_id) && a.friend_id !== friendId);
  db.expenseAdjustments = db.expenseAdjustments.filter((a) => !expenseIdsToDelete.has(a.expense_id));
  db.expenses = db.expenses.filter((e) => !expenseIdsToDelete.has(e.id));
  db.expenseParticipants = db.expenseParticipants.filter((p) => !expenseIdsToDelete.has(p.expense_id) && p.friend_id !== friendId);
  db.attachments = db.attachments.filter((a) => !expenseIdsToDelete.has(a.expense_id));
  db.repayments = db.repayments.filter((r) => r.friend_id !== friendId);
  db.groupMembers = db.groupMembers.filter((m) => m.friend_id !== friendId);
  persist();
}

export function deleteFriend(id: string) {
  clearFriendData(id);
  const db = load();
  db.friends = db.friends.filter((f) => f.id !== id);
  persist();
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------
export function listGroups(): Group[] {
  return load().groups;
}
export function createGroup(input: { name: string; description?: string; memberIds: string[] }): Group {
  const db = load();
  const now = new Date().toISOString();
  const group: Group = { id: uid(), owner_id: OWNER_ID, name: input.name, description: input.description, created_at: now, updated_at: now };
  db.groups.push(group);
  input.memberIds.forEach((friend_id) => {
    db.groupMembers.push({ id: uid(), group_id: group.id, friend_id, created_at: now });
  });
  persist();
  return group;
}
export function getGroupMembers(groupId: string): Friend[] {
  const db = load();
  const ids = db.groupMembers.filter((m) => m.group_id === groupId).map((m) => m.friend_id);
  return db.friends.filter((f) => ids.includes(f.id));
}

// ---------------------------------------------------------------------------
// Expenses (with participants, items, adjustments)
// ---------------------------------------------------------------------------
interface CreateExpenseInput {
  title: string;
  category: Expense['category'];
  merchant_name?: string;
  location_name?: string;
  total_amount: number;
  owner_share: number;
  expense_date: string;
  expense_time?: string;
  group_id?: string;
  notes?: string;
  split_mode?: Expense['split_mode'];
  participants: { friend_id: string; share_amount: number }[];
  items?: Omit<ExpenseItem, 'id' | 'expense_id' | 'created_at'>[];
  adjustments?: Omit<ExpenseAdjustment, 'id' | 'expense_id'>[];
}

export function createExpense(input: CreateExpenseInput): Expense {
  const db = load();
  const now = new Date().toISOString();
  const recoverable = roundCurrency(input.participants.reduce((s, p) => s + p.share_amount, 0));
  const expenseDate = input.expense_date;
  const dateError = expenseDateError(expenseDate);
  if (dateError) throw new Error(dateError);
  const expenseTime = input.expense_time || nowTime();

  const expense: Expense = {
    id: uid(),
    owner_id: OWNER_ID,
    title: input.title,
    category: input.category,
    merchant_name: input.merchant_name,
    location_name: input.location_name,
    total_amount: roundCurrency(input.total_amount),
    owner_share: roundCurrency(input.owner_share),
    recoverable_amount: recoverable,
    expense_date: expenseDate,
    expense_time: expenseTime,
    occurred_at: localDateTimeToUTC(expenseDate, expenseTime, db.preferences.timezone_mode === 'automatic' ? Intl.DateTimeFormat().resolvedOptions().timeZone : db.preferences.timezone),
    currency: db.preferences.currency_code,
    group_id: input.group_id,
    notes: input.notes,
    split_mode: input.split_mode || 'custom',
    status: 'pending',
    created_at: now,
    updated_at: now,
  };
  db.expenses.push(expense);

  input.participants.forEach((p) => {
    const share = roundCurrency(p.share_amount);
    db.expenseParticipants.push({
      id: uid(),
      expense_id: expense.id,
      friend_id: p.friend_id,
      share_amount: share,
      paid_amount: 0,
      pending_amount: share,
      status: 'pending',
      created_at: now,
      updated_at: now,
    });
  });

  (input.items || []).forEach((item) => {
    db.expenseItems.push({ ...item, id: uid(), expense_id: expense.id, created_at: now });
  });
  (input.adjustments || []).forEach((adj) => {
    db.expenseAdjustments.push({ ...adj, id: uid(), expense_id: expense.id });
  });

  persist();
  return expense;
}

export function deleteExpense(id: string) {
  const db = load();
  db.expenses = db.expenses.filter((e) => e.id !== id);
  db.expenseParticipants = db.expenseParticipants.filter((p) => p.expense_id !== id);
  db.expenseItems = db.expenseItems.filter((i) => i.expense_id !== id);
  db.expenseAdjustments = db.expenseAdjustments.filter((a) => a.expense_id !== id);
  // Repayments tied to a deleted expense fall back to general (unlinked) repayments
  // rather than vanishing — money already received stays recorded.
  db.repayments = db.repayments.map((r) => (r.expense_id === id ? { ...r, expense_id: undefined } : r));
  persist();
}

export function listExpenses(): Expense[] {
  return [...load().expenses].sort((a, b) => (b.expense_date + b.expense_time).localeCompare(a.expense_date + a.expense_time));
}
export function getExpense(id: string): Expense | undefined {
  return load().expenses.find((e) => e.id === id);
}
export function getExpenseParticipants(expenseId: string): ExpenseParticipant[] {
  return load().expenseParticipants.filter((p) => p.expense_id === expenseId);
}
export function getExpenseItems(expenseId: string): ExpenseItem[] {
  return load().expenseItems.filter((i) => i.expense_id === expenseId);
}
export function getExpenseAdjustments(expenseId: string): ExpenseAdjustment[] {
  return load().expenseAdjustments.filter((a) => a.expense_id === expenseId);
}
export function listExpensesForFriend(friendId: string): Expense[] {
  const db = load();
  const expenseIds = new Set(db.expenseParticipants.filter((p) => p.friend_id === friendId).map((p) => p.expense_id));
  return db.expenses.filter((e) => expenseIds.has(e.id)).sort((a, b) => (b.expense_date + b.expense_time).localeCompare(a.expense_date + a.expense_time));
}

// ---------------------------------------------------------------------------
// Repayments — allocation waterfall: general repayments (no expense_id) are
// applied to the friend's oldest outstanding expense participants first.
// ---------------------------------------------------------------------------
interface RecordRepaymentInput {
  friend_id: string;
  amount: number;
  payment_method?: Repayment['payment_method'];
  expense_id?: string;
  transaction_reference?: string;
  notes?: string;
  repayment_date?: string;
  repayment_time?: string;
}
export function recordRepayment(input: RecordRepaymentInput): Repayment {
  const db = load();
  const now = new Date().toISOString();
  const repaymentDate = input.repayment_date || todayDate();
  const repaymentTime = input.repayment_time || nowTime();
  const repayment: Repayment = {
    id: uid(),
    owner_id: OWNER_ID,
    friend_id: input.friend_id,
    expense_id: input.expense_id,
    amount: roundCurrency(input.amount),
    payment_method: input.payment_method || 'UPI',
    transaction_reference: input.transaction_reference,
    repayment_date: repaymentDate,
    repayment_time: repaymentTime,
    occurred_at: localDateTimeToUTC(repaymentDate, repaymentTime, db.preferences.timezone_mode === 'automatic' ? Intl.DateTimeFormat().resolvedOptions().timeZone : db.preferences.timezone),
    notes: input.notes,
    created_at: now,
    updated_at: now,
  };
  db.repayments.push(repayment);

  // Allocate against participant pending_amounts, oldest expense first.
  let remaining = repayment.amount;
  const targets = input.expense_id
    ? db.expenseParticipants.filter((p) => p.expense_id === input.expense_id && p.friend_id === input.friend_id)
    : db.expenseParticipants
        .filter((p) => p.friend_id === input.friend_id && p.pending_amount > 0)
        .map((p) => ({ p, exp: db.expenses.find((e) => e.id === p.expense_id) }))
        .sort((a, b) => (a.exp ? a.exp.expense_date + a.exp.expense_time : '').localeCompare(b.exp ? b.exp.expense_date + b.exp.expense_time : ''))
        .map((x) => x.p);

  for (const participant of targets) {
    if (remaining <= 0) break;
    const applied = Math.min(remaining, participant.pending_amount);
    participant.paid_amount = roundCurrency(participant.paid_amount + applied);
    participant.pending_amount = roundCurrency(participant.pending_amount - applied);
    participant.status = participant.pending_amount <= 0 ? 'settled' : 'partial';
    participant.updated_at = now;
    remaining = roundCurrency(remaining - applied);
  }

  // Recompute status on every touched expense
  const touchedExpenseIds = new Set(targets.map((p) => p.expense_id));
  touchedExpenseIds.forEach((eid) => recomputeExpenseStatus(eid));

  persist();
  return repayment;
}

function recomputeExpenseStatus(expenseId: string) {
  const db = load();
  const parts = db.expenseParticipants.filter((p) => p.expense_id === expenseId);
  const expense = db.expenses.find((e) => e.id === expenseId);
  if (!expense || parts.length === 0) return;
  const allSettled = parts.every((p) => p.pending_amount <= 0);
  const noneStarted = parts.every((p) => p.paid_amount === 0);
  expense.status = allSettled ? 'settled' : noneStarted ? 'pending' : 'partial';
  expense.updated_at = new Date().toISOString();
}

export function listRepaymentsForFriend(friendId: string): Repayment[] {
  return load().repayments.filter((r) => r.friend_id === friendId).sort((a, b) => (b.repayment_date + b.repayment_time).localeCompare(a.repayment_date + a.repayment_time));
}
export function listAllRepayments(): Repayment[] {
  return [...load().repayments].sort((a, b) => (b.repayment_date + b.repayment_time).localeCompare(a.repayment_date + a.repayment_time));
}

// ---------------------------------------------------------------------------
// Calculation helpers — spec'd names, pure functions over the store.
// Balances are ALWAYS derived from expenses + repayments, never cached.
// ---------------------------------------------------------------------------
export function calculateFriendBalance(friendId: string): FriendBalance {
  const db = load();
  const friend = db.friends.find((f) => f.id === friendId)!;
  const parts = db.expenseParticipants.filter((p) => p.friend_id === friendId);
  const totalPaidByYou = roundCurrency(parts.reduce((s, p) => s + p.share_amount, 0));
  const totalRepaid = roundCurrency(parts.reduce((s, p) => s + p.paid_amount, 0));
  const pending = roundCurrency(totalPaidByYou - totalRepaid);

  const expenseDates = db.expenses.filter((e) => parts.some((p) => p.expense_id === e.id)).map((e) => e.expense_date + 'T' + e.expense_time);
  const repayDates = db.repayments.filter((r) => r.friend_id === friendId).map((r) => r.repayment_date + 'T' + r.repayment_time);
  const lastActivityAt = [...expenseDates, ...repayDates].sort().pop();

  return {
    friend,
    totalPaidByYou,
    totalRepaid,
    pending,
    status: pending <= 0 && totalPaidByYou > 0 ? 'settled' : totalRepaid > 0 ? 'partial' : 'pending',
    lastActivityAt,
  };
}

export function listFriendBalances(): FriendBalance[] {
  return listFriends()
    .map((f) => calculateFriendBalance(f.id))
    .sort((a, b) => b.pending - a.pending);
}

export function calculateExpensePending(expenseId: string): number {
  const parts = getExpenseParticipants(expenseId);
  return roundCurrency(parts.reduce((s, p) => s + p.pending_amount, 0));
}

export function calculateGroupBalance(groupId: string): number {
  const members = getGroupMembers(groupId);
  return roundCurrency(members.reduce((s, m) => s + calculateFriendBalance(m.id).pending, 0));
}

export function calculateProportionalAdjustment(amount: number, weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (amount * w) / total);
  const rounded = raw.map(roundCurrency);
  // fix rounding drift on the last item so shares always sum exactly to `amount`
  const diff = roundCurrency(amount - rounded.reduce((a, b) => a + b, 0));
  if (rounded.length) rounded[rounded.length - 1] = roundCurrency(rounded[rounded.length - 1] + diff);
  return rounded;
}

export function friendLedger(friendId: string): LedgerEntry[] {
  const db = load();
  const expenses = listExpensesForFriend(friendId).map((e) => {
    const part = db.expenseParticipants.find((p) => p.expense_id === e.id && p.friend_id === friendId)!;
    return { kind: 'expense' as const, date: e.expense_date, time: e.expense_time, title: e.title, amount: part.share_amount, refId: e.id, status: part.status, sortKey: e.expense_date + e.expense_time + '_1' };
  });
  const repayments = listRepaymentsForFriend(friendId).map((r) => ({
    kind: 'repayment' as const, date: r.repayment_date, time: r.repayment_time, title: 'Payment received', amount: r.amount, refId: r.id, status: undefined, sortKey: r.repayment_date + r.repayment_time + '_0',
  }));
  const merged = [...expenses, ...repayments].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  let running = 0;
  return merged.map((entry) => {
    running = roundCurrency(entry.kind === 'expense' ? running + entry.amount : running - entry.amount);
    return { id: uid(), kind: entry.kind, date: entry.date, time: entry.time, title: entry.title, amount: entry.amount, runningBalance: running, status: entry.status, refId: entry.refId };
  });
}

export function calculateStatementOpeningBalance(friendId: string, fromDate: string): number {
  const ledger = friendLedger(friendId);
  const before = ledger.filter((e) => e.date < fromDate);
  if (before.length === 0) return 0;
  return before[before.length - 1].runningBalance;
}

export interface StatementResult {
  openingBalance: number;
  periodExpenses: number;
  periodRepayments: number;
  closingBalance: number;
  entries: LedgerEntry[];
}

export function calculateStatement(friendId: string, fromDate: string, toDate: string): StatementResult {
  const ledger = friendLedger(friendId);
  const opening = calculateStatementOpeningBalance(friendId, fromDate);
  const inRange = ledger.filter((e) => e.date >= fromDate && e.date <= toDate);
  const periodExpenses = roundCurrency(inRange.filter((e) => e.kind === 'expense').reduce((s, e) => s + e.amount, 0));
  const periodRepayments = roundCurrency(inRange.filter((e) => e.kind === 'repayment').reduce((s, e) => s + e.amount, 0));
  const closing = roundCurrency(opening + periodExpenses - periodRepayments);
  return { openingBalance: opening, periodExpenses, periodRepayments, closingBalance: closing, entries: inRange };
}

export function calculateStatementClosingBalance(friendId: string, fromDate: string, toDate: string): number {
  return calculateStatement(friendId, fromDate, toDate).closingBalance;
}

export function dashboardTotals() {
  const balances = listFriendBalances();
  const totalPending = roundCurrency(balances.reduce((s, b) => s + Math.max(b.pending, 0), 0));
  const totalPaid = roundCurrency(balances.reduce((s, b) => s + b.totalPaidByYou, 0));
  const totalReceived = roundCurrency(balances.reduce((s, b) => s + b.totalRepaid, 0));
  const friendsOwing = balances.filter((b) => b.pending > 0).length;
  return { totalPending, totalPaid, totalReceived, friendsOwing };
}

export function onDBChange(cb: () => void) {
  window.addEventListener('tab-db-changed', cb);
  return () => window.removeEventListener('tab-db-changed', cb);
}
