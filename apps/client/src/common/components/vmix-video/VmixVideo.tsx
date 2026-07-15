import { useEffect, useRef } from 'react';

import { WebSocketVideo } from './webSocketVideo';

/** vMix streams the video socket from its web controller, always at low latency */
const LOW_LATENCY = 0.2;

interface VmixVideoProps {
  /** hostname or IP of the vMix instance */
  host: string | null;
  /** port of the vMix web controller */
  port?: number;
  /** auth token of the vMix video socket */
  auth: string | null;
  className?: string;
}

/**
 * Live video feed from a vMix instance, received over a websocket and fed into a
 * MediaSource buffer. Reusable across views: give it a host, an auth token and a
 * className that sizes the element.
 */
export default function VmixVideo({ host, port = 8088, auth, className }: VmixVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !host || !auth) return;

    // the vMix websocket is plain ws, unless we are served over https
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${host}:${port}/videosocket?auth=${encodeURIComponent(auth)}`;

    const player = new WebSocketVideo(video, url, LOW_LATENCY);
    player.start();

    return () => player.stop();
  }, [host, port, auth]);

  // muted is required for the stream to autoplay without a user gesture
  return <video ref={videoRef} className={className} muted autoPlay playsInline />;
}
