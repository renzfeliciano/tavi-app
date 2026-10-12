import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentsCard, type DocumentRow } from "./documents-card";

const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
const removeDocumentAction = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast }));
vi.mock("./actions", () => ({ removeDocumentAction, uploadDocumentAction: vi.fn() }));

const kinds = [
  { code: "cor", label: "BIR Certificate of Registration (2303)" },
  { code: "name_registration", label: "DTI, SEC or CDA certificate" },
];
const doc: DocumentRow = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "cor",
  fileName: "COR 2303.pdf",
  contentType: "application/pdf",
  byteSize: 250_000,
  addedOn: "Oct 12, 2026",
};

beforeEach(() => vi.clearAllMocks());

describe("DocumentsCard", () => {
  it("lists each certificate with its kind, size and a way to open it", () => {
    render(<DocumentsCard documents={[doc]} kinds={kinds} editable />);
    expect(screen.getByText("BIR Certificate of Registration (2303)", { selector: "p" })).toBeTruthy();
    expect(screen.getByText(/COR 2303.pdf · 244 KB · added Oct 12, 2026/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open COR 2303.pdf" }).getAttribute("href")).toBe(`/api/files/${doc.id}`);
  });

  it("says what it's for when empty", () => {
    render(<DocumentsCard documents={[]} kinds={kinds} editable />);
    expect(screen.getByText(/Nothing here yet/)).toBeTruthy();
  });

  it("asks before removing, then removes", async () => {
    removeDocumentAction.mockResolvedValue({ ok: true });
    render(<DocumentsCard documents={[doc]} kinds={kinds} editable />);
    fireEvent.click(screen.getByRole("button", { name: "Remove COR 2303.pdf" }));
    expect(removeDocumentAction).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(removeDocumentAction).toHaveBeenCalledWith(doc.id));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Document removed."));
  });

  it("shows the reason when a removal fails", async () => {
    removeDocumentAction.mockResolvedValue({ ok: false, error: "That document is already gone." });
    render(<DocumentsCard documents={[doc]} kinds={kinds} editable />);
    fireEvent.click(screen.getByRole("button", { name: "Remove COR 2303.pdf" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(await screen.findByText("That document is already gone.")).toBeTruthy();
  });

  it("offers no upload or removal to someone who can't change them", () => {
    render(<DocumentsCard documents={[doc]} kinds={kinds} editable={false} />);
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Choose file" })).toBeNull();
  });

  it("stops offering uploads at the limit", () => {
    const eight = Array.from({ length: 8 }, (_, i) => ({ ...doc, id: `22222222-2222-4222-8222-22222222222${i}`, fileName: `d${i}.pdf` }));
    render(<DocumentsCard documents={eight} kinds={kinds} editable />);
    expect((screen.getByRole("button", { name: "Choose file" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/up to 8 documents/)).toBeTruthy();
  });
});
