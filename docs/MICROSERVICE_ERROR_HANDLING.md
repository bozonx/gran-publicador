# Microservice Error Handling Improvements

## Summary

This document outlines the improvements made to error handling for microservices used in the project, ensuring that errors are properly logged, visible, and clearly indicate when microservices are unavailable.

## Changes Made

### 1. Media Storage Service (`src/modules/media/media.service.ts`)

#### Improvements:
- ✅ **Added specific error detection**: Created helper methods to detect connection errors and timeout errors
- ✅ **Preserved HTTP status codes**: Errors from the microservice now preserve their original HTTP status (400, 404, 500, etc.)
- ✅ **Clear unavailability messages**: When the Media Storage microservice is unavailable, users now see: `"Media Storage microservice is unavailable. Please check if the service is running."`
- ✅ **Enhanced logging**: All empty `catch` blocks now include proper logging
- ✅ **Specific exceptions**: Uses `ServiceUnavailableException` (503), `BadGatewayException` (502), `RequestTimeoutException` (408)

#### Key Methods Added:
```typescript
private isConnectionError(error: unknown): boolean
private handleMicroserviceError(error: unknown, operation: string): never
```

#### Error Types Handled:
- `ECONNREFUSED` - Connection refused (service not running)
- `ENOTFOUND` - DNS resolution failed
- `ECONNRESET` - Connection reset
- `AbortError` - Request timeout
- HTTP 400-499 - Client errors (preserved)
- HTTP 500+ - Server errors (wrapped in BadGatewayException)

### 2. STT Service (`src/modules/stt/stt.service.ts`)

#### Improvements:
- ✅ **Added connection error detection**: Detects when STT Gateway is unavailable
- ✅ **Added timeout detection**: Detects undici-specific timeout errors
- ✅ **Specific error messages**: Different messages for different error types
- ✅ **Better logging**: Includes stack traces for debugging

#### Error Messages:
- **Unavailable**: `"STT Gateway microservice is unavailable. Please check if the service is running."`
- **Timeout**: `"STT Gateway request timed out. The audio file may be too large or the service is overloaded."`
- **Server Error**: `"STT Gateway error: [original message]"`

### 3. Translate Service (`src/modules/translate/translate.service.ts`)

#### Improvements:
- ✅ **Added connection error detection**: Detects when Translate Gateway is unavailable
- ✅ **Added timeout detection**: Detects AbortSignal timeout errors
- ✅ **Proper HTTP exceptions**: Uses BadRequestException, BadGatewayException, etc.
- ✅ **Enhanced retry logic**: Won't retry on client errors or specific exceptions
- ✅ **Better error messages**: More descriptive error messages

#### Error Messages:
- **Unavailable**: `"Translate Gateway microservice is unavailable. Please check if the service is running."`
- **Timeout**: `"Translation request timed out. The text may be too long or the service is overloaded."`
- **Client Error**: `"Translation failed: [original message]"`
- **All retries failed**: `"All retry attempts failed: [last error message]"`

## Error Visibility

### Backend Logging

All microservice errors are now logged with:
1. **Error level**: `ERROR` for failures, `WARN` for retries
2. **Context**: Which operation failed (upload, reprocess, transcribe, translate)
3. **Details**: HTTP status codes, error messages, stack traces
4. **Service status**: Clear indication when a service is unavailable

Example log output:
```
[MediaService] ERROR Media Storage microservice error during file upload: connect ECONNREFUSED 127.0.0.1:3001
[MediaService] WARN Media Storage microservice appears to be unavailable
[SttService] ERROR Failed to transcribe audio stream: connect ECONNREFUSED 127.0.0.1:8081
[TranslateService] ERROR Translate Gateway is unavailable
```

### Frontend Error Handling

Current state:
- ⚠️ Errors are caught and logged to `console.error` in composables
- ⚠️ Error messages are stored in reactive `error` refs
- ⚠️ Some components display errors to users, but not consistently

### HTTP Status Codes

The following HTTP status codes are now properly used:

| Code | Exception | When Used |
|------|-----------|-----------|
| 400 | BadRequestException | Invalid request parameters |
| 404 | NotFoundException | Resource not found |
| 408 | RequestTimeoutException | Request timed out |
| 502 | BadGatewayException | Microservice returned an error |
| 503 | ServiceUnavailableException | Microservice is unavailable |

## Testing Microservice Unavailability

To test that errors are properly visible when microservices are unavailable:

### 1. Stop Media Storage Microservice
```bash
# Stop the media-storage-microservice container
docker compose stop media-storage-microservice
```

Then try to upload a file. You should see:
- **Backend log**: `Media Storage microservice is unavailable. Please check if the service is running.`
- **HTTP response**: 503 Service Unavailable
- **Frontend**: Error message displayed to user

### 2. Stop STT Gateway
```bash
# Stop the stt-gateway-microservice container
docker compose stop stt-gateway-microservice
```

Then try to use voice recording. You should see:
- **Backend log**: `STT Gateway microservice is unavailable. Please check if the service is running.`
- **HTTP response**: 503 Service Unavailable

### 3. Stop Translate Gateway
```bash
# Stop the translate-gateway-microservice container
docker compose stop translate-gateway-microservice
```

Then try to translate text. You should see:
- **Backend log**: `Translate Gateway microservice is unavailable. Please check if the service is running.`
- **HTTP response**: 503 Service Unavailable

## Recommendations for Further Improvements

### Frontend

1. **Consistent Error Display**
   - Create a global error notification system
   - Display all API errors to users in a consistent way
   - Consider using toast notifications for transient errors

2. **Error Recovery**
   - Add retry buttons for failed operations
   - Implement automatic retry with exponential backoff for transient errors
   - Show loading states during retries

3. **Service Status Indicators**
   - Add health check endpoints for all microservices
   - Display service status in the UI (e.g., in settings or footer)
   - Show warnings when services are degraded

4. **Better Error Messages**
   - Translate technical error messages to user-friendly language
   - Provide actionable suggestions (e.g., "Try again later" or "Contact support")
   - Include error codes for support purposes

### Backend

1. **Health Checks**
   - Implement `/health` endpoints for all microservices
   - Periodically check microservice availability
   - Cache health status to avoid repeated failed requests

2. **Circuit Breaker Pattern**
   - Implement circuit breaker for microservice calls
   - Fail fast when a service is known to be down
   - Automatically recover when service comes back online

3. **Metrics and Monitoring**
   - Track microservice error rates
   - Set up alerts for high error rates or service unavailability
   - Monitor response times and timeouts

4. **Graceful Degradation**
   - Provide fallback behavior when optional services are unavailable
   - Queue operations for retry when services recover
   - Inform users about reduced functionality

## Example: Checking Logs

To verify that errors are properly logged, check the backend logs:

```bash
# View logs from the main application
docker compose logs -f gran-publicador

# Look for error messages like:
# [MediaService] ERROR Media Storage microservice error during file upload
# [SttService] ERROR Failed to transcribe audio stream
# [TranslateService] ERROR Translate Gateway is unavailable
```

## Conclusion

The improvements ensure that:
1. ✅ **Errors are not hidden**: All errors are logged with proper context
2. ✅ **Errors are visible**: Backend logs clearly show what went wrong
3. ✅ **Service unavailability is clear**: Specific messages indicate when microservices are down
4. ✅ **HTTP status codes are meaningful**: Proper status codes help clients handle errors appropriately

The next step is to improve frontend error handling to ensure users see clear, actionable error messages.
