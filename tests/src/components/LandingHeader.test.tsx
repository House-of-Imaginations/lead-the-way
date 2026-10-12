// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { LandingHeader } from "../../../src/app/(marketing)/_components/LandingHeader";

// A session already in Better Auth's store, as after a client navigation
// from the app. Its store hands React the same snapshot on server and client.
vi.mock("@/lib/account/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: { user: { name: "Priya Raman" } },
      isPending: false,
      error: null,
      refetch: vi.fn(),
    }),
  },
}));

// A guard: it passes before the session code exists and fails if the
// session ever leaks into the server render.
test("L-a: the server renders the signed-out header whatever the session store holds", () => {
  const html = renderToStaticMarkup(<LandingHeader />);
  expect(html).toContain(">Log in</a>");
  expect(html).toContain('href="/signup"');
  expect(html).not.toContain('href="/home"');
  expect(html).not.toContain(">PR<");
});
