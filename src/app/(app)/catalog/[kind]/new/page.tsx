import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { requireOrgContext } from "@/modules/identity";
import { catalogFormCopy, newItemValues } from "../../_components/catalog-copy";
import { CatalogItemForm } from "../../_components/catalog-item-form";
import { KIND_LABEL, KIND_SEGMENT, kindFromSegment } from "../../_lib/kinds";

export async function generateMetadata({ params }: PageProps<"/catalog/[kind]/new">): Promise<Metadata> {
  const kind = kindFromSegment((await params).kind);
  return { title: kind ? `Add ${KIND_LABEL[kind].singular}` : "Not found" };
}

export default async function NewCatalogItemPage({ params, searchParams }: PageProps<"/catalog/[kind]/new">) {
  const kind = kindFromSegment((await params).kind);
  const { name, unit } = await searchParams;
  if (!kind) notFound();
  const ctx = await requireOrgContext();
  const [copy, base] = await Promise.all([catalogFormCopy(ctx), newItemValues(ctx, kind)]);
  // A starter suggestion from the empty catalog fills the name (and the unit, when this market offers it).
  const suggestedName = typeof name === "string" ? name.trim().slice(0, 120) : "";
  const suggestedUnit = typeof unit === "string" && ctx.market.units.options.includes(unit) ? unit : null;
  const values = { ...base, name: suggestedName || (base.name ?? ""), unitLabel: suggestedUnit ?? (base.unitLabel ?? "") };

  return (
    <>
      <BackLink href={`/catalog?type=${KIND_SEGMENT[kind]}` as Route}>{KIND_LABEL[kind].plural}</BackLink>
      <PageHeader
        title={`Add ${KIND_LABEL[kind].singular}`}
        description="Save your usual price once, and add it to any quote in one tap."
      />
      <div className="mt-8 max-w-3xl">
        <CatalogItemForm kind={kind} initialValues={values} copy={copy} />
      </div>
    </>
  );
}
