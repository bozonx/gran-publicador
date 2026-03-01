/**
 * Authentication middleware
 * Protects routes that require authentication
 * Supports hybrid auth: Telegram + Browser
 */
export default defineNuxtRouteMiddleware(async (_to) => {
  const { isAuthenticated, initialize, isLoading, isInitialized } = useAuth()

  // Wait for auth initialization if still loading and not yet initialized
  if (isLoading.value && !isInitialized.value) {
    // If we're on the client, we can wait. On the server, plugin should have handled it.
    if (import.meta.client) {
      await initialize()
    }
  }

  // If not authenticated, try to initialize one more time if not already done
  if (!isAuthenticated.value && !isInitialized.value) {
    await initialize()
  }

  if (!isAuthenticated.value) {
    // Always redirect to login page if we are not authenticated
    return navigateTo('/auth/login', {
      redirectCode: 302,
      replace: true,
    })
  }
})

