import { beforeEach, describe, expect, it } from 'vitest';
import { clearSyncQueue, enqueueChange, markQueueFailed, markQueueSyncing, markQueueSynced, pendingCount } from './syncQueue';

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  Object.defineProperty(globalThis, 'window', {
    value: {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => { store.set(key, value); },
        removeItem: (key: string) => { store.delete(key); },
      },
    },
    configurable: true,
  });
  clearSyncQueue();
});

describe('sync queue', () => {
  it('enqueues a change with pending status', () => {
    const item = enqueueChange('friend', 'friend-1', 'CREATE');
    expect(item.status).toBe('PENDING');
    expect(pendingCount()).toBe(1);
  });

  it('coalesces repeated changes for the same record to the latest operation', () => {
    enqueueChange('expense', 'expense-1', 'CREATE');
    enqueueChange('expense', 'expense-1', 'UPDATE');
    enqueueChange('expense', 'expense-1', 'DELETE');
    expect(pendingCount()).toBe(1);
    const items = clearAndRead();
    expect(items[0].operation).toBe('DELETE');
  });

  it('keeps different records as separate queue entries', () => {
    enqueueChange('friend', 'friend-1', 'CREATE');
    enqueueChange('expense', 'expense-1', 'CREATE');
    expect(pendingCount()).toBe(2);
  });

  it('transitions through syncing/synced and back to failed', () => {
    enqueueChange('friend', 'friend-1', 'CREATE');
    markQueueSyncing();
    expect(pendingCount()).toBe(0);
    markQueueFailed('Network is down');
    expect(pendingCount()).toBe(1);
    const items = clearAndRead();
    expect(items[0].status).toBe('FAILED');
    expect(items[0].retryCount).toBe(1);
    expect(items[0].lastError).toBe('Network is down');
    markQueueSynced();
    expect(pendingCount()).toBe(0);
  });
});

function clearAndRead() {
  const raw = store.get('tab_sync_queue_v2');
  return raw ? JSON.parse(raw) as Array<{ operation: string; status: string; retryCount: number; lastError: string | null }> : [];
}