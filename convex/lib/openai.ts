/**
 * The one place this backend talks to OpenAI's chat endpoint.
 *
 * One implementation, so every feature that wants a small model asked for JSON
 * shares the same timeout, the same quota reservation and the same failure
 * shape -- rather than copies of a `fetch` block that drift apart the first
 * time the model name changes.
 *
 * Deliberately free of Convex function context imports: it is a plain module
 * under `lib/`, so it can be called from any action and unit-tested against a
 * stubbed `fetch`.
 */

import { runProviderReservation } from "./errors";

const CHAT_ENDPOINT = "https://api.openai.com/v1/chat/completions";

/** Small, fast and cheap. Every caller here wants structure, not prose. */
const CHAT_MODEL = "gpt-4o-mini";

/**
 * The embedding model. Store this name alongside every vector you persist:
 * changing it must be a clean cache miss, not a silent comparison between
 * vectors of two different widths.
 */
export const EMBEDDING_MODEL = "text-embedding-3-small"; // 1536 dims
const CHAT_MAX_COMPLETION_TOKENS = 512;

/**
 * How long we wait on OpenAI before giving up.
 *
 * Without a bound, a hung socket holds the calling action open until the
 * platform kills it -- and a killed action never runs its own error handler, so
 * whatever fallback the caller wrote never runs and the screen waits forever.
 *
 * Fifteen seconds is generous for a small model returning a small JSON object,
 * and short enough that somebody is still watching when the fallback lands.
 */
const CHAT_TIMEOUT_MS = 15_000;

/**
 * One JSON-mode chat completion. Returns the parsed object, which is `unknown`
 * on purpose -- a model's output is untrusted input, so every caller narrows
 * the fields it reads.
 *
 * Throws a plain `Error` (never a `ConvexError`) on a missing key or a bad
 * response, and that is deliberate rather than an oversight: EVERY caller
 * should catch it and fall back to something usable. Nothing this throws is
 * written for a person to read, so there is nothing here for `throwUserError`
 * to say to one -- the caller is the place to decide what the person is told.
 */
export async function jsonCompletion(
  prompt: string,
  reserveProvider: () => Promise<unknown>,
): Promise<unknown> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Run: npx convex env set OPENAI_API_KEY <key>",
    );
  }

  await runProviderReservation(reserveProvider);

  const response = await fetch(CHAT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      max_completion_tokens: CHAT_MAX_COMPLETION_TOKENS,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
    // A timeout surfaces here as a thrown TimeoutError, which is the same shape
    // as every other failure this function raises -- so it lands in the same
    // caller `catch` and the same fallback, with no new branch anywhere.
    signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`OpenAI chat ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  // JSON mode guarantees parseable JSON, but an empty choices array does not,
  // so the "{}" fallback keeps a truncated response from throwing a SyntaxError
  // that reads like a bug in the caller.
  return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
}
