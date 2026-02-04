import { computed } from 'vue';
import type { ComputedRef } from 'vue';
import type { BreadcrumbItem } from '@nuxt/ui';

interface MobileBackConfig {
  visible: boolean;
  label: string;
  fallbackTo: string;
  onClick: () => void;
}

interface PageChrome {
  mobileBack: ComputedRef<MobileBackConfig>;
  breadcrumbs: ComputedRef<{
    visible: boolean;
    items: BreadcrumbItem[];
  }>;
}

function getParamAsString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return null;
}

export function usePageChrome(): PageChrome {
  const route = useRoute();
  const { t } = useI18n();

  const { currentProject } = useProjects();
  const { currentChannel } = useChannels();
  const { currentPublication } = usePublications();

  const { goBackOrTo } = useNavigation();

  const projectId = computed(() => getParamAsString(route.params.id));
  const channelId = computed(() => getParamAsString(route.params.id));
  const publicationId = computed(() => getParamAsString(route.params.id));

  const mobileBack = computed<MobileBackConfig>(() => {
    const path = route.path;

    const defaultConfig: MobileBackConfig = {
      visible: false,
      label: '',
      fallbackTo: '/',
      onClick: () => {},
    };

    if (path.startsWith('/projects/') && path.endsWith('/settings')) {
      const pid = projectId.value;
      if (!pid) return defaultConfig;

      return {
        visible: true,
        label: t('common.back_to_project'),
        fallbackTo: `/projects/${pid}`,
        onClick: () => goBackOrTo(`/projects/${pid}`),
      };
    }

    if (path.startsWith('/projects/') && path.endsWith('/news')) {
      const pid = projectId.value;
      if (!pid) return defaultConfig;

      return {
        visible: true,
        label: t('common.back_to_project'),
        fallbackTo: `/projects/${pid}`,
        onClick: () => goBackOrTo(`/projects/${pid}`),
      };
    }

    if (path.startsWith('/projects/') && path.endsWith('/content-library')) {
      const pid = projectId.value;
      if (!pid) return defaultConfig;

      return {
        visible: true,
        label: t('common.back_to_project'),
        fallbackTo: `/projects/${pid}`,
        onClick: () => goBackOrTo(`/projects/${pid}`),
      };
    }

    if (
      path.startsWith('/projects/') &&
      projectId.value &&
      path === `/projects/${projectId.value}`
    ) {
      return {
        visible: true,
        label: t('common.back_to_projects'),
        fallbackTo: '/projects',
        onClick: () => goBackOrTo('/projects'),
      };
    }

    if (path.startsWith('/channels/') && path.endsWith('/settings')) {
      const cid = channelId.value;
      if (!cid) return defaultConfig;

      return {
        visible: true,
        label: t('common.back_to_channel'),
        fallbackTo: `/channels/${cid}`,
        onClick: () => goBackOrTo(`/channels/${cid}`),
      };
    }

    if (
      path.startsWith('/channels/') &&
      channelId.value &&
      path === `/channels/${channelId.value}`
    ) {
      return {
        visible: true,
        label: t('common.back_to_channels'),
        fallbackTo: '/channels',
        onClick: () => goBackOrTo('/channels'),
      };
    }

    if (path.startsWith('/publications/') && path.endsWith('/edit')) {
      return {
        visible: true,
        label: t('common.back_to_drafts'),
        fallbackTo: '/publications?status=DRAFT',
        onClick: () => goBackOrTo('/publications?status=DRAFT'),
      };
    }

    if (
      path.startsWith('/publications/') &&
      publicationId.value &&
      path === `/publications/${publicationId.value}`
    ) {
      return {
        visible: true,
        label: t('common.back_to_publications'),
        fallbackTo: '/publications',
        onClick: () => goBackOrTo('/publications'),
      };
    }

    if (path.startsWith('/admin/users/')) {
      return {
        visible: true,
        label: t('common.back_to_users'),
        fallbackTo: '/admin',
        onClick: () => goBackOrTo('/admin'),
      };
    }

    return defaultConfig;
  });

  const breadcrumbs = computed(() => {
    const path = route.path;
    const items: BreadcrumbItem[] = [];

    const pushItem = (item: BreadcrumbItem) => {
      items.push(item);
    };

    if (path.startsWith('/projects')) {
      pushItem({
        label: t('navigation.projects'),
        to: '/projects',
        icon: 'i-heroicons-briefcase',
      });

      if (projectId.value) {
        pushItem({
          label: currentProject.value?.name || t('navigation.projects'),
          to: `/projects/${projectId.value}`,
          icon: 'i-heroicons-folder',
        });

        if (path.endsWith('/settings')) {
          pushItem({
            label: t('navigation.settings'),
            icon: 'i-heroicons-cog-6-tooth',
          });
        } else if (path.endsWith('/news')) {
          pushItem({ label: t('navigation.news'), icon: 'i-heroicons-newspaper' });
        } else if (path.endsWith('/content-library')) {
          pushItem({
            label: t('contentLibrary.title'),
            icon: 'i-heroicons-rectangle-stack',
          });
        }
      }

      return { visible: items.length > 1, items };
    }

    if (path.startsWith('/channels')) {
      pushItem({
        label: t('navigation.channels'),
        to: '/channels',
        icon: 'i-heroicons-hashtag',
      });

      if (channelId.value) {
        pushItem({
          label: currentChannel.value?.name || t('navigation.channels'),
          to: `/channels/${channelId.value}`,
          icon: 'i-heroicons-megaphone',
        });

        if (path.endsWith('/settings')) {
          pushItem({
            label: t('navigation.settings'),
            icon: 'i-heroicons-cog-6-tooth',
          });
        }
      }

      return { visible: items.length > 1, items };
    }

    if (path.startsWith('/publications')) {
      pushItem({
        label: t('navigation.publications'),
        to: '/publications',
        icon: 'i-heroicons-document-text',
      });

      if (publicationId.value) {
        pushItem({
          label: currentPublication.value?.title || t('post.untitled'),
          to: `/publications/${publicationId.value}`,
          icon: 'i-heroicons-document',
        });

        if (path.endsWith('/edit')) {
          pushItem({ label: t('common.edit'), icon: 'i-heroicons-pencil-square' });
        }
      }

      return { visible: items.length > 1, items };
    }

    if (path.startsWith('/admin')) {
      pushItem({
        label: t('navigation.admin'),
        to: '/admin',
        icon: 'i-heroicons-shield-check',
      });

      if (path.startsWith('/admin/users/')) {
        pushItem({
          label: t('navigation.users'),
          to: '/admin',
          icon: 'i-heroicons-users',
        });
        pushItem({ label: t('common.user'), icon: 'i-heroicons-user' });
      }

      return { visible: items.length > 1, items };
    }

    return { visible: false, items: [] as BreadcrumbItem[] };
  });

  return {
    mobileBack,
    breadcrumbs,
  };
}
