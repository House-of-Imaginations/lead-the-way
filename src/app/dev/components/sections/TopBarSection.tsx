import { SideNav, TopBar } from "@/components/ui";
import { Section } from "./Section";
import { sampleNav } from "./navSample";

export function TopBarSection() {
  return (
    <Section id="topbar" title="Top bar and drawer">
      <div className="max-w-[390px] border border-border-subtle">
        <TopBar homeHref="/dev/components#topbar">
          <SideNav {...sampleNav(() => {})} resizable={false} />
        </TopBar>
      </div>
    </Section>
  );
}
