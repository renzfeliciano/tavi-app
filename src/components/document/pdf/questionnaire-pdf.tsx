import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { brand } from "@/config/brand";
import { PDF_FONT_FAMILY } from "./document-pdf";

// The RDO/CPA worksheet as a PDF: something to bring to the tax office or an accountant. Always light (DESIGN.md), in
// the same font and ink as the documents. It is not a transaction document, so it carries no supplementary notice.

export type QuestionnairePdfProps = {
  /** The market's wording: the heading, and the label above the answer received. */
  title: string;
  answerLabel: string;
  business: {
    name: string;
    taxId: { label: string; value: string } | null;
    office: { label: string; value: string } | null;
  };
  /** The business's own date, already formatted. */
  preparedOn: string;
  facts: { label: string; answer: string | null }[];
  questions: {
    number: number;
    text: string;
    context: string;
    note: string | null;
    answer: string | null;
    /** Already formatted. */
    answeredOn: string | null;
  }[];
};

const C = brand.emailColors;
const HAIRLINE = "#e2e1ea";
const SUNKEN = "#f4f4f8";
const RULE = "#c9c8d4";
const WRITING_LINES = 3;

const s = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, fontSize: 10, color: C.ink, paddingTop: 44, paddingBottom: 56, paddingHorizontal: 40 },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, height: 8, backgroundColor: C.ink },
  accentTick: { position: "absolute", top: 0, left: 40, width: 56, height: 8, backgroundColor: C.accent },
  row: { flexDirection: "row", justifyContent: "space-between" },
  muted: { color: C.muted },
  strong: { fontWeight: 600 },
  label: { fontSize: 7.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3, fontWeight: 600 },
  title: { fontSize: 18, fontWeight: 600, color: C.accent, marginTop: 4 },
  section: { marginTop: 20 },
  heading: { fontSize: 11, fontWeight: 600, marginBottom: 6 },
  factRow: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 0.5, borderBottomColor: HAIRLINE, paddingVertical: 5, paddingHorizontal: 6 },
  factLabel: { flex: 1, paddingRight: 12 },
  factAnswer: { width: 190, textAlign: "right", fontWeight: 600 },
  question: { marginTop: 14, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: HAIRLINE },
  questionText: { fontWeight: 600, fontSize: 10.5 },
  context: { marginTop: 2, color: C.muted, fontSize: 9 },
  noteBox: { marginTop: 8, padding: 8, backgroundColor: SUNKEN, borderRadius: 3 },
  answerBox: { marginTop: 8 },
  line: { height: 18, borderBottomWidth: 0.75, borderBottomColor: RULE },
  footer: { position: "absolute", bottom: 22, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: C.muted, borderTopWidth: 0.5, borderTopColor: HAIRLINE, paddingTop: 6 },
});

/** The worksheet: the business, its facts, then each question with the owner's note and room for (or the text of) the answer. */
export function QuestionnairePdf({ title, answerLabel, business, preparedOn, facts, questions }: QuestionnairePdfProps) {
  return (
    <Document title={title} author={business.name} creator={brand.name} producer={brand.name}>
      <Page size="A4" style={s.page}>
        <View style={s.topBar} fixed />
        <View style={s.accentTick} fixed />

        <View style={s.row}>
          <View style={{ maxWidth: 300 }}>
            <Text style={s.label}>Prepared for</Text>
            <Text style={[s.strong, { fontSize: 13 }]}>{business.name}</Text>
            {business.taxId && <Text style={s.muted}>{`${business.taxId.label} ${business.taxId.value}`}</Text>}
            {business.office && <Text style={s.muted}>{`${business.office.label} ${business.office.value}`}</Text>}
          </View>
          <View style={{ maxWidth: 220 }}>
            <Text style={[s.label, { textAlign: "right" }]}>Prepared on</Text>
            <Text style={{ textAlign: "right" }}>{preparedOn}</Text>
          </View>
        </View>

        <Text style={s.title}>{title}</Text>

        {facts.length > 0 && (
          <View style={s.section}>
            <Text style={s.heading}>About the business</Text>
            {facts.map((fact) => (
              <View key={fact.label} style={s.factRow} wrap={false}>
                <Text style={s.factLabel}>{fact.label}</Text>
                <Text style={[s.factAnswer, fact.answer ? {} : { color: C.muted, fontWeight: 400 }]}>{fact.answer ?? "Not answered"}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.section}>
          <Text style={s.heading}>Questions</Text>
          {questions.map((question) => (
            <View key={question.number} style={s.question} wrap={false}>
              <View wrap={false}>
                <Text style={s.questionText}>{`${question.number}. ${question.text}`}</Text>
                <Text style={s.context}>{question.context}</Text>
              </View>
              {question.note && (
                <View style={s.noteBox}>
                  <Text style={s.label}>Your note</Text>
                  <Text>{question.note}</Text>
                </View>
              )}
              <View style={s.answerBox}>
                <Text style={s.label}>{answerLabel}</Text>
                {question.answer ? (
                  <>
                    <Text>{question.answer}</Text>
                    {question.answeredOn && <Text style={[s.muted, { marginTop: 3 }]}>{`Told on ${question.answeredOn}`}</Text>}
                  </>
                ) : (
                  Array.from({ length: WRITING_LINES }, (_, i) => <View key={i} style={s.line} />)
                )}
              </View>
            </View>
          ))}
        </View>

        <View style={s.footer} fixed>
          <Text>{`${business.name} · Prepared with ${brand.name}. Not legal or tax advice.`}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
