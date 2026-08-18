// Shared types for the synchronization layer. Supabase is the source of
// truth; the browser copy is an offline cache plus a pending-change queue.

export type SyncEntityType =
  | 'profile'
  | 'preferences'
  | 'friend'
  | 'group'
  | 'groupMember'
  | 'expense'
  | 'expenseParticipant'
  | 'expenseItem'
  | 'expenseItemAssignment'
  | 'expenseAdjustment'
  | 'repayment'
  | 'attachment';

export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';

export type SyncQueueStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

export interface SyncQueueItem {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  createdAt: string;
  retryCount: number;
  lastError: string | null;
  status: SyncQueueStatus;
}

export type SyncState = 'synced' | 'syncing' | 'offline' | 'pending' | 'error';

export interface SyncStatusSnapshot {
  state: SyncState;
  pendingCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  migrationCompleted: boolean;
}

// Soft-delete tombstone. Deleted records stay in the cloud document long
// enough for every device to learn about the deletion; the local cache drops
// them immediately.
export interface Tombstone {
  entityType: SyncEntityType;
  id: string;
  deletedAt: string;
}

export const TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;