// A terminal narrower than this cannot render a @clack/prompts list legibly. It
// shows up when a pty is allocated without a size (an expect script, some CI
// runners), which used to produce one character per line with no explanation.
const MIN_USABLE_COLUMNS = 20;

export function isInteractive(): boolean {
  return process.stdin.isTTY === true;
}

// Refuses to ask a question nobody can answer. Without a TTY a prompt renders
// and then waits forever, so a run on a pipe used to hang until its job timed
// out rather than failing.
export function requireInteractive(question: string, remedy: string): void {
  if (isInteractive()) return;

  throw new Error(
    `"${question}" needs an interactive terminal, and this run does not have one. ${remedy}`,
  );
}

// Warns rather than failing: a narrow terminal still accepts input, so the
// prompts work even when they look wrong.
export function warnOnUnusableWidth(warn: (message: string) => void): void {
  const columns = process.stdout.columns;
  if (!isInteractive() || columns === undefined || columns >= MIN_USABLE_COLUMNS) {
    return;
  }

  warn(
    `This terminal reports ${columns} columns, so the prompts below will render badly. Resize it, or re-run with --yes to skip them.`,
  );
}
