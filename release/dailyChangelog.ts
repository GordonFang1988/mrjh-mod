import { releaseNotes } from './releaseNotes';
export const CHANGELOG_STORAGE_KEY = 'mrjh-release-daily-view';
interface ChangelogDailyViewRecord {
  localDate: string;
  latestUpdateId: string;
}

function resolveStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function formatLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shouldShowDailyChangelog(storage?: Storage, now = new Date()): boolean {
  const latestUpdateId = releaseNotes[0]?.updates[0]?.id;
  if (!latestUpdateId) return false;

  try {
    const raw = resolveStorage(storage)?.getItem(CHANGELOG_STORAGE_KEY);
    if (!raw) return true;
    const record = JSON.parse(raw) as Partial<ChangelogDailyViewRecord>;
    return record.localDate !== formatLocalDateKey(now) || record.latestUpdateId !== latestUpdateId;
  } catch {
    return true;
  }
}

export function recordDailyChangelogView(storage?: Storage, now = new Date()): void {
  const latestUpdateId = releaseNotes[0]?.updates[0]?.id;
  if (!latestUpdateId) return;

  try {
    resolveStorage(storage)?.setItem(
      CHANGELOG_STORAGE_KEY,
      JSON.stringify({
        localDate: formatLocalDateKey(now),
        latestUpdateId
      } satisfies ChangelogDailyViewRecord)
    );
  } catch {
    // A blocked localStorage only means the notice may be offered again later.
  }
}
