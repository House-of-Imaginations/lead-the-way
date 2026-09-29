/**
 * Social providers. Each one is on only when both halves of its pair are set
 * in the Convex env (`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and so on),
 * so the app works before any OAuth app exists. Read per call, never at module
 * scope, so `npx convex env set` applies at once.
 */
export const PROVIDERS = ["google", "github", "discord"] as const;
export type Provider = (typeof PROVIDERS)[number];

export function providerCredentials(): Partial<
  Record<Provider, { clientId: string; clientSecret: string }>
> {
  const out: Partial<
    Record<Provider, { clientId: string; clientSecret: string }>
  > = {};
  for (const provider of PROVIDERS) {
    const name = provider.toUpperCase();
    const clientId = process.env[`${name}_CLIENT_ID`];
    const clientSecret = process.env[`${name}_CLIENT_SECRET`];
    if (clientId && clientSecret) out[provider] = { clientId, clientSecret };
  }
  return out;
}
