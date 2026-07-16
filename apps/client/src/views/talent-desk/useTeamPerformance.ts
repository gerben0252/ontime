import { useQuery } from '@tanstack/react-query';

import { buildDatasourceUrl, TeamPerformanceSheet } from './talentDesk.options';
import {
  Facts,
  LineupTeam,
  parseFacts,
  parseLineup,
  parseScoreview,
  Scoreview,
  TeamPerformanceRow,
} from './teamPerformance.utils';

async function fetchDatasource(url: string): Promise<TeamPerformanceRow[]> {
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = (await response.json()) as TeamPerformanceRow[];
  return Array.isArray(data) ? data : [];
}

/**
 * Reads one TeamPerformance datasource.
 * Only the visible sheet is enabled, so switching tabs also switches the polling.
 */
function useDatasource<T>(
  ip: string,
  sheet: TeamPerformanceSheet,
  parse: (data: TeamPerformanceRow[]) => T,
  enabled: boolean,
  refetchInterval: number,
) {
  return useQuery({
    queryKey: ['team-performance', ip, sheet],
    queryFn: async () => parse(await fetchDatasource(buildDatasourceUrl(ip, sheet))),
    enabled,
    refetchInterval,
    retry: false,
    placeholderData: (previous) => previous,
  });
}

/** lineups only change between periods, so they are polled slowly */
export function useLineup(ip: string, enabled: boolean): LineupTeam[] {
  const { data } = useDatasource(ip, 'lineup', parseLineup, enabled, 30_000);
  return data ?? [];
}

/** stats move during play */
export function useFacts(ip: string, enabled: boolean): Facts | null {
  const { data } = useDatasource(ip, 'facts', parseFacts, enabled, 5000);
  return data ?? null;
}

/** goals move during play */
export function useScoreview(ip: string, enabled: boolean): Scoreview | null {
  const { data } = useDatasource(ip, 'scoreview', parseScoreview, enabled, 5000);
  return data ?? null;
}
