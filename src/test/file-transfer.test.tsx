import { render, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFileTransfer } from "@/hooks/useFileTransfer";
import { acceptsFile, transferFilesToInput } from "@/lib/fileTransfer";

function Harness() {
  useFileTransfer();
  return <><div data-file-upload tabIndex={0} aria-label="PDF"><input type="file" accept=".pdf" multiple /></div>
    <div data-file-upload tabIndex={0} aria-label="Images"><input type="file" accept="image/*" /></div>
    <textarea aria-label="Text" /></>;
}
beforeEach(() => {
  vi.spyOn(Element.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  vi.stubGlobal("DataTransfer", class {
    files: File[] = [];
    items = { add: (file: File) => { this.files.push(file); } };
  });
  vi.spyOn(HTMLInputElement.prototype, "files", "set").mockImplementation(function(files) {
    Object.defineProperty(this, "files", { configurable: true, value: files });
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const pdf = () => new File(["pdf"], "response.pdf", { type: "application/pdf" });

describe("file transfers", () => {
  it("accepts PDF extensions without a MIME type and rejects an image for PDF-only uploads", () => {
    expect(acceptsFile({ name: "ANSWER.PDF", type: "" }, ".pdf")).toBe(true);
    expect(acceptsFile({ name: "photo.png", type: "image/png" }, ".pdf")).toBe(false);
  });
  it("pastes once into the chosen area, not into other upload areas", () => {
    const view = render(<Harness />);
    const area = view.getByLabelText("PDF");
    const changed = vi.fn();
    area.querySelector("input")?.addEventListener("change", changed);
    fireEvent.paste(area, { clipboardData: { files: [pdf(), pdf()] } });
    expect(changed).toHaveBeenCalledTimes(1);
    expect(area.querySelector("input")?.files?.length).toBe(2);
    expect(view.getByLabelText("Images").querySelector("input")?.files?.length).toBe(0);
  });
  it("preserves text paste", () => {
    const view = render(<Harness />);
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: { files: [] } });
    view.getByLabelText("Text").dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
  it("pastes multiple images from the description into the only compatible upload", () => {
    const view = render(<Harness />);
    const input = view.getByLabelText("Images").querySelector("input");
    if (!input) throw new Error("Missing input");
    input.multiple = true;
    const images = [new File(["a"], "a.png", { type: "image/png" }), new File(["b"], "b.png", { type: "image/png" })];
    fireEvent.paste(view.getByLabelText("Text"), { clipboardData: { files: images } });
    expect(input.files?.length).toBe(2);
    fireEvent.paste(view.getByLabelText("Text"), { clipboardData: { files: [images[0]] } });
    expect(input.files?.length).toBe(1);
  });
  it("does not choose arbitrarily between two compatible areas", () => {
    const view = render(<Harness />);
    const area = view.getByLabelText("Images");
    area.querySelector("input")?.setAttribute("accept", ".pdf");
    fireEvent.paste(document.body, { clipboardData: { files: [pdf()] } });
    expect(view.getByLabelText("PDF").querySelector("input")?.files?.length).toBe(0);
  });
  it("drops into the existing upload input", () => {
    const view = render(<Harness />);
    fireEvent.drop(view.getByLabelText("PDF"), { dataTransfer: { files: [pdf()] } });
    expect(view.getByLabelText("PDF").querySelector("input")?.files?.length).toBe(1);
  });
  it("does not duplicate a drop already processed by a local handler", () => {
    const view = render(<Harness />);
    const area = view.getByLabelText("PDF");
    area.addEventListener("drop", event => event.preventDefault());
    fireEvent.drop(area, { dataTransfer: { files: [pdf()] } });
    expect(area.querySelector("input")?.files?.length).toBe(0);
  });
  it("respects disabled upload areas and single-file inputs", () => {
    const view = render(<Harness />);
    const area = view.getByLabelText("PDF");
    const input = area.querySelector("input");
    if (!input) throw new Error("Missing input");
    area.setAttribute("data-file-upload-disabled", "true");
    expect(transferFilesToInput(input, [pdf()])).toBe(false);
    area.removeAttribute("data-file-upload-disabled");
    input.multiple = false;
    expect(transferFilesToInput(input, [pdf(), pdf()])).toBe(true);
    expect(input.files?.length).toBe(1);
  });
});