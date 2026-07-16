import { useQuery } from '@tanstack/react-query';

export interface VmixAuth {
  /** token for the /videosocket endpoint */
  video: string | null;
  /** token for the /telestratorsocket endpoint */
  telestrator: string | null;
}

const emptyAuth: VmixAuth = { video: null, telestrator: null };

/**
 * vMix mints fresh socket tokens every time it starts, so they cannot be configured.
 * Its own telestrator page hardcodes both tokens into the script that opens the
 * sockets, which makes that page the only place to read them from.
 */
const TELESTRATOR_PAGE = '/telestrator/';

const videoPattern = /[^a-z]videosocket\?auth=([0-9a-fA-F-]+)/;
const telestratorPattern = /telestratorsocket\?auth=([0-9a-fA-F-]+)/;

/** Pulls the socket tokens out of the vMix telestrator page source */
export function parseVmixAuth(page: string): VmixAuth {
  return {
    video: videoPattern.exec(page)?.[1] ?? null,
    telestrator: telestratorPattern.exec(page)?.[1] ?? null,
  };
}

async function fetchVmixAuth(host: string, port: number): Promise<VmixAuth> {
  const response = await fetch(`http://${host}:${port}${TELESTRATOR_PAGE}`);
  if (!response.ok) return emptyAuth;
  return parseVmixAuth(await response.text());
}

/**
 * Reads the current vMix socket tokens.
 *
 * The tokens only change when vMix restarts, which also drops every socket, so we
 * refetch slowly and let the socket reconnects pick up the new value.
 */
export function useVmixAuth(host: string | null, port: number): VmixAuth {
  const { data } = useQuery({
    queryKey: ['vmix-auth', host, port],
    queryFn: () => fetchVmixAuth(host as string, port),
    enabled: Boolean(host),
    refetchInterval: 30_000,
    retry: false,
    placeholderData: (previous) => previous,
  });

  return data ?? emptyAuth;
}
