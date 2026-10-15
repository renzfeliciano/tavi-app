import {
  ButtonSkeleton,
  DocumentPaperSkeleton,
  LoadingScreen,
  PageHeaderSkeleton,
  TextSkeleton,
} from "@/components/skeletons";
import { DOCUMENT_BODY, DocumentSidePanelSkeleton, panelPlace } from "../../../_documents/side-panel";

// A sent bill: the way back, its number, status and actions (Repeat this, Download PDF, Copy link, Remind, Edit and the
// more menu, which wrap onto a second row beside a long title), then its payments, the panel and the bill itself,
// laid out as the page lays them out.
export default function InvoiceLoading() {
  return (
    <LoadingScreen label="Loading billing statement">
      <PageHeaderSkeleton back badge title="w-56" description="w-64" actions={["w-30", "w-34", "w-30", "w-24", "w-20", "w-9"]} />
      <div className={DOCUMENT_BODY}>
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <TextSkeleton size="base" width="w-24" />
              <TextSkeleton width="w-44" />
            </div>
            <ButtonSkeleton width="w-36" />
          </div>
          {/* Most often the first thing seen is "No payments yet." */}
          <TextSkeleton width="w-32" className="mt-3" />
        </div>
        <DocumentSidePanelSkeleton className={panelPlace(2)} />
        <div className="min-w-0">
          <DocumentPaperSkeleton />
        </div>
      </div>
    </LoadingScreen>
  );
}
