export async function fetchEnvExample(): Promise<string> {
  const url =
    "https://raw.githubusercontent.com/fells-code/seamless-auth-api/main/.env.example";

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error("Failed to fetch auth env.example");
  }

  return await res.text();
}
