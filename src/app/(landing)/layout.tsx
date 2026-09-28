/**
 * A pass-through. The routes in this group draw different chrome: the front
 * door is a full-bleed marketing page with its own navigation, and the
 * invitation route keeps the header band and centred card in
 * `join/layout.tsx`. A shared shell here would force one of them to fight it.
 */
export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex w-full flex-1 flex-col">{children}</div>;
}
