import { randomBytes } from "crypto";

export function generateSecret(length = 32) {
  return randomBytes(length).toString("hex");
}

export function generateKid() {
  return "dev-" + randomBytes(6).toString("hex");
}
