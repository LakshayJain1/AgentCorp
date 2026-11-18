import { ImageResponse } from 'next/og';
import { SITE_NAME } from '@/lib/seo';

export const alt = 'AgentCorp - AI Office Simulation';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, background: '#1A1A1A', color: '#fff' }}>
        <div style={{ fontSize: 96, fontWeight: 700 }}>{SITE_NAME}</div>
        <div style={{ fontSize: 40, marginTop: 24, color: 'rgba(255,255,255,0.65)' }}>
          A team of AI agents that plan, build and ship work.
        </div>
      </div>
    ),
    size,
  );
}
