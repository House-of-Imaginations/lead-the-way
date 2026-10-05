"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import {
  MAX_DISPLAY_NAME,
  MAX_JOB_TITLE,
  TIME_ZONES,
  TIME_ZONE_LABELS,
  type TimeZone,
} from "@convex/lib/profileFields";
import { useExpectOrgId } from "@/components/app/ExpectOrgId";
import {
  Button,
  ButtonLink,
  Checkbox,
  Select,
  TextInput,
  useToast,
} from "@/components/ui";
import { errorCode, userMessage } from "@/lib/errors";
import { setThemeMode, storedThemeMode, type ThemeMode } from "@/lib/theme";

export type Mine = FunctionReturnType<typeof api.settings.mine>;

const ZONES = TIME_ZONES.map((zone) => ({
  value: zone,
  label: TIME_ZONE_LABELS[zone],
}));
const THEMES = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];
const noSubscribe = () => () => {};

/**
 * Profile on 17 and 19: a form with Save changes, so checkboxes, never
 * toggles. Theme is this browser's only (Ruling 7), applied on Save.
 */
export function ProfileTab({ mine }: { mine: Mine }) {
  const expectOrgId = useExpectOrgId();
  const saveProfile = useMutation(api.settings.saveProfile);
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    name: mine.name,
    jobTitle: mine.jobTitle,
    // ponytail: every seat starts on DEFAULT_TIME_ZONE, which is on the list.
    timeZone: mine.timeZone as TimeZone,
    captionsByDefault: mine.settings.captionsByDefault,
    reduceMotion: mine.settings.reduceMotion,
  }));
  // The stored theme after hydration; the server renders "System".
  const stored = useSyncExternalStore(
    noSubscribe,
    storedThemeMode,
    () => "system" as const,
  );
  const [theme, setTheme] = useState<ThemeMode | null>(null);
  const [errors, setErrors] = useState<{
    name?: string;
    jobTitle?: string;
    form?: string;
  }>({});
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await saveProfile({ ...form, expectOrgId });
      setThemeMode(theme ?? stored);
      toast({ title: "Changes saved." });
    } catch (error) {
      const message = userMessage(
        error,
        "Your changes weren't saved. Try again.",
      );
      const code = errorCode(error);
      setErrors(
        code === "NAME_REQUIRED"
          ? { name: message }
          : code === "FIELD_REQUIRED"
            ? { jobTitle: message }
            : { form: message },
      );
      // Focus the invalid field so its error is read.
      const invalid =
        code === "NAME_REQUIRED"
          ? "settings-name"
          : code === "FIELD_REQUIRED"
            ? "settings-job"
            : null;
      if (invalid) document.getElementById(invalid)?.focus();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-07" noValidate>
      <div className="grid max-w-[640px] grid-cols-2 gap-06 max-[900px]:grid-cols-1">
        <TextInput
          id="settings-name"
          label="Full name"
          value={form.name}
          maxLength={MAX_DISPLAY_NAME}
          autoComplete="name"
          error={errors.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <TextInput
          id="settings-email"
          label="Work email"
          value={mine.email}
          readOnly
          helper="Your sign-in address. It can't be changed here."
        />
        <TextInput
          id="settings-job"
          label="Job title"
          value={form.jobTitle}
          maxLength={MAX_JOB_TITLE}
          autoComplete="organization-title"
          error={errors.jobTitle}
          onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
        />
        <Select
          id="settings-zone"
          label="Time zone"
          options={ZONES}
          value={form.timeZone}
          onChange={(e) =>
            setForm({ ...form, timeZone: e.target.value as TimeZone })
          }
        />
        <Select
          id="settings-theme"
          label="Theme"
          helper="Saved in this browser only."
          options={THEMES}
          value={theme ?? stored}
          onChange={(e) => setTheme(e.target.value as ThemeMode)}
        />
      </div>
      <fieldset className="flex flex-col gap-05">
        <legend className="mb-05 text-label-01 text-text-secondary">
          Accessibility
        </legend>
        <Checkbox
          label="Turn captions on by default"
          checked={form.captionsByDefault}
          onChange={(e) =>
            setForm({ ...form, captionsByDefault: e.target.checked })
          }
        />
        <Checkbox
          label="Reduce motion"
          checked={form.reduceMotion}
          onChange={(e) => setForm({ ...form, reduceMotion: e.target.checked })}
        />
      </fieldset>
      {errors.form ? (
        <p role="alert" className="text-label-01 text-support-error">
          {errors.form}
        </p>
      ) : null}
      <div className="flex justify-end border-t border-border-subtle pt-07 max-md:flex-col">
        <ButtonLink
          href="/home"
          kind="secondary"
          size="xl"
          className="w-[200px] max-md:w-full"
        >
          Cancel
        </ButtonLink>
        <Button
          type="submit"
          size="xl"
          disabled={saving}
          className="w-[200px] max-md:w-full"
        >
          Save changes
        </Button>
      </div>
    </form>
  );
}
