import {
  ArrowRight,
  Location,
  Map as MapIcon,
  Time,
  UserMultiple,
} from "@carbon/icons-react";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@convex/_generated/api";
import { CareersHeader } from "@/components/careers/CareersHeader";
import { ButtonLink } from "@/components/ui/Button";
import { openOrHome } from "@/lib/account/queries";

export const metadata: Metadata = { title: "Pivot Crews" };

const POINTS = [
  {
    icon: MapIcon,
    lead: "Your Pivot Map in 2 minutes.",
    rest: "Strengths first, then 3 skills to build.",
  },
  {
    icon: UserMultiple,
    lead: "A guide and a crew.",
    rest: "5 changers heading the same way.",
  },
  {
    icon: Time,
    lead: "Lessons of about 15 minutes.",
    rest: "Sized to the hours you pick.",
  },
];

// The hero's stair blocks: rows of week squares, the third column in blue.
const WINDOWS = [0, 1, 2, 3].flatMap((row) =>
  [0, 1, 2, 3, 4].map((col) => ({ row, col })),
);

/** 1 Discover: the public page a partner (library, TAFE, careers night) links to. */
export default async function DiscoverPage({
  params,
}: {
  params: Promise<{ partner: string }>;
}) {
  const { partner: slug } = await params;
  const partner = await openOrHome(() =>
    fetchQuery(api.careers.partners.bySlug, { slug }),
  );
  if (!partner) notFound();
  return (
    <div className="flex min-h-dvh flex-col bg-background text-text-primary">
      <CareersHeader />
      <main className="mx-auto flex w-full max-w-[600px] flex-1 flex-col gap-[20px] px-05 pt-[20px] pb-06">
        <span className="ltw-tag self-start">
          <Location size={12} aria-hidden="true" />
          Opened from {partner.name}
        </span>
        <svg
          viewBox="0 0 358 168"
          className="block w-full bg-layer-01"
          aria-hidden="true"
        >
          <rect
            x="150"
            y="104"
            width="64"
            height="64"
            className="fill-tag-blue-bg"
          />
          <rect
            x="214"
            y="64"
            width="72"
            height="104"
            className="fill-text-primary"
          />
          <rect
            x="286"
            y="24"
            width="72"
            height="144"
            className="fill-interactive"
          />
          {WINDOWS.map(({ row, col }) => (
            <rect
              key={`${row}${col}`}
              x={222 + col * 12}
              y={80 + row * 12}
              width="8"
              height="8"
              className={col === 2 ? "fill-interactive" : "fill-layer-01"}
            />
          ))}
          <text x="16" y="34" className="fill-text-secondary text-label-01">
            Retail Store Manager
          </text>
          <path d="M16 48h40" className="stroke-border-strong" />
          <text x="16" y="72" className="fill-text-secondary text-label-01">
            3 skills, 9 weeks
          </text>
          <text x="16" y="96" className="fill-text-primary text-body-emphasis">
            Data Analyst
          </text>
        </svg>
        <div className="flex flex-col gap-04">
          <h1 className="text-[36px] leading-[42px] font-light tracking-[-0.2px]">
            Change careers with a crew.
          </h1>
          <p className="text-body-01 text-text-secondary">
            Find the digital skills your next career needs. Learn them around
            your week. Finish with proof.
          </p>
        </div>
        <div className="flex items-baseline justify-between border-t border-b border-t-border-inverse border-b-border-subtle py-[14px]">
          <span className="text-heading-03 font-semibold">Free</span>
          <span className="text-text-secondary">No cost, no card</span>
        </div>
        <ul className="flex flex-col gap-[14px]">
          {POINTS.map(({ icon: Icon, lead, rest }) => (
            <li key={lead} className="flex gap-04">
              <Icon
                size={20}
                className="shrink-0 text-interactive"
                aria-hidden="true"
              />
              <span>
                <b className="font-semibold">{lead}</b>{" "}
                <span className="text-text-secondary">{rest}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-auto text-label-01 text-text-helper">
          Free IBM SkillsBuild credentials. Concept prototype. Not an official
          IBM product.
        </p>
      </main>
      <div className="ltw-cf">
        <div className="mx-auto max-w-[568px]">
          <ButtonLink
            href={`/careers/map/new?partner=${encodeURIComponent(slug)}`}
            icon={ArrowRight}
            className="w-full"
          >
            Start my map
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
