import { NextResponse } from 'next/server';
import { DOWNLOAD_ASSETS, RELEASES_REPO, pickAssetFromReleases, releasesPageUrl } from '@/lib/releases';

/**
 * GET /api/download/windows  (or windows-portable)
 *
 * Redirects to the installer attached to the newest published GitHub release
 * (pre-releases included).
 * If there is no published release yet (or GitHub is unreachable) it sends the
 * visitor to the Releases page instead — never to a URL that would 404 and
 * download a web page named "AgentCorp-Setup.exe".
 *
 * The lookup is cached for 5 minutes, so GitHub's unauthenticated API limit is
 * not a concern for normal traffic.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ asset: string }> }) {
  const { asset } = await params;
  const fileName = Object.prototype.hasOwnProperty.call(DOWNLOAD_ASSETS, asset) ? DOWNLOAD_ASSETS[asset] : null;
  if (!fileName) return NextResponse.json({ error: 'Unknown download' }, { status: 404 });

  try {
    // The release LIST (not /releases/latest, which hides pre-releases such as 1.0.0-beta.N).
    const res = await fetch(`https://api.github.com/repos/${RELEASES_REPO}/releases?per_page=10`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'agentcorp-download' },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const url = pickAssetFromReleases(await res.json(), fileName);
      if (url) return NextResponse.redirect(url, 302);
    }
  } catch {
    // fall through to the Releases page
  }
  return NextResponse.redirect(releasesPageUrl(), 302);
}
