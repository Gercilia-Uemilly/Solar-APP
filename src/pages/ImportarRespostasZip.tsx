import { useState } from "react";
import JSZip from "jszip";
import { Loader2, Upload, CheckCircle2, AlertCircle, FileArchive, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { uploadRespostaArquivo } from "@/hooks/useRespostas";

type Row = {
  filename: string;
  numero: string | null;
  status: "queued" | "uploading" | "matched" | "not_found" | "error" | "done";
  oficioId?: string;
  oficioNumero?: string;
  error?: string;
};

function extractNumero(filename: string): string | null {
  // Examples: "1059-2026 R13947.pdf", "482.2026 R33352.pdf", "500-2026 R10821p (1).pdf"
  const m = filename.match(/^(\d{1,5})[.\-_ ]?(\d{4})/);
  if (!m) return null;
  return `${m[1]}/${m[2]}`;
}

export default function ImportarRespostasZip() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [processing, setProcessing] = useState(false);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [loadingBatch, setLoadingBatch] = useState<string | null>(null);

  const PREPARED_BATCHES = Array.from({ length: 10 }, (_, i) => `c0${i}.zip`);

  const loadPreparedBatch = async (path: string) => {
    try {
      setLoadingBatch(path);
      const { data, error } = await supabase.storage.from("import-zips").download(path);
      if (error || !data) throw error || new Error("Arquivo não encontrado");
      const file = new File([data], path, { type: "application/zip" });
      await handleZip(file);
      toast({ title: `Lote ${path} carregado`, description: "Clique em Importar para processar." });
    } catch (e: any) {
      toast({ title: "Falha ao carregar lote", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setLoadingBatch(null);
    }
  };

  const handleZip = async (file: File) => {
    setZipFile(file);
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const list: Row[] = [];
    zip.forEach((_path, entry) => {
      if (entry.dir) return;
      const name = entry.name.split("/").pop() || entry.name;
      const lower = name.toLowerCase();
      if (!lower.endsWith(".pdf") && !lower.endsWith(".docx") && !lower.endsWith(".jpg") && !lower.endsWith(".png")) return;
      list.push({ filename: name, numero: extractNumero(name), status: "queued" });
    });
    list.sort((a, b) => a.filename.localeCompare(b.filename));
    setRows(list);
  };

  const processAll = async () => {
    if (!zipFile || !user) return;
    setProcessing(true);
    const zip = await JSZip.loadAsync(await zipFile.arrayBuffer());
    const userName = user.user_metadata?.full_name || user.email || "Operador";
    const next = [...rows];
    for (let i = 0; i < next.length; i++) {
      const r = next[i];
      if (r.status === "done") continue;
      next[i] = { ...r, status: "uploading" };
      setRows([...next]);
      try {
        if (!r.numero) { next[i] = { ...r, status: "not_found", error: "Número não identificado" }; setRows([...next]); continue; }
        // Find oficio by EXACT numero match (ex: "193/2026" não pode casar com "1193/2026").
        const [numStr, anoStr] = r.numero.split("/");
        const { data: candidates } = await (supabase.from("oficios") as any)
          .select("id, numero")
          .ilike("numero", `%${numStr}/${anoStr}%`)
          .is("deleted_at", null)
          .limit(50);
        const oficio = (candidates || []).find((o: any) => {
          const m = String(o.numero || "").match(/(\d+)\/(\d{4})/);
          return m && m[1] === numStr && m[2] === anoStr;
        });
        if (!oficio) {
          next[i] = { ...r, status: "not_found", error: `Ofício ${r.numero} não encontrado` };
          setRows([...next]);
          continue;
        }
        // Find file inside zip
        let entry: any = null;
        zip.forEach((_p, e) => { if (!entry && (e.name.split("/").pop() === r.filename)) entry = e; });
        if (!entry) { next[i] = { ...r, status: "error", error: "Entry não encontrada no ZIP" }; setRows([...next]); continue; }
        const blob = await entry.async("blob");
        const file = new File([blob], r.filename, { type: r.filename.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream" });
        await uploadRespostaArquivo(oficio.id, file, user.id, userName);
        next[i] = { ...r, status: "done", oficioId: oficio.id, oficioNumero: oficio.numero };
        setRows([...next]);
      } catch (e: any) {
        next[i] = { ...r, status: "error", error: e?.message || "Falha" };
        setRows([...next]);
      }
    }
    setProcessing(false);
    const ok = next.filter(r => r.status === "done").length;
    const nf = next.filter(r => r.status === "not_found").length;
    toast({ title: `${ok} resposta(s) importadas`, description: nf > 0 ? `${nf} ofício(s) não encontrados.` : undefined });
  };

  const summary = {
    total: rows.length,
    matched: rows.filter(r => r.numero).length,
    notFound: rows.filter(r => r.status === "not_found").length,
    done: rows.filter(r => r.status === "done").length,
    error: rows.filter(r => r.status === "error").length,
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><FileArchive size={22} /> Importar Respostas em Lote (ZIP)</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Envie um arquivo .zip contendo os PDFs de resposta. O sistema identifica o ofício pelo número no início do nome do arquivo (ex: <code>1059-2026 R13947.pdf</code> → ofício 1059/2026).
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold">📦 Lotes prontos no servidor (292 PDFs)</p>
            <p className="text-xs text-muted-foreground">Respostas extraídas do arquivo .rar e organizadas em 10 lotes. Carregue um lote por vez e clique em Importar.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {PREPARED_BATCHES.map((p) => (
              <Button
                key={p}
                variant="outline"
                size="sm"
                disabled={loadingBatch === p || processing}
                onClick={() => loadPreparedBatch(p)}
              >
                {loadingBatch === p ? <Loader2 className="animate-spin mr-2" size={14} /> : <Download size={14} className="mr-2" />}
                {p}
              </Button>
            ))}
          </div>
        </div>

        <label className="block border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-accent/30">
          <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Selecione o arquivo ZIP</p>
          <p className="text-xs text-muted-foreground mt-1">Apenas .zip com PDFs/DOCX/imagens</p>
          <input
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleZip(f); }}
          />
        </label>

        {rows.length > 0 && (
          <>
            <div className="grid grid-cols-5 gap-2 text-xs text-center">
              <div className="p-2 bg-muted rounded"><div className="font-bold text-lg">{summary.total}</div>Total</div>
              <div className="p-2 bg-blue-500/10 rounded"><div className="font-bold text-lg text-blue-600">{summary.matched}</div>Com nº</div>
              <div className="p-2 bg-emerald-500/10 rounded"><div className="font-bold text-lg text-emerald-600">{summary.done}</div>Importadas</div>
              <div className="p-2 bg-orange-500/10 rounded"><div className="font-bold text-lg text-orange-600">{summary.notFound}</div>Não encontrados</div>
              <div className="p-2 bg-destructive/10 rounded"><div className="font-bold text-lg text-destructive">{summary.error}</div>Erros</div>
            </div>

            <div className="max-h-[400px] overflow-y-auto border rounded">
              {rows.map((r, i) => (
                <div key={i} className="flex items-center gap-2 p-2 text-xs border-b last:border-0">
                  <span className="font-mono w-16 shrink-0">{r.numero || "—"}</span>
                  <span className="flex-1 truncate">{r.filename}</span>
                  {r.status === "uploading" && <Loader2 size={14} className="animate-spin" />}
                  {r.status === "done" && <CheckCircle2 size={14} className="text-emerald-600" />}
                  {r.status === "not_found" && <span className="text-orange-600 flex items-center gap-1"><AlertCircle size={12} /> não encontrado</span>}
                  {r.status === "error" && <span className="text-destructive flex items-center gap-1" title={r.error}><AlertCircle size={12} /> erro</span>}
                  {r.status === "queued" && <span className="text-muted-foreground">aguardando</span>}
                </div>
              ))}
            </div>

            <Button onClick={processAll} disabled={processing} className="bg-primary text-primary-foreground">
              {processing ? <><Loader2 className="animate-spin mr-2" size={14} /> Importando...</> : `Importar ${summary.matched} resposta(s)`}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}