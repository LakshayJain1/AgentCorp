import type { Metadata } from 'next';

// The workspace is private (behind sign-in): keep it out of search and AI indexes.
export const metadata: Metadata = {
  title: 'Workspace',
  robots: { index: false, follow: false },
};

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
