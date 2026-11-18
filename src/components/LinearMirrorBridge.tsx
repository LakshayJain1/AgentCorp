'use client';

import { useEffect } from 'react';
import { startLinearMirror } from '@/engine/LinearMirror';
import { startLinearPoller } from '@/engine/LinearPoller';

/** Starts the Linear mirror (app -> Linear) and poller (Linear -> app) for as long as the workspace is open. Renders nothing. */
export default function LinearMirrorBridge() {
  useEffect(() => {
    const mirror = startLinearMirror();
    const poller = startLinearPoller();
    return () => {
      mirror.stop();
      poller.stop();
    };
  }, []);
  return null;
}
