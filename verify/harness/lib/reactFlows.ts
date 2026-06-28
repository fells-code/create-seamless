import { expect, Page, request } from '@playwright/test';

import { ADAPTER_URL } from './env';

// Browser-facing helpers for the React starter (served at REACT_URL, pointed at
// the adapter). The adapter strips OTP/magic-link secrets from browser responses,
// so codes are read from its /__captured readout (same seam as adapterFlows).

/** Read a code the adapter captured for `recipient` (email or phone), polling until present. */
export async function readCapturedCode(recipient: string, timeoutMs = 10_000): Promise<string> {
  const ctx = await request.newContext({ baseURL: ADAPTER_URL });
  try {
    const deadline = Date.now() + timeoutMs;
    let last = 'never set';
    while (Date.now() < deadline) {
      const res = await ctx.get(`/__captured/${encodeURIComponent(recipient)}`);
      if (res.ok()) {
        const body = await res.json();
        if (body?.token) return String(body.token);
        last = JSON.stringify(body);
      } else {
        last = `status ${res.status()}`;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    throw new Error(`no captured code for ${recipient} within ${timeoutMs}ms (last: ${last})`);
  } finally {
    await ctx.dispose();
  }
}

/** Open the sign-in form (the SDK renders the register form by default). */
export async function gotoSignIn(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByRole('button', { name: /Sign in/i }).click();
  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
}

/** Type a code into the SDK's six-box OTP input (one digit per box). */
export async function enterOtp(page: Page, code: string): Promise<void> {
  const boxes = page.getByLabel(/^Digit \d$/);
  await expect(boxes).toHaveCount(code.length);
  await boxes.first().click();
  await page.keyboard.type(code);
}

/** Sign in an existing verified user through the email one-time-code path. */
export async function signInWithEmailOtp(page: Page, email: string): Promise<void> {
  await gotoSignIn(page);
  await page.locator('#identifier').fill(email);
  await page.getByRole('button', { name: 'Login', exact: true }).click();

  await page.getByRole('button', { name: /Email Code/ }).click();
  await expect(page.getByRole('heading', { name: 'Verify Your Email' })).toBeVisible();

  await enterOtp(page, await readCapturedCode(email));
  await page.getByRole('button', { name: /Verify & Continue/ }).click();
  await expect(page.getByText('You are signed in')).toBeVisible();
}

