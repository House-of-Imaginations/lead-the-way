import type { Metadata } from "next";
import { MySprint } from "./_components/MySprint";

export const metadata: Metadata = { title: "My sprint · From Zero to Hero" };

export default function MySprintPage() {
  return <MySprint />;
}
