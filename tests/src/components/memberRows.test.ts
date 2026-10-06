// @vitest-environment node
import { expect, test } from "vitest";
import {
  headcount,
  memberRows,
  type Invite,
  type Member,
} from "../../../src/app/(app)/workspace/settings/_components/MembersTab";

const member = (name: string, email: string): Member =>
  ({
    personId: `p_${name}`,
    name,
    email,
    roleName: "Employee",
    isOwner: false,
    you: false,
  }) as Member;
const invite = (
  id: string,
  status: Invite["status"],
  email: string | null,
  name: string | null = null,
): Invite => ({ _id: id, status, email, name, roleName: "Employee" }) as Invite;

test("memberRows lists each person once, people first, then pending, then declined", () => {
  const rows = memberRows(
    [member("Priya Raman", "priya@example.com")],
    [
      // Declined, then invited again: shows once, as Invited.
      invite("i1", "declined", "omar@example.com", "Omar Haddad"),
      // Accepted: the person row stands for it.
      invite("i2", "accepted", "priya@example.com"),
      // Pending for someone already seated: shown as the person only.
      invite("i3", "pending", "PRIYA@example.com"),
      invite("i4", "pending", "omar@example.com", "Omar Haddad"),
      // No name: the address stands in.
      invite("i5", "pending", "new@example.com"),
      // A link with no address.
      invite("i6", "pending", null),
      invite("i7", "declined", "luca@example.com", "Luca Bianchi"),
    ],
  );
  expect(rows.map((r) => [r.name, r.email, r.state])).toEqual([
    ["Priya Raman", "priya@example.com", "Joined"],
    ["Omar Haddad", "omar@example.com", "Invited"],
    ["new@example.com", "new@example.com", "Invited"],
    ["Anyone with the link", "Shareable link", "Invited"],
    ["Luca Bianchi", "luca@example.com", "Declined"],
  ]);
  // Keys are unique, so React keeps each row.
  expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
});

test("the header counts people and open invitations, never declined ones", () => {
  const one = memberRows([member("Priya Raman", "priya@example.com")], []);
  expect(headcount(one)).toBe("1 person in this workspace");
  const rows = memberRows(
    [member("Priya Raman", "priya@example.com")],
    [
      invite("i1", "pending", "omar@example.com"),
      invite("i2", "declined", "luca@example.com"),
    ],
  );
  expect(headcount(rows)).toBe("2 people in this workspace");
});
