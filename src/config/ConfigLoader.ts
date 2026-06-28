const fetchCache = new Map<string, string>();

async function fetchText(path: string): Promise<string> {
  if (fetchCache.has(path)) return fetchCache.get(path)!;
  const res = await fetch(path);
  if (!res.ok) throw new Error(`ConfigLoader: failed to load ${path} (${res.status})`);
  const text = await res.text();
  fetchCache.set(path, text);
  return text;
}

function getSection(markdown: string, heading: string): string {
  const pattern = new RegExp(`^## ${escapeRegExp(heading)}\\s*$([\\s\\S]*?)(?=^## |\\z)`, 'm');
  const match = markdown.match(pattern);
  return match ? match[1].trim() : '';
}

function getSubSection(section: string, subheading: string): string {
  const pattern = new RegExp(`^### ${escapeRegExp(subheading)}\\s*$([\\s\\S]*?)(?=^### |^## |\\z)`, 'm');
  const match = section.match(pattern);
  return match ? match[1].trim() : '';
}

function parseTable<T extends Record<string, string>>(markdown: string): T[] {
  const lines = markdown.split('\n').filter(l => l.trim());
  const headerLine = lines.find(l => l.startsWith('|') && l.includes('|'));
  if (!headerLine) return [];

  const headers = headerLine.split('|').filter((_, i, a) => i > 0 && i < a.length - 1).map(h => h.trim());
  const separatorIdx = lines.findIndex(l => l.match(/^\|[\s\-:|]+\|?$/));
  const dataLines = separatorIdx >= 0 ? lines.slice(separatorIdx + 1) : lines.slice(1);

  return dataLines
    .filter(l => l.startsWith('|') && l.includes('|'))
    .map(l => {
      const cells = l.split('|').filter((_, i, a) => i > 0 && i < a.length - 1).map(c => c.trim());
      const row = {} as Record<string, string>;
      headers.forEach((h, i) => { row[h] = cells[i] || ''; });
      return row as unknown as T;
    });
}

function parseBulletList(markdown: string): string[] {
  return markdown
    .split('\n')
    .map(l => l.replace(/^[\s]*[-*]\s+/, '').trim())
    .filter(Boolean);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const codeFenceCache = new Map<string, RegExp>();

function extractCodeBlock(markdown: string, lang?: string): string {
  const key = lang || '*';
  if (!codeFenceCache.has(key)) {
    const langPattern = lang ? lang : '\\w+';
    codeFenceCache.set(key, new RegExp(`\`\`\`${langPattern}\\s*\\n([\\s\\S]*?)\\n\`\`\``));
  }
  const match = markdown.match(codeFenceCache.get(key)!);
  return match ? match[1].trim() : '';
}

function extractAllCodeBlocks(markdown: string): Map<string, string> {
  const blocks = new Map<string, string>();
  const pattern = /^#{2,4}\s+([^\n]+)\s*$[\s\S]*?```(\w*)\s*\n([\s\S]*?)```/gm;
  let match;
  while ((match = pattern.exec(markdown)) !== null) {
    blocks.set(match[1].trim(), match[3].trim());
  }
  return blocks;
}

function getSubSections(section: string): Map<string, string> {
  const subs = new Map<string, string>();
  const pattern = /^### ([^\n]+)\s*$([\s\S]*?)(?=^### |^## |\z)/gm;
  let match;
  while ((match = pattern.exec(section)) !== null) {
    subs.set(match[1].trim(), match[2].trim());
  }
  return subs;
}

function getNestedSubSections(subsection: string): Map<string, string> {
  const subs = new Map<string, string>();
  const pattern = /^#### ([^\n]+)\s*$([\s\S]*?)(?=^#### |^### |^## |\z)/gm;
  let match;
  while ((match = pattern.exec(subsection)) !== null) {
    subs.set(match[1].trim(), match[2].trim());
  }
  return subs;
}

function clearCache(): void {
  fetchCache.clear();
  codeFenceCache.clear();
}

export type TemplateVars = Record<string, string>;

function interpolate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`);
}

export const configLoader = {
  fetchText,
  getSection,
  getSubSection,
  getSubSections,
  getNestedSubSections,
  parseTable,
  parseBulletList,
  extractCodeBlock,
  extractAllCodeBlocks,
  clearCache,
  interpolate,
};
