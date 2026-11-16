import { detectExecutorEnv } from '@/execution/ToolExecutor';

/**
 * What the installed desktop shell can actually do (C0d).
 *
 * The desktop app loads the hosted site, so web code updates instantly but the
 * preload bridge only changes with a new installer. We therefore feature-detect
 * the bridge instead of assuming it matches this build, and explain what's
 * missing rather than failing in the middle of a run.
 */

export type DesktopFeature = 'fs' | 'fs-list' | 'exec' | 'exec-approved' | 'checks' | 'runs' | 'ai';

export interface DesktopCaps {
  isDesktop: boolean;
  ipcVersion: number;
  features: ReadonlySet<DesktopFeature>;
  workspaceRoot: string | null;
  /** Human-readable reasons for features this build of the web app wants but the shell lacks. */
  missing: string[];
}

const FEATURE_LABEL: Record<DesktopFeature, string> = {
  fs: 'reading and writing files',
  'fs-list': 'listing folders',
  exec: 'running checks',
  'exec-approved': 'running approved commands (npm install, git)',
  checks: 'running type-check, lint and tests',
  runs: 'keeping runs alive in the background',
  ai: 'using your own AI key',
};

/** Features the autonomous developer loop needs in order to be useful. */
export const LOOP_REQUIRED: DesktopFeature[] = ['fs', 'fs-list', 'checks'];

function detectFeatures(): Set<DesktopFeature> {
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
  const out = new Set<DesktopFeature>();
  if (!api) return out;
  const has = (fn: unknown) => typeof fn === 'function';
  if (has(api.fs?.read) && has(api.fs?.write) && has(api.fs?.search)) out.add('fs');
  if (has(api.fs?.list)) out.add('fs-list');
  if (has(api.exec?.run)) out.add('exec');
  if (has(api.exec?.runApproved)) out.add('exec-approved');
  if (has(api.runChecks)) out.add('checks');
  if (has(api.runs?.setActive)) out.add('runs');
  if (has(api.ai?.run) && has(api.ai?.status)) out.add('ai');
  return out;
}

export async function getDesktopCaps(): Promise<DesktopCaps> {
  if (detectExecutorEnv() !== 'desktop') {
    return { isDesktop: false, ipcVersion: 0, features: new Set(), workspaceRoot: null, missing: [] };
  }
  const api = window.electronAPI;
  const features = detectFeatures();
  let ipcVersion = 1; // shells that predate the handshake
  try {
    const info = await api?.getInfo?.();
    if (info && typeof info.ipcVersion === 'number') ipcVersion = info.ipcVersion;
  } catch { /* keep default */ }
  let workspaceRoot: string | null = null;
  try { workspaceRoot = (await api?.workspace?.getRoot?.()) ?? null; } catch { /* none chosen */ }

  const missing = (['fs-list', 'exec-approved', 'checks', 'runs'] as DesktopFeature[])
    .filter((f) => !features.has(f))
    .map((f) => `Update the desktop app to enable ${FEATURE_LABEL[f]}.`);
  return { isDesktop: true, ipcVersion, features, workspaceRoot, missing };
}

/** Why the developer loop cannot run on this machine right now, or null if it can. */
export async function explainLoopBlocker(): Promise<string | null> {
  const caps = await getDesktopCaps();
  if (!caps.isDesktop) return 'The tool-using developer loop runs in the desktop app.';
  const lacking = LOOP_REQUIRED.filter((f) => !caps.features.has(f));
  if (lacking.length > 0) return `Update the desktop app to enable ${lacking.map((f) => FEATURE_LABEL[f]).join(', ')}.`;
  if (!caps.workspaceRoot) return 'Choose a workspace folder first (folder button in the top bar).';
  return null;
}
