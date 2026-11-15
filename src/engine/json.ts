/**
 * Pull the first complete JSON object out of model output that may be wrapped
 * in prose or ``` fences. String-aware brace matching, so braces inside string
 * values (code, JSON-in-JSON) don't end the object early.
 */
export function extractJsonObject(text: string): unknown | null {
  if (!text) return null;
  const cleaned = text.replace(/```(?:json|JSON)?/g, '');
  for (let start = cleaned.indexOf('{'); start >= 0; start = cleaned.indexOf('{', start + 1)) {
    let depth = 0;
    let inStr = false;
    let escaped = false;
    for (let i = start; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (inStr) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(cleaned.slice(start, i + 1));
          } catch {
            break; // not valid JSON from this start; try the next '{'
          }
        }
      }
    }
  }
  return null;
}

export function extractJsonArray(text: string): unknown[] | null {
  if (!text) return null;
  const cleaned = text.replace(/```(?:json|JSON)?/g, '');
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start < 0 || end <= start) return null;
  try {
    const v = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}
