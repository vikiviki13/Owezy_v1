export const APP_VERSION: string = __APP_VERSION__;

export interface ReleaseNote {
  version: string;
  date?: string;
  notes: string[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.1.0',
    date: '2026-09-30',
    notes: [
      'Contact Import — easily import phone contacts with duplicate detection and batch select',
      'Manage Friend — edit friend profiles, settle dues, archive or delete contacts',
      'Offline-first sync with automatic cloud backup and conflict resolution',
      'Statements & Export — generate PDF/CSV statements and share directly via WhatsApp',
      'Enhanced App Lock security — protect your financial records with PIN or biometric passkeys',
      'Animated splash screen for app startup, reloads, and updates',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-08-10',
    notes: [
      'Expense dates — pick any past date when recording an expense',
      'Flexible expense splitting — equal, unequal, and percentage splits with category tagging',
      'WhatsApp message previews — preview and send reminders with one tap',
      'Offline-first architecture with local cache and secure cloud sync',
    ],
  },
];

export function getReleaseNotesForVersion(version: string): ReleaseNote | undefined {
  return RELEASE_NOTES.find((item) => compareVersions(item.version, version) === 0);
}

export function latestReleaseNotes(): ReleaseNote | undefined {
  return getReleaseNotesForVersion(APP_VERSION) || RELEASE_NOTES[0];
}

// When set to a version number, users on any earlier version get a blocking
// update screen with no "Later" option. Set this only for critical releases.
export const REQUIRED_UPDATE_FROM_VERSION: string | undefined = undefined;

export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export function isRequiredUpdate(currentVersion: string): boolean {
  if (!REQUIRED_UPDATE_FROM_VERSION) return false;
  return compareVersions(currentVersion, REQUIRED_UPDATE_FROM_VERSION) < 0;
}