export const APP_VERSION: string = __APP_VERSION__;

export interface ReleaseNote {
  version: string;
  date?: string;
  notes: string[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.0.0',
    notes: [
      'Expense dates — pick any past date when adding an expense',
      'WhatsApp message preview after saving an expense',
      'Manage Friend — edit profile, clear all dues, archive or delete',
      'Improved App Lock security',
    ],
  },
];

export function latestReleaseNotes(): ReleaseNote | undefined {
  return RELEASE_NOTES[0];
}

// When set to a version number, users on any earlier version get a blocking
// update screen with no "Later" option. Set this only for critical releases.
export const REQUIRED_UPDATE_FROM_VERSION: string | undefined = undefined;

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
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