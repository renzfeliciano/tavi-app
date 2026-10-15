import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { marketFor } from "@/config/markets";
import { saveQuestionnaireAction } from "./actions";
import { type QuestionnaireCopy, QuestionnaireForm } from "./questionnaire-form";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("./actions", () => ({ saveQuestionnaireAction: vi.fn() }));

const { toast } = await import("sonner");

const wording = marketFor("PH").registration!.questionnaire;
const copy: QuestionnaireCopy = {
  title: wording.title,
  facts: wording.facts.map((f) => ({ code: f.code, label: f.label, hint: f.hint, options: f.options.map((o) => ({ ...o })) })),
  questions: wording.questions.map((q) => ({ ...q })),
};
const empty = { facts: {}, questions: {} };
const PDF = "/settings/questions/pdf";

beforeEach(() => vi.clearAllMocks());

describe("the worksheet form", () => {
  it("offers each fact as a labelled list with 'Not answered' first", () => {
    render(<QuestionnaireForm initial={empty} copy={copy} editable pdfHref={PDF} />);
    const select = screen.getByLabelText(/Your sales in the last 12 months/);
    expect([...select.querySelectorAll("option")].map((o) => o.textContent)).toEqual([
      "Not answered",
      "Under ₱3 million",
      "₱3 million to ₱20 million",
      "Over ₱20 million",
      "Not sure",
    ]);
  });

  it("lists every question numbered, with an example in each empty field", () => {
    render(<QuestionnaireForm initial={empty} copy={copy} editable pdfHref={PDF} />);
    expect(screen.getAllByRole("listitem").filter((li) => li.dataset.question)).toHaveLength(copy.questions.length);
    for (const note of screen.getAllByLabelText(/^Your note/)) expect(note.getAttribute("placeholder")).toMatch(/^e\.g\. /);
    for (const answer of screen.getAllByLabelText(/^What you were told/)) expect(answer.getAttribute("placeholder")).toMatch(/^e\.g\. /);
  });

  it("marks a question answered once an answer is saved", () => {
    render(
      <QuestionnaireForm
        initial={{ facts: {}, questions: { withholding: { note: "", answer: "Yes", answeredOn: "2026-10-01" } } }}
        copy={copy}
        editable
        pdfHref={PDF}
      />,
    );
    const answered = screen.getAllByText("Answered");
    expect(answered).toHaveLength(1);
    expect(screen.getAllByText("Not asked yet")).toHaveLength(copy.questions.length - 1);
  });

  it("says changes are unsaved once a field is edited", () => {
    render(<QuestionnaireForm initial={empty} copy={copy} editable pdfHref={PDF} />);
    expect(screen.getByRole("status")).toHaveTextContent("No changes yet");
    fireEvent.change(screen.getAllByLabelText(/^Your note/)[0]!, { target: { value: "Ask on Monday" } });
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes");
  });

  it("puts the PDF download beside the form, not inside it", () => {
    render(<QuestionnaireForm initial={empty} copy={copy} editable pdfHref={PDF} />);
    const link = screen.getByRole("link", { name: /Download PDF/ });
    expect(link).toHaveAttribute("href", PDF);
    expect(link.closest("form")).toBeNull();
  });

  it("has no save bar for someone who cannot edit, but keeps the download", () => {
    render(<QuestionnaireForm initial={empty} copy={copy} editable={false} pdfHref={PDF} />);
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Download PDF/ })).toBeInTheDocument();
  });

  it("shows a field problem beside its field and keeps what was typed", async () => {
    vi.mocked(saveQuestionnaireAction).mockResolvedValue({
      values: { facts: {}, questions: { withholding: { note: "", answer: "Yes", answeredOn: "2026-10-30" } } },
      errors: { "questions.withholding.answeredOn": "That date is in the future." },
    });
    const { container } = render(<QuestionnaireForm initial={empty} copy={copy} editable pdfHref={PDF} />);
    const withholding = screen.getAllByLabelText(/^What you were told/)[copy.questions.findIndex((q) => q.code === "withholding")]!;
    fireEvent.change(withholding, { target: { value: "Yes" } });
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    await waitFor(() => expect(screen.getByText("That date is in the future.")).toBeInTheDocument());
    expect(screen.getByDisplayValue("Yes")).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("keeps a fact choice after a save that was refused", async () => {
    vi.mocked(saveQuestionnaireAction).mockResolvedValue({
      values: { facts: { salesBand: "3m_to_20m" }, questions: { withholding: { note: "", answer: "Yes", answeredOn: "2099-01-01" } } },
      errors: { "questions.withholding.answeredOn": "That date is in the future." },
      submittedAt: 1,
    });
    const { container } = render(<QuestionnaireForm initial={empty} copy={copy} editable pdfHref={PDF} />);
    fireEvent.change(screen.getByLabelText(/Your sales in the last 12 months/), { target: { value: "3m_to_20m" } });
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    await waitFor(() => expect(screen.getByText("That date is in the future.")).toBeInTheDocument());
    expect(screen.getByLabelText(/Your sales in the last 12 months/)).toHaveValue("3m_to_20m");
  });

  it("shows what was saved, not what was typed, once the server answers", async () => {
    // A date with no answer is dropped by the server: the form must not go on showing it.
    vi.mocked(saveQuestionnaireAction).mockResolvedValue({
      values: { facts: {}, questions: { withholding: { note: "Ask", answer: "", answeredOn: "" } } },
      savedAt: 2,
      submittedAt: 2,
    });
    const { container } = render(<QuestionnaireForm initial={empty} copy={copy} editable pdfHref={PDF} />);
    const index = copy.questions.findIndex((q) => q.code === "withholding");
    fireEvent.change(screen.getAllByLabelText(/^Told on/)[index]!, { target: { value: "2026-10-01" } });
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(screen.getAllByLabelText(/^Told on/)[index]).toHaveValue("");
  });

  it("groups each question's fields under the question, so a screen reader can tell them apart", () => {
    render(<QuestionnaireForm initial={empty} copy={copy} editable pdfHref={PDF} />);
    for (const question of copy.questions) {
      expect(screen.getByRole("group", { name: new RegExp(question.text.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })).toBeInTheDocument();
    }
  });

  it("says it saved", async () => {
    vi.mocked(saveQuestionnaireAction).mockResolvedValue({ values: empty, savedAt: 1 });
    const { container } = render(<QuestionnaireForm initial={empty} copy={copy} editable pdfHref={PDF} />);
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Worksheet saved."));
  });
});
