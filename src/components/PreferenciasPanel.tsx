import { useState, useEffect } from "react";
import { usePreferencias, Preferencias } from "@/hooks/usePreferencias";
import { Button } from "@/components/ui/button";
import { Palette, Save, Loader2, Type, PanelLeft, LayoutGrid } from "lucide-react";
import { toast } from "sonner";

const TEMAS = [
  { value: "escuro", label: "Escuro", desc: "Tema escuro padrão" },
  { value: "claro", label: "Claro Minimalista", desc: "Fundo branco, leitura suave" },
  { value: "alto-contraste", label: "Alto Contraste", desc: "Acessibilidade máxima" },
];

const CORES = [
  { value: "#1B3A6B", label: "Azul", bg: "bg-blue-700" },
  { value: "#166534", label: "Verde", bg: "bg-green-800" },
  { value: "#7f1d1d", label: "Vinho", bg: "bg-red-900" },
  { value: "#1e1e2e", label: "Grafite", bg: "bg-zinc-800" },
  { value: "#4c1d95", label: "Roxo", bg: "bg-purple-900" },
];

const FONTES = [
  { value: "pequeno", label: "A-", desc: "Pequeno" },
  { value: "medio", label: "A", desc: "Normal" },
  { value: "grande", label: "A+", desc: "Grande" },
  { value: "extragrande", label: "A++", desc: "Extra grande" },
];

const DENSIDADES = [
  { value: "confortavel", label: "Confortável" },
  { value: "normal", label: "Normal" },
  { value: "compacto", label: "Compacto" },
];

export default function PreferenciasPanel() {
  const { prefs, loading, salvar } = usePreferencias();
  const [local, setLocal] = useState<Preferencias>(prefs);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocal(prefs);
  }, [prefs]);

  const handleSave = async () => {
    setSaving(true);
    await salvar(local);
    toast.success("Preferências salvas!");
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 flex justify-center">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-6">
      <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
        <Palette size={16} className="text-primary" /> Personalizar Interface
      </h3>

      {/* Tema */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Tema</label>
        <div className="grid gap-2">
          {TEMAS.map((t) => (
            <label
              key={t.value}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                local.tema === t.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/30"
              }`}
            >
              <input
                type="radio"
                name="tema"
                value={t.value}
                checked={local.tema === t.value}
                onChange={() => setLocal({ ...local, tema: t.value })}
                className="accent-primary"
              />
              <div>
                <span className="text-sm font-medium text-foreground">{t.label}</span>
                <p className="text-xs text-muted-foreground">{t.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Cor primária */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Cor principal</label>
        <div className="flex flex-wrap gap-2">
          {CORES.map((c) => (
            <button
              key={c.value}
              onClick={() => setLocal({ ...local, cor_primaria: c.value })}
              className={`w-10 h-10 rounded-lg ${c.bg} border-2 transition-all ${
                local.cor_primaria === c.value ? "border-white scale-110 ring-2 ring-primary" : "border-transparent"
              }`}
              title={c.label}
            />
          ))}
          <label className="w-10 h-10 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors overflow-hidden" title="Cor personalizada">
            <input
              type="color"
              value={local.cor_primaria}
              onChange={(e) => setLocal({ ...local, cor_primaria: e.target.value })}
              className="w-12 h-12 cursor-pointer border-none -m-1"
            />
          </label>
        </div>
      </div>

      {/* Tamanho de fonte */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Type size={14} /> Tamanho do texto
        </label>
        <div className="flex gap-2">
          {FONTES.map((f) => (
            <button
              key={f.value}
              onClick={() => setLocal({ ...local, tamanho_fonte: f.value })}
              className={`flex-1 py-2 px-3 rounded-lg border text-center transition-colors ${
                local.tamanho_fonte === f.value
                  ? "border-primary bg-primary/10 text-primary font-bold"
                  : "border-border text-muted-foreground hover:border-primary/30"
              }`}
            >
              <span className="text-sm">{f.label}</span>
              <p className="text-[10px] mt-0.5">{f.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <PanelLeft size={14} /> Menu lateral
        </label>
        <div className="flex gap-2">
          <label
            className={`flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
              !local.sidebar_compacta ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
            }`}
          >
            <input type="radio" checked={!local.sidebar_compacta} onChange={() => setLocal({ ...local, sidebar_compacta: false })} className="accent-primary" />
            <span className="text-sm text-foreground">Expandido</span>
          </label>
          <label
            className={`flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
              local.sidebar_compacta ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
            }`}
          >
            <input type="radio" checked={local.sidebar_compacta} onChange={() => setLocal({ ...local, sidebar_compacta: true })} className="accent-primary" />
            <span className="text-sm text-foreground">Compacto</span>
          </label>
        </div>
      </div>

      {/* Densidade */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <LayoutGrid size={14} /> Densidade
        </label>
        <div className="flex gap-2">
          {DENSIDADES.map((d) => (
            <button
              key={d.value}
              onClick={() => setLocal({ ...local, densidade: d.value })}
              className={`flex-1 py-2 px-3 rounded-lg border text-sm transition-colors ${
                local.densidade === d.value
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border text-muted-foreground hover:border-primary/30"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full bg-primary text-primary-foreground">
        {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
        Salvar preferências
      </Button>
    </div>
  );
}
