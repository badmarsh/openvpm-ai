import { describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ getDocument: vi.fn() }));
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => mock);
import { extractPdfText } from "../pdf-invoice-parser";
describe("pdfjs resource lifetime", () => {
  it.each(["PasswordException", "InvalidPDFException"])("destroys loading task when %s rejects before a document exists", async name => {
    const destroy = vi.fn(async () => {});
    mock.getDocument.mockImplementation(() => ({ promise: Promise.reject({ name }), destroy }));
    await expect(extractPdfText(Buffer.from("pdf"))).rejects.toThrow(name === "PasswordException" ? "PDF_PASSWORD_PROTECTED" : "PDF_CORRUPTED");
    expect(destroy).toHaveBeenCalledOnce();
  });
  it("cleans page and task when text extraction fails", async () => {
    const cleanup = vi.fn();
    const destroy = vi.fn(async () => {});
    mock.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 1, getPage: async () => ({ cleanup, getTextContent: async () => { throw new Error("broken stream"); } }) }), destroy });
    await expect(extractPdfText(Buffer.from("pdf"))).rejects.toThrow("PDF_CORRUPTED");
    expect(cleanup).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
  });
});
