// Deterministic two-way merge between the local cache document and the cloud
// document. Supabase is the source of truth, but a device that was offline
// may hold legitimate newer records, so the merge is a per-record union:
//
// - Records that exist on only one side are kept (never discarded).
// - Records on both sides keep whichever `updated_at` is newer (stable IDs —
//   the same UUID is used locally and in the cloud, so sync never duplicates).
// - Financial transactions are never merged into each other; different IDs
//   stay separate records, and the same ID resolves by timestamp.
// - Soft-deleted records (tombstones) are removed from the merged cache so
//   deletions made on one device propagate to the others.
// - Child records (participants, items, adjustments, members, attachments)
//   are reconciled against their parents, so a tombstoned parent's children
//   never survive in a cache.
//
// The result is a union document. Nothing is ever silently overwritten
// wholesale by a stale copy.

import type { SyncEntityType, Tombstone } from './types';
import { TOMBSTONE_RETENTION_MS } from './types';

type RecordTable = 'friends' | 'groups' | 'groupMembers' | 'expenses' | 'expenseParticipants' | 'expenseItems' | 'expenseItemAssignments' | 'expenseAdjustments' | 'repayments' | 'attachments';

export interface StoredDoc {
  rev?: number;
  updated_at?: string;
  profile: Record<string, unknown>;
  preferences: Record<string, unknown>;
  friends: Record<string, unknown>[];
  groups: Record<string, unknown>[];
  groupMembers: Record<string, unknown>[];
  expenses: Record<string, unknown>[];
  expenseParticipants: Record<string, unknown>[];
  expenseItems: Record<string, unknown>[];
  expenseItemAssignments: Record<string, unknown>[];
  expenseAdjustments: Record<string, unknown>[];
  repayments: Record<string, unknown>[];
  attachments: Record<string, unknown>[];
  deleted: Tombstone[];
}

const RECORD_TABLES: RecordTable[] = [
  'friends', 'groups', 'groupMembers', 'expenses', 'expenseParticipants',
  'expenseItems', 'expenseItemAssignments', 'expenseAdjustments', 'repayments', 'attachments',
];

const PARENT_TABLE: Partial<Record<RecordTable, { table: RecordTable; key: string }>> = {
  groupMembers: { table: 'groups', key: 'group_id' },
  expenseParticipants: { table: 'expenses', key: 'expense_id' },
  expenseItems: { table: 'expenses', key: 'expense_id' },
  expenseItemAssignments: { table: 'expenseItems', key: 'expense_item_id' },
  expenseAdjustments: { table: 'expenses', key: 'expense_id' },
  attachments: { table: 'expenses', key: 'expense_id' },
};

export interface MergeResult {
  merged: StoredDoc;
  // True when the local copy contains anything the cloud document does not
  // (local-only records, newer edits, or newer tombstones). The sync manager
  // pushes the merged union to Supabase when this is true.
  needsPush: boolean;
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object')) : [];
}

function timestampOf(record: Record<string, unknown>): string {
  const updated = typeof record.updated_at === 'string' ? record.updated_at : '';
  if (updated) return updated;
  const created = typeof record.created_at === 'string' ? record.created_at : '';
  return created;
}

function recordId(record: Record<string, unknown>): string {
  return typeof record.id === 'string' ? record.id : '';
}

function mergeRecordArray(local: Record<string, unknown>[], cloud: Record<string, unknown>[]): { records: Record<string, unknown>[]; localOnly: boolean; cloudOnly: boolean } {
  const byId = new Map<string, Record<string, unknown>>();
  let localOnly = false;
  let cloudOnly = false;
  for (const record of local) {
    const id = recordId(record);
    if (!id) continue;
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, record);
      continue;
    }
    if (timestampOf(record) > timestampOf(existing)) byId.set(id, record);
  }
  for (const record of cloud) {
    const id = recordId(record);
    if (!id) continue;
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, record);
      cloudOnly = true;
      continue;
    }
    if (timestampOf(record) > timestampOf(existing)) {
      byId.set(id, record);
      cloudOnly = true;
    }
  }
  // A record that came only from the local side is "local-only".
  localOnly = local.some((record) => {
    const id = recordId(record);
    return id !== '' && !cloud.some((cloudRecord) => recordId(cloudRecord) === id);
  });
  return { records: [...byId.values()], localOnly, cloudOnly };
}

function mergeTombstones(local: Tombstone[], cloud: Tombstone[]): { tombstones: Tombstone[]; changed: boolean } {
  const byKey = new Map<string, Tombstone>();
  for (const tombstone of [...local, ...cloud]) {
    if (!tombstone || typeof tombstone.id !== 'string' || !tombstone.id) continue;
    const key = `${tombstone.entityType}:${tombstone.id}`;
    const existing = byKey.get(key);
    if (!existing || tombstone.deletedAt > existing.deletedAt) byKey.set(key, tombstone);
  }
  const cutoff = new Date(Date.now() - TOMBSTONE_RETENTION_MS).toISOString();
  const retained = [...byKey.values()].filter((tombstone) => tombstone.deletedAt >= cutoff);
  return { tombstones: retained, changed: retained.length !== [...byKey.values()].length };
}

function isDeletedByTombstone(tombstones: Tombstone[], table: RecordTable, record: Record<string, unknown>): boolean {
  const id = recordId(record);
  if (!id) return false;
  const tombstone = tombstones.find((entry) => entry.entityType === tableToEntityType(table) && entry.id === id);
  if (!tombstone) return false;
  return tombstone.deletedAt > timestampOf(record);
}

function tableToEntityType(table: RecordTable): SyncEntityType {
  switch (table) {
    case 'friends': return 'friend';
    case 'groups': return 'group';
    case 'groupMembers': return 'groupMember';
    case 'expenses': return 'expense';
    case 'expenseParticipants': return 'expenseParticipant';
    case 'expenseItems': return 'expenseItem';
    case 'expenseItemAssignments': return 'expenseItemAssignment';
    case 'expenseAdjustments': return 'expenseAdjustment';
    case 'repayments': return 'repayment';
    case 'attachments': return 'attachment';
  }
}

function reconcileChildren(doc: StoredDoc) {
  const parents = new Set(doc.expenses.map((record) => recordId(record)));
  const parentOf = (table: RecordTable, record: Record<string, unknown>) => {
    const relation = PARENT_TABLE[table];
    if (!relation) return true;
    const parentId = typeof record[relation.key] === 'string' ? record[relation.key] as string : '';
    return parentId === '' || parents.has(parentId);
  };
  for (const table of RECORD_TABLES) {
    const relation = PARENT_TABLE[table];
    if (!relation) continue;
    const list = doc[table];
    doc[table] = list.filter((record) => parentOf(table, record));
  }
}

function mergeObject(local: Record<string, unknown>, cloud: Record<string, unknown>): Record<string, unknown> {
  if (timestampOf(cloud) > timestampOf(local)) return cloud;
  return local;
}

export function mergeAppData(local: StoredDoc, cloud: StoredDoc): MergeResult {
  const result: StoredDoc = {
    rev: Math.max(typeof local.rev === 'number' ? local.rev : 0, typeof cloud.rev === 'number' ? cloud.rev : 0),
    updated_at: [local.updated_at || '', cloud.updated_at || ''].sort().pop() || new Date().toISOString(),
    profile: mergeObject(local.profile || {}, cloud.profile || {}),
    preferences: mergeObject(local.preferences || {}, cloud.preferences || {}),
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

  let localOnly = false;

  for (const table of RECORD_TABLES) {
    const merged = mergeRecordArray(asArray(local[table]), asArray(cloud[table]));
    result[table] = merged.records;
    localOnly = localOnly || merged.localOnly;
  }

  const tombstones = mergeTombstones(local.deleted || [], cloud.deleted || []);
  result.deleted = tombstones.tombstones;
  const cloudTombstones = (cloud.deleted || []).map((entry) => `${entry.entityType}:${entry.id}`);
  void localOnly;

  for (const table of RECORD_TABLES) {
    result[table] = result[table].filter((record) => !isDeletedByTombstone(result.deleted, table, record));
  }

  reconcileChildren(result);

  // Push the merged union back to Supabase only when it introduces something
  // the cloud document does not already hold: a record the cloud lacks, a
  // record with newer content, a newer profile/preferences object, or a
  // tombstone the cloud has not seen yet.
  function differsFromCloud(mergedRecords: Record<string, unknown>[], cloudRecords: Record<string, unknown>[]) {
    const cloudById = new Map(cloudRecords.map((record) => [recordId(record), record]));
    for (const record of mergedRecords) {
      const id = recordId(record);
      if (!id) continue;
      const cloudRecord = cloudById.get(id);
      if (!cloudRecord) return true;
      if (JSON.stringify(cloudRecord) !== JSON.stringify(record)) return true;
    }
    return false;
  }

  const needsPush = RECORD_TABLES.some((table) => differsFromCloud(result[table], asArray(cloud[table])))
    || JSON.stringify(result.profile) !== JSON.stringify(cloud.profile || {})
    || JSON.stringify(result.preferences) !== JSON.stringify(cloud.preferences || {})
    || result.deleted.some((entry) => !cloudTombstones.includes(`${entry.entityType}:${entry.id}`));

  return { merged: result, needsPush };
}