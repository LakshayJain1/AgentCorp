'use client';

import { useUser } from '@clerk/nextjs';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  picture: string;
}

/**
 * Thin wrapper over Clerk's useUser() so components keep one stable shape:
 * `{ user, isLoading }` where `user` is null when signed out.
 */
export function useAuthUser(): { user: AuthUser | null; isLoading: boolean } {
  const { isLoaded, isSignedIn, user } = useUser();
  if (!isLoaded) return { user: null, isLoading: true };
  if (!isSignedIn || !user) return { user: null, isLoading: false };
  return {
    isLoading: false,
    user: {
      id: user.id,
      name: user.fullName || user.firstName || '',
      email: user.primaryEmailAddress?.emailAddress ?? '',
      picture: user.hasImage ? user.imageUrl : '',
    },
  };
}
