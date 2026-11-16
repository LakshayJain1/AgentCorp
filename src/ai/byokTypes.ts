/** Shapes shared by the desktop bridge (window.electronAPI.ai) and the settings UI. */

export interface AiProviderInfo {
  id: string;
  label: string;
  base: string | null;
  defaultModel: string;
  models: string[];
  keyUrl: string | null;
  needsKey: boolean;
}

/** What the page may know about the saved key. The key itself is never exposed. */
export interface AiStatus {
  configured: boolean;
  provider: string | null;
  model: string | null;
  baseUrl: string | null;
  /** The last 4 characters only, e.g. "…1234". */
  keyHint: string;
  providers: AiProviderInfo[];
}

export interface AiRunRequest {
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface AiRunResult {
  ok: boolean;
  content?: string;
  error?: string;
  status?: number;
}

export interface AiBridge {
  status: () => Promise<AiStatus>;
  save: (input: { provider: string; model?: string; baseUrl?: string; key: string }) => Promise<{ ok: boolean; error?: string; status?: AiStatus }>;
  setModel: (model: string) => Promise<{ ok: boolean; error?: string; status?: AiStatus }>;
  clear: () => Promise<{ ok: boolean; status?: AiStatus }>;
  test: () => Promise<{ ok: boolean; error?: string; ms?: number; model?: string }>;
  run: (req: AiRunRequest, onDelta?: (text: string) => void) => { cancel: () => void; result: Promise<AiRunResult> };
}
