#!/bin/bash

# Script to replace loading spinners with UiLoadingSpinner component

# Define files and their replacements
declare -A files_to_update=(
  # Pages
  ["app/pages/publications/index.vue"]="629"
  ["app/pages/publications/[id]/index.vue"]="150"
  ["app/pages/publications/[id]/edit.vue"]="879"
  ["app/pages/projects/index.vue"]="244"
  ["app/pages/projects/[id]/index.vue"]="480,518,559"
  ["app/pages/projects/[id]/settings.vue"]="183"
  ["app/pages/projects/[id]/news.vue"]="662"
  ["app/pages/channels/[id]/index.vue"]="421,649,687,736"
  ["app/pages/channels/[id]/settings.vue"]="131"
  ["app/pages/admin/index.vue"]="475"
  ["app/pages/admin/users/[id].vue"]="140"
  ["app/pages/news.vue"]="288"
  
  # Components
  ["app/components/channels/DashboardPanel.vue"]="59"
  ["app/components/publications/DraftsSection.vue"]="77"
  ["app/components/settings/SettingsApiTokens.vue"]="162"
  ["app/components/settings/SettingsNotifications.vue"]="114"
  ["app/components/settings/SettingsLlmPromptTemplates.vue"]="352"
  ["app/components/posts/AuthorSignatureManager.vue"]="179"
  ["app/components/features/AuthStatus.vue"]="18"
  ["app/components/features/ChannelsList.vue"]="198"
  ["app/components/news/SourceTagSelector.vue"]="280,316"
)

echo "Files that need spinner updates:"
for file in "${!files_to_update[@]}"; do
  echo "  - $file (lines: ${files_to_update[$file]})"
done

echo ""
echo "Total files to update: ${#files_to_update[@]}"
