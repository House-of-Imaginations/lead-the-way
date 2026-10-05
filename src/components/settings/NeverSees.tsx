import { useId } from "react";

/** What the manager can never see (17 and 19): the privacy promise, in place. */
export function NeverSees({
  heading,
  items,
}: {
  heading: string;
  items: string[];
}) {
  const id = useId();
  return (
    <aside
      aria-labelledby={id}
      className="flex flex-col gap-05 self-start bg-layer-01 p-05"
    >
      <h2 id={id} className="text-heading-04">
        {heading}
      </h2>
      <ul className="flex flex-col gap-03 text-body-02">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-03">
            <span
              aria-hidden
              className="mt-[7px] size-[6px] shrink-0 bg-text-primary"
            />
            {item}
          </li>
        ))}
      </ul>
    </aside>
  );
}
