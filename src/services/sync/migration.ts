// Existing local data migration. The first successful synchronization after
// this update uploads legitimate local-only records to the cloud document and
// merges cloud records into the local cache (union merge in conflictResolver).
// The flag is set only after the merged document was pushed successfully, so
// a failed migration is never silently marked complete.

const MIGRATION_FLAG_PREFIX = 'tab_local_data_migration_completed_v2_';

export function isMigrationCompleted(userId: string): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(`${MIGRATION_FLAG_PREFIX}${userId}`) === '1';
}

export function markMigrationCompleted(userId: string) {
  localStorage.setItem(`${MIGRATION_FLAG_PREFIX}${userId}`, '1');
}

export function clearMigrationFlag(userId: string) {
  localStorage.removeItem(`${MIGRATION_FLAG_PREFIX}${userId}`);
}