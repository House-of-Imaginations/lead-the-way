"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui";
import { withParams } from "@/lib/url";

/** Ruling 4: a role redirect adds ?moved=1; say why once, then drop the param. */
export function MovedToast() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const shown = useRef(false); // Strict Mode runs the effect twice in dev
  const moved = params.get("moved") === "1";

  useEffect(() => {
    // Reset once the param is gone, so a later role redirect toasts again.
    if (!moved) {
      shown.current = false;
      return;
    }
    if (shown.current) return;
    shown.current = true;
    toast({ title: "That page is for your team. You're back on your home." });
    router.replace(withParams(pathname, params.toString(), { moved: null }));
  }, [moved, params, pathname, router, toast]);

  return null;
}
