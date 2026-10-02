/** What the shell shows about who is signed in and where. Plain, serializable data. */
export type ShellAccount = {
  organizationName: string;
  /** Every business the person belongs to; the switcher shows when there's more than one (D17). */
  businesses: { id: string; name: string; current: boolean }[];
  userName: string;
  userEmail: string;
};
