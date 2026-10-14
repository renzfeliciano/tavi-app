import { DocumentPaperSkeleton, LoadingScreen, PageHeaderSkeleton } from "@/components/skeletons";
import { DOCUMENT_BODY, DocumentSidePanelSkeleton, panelPlace } from "../../_documents/side-panel";

// A quote: the way back, its number, status and actions, then the panel and the quote itself.
export default function QuoteLoading() {
  return (
    <LoadingScreen label="Loading quotation">
      <PageHeaderSkeleton back badge title="w-48" description="w-48" actions={["w-28", "w-24"]} />
      <div className={DOCUMENT_BODY}>
        <DocumentSidePanelSkeleton className={panelPlace(1)} />
        <div className="min-w-0">
          <DocumentPaperSkeleton />
        </div>
      </div>
    </LoadingScreen>
  );
}
