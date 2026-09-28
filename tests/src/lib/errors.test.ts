import { describe, expect, test } from "vitest";
import { ConvexError } from "convex/values";
import { throwUserError } from "../../../convex/lib/errors";
import { errorCode, userMessage } from "../../../src/lib/errors";

describe("userMessage", () => {
  test("reads the sentence the backend actually wrote", () => {
    // Thrown by the real helper every backend failure goes through, so this
    // breaks if either half of the pair changes shape.
    let thrown: unknown;
    try {
      throwUserError(
        "NOT_SIGNED_IN",
        "You need to be signed in to do that. A room holds at most 8 people.",
      );
    } catch (e) {
      thrown = e;
    }

    expect(userMessage(thrown, "Could not join that room.")).toBe(
      "You need to be signed in to do that. A room holds at most 8 people.",
    );
  });

  test("never renders the stringified data", () => {
    // The trap this function exists for: a ConvexError IS an Error, and its
    // `.message` is the JSON of `.data`. `e instanceof Error ? e.message : ...`
    // would put {"code":"NOT_SIGNED_IN",...} on the screen.
    const error = new ConvexError({
      code: "NOT_SIGNED_IN",
      message: "You need to be signed in to do that.",
    });

    expect(error.message).toContain("NOT_SIGNED_IN");
    expect(userMessage(error, "fallback")).toBe(
      "You need to be signed in to do that.",
    );
    expect(userMessage(error, "fallback")).not.toContain("NOT_SIGNED_IN");
  });

  test("falls back rather than leaking an internal error's text", () => {
    const internal = new Error(
      "Uncaught TypeError: cannot read properties of undefined",
    );

    expect(userMessage(internal, "Could not do that.")).toBe(
      "Could not do that.",
    );
  });

  test("falls back for a ConvexError carrying no message", () => {
    expect(
      userMessage(new ConvexError({ code: "NOT_SIGNED_IN" }), "fallback"),
    ).toBe("fallback");
    expect(userMessage(new ConvexError("a bare string"), "fallback")).toBe(
      "fallback",
    );
    expect(userMessage(new ConvexError({ message: "   " }), "fallback")).toBe(
      "fallback",
    );
    expect(userMessage(new ConvexError({ message: 404 }), "fallback")).toBe(
      "fallback",
    );
  });

  test("falls back for anything that is not an error at all", () => {
    expect(userMessage("just a string", "fallback")).toBe("fallback");
    expect(userMessage(undefined, "fallback")).toBe("fallback");
    expect(userMessage(null, "fallback")).toBe("fallback");
  });
});

describe("errorCode", () => {
  test("reads the code the backend actually threw", () => {
    let thrown: unknown;
    try {
      throwUserError("NOT_SIGNED_IN", "You need to sign in first.");
    } catch (e) {
      thrown = e;
    }

    expect(errorCode(thrown)).toBe("NOT_SIGNED_IN");
  });

  test("returns null for a ConvexError carrying no code", () => {
    expect(
      errorCode(
        new ConvexError({ message: "You need to be signed in to do that." }),
      ),
    ).toBeNull();
    expect(errorCode(new ConvexError("a bare string"))).toBeNull();
    expect(errorCode(new ConvexError({ code: "   " }))).toBeNull();
    expect(errorCode(new ConvexError({ code: 404 }))).toBeNull();
  });

  test("returns null for anything that is not this backend's own error", () => {
    expect(errorCode(new Error("boom"))).toBeNull();
    expect(errorCode("just a string")).toBeNull();
    expect(errorCode(undefined)).toBeNull();
    expect(errorCode(null)).toBeNull();
  });
});
