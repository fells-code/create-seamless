// A literal `--` ends flag parsing, so a later -h belongs to the command's
// operands (a config value, say) rather than being a request for help.
export function hasHelpFlag(args: string[]): boolean {
  for (const arg of args) {
    if (arg === "--") return false;
    if (arg === "-h" || arg === "--help") return true;
  }
  return false;
}

export interface ExtractedFlag {
  value?: string;
  rest: string[];
}

export function extractFlag(args: string[], name: string): ExtractedFlag {
  const rest: string[] = [];
  let value: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === `--${name}`) {
      value = args[i + 1];
      i++;
    } else if (arg.startsWith(`--${name}=`)) {
      value = arg.slice(name.length + 3);
    } else {
      rest.push(arg);
    }
  }

  return { value, rest };
}
