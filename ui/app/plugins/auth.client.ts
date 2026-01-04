export default defineNuxtPlugin(async () => {
    const { authMode, loginWithDev, loginWithTelegram, isAuthenticated, initialize } = useAuth()

    // Initialize auth state
    await initialize()

    // Auto-login only if not already authenticated
    if (!isAuthenticated.value) {
        // In dev mode, auto-login
        if (authMode.value === 'dev') {
            // eslint-disable-next-line no-console
            console.info('Dev mode: Attempting auto-login')
            try {
                await loginWithDev()
                // eslint-disable-next-line no-console
                console.info('Dev mode: Auto-login successful')
            } catch (e) {
                console.error('Dev mode: Auto-login failed', e)
            }
        }
        // In Mini App mode, auto-login using initData
        else if (authMode.value === 'miniApp') {
            // @ts-ignore
            const tg = window.Telegram?.WebApp
            if (tg?.initData) {
                // eslint-disable-next-line no-console
                console.info('Mini App mode: Attempting auto-login')
                try {
                    await loginWithTelegram(tg.initData)
                    // eslint-disable-next-line no-console
                    console.info('Mini App mode: Auto-login successful')
                } catch (e) {
                    console.error('Mini App mode: Auto-login failed', e)
                }
            }
        }
    }
})
