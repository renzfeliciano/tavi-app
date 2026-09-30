import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { ArchiveIcon } from "lucide-react";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { ArchiveToggle } from "@/components/archive-toggle";
import { getCatalogItem } from "@/modules/catalog";
import { requireOrgContext } from "@/modules/identity";
import { archiveCatalogItemAction, restoreCatalogItemAction } from "../../actions";
import { catalogFormCopy, itemFormValues } from "../../_components/catalog-copy";
import { CatalogItemForm } from "../../_components/catalog-item-form";
import { KIND_LABEL, KIND_SEGMENT, kindFromSegment } from "../../_lib/kinds";

export async function generateMetadata({ params }: PageProps<"/catalog/[kind]/[id]">): Promise<Metadata> {
  const kind = kindFromSegment((await params).kind);
  return { title: kind ? KIND_LABEL[kind].title : "Not found" };
}

export default async function CatalogItemPage({ params }: PageProps<"/catalog/[kind]/[id]">) {
  const { kind: segment, id } = await params;
  const kind = kindFromSegment(segment);
  if (!kind) notFound();
  const ctx = await requireOrgContext();
  const item = await getCatalogItem(ctx, kind, id);
  if (!item) notFound();
  const archived = item.archivedAt !== null;
  const listHref = `/catalog?type=${KIND_SEGMENT[kind]}${archived ? "&status=archived" : ""}` as Route;

  return (
    <>
      <BackLink href={listHref}>{KIND_LABEL[kind].plural}</BackLink>
      <PageHeader
        title={item.name}
        description={
          archived ? (
            <span className="inline-flex items-center gap-1.5">
              <ArchiveIcon aria-hidden="true" className="size-3.5" />
              Archived. Restore it to add it to new lines again.
            </span>
          ) : (
            (item.description ?? undefined)
          )
        }
        actions={
          <ArchiveToggle
            name={item.name}
            archived={archived}
            archivedDescription="Hidden from your list and the line-item picker."
            archive={archiveCatalogItemAction.bind(null, kind, item.id)}
            restore={restoreCatalogItemAction.bind(null, kind, item.id)}
          />
        }
      />
      <div className="mt-8 max-w-3xl">
        <CatalogItemForm
          kind={kind}
          itemId={item.id}
          initialValues={itemFormValues(item, ctx.locale)}
          copy={await catalogFormCopy(ctx, kind, item)}
        />
      </div>
    </>
  );
}
