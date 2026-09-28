import { redirect } from "next/navigation";

/**
 * Settings is three pages now, and `/settings` is still what the account menu,
 * the workspace page and `/restore` link to. Profile is the first of the three.
 */
export default function SettingsIndex() {
  redirect("/settings/profile");
}
