// Unauthenticated users see the onboard page (the wizard handles the email-code
// sign-in step). Onboarding completion lives in Zustand (localStorage), so the
// "already initialized" redirect is handled client-side in onboard/page.tsx.
export default function OnboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
