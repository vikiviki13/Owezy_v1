// Entity-level synchronization queue. Every local mutation enqueues a change
// (CREATE / UPDATE / DELETE) so the sync manager can track what must reach
// Supabase, show a pending count, and retry failed uploads. The queue is a
// plain browser-storage array; the cloud document itself is the upload unit.

import type { SyncEntityType, SyncOperation, SyncQueueItem } from './types';
import { uid } from '../../lib/utils';

export const SYNC_QUEUE_KEY = 'tab_sync_queue_v2';

const MAX_QUEUE_ITEMS = 500;

function readQueue(): SyncQueueItem[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(SYNC_QUEUE_KEY);
    const parsed = raw ? (JSON.parse(raw) as SyncQueueItem[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: SyncQueueItem[]) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

export function enqueueChange(entityType: SyncEntityType, entityId: string, operation: SyncOperation) {
  const queue = readQueue();
  const existing = queue.find((item) => item.entityType === entityType && item.entityId === entityId);
  if (existing) {
    existing.operation = operation;
    existing.status = 'PENDING';
    existing.retryCount = 0;
    existing.lastError = null;
    existing.createdAt = new Date().toISOString();
    writeQueue(queue);
    return existing;
  }
  const item: SyncQueueItem = {
    id: uid(),
    entityType,
    entityId,
    operation,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    lastError: null,
    status: 'PENDING',
  };
  queue.push(item);
  if (queue.length > MAX_QUEUE_ITEMS) queue.splice(0, queue.length - MAX_QUEUE_ITEMS);
  writeQueue(queue);
  return item;
}

export function listQueueItems(): SyncQueueItem[] {
  return readQueue();
}

export function pendingCount(): number {
  return readQueue().filter((item) => item.status === 'PENDING' || item.status === 'FAILED').length;
}

export function markQueueSyncing() {
  const queue = readQueue();
  let changed = false;
  for (const item of queue) {
    if (item.status === 'PENDING' || item.status === 'FAILED') {
      item.status = 'SYNCING';
      changed = true;
    }
  }
  if (changed) writeQueue(queue);
}

export function markQueueSynced() {
  writeQueue([]);
}

export function markQueueFailed(error: string) {
  const queue = readQueue();
  let changed = false;
  for (const item of queue) {
    if (item.status === 'SYNCING') {
      item.status = 'FAILED';
      item.retryCount += 1;
      item.lastError = error;
      changed = true;
    }
  }
  if (changed) writeQueue(queue);
}

export function markQueueItemFailed(itemId: string, error: string) {
  const queue = readQueue();
  const item = queue.find((entry) => entry.id === itemId);
  if (item) {
    item.status = 'FAILED';
    item.retryCount += 1;
    item.lastError = error;
    writeQueue(queue);
  }
}

export function clearSyncQueue() {
  writeQueue([]);
}