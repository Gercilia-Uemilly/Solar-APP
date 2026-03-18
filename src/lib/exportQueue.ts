import { toast } from "sonner";

interface QueueItem {
  fn: () => Promise<void>;
  resolve: () => void;
  reject: (err: any) => void;
  label: string;
}

const fila: QueueItem[] = [];
let emAndamento = false;

async function processarFila() {
  if (emAndamento || fila.length === 0) return;
  emAndamento = true;
  const { fn, resolve, reject, label } = fila.shift()!;
  const toastId = "export-queue";
  try {
    toast.loading(`Gerando ${label}...`, { id: toastId });
    await fn();
    toast.success(`✅ ${label} pronto!`, { id: toastId });
    resolve();
  } catch (err: any) {
    toast.error(`Erro ao gerar ${label}`, { id: toastId, description: err?.message });
    reject(err);
  } finally {
    emAndamento = false;
    processarFila();
  }
}

/**
 * Enqueue an export operation to prevent concurrent exports from crashing.
 */
export function enqueueExport(label: string, fn: () => Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    fila.push({ fn, resolve, reject, label });
    processarFila();
  });
}
