import { QueryClient } from "@tanstack/react-query";
import { isApiError } from "@/lib/http-client";

const MAX_RETRIES = 2;

/** Retry only problems that may go away by themselves (network, server errors), never 4xx. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  return isApiError(error) && (error.isNetwork || error.status >= 500);
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: shouldRetry,
        refetchOnWindowFocus: false,
      },
      mutations: {
        // Saves are never retried automatically; the user retries (idempotency keys make that safe).
        retry: false,
      },
    },
  });
}
