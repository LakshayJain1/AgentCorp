/**
 * Resolves "the newest installer" from GitHub Releases, so the download page
 * never links to a file that might not exist.
 *
 * Installers are not stored in git or in the Vercel deployment (they are far too
 * large, and a build from git would not contain them). They live on GitHub
 * Releases; this picks the right asset out of the latest PUBLISHED release
 * (the "latest" endpoint ignores drafts and pre-releases).
 */

export const RELEASES_REPO = process.env.RELEASES_REPO || 'LakshayJain1/AgentCorp';

/** Public URL path -> installer file name attached to each release (see desktop/package.json artifactName). */
export const DOWNLOAD_ASSETS: Record<string, string> = {
  windows: 'AgentCorp-Setup.exe',
  'windows-portable': 'AgentCorp-Portable.exe',
};

export interface ReleaseAsset {
  name?: unknown;
  browser_download_url?: unknown;
}

export interface LatestRelease {
  tag_name?: unknown;
  assets?: unknown;
}

/** Where to send people when there is nothing to download yet. */
export function releasesPageUrl(repo = RELEASES_REPO): string {
  return `https://github.com/${repo}/releases`;
}

/**
 * The browser download URL for `assetName` in `release`, or null. The URL is
 * only accepted if it really points at this repo's release downloads, so a
 * malformed or hostile API response can never turn this into an open redirect.
 */
export function pickAssetUrl(release: LatestRelease | null | undefined, assetName: string, repo = RELEASES_REPO): string | null {
  if (!release || !Array.isArray(release.assets)) return null;
  const prefix = `https://github.com/${repo}/releases/download/`;
  for (const a of release.assets as ReleaseAsset[]) {
    if (!a || typeof a.name !== 'string' || typeof a.browser_download_url !== 'string') continue;
    if (a.name !== assetName) continue;
    return a.browser_download_url.startsWith(prefix) ? a.browser_download_url : null;
  }
  return null;
}
