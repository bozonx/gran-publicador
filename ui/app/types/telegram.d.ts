/**
 * Telegram WebApp types
 * @see https://core.telegram.org/bots/webapps
 */

interface TelegramWebAppUser {
  id: number
  is_bot?: boolean
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
  photo_url?: string
}

interface TelegramWebAppInitData {
  query_id?: string
  user?: TelegramWebAppUser
  receiver?: TelegramWebAppUser
  chat_instance?: string
  chat_type?: string
  start_param?: string
  auth_date: number
  hash: string
}

interface TelegramWebApp {
  initData: string
  initDataUnsafe: TelegramWebAppInitData
  version: string
  platform: string
  colorScheme: 'light' | 'dark'
  themeParams: Record<string, string>
  isExpanded: boolean
  viewportHeight: number
  viewportStableHeight: number
  headerColor: string
  backgroundColor: string
  isClosingConfirmationEnabled: boolean
  ready: () => void
  expand: () => void
  close: () => void
  enableClosingConfirmation: () => void
  disableClosingConfirmation: () => void
  setHeaderColor: (color: string) => void
  setBackgroundColor: (color: string) => void
  showAlert: (message: string, callback?: () => void) => void
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void
  showPopup: (
    params: {
      title?: string
      message: string
      buttons?: Array<{
        id?: string
        type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive'
        text?: string
      }>
    },
    callback?: (buttonId: string) => void
  ) => void
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
    selectionChanged: () => void
  }
}

interface Telegram {
  WebApp: TelegramWebApp
}

declare global {
  interface Window {
    Telegram?: Telegram
  }
}

export type { TelegramWebApp, TelegramWebAppUser, TelegramWebAppInitData, Telegram }
