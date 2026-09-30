import { APP_VERSION, compareVersions, getReleaseNotesForVersion } from '../lib/appRelease';
import { getLatestGitHubRelease, parseReleaseNotes } from './githubNotifications';

export interface RemoteReleaseInfo {
  version: string;
  notes: string[];
  releaseDate?: string;
  required?: boolean;
  hasUpdate: boolean;
}

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const LAST_CHECK_KEY = 'owezy_last_update_check';

function getSessionStore(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
  } catch {
    // Ignore access errors in private/restricted contexts
  }
  return null;
}

/**
 * Checks for a newer application version from public/version.json and GitHub releases.
 * Compares against the running APP_VERSION to ensure only genuine new updates are signaled.
 */
export async function checkRemoteUpdate(
  currentVersion: string = APP_VERSION,
  force: boolean = false
): Promise<RemoteReleaseInfo | null> {
  const store = getSessionStore();

  if (!force && store) {
    const lastCheck = store.getItem(LAST_CHECK_KEY);
    if (lastCheck && Date.now() - Number(lastCheck) < CHECK_INTERVAL_MS) {
      // Checked recently in this session, return null to avoid unnecessary requests
      return null;
    }
  }

  if (store) {
    store.setItem(LAST_CHECK_KEY, String(Date.now()));
  }

  // 1. Check /version.json hosted directly with the app
  try {
    const res = await fetch(`/version.json?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.version === 'string') {
        const isNewer = compareVersions(data.version, currentVersion) > 0;
        const notes = Array.isArray(data.notes)
          ? data.notes.filter((n: unknown): n is string => typeof n === 'string' && n.trim().length > 0)
          : [];

        if (isNewer) {
          return {
            version: data.version,
            notes,
            releaseDate: data.buildDate || data.releaseDate,
            required: Boolean(data.required),
            hasUpdate: true,
          };
        }
      }
    }
  } catch {
    // Ignore network error and proceed to secondary check
  }

  // 2. Check GitHub releases (vikiviki13/Owezy_v1) as secondary / alternative source
  try {
    const ghRelease = await getLatestGitHubRelease();
    if (ghRelease) {
      const parsed = parseReleaseNotes(ghRelease);
      const isNewer = compareVersions(parsed.version, currentVersion) > 0;
      if (isNewer) {
        const notes = [...parsed.changes, ...parsed.bugsFixed];
        // If GitHub release notes are empty, try fallback notes for that version
        const fallback = getReleaseNotesForVersion(parsed.version);
        return {
          version: parsed.version,
          notes: notes.length > 0 ? notes : (fallback?.notes ?? []),
          releaseDate: parsed.date,
          required: false,
          hasUpdate: true,
        };
      }
    }
  } catch {
    // Ignore GitHub API errors / rate limits
  }

  return {
    version: currentVersion,
    notes: getReleaseNotesForVersion(currentVersion)?.notes ?? [],
    hasUpdate: false,
  };
}
