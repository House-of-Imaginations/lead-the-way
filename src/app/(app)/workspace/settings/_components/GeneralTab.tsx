"use client";

import { useMutation } from "convex/react";
import { useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { api } from "@convex/_generated/api";
import { INDUSTRIES, TEAM_FUNCTIONS } from "@convex/lib/setupOptions";
import { useExpectOrgId } from "@/components/app/ExpectOrgId";
import { SaveBar } from "@/components/settings/SaveBar";
import { Select, TextInput, useToast } from "@/components/ui";
import { errorCode, userMessage } from "@/lib/errors";
import { DeleteWorkspace } from "./DeleteWorkspace";
import type { WorkspaceData } from "./WorkspaceSettings";

const choose = (empty: string, list: readonly string[]) => [
  { value: "", label: empty },
  ...list.map((value) => ({ value, label: value })),
];
/** Which field each refusal belongs under; anything else goes under the form. */
const FIELD_OF: Record<string, "name" | "teamName"> = {
  ORG_NAME_REQUIRED: "name",
  NAME_REQUIRED: "teamName",
};
const ID_OF = { name: "workspace-name", teamName: "workspace-team" };

/** 18's General: the workspace's and the team's names and profile. */
export function GeneralTab({ data }: { data: WorkspaceData }) {
  const expectOrgId = useExpectOrgId();
  const saveGeneral = useMutation(api.workspace.saveGeneral);
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    name: data.name,
    teamName: data.teamName,
    industry: data.industry ?? "",
    teamFunction: data.teamFunction ?? "",
  }));
  const [errors, setErrors] = useState<{
    name?: string;
    teamName?: string;
    form?: string;
  }>({});
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await saveGeneral({
        name: form.name,
        teamName: form.teamName,
        industry: form.industry || undefined,
        teamFunction: form.teamFunction || undefined,
        expectOrgId,
      });
      setForm((f) => ({
        ...f,
        name: f.name.trim(),
        teamName: f.teamName.trim(),
      }));
      toast({ title: "Changes saved." });
    } catch (error) {
      const message = userMessage(
        error,
        "Your changes weren't saved. Try again.",
      );
      const field = FIELD_OF[errorCode(error) ?? ""];
      setErrors(field ? { [field]: message } : { form: message });
      // Focus the invalid field so its error is read, once it is unlocked.
      flushSync(() => setSaving(false));
      if (field) document.getElementById(ID_OF[field])?.focus();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-07">
      <form onSubmit={onSubmit} className="flex flex-col gap-07" noValidate>
        {/* Locked while saving, so nothing typed then is shown as saved. */}
        <fieldset disabled={saving} className="contents">
          <div className="grid max-w-[640px] grid-cols-2 gap-06 max-[900px]:grid-cols-1">
            <TextInput
              id={ID_OF.name}
              label="Workspace name"
              value={form.name}
              error={errors.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <TextInput
              id={ID_OF.teamName}
              label="Team name"
              value={form.teamName}
              error={errors.teamName}
              onChange={(e) => setForm({ ...form, teamName: e.target.value })}
            />
            <Select
              id="workspace-industry"
              label="Industry"
              options={choose("Choose an industry", INDUSTRIES)}
              value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
            />
            <Select
              id="workspace-function"
              label="Main team function"
              options={choose("Choose a team function", TEAM_FUNCTIONS)}
              value={form.teamFunction}
              onChange={(e) =>
                setForm({ ...form, teamFunction: e.target.value })
              }
            />
            {data.partner ? (
              <div className="col-span-2 max-[900px]:col-span-1">
                <TextInput
                  id="workspace-partner"
                  label="Partner program"
                  value={data.partner}
                  readOnly
                  helper="Set by your partner. Contact them to change it."
                />
              </div>
            ) : null}
            <div className="col-start-1">
              <TextInput
                id="workspace-id"
                label="Workspace ID"
                value={data.slug}
                readOnly
              />
            </div>
          </div>
        </fieldset>
        <SaveBar saving={saving} error={errors.form ?? null} />
      </form>
      {data.canDelete ? <DeleteWorkspace name={data.name} /> : null}
    </div>
  );
}
