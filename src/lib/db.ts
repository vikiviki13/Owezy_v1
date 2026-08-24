import {
  Attachment, Expense, ExpenseAdjustment, ExpenseItem, ExpenseItemAssignment,
  ExpenseParticipant, Friend, FriendBalance, Group, GroupMember, LedgerEntry,
  Profile, Repayment, UserPreferences, PaymentMethod,
  ExpensePaymentContribution, ExpensePayerType, ExpenseType,
} from '../types';
import { localDateTimeToUTC, roundCurrency, todayDate, nowTime, uid } from './utils';
import { defaultPreferences, setPreferenceSnapshot } from './preferences';
import { expenseDateError, shiftIsoDate } from './expenseDraft';
import { enqueueChange } from '../services/sync/syncQueue';
import type { SyncEntityType, Tombstone } from '../services/sync/types';

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
  rev: number;
  updated_at: string;
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
  deleted: Tombstone[];
}

const OWNER_ID = 'local-user';

function emptyDB(): DB {
  const now = new Date().toISOString();
  return {
    rev: 0,
    updated_at: now,
    profile: {
      id: OWNER_ID,
      full_name: 'Viki',
      onboarding_completed: false,
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
    deleted: [],
  };
}

let cache: DB | null = null;

// Called after the sync layer replaces the runtime document with a merged
// cloud pull, so the next db read re-loads from storage instead of serving a
// stale in-memory copy that would clobber the merged records on persist.
export function invalidateCache() {
  cache = null;
}

function load(): DB {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as DB) : emptyDB();
  } catch {
    cache = emptyDB();
  }
  cache.rev = typeof cache.rev === 'number' ? cache.rev : 0;
  cache.updated_at = cache.updated_at || new Date().toISOString();
  cache.deleted = Array.isArray(cache.deleted) ? cache.deleted : [];
  cache.preferences = { ...defaultPreferences(cache.profile.id), ...(cache.preferences || {}) };
  setPreferenceSnapshot(cache.preferences);
  return cache;
}

function persist() {
  if (!cache) return;
  cache.rev = (cache.rev || 0) + 1;
  cache.updated_at = new Date().toISOString();
  localStorage.setItem(KEY, JSON.stringify(cache));
  window.dispatchEvent(new CustomEvent('tab-db-changed'));
}

// Soft-delete tombstone: the record stays in the cloud document long enough
// for other devices to learn about the deletion, while the local cache drops
// it immediately. The sync layer reconciles tombstones on every merge.
function recordTombstone(entityType: SyncEntityType, id: string) {
  const db = load();
  const deletedAt = new Date().toISOString();
  const existing = db.deleted.findIndex((entry) => entry.entityType === entityType && entry.id === id);
  if (existing >= 0) db.deleted[existing] = { entityType, id, deletedAt };
  else db.deleted.push({ entityType, id, deletedAt });
}

function enqueue(entityType: SyncEntityType, entityId: string, operation: 'CREATE' | 'UPDATE' | 'DELETE') {
  enqueueChange(entityType, entityId, operation);
}

export function resetDB() {
  cache = emptyDB();
  persist();
}

export function clearSensitiveLocalData() {
  cache = null;
  localStorage.removeItem(KEY);
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
  return shiftIsoDate(todayDate(), -n);
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
  enqueue('profile', db.profile.id, 'UPDATE');
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
  enqueue('preferences', db.preferences.id || db.profile.id, 'UPDATE');
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
    expenseItems: db.expenseItems,
    expenseItemAssignments: db.expenseItemAssignments,
    expenseAdjustments: db.expenseAdjustments,
    repayments: db.repayments,
    attachments: db.attachments,
    deleted: db.deleted,
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
  enqueue('friend', friend.id, 'CREATE');
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
      enqueue('friend', friend.id, 'UPDATE');
      return;
    }
    db.friends.push(friend);
    committed.push(friend);
    enqueue('friend', friend.id, 'CREATE');
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
  enqueue('friend', id, 'UPDATE');
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

  const removedRepaymentIds = db.repayments.filter((r) => r.friend_id === friendId).map((r) => r.id);
  const deletedItemIds = new Set(db.expenseItems.filter((i) => expenseIdsToDelete.has(i.expense_id)).map((i) => i.id));
  db.expenseItems = db.expenseItems.filter((i) => !expenseIdsToDelete.has(i.expense_id));
  db.expenseItemAssignments = db.expenseItemAssignments.filter((a) => !deletedItemIds.has(a.expense_item_id) && a.friend_id !== friendId);
  db.expenseAdjustments = db.expenseAdjustments.filter((a) => !expenseIdsToDelete.has(a.expense_id));
  db.expenses = db.expenses.filter((e) => !expenseIdsToDelete.has(e.id));
  db.expenseParticipants = db.expenseParticipants.filter((p) => !expenseIdsToDelete.has(p.expense_id) && p.friend_id !== friendId);
  db.attachments = db.attachments.filter((a) => !expenseIdsToDelete.has(a.expense_id));
  db.repayments = db.repayments.filter((r) => r.friend_id !== friendId);
  db.groupMembers = db.groupMembers.filter((m) => m.friend_id !== friendId);

  recordTombstone('friend', friendId);
  expenseIdsToDelete.forEach((expenseId) => recordTombstone('expense', expenseId));
  removedRepaymentIds.forEach((repaymentId) => recordTombstone('repayment', repaymentId));
  enqueue('friend', friendId, 'DELETE');
  expenseIdsToDelete.forEach((expenseId) => enqueue('expense', expenseId, 'DELETE'));

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
    const member = { id: uid(), group_id: group.id, friend_id, created_at: now };
    db.groupMembers.push(member);
    enqueue('groupMember', member.id, 'CREATE');
  });
  persist();
  enqueue('group', group.id, 'CREATE');
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
  description?: string;
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
  payer_type?: ExpensePayerType;
  expense_type?: ExpenseType;
  payer_friend_id?: string;
  payment_contributions?: Omit<ExpensePaymentContribution, 'id'>[];
  items?: Omit<ExpenseItem, 'id' | 'expense_id' | 'created_at'>[];
  adjustments?: Omit<ExpenseAdjustment, 'id' | 'expense_id'>[];
}

export function createExpense(input: CreateExpenseInput): Expense {
  const db = load();
  const now = new Date().toISOString();
  const payerType = input.payer_type || 'me';
  const contributions = (input.payment_contributions?.length
    ? input.payment_contributions
    : [{ payer_id: 'owner', amount: input.total_amount }]).map((payment) => ({
      ...payment,
      id: uid(),
      amount: roundCurrency(payment.amount),
    }));
  const recoverable = roundCurrency(input.participants.reduce((s, p) => s + p.share_amount, 0));
  const expenseDate = input.expense_date;
  const dateError = expenseDateError(expenseDate);
  if (dateError) throw new Error(dateError);
  const expenseTime = input.expense_time || nowTime();

  const expense: Expense = {
    id: uid(),
    owner_id: OWNER_ID,
    title: input.title,
    description: input.description,
    category: input.category,
    merchant_name: input.merchant_name,
    location_name: input.location_name,
    total_amount: roundCurrency(input.total_amount),
    owner_share: roundCurrency(input.owner_share),
    recoverable_amount: recoverable,
    expense_type: input.expense_type || (payerType === 'friend' ? 'paid_by_friend' : input.participants.length ? 'for_friend' : 'personal'),
    payer_type: payerType,
    payer_friend_id: input.payer_friend_id,
    payment_contributions: contributions,
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
    const participant: ExpenseParticipant = {
      id: uid(),
      expense_id: expense.id,
      friend_id: p.friend_id,
      share_amount: share,
      paid_amount: 0,
      pending_amount: payerType === 'friend' ? 0 : share,
      status: payerType === 'friend' ? 'settled' : 'pending',
      created_at: now,
      updated_at: now,
    };
    db.expenseParticipants.push(participant);
    enqueue('expenseParticipant', participant.id, 'CREATE');
  });

  (input.items || []).forEach((item) => {
    const entry = { ...item, id: uid(), expense_id: expense.id, created_at: now };
    db.expenseItems.push(entry);
    enqueue('expenseItem', entry.id, 'CREATE');
  });
  (input.adjustments || []).forEach((adj) => {
    const entry = { ...adj, id: uid(), expense_id: expense.id };
    db.expenseAdjustments.push(entry);
    enqueue('expenseAdjustment', entry.id, 'CREATE');
  });

  persist();
  enqueue('expense', expense.id, 'CREATE');
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
  recordTombstone('expense', id);
  enqueue('expense', id, 'DELETE');
  persist();
}

export function listExpenses(): Expense[] {
  return [...load().expenses].sort((a, b) => (b.expense_date + b.expense_time).localeCompare(a.expense_date + a.expense_time));
}
export function getExpense(id: string): Expense | undefined {
  return load().expenses.find((e) => e.id === id);
}
export function updateExpense(id: string, patch: Partial<Pick<Expense, 'title' | 'merchant_name' | 'notes'>>) {
  const db = load();
  const expense = db.expenses.find((candidate) => candidate.id === id);
  if (!expense) return undefined;
  Object.assign(expense, patch, { updated_at: new Date().toISOString() });
  persist();
  enqueue('expense', id, 'UPDATE');
  return expense;
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
  direction?: Repayment['direction'];
}
export function recordRepayment(input: RecordRepaymentInput): Repayment {
  const db = load();
  const amount = roundCurrency(input.amount);
  if (!Number.isFinite(input.amount) || amount <= 0) throw new Error('Repayment amount must be greater than zero.');
  const friend = db.friends.find((candidate) => candidate.id === input.friend_id);
  if (!friend) throw new Error('Friend not found.');
  const direction = input.direction || 'from_friend';
  const balance = calculateFriendBalance(input.friend_id);
  const pending = direction === 'to_friend' ? balance.iOweThem : input.expense_id
    ? db.expenseParticipants.find((participant) => participant.expense_id === input.expense_id && participant.friend_id === input.friend_id)?.pending_amount || 0
    : db.expenseParticipants.filter((participant) => participant.friend_id === input.friend_id).reduce((sum, participant) => sum + participant.pending_amount, 0);
  if (amount > roundCurrency(pending)) throw new Error('Repayment cannot exceed the selected outstanding balance.');
  const now = new Date().toISOString();
  const repaymentDate = input.repayment_date || todayDate();
  const repaymentTime = input.repayment_time || nowTime();
  const repayment: Repayment = {
    id: uid(),
    owner_id: OWNER_ID,
    friend_id: input.friend_id,
    expense_id: input.expense_id,
    amount,
    direction,
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

  if (direction === 'to_friend') {
    persist();
    enqueue('repayment', repayment.id, 'CREATE');
    return repayment;
  }

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
  enqueue('repayment', repayment.id, 'CREATE');
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
  const friendExpenses = db.expenses.filter((expense) => parts.some((p) => p.expense_id === expense.id));
  const totalPaidByYou = roundCurrency(friendExpenses.reduce((sum, expense) => {
    const part = parts.find((candidate) => candidate.expense_id === expense.id);
    if (!part || payerType(expense) === 'friend') return sum;
    return sum + Math.max(0, part.share_amount - amountPaidBy(expense, friendId));
  }, 0));
  const receivedRepayments = roundCurrency(db.repayments
    .filter((repayment) => repayment.friend_id === friendId && repayment.direction !== 'to_friend')
    .reduce((sum, repayment) => sum + repayment.amount, 0));
  const totalRepaid = roundCurrency(Math.min(totalPaidByYou, receivedRepayments));
  const theyOweMe = roundCurrency(Math.max(0, totalPaidByYou - totalRepaid));
  const friendPaidForMe = roundCurrency(friendExpenses.reduce((sum, expense) => {
    if (payerType(expense) === 'me') return sum;
    const friendPaid = amountPaidBy(expense, friendId);
    return sum + Math.min(expense.owner_share, friendPaid);
  }, 0));
  const paidBackToFriend = roundCurrency(db.repayments
    .filter((repayment) => repayment.friend_id === friendId && repayment.direction === 'to_friend')
    .reduce((sum, repayment) => sum + repayment.amount, 0));
  const iOweThem = roundCurrency(Math.max(0, friendPaidForMe - paidBackToFriend));
  const netBalance = roundCurrency(theyOweMe - iOweThem);
  const pending = Math.max(0, netBalance);

  const expenseDates = friendExpenses.map((e) => e.expense_date + 'T' + e.expense_time);
  const repayDates = db.repayments.filter((r) => r.friend_id === friendId).map((r) => r.repayment_date + 'T' + r.repayment_time);
  const lastActivityAt = [...expenseDates, ...repayDates].sort().pop();

  return {
    friend,
    totalPaidByYou,
    totalRepaid,
    theyOweMe,
    iOweThem,
    netBalance,
    pending,
    status: netBalance === 0 && (totalPaidByYou > 0 || friendPaidForMe > 0) ? 'settled' : (totalRepaid > 0 || paidBackToFriend > 0) ? 'partial' : 'pending',
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

function expensePayments(expense: Expense): ExpensePaymentContribution[] {
  return expense.payment_contributions?.length
    ? expense.payment_contributions
    : [{ id: `${expense.id}-legacy-owner-payment`, payer_id: 'owner', amount: expense.total_amount }];
}

function payerType(expense: Expense): ExpensePayerType {
  return expense.payer_type || 'me';
}

function amountPaidBy(expense: Expense, payerId: string) {
  return roundCurrency(expensePayments(expense)
    .filter((payment) => payment.payer_id === payerId)
    .reduce((sum, payment) => sum + payment.amount, 0));
}

export interface SpendingSummary {
  fromDate: string;
  toDate: string;
  totalPaidByMe: number;
  totalPaidByFriends: number;
  myActualSpending: number;
  spentForFriends: number;
  paidByFriendsForMe: number;
  personalExpenses: number;
  netPersonalSpending: number;
  categoryBreakdown: { category: Expense['category']; amount: number }[];
}

export function calculateSpendingSummary(fromDate: string, toDate: string): SpendingSummary {
  const expenses = listExpenses().filter((expense) => expense.expense_date >= fromDate && expense.expense_date <= toDate);
  const totalPaidByMe = roundCurrency(expenses.reduce((sum, expense) => sum + amountPaidBy(expense, 'owner'), 0));
  const totalPaidByFriends = roundCurrency(expenses.reduce((sum, expense) => sum + expensePayments(expense)
    .filter((payment) => payment.payer_id !== 'owner')
    .reduce((inner, payment) => inner + payment.amount, 0), 0));
  const myActualSpending = roundCurrency(expenses.reduce((sum, expense) => sum + expense.owner_share, 0));
  const spentForFriends = roundCurrency(expenses.reduce((sum, expense) => {
    const friendShare = expense.recoverable_amount;
    const friendPaid = roundCurrency(expensePayments(expense)
      .filter((payment) => payment.payer_id !== 'owner')
      .reduce((inner, payment) => inner + payment.amount, 0));
    return sum + (payerType(expense) === 'me' ? friendShare : Math.max(0, friendShare - friendPaid));
  }, 0));
  const paidByFriendsForMe = roundCurrency(expenses.reduce((sum, expense) => {
    const friendPaid = totalPaidByFriendsForExpense(expense);
    return sum + Math.min(expense.owner_share, friendPaid);
  }, 0));
  const categoryMap = new Map<Expense['category'], number>();
  expenses.forEach((expense) => categoryMap.set(expense.category, roundCurrency((categoryMap.get(expense.category) || 0) + expense.owner_share)));
  return {
    fromDate,
    toDate,
    totalPaidByMe,
    totalPaidByFriends,
    myActualSpending,
    spentForFriends,
    paidByFriendsForMe,
    personalExpenses: roundCurrency(expenses.filter((expense) => expense.owner_share > 0 && expense.recoverable_amount === 0).reduce((sum, expense) => sum + expense.owner_share, 0)),
    netPersonalSpending: roundCurrency(myActualSpending - paidByFriendsForMe),
    categoryBreakdown: [...categoryMap.entries()].map(([category, amount]) => ({ category, amount })),
  };
}

function totalPaidByFriendsForExpense(expense: Expense) {
  return roundCurrency(expensePayments(expense)
    .filter((payment) => payment.payer_id !== 'owner')
    .reduce((sum, payment) => sum + payment.amount, 0));
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
  const summary = calculateSpendingSummary('0000-01-01', '9999-12-31');
  return { totalPending, totalPaid, totalReceived, friendsOwing, ...summary };
}

export function onDBChange(cb: () => void) {
  window.addEventListener('tab-db-changed', cb);
  return () => window.removeEventListener('tab-db-changed', cb);
}
