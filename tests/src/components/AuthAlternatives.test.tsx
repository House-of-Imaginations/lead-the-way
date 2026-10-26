// @vitest-environment node
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import { AuthAlternatives } from "../../../src/components/app/AuthAlternatives";

// No DOM here: the mocked Button keeps each onClick by its label, and a
// "click" calls it. Social providers are off in dev, so e2e never shows them.
const clicks = new Map<string, () => void>();
const social = vi.fn();
vi.mock("@/lib/account/auth-client", () => ({
  authClient: { signIn: { social: (opts: unknown) => social(opts) } },
}));
vi.mock("@/components/ui", () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: () => void;
  }) => {
    const label = [children].flat().join("");
    if (onClick) clicks.set(label, onClick);
    return <button>{label}</button>;
  },
  Modal: ({ trigger }: { trigger: ReactNode }) => trigger,
}));

beforeEach(() => {
  clicks.clear();
  social.mockReset();
});

function continueWithGoogle(
  ssoLabel: Parameters<typeof AuthAlternatives>[0]["ssoLabel"],
  next: string | null,
) {
  renderToStaticMarkup(
    <AuthAlternatives
      providers={["google"]}
      ssoLabel={ssoLabel}
      emailId="email"
      next={next}
    />,
  );
  clicks.get("Continue with Google")!();
  expect(social).toHaveBeenCalledTimes(1);
  return social.mock.calls[0][0].newUserCallbackURL as string;
}

test("the careers form keeps its track through a first social sign-up", () => {
  expect(continueWithGoogle("Continue with IBMid", null)).toBe(
    "/setup/start?track=career",
  );
});

test("the team forms send a first social sign-up back to its join link, without a track", () => {
  expect(continueWithGoogle("Sign up with single sign-on", "/join/abc")).toBe(
    "/setup/start?next=%2Fjoin%2Fabc",
  );
});

test("the team forms without a join link go straight to setup", () => {
  expect(continueWithGoogle("Log in with single sign-on", null)).toBe(
    "/setup/start",
  );
});
