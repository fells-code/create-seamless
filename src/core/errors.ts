import { scrubTokens } from "./redact.js";

/**
 * Renders a thrown value for display.
 *
 * `throw` accepts anything, so reading `.message` off it is a guess. When the guess
 * was wrong the CLI printed "Error: undefined", which names neither the failure nor
 * the fact that something unexpected was thrown.
 *
 * A thrown object is scrubbed before it is shown: it reaches here from a rejected
 * request as often as from our own code, and a response body can carry a token.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message || err.name;
  if (typeof err === "string") return err;

  if (err && typeof err === "object") {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
    try {
      return JSON.stringify(scrubTokens(err));
    } catch {
      // Circular, or something JSON cannot represent.
      return String(err);
    }
  }

  // null, undefined, and the other primitives, none of which say much on their own.
  return `Unexpected error: ${String(err)}`;
}
