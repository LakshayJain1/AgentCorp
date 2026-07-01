export {}

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      onboardingComplete?: boolean
      companyName?: string
      companyProduct?: string
      developersCount?: number
    }
  }
}
