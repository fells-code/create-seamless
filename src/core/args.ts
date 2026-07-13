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
