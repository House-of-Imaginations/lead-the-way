"use client";

import { CalendarAdd } from "@carbon/icons-react";
import type { ReactElement } from "react";
import { Button, Menu } from "@/components/ui";
import { googleCalendarUrl, icsFor, type CalendarHour } from "@/lib/calendar";

function download(ics: string) {
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "from-zero-to-hero-protected-hour.ics";
  a.click();
  // A second later: Safari can cancel a download whose URL is revoked sooner.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * P4 Ruling 21: the hour as a real file, or as a recurring Google event in a
 * new tab. 05 uses the small ghost trigger; 13 passes its full-width primary.
 */
export function CalendarMenu({
  hour,
  trigger,
}: {
  hour: CalendarHour;
  trigger?: ReactElement;
}) {
  return (
    <Menu
      trigger={
        trigger ?? (
          <Button
            kind="ghost"
            size="sm"
            icon={CalendarAdd}
            className="-ml-05 self-start"
          >
            Add to calendar
          </Button>
        )
      }
      items={[
        { label: "Download .ics", onSelect: () => download(icsFor(hour)) },
        {
          label: "Open in Google Calendar",
          onSelect: () =>
            window.open(googleCalendarUrl(hour), "_blank", "noopener"),
        },
      ]}
    />
  );
}
