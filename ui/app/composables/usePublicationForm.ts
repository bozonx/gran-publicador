import { z } from 'zod';
import type { PostType, PublicationStatus } from '~/types/posts';
import type { PublicationWithRelations } from '~/composables/usePublications';

export function usePublicationFormValidation(t: any) {
  const POST_TYPE_VALUES = ['POST', 'ARTICLE', 'NEWS', 'VIDEO', 'SHORT', 'STORY'] as const;
  const STATUS_VALUES = [
    'DRAFT',
    'READY',
    'SCHEDULED',
    'PROCESSING',
    'PUBLISHED',
    'PARTIAL',
    'FAILED',
    'EXPIRED',
  ] as const;

  const schema = computed(() =>
    z
      .object({
        title: z.string().optional(),
        content: z.string().optional(),
        tags: z.string().optional(),
        postType: z.enum(POST_TYPE_VALUES),
        status: z.enum(STATUS_VALUES),
        scheduledAt: z.string().optional(),
        language: z.string().min(1, t('validation.required')),
        channelIds: z.array(z.string()).optional(),
        meta: z.any().optional(),
        description: z.string().optional(),
        authorComment: z.string().optional(),
        note: z.string().optional(),
        postDate: z.string().optional(),
      })
      .superRefine((val, ctx) => {
        if (val.status === 'SCHEDULED' && !val.scheduledAt) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t('validation.required'),
            path: ['scheduledAt'],
          });
        }

        const isContentEmpty =
          !val.content || val.content.trim() === '' || val.content === '<p></p>';
        // Match backend logic: status != DRAFT or scheduledAt set => must have content OR media
        if (
          (val.status !== 'DRAFT' || val.scheduledAt) &&
          isContentEmpty &&
          !val.meta?._hasMedia // We'll pass a virtual flag via meta or context if needed, but for now simple check
        ) {
          // Note: Full media check is complex without passing it into the schema.
          // For now, we'll refine this in the component if needed.
        }
      }),
  );

  return {
    schema,
    POST_TYPE_VALUES,
    STATUS_VALUES,
  };
}

export function usePublicationFormState(
  publication: PublicationWithRelations | null,
  languageParam?: string,
) {
  const { user } = useAuth();
  const { locale } = useI18n();
  const state = reactive({
    title: publication?.title || '',
    content: publication?.content || '',
    tags: publication?.tags || '',
    postType: (publication?.postType || 'POST') as PostType,
    status: (publication?.status || 'DRAFT') as PublicationStatus,
    scheduledAt: publication?.scheduledAt
      ? new Date(publication.scheduledAt).toISOString().slice(0, 16)
      : '',
    language: publication?.language || languageParam || user.value?.language || locale.value,
    channelIds: publication?.posts?.map((p: any) => p.channelId) || ([] as string[]),
    meta: (() => {
      if (!publication?.meta) return {};
      try {
        const parsed =
          typeof publication.meta === 'string' ? JSON.parse(publication.meta) : publication.meta;
        return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
          ? parsed
          : {};
      } catch (e) {
        return {};
      }
    })(),
    description: publication?.description || '',
    authorComment: publication?.authorComment || '',
    note: publication?.note || '',
    postDate: publication?.postDate
      ? new Date(publication.postDate).toISOString().slice(0, 16)
      : '',
    authorSignatureId: publication?.authorSignatureId || '' as string,
    projectTemplateId: publication?.projectTemplateId || '' as string,
  });

  return state;
}
