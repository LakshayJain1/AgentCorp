import { redirect } from 'next/navigation';

// Sign-up is the same email-code flow as sign-in, inside onboarding.
export default function SignUpPage() {
  redirect('/onboard');
}
