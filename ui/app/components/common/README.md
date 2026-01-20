This directory contains reusable components for unifying the application interface.

## Components

### Forms

#### CommonField
Unified read-only field for displaying immutable data in forms.
- `label` (string, required) - Field label
- `value` (string | number | null | undefined, required) - Value
- `help` (string, optional) - Tooltip text
- `icon` (string, optional) - Icon name
- `formatAsDate` (boolean, default: false) - Format as date
- `mono` (boolean, default: false) - Use monospace font

### Metrics

#### CommonMetric
Inline metric display with icon and value.
- `icon` (string, required) - Icon name
- `label` (string, required) - Metric label
- `value` (string | number, required) - Value
- `variant` ('default' | 'error' | 'warning' | 'success', default: 'default') - Color scheme
- `bold` (boolean, default: false) - Bold font for value

#### CommonDashboardMetric
Metric in a styled container (for dashboard).
- `icon` (string, required) - Icon name
- `label` (string, required) - Metric label
- `value` (string | number, required) - Value

### Cards

#### CommonCardHeader
Standard header for entity cards.
- `title` (string, required) - Title
- `badge` (string, optional) - Badge text
- `badgeColor` ('error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral', optional) - Badge color
- `actions` - Action buttons and indicators

#### CommonDescription
Description with line clamping.
- `text` (string | null, optional) - Description text
- `lines` (number, default: 2) - Number of lines to display

#### CommonCardFooter
Unified footer for cards.
- `withBorder` (boolean, default: true) - Show top border
- `spacing` ('compact' | 'normal' | 'spacious', default: 'normal') - Padding size

### Data Display

#### CommonAlertBadge
Badge for displaying warnings and alerts.
- `icon` (string, required) - Icon name
- `text` (string, required) - Warning text
- `variant` ('warning' | 'error' | 'info', default: 'warning') - Warning type

#### CommonChannelStack
Display social network icons of channels.
- `channels` (SimpleChannel[], required) - Array of channels
- `maxVisible` (number, default: 5) - Max number of displayed icons
- `stacked` (boolean, default: true) - Stacked icon style

#### CommonLanguageTags
Display language tags.
- `languages` (string[], required) - Array of language codes
- `mode` ('compact' | 'normal', default: 'normal') - Display mode

#### useFormatters
Set of utilities for data formatting.
**Methods:**
- `formatDateShort(date: string | null | undefined): string` - Short date format
- `formatDateWithTime(date: string | null | undefined): string` - Date with time
- `truncateContent(content: string | null | undefined, maxLength?: number): string` - Truncate HTML content
- `formatNumber(value: number | null | undefined): string` - Number formatting

## Usage Principles
1. **Auto-import**: All components in `/components/common/` are automatically available with the `Common` prefix
2. **Type Safety**: All props are strictly typed via TypeScript
3. **Defaults**: Sensible default values for optional props
4. **Flexibility**: Use slots for customization
5. **Consistency**: Use these components instead of creating duplicate code

## Refactoring Examples

### Before:
(Generic HTML and styles)

### After:
(Using Common components)

## See Also
- [Project Readme](../../../README.md)
