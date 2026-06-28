import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

import { ADAPTER_URL, API_SERVICE_TOKEN, API_URL, uniqueClientIp, uniqueEmail } from './env';
import { mintServiceToken } from './serviceToken';

export interface Actor {
  email: string;
  ctx: APIRequestContext;
  dispose: () => Promise<void>;
}

// An actor is one virtual user: a fresh request context bound to the API, with
// its own client IP + service token applied to every request. This both isolates
// rate-limit buckets and faithfully mirrors how the server adapter calls the API.
export async function newApiActor(prefix = 'verify'): Promise<Actor> {
  const ctx = await playwrightRequest.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: {
      'x-seamless-client-ip': uniqueClientIp(),
      'x-seamless-service-token': `Bearer ${mintServiceToken(API_SERVICE_TOKEN)}`,
    },
  });

  return { email: uniqueEmail(prefix), ctx, dispose: () => ctx.dispose() };
}

// A browser-like actor for the cookie path: a context bound to the adapter that
// persists cookies across requests (the adapter handles service tokens internally).
export async function newAdapterActor(prefix = 'verify'): Promise<Actor> {
  const ctx = await playwrightRequest.newContext({ baseURL: ADAPTER_URL });
  return { email: uniqueEmail(prefix), ctx, dispose: () => ctx.dispose() };
}
