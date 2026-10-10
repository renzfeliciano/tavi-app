import path from "node:path";
import { Circle, Document, Font, Image, Page, Path, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { brand } from "@/config/brand";
import type { AcknowledgementView } from "../acknowledgement-paper";
import type { DocumentParty, DocumentView } from "../document-view";

// Quotes, invoices and payment acknowledgements as PDFs (§1.9), drawn from the
// same view-models as the web paper, so the two can never disagree. Always
// light (DESIGN.md). The brand font (Geist, OFL) is embedded: it carries ₱ € £
// ¥, which many fonts lack (§N risk 8).

export const PDF_FONT_DIR = path.join(process.cwd(), "src/components/document/pdf/fonts");
export const PDF_FONT_FAMILY = "Geist";

let registered = false;
/** Registers the embedded font once per server instance. */
export function registerPdfFonts() {
  if (registered) return;
  Font.register({
    family: PDF_FONT_FAMILY,
    fonts: [
      { src: path.join(PDF_FONT_DIR, "Geist-Regular.ttf"), fontWeight: 400 },
      { src: path.join(PDF_FONT_DIR, "Geist-SemiBold.ttf"), fontWeight: 600 },
    ],
  });
  // Long unbroken words (references, emails) wrap instead of overflowing.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

const C = brand.emailColors;
// Hairline, sunken sheet and strong rule, as in DESIGN.md (colours written out: react-pdf has no CSS variables).
const HAIRLINE = "#e2e1ea";
const SUNKEN = "#f4f4f8";
const RULE = "#c9c8d4";

const s = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, fontSize: 10, color: C.ink, paddingTop: 44, paddingBottom: 56, paddingHorizontal: 40 }, // no Page-level lineHeight: with it react-pdf drops the fixed footer ("Page n of m")
  // A full-bleed ink bar across the top of every page: the carbon-copy "header rule".
  topBar: { position: "absolute", top: 0, left: 0, right: 0, height: 8, backgroundColor: C.ink },
  accentTick: { position: "absolute", top: 0, left: 40, width: 56, height: 8, backgroundColor: C.accent },
  row: { flexDirection: "row", justifyContent: "space-between" },
  muted: { color: C.muted },
  label: { fontSize: 7.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3, fontWeight: 600 },
  strong: { fontWeight: 600 },
  titleLabel: { fontSize: 9, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 2, textAlign: "right" },
  serial: { fontSize: 20, fontWeight: 600, color: C.accent, textAlign: "right", marginTop: 2 },
  section: { marginTop: 18 },
  panel: { backgroundColor: SUNKEN, borderRadius: 4, padding: 12 },
  tableHead: { flexDirection: "row", backgroundColor: SUNKEN, borderTopWidth: 1, borderTopColor: RULE, borderBottomWidth: 1, borderBottomColor: RULE, paddingVertical: 6, paddingHorizontal: 6, marginTop: 18 },
  th: { fontSize: 7.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: HAIRLINE, paddingVertical: 6, paddingHorizontal: 6 },
  colNo: { width: 22, color: C.muted },
  colDesc: { flex: 1, paddingRight: 8 },
  colQty: { width: 66, textAlign: "right", paddingRight: 8 },
  colPrice: { width: 80, textAlign: "right", paddingRight: 8 },
  colAmount: { width: 88, textAlign: "right" },
  totals: { marginTop: 10, marginLeft: "auto", width: 240 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5, paddingHorizontal: 6 },
  // The amount due: a solid ink band, white figures.
  grand: { backgroundColor: C.ink, color: "#ffffff", borderRadius: 3, marginTop: 6, paddingVertical: 8, paddingHorizontal: 10, fontSize: 12, fontWeight: 600 },
  box: { padding: 12, borderWidth: 1, borderColor: HAIRLINE, borderLeftWidth: 3, borderLeftColor: C.accent, borderRadius: 3 },
  notice: { marginTop: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: HAIRLINE, textAlign: "center", fontWeight: 600 },
  // RR 7-2024 Sec. 6 B.21: "REPRINT" prominently at the top portion.
  imprint: { alignSelf: "flex-start", marginTop: 14, marginLeft: 4, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 2, borderColor: C.accent, borderRadius: 3, transform: "rotate(-6deg)" },
  imprintText: { fontSize: 14, fontWeight: 600, letterSpacing: 3, color: C.accent },
  reprint: { fontSize: 18, fontWeight: 600, textAlign: "center", letterSpacing: 4, marginBottom: 14, paddingVertical: 4, borderWidth: 1.5, borderColor: C.ink },
  registration: { marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: HAIRLINE, textAlign: "center", fontSize: 8, color: C.muted },
  footer: { position: "absolute", bottom: 22, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: C.muted, alignItems: "flex-end", borderTopWidth: 0.5, borderTopColor: HAIRLINE, paddingTop: 6 },
});

function Party({ label, party }: { label: string; party: DocumentParty }) {
  return (
    <View>
      <Text style={s.label}>{label}</Text>
      <Text style={s.strong}>{party.name}</Text>
      {party.subtitle && <Text>{party.subtitle}</Text>}
      {[...party.addressLines, ...party.contactLines].map((line) => (
        <Text key={line} style={s.muted}>
          {line}
        </Text>
      ))}
      {party.taxId && (
        <Text style={s.muted}>
          {party.taxId.label} {party.taxId.value}
        </Text>
      )}
    </View>
  );
}

function Letterhead({ business, title, number }: { business: DocumentView["business"]; title: string; number: string }) {
  return (
    <View style={s.row}>
      <View style={{ maxWidth: 300 }}>
        {business.logo && (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt; the name follows.
          <Image src={business.logo.src} style={{ maxHeight: 52, maxWidth: 170, objectFit: "contain", marginBottom: 8 }} />
        )}
        <Text style={[s.strong, { fontSize: 13 }]}>{business.name}</Text>
        {business.subtitle && <Text>{business.subtitle}</Text>}
        {[...business.addressLines, ...business.contactLines].map((line) => (
          <Text key={line} style={s.muted}>
            {line}
          </Text>
        ))}
        {business.taxId && (
          <Text style={s.muted}>
            {business.taxId.label} {business.taxId.value}
          </Text>
        )}
      </View>
      <View style={{ maxWidth: 220 }}>
        <Text style={s.titleLabel}>{title}</Text>
        <Text style={s.serial}>{number}</Text>
      </View>
    </View>
  );
}

/**
 * The TAVI wordmark for PDFs: "TA", the check-mark V in stamp violet, "I"
 * (mirrors components/brand/wordmark.tsx; the path is the same). Only ever
 * small, in the footer: the business's own branding leads (brand.ts).
 */
function PdfWordmark({ size = 13 }: { size?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end" }} wrap={false}>
      <Text style={{ fontSize: size, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>TA</Text>
      <Svg viewBox="0 0 24 24" style={{ width: size * 0.85, height: size * 0.85, marginHorizontal: 0.5, marginBottom: 0 }}>
        <Path d="M2.5 9.5 L9.5 22 L22 1.5" fill="none" stroke={C.accent} strokeWidth={4.2} strokeLinecap="square" strokeLinejoin="miter" />
      </Svg>
      <Text style={{ fontSize: size, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>I</Text>
    </View>
  );
}

/** The Stamp, small and still (a PDF can't move): white head, ink body, violet pad. */
function PdfStamp({ height = 15 }: { height?: number }) {
  return (
    <Svg viewBox="0 0 64 70" style={{ width: height * (64 / 70), height }}>
      <Rect x={10} y={55} width={44} height={7} rx={2.5} fill={C.accent} />
      <Rect x={7} y={38} width={50} height={19} rx={6.5} fill={C.ink} />
      <Path d="M9.5 22 C9.5 8 19.5 1.5 32 1.5 C44.5 1.5 54.5 8 54.5 22 C54.5 32 48.2 36.5 40 36.5 H24 C15.8 36.5 9.5 32 9.5 22 Z" fill="#ffffff" stroke={C.ink} strokeWidth={3} />
      <Circle cx={24} cy={19} r={3.6} fill={C.ink} />
      <Circle cx={40} cy={19} r={3.6} fill={C.ink} />
      <Path d="M28 27.5 Q32 31.5 36 27.5" fill="none" stroke={C.ink} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

function PageFooter({ label, business }: { label: string; business: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={{ flex: 1 }}>
        {business} · {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
        <Text style={{ marginRight: 3 }}>Sent with</Text>
        <PdfWordmark />
        <View style={{ marginLeft: 4 }}>
          <PdfStamp />
        </View>
      </View>
      <Text style={{ flex: 1, textAlign: "right" }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

/** A quote or invoice. */
export function DocumentPdf({ view }: { view: DocumentView }) {
  const name = `${view.title}${view.number ? ` ${view.number}` : ""}`;
  const number = `${view.number ?? "Draft"}${view.revision > 1 ? ` · Rev ${view.revision}` : ""}`;
  // The summary card leads with the figure the reader came for: the emphasised total.
  const due = view.totals.find((t) => t.emphasis) ?? null;
  const detailTotals = view.totals.filter((t) => t !== due);
  return (
    <Document title={name} author={view.business.name} creator={brand.name} producer={brand.name}>
      <Page size="A4" style={s.page}>
        <View style={s.topBar} fixed />
        <View style={s.accentTick} fixed />
        {view.reprint && <Text style={s.reprint}>{view.reprint}</Text>}
        <Letterhead business={view.business} title={view.title} number={number} />

        <View style={[s.section, s.row]}>
          <View style={{ flex: 1, paddingRight: 20 }}>
            {view.customer ? <Party label="Billed to" party={view.customer} /> : <View />}
            {view.imprint && (
              <View style={s.imprint} wrap={false}>
                <Text style={s.imprintText}>{view.imprint.toUpperCase()}</Text>
              </View>
            )}
          </View>
          <View style={[s.panel, { width: 240 }]}>
            {view.dates.map((d) => (
              <View key={d.label} style={[s.row, { paddingVertical: 1.5 }]}>
                <Text style={s.muted}>{d.label}</Text>
                <Text style={s.strong}>{d.value}</Text>
              </View>
            ))}
            {due && (
              <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: RULE }}>
                <Text style={s.label}>{due.label}</Text>
                <Text style={{ fontSize: 17, fontWeight: 600 }}>{due.value}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={s.tableHead} fixed>
          <Text style={[s.th, s.colNo]}>#</Text>
          <Text style={[s.th, s.colDesc]}>Description</Text>
          <Text style={[s.th, s.colQty]}>Qty</Text>
          <Text style={[s.th, s.colPrice]}>Price</Text>
          <Text style={[s.th, s.colAmount]}>Amount</Text>
        </View>
        {view.lines.map((line, i) => (
          <View key={i} style={s.tableRow} wrap={false}>
            <Text style={s.colNo}>{i + 1}</Text>
            <View style={s.colDesc}>
              <Text style={s.strong}>{line.description}</Text>
              {(line.discount || line.tax) && (
                <Text style={[s.muted, { fontSize: 8 }]}>
                  {[line.discount && `Discount ${line.discount}`, line.tax].filter(Boolean).join(" · ")}
                </Text>
              )}
            </View>
            <Text style={s.colQty}>
              {line.quantity} {line.unit}
            </Text>
            <Text style={s.colPrice}>{line.unitPrice}</Text>
            <Text style={[s.colAmount, s.strong]}>{line.amount}</Text>
          </View>
        ))}

        <View style={s.totals} wrap={false}>
          {detailTotals.map((t) => (
            <View key={t.label} style={s.totalRow}>
              <Text style={s.muted}>{t.label}</Text>
              <Text>{t.value}</Text>
            </View>
          ))}
          {due && (
            <View style={[s.totalRow, s.grand]}>
              <Text>{due.label}</Text>
              <Text>{due.value}</Text>
            </View>
          )}
          {view.taxNotes.map((note) => (
            <Text key={note} style={[s.muted, { fontSize: 8, textAlign: "right", marginTop: 3 }]}>
              {note}
            </Text>
          ))}
          {view.sales && (
            <View style={{ marginTop: 8, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: RULE }}>
              {view.sales.statement && <Text style={{ textAlign: "right", fontWeight: 600 }}>{view.sales.statement}</Text>}
              {view.sales.rows.map((row) => (
                <View key={row.label} style={s.totalRow}>
                  <Text style={s.muted}>{row.label}</Text>
                  <Text>{row.value}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {view.qualifiedDiscount && (
          // RR 7-2024 Sec. 6 B.18: the buyer's ID number and signature line (D19).
          <View style={[s.row, { marginTop: 18, alignItems: "flex-end" }]} wrap={false}>
            <View>
              <Text style={s.strong}>{view.qualifiedDiscount.holder}</Text>
              <Text style={s.muted}>{view.qualifiedDiscount.idLine}</Text>
            </View>
            <View style={{ width: 200 }}>
              <View style={{ borderBottomWidth: 1, borderBottomColor: C.ink, height: 24 }} />
              <Text style={[s.muted, { fontSize: 8, textAlign: "center", marginTop: 2 }]}>{view.qualifiedDiscount.signature}</Text>
            </View>
          </View>
        )}
        {/* How to pay beside the notes and terms: keeps a short bill on one page. */}
        {(view.paymentInstructions || view.notes || view.terms) && (
          <View style={[s.row, { marginTop: 16 }]} wrap={false}>
            {view.paymentInstructions && (
              <View style={[s.box, { flex: 1, marginRight: view.notes || view.terms ? 16 : 0 }]}>
                <Text style={s.label}>How to pay</Text>
                <Text>{view.paymentInstructions}</Text>
              </View>
            )}
            {(view.notes || view.terms) && (
              <View style={{ flex: 1 }}>
                {view.notes && (
                  <View>
                    <Text style={s.label}>Notes</Text>
                    <Text>{view.notes}</Text>
                  </View>
                )}
                {view.terms && (
                  <View style={{ marginTop: view.notes ? 8 : 0 }}>
                    <Text style={s.label}>Terms</Text>
                    <Text>{view.terms}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
        {view.notice && <Text style={s.notice}>{view.notice}</Text>}
        {view.registration && <Text style={s.registration}>{view.registration}</Text>}
        <PageFooter label={name} business={view.business.name} />
      </Page>
    </Document>
  );
}

/** A payment acknowledgement. */
export function AcknowledgementPdf({ view }: { view: AcknowledgementView }) {
  const name = `${view.title} ${view.number}`;
  return (
    <Document title={name} author={view.business.name} creator={brand.name} producer={brand.name}>
      <Page size="A5" style={s.page}>
        <View style={s.topBar} fixed />
        <View style={s.accentTick} fixed />
        <Letterhead business={view.business} title={view.title} number={`No. ${view.number}`} />
        {view.voided && <Text style={[s.box, s.strong, { marginTop: 14 }]}>{view.voided}</Text>}
        <View style={[s.section, s.row]}>
          {view.customer ? <Party label="Received from" party={view.customer} /> : <View />}
          <View style={{ minWidth: 150 }}>
            {view.details.map((row) => (
              <View key={row.label} style={s.row}>
                <Text style={[s.muted, { marginRight: 8 }]}>{row.label}</Text>
                <Text>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={[s.section, s.panel, s.row, { alignItems: "center" }]}>
          <Text style={s.strong}>Amount received</Text>
          <Text style={[s.strong, { fontSize: 15 }]}>{view.amount}</Text>
        </View>
        {view.notice && <Text style={s.notice}>{view.notice}</Text>}
        {view.disclaimer && <Text style={[s.muted, { textAlign: "center", fontSize: 8, marginTop: 4 }]}>{view.disclaimer}</Text>}
        <PageFooter label={name} business={view.business.name} />
      </Page>
    </Document>
  );
}
