/** `orgs.active`, ids as plain strings so a plain object stands in for a seat in tests. */
export type ActiveSeat = {
  org: { _id: string; name: string; slug: string };
  roleName: string;
  isOwner: boolean;
  permissions: string[];
};
