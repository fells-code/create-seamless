import { describe, expect, it } from "vitest";
import { generateJWKS } from "./jwks.js";

describe("generateJWKS", () => {
  it("returns a PEM-encoded RSA public and private key pair", () => {
    const { publicKey, privateKey } = generateJWKS();

    expect(publicKey).toMatch(/^-----BEGIN PUBLIC KEY-----/);
    expect(publicKey.trim()).toMatch(/-----END PUBLIC KEY-----$/);
    expect(privateKey).toMatch(/^-----BEGIN PRIVATE KEY-----/);
    expect(privateKey.trim()).toMatch(/-----END PRIVATE KEY-----$/);
  });

  it("generates a distinct key pair on each call", () => {
    const first = generateJWKS();
    const second = generateJWKS();
    expect(first.privateKey).not.toBe(second.privateKey);
    expect(first.publicKey).not.toBe(second.publicKey);
  });
});
