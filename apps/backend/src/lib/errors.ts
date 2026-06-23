// Narrow an unknown caught error to its optional string `code` field.
export function getErrorCode(err: unknown): string | undefined {
  return (err as { code?: string }).code;
}
