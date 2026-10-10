import type { Route } from "next";
import {
  BanknoteIcon,
  ChartColumnIcon,
  FilePlus2Icon,
  FileTextIcon,
  HouseIcon,
  type LucideIcon,
  PackageIcon,
  ReceiptTextIcon,
  SettingsIcon,
  UserPlusIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

export type NavItem = {
  href: Route;
  label: string;
  icon: LucideIcon;
};

export type NewAction = NavItem & { description: string };

/** Primary navigation (§24). Quotes and invoices come first: they're the daily work. */
export const primaryNav: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: HouseIcon },
  { href: "/quotes", label: "Quotes", icon: FileTextIcon },
  { href: "/invoices", label: "Invoices", icon: ReceiptTextIcon },
  { href: "/payments", label: "Payments", icon: WalletIcon },
  { href: "/customers", label: "Customers", icon: UsersIcon },
  { href: "/catalog", label: "Products & Services", icon: PackageIcon },
];

/** Sales, payments and unpaid bills (D18): only for people who can read reports. */
export const reportsNav: NavItem = { href: "/reports", label: "Reports", icon: ChartColumnIcon };

export const settingsNav: NavItem = {
  href: "/settings",
  label: "Settings",
  icon: SettingsIcon,
};

/** The phone tab bar holds four destinations plus "New"; the rest live under More. */
export const mobileTabs: readonly NavItem[] = [
  { href: "/dashboard", label: "Home", icon: HouseIcon },
  { href: "/quotes", label: "Quotes", icon: FileTextIcon },
  { href: "/invoices", label: "Invoices", icon: ReceiptTextIcon },
];

export const mobileMore: readonly NavItem[] = [
  { href: "/customers", label: "Customers", icon: UsersIcon },
  { href: "/payments", label: "Payments", icon: WalletIcon },
  { href: "/catalog", label: "Products & Services", icon: PackageIcon },
  settingsNav,
];

/** The primary destinations this person can open: Reports joins them when allowed. */
export const primaryNavFor = (account: { canReadReports: boolean }): readonly NavItem[] =>
  account.canReadReports ? [...primaryNav, reportsNav] : primaryNav;

/** The More sheet for this person: Reports sits before Settings when allowed. */
export const mobileMoreFor = (account: { canReadReports: boolean }): readonly NavItem[] =>
  account.canReadReports ? [...mobileMore.slice(0, -1), reportsNav, settingsNav] : mobileMore;

/** Quick actions behind "New" (§25). */
export const newActions: readonly NewAction[] = [
  {
    href: "/quotes/new",
    label: "New quote",
    description: "Price out work for a customer",
    icon: FilePlus2Icon,
  },
  {
    href: "/invoices/new",
    label: "New invoice",
    description: "Bill for finished work",
    icon: ReceiptTextIcon,
  },
  {
    href: "/customers/new",
    label: "Add customer",
    description: "Save their contact details",
    icon: UserPlusIcon,
  },
  {
    // Payments are recorded on the invoice they pay (it knows the balance).
    href: "/invoices",
    label: "Record payment",
    description: "Open the invoice it pays",
    icon: BanknoteIcon,
  },
];

/** A nav item is active on its own page and on any page beneath it. */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

type DocumentNames = {
  quote: { singular: string; plural: string };
  invoice: { singular: string; plural: string };
};

/**
 * Navigation items worded the way the market names the documents (PH:
 * "Quotations", "Billing statements"), so a link and the page it opens say
 * the same thing. `short` keeps the phone tab bar to one word.
 */
export function withDocumentNames<T extends NavItem>(
  items: readonly T[],
  documents: DocumentNames,
  { short = false }: { short?: boolean } = {},
): T[] {
  const word = (plural: string) => (short ? (plural.split(" ").at(-1) ?? plural) : plural);
  const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  return items.map((item) => {
    if (item.href === "/quotes") return { ...item, label: capital(word(documents.quote.plural)) };
    if (item.href === "/invoices") return { ...item, label: capital(word(documents.invoice.plural)) };
    return item;
  });
}

/** "New" menu entries worded for the market. */
export function newActionsFor(documents: DocumentNames): NewAction[] {
  return newActions.map((action) => {
    if (action.href === "/quotes/new") return { ...action, label: `New ${documents.quote.singular.toLowerCase()}` };
    if (action.href === "/invoices/new") return { ...action, label: `New ${documents.invoice.singular.toLowerCase()}` };
    if (action.label === "Record payment")
      return { ...action, description: `Open the ${documents.invoice.singular.toLowerCase()} it pays` };
    return action;
  });
}
