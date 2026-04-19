export async function withCwd<T>(cwd: string, run: () => Promise<T> | T) {
  const previous = process.cwd();
  process.chdir(cwd);

  try {
    return await run();
  } finally {
    process.chdir(previous);
  }
}
