"use client";

import { CalendarAdd } from "@carbon/icons-react";
import { Button, Menu } from "@/components/ui";
import { googleCalendarUrl, icsFor, type CalendarHour } from "@/lib/calendar";

function download(ics: string) {
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "lead-the-way-protected-hour.ics";
  a.click();
  // A tick later, so the browser has started the download first.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Ruling 21: the hour as a real file, or as a recurring Google event in a new tab. */
export function CalendarMenu({ hour }: { hour: CalendarHour }) {
  return (
    <Menu
      trigger={
        <Button
          kind="ghost"
          size="sm"
          icon={CalendarAdd}
          className="-ml-05 self-start"
        >
          Add to calendar
        </Button>
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
