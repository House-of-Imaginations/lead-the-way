"use client";

import { ButtonsSection } from "./ButtonsSection";
import { ChoicesSection } from "./ChoicesSection";
import { FieldsSection } from "./FieldsSection";
import { LogoSection } from "./LogoSection";
import { MediaSection } from "./MediaSection";
import { OverlaysSection } from "./OverlaysSection";
import { SideNavSection } from "./SideNavSection";
import { StatusSection } from "./StatusSection";
import { TabsProgressSection } from "./TabsProgressSection";
import { ToastSection } from "./ToastSection";
import { TopBarSection } from "./TopBarSection";

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
