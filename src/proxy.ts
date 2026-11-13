import { clerkMiddleware } from '@clerk/nextjs/server';

// Clerk session handling for every request. Routes enforce their own access
// (each API route calls getUserId()), so nothing is globally blocked here.
export default clerkMiddleware();

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
