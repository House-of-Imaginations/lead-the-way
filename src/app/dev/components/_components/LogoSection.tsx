import { Logo } from "@/components/ui";
import { Section } from "./Section";

export function LogoSection() {
  return (
    <Section id="logo" title="Logo">
      <div className="flex flex-wrap items-center gap-07">
        <span className="flex items-center gap-[10px] text-body-emphasis">
          <Logo />
          From zero to hero
        </span>
        <span className="flex items-center gap-[10px] bg-layer-01 p-05 text-body-emphasis">
          <Logo />
          From zero to hero
        </span>
      </div>
    </Section>
  );
}
