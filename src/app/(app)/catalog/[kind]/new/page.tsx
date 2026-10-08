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

export default async function NewCatalogItemPage({ params }: PageProps<"/catalog/[kind]/new">) {
  const kind = kindFromSegment((await params).kind);
  if (!kind) notFound();
  const ctx = await requireOrgContext();
  const [copy, values] = await Promise.all([catalogFormCopy(ctx), newItemValues(ctx, kind)]);

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
