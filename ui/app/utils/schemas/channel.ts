import { z } from 'zod';
import type { ComposerTranslation } from 'vue-i18n';

import {
  getPlatformConfig,
  SOCIAL_MEDIA_VALUES,
  type SocialMedia,
} from '@gran/shared/social-media-platforms';

export const createChannelBaseObject = (t: ComposerTranslation) => {
  return z.object({
    name: z.string().min(1, t('validation.required')),
    description: z.string().optional(),
    channelIdentifier: z.string().min(1, t('validation.required')),
    language: z.string().min(1, t('validation.required')),
    socialMedia: z.enum(SOCIAL_MEDIA_VALUES),
    tags: z.string().optional(),
    credentials: z.object({
      telegramChannelId: z.string().optional(),
      telegramBotToken: z.string().optional(),
      vkAccessToken: z.string().optional(),
      apiKey: z.string().optional(),
    }),
    preferences: z
      .object({
        staleChannelsDays: z.preprocess(
          val => (val === '' || val === null ? undefined : val),
          z.coerce
            .number()
            .min(1, t('validation.min', { min: 1 }))
            .optional(),
        ),
        footers: z
          .array(
            z.object({
              id: z.string(),
              name: z.string().min(1, t('validation.required')),
              content: z.string().min(1, t('validation.required')),
              isDefault: z.boolean(),
            }),
          )
          .optional(),
      })
      .optional(),
  });
};

export const channelRefinement = (t: ComposerTranslation) => (val: any, ctx: z.RefinementCtx) => {
  const platform = val.socialMedia as SocialMedia;
  const config = getPlatformConfig(platform);
  if (!config) return;

  for (const field of config.credentials) {
    if (!field.required) continue;
    const value = val.credentials?.[field.key];
    if (typeof value === 'string' ? value.trim().length === 0 : value == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: t('validation.required'),
        path: ['credentials', field.key],
      });
    }
  }
};

export const createChannelSchema = (t: ComposerTranslation) => {
  return createChannelBaseObject(t).superRefine(channelRefinement(t));
};

export const updateChannelSchema = (t: ComposerTranslation) => {
  // Similar to create but looser if needed, or identical
  return createChannelSchema(t);
};
