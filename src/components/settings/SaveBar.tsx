import { Button, ButtonLink } from "@/components/ui";

/** The footer of 17, 18 and 19: the form's error, then Cancel and Save changes (64px). */
export function SaveBar({
  saving,
  error,
}: {
  saving: boolean;
  error: string | null;
}) {
  return (
    <>
      {error ? (
        <p role="alert" className="text-label-01 text-support-error">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end border-t border-border-subtle pt-07 max-md:flex-col">
        <ButtonLink
          href="/home"
          kind="secondary"
          size="xl"
          className="w-[200px] max-md:w-full"
        >
          Cancel
        </ButtonLink>
        <Button
          type="submit"
          size="xl"
          disabled={saving}
          className="w-[200px] max-md:w-full"
        >
          Save changes
        </Button>
      </div>
    </>
  );
}
