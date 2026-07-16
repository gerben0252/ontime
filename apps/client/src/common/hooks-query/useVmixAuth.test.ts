import { parseVmixAuth } from './useVmixAuth';

describe('parseVmixAuth', () => {
  // the two lines that matter, copied from the real vMix 29 telestrator page
  const page = `
    <script>
      var hostnameAndPort = document.location.hostname + ":" + document.location.port;
      t = new Telestrator("holder1", "canvas1", "canvas2", protocol + "//" + hostnameAndPort + "/telestratorsocket?auth=99f446fd-b561-4cb8-b895-529d5e7af565", marginY, drawCompleteEvent);
      v = new WebSocketVideo("video1", protocol + "//" + hostnameAndPort + "/videosocket?auth=99f446fd-b561-4cb8-b895-529d5e7af565");
    </script>
  `;

  it('reads both tokens from the page', () => {
    expect(parseVmixAuth(page)).toEqual({
      video: '99f446fd-b561-4cb8-b895-529d5e7af565',
      telestrator: '99f446fd-b561-4cb8-b895-529d5e7af565',
    });
  });

  it('does not mistake telestratorsocket for videosocket', () => {
    // both endpoints end in "socket", so the video pattern must not match the telestrator line
    const telestratorOnly = '"/telestratorsocket?auth=aaaaaaaa-1111-2222-3333-444444444444"';
    expect(parseVmixAuth(telestratorOnly)).toEqual({
      video: null,
      telestrator: 'aaaaaaaa-1111-2222-3333-444444444444',
    });
  });

  it('keeps the tokens apart when vMix issues different ones', () => {
    const mixed = `
      "/telestratorsocket?auth=11111111-1111-1111-1111-111111111111"
      "/videosocket?auth=22222222-2222-2222-2222-222222222222"
    `;
    expect(parseVmixAuth(mixed)).toEqual({
      video: '22222222-2222-2222-2222-222222222222',
      telestrator: '11111111-1111-1111-1111-111111111111',
    });
  });

  it('returns nulls when the page carries no tokens', () => {
    expect(parseVmixAuth('<html><body>vMix</body></html>')).toEqual({ video: null, telestrator: null });
  });
});
