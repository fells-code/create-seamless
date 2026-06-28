import { APIRequestContext, expect } from '@playwright/test';

// Cookie-based flows against the adapter (baseURL = adapter). The adapter strips
// OTP/magic-link secrets from browser responses, so codes are read from the
// harness adapter app's /__captured readout.

async function readCapturedCode(ctx: APIRequestContext, email: string): Promise<string> {
  const res = await ctx.get(`/__captured/${encodeURIComponent(email)}`);
  expect(res.ok(), `captured lookup -> ${res.status()}`).toBeTruthy();
  const body = await res.json();
  expect(body?.token, `a captured code for ${email}`).toBeTruthy();
  return String(body.token);
}

export async function registerAndVerifyEmail(ctx: APIRequestContext, email: string): Promise<void> {
  let res = await ctx.post('/auth/registration/register', { data: { email } });
  expect(res.ok(), `register -> ${res.status()}`).toBeTruthy();

  res = await ctx.get('/auth/otp/generate-email-otp');
  expect(res.ok(), `generate-email-otp -> ${res.status()}`).toBeTruthy();

  const code = await readCapturedCode(ctx, email);
  res = await ctx.post('/auth/otp/verify-email-otp', { data: { verificationToken: code } });
  expect(res.ok(), `verify-email-otp -> ${res.status()}`).toBeTruthy();
}

export async function loginViaEmailOtp(ctx: APIRequestContext, email: string): Promise<void> {
  let res = await ctx.post('/auth/login', { data: { identifier: email } });
  expect(res.ok(), `login -> ${res.status()}`).toBeTruthy();

  res = await ctx.get('/auth/otp/generate-login-email-otp');
  expect(res.ok(), `generate-login-email-otp -> ${res.status()}`).toBeTruthy();

  const code = await readCapturedCode(ctx, email);
  res = await ctx.post('/auth/otp/verify-login-email-otp', { data: { verificationToken: code } });
  expect(res.ok(), `verify-login-email-otp -> ${res.status()}`).toBeTruthy();
}
