export interface ApiErrorOpts {
  /** Message shown for HTTP 402 (insufficient funds). */
  insufficientMsg?: string;
  /** Message shown for HTTP 429 (rate limit). Omit to fall through to generic. */
  rateLimitMsg?: string;
  /** Generic fallback (used when the server provides no `error`). */
  fallbackMsg?: string;
}

type AxiosLikeError = { response?: { data?: { error?: string }; status?: number } };

/**
 * Decode an axios-style error into a user-facing message and pass it to
 * `setError`. Preserves each game page's exact wording via `opts`.
 *
 * - 402 -> `opts.insufficientMsg` (default "Insufficient funds.")
 * - 429 -> `opts.rateLimitMsg` if provided, otherwise the generic fallback
 * - everything else -> the server's `error` if present, else the generic
 *   fallback (default "Something went wrong. Please try again.")
 */
export function handleApiError(
  err: unknown,
  setError: (msg: string) => void,
  opts: ApiErrorOpts = {},
): void {
  const ax = err as AxiosLikeError;
  const status = ax.response?.status;
  const fallback = opts.fallbackMsg ?? 'Something went wrong. Please try again.';
  if (status === 402) {
    setError(opts.insufficientMsg ?? 'Insufficient funds.');
  } else if (status === 429 && opts.rateLimitMsg !== undefined) {
    setError(opts.rateLimitMsg);
  } else {
    setError(ax.response?.data?.error ?? fallback);
  }
}
