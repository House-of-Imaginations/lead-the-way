import { expect, test } from "vitest";
import { acceptCopy } from "@/lib/workspace/onboarding";

const invite = {
  orgName: "Northwind EV",
  emailConfigured: true,
};

test("each acceptance state explains itself", () => {
  expect(acceptCopy("READY", invite, "sam@example.invalid").title).toBe(
    "Join Northwind EV",
  );
  expect(
    acceptCopy("VERIFY_EMAIL", invite, "sam@example.invalid").description,
  ).toMatch(/sam@example.invalid/);
  expect(
    acceptCopy(
      "VERIFY_EMAIL",
      { ...invite, emailConfigured: false },
      "a@b.invalid",
    ).description,
  ).toMatch(/administrator/);
  expect(acceptCopy("WRONG_ACCOUNT", invite, "a@b.invalid").title).toBe(
    "This invitation is for another account",
  );
  expect(acceptCopy("ALREADY_MEMBER", invite, "a@b.invalid").title).toBe(
    "You are already in Northwind EV",
  );
});
