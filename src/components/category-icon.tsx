import {
  BriefcaseIcon,
  CalendarHeartIcon,
  GraduationCapIcon,
  HardHatIcon,
  LaptopIcon,
  PaletteIcon,
  ScissorsIcon,
  ShapesIcon,
  StethoscopeIcon,
  StoreIcon,
  TruckIcon,
  UtensilsCrossedIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";
import { categoryFor, type CategoryCode } from "@/config/categories";
import { cn } from "@/lib/utils";

const ICONS: Record<CategoryCode, LucideIcon> = {
  food_beverage: UtensilsCrossedIcon,
  home_services: WrenchIcon,
  construction: HardHatIcon,
  beauty_wellness: ScissorsIcon,
  health: StethoscopeIcon,
  education: GraduationCapIcon,
  creative: PaletteIcon,
  tech_it: LaptopIcon,
  retail: StoreIcon,
  transport: TruckIcon,
  events: CalendarHeartIcon,
  professional: BriefcaseIcon,
  other: ShapesIcon,
};

/** A category's icon. Decorative: the category is always also named in text nearby. */
export function CategoryIcon({ code, className }: { code: string | null | undefined; className?: string }) {
  const Icon = ICONS[categoryFor(code).code];
  return <Icon aria-hidden="true" className={cn("size-4", className)} />;
}

/** The icon on a small ink-on-paper tile, for lists and headers. Renders nothing when there is no category. */
export function CategoryTile({
  code,
  className,
}: {
  code: string | null | undefined;
  className?: string;
}) {
  if (!code) return null;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-md border border-border bg-surface-sunken text-ink-subtle",
        className,
      )}
    >
      <CategoryIcon code={code} />
    </span>
  );
}
