/**
 * Authentication middleware
 * Protects routes that require authentication
 * Supports hybrid auth: Telegram + Browser
 */
export default defineNuxtRouteMiddleware(async (_to) => {
  const { isAuthenticated, initialize, isLoading, authMode } = useAuth()

  // Wait for auth initialization if still loading
  if (isLoading.value) {
    return
  }

  // If not authenticated, try to initialize
  if (!isAuthenticated.value) {
    const user = await initialize()

    if (!user) {
      // Always redirect to login page if we are not authenticated
      // This allows showing the Telegram Widget on production
      return navigateTo('/auth/login', {
        redirectCode: 302,
        replace: true,
      })
    }
  }
})
