import { isApiError } from "./http-client";

/** After showing field errors, move focus to the first invalid field (once React has rendered them). */
export function focusFirstInvalid(form: HTMLFormElement | null) {
  requestAnimationFrame(() => {
    form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });
}

export type FieldErrors<F extends string> = Partial<Record<F, string>>;

interface Issue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

/** The first message for each of the form's fields, from zod issues or API issues. */
export function fieldErrorsFrom<F extends string>(
  issues: readonly Issue[],
  fields: readonly F[],
): FieldErrors<F> {
  const errors: FieldErrors<F> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field === "string" && (fields as readonly string[]).includes(field)) {
      errors[field as F] ??= issue.message;
    }
  }
  return errors;
}

/**
 * Field errors the API sent back (400 validation, 409 "already taken"), or null when the error
 * isn't about the form's fields (then show it as a general message).
 */
export function apiFieldErrors<F extends string>(
  error: unknown,
  fields: readonly F[],
): FieldErrors<F> | null {
  if (!isApiError(error) || !error.issues?.length) return null;
  const errors = fieldErrorsFrom(error.issues, fields);
  return Object.keys(errors).length > 0 ? errors : null;
}
