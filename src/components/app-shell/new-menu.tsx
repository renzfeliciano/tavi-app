"use client";

import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CollapsedTip } from "./collapsed-tip";
import type { NewAction } from "./nav";

/** "New": the quickest way to start a quotation, a billing statement, a customer or something to sell. */
export function NewMenu({
  actions,
  collapsed,
  onNavigate,
}: {
  actions: NewAction[];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <DropdownMenu>
      <CollapsedTip label="New" active={collapsed}>
        <DropdownMenuTrigger
          render={
            <Button
              size="lg"
              className="w-full justify-start gap-2.5 group-data-[sidebar=collapsed]/shell:justify-center"
            />
          }
        >
          <PlusIcon aria-hidden="true" className="size-5" />
          <span className="group-data-[sidebar=collapsed]/shell:sr-only">New</span>
        </DropdownMenuTrigger>
      </CollapsedTip>
      <DropdownMenuContent align="start" side={collapsed ? "right" : "bottom"} className={collapsed ? "w-64" : "w-(--anchor-width)"}>
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <DropdownMenuItem
              key={action.href}
              render={<Link href={action.href} onClick={onNavigate} />}
              className="items-start gap-2.5 py-2"
            >
              <Icon aria-hidden="true" className="mt-0.5 text-muted-foreground" />
              <span className="grid gap-0.5">
                <span className="font-medium">{action.label}</span>
                <span className="text-xs text-muted-foreground">{action.description}</span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
