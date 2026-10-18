export function runOnceByKey<T>(
  flights: Map<string, Promise<T>>,
  key: string,
  operation: () => Promise<T>,
): Promise<T> {
  const existing = flights.get(key);
  if (existing) return existing;

  const promise = Promise.resolve().then(operation);
  flights.set(key, promise);
  void promise.then(
    () => { if (flights.get(key) === promise) flights.delete(key); },
    () => { if (flights.get(key) === promise) flights.delete(key); },
  );
  return promise;
}
