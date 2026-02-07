export function getApiErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as any;

  return (
    anyErr?.data?.message ||
    anyErr?.data?.error?.message ||
    anyErr?.response?._data?.message ||
    anyErr?.message ||
    fallback
  );
}
