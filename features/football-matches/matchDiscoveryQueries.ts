import {
  focusManager, onlineManager, queryOptions,
  type QueryClient, type QueryObserverResult, type UseQueryOptions,
} from '@tanstack/react-query';
import type { MatchDiscoveryApiClient, NormalizedMatch } from './matchDiscoveryAdapter';
import { normalizeDiscoverySelection } from './footballMatchSchemas';

type DiscoveryResult = Awaited<ReturnType<MatchDiscoveryApiClient['discoverMatches']>>;
type DiscoveryGroup = DiscoveryResult['groups'][number];
export interface DiscoverySelection {
  date: string;
  leagueCodes: string[];
  active: boolean;
}
export interface LeagueDiscoveryState {
  leagueCode: string;
  status: 'initial' | 'available' | 'empty' | 'updating' | 'partial' | 'pending' | 'deferred' | 'outdated' | 'offline' | 'error';
  message: string | null;
  retryAt: number | null;
}
interface LeagueDiscoverySnapshot {
  matches: NormalizedMatch[];
  group: DiscoveryGroup | null;
  reuseExpiresAt: number;
  checksIssued: number;
  retryAt: number;
  canAutomaticallyRetry: boolean;
}
interface QueuedCheck {
  code: string;
  resolve: (snapshot: LeagueDiscoverySnapshot) => void;
  reject: (error: Error) => void;
}

interface DiscoveryViewModel {
  matches: NormalizedMatch[];
  leagueStates: LeagueDiscoveryState[];
  isInitialLoading: boolean;
  isUpdating: boolean;
}
interface MatchDiscoveryQueries {
  createQueryOptions(selection: DiscoverySelection): UseQueryOptions<LeagueDiscoverySnapshot>[];
  createViewModel(selection: DiscoverySelection, results: readonly QueryObserverResult<LeagueDiscoverySnapshot>[]): DiscoveryViewModel;
  retry(selection: DiscoverySelection): Promise<void>;
}

const MAX_LEAGUES_PER_BATCH = 16;
const MAX_CHECKS_PER_CYCLE = 3;
const FIXTURE_REUSE_WINDOW_MS = 60_000;
const MIN_PENDING_RETRY_SECONDS = 15;
const MAX_AUTOMATIC_RETRY_DELAY_SECONDS = 60;
const DISCOVERY_UNAVAILABLE_MESSAGE = 'Match discovery is temporarily unavailable. Available matches are still shown.';
const DISCOVERY_STATUS_MESSAGES: Record<LeagueDiscoveryState['status'], string | null> = {
  initial: null,
  available: null,
  empty: 'No fixtures for this league on this date.',
  updating: 'Updating fixtures. Available matches are still shown.',
  partial: 'Some fixtures may be missing. Available matches are still shown.',
  pending: 'Fixtures are still pending. Retry to check again.',
  deferred: 'Fixtures are temporarily deferred. Retry after the waiting period.',
  outdated: 'Fixtures may be out of date. Retry to update them.',
  offline: 'You are offline. Retained fixtures are still available.',
  error: DISCOVERY_UNAVAILABLE_MESSAGE,
};

function getDiscoveryQueryKey(date: string, code: string): readonly ['match-discovery', string, string] {
  return ['match-discovery', date, code];
}

function normalizeSelectedLeagueCodes(selection: DiscoverySelection): string[] {
  return normalizeDiscoverySelection(selection).leagueCodes;
}

function createInitialSnapshot(): LeagueDiscoverySnapshot {
  return { matches: [], group: null, reuseExpiresAt: 0, checksIssued: 0, retryAt: 0, canAutomaticallyRetry: false };
}

function isReusable(snapshot: LeagueDiscoverySnapshot): boolean {
  return snapshot.reuseExpiresAt > Date.now();
}

/** Query owns retained facts and shared cycles; this module only queues transient batch work. */
export function createMatchDiscoveryQueries({ queryClient, discoverOnce }: {
  queryClient: QueryClient;
  discoverOnce: (selection: { date: string; leagueCodes: string[] }) => Promise<DiscoveryResult>;
}): MatchDiscoveryQueries {
  const queuedChecksByDate = new Map<string, QueuedCheck[]>();
  function readSnapshot(date: string, code: string): LeagueDiscoverySnapshot {
    return queryClient.getQueryData<LeagueDiscoverySnapshot>(getDiscoveryQueryKey(date, code)) ?? createInitialSnapshot();
  }

  function canCheckFixtures(date: string, code: string): boolean {
    const query = queryClient.getQueryCache().find({ queryKey: getDiscoveryQueryKey(date, code), exact: true });
    if (!query?.isActive() || query.state.error || !focusManager.isFocused() || !onlineManager.isOnline()) return false;
    const snapshot = readSnapshot(date, code);
    if (snapshot.retryAt > Date.now()) return false;
    if (snapshot.group?.availability === 'pending' && snapshot.checksIssued > 0) {
      return snapshot.canAutomaticallyRetry && snapshot.checksIssued < MAX_CHECKS_PER_CYCLE;
    }
    return !isReusable(snapshot);
  }

  function createUpdatedSnapshot(previous: LeagueDiscoverySnapshot, group: DiscoveryGroup, matches: NormalizedMatch[], responseDelay: number | null): LeagueDiscoverySnapshot {
    const checkedAt = group.lastSuccessfulCheckAt ? Date.parse(group.lastSuccessfulCheckAt) : NaN;
    const reuseExpiresAt = group.availability === 'available' && !group.isStale
      && Number.isFinite(checkedAt) && checkedAt <= Date.now() ? checkedAt + FIXTURE_REUSE_WINDOW_MS : 0;
    const isPending = group.availability === 'pending';
    const delay = Math.max(isPending ? MIN_PENDING_RETRY_SECONDS : 0, group.retryAfterSeconds ?? 0, responseDelay ?? 0);
    const retained = group.availability === 'available' ? matches
      : [...new Map([...previous.matches, ...matches].map(match => [match.catalogMatchId ?? match.id, match])).values()];
    return {
      matches: retained,
      group,
      reuseExpiresAt,
      checksIssued: previous.checksIssued,
      retryAt: delay ? Date.now() + delay * 1000 : 0,
      canAutomaticallyRetry: isPending && delay <= MAX_AUTOMATIC_RETRY_DELAY_SECONDS && previous.checksIssued < MAX_CHECKS_PER_CYCLE,
    };
  }

  async function dispatchBatch(date: string, entries: QueuedCheck[]): Promise<void> {
    const jobs: (QueuedCheck & { snapshot: LeagueDiscoverySnapshot })[] = [];
    for (const entry of entries) {
      if (!canCheckFixtures(date, entry.code)) {
        entry.resolve(readSnapshot(date, entry.code));
        continue;
      }
      const previous = readSnapshot(date, entry.code);
      const snapshot = {
        ...previous,
        checksIssued: previous.group?.availability === 'pending' ? previous.checksIssued + 1 : 1,
      };
      // Reserve before transport so every observer shares the same follow-up allowance.
      queryClient.setQueryData(getDiscoveryQueryKey(date, entry.code), snapshot);
      jobs.push({ ...entry, snapshot });
    }
    if (!jobs.length) return;
    try {
      const result = await discoverOnce({ date, leagueCodes: jobs.map(job => job.code) });
      for (const job of jobs) {
        const groups = result.groups.filter(group => group.leagueCode === job.code);
        if (groups.length !== 1 || groups[0].date !== date) {
          job.reject(new Error('Invalid discovery group correspondence'));
          continue;
        }
        const matches = result.matches.filter(match => match.league === job.code);
        job.resolve(createUpdatedSnapshot(job.snapshot, groups[0], matches, result.retryAfterSeconds));
      }
    } catch {
      // Whole-response parsing remains owned by the injected, validated discovery adapter.
      jobs.forEach(job => job.reject(new Error(DISCOVERY_UNAVAILABLE_MESSAGE)));
    }
  }

  function enqueueCheck(date: string, code: string): Promise<LeagueDiscoverySnapshot> {
    return new Promise((resolve, reject) => {
      const existing = queuedChecksByDate.get(date);
      const entry = { code, resolve, reject };
      if (existing) {
        existing.push(entry);
        return;
      }
      queuedChecksByDate.set(date, [entry]);
      queueMicrotask(() => {
        const entries = queuedChecksByDate.get(date) ?? [];
        queuedChecksByDate.delete(date);
        for (let offset = 0; offset < entries.length; offset += MAX_LEAGUES_PER_BATCH) {
          void dispatchBatch(date, entries.slice(offset, offset + MAX_LEAGUES_PER_BATCH));
        }
      });
    });
  }

  function createQueryOptions(selection: DiscoverySelection): UseQueryOptions<LeagueDiscoverySnapshot>[] {
    return normalizeSelectedLeagueCodes(selection).map(code => queryOptions<LeagueDiscoverySnapshot>({
      queryKey: getDiscoveryQueryKey(selection.date, code),
      queryFn: () => {
        if (canCheckFixtures(selection.date, code)) return enqueueCheck(selection.date, code);
        return Promise.resolve(readSnapshot(selection.date, code));
      },
      enabled: selection.active,
      gcTime: 30 * 60_000,
      staleTime: query => Math.max(0, (query.state.data?.reuseExpiresAt ?? 0) - query.state.dataUpdatedAt),
      retry: false,
      retryOnMount: false,
      refetchOnReconnect: false,
      refetchOnMount: () => canCheckFixtures(selection.date, code),
      refetchOnWindowFocus: () => canCheckFixtures(selection.date, code),
      refetchIntervalInBackground: false,
      refetchInterval: query => {
        const snapshot = query.state.data;
        return snapshot?.canAutomaticallyRetry && !query.state.error && query.isActive()
          && focusManager.isFocused() && onlineManager.isOnline()
          ? Math.max(1, snapshot.retryAt - Date.now()) : false;
      },
    }));
  }

  function createViewModel(selection: DiscoverySelection, results: readonly QueryObserverResult<LeagueDiscoverySnapshot>[]): DiscoveryViewModel {
    const codes = normalizeSelectedLeagueCodes(selection);
    const matches = results.flatMap(result => result.data?.matches ?? []);
    const leagueStates: LeagueDiscoveryState[] = results.map((result, index) => {
      const snapshot = result.data ?? createInitialSnapshot();
      const availability = snapshot.group?.availability;
      let status: LeagueDiscoveryState['status'];
      if (!onlineManager.isOnline() || result.isPaused) status = 'offline';
      else if (result.isError) status = 'error';
      else if (!snapshot.group) status = 'initial';
      else if (result.isFetching) status = 'updating';
      else if (availability === 'pending' || availability === 'partial' || availability === 'deferred') status = availability;
      else if (availability === 'unavailable') status = 'error';
      // The reuse deadline schedules another check; the server decides whether returned fixtures are outdated.
      else if (snapshot.reuseExpiresAt === 0) status = 'outdated';
      else status = snapshot.matches.length ? 'available' : 'empty';
      let message = DISCOVERY_STATUS_MESSAGES[status];
      if (status === 'pending' && snapshot.canAutomaticallyRetry) {
        message = 'Fixtures are pending. Checking again shortly.';
      }
      const retryAt = snapshot.retryAt > Date.now() ? snapshot.retryAt : null;
      if (retryAt !== null && !snapshot.canAutomaticallyRetry && (status === 'pending' || status === 'deferred')) {
        message = `Fixtures are ${status}. Retry after ${new Date(retryAt).toLocaleTimeString()}.`;
      }
      return { leagueCode: codes[index], status, message, retryAt };
    });
    const hasUsableResults = results.some(result => result.data && (result.data.matches.length > 0 || result.data.group?.availability === 'available'));
    const isFetching = results.some(result => result.isFetching);
    return {
      matches,
      leagueStates,
      isInitialLoading: !hasUsableResults && isFetching,
      isUpdating: hasUsableResults && isFetching,
    };
  }

  async function retry(selection: DiscoverySelection): Promise<void> {
    if (!selection.active || !focusManager.isFocused() || !onlineManager.isOnline()) return;
    await Promise.all(normalizeSelectedLeagueCodes(selection).map(async code => {
      const queryKey = getDiscoveryQueryKey(selection.date, code);
      const query = queryClient.getQueryCache().find({ queryKey, exact: true });
      if (!query?.isActive()) return;
      if (query.state.fetchStatus === 'idle') {
        const snapshot = readSnapshot(selection.date, code);
        if (snapshot.retryAt > Date.now() || (isReusable(snapshot) && !query.state.error)) return;
        queryClient.setQueryData(queryKey, { ...snapshot, checksIssued: 0, canAutomaticallyRetry: false });
      }
      await queryClient.refetchQueries({ queryKey, exact: true, type: 'active' }, { cancelRefetch: false });
    }));
  }

  return { createQueryOptions, createViewModel, retry };
}
