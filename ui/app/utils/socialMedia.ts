import type { SocialMedia } from '~/types/socialMedia'

export const SOCIAL_MEDIA_COLORS: Record<string, string> = {
    TELEGRAM: '#0088cc',
    INSTAGRAM: '#e1306c',
    VK: '#4a76a8',
    YOUTUBE: '#ff0000',
    TIKTOK: '#000000',
    X: '#000000',
    FACEBOOK: '#1877f2',
    LINKEDIN: '#0077b5',
    SITE: '#6b7280',
}

export const SOCIAL_MEDIA_ICONS: Record<string, string> = {
    TELEGRAM: 'i-simple-icons-telegram',
    INSTAGRAM: 'i-simple-icons-instagram',
    VK: 'i-simple-icons-vk',
    YOUTUBE: 'i-simple-icons-youtube',
    TIKTOK: 'i-simple-icons-tiktok',
    X: 'i-simple-icons-x',
    FACEBOOK: 'i-simple-icons-facebook',
    LINKEDIN: 'i-simple-icons-linkedin',
    SITE: 'i-heroicons-globe-alt',
}

export const SOCIAL_MEDIA_WEIGHTS: Record<string, number> = {
    FACEBOOK: 1,
    VK: 1,
    YOUTUBE: 2,
    TIKTOK: 2,
    INSTAGRAM: 2,
    TELEGRAM: 3,
    X: 4,
    LINKEDIN: 4,
    SITE: 4
}

export function getSocialMediaColor(socialMedia: SocialMedia | string): string {
    return SOCIAL_MEDIA_COLORS[socialMedia] || '#6b7280'
}

export function getSocialMediaIcon(socialMedia: SocialMedia | string): string {
    return SOCIAL_MEDIA_ICONS[socialMedia] || 'i-heroicons-hashtag'
}

export function getSocialMediaDisplayName(socialMedia: SocialMedia | string, t: (key: string) => string): string {
    return t(`socialMedia.${socialMedia.toLowerCase()}`)
}

export function getSocialMediaOptions(t: (key: string) => string) {
    return [
        { value: 'TELEGRAM', label: t('socialMedia.telegram') },
        { value: 'INSTAGRAM', label: t('socialMedia.instagram') },
        { value: 'VK', label: t('socialMedia.vk') },
        { value: 'YOUTUBE', label: t('socialMedia.youtube') },
        { value: 'TIKTOK', label: t('socialMedia.tiktok') },
        { value: 'X', label: t('socialMedia.x') },
        { value: 'FACEBOOK', label: t('socialMedia.facebook') },
        { value: 'LINKEDIN', label: t('socialMedia.linkedin') },
        { value: 'SITE', label: t('socialMedia.site') },
    ]
}
