import type { Route } from "next";
import { KIND_ICON } from "@/components/kind-icon";
import type { ShellFacts } from "./facts";
import {
  BanknoteIcon,
  ChartColumnIcon,
  FilePlus2Icon,
  FileTextIcon,
  HandCoinsIcon,
  HouseIcon,
  type LucideIcon,
  PackageIcon,
  PackagePlusIcon,
  ReceiptTextIcon,
  RepeatIcon,
  ShoppingCartIcon,
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
  { href: "/recurring", label: "Recurring", icon: RepeatIcon },
  { href: "/payments", label: "Payments", icon: WalletIcon },
  { href: "/purchase-orders", label: "Purchase orders", icon: ShoppingCartIcon },
  { href: "/customers", label: "Customers", icon: UsersIcon },
  { href: "/catalog", label: "Products & Services", icon: PackageIcon },
];

/** Sales, payments and unpaid bills (D18): only for people who can read reports. */
export const reportsNav: NavItem = { href: "/reports", label: "Reports", icon: ChartColumnIcon };

/** The phone tab bar: three destinations, "New" in the middle and "Menu" (the drawer, which holds everything else). */
export const mobileTabs: readonly NavItem[] = [
  { href: "/dashboard", label: "Home", icon: HouseIcon },
  { href: "/quotes", label: "Quotes", icon: FileTextIcon },
  { href: "/invoices", label: "Invoices", icon: ReceiptTextIcon },
];

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
  {
    // Money received that has no invoice (a reimbursement, a deposit): its own numbered receipt.
    href: "/receipts/new",
    label: "New receipt",
    description: "Money received that isn't an invoice payment",
    icon: HandCoinsIcon,
  },
  {
    // An order placed with a supplier; it feeds nothing else.
    href: "/purchase-orders/new",
    label: "New purchase order",
    description: "Order from a supplier",
    icon: PackagePlusIcon,
  },
];

/** A nav item is active on its own page and on any page beneath it. */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

type DocumentNames = {
  quote: { singular: string; plural: string };
  invoice: { singular: string; plural: string };
  purchaseOrder: { singular: string; plural: string };
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
    if (item.href === "/purchase-orders") return { ...item, label: capital(word(documents.purchaseOrder.plural)) };
    return item;
  });
}

/** "New" menu entries worded for the market. */
export function newActionsFor(documents: DocumentNames): NewAction[] {
  return newActions.map((action) => {
    if (action.href === "/quotes/new") return { ...action, label: `New ${documents.quote.singular.toLowerCase()}` };
    if (action.href === "/invoices/new") return { ...action, label: `New ${documents.invoice.singular.toLowerCase()}` };
    if (action.href === "/purchase-orders/new") return { ...action, label: `New ${documents.purchaseOrder.singular.toLowerCase()}` };
    if (action.label === "Record payment")
      return { ...action, description: `Open the ${documents.invoice.singular.toLowerCase()} it pays` };
    return action;
  });
}

export type NavGroup = {
  id: "overview" | "sales" | "manage";
  /** The small heading above the group; null for the first, which needs none. */
  label: string | null;
  items: NavItem[];
};

/**
 * The sidebar's groups: the dashboard on its own, then what you sell (quotations,
 * billing statements, payments), then what you manage (purchase orders, customers,
 * catalog, reports when allowed). Settings is not here: it lives in the account menu. Worded the way the market names documents.
 */
export function navGroupsFor(account: { canReadReports: boolean; documents: DocumentNames }): NavGroup[] {
  const named = (items: readonly NavItem[]) => withDocumentNames(items, account.documents);
  const [dashboard, quotes, invoices, recurring, payments, purchaseOrders, customers, catalog] = primaryNav;
  return [
    { id: "overview", label: null, items: named([dashboard!]) },
    { id: "sales", label: "Sales", items: named([quotes!, invoices!, recurring!, payments!]) },
    {
      id: "manage",
      label: "Manage",
      items: named([purchaseOrders!, customers!, catalog!, ...(account.canReadReports ? [reportsNav] : [])]),
    },
  ];
}

export type NavBadge = {
  /** The figure on the badge, capped ("99+"). */
  text: string;
  /** Spoken after the link's name: "3 overdue". */
  label: string;
  /** `alert` is for what needs doing; `quiet` is just a count. */
  tone: "alert" | "quiet";
};

const capped = (count: number) => (count > 99 ? "99+" : String(count));

/** The count shown beside a link, from real data: overdue billing statements, draft quotations. */
export function badgeFor(href: string, facts: Pick<ShellFacts, "overdueCount" | "draftCount"> | null): NavBadge | null {
  if (!facts) return null;
  if (href === "/invoices" && facts.overdueCount) {
    return { text: capped(facts.overdueCount), label: `${facts.overdueCount} overdue`, tone: "alert" };
  }
  if (href === "/quotes" && facts.draftCount) {
    return { text: capped(facts.draftCount), label: `${facts.draftCount} ${facts.draftCount === 1 ? "draft" : "drafts"}`, tone: "quiet" };
  }
  return null;
}

/** The "New" menu in the order people reach for it: the two documents, a receipt and a purchase order (if allowed), a customer, then something to sell. */
export function newMenuFor(
  documents: DocumentNames,
  { canRecordPayments = false, canPurchase = false }: { canRecordPayments?: boolean; canPurchase?: boolean } = {},
): NewAction[] {
  const [quote, invoice, customer] = newActionsFor(documents);
  // A receipt is for money received outside an invoice; only people who can record payments may make one.
  const receipt = newActions.find((action) => action.href === "/receipts/new");
  // A purchase order is for buying; only people who can write them may make one.
  const order = newActionsFor(documents).find((action) => action.href === "/purchase-orders/new");
  return [
    quote!,
    invoice!,
    ...(canRecordPayments && receipt ? [receipt] : []),
    ...(canPurchase && order ? [order] : []),
    customer!,
    { href: "/catalog/products/new" as Route, label: "Product", description: "Something you sell, priced once", icon: KIND_ICON.product },
    { href: "/catalog/services/new" as Route, label: "Service", description: "Something you do, priced once", icon: KIND_ICON.service },
  ];
}
