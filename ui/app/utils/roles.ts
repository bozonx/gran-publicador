export type BadgeColor = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'

export function getRoleBadgeColor(role: string | undefined | null): BadgeColor {
    if (!role) return 'neutral'
    const colors: Record<string, BadgeColor> = {
        owner: 'primary',
        admin: 'secondary',
        editor: 'info',
        viewer: 'neutral',
    }
    return colors[role.toLowerCase()] || 'neutral'
}
