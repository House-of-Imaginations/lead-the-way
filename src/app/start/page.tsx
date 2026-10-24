import type { Metadata } from "next";
import { AuthSplit } from "@/components/app/AuthSplit";
import { getAccountShell, getHome } from "@/lib/account/queries";
import { ChooseTrack } from "./_components/ChooseTrack";
import { startHrefs } from "./_components/startHrefs";

export const metadata: Metadata = {
  title: "Choose a track · From Zero to Hero",
};

const PANEL_TILES = [
  {
    title: "Grow in my role",
    caption: "Your manager sees team totals, hidden below 5 people.",
  },
  {
    title: "Change careers",
    caption: "No employer sees anything, not even that you started.",
  },
];

/** MS1: open to everyone (R10). The links follow the account. */
export default async function StartPage() {
  const [home, all] = await Promise.all([getHome(), getAccountShell()]);
  const signedIn = home !== null;
  return (
    <AuthSplit
      wide
      title="What brings you here?"
      lead={
        <>
          <span className="min-[1024px]:hidden">
            Two ways in. The same short lessons, people who keep you going, and
            proof at the end.
          </span>
          <span className="hidden min-[1024px]:inline">
            Pick the track that fits. You can add the other one later.
          </span>
        </>
      }
      panelTitle="One account. Either track. Or both."
      panelBody="Lessons of about 15 minutes, people who keep you going, and proof you can share. What changes is who backs you, and who can see what."
      aside={
        <div className="grid grid-cols-2 gap-01">
          {PANEL_TILES.map((t) => (
            <div
              key={t.title}
              className="flex flex-col gap-02 bg-background p-05"
            >
              <h3 className="text-body-emphasis">{t.title}</h3>
              <p className="text-label-01 text-text-secondary">{t.caption}</p>
            </div>
          ))}
        </div>
      }
    >
      <ChooseTrack
        hrefs={startHrefs({
          signedIn,
          team: !!all?.team,
          career: !!all?.career,
        })}
        signedIn={signedIn}
      />
    </AuthSplit>
  );
}
