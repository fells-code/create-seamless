import { vi } from "vitest";

export type ConsoleCapture = {
  stdout: string[];
  stderr: string[];
};

export function captureConsole(): ConsoleCapture {
  const stdout: string[] = [];
  const stderr: string[] = [];

  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    stdout.push(args.map(String).join(" "));
  });

  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    stderr.push(args.map(String).join(" "));
  });

  return { stdout, stderr };
}
