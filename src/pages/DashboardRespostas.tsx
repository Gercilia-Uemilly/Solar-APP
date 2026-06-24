import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Clock, Inbox, TrendingUp, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

type OficioRow = { id: string; numero: string; secretaria_identificada: string | null; created_at: string; respondido_em: string | null; total_respostas: number | null };
type RespostaRow = { id: string; oficio_id: string; arquivo_nome: string; resumo_ia: string | null; orgao_respondente: string | null; created_at: string };

function diffDays(a: string, b: string) {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)));
}

export default function DashboardRespostas() {
  const [oficios, setOficios] = useState<OficioRow[]>([]);
  const [respostas, setRespostas] = useState<RespostaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: ofs }, { data: rps }] = await Promise.all([
        (supabase.from("oficios") as any).select("id, numero, secretaria_identificada, created_at, respondido_em, total_respostas").limit(5000),
        (supabase.from("oficio_respostas") as any).select("id, oficio_id, arquivo_nome, resumo_ia, orgao_respondente, created_at").order("created_at", { ascending: false }).limit(2000),
      ]);
      setOficios((ofs as OficioRow[]) || []);
      setRespostas((rps as RespostaRow[]) || []);
      setLoading(false);
    })();
  }, []);

  // Score por secretaria
  const bySec = new Map<string, { total: number; respondidos: number; tempoDias: number[] }>();
  for (const o of oficios) {
    const k = o.secretaria_identificada || "Sem secretaria";
    if (!bySec.has(k)) bySec.set(k, { total: 0, respondidos: 0, tempoDias: [] });
    const e = bySec.get(k)!;
    e.total++;
    if ((o.total_respostas || 0) > 0 || o.respondido_em) {
      e.respondidos++;
      if (o.respondido_em) e.tempoDias.push(diffDays(o.created_at, o.respondido_em));
    }
  }
  const scoreRows = Array.from(bySec.entries())
    .map(([sec, v]) => ({
      sec,
      total: v.total,
      respondidos: v.respondidos,
      taxa: v.total ? Math.round((v.respondidos / v.total) * 100) : 0,
      tempoMedio: v.tempoDias.length ? Math.round(v.tempoDias.reduce((a, b) => a + b, 0) / v.tempoDias.length) : null,
    }))
    .filter(r => r.total >= 1)
    .sort((a, b) => b.taxa - a.taxa || (a.tempoMedio ?? 999) - (b.tempoMedio ?? 999));

  const totalOf = oficios.length;
  const totalResp = oficios.filter(o => (o.total_respostas || 0) > 0).length;
  const taxaGlobal = totalOf ? Math.round((totalResp / totalOf) * 100) : 0;
  const todasMedias = scoreRows.flatMap(r => r.tempoMedio != null ? [r.tempoMedio] : []);
  const tempoMedioGlobal = todasMedias.length ? Math.round(todasMedias.reduce((a, b) => a + b, 0) / todasMedias.length) : 0;

  // Busca por conteúdo
  const q = query.trim().toLowerCase();
  const filteredResp = !q ? respostas.slice(0, 50) : respostas.filter(r =>
    (r.arquivo_nome || "").toLowerCase().includes(q) ||
    (r.resumo_ia || "").toLowerCase().includes(q) ||
    (r.orgao_respondente || "").toLowerCase().includes(q)
  ).slice(0, 100);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><BarChart3 size={22} /> Dashboard de Respostas</h1>
        <p className="text-sm text-muted-foreground mt-1">Taxa de atendimento, tempo médio e ranking por secretaria.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Card icon={<Inbox size={18} />} label="Ofícios" value={totalOf.toString()} />
            <Card icon={<TrendingUp size={18} />} label="Com resposta" value={totalResp.toString()} />
            <Card icon={<BarChart3 size={18} />} label="Taxa global" value={`${taxaGlobal}%`} />
            <Card icon={<Clock size={18} />} label="Tempo médio" value={`${tempoMedioGlobal} d`} />
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-sm font-semibold mb-3">📋 Ranking por Secretaria</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="text-left py-2">Secretaria</th>
                    <th className="text-right py-2">Ofícios</th>
                    <th className="text-right py-2">Respondidos</th>
                    <th className="text-right py-2">Taxa</th>
                    <th className="text-right py-2">Tempo médio</th>
                  </tr>
                </thead>
                <tbody>
                  {scoreRows.map(r => (
                    <tr key={r.sec} className="border-b border-border/50">
                      <td className="py-2">{r.sec}</td>
                      <td className="py-2 text-right">{r.total}</td>
                      <td className="py-2 text-right">{r.respondidos}</td>
                      <td className="py-2 text-right">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.taxa >= 70 ? "bg-emerald-500/15 text-emerald-700" : r.taxa >= 40 ? "bg-amber-500/15 text-amber-700" : "bg-destructive/15 text-destructive"}`}>{r.taxa}%</span>
                      </td>
                      <td className="py-2 text-right">{r.tempoMedio != null ? `${r.tempoMedio} d` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2"><Search size={14} /> 🗂️ Arquivo de Respostas (busca por nome, órgão ou resumo)</h2>
            <Input placeholder="Buscar por palavra-chave..." value={query} onChange={e => setQuery(e.target.value)} />
            <div className="max-h-[500px] overflow-y-auto divide-y divide-border">
              {filteredResp.map(r => (
                <div key={r.id} className="py-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium truncate">{r.arquivo_nome}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                  {r.orgao_respondente && <p className="text-xs text-muted-foreground">{r.orgao_respondente}</p>}
                  {r.resumo_ia && <p className="text-xs mt-1 line-clamp-2">{r.resumo_ia}</p>}
                </div>
              ))}
              {filteredResp.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma resposta encontrada.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Card({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon} {label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}