// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import {
  Checkbox,
  PasswordInput,
  Select,
  TextArea,
  TextInput,
} from "../../../../src/components/ui";

const describedBy = (html: string, tag: string) =>
  new RegExp(`<${tag}[^>]*aria-describedby="([^"]*)"`).exec(html)?.[1];

test("fields merge a caller's aria-describedby with their own helper or error", () => {
  const cases: [string, string][] = [
    [
      renderToStaticMarkup(
        <TextInput id="a" label="A" helper="H" aria-describedby="note" />,
      ),
      "input",
    ],
    [
      renderToStaticMarkup(
        <TextArea id="a" label="A" helper="H" aria-describedby="note" />,
      ),
      "textarea",
    ],
    [
      renderToStaticMarkup(
        <Select
          id="a"
          label="A"
          helper="H"
          options={[]}
          aria-describedby="note"
        />,
      ),
      "select",
    ],
    [
      renderToStaticMarkup(
        <PasswordInput id="a" label="A" helper="H" aria-describedby="note" />,
      ),
      "input",
    ],
  ];
  for (const [html, tag] of cases)
    expect(describedBy(html, tag)).toBe("a-helper note");

  const checkbox = renderToStaticMarkup(
    <Checkbox label="C" helper="H" aria-describedby="note" />,
  );
  expect(describedBy(checkbox, "input")).toMatch(/^\S+ note$/);
});

test("an error replaces the helper, and nothing extra means only the own id", () => {
  const html = renderToStaticMarkup(
    <TextInput id="a" label="A" helper="H" error="E" />,
  );
  expect(describedBy(html, "input")).toBe("a-error");
});
