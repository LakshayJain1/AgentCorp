/**
 * Headers for calls to /api/ai on the hosted site. BYOK keys are deliberately NOT sent here:
 * on the desktop app they are used only by the desktop shell (see ai/transport.ts), so
 * the server never receives a user's key.
 */
export async function aiHeaders(): Promise<Record<string, string>> {
  return { 'Content-Type': 'application/json' };
}
