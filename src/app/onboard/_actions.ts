'use server'

import { auth, clerkClient } from '@clerk/nextjs/server'

export async function completeClerkOnboarding(formData: {
  companyName: string
  companyProduct: string
  developersCount: number
}) {
  try {
    const authResult = await auth()
    if (!authResult.userId) {
      return { error: 'Not authenticated' }
    }

    const client = await clerkClient()
    await client.users.updateUserMetadata(authResult.userId, {
      publicMetadata: {
        onboardingComplete: true,
        companyName: formData.companyName,
        companyProduct: formData.companyProduct,
        developersCount: formData.developersCount,
      },
    })
    return { success: true }
  } catch (err) {
    console.error('[Clerk] Failed to update user metadata:', err)
    return { error: 'Failed to save onboarding status' }
  }
}
