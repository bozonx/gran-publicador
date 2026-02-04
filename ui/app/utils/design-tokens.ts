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
  textareaRows: 6,
} as const

export const GRID_LAYOUTS = {
  // Two column responsive grid
  twoColumn: 'grid grid-cols-1 md:grid-cols-2 gap-6',
  
  // Metrics grid
  metrics: 'grid grid-cols-2 gap-3',
  
  // Channel selection grid
  channelGrid: 'grid grid-cols-1 sm:grid-cols-2 gap-3',

  // Three column responsive grid
  threeColumn: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6',
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

export const CARD_STYLES = {
  // Base card classes (defined in main.css as app-card)
  base: 'app-card',
  hover: 'app-card-hover',
  
  // Padding variants (responsive)
  paddingCompact: 'p-2 sm:p-3',
  paddingNormal: 'p-3 sm:p-4',
  paddingSpacious: 'p-4 sm:p-6',
  
  // Border variants
  borderPrimary: 'border-gray-200 dark:border-gray-700',
  borderSubtle: 'border-gray-100 dark:border-gray-700/50',
  
  // Background variants
  bgPrimary: 'bg-white dark:bg-gray-800',
  bgSubtle: 'bg-gray-50 dark:bg-gray-800/50',
} as const

export const SPACING = {
  // Vertical spacing between elements (responsive)
  sectionGap: 'space-y-6 sm:space-y-8',
  cardGap: 'space-y-4 sm:space-y-6',
  fieldGap: 'space-y-3 sm:space-y-4',
  compactGap: 'space-y-2 sm:space-y-3',
  tightGap: 'space-y-1 sm:space-y-2',
  
  // Margins (responsive)
  sectionMargin: 'mb-6 sm:mb-8',
  cardMargin: 'mb-4 sm:mb-6',
  fieldMargin: 'mb-3 sm:mb-4',
  compactMargin: 'mb-2 sm:mb-3',
  tightMargin: 'mb-1 sm:mb-2',
} as const

