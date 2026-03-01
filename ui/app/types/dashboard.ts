import type { SocialMedia } from './socialMedia';

export interface DashboardSummary {
  projects: any[];
  recentContent: any[];
  channelsSummary: {
    totalCount: number;
    grouped: Array<{ count: number; socialMedia: SocialMedia }>;
  };
  publications: {
    scheduled: {
      items: any[];
      total: number;
      groupedByProject: Array<{
        project: { id: string; name: string };
        publications: any[];
      }>;
    };
    problems: {
      items: any[];
      total: number;
      groupedByProject: Array<{
        project: { id: string; name: string };
        publications: any[];
      }>;
    };
    recentPublished: {
      items: any[];
      total: number;
    };
  };
  timestamp: string;
}
