import type { Metadata } from "next";
import { MySprint } from "./_components/MySprint";

export const metadata: Metadata = { title: "My sprint · Lead the Way" };

export default function MySprintPage() {
  return <MySprint />;
}
