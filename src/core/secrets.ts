import { randomBytes } from "crypto";

export function generateSecret(length = 32) {
  return randomBytes(length).toString("hex");
}
