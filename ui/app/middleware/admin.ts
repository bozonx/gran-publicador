/**
 * Admin middleware
 * Protects routes that require admin privileges
 */
export default defineNuxtRouteMiddleware((_to, _from) => {
  const { isAdmin, isAuthenticated } = useAuth()

  // First check if user is authenticated
  if (!isAuthenticated.value) {
    return navigateTo('/auth/login')
  }

  // Then check if user is admin
  if (!isAdmin.value) {
    // Redirect to home with error message
    return navigateTo('/')
  }
})
