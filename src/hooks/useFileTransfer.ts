import { useEffect } from "react";
import { toast } from "sonner";
import { acceptsFile, transferFilesToInput } from "@/lib/fileTransfer";

/** Route clipboard/drop files through existing upload handlers, once per event. */
export function useFileTransfer() {
  useEffect(() => {
    const visible = (element: Element) => element.getClientRects().length > 0;
    const inputsIn = (root: ParentNode) => Array.from(root.querySelectorAll<HTMLInputElement>(
      '[data-file-upload] input[type="file"]',
    )).filter(input => {
      const scope = input.closest('[data-file-upload]');
      return scope && visible(scope) && !input.disabled && !input.hasAttribute("capture")
        && !input.closest('[data-file-upload-disabled="true"]');
    });
    const chooseInput = (target: EventTarget | null, files: File[], fallback: boolean) => {
      const element = target instanceof Element ? target : null;
      if (element?.closest('[contenteditable="true"]')) return undefined;
      const scope = element?.closest('[data-file-upload]');
      if (scope) return inputsIn(scope.parentElement || scope).find(input =>
        input.closest('[data-file-upload]') === scope && files.some(file => acceptsFile(file, input.accept)));
      if (!fallback || element?.closest('input, textarea, [contenteditable="true"]')) return undefined;
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"]')).filter(visible);
      const root = dialogs.at(-1) || document;
      const candidates = inputsIn(root).filter(input => !input.closest('[data-file-upload-explicit]')
        && files.some(file => acceptsFile(file, input.accept)));
      return candidates.length === 1 ? candidates[0] : undefined;
    };
    const paste = (event: ClipboardEvent) => {
      if (event.defaultPrevented) return;
      const files = Array.from(event.clipboardData?.files || []);
      if (!files.length) return; // Leave ordinary text paste untouched.
      const input = chooseInput(event.target, files, true);
      if (!input) return;
      event.preventDefault();
      transferFilesToInput(input, files);
    };
    const dragOver = (event: DragEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-file-upload]')
        && event.dataTransfer?.types.includes("Files")) event.preventDefault();
    };
    const drop = (event: DragEvent) => {
      if (event.defaultPrevented) return; // Existing drop handler already consumed this event.
      const element = event.target instanceof Element ? event.target : null;
      if (!element?.closest('[data-file-upload]')) return;
      const files = Array.from(event.dataTransfer?.files || []);
      if (!files.length) return;
      event.preventDefault(); // Never navigate away to an unsupported dropped file.
      const input = chooseInput(event.target, files, false);
      if (input) transferFilesToInput(input, files);
      else toast.error("Este arquivo não é aceito nesta área ou há um envio em andamento.");
    };
    document.addEventListener("paste", paste);
    document.addEventListener("dragover", dragOver);
    document.addEventListener("drop", drop);
    return () => {
      document.removeEventListener("paste", paste);
      document.removeEventListener("dragover", dragOver);
      document.removeEventListener("drop", drop);
    };
  }, []);
}