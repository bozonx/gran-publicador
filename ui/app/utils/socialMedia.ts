import type { SocialMedia } from '~/types/socialMedia'

export const SOCIAL_MEDIA_COLORS: Record<string, string> = {
    TELEGRAM: '#0088cc',
    VK: '#4a76a8',
    YOUTUBE: '#ff0000',
    TIKTOK: '#000000',
    FACEBOOK: '#1877f2',
    SITE: '#6b7280',
}

export const SOCIAL_MEDIA_ICONS: Record<string, string> = {
    TELEGRAM: 'i-simple-icons-telegram',
    VK: 'i-simple-icons-vk',
    YOUTUBE: 'i-simple-icons-youtube',
    TIKTOK: 'i-simple-icons-tiktok',
    FACEBOOK: 'i-simple-icons-facebook',
    SITE: 'i-heroicons-globe-alt',
}

export const SOCIAL_MEDIA_WEIGHTS: Record<string, number> = {
    FACEBOOK: 1,
    VK: 1,
    YOUTUBE: 2,
    TIKTOK: 2,
    TELEGRAM: 3,
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
        { value: 'VK', label: t('socialMedia.vk') },
        { value: 'YOUTUBE', label: t('socialMedia.youtube') },
        { value: 'TIKTOK', label: t('socialMedia.tiktok') },
        { value: 'FACEBOOK', label: t('socialMedia.facebook') },
        { value: 'SITE', label: t('socialMedia.site') },
    ]
}
