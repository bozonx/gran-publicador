export function filterUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.entries(obj).reduce<Partial<T>>((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key as keyof T] = value;
    }
    return acc;
  }, {});
}
