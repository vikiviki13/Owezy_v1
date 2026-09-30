import { APP_VERSION, compareVersions } from '../lib/appRelease';

export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
}

export interface GitHubReleaseNote {
  version: string;
  date: string;
  changes: string[];
  bugsFixed: string[];
}

const REPO_OWNER = 'vikiviki13';
const REPO_NAME = 'Owezy_v1';

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const CHECKED_KEY = 'gh_release_checked_at';
const NOTIFIED_VERSION_KEY = 'gh_release_notified_version';

function getLocalStore(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Ignore restricted access
  }
  return null;
}

function isFreshCheck(): boolean {
  const store = getLocalStore();
  if (!store) return false;
  const checked = store.getItem(CHECKED_KEY);
  if (!checked) return false;
  const age = Date.now() - Number(checked);
  return age < CHECK_INTERVAL_MS;
}

function markChecked(): void {
  const store = getLocalStore();
  if (store) {
    store.setItem(CHECKED_KEY, String(Date.now()));
  }
}

export async function getLatestGitHubRelease(): Promise<GitHubRelease | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
      { headers: { Accept: 'application/vnd.github+json' } }
    );
    if (!res.ok) return null;
    const data: GitHubRelease = await res.json();
    return data;
  } catch {
    return null;
  }
}

export function parseReleaseNotes(release: GitHubRelease): GitHubReleaseNote {
  const body = release.body || '';
  const lines = body.split('\n').map((l) => l.trim());

  const changes: string[] = [];
  const bugsFixed: string[] = [];

  let section = '';
  for (const line of lines) {
    if (line.startsWith('## ') || line.startsWith('### ')) {
      section = line.toLowerCase();
      continue;
    }
    if (line.startsWith('-') || line.startsWith('*')) {
      const text = line.substring(1).trim();
      if (!text) continue;

      if (section.includes('bug') || section.includes('fix') || text.toLowerCase().includes('fix')) {
        bugsFixed.push(text);
      } else if (section.includes('change') || section.includes('update') || section.includes('new') || section.includes('feature') || section === '') {
        changes.push(text);
      }
    }
  }

  const date = release.published_at
    ? new Date(release.published_at).toLocaleDateString()
    : '';

  return {
    version: release.tag_name.replace(/^v/, ''),
    date,
    changes: changes.filter((c) => c).slice(0, 6),
    bugsFixed: bugsFixed.filter((b) => b).slice(0, 6),
  };
}

export async function checkForGitHubUpdates(
  notify: (message: string) => void
): Promise<GitHubReleaseNote | null> {
  if (isFreshCheck()) return null;

  const release = await getLatestGitHubRelease();
  if (!release) return null;

  markChecked();

  const notes = parseReleaseNotes(release);

  // Strictly verify that the GitHub release is newer than the running version
  if (compareVersions(notes.version, APP_VERSION) <= 0) {
    return null;
  }

  // Avoid notifying repeatedly for the same version
  const store = getLocalStore();
  const lastNotified = store?.getItem(NOTIFIED_VERSION_KEY);
  if (lastNotified === notes.version) {
    return null;
  }

  const hasUpdates = notes.changes.length > 0 || notes.bugsFixed.length > 0;
  if (hasUpdates) {
    store?.setItem(NOTIFIED_VERSION_KEY, notes.version);
    let message = `Update is available: v${notes.version}`;
    if (notes.changes.length > 0) {
      message += ` — ${notes.changes[0]}`;
    } else if (notes.bugsFixed.length > 0) {
      message += ` — ${notes.bugsFixed.length} bug fix${notes.bugsFixed.length > 1 ? 'es' : ''}`;
    }
    notify(message);
  }

  return notes;
}

export function clearGitHubCheckCache(): void {
  const store = getLocalStore();
  store?.removeItem(CHECKED_KEY);
  store?.removeItem(NOTIFIED_VERSION_KEY);
}
