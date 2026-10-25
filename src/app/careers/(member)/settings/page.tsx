import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { api } from "@convex/_generated/api";
import { fetchAuthQuery } from "@/lib/account/auth-server";
import { getAccountShell, getHome, openOrHome } from "@/lib/account/queries";
import { CareerSettings } from "./_components/CareerSettings";

export const metadata: Metadata = {
  title: "Privacy and settings · From Zero to Hero",
};

/** D8: profile, reminders and privacy for the career track, opening on Privacy. */
export default async function CareerSettingsPage() {
  const all = await getAccountShell();
  if (!all?.career) redirect((await getHome()) ?? "/signed-out");
  const [mine, crew] = await Promise.all([
    openOrHome(() => fetchAuthQuery(api.careers.careerSettings.mine, {})),
    openOrHome(() => fetchAuthQuery(api.careers.crews.mine, {})),
  ]);
  return (
    <div className="flex flex-col gap-07">
      <header className="flex flex-col gap-03">
        <h1 className="text-heading-01 text-balance">Privacy and settings</h1>
        <p className="text-body-01 text-text-secondary">
          Your account, your reminders and exactly who sees what.
        </p>
      </header>
      <CareerSettings
        settings={mine.settings}
        contactEmail={mine.private ? (mine.contactEmail ?? "") : null}
        hasAnswers={mine.answers.targetRole !== null}
        guide={crew?.guide.firstName || null}
      />
    </div>
  );
}
