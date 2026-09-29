"use client";

import { Button, useToast } from "@/components/ui";
import { Section } from "./Section";

export function ToastSection() {
  const toast = useToast();
  return (
    <Section id="toast" title="Toast">
      <div className="flex flex-wrap gap-05">
        <Button
          onClick={() =>
            toast({ title: "Invitations sent to 8 team members." })
          }
        >
          Send invitations
        </Button>
        <Button
          kind="secondary"
          onClick={() =>
            toast({
              title: "Saved.",
              body: "Your team now has a shared AI working agreement.",
            })
          }
        >
          Save agreement
        </Button>
      </div>
    </Section>
  );
}
