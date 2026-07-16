/**
 * Helpers for calling the vMix web controller HTTP API.
 * See https://www.vmix.com/help27/ShortcutFunctionReference.html
 */

export const DEFAULT_VMIX_PORT = 8088;

/**
 * Fires a vMix function.
 * Returns whether the call was accepted; vMix answers 200 with a plain text body.
 */
export async function sendVmixFunction(
  host: string,
  port: number,
  fn: string,
  params: Record<string, string | number> = {},
): Promise<boolean> {
  const search = new URLSearchParams({ Function: fn });
  for (const [key, value] of Object.entries(params)) {
    search.set(key, String(value));
  }

  try {
    const response = await fetch(`http://${host}:${port}/api/?${search.toString()}`);
    return response.ok;
  } catch {
    // vMix unreachable: the caller decides how loud to be about it
    return false;
  }
}

/** Cuts to an input using the Merge transition */
export function vmixMergeToInput(host: string, port: number, input: string, duration: number): Promise<boolean> {
  // transition names double as function names in the vMix API
  return sendVmixFunction(host, port, 'Merge', { Input: input, Duration: duration });
}

/**
 * Selects a row of a vMix data source.
 * `datasource` is the "Name,Table" pair as shown in vMix, the row index is zero based.
 */
export function vmixSelectDataSourceRow(
  host: string,
  port: number,
  datasource: string,
  row: number,
): Promise<boolean> {
  return sendVmixFunction(host, port, 'DataSourceSelectRow', { Value: `${datasource},${row}` });
}

/** Brings an input in on an overlay channel */
export function vmixOverlayIn(host: string, port: number, channel: number, input: string): Promise<boolean> {
  return sendVmixFunction(host, port, `OverlayInput${channel}In`, { Input: input });
}

/** Takes an overlay channel out */
export function vmixOverlayOut(host: string, port: number, channel: number): Promise<boolean> {
  return sendVmixFunction(host, port, `OverlayInput${channel}Out`);
}
