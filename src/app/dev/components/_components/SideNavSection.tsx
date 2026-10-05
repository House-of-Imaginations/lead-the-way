"use client";

import { useState } from "react";
import { SideNav } from "@/components/ui";
import { Section } from "./Section";
import { sampleNav } from "./navSample";

export function SideNavSection() {
  const [last, setLast] = useState("None yet");
  return (
    <Section id="sidenav" title="Side nav">
      <div className="h-[720px] w-fit border border-border-subtle">
        <SideNav {...sampleNav(setLast)} />
      </div>
      <p className="text-body-02">Last account action: {last}</p>
    </Section>
  );
}
