import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
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

const s = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, fontSize: 10, color: C.ink, padding: 40, lineHeight: 1.4 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  muted: { color: C.muted },
  label: { fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  strong: { fontWeight: 600 },
  title: { fontSize: 16, fontWeight: 600, textAlign: "right" },
  section: { marginTop: 18, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#e2e1ea" },
  th: { fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  tableHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.muted, paddingBottom: 4, marginTop: 18 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e2e1ea", paddingVertical: 6 },
  colDesc: { flex: 1, paddingRight: 8 },
  colQty: { width: 70, textAlign: "right", paddingRight: 8 },
  colPrice: { width: 80, textAlign: "right", paddingRight: 8 },
  colAmount: { width: 85, textAlign: "right" },
  totals: { marginTop: 10, marginLeft: "auto", width: 220 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grand: { borderTopWidth: 1, borderTopColor: C.ink, marginTop: 4, paddingTop: 4, fontSize: 12, fontWeight: 600 },
  box: { marginTop: 18, padding: 10, borderWidth: 1, borderColor: "#e2e1ea", borderRadius: 4 },
  notice: { marginTop: 18, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#e2e1ea", textAlign: "center", fontWeight: 600 },
  // RR 7-2024 Sec. 6 B.21: "REPRINT" prominently at the top portion.
  reprint: { fontSize: 18, fontWeight: 600, textAlign: "center", letterSpacing: 4, marginBottom: 12, paddingVertical: 4, borderWidth: 1.5, borderColor: C.ink },
  registration: { marginTop: 18, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#e2e1ea", textAlign: "center", fontSize: 8, color: C.muted },
  footer: { position: "absolute", bottom: 20, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: C.muted },
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
          <Image src={business.logo.src} style={{ maxHeight: 48, maxWidth: 160, objectFit: "contain", marginBottom: 6 }} />
        )}
        <Text style={[s.strong, { fontSize: 12 }]}>{business.name}</Text>
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
      <View>
        <Text style={s.title}>{title}</Text>
        <Text style={{ textAlign: "right" }}>{number}</Text>
      </View>
    </View>
  );
}

function PageFooter({ label }: { label: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>{label}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

/** A quote or invoice. */
export function DocumentPdf({ view }: { view: DocumentView }) {
  const name = `${view.title}${view.number ? ` ${view.number}` : ""}`;
  const number = `${view.number ?? "Draft"}${view.revision > 1 ? ` · Rev ${view.revision}` : ""}`;
  return (
    <Document title={name} author={view.business.name} creator={brand.name} producer={brand.name}>
      <Page size="A4" style={s.page}>
        {view.reprint && <Text style={s.reprint}>{view.reprint}</Text>}
        <Letterhead business={view.business} title={view.title} number={number} />

        <View style={[s.section, s.row]}>
          {view.customer ? <Party label="For" party={view.customer} /> : <View />}
          <View>
            {view.dates.map((d) => (
              <View key={d.label} style={[s.row, { minWidth: 160 }]}>
                <Text style={s.muted}>{d.label}</Text>
                <Text>{d.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.tableHead} fixed>
          <Text style={[s.th, s.colDesc]}>Description</Text>
          <Text style={[s.th, s.colQty]}>Qty</Text>
          <Text style={[s.th, s.colPrice]}>Price</Text>
          <Text style={[s.th, s.colAmount]}>Amount</Text>
        </View>
        {view.lines.map((line, i) => (
          <View key={i} style={s.tableRow} wrap={false}>
            <View style={s.colDesc}>
              <Text>{line.description}</Text>
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
            <Text style={s.colAmount}>{line.amount}</Text>
          </View>
        ))}

        <View style={s.totals} wrap={false}>
          {view.totals.map((t) => (
            <View key={t.label} style={[s.totalRow, t.emphasis ? s.grand : {}]}>
              <Text>{t.label}</Text>
              <Text>{t.value}</Text>
            </View>
          ))}
          {view.taxNotes.map((note) => (
            <Text key={note} style={[s.muted, { fontSize: 8, textAlign: "right" }]}>
              {note}
            </Text>
          ))}
          {view.sales && (
            <View style={{ marginTop: 6, paddingTop: 4, borderTopWidth: 1, borderTopColor: "#e2e1ea" }}>
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
        {view.paymentInstructions && (
          <View style={s.box} wrap={false}>
            <Text style={s.label}>How to pay</Text>
            <Text>{view.paymentInstructions}</Text>
          </View>
        )}
        {view.notes && (
          <View style={{ marginTop: 14 }} wrap={false}>
            <Text style={s.label}>Notes</Text>
            <Text>{view.notes}</Text>
          </View>
        )}
        {view.terms && (
          <View style={{ marginTop: 10 }} wrap={false}>
            <Text style={s.label}>Terms</Text>
            <Text>{view.terms}</Text>
          </View>
        )}
        {view.notice && <Text style={s.notice}>{view.notice}</Text>}
        {view.registration && <Text style={s.registration}>{view.registration}</Text>}
        <PageFooter label={name} />
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
        <Letterhead business={view.business} title={view.title} number={`No. ${view.number}`} />
        {view.voided && <Text style={[s.box, s.strong]}>{view.voided}</Text>}
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
        <View style={[s.section, s.row]}>
          <Text style={s.strong}>Amount received</Text>
          <Text style={[s.strong, { fontSize: 14 }]}>{view.amount}</Text>
        </View>
        {view.notice && <Text style={s.notice}>{view.notice}</Text>}
        {view.disclaimer && <Text style={[s.muted, { textAlign: "center", fontSize: 8, marginTop: 4 }]}>{view.disclaimer}</Text>}
        <PageFooter label={name} />
      </Page>
    </Document>
  );
}
