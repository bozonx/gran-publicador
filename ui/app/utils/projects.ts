import type { ProjectWithRole } from '~/stores/projects';

export function canProjectBeEdited(project: ProjectWithRole | null, userId: string | undefined): boolean {
  if (!project || !userId) return false;
  return (
    project.ownerId === userId || project.role === 'owner' || project.role === 'admin'
  );
}

export function canProjectBeDeleted(project: ProjectWithRole | null, userId: string | undefined): boolean {
  if (!project || !userId) return false;
  return (
    project.ownerId === userId || project.role === 'owner' || project.role === 'admin'
  );
}

export function canProjectBeTransferred(project: ProjectWithRole | null, userId: string | undefined): boolean {
  if (!project || !userId) return false;
  return project.ownerId === userId || project.role === 'owner';
}

export function canManageProjectMembers(project: ProjectWithRole | null, userId: string | undefined): boolean {
  return canProjectBeEdited(project, userId);
}

export interface ProjectProblem {
  type: 'critical' | 'warning';
  key: string;
  count?: number;
}

export function getProjectProblems(project: ProjectWithRole | null): ProjectProblem[] {
  if (!project) return [];
  
  const problems: ProjectProblem[] = [];
  const counts = {
    failedPosts: project.failedPostsCount || 0,
    problemPublications: project.problemPublicationsCount || 0,
    staleChannels: project.staleChannelsCount || 0,
    noCredentials: project.noCredentialsChannelsCount || 0,
    inactiveChannels: project.inactiveChannelsCount || 0,
    channelCount: project.channelCount ?? -1, // -1 means unknown, but usually it's set
  };

  // Check for critical failures (failed posts)
  if (counts.failedPosts > 0) {
    problems.push({ type: 'critical', key: 'failedPosts', count: counts.failedPosts });
  }

  // Check for problem publications (critical)
  if (counts.problemPublications > 0) {
    problems.push({ type: 'critical', key: 'problemPublications', count: counts.problemPublications });
  }

  // Check for stale channels (warnings)
  if (counts.staleChannels > 0) {
    problems.push({ type: 'warning', key: 'staleChannels', count: counts.staleChannels });
  }

  // Check for no recent activity (warnings)
  if (project.lastPublicationAt) {
    const lastDate = new Date(project.lastPublicationAt).getTime();
    const now = new Date().getTime();
    const diffDays = (now - lastDate) / (1000 * 60 * 60 * 24);

    if (diffDays > 3) {
      problems.push({ type: 'warning', key: 'noRecentActivity' });
    }
  }

  // Check for channels without credentials (critical)
  if (counts.noCredentials > 0) {
    problems.push({ type: 'critical', key: 'noCredentials', count: counts.noCredentials });
  }

  // Check for inactive channels (warning)
  if (counts.inactiveChannels > 0) {
    problems.push({ type: 'warning', key: 'inactiveChannels', count: counts.inactiveChannels });
  }

  // Check for no channels (critical)
  if (counts.channelCount === 0) {
    problems.push({ type: 'critical', key: 'noChannels' });
  }

  return problems;
}

export function getProjectProblemLevel(project: ProjectWithRole | null): 'critical' | 'warning' | null {
  if (!project) return null;
  const problems = getProjectProblems(project);
  if (problems.some(p => p.type === 'critical')) return 'critical';
  if (problems.some(p => p.type === 'warning')) return 'warning';
  return null;
}

export function getProjectProblemsSummary(project: ProjectWithRole | null, t: (key: string, values?: any) => string) {
  if (!project) {
    return { problems: [], errorsCount: 0, warningsCount: 0, errorsTooltip: '', warningsTooltip: '', level: null };
  }
  
  const problems = getProjectProblems(project);
  const critical = problems.filter(p => p.type === 'critical');
  const warnings = problems.filter(p => p.type === 'warning');

  return {
    problems,
    errorsCount: critical.reduce((sum, p) => sum + (p.count || 1), 0),
    warningsCount: warnings.reduce((sum, p) => sum + (p.count || 1), 0),
    errorsTooltip: critical
      .map(p => t(`problems.project.${p.key}`, { count: p.count || 1 }))
      .join(', '),
    warningsTooltip: warnings
      .map(p => t(`problems.project.${p.key}`, { count: p.count || 1 }))
      .join(', '),
    level: critical.length > 0 ? 'critical' : warnings.length > 0 ? 'warning' : null,
  };
}
