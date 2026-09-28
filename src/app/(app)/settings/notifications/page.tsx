"use client";

import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { api } from "@convex/_generated/api";
import type { NotificationEvent } from "@convex/lib/push/preferences";
import { HELP } from "@/lib/help";
import { usePush } from "@/hooks/usePush";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SettingsHeading, SettingsSection } from "@/components/settings";

/**
 * Turn notifications on and off for this device, and prove they work.
 *
 * The push test notification opens this page: `convex/push.ts` sets its url to
 * `/settings/notifications`, so the control to turn it off is where it lands.
 *
 * Every piece of state here is a browser fact -- the permission, the service
 * worker registration, whether THIS device holds a subscription -- which is
 * why `usePush` owns it rather than the page.
 */
/** What each event is called on screen. */
const EVENT_COPY: Record<NotificationEvent, { title: string; body: string }> = {
  example: { title: "Example", body: "Replace with the product's events." },
};

export default function NotificationSettingsPage() {
  const push = usePush();
  const preferences = useQuery(api.push.myPreferences, {});
  // Optimistic, so the switch moves under the finger rather than a round trip
  // later; the query's own answer replaces the guess when it arrives.
  const setPreference = useMutation(
    api.push.setPreference,
  ).withOptimisticUpdate((store, { event, enabled }) => {
    const current = store.getQuery(api.push.myPreferences, {});
    if (!current) return;
    store.setQuery(
      api.push.myPreferences,
      {},
      current.map((p) => (p.event === event ? { ...p, enabled } : p)),
    );
  });

  // Said plainly rather than drawn as a switch that can never work.
  const unavailable =
    push.publicKey === undefined
      ? "Checking this device…"
      : push.publicKey === null
        ? "Notifications are not switched on for this deployment yet."
        : !push.supported
          ? "This browser cannot receive notifications."
          : push.iosNeedsInstall
            ? "On an iPhone or iPad, notifications work once Lead the Way is on your home screen. Add it from Safari’s Share menu, then open it from there."
            : null;

  return (
    <>
      <SettingsHeading
        title="Notifications"
        description="Choose whether this device tells you when something happens."
      />

      <SettingsSection
        title="Push notifications"
        description={HELP.push.body[1]}
      >
        {unavailable ? (
          <p className="text-sm leading-snug text-muted-foreground">
            {unavailable}
          </p>
        ) : (
          <div className="flex items-start gap-3">
            <Switch
              id="push-switch"
              className="mt-0.5"
              checked={push.subscribed}
              disabled={push.busy}
              onCheckedChange={(on) =>
                void (on ? push.enable() : push.disable())
              }
            />
            <div className="flex flex-col gap-0.5">
              <label htmlFor="push-switch" className="text-sm font-medium">
                On this device
              </label>
              <p className="text-sm text-muted-foreground">
                {push.subscribed
                  ? push.deviceCount > 1
                    ? `Also on ${push.deviceCount - 1} other device${push.deviceCount > 2 ? "s" : ""}.`
                    : "Only this device so far."
                  : HELP.push.body[2]}
              </p>
            </div>
          </div>
        )}
        <p
          role="alert"
          className="text-sm leading-snug text-destructive empty:hidden"
        >
          {push.error ?? ""}
        </p>
      </SettingsSection>

      <SettingsSection
        title="Updates"
        description="Choose which events notify you, on every device you turned notifications on for."
      >
        {preferences?.map(({ event, enabled }) => (
          <div key={event} className="flex items-start gap-3">
            <Switch
              id={`event-${event}`}
              className="mt-0.5"
              checked={enabled}
              onCheckedChange={(on) =>
                void setPreference({ event, enabled: on })
              }
            />
            <div className="flex flex-col gap-0.5">
              <label htmlFor={`event-${event}`} className="text-sm font-medium">
                {EVENT_COPY[event].title}
              </label>
              <p className="text-sm text-muted-foreground">
                {EVENT_COPY[event].body}
              </p>
            </div>
          </div>
        ))}
        {/* ponytail: choices are stored but nothing sends notifications
            yet; the sender reads `notificationPreferences` when it is wired. */}
        <p className="text-sm text-muted-foreground">
          Your choices are saved. Notifications start arriving in a later
          update.
        </p>
      </SettingsSection>

      {/* Only once there is something to test. Offered before subscribing it
          would send to nothing and report success. */}
      {!unavailable && push.subscribed ? (
        <SettingsSection
          title="Test"
          description="Sends one notification to every device you turned this on for."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              disabled={push.busy}
              onClick={() => void push.test()}
            >
              {push.busy ? "Sending…" : "Send a test notification"}
            </Button>
            <p role="status" className="text-sm text-muted-foreground">
              {push.sent ? "Sent. Check your devices." : ""}
            </p>
          </div>
        </SettingsSection>
      ) : null}
    </>
  );
}
