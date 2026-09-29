"use client";

import { Locked } from "@carbon/icons-react";
import { useState } from "react";
import {
  Avatar,
  InlineNotification,
  ProgressBar,
  Skeleton,
  StatTile,
  Tag,
} from "@/components/ui";
import { Section } from "./Section";

export function StatusSection() {
  const [tools, setTools] = useState(["Copilot", "Gemini"]);
  return (
    <Section id="status" title="Tags, avatars, notifications and stats">
      <div className="flex flex-wrap gap-03">
        <Tag>Draft</Tag>
        <Tag color="blue">Active</Tag>
        <Tag color="green">Completed</Tag>
        {tools.map((tool) => (
          <Tag
            key={tool}
            onDismiss={() => setTools((list) => list.filter((t) => t !== tool))}
          >
            {tool}
          </Tag>
        ))}
      </div>
      <div className="flex gap-03">
        <Avatar initials="PR" />
        <Avatar initials="CL" kind="org" />
      </div>
      <InlineNotification icon={Locked} title="Aggregate progress only.">
        Individual course activity remains private.
      </InlineNotification>
      <InlineNotification kind="success" title="Saved.">
        Your team now has a shared AI working agreement.
      </InlineNotification>
      <div className="grid max-w-[960px] grid-cols-1 gap-01 min-[900px]:grid-cols-4">
        <StatTile label="Joined the sprint" value="7" suffix="of 8" />
        <StatTile
          label="Time saved"
          value="40 min"
          helper="Team total, per week"
        />
        <StatTile
          label="Confidence"
          value="Hidden"
          helper="Hidden until 5 responses"
        />
        <StatTile label="Shared a project" value="3" suffix="of 8">
          <ProgressBar
            label="Shared a project"
            value={3}
            max={8}
            valueText="3 of 8 teammates"
            hideLabel
          />
        </StatTile>
      </div>
      <div
        data-testid="skeleton"
        className="flex max-w-[480px] flex-col gap-03"
      >
        <Skeleton className="h-control-md w-full" />
        <Skeleton className="h-control-md w-2/3" />
      </div>
    </Section>
  );
}
