"use client";

import { Add, Download } from "@carbon/icons-react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState, type ReactNode, type SubmitEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  MAX_ESCALATION,
  MAX_LABEL,
  MAX_NEVER_IN,
  MAX_TOOLS,
} from "@convex/lib/agreementLimits";
import { useExpectOrgId } from "@/components/app/ExpectOrgId";
import {
  Button,
  Checkbox,
  Select,
  Tag,
  TextArea,
  TextInput,
  useToast,
} from "@/components/ui";
import { userMessage } from "@/lib/errors";
import { useTimedQuery } from "@/lib/useTimedQuery";
import { AgreementPreview } from "./AgreementPreview";

type Agreement = FunctionReturnType<typeof api.agreements.current>;
type Toggle = { label: string; on: boolean };
type Form = {
  tools: string[];
  neverIn: Toggle[];
  checks: Toggle[];
  escalation: string;
  /** A `contactOptionsOf` value: a people id or a label. */
  contact: string;
};

function formOf(a: Agreement): Form {
  return {
    tools: a.tools,
    neverIn: a.neverIn.map(({ label, on }) => ({ label, on })),
    checks: a.checks.map(({ label, on }) => ({ label, on })),
    escalation: a.escalation,
    // A saved person who has since left falls back to the viewer.
    contact:
      a.contact.kind === "person"
        ? (a.contactPerson?.id ?? a.contactOptions[0].value)
        : a.contact.label,
  };
}

/** The viewer, then a saved contact who is someone else, then the labels. */
export function contactOptionsOf(a: Agreement) {
  const [viewer, ...labels] = a.contactOptions;
  const saved = a.contactPerson;
  return saved && saved.id !== viewer.value
    ? [viewer, { value: saved.id, label: saved.name }, ...labels]
    : a.contactOptions;
}

const keyOf = (f: Form) => JSON.stringify(f);
const labelsOn = (list: Toggle[]) =>
  list.filter((t) => t.on).map((t) => t.label);
const has = (list: string[], label: string) =>
  list.some((l) => l.toLowerCase() === label.toLowerCase());

function labelError(label: string, count: number, max: number): string | null {
  if (label.length > MAX_LABEL)
    return `Keep it to ${MAX_LABEL} characters or fewer.`;
  if (count >= max)
    return `You can list up to ${max}. Remove one to add another.`;
  return null;
}

function Section({
  title,
  helper,
  children,
}: {
  title: string;
  helper: string;
  children: ReactNode;
}) {
  return (
    <section className="grid grid-cols-[220px_minmax(0,1fr)] gap-07 border-t border-border-subtle py-06 max-[900px]:grid-cols-1 max-[900px]:gap-05">
      <div className="flex flex-col gap-02">
        <h2 className="text-heading-04">{title}</h2>
        <p className="text-body-02 text-text-secondary">{helper}</p>
      </div>
      <div className="flex flex-col gap-05">{children}</div>
    </section>
  );
}

function AddRow({
  id,
  label,
  placeholder,
  value,
  error,
  onChange,
  onAdd,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
  onAdd: (e: SubmitEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onAdd} className="flex items-start">
      <div className="min-w-0 flex-1">
        <TextInput
          id={id}
          label={label}
          placeholder={placeholder}
          value={value}
          error={error ?? undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {/* 24px: the label and its gap, so the button lines up with the field. */}
      <Button
        type="submit"
        kind="secondary"
        size="md"
        icon={Add}
        className="mt-06"
      >
        Add
      </Button>
    </form>
  );
}

function Toggles({
  list,
  onToggle,
}: {
  list: Toggle[];
  onToggle: (label: string, on: boolean) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-05 text-label-01 text-text-secondary">
        Select all that apply
      </legend>
      <div className="grid grid-cols-2 gap-x-06 gap-y-05 max-[672px]:grid-cols-1">
        {list.map((t) => (
          <Checkbox
            key={t.label}
            label={t.label}
            checked={t.on}
            onChange={(e) => onToggle(t.label, e.target.checked)}
          />
        ))}
      </div>
    </fieldset>
  );
}

export function AgreementBuilder({ initial }: { initial: Agreement }) {
  const data = useTimedQuery(api.agreements.current, initial) ?? initial;
  const expectOrgId = useExpectOrgId();
  const saveAgreement = useMutation(api.agreements.save);
  const toast = useToast();

  const [form, setForm] = useState(() => formOf(initial));
  const [newTool, setNewTool] = useState("");
  const [toolError, setToolError] = useState<string | null>(null);
  const [newNever, setNewNever] = useState("");
  const [neverError, setNeverError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const isSaved =
    data.status === "saved" && keyOf(formOf(data)) === keyOf(form);
  const person = data.contactOptions[0];
  const contactOptions = contactOptionsOf(data);
  const contactName =
    contactOptions.find((o) => o.value === form.contact)?.label ?? person.label;

  function addTool(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const label = newTool.trim();
    if (!label) return;
    if (!has(form.tools, label)) {
      const error = labelError(label, form.tools.length, MAX_TOOLS);
      setToolError(error);
      if (error) return;
      set({ tools: [...form.tools, label] });
    }
    setToolError(null);
    setNewTool("");
  }

  function addNever(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const label = newNever.trim();
    if (!label) return;
    if (
      !has(
        form.neverIn.map((t) => t.label),
        label,
      )
    ) {
      const error = labelError(label, form.neverIn.length, MAX_NEVER_IN);
      setNeverError(error);
      if (error) return;
      set({ neverIn: [...form.neverIn, { label, on: true }] });
    }
    setNeverError(null);
    setNewNever("");
  }

  const toggle = (list: Toggle[], label: string, on: boolean) =>
    list.map((t) => (t.label === label ? { ...t, on } : t));

  async function save() {
    setPending(true);
    setSaveError(null);
    try {
      const { version, changed } = await saveAgreement({
        expectOrgId,
        tools: form.tools,
        neverIn: form.neverIn,
        checks: form.checks,
        escalation: form.escalation,
        contact:
          form.contact === person.value ||
          form.contact === data.contactPerson?.id
            ? { kind: "person", personId: form.contact as Id<"people"> }
            : { kind: "label", label: form.contact },
      });
      toast(
        changed
          ? {
              title: "Agreement saved",
              body: `Version ${version}. Your team signs it when they join.`,
            }
          : { title: "No changes to save" },
      );
    } catch (error) {
      setSaveError(userMessage(error, "The agreement didn't save. Try again."));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-07">
      <header className="flex flex-wrap items-end justify-between gap-05">
        <div className="flex max-w-[640px] flex-col gap-03">
          <div className="flex flex-wrap items-center gap-03">
            <h1 className="text-heading-01">Create your Team AI Agreement</h1>
            <Tag color={isSaved ? "green" : "gray"}>
              {isSaved ? "Saved" : "Draft"}
            </Tag>
          </div>
          <p className="text-body-01 text-text-secondary">
            Build a simple shared agreement before the sprint starts. This is
            not a legal policy. It is a practical team conversation about safe,
            consistent AI use.
          </p>
        </div>
        <div className="flex flex-col items-end gap-02">
          <div className="flex">
            <Button
              kind="tertiary"
              size="md"
              icon={Download}
              onClick={() => window.print()}
            >
              Download PDF
            </Button>
            <Button size="md" disabled={pending} onClick={save}>
              Save agreement
            </Button>
          </div>
          {saveError ? (
            <p role="alert" className="text-label-01 text-support-error">
              {saveError}
            </p>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)_460px] items-start gap-07 max-[900px]:grid-cols-1">
        <div className="flex flex-col">
          <Section
            title="Tools we use"
            helper="Approved tools only. Anything else, ask first."
          >
            {form.tools.length ? (
              <ul className="flex flex-wrap gap-03">
                {form.tools.map((t) => (
                  <li key={t}>
                    <Tag
                      onDismiss={() =>
                        set({ tools: form.tools.filter((x) => x !== t) })
                      }
                    >
                      {t}
                    </Tag>
                  </li>
                ))}
              </ul>
            ) : null}
            <AddRow
              id="add-tool"
              label="Add a tool"
              placeholder="For example, Gemini for Workspace"
              value={newTool}
              error={toolError}
              onChange={setNewTool}
              onAdd={addTool}
            />
          </Section>

          <Section
            title="What never goes in"
            helper="Practise with de-identified or sample data."
          >
            <Toggles
              list={form.neverIn}
              onToggle={(label, on) =>
                set({ neverIn: toggle(form.neverIn, label, on) })
              }
            />
            <AddRow
              id="add-never"
              label="Add your own"
              placeholder="For example, draft pricing"
              value={newNever}
              error={neverError}
              onChange={setNewNever}
              onAdd={addNever}
            />
          </Section>

          <Section
            title="How we check AI outputs"
            helper="A person checks before it counts."
          >
            <Toggles
              list={form.checks}
              onToggle={(label, on) =>
                set({ checks: toggle(form.checks, label, on) })
              }
            />
          </Section>

          <Section
            title="When and who to ask"
            helper="Asking should feel normal, not like a confession."
          >
            <TextArea
              id="escalation"
              label="When to escalate"
              rows={3}
              maxLength={MAX_ESCALATION}
              value={form.escalation}
              onChange={(e) => set({ escalation: e.target.value })}
            />
            <Select
              id="contact"
              label="AI question contact"
              options={contactOptions}
              value={form.contact}
              onChange={(e) => set({ contact: e.target.value })}
            />
          </Section>
        </div>

        <section aria-labelledby="preview-label">
          <div className="flex flex-col gap-05 bg-layer-01 p-06">
            <div className="flex justify-between gap-05 text-label-01 text-text-secondary">
              <span id="preview-label">Live preview</span>
              <span>One page, A4</span>
            </div>
            <AgreementPreview
              teamName={data.teamName}
              dateLabel={data.dateLabel}
              reviewDate={data.reviewDate}
              tools={form.tools}
              neverIn={labelsOn(form.neverIn)}
              checks={labelsOn(form.checks)}
              escalation={form.escalation}
              contactName={contactName}
              managerInitials={data.managerInitials}
              isSaved={isSaved}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
