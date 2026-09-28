import { usePathname, useSearchParams } from "next/navigation";

/** Where "Sign in" on the 401 screen should return to: this page, as-is. */
export function useSignInHref(): string {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const path = search ? `${pathname}?${search}` : pathname;
  return `/sign-in?redirect=${encodeURIComponent(path)}`;
}
