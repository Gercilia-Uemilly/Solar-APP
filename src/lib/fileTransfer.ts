/** Match the same file types offered by the device picker. */
export function acceptsFile(file: Pick<File, "name" | "type">, accept: string): boolean {
  if (!accept.trim()) return true;
  return accept.toLowerCase().split(",").some(value => {
    const rule = value.trim();
    if (!rule) return false;
    if (rule.startsWith(".")) return file.name.toLowerCase().endsWith(rule);
    if (rule.endsWith("/*")) return file.type.toLowerCase().startsWith(rule.slice(0, -1));
    return file.type.toLowerCase() === rule;
  });
}

export function transferFilesToInput(input: HTMLInputElement, files: File[]): boolean {
  if (input.disabled || input.closest('[data-file-upload-disabled="true"]')) return false;
  const accepted = files.filter(file => acceptsFile(file, input.accept));
  if (!accepted.length) return false;
  const transfer = new DataTransfer();
  (input.multiple ? accepted : accepted.slice(0, 1)).forEach(file => transfer.items.add(file));
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}