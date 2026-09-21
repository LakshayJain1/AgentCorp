import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <SignIn
        appearance={{
          elements: {
            card: 'shadow-none border border-navy/10 rounded-2xl',
          },
        }}
      />
    </div>
  );
}
