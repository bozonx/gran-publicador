/**
 * Checks if channel credentials are missing or empty.
 * Returns true if credentials object is missing, null, empty or contains only empty values.
 * If socialMedia is provided, it checks for specific required fields.
 */
export function isChannelCredentialsEmpty(credentials: any, socialMedia?: string): boolean {
    if (!credentials || typeof credentials !== 'object') {
        return true
    }

    const values = Object.values(credentials)
    if (values.length === 0) {
        return true
    }

    // Social-media specific checks
    if (socialMedia === 'TELEGRAM') {
        const { botToken, chatId } = credentials
        if (!botToken || !chatId || 
            String(botToken).trim().length === 0 || 
            String(chatId).trim().length === 0) {
            return true
        }
    } else if (socialMedia === 'VK') {
        const { accessToken } = credentials
        if (!accessToken || String(accessToken).trim().length === 0) {
            return true
        }
    }

    // Fallback: check if all values are null, undefined or empty strings
    return values.every((v: any) => {
        return v === null || v === undefined || String(v).trim().length === 0
    })
}
