// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Tabs } from "../../../../src/components/ui";

// Radix renders only the selected tab's content.
const items = [
  { value: "general", label: "General", content: <i>general-body</i> },
  { value: "privacy", label: "Data and privacy", content: <i>privacy-body</i> },
];

test("a selected tab that is gone falls back to the first one shown (C4)", () => {
  // As 18 after losing members:manage while on Members.
  const html = renderToStaticMarkup(
    <Tabs label="Workspace settings" items={items} value="members" />,
  );
  expect(html).toContain("general-body");
  expect(html).not.toContain("privacy-body");
});

test("a selected tab that is still there stays selected", () => {
  const html = renderToStaticMarkup(
    <Tabs label="Settings" items={items} defaultValue="privacy" />,
  );
  expect(html).toContain("privacy-body");
  expect(html).not.toContain("general-body");
});
