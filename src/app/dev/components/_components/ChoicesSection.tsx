"use client";

import { useState } from "react";
import {
  ContentSwitcher,
  LikertScale,
  SelectableTile,
  SelectableTileGroup,
  Toggle,
} from "@/components/ui";
import { Section } from "./Section";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => ({
  value: d.toLowerCase(),
  label: d,
}));
const TILES = [
  {
    title: "Reporting and drafting",
    description: "Weekly updates, summaries and first drafts.",
  },
  {
    title: "Meeting notes",
    description: "Actions and decisions from recurring meetings.",
  },
];
// 03's four answers, as the team page will use them.
const AI_USE = [
  ["Not using AI", "Little or no use yet"],
  ["Exploring occasionally", "A few people try it now and then"],
  ["Using AI regularly", "Part of some weekly tasks"],
  [
    "Advanced users, inconsistent practices",
    "Heavy use, but everyone does it differently",
  ],
].map(([title, description]) => ({ value: title, title, description }));

export function ChoicesSection() {
  const [reminder, setReminder] = useState(false);
  const [day, setDay] = useState("wed");
  const [tiles, setTiles] = useState<string[]>([]);
  const [aiUse, setAiUse] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  return (
    <Section id="choices" title="Toggles, switchers, tiles and scales">
      <div className="max-w-[560px]">
        <Toggle
          id="t-reminder"
          label="Weekly reminder before the protected hour"
          description="An email the day before, at 9:00 AM."
          checked={reminder}
          onChange={setReminder}
        />
        <Toggle
          id="t-show"
          label="Show and tell reminder"
          description="Available after launch."
          checked={false}
          onChange={() => {}}
          disabled
        />
      </div>
      <ContentSwitcher
        label="Default learning day"
        options={DAYS}
        value={day}
        onChange={setDay}
      />
      <div className="grid max-w-[720px] grid-cols-2 gap-01">
        {TILES.map((t) => (
          <SelectableTile
            key={t.title}
            title={t.title}
            description={t.description}
            selected={tiles.includes(t.title)}
            onChange={(on) =>
              setTiles((list) =>
                on ? [...list, t.title] : list.filter((x) => x !== t.title),
              )
            }
          />
        ))}
      </div>
      <div className="max-w-[720px]">
        <SelectableTileGroup
          legend="How does your team use AI today?"
          name="ai-use"
          options={AI_USE}
          value={aiUse}
          onChange={setAiUse}
        />
      </div>
      <div className="max-w-[480px]">
        <LikertScale
          name="confidence"
          legend="How confident do you feel using AI at work?"
          value={confidence}
          onChange={setConfidence}
          minLabel="Not confident"
          maxLabel="Very confident"
        />
      </div>
    </Section>
  );
}
