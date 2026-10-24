"use client";

import { Checkmark, ChevronDown } from "@carbon/icons-react";
import { Select } from "radix-ui";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import { Field, describedBy } from "@/components/ui/Field";

export type DemoCast = FunctionReturnType<typeof api.demo.loginCast>;

const ID = "login-demo";
const HELPER = "Concept prototype. Pick a demo person to look around.";

/** Task 9: a field whose list shows each demo person's name, email and role. */
export function DemoAccountPicker({
  cast,
  value,
  onChange,
  error,
}: {
  cast: DemoCast;
  value: string;
  onChange: (email: string) => void;
  error?: string;
}) {
  return (
    <Field id={ID} label="Demo account" helper={HELPER} error={error}>
      <Select.Root value={value} onValueChange={onChange}>
        <div className="ltw-sel">
          <Select.Trigger
            id={ID}
            className="ltw-field ltw-dap"
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(ID, HELPER, error)}
          >
            <Select.Value placeholder="Choose a person" />
            <Select.Icon asChild>
              <ChevronDown className="ltw-i" aria-hidden="true" />
            </Select.Icon>
          </Select.Trigger>
        </div>
        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={4}
            className="ltw-menu ltw-dap-m"
          >
            <Select.Viewport>
              {cast.map((person) => (
                <Select.Item
                  key={person.email}
                  value={person.email}
                  className="ltw-menu-i ltw-dap-i"
                >
                  <Select.ItemText>{person.name}</Select.ItemText>
                  <span className="text-label-01 text-text-secondary">
                    {person.email} · {person.role}
                  </span>
                  <Select.ItemIndicator className="ltw-dap-c">
                    <Checkmark aria-hidden="true" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </Field>
  );
}
