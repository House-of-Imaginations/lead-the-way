/**
 * The cue text of a WebVTT file, one entry per cue, for the transcript
 * (Ruling 22). The header, NOTE and STYLE blocks have no timing line, so they
 * drop out; ids, timings, settings and tags go too.
 */
export function vttText(vtt: string): string[] {
  return vtt
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.split("\n"))
    .filter((lines) => lines.some((l) => l.includes("-->")))
    .map((lines) =>
      lines
        .slice(lines.findIndex((l) => l.includes("-->")) + 1)
        .join(" ")
        .replace(/<[^>]*>/g, "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .trim(),
    )
    .filter(Boolean);
}
