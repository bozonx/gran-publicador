# Telegram Bot Menu System Design

## Overview

This document describes the menu-based interaction system for the Telegram bot that collects reposts and posts from users to create draft publications.

## Core Concepts

### User States
- **Authenticated** - User exists in DB and is not banned
- **Banned** - User exists but is banned
- **Not Found** - User doesn't exist in DB
- **New** - User just created via /start

### Menu States (stored in Redis)
- **home** - Initial state, waiting for content
- **collect** - Collecting additional source texts and media

### Session Data Structure (Redis)

**Key format:** `telegram:session:{telegramUserId}`  
**TTL:** Configurable via `TELEGRAM_SESSION_TTL_MINUTES` (default: 10 minutes)

**Value (JSON):**
```json
{
  "menu": "home" | "collect",
  "publicationId": "uuid",
  "menuMessageId": "telegram_message_id",
  "createdAt": "ISO8601 timestamp",
  "metadata": {
    "sourceTextsCount": 0,
    "mediaCount": 0
  }
}
```

## User Validation Flow

Every incoming message (except /start) must pass through user validation:

```
┌─────────────────────┐
│  Message Received   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Find User by       │
│  Telegram ID        │
└──────────┬──────────┘
           │
           ├─── User Not Found ──────────────┐
           │                                  │
           ├─── User Found & Banned ─────────┤
           │                                  │
           └─── User Found & Not Banned ─────┤
                                              │
                                              ▼
                                    ┌─────────────────────┐
                                    │  Show Error Message │
                                    │  Stop Processing    │
                                    └─────────────────────┘
```

### Error Messages

**User Not Found:**
```
❌ User not found in the system.
Please send /start to begin.
```

**User Banned:**
```
🚫 Your account has been banned.
Reason: {banReason}

If you believe this is a mistake, please contact support.
```

## Command Handlers

### /start Command

**Purpose:** Create new user or welcome existing user

**Flow:**
```
1. Check if user exists by telegramId
2. If exists:
   - Update user info (username, firstName, lastName) if changed
   - Send welcome_existing message
3. If not exists:
   - Create new user
   - Send welcome_new message
4. Clear any existing session in Redis
5. User is now in "no menu" state (waiting for content)
```

**Messages:**
- `telegram.welcome_new` - For new users
- `telegram.welcome_existing` - For returning users

## Menu System

### Menu: Home (Initial State)

**Entry Condition:** User sends content when no active session exists

**Actions:**
1. Validate user (see User Validation Flow)
2. Determine content type:
   - **Repost/Forward** - Extract forwarded message content
   - **Regular message** - Use message text/media
3. Create draft publication:
   ```typescript
   {
     status: 'DRAFT',
     createdBy: userId,
     projectId: null, // Personal draft
     content: extractedText || '',
     sourceTexts: [{
       content: extractedText,
       order: 0,
       source: formatSource(message) // "telegram:{chatId},{messageId}" or "manual"
     }],
     meta: {
       telegramOrigin: {
         chatId: message.chat.id,
         messageId: message.message_id,
         forwardOrigin: message.forward_origin || null
       }
     }
   }
   ```
4. Create media records for publication (if any)
5. Create Redis session
6. Send menu message with inline keyboard
7. Transition to **collect** menu

**Media Handling:**
- Photos: Create `PublicationMedia` with `Media` (type: IMAGE)
- Videos: Create `PublicationMedia` with `Media` (type: VIDEO)
- Documents: Create `PublicationMedia` with `Media` (type: DOCUMENT)
- Audio: Create `PublicationMedia` with `Media` (type: AUDIO)
- **Storage:** Use `TELEGRAM` storage type, store `file_id` in `storagePath`

**Menu Message:**
```
✅ Draft created!

📝 Content: {truncatedContent}
📎 Media: {mediaCount}
📄 Source texts: {sourceTextsCount}

You can now:
• Send more messages to add source texts
• Send media to attach to publication
• Click "Done" when ready
```

**Inline Keyboard:**
```
[ ✅ Done ] [ 🗑 Cancel ]
```

### Menu: Collect

**Entry Condition:** Active session exists with menu="collect"

**Actions:**
1. Validate user
2. Load session from Redis
3. Verify publication exists
4. Process incoming content:
   - **Text message:** Add to `sourceTexts` array
   - **Media:** Create new `PublicationMedia` record
   - **Repost:** Extract content and add to `sourceTexts`
5. Update publication in DB
6. Update session metadata in Redis (reset TTL)
7. Edit menu message to show updated stats

**Error Handling:**
- If publication not found: Clear session, send error, return to "no menu"
- If limit reached: Send warning message, don't add content
- If media upload fails: Send error, continue session

**Button Actions:**

**✅ Done:**
1. Clear Redis session
2. Send completion message with publication link
3. Return to "no menu" state

**🗑 Cancel:**
1. Delete draft publication (cascade deletes media)
2. Clear Redis session
3. Send cancellation message
4. Return to "no menu" state

**Completion Message:**
```
✅ Draft publication saved!

You can edit it in Gran Publicador:
{frontendUrl}/publications/{publicationId}

Send another message to create a new draft.
```

## Source Text Format

```typescript
interface SourceText {
  content: string;
  order: number; // Auto-incremented
  source?: string; // Format: "telegram:{chatId},{messageId}" | "url:{url}" | "manual"
}
```

**Source Format Examples:**
- `telegram:123456789,42` - From Telegram chat 123456789, message 42
- `url:https://example.com/article` - From URL
- `manual` - Manually entered text

## Redis Session Management

### Session Creation
```typescript
await redis.set(
  `telegram:session:${telegramUserId}`,
  JSON.stringify(sessionData),
  'EX',
  sessionTtlMinutes * 60
);
```

### Session Retrieval
```typescript
const sessionJson = await redis.get(`telegram:session:${telegramUserId}`);
const session = sessionJson ? JSON.parse(sessionJson) : null;
```

### Session Update
```typescript
// Update metadata and reset TTL
session.metadata.sourceTextsCount++;
await redis.set(
  `telegram:session:${telegramUserId}`,
  JSON.stringify(session),
  'EX',
  sessionTtlMinutes * 60
);
```

### Session Deletion
```typescript
await redis.del(`telegram:session:${telegramUserId}`);
```

### Last Menu Message Tracking

To prevent old menu messages from accumulating in the chat, we track the last menu message ID separately:

**Key format:** `telegram:last_menu:{telegramUserId}`  
**TTL:** 24 hours

**Purpose:** When creating a new draft, the bot deletes the previous menu message (if it exists) before sending the new one. This keeps the chat clean and prevents confusion.

**Flow:**
1. When creating a new draft (`handleHomeMenu`), delete the previous menu message asynchronously
2. After sending the new menu message, store its ID
3. When completing/cancelling a draft (`handleDone`/`handleCancel`), store the menu message ID
4. The stored ID will be used to delete the message when creating the next draft


## Environment Variables

Add to `.env.development.example`:

```bash
# Telegram Bot Session Configuration
# Session TTL in minutes (default: 10)
TELEGRAM_SESSION_TTL_MINUTES=10
# Frontend URL for publication links in bot messages
FRONTEND_URL="http://localhost:3000"
```

## Database Schema Considerations

### Existing Schema Support
- ✅ `Publication.sourceTexts` - JSON array for source texts
- ✅ `Publication.meta` - JSON for Telegram origin metadata
- ✅ `PublicationMedia` - For media attachments
- ✅ `Media` with `TELEGRAM` storage type

### No Schema Changes Required

## Implementation Plan

### Phase 1: Core Infrastructure ✅ COMPLETED
1. ✅ Create `TelegramSessionService` for Redis operations
2. ✅ Add environment variables and configuration
3. ✅ Create user validation middleware/helper
4. ✅ Add i18n keys for all messages

### Phase 2: User Management ✅ COMPLETED
1. ✅ Implement user validation flow
2. ✅ Update `/start` command handler
3. ✅ Add error messages for banned/not found users

### Phase 3: Menu System ✅ COMPLETED
1. ✅ Implement session state machine
2. ✅ Create `home` menu handler
3. ✅ Create `collect` menu handler
4. ✅ Implement inline keyboard handlers

### Phase 4: Content Processing ✅ COMPLETED
1. ✅ Implement repost/forward detection
2. ✅ Create publication draft creation logic
3. ✅ Implement media handling (photos, videos, documents)
4. ✅ Add source text extraction and formatting

### Phase 5: Polish (TODO)
1. ⏳ Add logging and monitoring
2. ⏳ Write unit tests
3. ⏳ Write E2E tests

## Notes

**Limits Removed:** As per user request, there are NO limits on source texts or media count. Users can add as much content as they need through the bot.

## Testing Strategy

### Unit Tests
- `TelegramSessionService` - Redis operations
- User validation logic
- Content extraction helpers
- Source text formatting

### E2E Tests
- Complete flow: /start → send repost → add texts → done
- User not found scenario
- Banned user scenario
- Session expiration
- Limits (max texts, max media)
- Cancel flow

## Security Considerations

1. **Session Hijacking:** Sessions are tied to Telegram user ID (validated by Telegram)
2. **Rate Limiting:** Consider adding rate limits per user
3. **Content Validation:** Sanitize text content before storing
4. **Media Validation:** Validate media types and sizes
5. **Redis Security:** Use Redis password in production

## Future Enhancements

1. **Project Selection:** Allow user to choose project for publication
2. **Templates:** Quick templates for common publication types
3. **Scheduling:** Set publication date via bot
4. **Preview:** Show formatted preview before saving
5. **Multi-language:** Detect and set publication language
6. **Batch Operations:** Process multiple reposts at once

## Open Questions

1. Should we allow editing existing drafts via bot?
2. Should we send notifications when session expires?
3. Should we support voice messages as source texts?
4. Should we auto-detect publication language from content?
5. Should we support channel selection for direct publishing?

## References

- Prisma Schema: `prisma/schema.prisma`
- Current Bot Implementation: `src/modules/telegram-bot/`
- Redis Configuration: `src/config/redis.config.ts`
- i18n Files: `src/i18n/{lang}/telegram.json`
