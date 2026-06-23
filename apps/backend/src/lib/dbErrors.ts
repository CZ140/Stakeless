// Shared DB-error helpers used across services that throw coded errors and guard
// against Postgres unique-violation races.

// Build a coded Error whose `.code` routes map to HTTP status codes.
export function err(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

// Drizzle wraps the driver error, so a Postgres unique-violation (23505) surfaces
// on the error or its .cause.
export function isUniqueViolation(e: unknown): boolean {
  const code = (e as { code?: string }).code ?? (e as { cause?: { code?: string } }).cause?.code;
  return code === '23505';
}
