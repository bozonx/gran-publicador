import { describe, it, expect } from '@jest/globals';
import { 
    getPlatformConfig, 
    getPostTypeConfig, 
    isPlatformPostTypeSupported, 
    getConfiguredPlatforms,
    SocialMedia,
    PostType
} from '../../src/social-media-platforms.constants.js';

describe('SocialMediaPlatforms', () => {
    describe('getPlatformConfig', () => {
        it('should return config for supported platforms', () => {
            expect(getPlatformConfig(SocialMedia.TELEGRAM)).toBeDefined();
            expect(getPlatformConfig(SocialMedia.VK)).toBeDefined();
        });

        it('should return undefined for unknown platform', () => {
            expect(getPlatformConfig('unknown' as any)).toBeUndefined();
        });
    });

    describe('getPostTypeConfig', () => {
        it('should return post type config', () => {
            const config = getPostTypeConfig(SocialMedia.TELEGRAM, PostType.POST);
            expect(config).toBeDefined();
            expect(config?.content.maxTextLength).toBe(4096);
        });

        it('should return undefined for unsupported post type', () => {
            expect(getPostTypeConfig(SocialMedia.SITE, PostType.STORY)).toBeUndefined();
        });
    });

    describe('isPlatformPostTypeSupported', () => {
        it('should return true for supported post types', () => {
            expect(isPlatformPostTypeSupported(SocialMedia.TELEGRAM, PostType.POST)).toBe(true);
            expect(isPlatformPostTypeSupported(SocialMedia.TELEGRAM, PostType.ARTICLE)).toBe(true);
        });

        it('should return false for unsupported post types', () => {
            expect(isPlatformPostTypeSupported(SocialMedia.SITE, PostType.STORY)).toBe(false);
        });
    });

    describe('getConfiguredPlatforms', () => {
        it('should return list of configured platforms', () => {
            const platforms = getConfiguredPlatforms();
            expect(platforms).toContain(SocialMedia.TELEGRAM);
            expect(platforms).toContain(SocialMedia.VK);
            expect(platforms).toContain(SocialMedia.SITE);
        });
    });
});
