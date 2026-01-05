/**
 * Design tokens for consistent UI styling across the application
 */

export const FORM_SPACING = {
  // Container padding
  container: 'p-6',
  
  // Section spacing
  section: 'space-y-6',
  
  // Fields spacing within a section
  fields: 'space-y-6',
  
  // Nested elements spacing (credentials, preferences)
  nested: 'space-y-4',
  
  // Section divider with top padding
  sectionDivider: 'border-t border-gray-200 dark:border-gray-700 pt-6',
  
  // Footer/actions top padding
  footer: 'pt-6',
  
  // Header bottom margin
  headerMargin: 'mb-6',
} as const

export const FORM_STYLES = {
  // Wrapper container
  wrapper: 'bg-white dark:bg-gray-800 rounded-lg shadow p-6',
  
  // Typography
  title: 'text-xl font-semibold text-gray-900 dark:text-white',
  subtitle: 'mt-1 text-sm text-gray-500 dark:text-gray-400',
  sectionTitle: 'text-sm font-semibold text-gray-900 dark:text-white mb-4',
  
  // Input sizes
  inputSizeLarge: 'lg' as const,
  inputSizeDefault: 'md' as const,
  
  // Common field classes
  fieldFullWidth: 'w-full',
  
  // Textarea default rows
  textareaRows: 3,
} as const

export const GRID_LAYOUTS = {
  // Two column responsive grid
  twoColumn: 'grid grid-cols-1 md:grid-cols-2 gap-6',
  
  // Metrics grid
  metrics: 'grid grid-cols-2 gap-3',
  
  // Channel selection grid
  channelGrid: 'grid grid-cols-1 sm:grid-cols-2 gap-3',
} as const

export const TRANSITION_CLASSES = {
  // Standard transition for advanced sections
  enterActive: 'transition duration-100 ease-out',
  enterFrom: 'transform scale-95 opacity-0',
  enterTo: 'transform scale-100 opacity-100',
  leaveActive: 'transition duration-75 ease-in',
  leaveFrom: 'transform scale-100 opacity-100',
  leaveTo: 'transform scale-95 opacity-0',
} as const
