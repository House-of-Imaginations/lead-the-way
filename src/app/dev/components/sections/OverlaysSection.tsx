"use client";

import { useState } from "react";
import { Button, Menu, Modal } from "@/components/ui";
import { Section } from "./Section";

export function OverlaysSection() {
  const [ssoOpen, setSsoOpen] = useState(false);
  const [last, setLast] = useState("None yet");
  return (
    <Section id="overlays" title="Modal and menu">
      <div className="flex flex-wrap items-start gap-05">
        <Modal
          trigger={<Button kind="tertiary">Open dialog</Button>}
          open={ssoOpen}
          onOpenChange={setSsoOpen}
          label="Single sign-on"
          title="Single sign-on isn't set up"
          primaryText="Use email"
          onPrimary={() => {
            setSsoOpen(false);
            setLast("Use email");
          }}
        >
          <p>
            Single sign-on is not set up for this demo workspace. Use your work
            email and password instead.
          </p>
        </Modal>
        <Modal
          trigger={<Button kind="ghost">Open transcript</Button>}
          label="Leading AI at Work"
          title="Transcript"
        >
          <p>
            Module 1. Why the protected hour matters, and how your team will use
            it.
          </p>
        </Modal>
        <Menu
          trigger={
            <Button kind="secondary" size="md">
              Show actions
            </Button>
          }
          items={[
            { label: "Settings", href: "/dev/components#overlays" },
            {
              label: "Workspace settings",
              disabled: true,
              helper: "Managed by Priya Raman",
            },
            { label: "Sign out", onSelect: () => setLast("Sign out") },
          ]}
        />
        <Menu
          side="top"
          trigger={
            <Button kind="secondary" size="md">
              Open account
            </Button>
          }
          items={[
            { label: "Your profile", onSelect: () => setLast("Your profile") },
            { label: "Sign out", onSelect: () => setLast("Sign out") },
          ]}
        />
        <Modal
          trigger={<Button kind="ghost">Review project</Button>}
          label="Work project"
          title="Save your project"
          primaryText="Save project"
          primaryDisabled
        >
          <p>Tick both safety checks to save your project.</p>
        </Modal>
        <div className="ml-auto">
          <Menu
            align="end"
            trigger={
              <Button kind="ghost" size="md">
                Manage member
              </Button>
            }
            items={[
              {
                label: "Resend invitation",
                onSelect: () => setLast("Resend invitation"),
              },
              {
                label: "Remove from team",
                onSelect: () => setLast("Remove from team"),
              },
            ]}
          />
        </div>
      </div>
      <p className="text-body-02">Last action: {last}</p>
    </Section>
  );
}
