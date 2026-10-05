import { Add, ArrowRight, Enterprise } from "@carbon/icons-react";
import { Button, ButtonLink } from "@/components/ui";
import { Section } from "./Section";

export function ButtonsSection() {
  return (
    <Section id="buttons" title="Buttons">
      <div className="flex flex-wrap items-start gap-05">
        <Button icon={ArrowRight}>Save agreement</Button>
        <Button kind="secondary">Back</Button>
        <Button kind="tertiary">Download summary</Button>
        <Button kind="ghost">View all</Button>
        <Button kind="danger">Remove member</Button>
        <Button kind="sso" icon={Enterprise}>
          Log in with single sign-on
        </Button>
      </div>
      <div className="flex flex-wrap items-start gap-05">
        <Button size="md" icon={Add}>
          Add
        </Button>
        <Button kind="ghost" size="sm">
          Edit
        </Button>
        <ButtonLink
          href="/dev/components#buttons"
          kind="tertiary"
          icon={ArrowRight}
        >
          Jump to buttons
        </ButtonLink>
      </div>
      <div className="flex flex-col items-start gap-03">
        <Button disabled>Save project</Button>
        <p className="text-label-01 text-text-secondary">
          Tick both safety checks to save your project.
        </p>
      </div>
      <div className="grid max-w-[560px] grid-cols-2">
        <Button kind="secondary" size="xl">
          Cancel
        </Button>
        <Button size="xl" icon={ArrowRight}>
          Continue
        </Button>
      </div>
      <div data-testid="inverse" className="bg-layer-inverse p-05">
        <button
          type="button"
          className="ltw-focus h-control-md px-05 text-text-inverse"
        >
          Test focus
        </button>
      </div>
    </Section>
  );
}
