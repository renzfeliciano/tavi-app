/** What the shell shows about who is signed in and where. Plain, serializable data. */
export type ShellAccount = {
  organizationName: string;
  /** The business's category code, for its icon beside the name. */
  organizationCategory: string | null;
  /** Every business the person belongs to; the switcher shows when there's more than one (D17). */
  businesses: { id: string; name: string; current: boolean }[];
  userName: string;
  userEmail: string;
  /** Whether Reports shows in the navigation (`reports.read`, D18). */
  canReadReports: boolean;
  /** The market's names for the two documents, so navigation reads like the pages it opens. */
  documents: { quote: { singular: string; plural: string }; invoice: { singular: string; plural: string } };
};
