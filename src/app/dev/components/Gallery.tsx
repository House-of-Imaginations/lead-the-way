"use client";

import { ButtonsSection } from "./sections/ButtonsSection";
import { ChoicesSection } from "./sections/ChoicesSection";
import { FieldsSection } from "./sections/FieldsSection";
import { LogoSection } from "./sections/LogoSection";
import { MediaSection } from "./sections/MediaSection";
import { OverlaysSection } from "./sections/OverlaysSection";
import { SideNavSection } from "./sections/SideNavSection";
import { StatusSection } from "./sections/StatusSection";
import { TabsProgressSection } from "./sections/TabsProgressSection";
import { ToastSection } from "./sections/ToastSection";
import { TopBarSection } from "./sections/TopBarSection";

export function Gallery() {
  return (
    <>
      <main className="flex flex-col gap-09 p-07">
        <header className="flex flex-col gap-03">
          <h1 className="text-heading-01">Components</h1>
          <p className="max-w-[65ch] text-body-01 text-text-secondary">
            Every component in every state. Check both themes:{" "}
            <a className="text-link underline" href="?theme=light">
              light
            </a>{" "}
            and{" "}
            <a className="text-link underline" href="?theme=dark">
              dark
            </a>
            .
          </p>
        </header>
        <LogoSection />
        <ButtonsSection />
        <StatusSection />
        <FieldsSection />
        <ChoicesSection />
        <TabsProgressSection />
        <ToastSection />
        <OverlaysSection />
        <MediaSection />
        <SideNavSection />
        <TopBarSection />
      </main>
      <footer className="px-07 pb-07 text-label-01 text-text-helper">
        Concept prototype. Not an official IBM product.
      </footer>
    </>
  );
}
