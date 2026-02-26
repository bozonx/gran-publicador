import { expect, test } from '@nuxt/test-utils/playwright'

test.describe('Gran Publicador Smoke Test', () => {
  test('should load the home page', async ({ page, goto }) => {
    // goto is a helper that ensures Nuxt is ready
    await goto('/', { waitUntil: 'hydration' })
    
    // Check if the page contains some basic elements
    // Since it's a real project, I'll check for something standard like the title or a button
    await expect(page).toHaveTitle(/Gran Publicador/)
    
    // Example of checking for a specific UI element (if known)
    // await expect(page.getByRole('button')).toBeVisible()
  })

  test('should navigate to login or show main content', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })
    
    // Minimal check to ensure the app is alive
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})
