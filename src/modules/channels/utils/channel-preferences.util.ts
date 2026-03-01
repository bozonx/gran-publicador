export class ChannelPreferencesUtil {
  public static getJsonObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }

  public static parse(value: unknown): {
    disableNotification?: boolean;
    protectContent?: boolean;
    staleChannelsDays?: number;
    templates?: Array<{
      projectTemplateId: string;
      excluded?: boolean;
      overrides?: Record<string, unknown>;
    }>;
  } {
    const prefs = this.getJsonObject(value);
    const templates = prefs.templates;

    return {
      disableNotification:
        typeof prefs.disableNotification === 'boolean' ? prefs.disableNotification : undefined,
      protectContent: typeof prefs.protectContent === 'boolean' ? prefs.protectContent : undefined,
      staleChannelsDays:
        typeof prefs.staleChannelsDays === 'number' ? prefs.staleChannelsDays : undefined,
      templates: Array.isArray(templates)
        ? templates
            .map(t => this.getJsonObject(t))
            .filter(t => typeof t.projectTemplateId === 'string')
            .map(t => ({
              projectTemplateId: t.projectTemplateId as string,
              excluded: typeof t.excluded === 'boolean' ? t.excluded : undefined,
              overrides: this.getJsonObject(t.overrides),
            }))
        : undefined,
    };
  }
}
