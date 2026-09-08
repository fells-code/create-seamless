import kleur from "kleur";
import { ReauthRequiredError } from "../core/authClient.js";
import { AdminApiError, PermissionError } from "../core/admin.js";
import { extractFlag } from "../core/args.js";

const DEFAULT_LIMIT = 50;
const LIMIT_MAX = 100;

export function reportAdminError(err: unknown): never {
  if (err instanceof ReauthRequiredError) {
    console.log(kleur.yellow(err.message));
    process.exit(1);
  }
  if (err instanceof PermissionError || err instanceof AdminApiError) {
    console.error(kleur.red(err.message));
    process.exit(1);
  }
  throw err;
}

export function parseList(value?: string): string[] | undefined {
  if (value === undefined) return undefined;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

// The two flags do not share a range. `--offset 0` is the first page, but the API
// takes a limit of 1 to 100 and answers anything outside that with a 400 naming
// neither the flag nor the bound. Checking here says which flag was wrong and what
// it accepts, and a non-numeric page stays a typo the server would reinterpret.
function pageNumber(
  raw: string | undefined,
  flag: string,
  fallback: number,
  bounds: { min: number; max?: number },
): number {
  if (raw === undefined) return fallback;

  const value = Number(raw);
  const { min, max } = bounds;

  if (!Number.isInteger(value) || value < min || (max !== undefined && value > max)) {
    console.error(
      kleur.red(
        max === undefined
          ? `--${flag} must be a whole number of ${min} or more.`
          : `--${flag} must be a whole number between ${min} and ${max}.`,
      ),
    );
    process.exit(1);
  }

  return value;
}

/** Reads `--limit` and `--offset` off a list command, and the arguments left over. */
export function parseWindow(args: string[]): {
  limit: number;
  offset: number;
  rest: string[];
} {
  const limitFlag = extractFlag(args, "limit");
  const offsetFlag = extractFlag(limitFlag.rest, "offset");

  return {
    limit: pageNumber(limitFlag.value, "limit", DEFAULT_LIMIT, {
      min: 1,
      max: LIMIT_MAX,
    }),
    offset: pageNumber(offsetFlag.value, "offset", 0, { min: 0 }),
    rest: offsetFlag.rest,
  };
}

/**
 * The position of the rows on screen within the whole result set.
 *
 * Printed rather than a bare count, because a list route returns one page and a
 * count of every match. Reporting the count alone reads as though every row is on
 * screen, which is how `org list` came to claim a total it had not shown.
 */
export function pagePosition(
  offset: number,
  shown: number,
  total: number,
  noun: string,
): string {
  return `Showing ${offset + 1}-${offset + shown} of ${total} ${noun}${
    total === 1 ? "" : "s"
  }.`;
}
