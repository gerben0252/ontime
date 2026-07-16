import { useQuery } from '@tanstack/react-query';

interface ScoreboardEntry {
  time: string;
  period: string;
  status: string;
}

/**
 * Polls an external scoreboard endpoint once per second.
 * The endpoint returns an array of entries, eg:
 *   [{ "time": "0:00", "period": "0", "status": "OK" }]
 */
async function fetchScoreboard(url: string): Promise<ScoreboardEntry | null> {
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = (await response.json()) as ScoreboardEntry[];
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

export function useScoreboard(url: string | null): ScoreboardEntry | null {
  const enabled = Boolean(url);

  const { data } = useQuery({
    queryKey: ['scoreboard', url],
    queryFn: () => fetchScoreboard(url as string),
    enabled,
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
    retry: false,
    placeholderData: (previous) => previous,
  });

  return data ?? null;
}
