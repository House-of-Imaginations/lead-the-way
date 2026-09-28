"use client";

import { useRef, useState } from "react";
import type { Id } from "@convex/_generated/dataModel";
import { MAX_AVATAR_MB, refuseAvatar } from "@convex/lib/account/avatar";
import { userMessage } from "@/lib/errors";

/**
 * The two-step picture upload, for every screen that has one.
 *
 * THE FILE NEVER PASSES THROUGH A CONVEX FUNCTION. A mutation cannot take a
 * multi-megabyte argument, so the backend mints a one-time upload URL, the
 * browser POSTs the bytes straight to storage, and a second mutation adopts the
 * id that comes back. `getUploadUrl` and `attach` are the two halves; the
 * screen supplies them because only it knows which entity is being pictured.
 *
 * IT OWNS `uploading` AND NOT `error`. A screen usually has one error region
 * shared with everything else on it -- saving a name, renaming a workspace --
 * and a second one that only the picture can write to is a second place to
 * look. So failures are handed back through `onError` and the screen decides
 * where they land.
 *
 * The limits come from `convex/lib/account/avatar.ts`, which the server checks
 * again after the bytes land. Checking here is a courtesy that saves a phone
 * spending its upload on a file that will be refused -- not a rule, because
 * anything the browser enforces the browser can also skip.
 */
export function useImageUpload({
  getUploadUrl,
  attach,
  detach,
  noun,
  onError,
}: {
  getUploadUrl: () => Promise<string>;
  attach: (storageId: Id<"_storage">) => Promise<unknown>;
  detach: () => Promise<unknown>;
  /** How this screen names the thing, mid-sentence: "picture", "workspace picture". */
  noun: string;
  onError: (message: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function upload(file: File | null) {
    if (!file || uploading) return;
    onError(null);

    const refusal = refuseAvatar(file);
    if (refusal === "TYPE") {
      onError(`A ${noun} has to be a PNG, JPEG, WebP or GIF.`);
      return;
    }
    if (refusal === "SIZE") {
      onError(`A ${noun} has to be under ${MAX_AVATAR_MB}MB.`);
      return;
    }

    setUploading(true);
    try {
      const url = await getUploadUrl();
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error(`upload failed: ${response.status}`);
      const { storageId } = (await response.json()) as {
        storageId: Id<"_storage">;
      };
      await attach(storageId);
    } catch (e) {
      onError(userMessage(e, `Could not save that ${noun}. Please try again.`));
    } finally {
      setUploading(false);
      // Cleared so choosing the SAME file again still fires a change event --
      // otherwise a failed upload cannot be retried without picking a
      // different file, which looks like the control is broken.
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function remove() {
    if (uploading) return;
    setUploading(true);
    onError(null);
    try {
      await detach();
    } catch (e) {
      onError(
        userMessage(e, `Could not remove that ${noun}. Please try again.`),
      );
    } finally {
      setUploading(false);
    }
  }

  return { uploading, fileInput, upload, remove };
}
