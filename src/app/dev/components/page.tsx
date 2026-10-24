import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Gallery } from "./_components/Gallery";

export const metadata: Metadata = {
  title: "Components · From zero to hero",
  robots: { index: false },
};

export default function ComponentsPage() {
  // A test fixture for the design system, never a product surface.
  if (process.env.NODE_ENV === "production") notFound();
  return <Gallery />;
}
