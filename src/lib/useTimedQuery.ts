import { useQuery } from "convex-helpers/react/cache";
import type {
  FunctionReference,
  FunctionReturnType,
  OptionalRestArgs,
} from "convex/server";
import { useState } from "react";
import { useHour } from "./useHour";

/**
 * A timed query (`timedViewerQuery`, whose only arg is `hour`) subscribed with
 * `useHour()`. A new hour is a new query, which reads undefined until Convex
 * answers; the last answer is kept meanwhile, so the page never flashes back
 * to `initial` (the page-load snapshot) or to a skeleton. `initial` stands in
 * only before the first answer; without it that is undefined. `skip` holds the
 * subscription (as Convex's "skip"), and the last answer stands.
 */
export function useTimedQuery<
  Q extends FunctionReference<"query", "public", { hour?: number }>,
>(
  query: Q,
  initial?: FunctionReturnType<Q>,
  skip = false,
): FunctionReturnType<Q> | undefined {
  const hour = useHour();
  const result = useQuery(
    query,
    ...([skip ? "skip" : { hour }] as unknown as OptionalRestArgs<Q>),
  );
  const [last, setLast] = useState(initial);
  if (result !== undefined && result !== last) setLast(result);
  // Not `??`: null is an answer (no sprint, no team), not a missing one.
  return result === undefined ? last : result;
}
