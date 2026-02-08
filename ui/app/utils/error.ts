function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readMessage(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const message = value.message;
  return typeof message === 'string' && message.length > 0 ? message : undefined;
}

export function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }

  if (typeof err === 'string') {
    return err;
  }

  if (isRecord(err) && 'message' in err) {
    const message = err.message;
    if (typeof message === 'string') return message;
    if (typeof message === 'number') return String(message);
  }

  return 'Unknown error';
}

export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (!isRecord(err)) return fallback;

  const data = isRecord(err.data) ? err.data : undefined;
  const dataError = data && isRecord(data.error) ? data.error : undefined;
  const response = isRecord(err.response) ? err.response : undefined;
  const responseData = response && isRecord(response._data) ? response._data : undefined;

  return (
    readMessage(data) ||
    readMessage(dataError) ||
    readMessage(responseData) ||
    readMessage(err) ||
    fallback
  );
}
