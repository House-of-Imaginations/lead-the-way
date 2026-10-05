"use client";

import { useState } from "react";
import {
  Button,
  Checkbox,
  FileDrop,
  PasswordInput,
  Select,
  TextArea,
  TextInput,
} from "@/components/ui";
import { Section } from "./Section";

const SIZES = ["2 to 5", "6 to 10", "11 to 20", "21 or more"].map((s) => ({
  value: s,
  label: s,
}));

export function FieldsSection() {
  const [names, setNames] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const ready = names && reviewed;
  return (
    <Section id="fields" title="Fields">
      <div className="grid max-w-[480px] gap-06">
        <TextInput
          id="f-email"
          label="Work email"
          type="email"
          autoComplete="email"
          placeholder="priya.raman@calderlane.com"
          helper="Use the address your team knows you by."
        />
        <TextInput
          id="f-team"
          label="Team name"
          error="Add a team name to continue."
        />
        <PasswordInput
          id="f-password"
          label="Password"
          autoComplete="new-password"
          helper="At least 12 characters."
          labelAction={
            <button
              type="button"
              className="text-label-01 text-link underline hover:text-link-hover"
            >
              Forgot your password?
            </button>
          }
        />
        <TextArea
          id="f-learned"
          label="What I learned"
          placeholder="The template saved me the most time on..."
        />
        <FileDrop
          id="f-shot"
          label="Drag a file here or click to upload"
          helper={chosen ? `Chosen: ${chosen}` : "PNG or JPG, up to 5 MB."}
          accept={["image/png", "image/jpeg"]}
          onFile={(file) => setChosen(file.name)}
        />
        <FileDrop
          id="f-shot-error"
          label="Drag a file here or click to upload"
          helper="PNG or JPG, up to 5 MB."
          accept={["image/png", "image/jpeg"]}
          error="Upload a PNG or JPG."
          onFile={() => {}}
        />
        <FileDrop
          id="f-shot-current"
          label="Drag a file here or click to upload"
          helper="PNG or JPG, up to 5 MB."
          accept={["image/png", "image/jpeg"]}
          current={{
            url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
            alt: "Sample screenshot",
          }}
          onFile={() => {}}
          onRemove={() => {}}
        />
        <Select
          id="f-size"
          label="Team size"
          options={SIZES}
          defaultValue="6 to 10"
        />
        <TextInput
          id="f-length"
          label="Sprint length"
          value="4 weeks"
          readOnly
          disabled
          helper="Fixed at four weeks in this prototype"
        />
        <div className="flex flex-col gap-03">
          <Checkbox
            label="I removed client names and account numbers"
            checked={names}
            onChange={(e) => setNames(e.target.checked)}
          />
          <Checkbox
            label="A person reviewed the output before it was used"
            checked={reviewed}
            onChange={(e) => setReviewed(e.target.checked)}
          />
        </div>
        <div className="flex flex-col items-start gap-03">
          <Button disabled={!ready}>Save project</Button>
          {!ready && (
            <p className="text-label-01 text-text-secondary">
              Tick both safety checks to save your project.
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}
