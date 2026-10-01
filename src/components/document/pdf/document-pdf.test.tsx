// @vitest-environment node
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import * as fontkit from "fontkit";
import { describe, expect, it } from "vitest";
import { MARKETS } from "@/config/markets";
import { OFFERED_CURRENCIES } from "@/config/currencies";
import { formatMoney } from "@/shared/money";
import { buildDocumentView, type DocumentViewLineInput } from "../document-view";
import { calculateDocument } from "@/modules/documents/client";
import { AcknowledgementPdf, DocumentPdf, PDF_FONT_DIR, registerPdfFonts } from "./document-pdf";

const business = {
  name: "Santos Aircon",
  subtitle: "Santos Aircon Services OPC",
  addressLines: ["12 Rizal St", "Pasig, Metro Manila 1600"],
  contactLines: ["billing@santos.example"],
  taxId: { label: "VAT Reg TIN", value: "123-456-789-00000" },
  logo: null,
};

function view(lineCount: number) {
  const lines: DocumentViewLineInput[] = Array.from({ length: lineCount }, (_, i) => ({
    description: `Aircon cleaning, unit ${i + 1}`,
    quantity: 10000,
    unitLabel: "unit",
    unitPriceMinor: 150000,
    discount: null,
    tax: { name: "VAT", rateBps: 1200 },
  }));
  return buildDocumentView({
    title: "Billing statement",
    number: "INV-000001",
    revision: 1,
    business,
    customer: { name: "Juan Dela Cruz", subtitle: null, addressLines: [], contactLines: [], taxId: null },
    currency: "PHP",
    locale: "en-PH",
    taxMode: "exclusive",
    dates: [{ label: "Date", date: "2026-10-01" }],
    lines,
    amounts: calculateDocument({ taxMode: "exclusive", lines }),
    notes: null,
    terms: null,
    paymentInstructions: "GCash 0917 123 4567",
    notice: MARKETS.PH.supplementaryDocumentNotice,
  });
}

const pageCount = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;

describe("PDF font", () => {
  it.each(["Geist-Regular.ttf", "Geist-SemiBold.ttf"])(
    "%s has every character our money formatting prints, in every supported currency (₱ € £ ¥…)",
    (file) => {
      const font = fontkit.openSync(path.join(PDF_FONT_DIR, file)) as fontkit.Font;
      for (const code of OFFERED_CURRENCIES) {
        for (const locale of ["en-PH", "en-US", "de-DE"]) {
          for (const char of formatMoney(-1234567, code, { locale })) {
            expect(font.hasGlyphForCodePoint(char.codePointAt(0)!), `${code} ${locale} "${char}"`).toBe(true);
          }
        }
      }
    },
  );
});

describe("DocumentPdf", () => {
  it("renders a one-page PDF for a short document", async () => {
    registerPdfFonts();
    const pdf = await renderToBuffer(<DocumentPdf view={view(3)} />);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pageCount(pdf)).toBe(1);
  });

  it("breaks 60 lines across pages instead of cutting them off", async () => {
    registerPdfFonts();
    const pdf = await renderToBuffer(<DocumentPdf view={view(60)} />);
    expect(pageCount(pdf)).toBeGreaterThan(1);
  });
});

describe("AcknowledgementPdf", () => {
  it("renders", async () => {
    registerPdfFonts();
    const pdf = await renderToBuffer(
      <AcknowledgementPdf
        view={{
          title: "Payment acknowledgement",
          number: "REC-000001",
          business,
          customer: null,
          details: [{ label: "Method", value: "GCash or Maya" }],
          amount: "₱1,500.00",
          voided: null,
          notice: MARKETS.PH.supplementaryDocumentNotice,
          disclaimer: MARKETS.PH.documents.receipt.disclaimer,
        }}
      />,
    );
    expect(pageCount(pdf)).toBe(1);
  });
});
