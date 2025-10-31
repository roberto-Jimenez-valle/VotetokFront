import { json } from '@sveltejs/kit';

/**
 * Helper to create consistent JSON error responses
 */
export function jsonError(
  message: string,
  status: number,
  code?: string,
  hint?: string
) {
  const body: any = { message };
  if (code) body.code = code;
  if (hint) body.hint = hint;
  
  return json(body, { status });
}

/**
 * Helper to extract error message from unknown error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unknown error occurred';
}
