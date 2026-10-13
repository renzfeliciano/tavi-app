import { PackageIcon, WrenchIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CatalogItemKind } from "@/modules/catalog";

/** One icon for each kind of thing a business sells, wherever it appears: a box for goods, a wrench for work. */
export const KIND_ICON: Record<CatalogItemKind, LucideIcon> = {
  product: PackageIcon,
  service: WrenchIcon,
};

/** That icon, decorative: the kind is always written beside it. */
export function KindIcon({ kind, className }: { kind: CatalogItemKind; className?: string }) {
  const Icon = KIND_ICON[kind];
  return <Icon aria-hidden="true" className={cn("size-3", className)} />;
}
