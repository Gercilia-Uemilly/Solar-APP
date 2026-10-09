import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const cleanQuotedResponse = (text: string) => {
  let t = text.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("\u201c") && t.endsWith("\u201d"))) {
    t = t.slice(1, -1).trim();
  }
  t = t.replace(/^(Resposta:?\s*|Sugestão:?\s*)/i, "").trim();
  return t;
};

const scoreRelevance = (text: string, keywords: string[]): number => {
  if (!text) return 0;
  const lower = text.toLowerCase();
  return keywords.reduce((score, kw) => {
    if (!lower.includes(kw)) return score;
    if (kw.length > 6) return score + 3;
    if (kw.length > 4) return score + 2;
    return score + 1;
  }, 0);
};

// Material de campanha não entra como referência (a eleição acabou)
const CAMPANHA_RE = /santinho|43\.?999|\bvot[eo]s?\b|\bvotar\b|\bvotem\b|moldura|campanha/i;
// Para scripts o filtro é mais estreito: "campanha de vacinação" e "título de eleitor" são assuntos legítimos
const CAMPANHA_SCRIPT_RE = /santinho|43\.?999|moldura/i;

// ─── Relevância do modo contexto (bot) ───
// O bot responde sozinho, então aqui a busca é mais exigente que a do painel:
// compara palavra inteira (sem acento, sem plural), ignora palavras que não dizem o
// assunto, ignora nome de bairro e dá mais peso a palavra rara na base.
const semAcento = (t: string): string => (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const radical = (w: string): string => (w.length > 4 ? w.replace(/s$/, "") : w);
// "segunda-feira" não é feira
const palavrasDe = (t: string): string[] =>
  semAcento(t).replace(/\b(segunda|terca|quarta|quinta|sexta)[\s-]feira\b/g, " ").split(/[^a-z0-9]+/).filter(w => w.length > 2).map(radical);

const PALAVRAS_VAZIAS = new Set([
  "que", "com", "pra", "pro", "para", "por", "uma", "uns", "umas", "dos", "das", "nos", "nas", "meu", "minha", "meus", "minhas",
  "seu", "sua", "isso", "esse", "essa", "este", "esta", "aqui", "ali", "tem", "ter", "tenho", "estou", "sao",
  "foi", "ser", "nao", "sim", "mais", "muito", "muita", "como", "qual", "quais", "onde", "quando", "quem", "porque",
  "preciso", "precisa", "precisando", "quero", "queria", "gostaria", "saber", "pode", "poderia", "consigo", "conseguir", "fazer",
  "favor", "ola", "bom", "boa", "dia", "tarde", "noite", "fabao", "vereador", "deputado", "gente", "voce",
  "horario", "telefone", "endereco", "numero", "contato", "informacao", "rua", "avenida", "bairro", "casa", "tudo", "bem",
  "ajuda", "ajudar", "ainda", "tambem", "sobre", "teste",
  // palavras comuns em nome de bairro
  "santa", "santo", "sao", "jardim", "vila", "parque", "novo", "nova", "centro", "cidade", "residencial", "uberlandia",
].map(radical));

const palavrasFortes = (texto: string, bairros: Set<string>): string[] =>
  [...new Set(palavrasDe(texto).filter(w => w.length > 3 && !PALAVRAS_VAZIAS.has(w) && !bairros.has(w)))];

type ItemAvaliado = { score: number; rarasTitulo: number; rarasTexto: number; repetida: boolean };
// Avalia um documento: peso maior pra palavra rara, pra palavra no título e pra palavra repetida
const avaliar = (titulo: string, texto: string, fortes: string[], df: Map<string, number>, totalDocs: number): ItemAvaliado => {
  const noTitulo = new Set(palavrasDe(titulo));
  const contagem = new Map<string, number>();
  for (const w of palavrasDe(`${titulo} ${texto}`)) contagem.set(w, (contagem.get(w) || 0) + 1);
  const limiteRara = Math.max(3, Math.round(totalDocs * 0.08));
  let score = 0, rarasTitulo = 0, rarasTexto = 0, repetida = false;
  for (const w of fortes) {
    const n = contagem.get(w) || 0;
    if (!n) continue;
    const docsComPalavra = df.get(w) || 1;
    const rara = docsComPalavra <= limiteRara;
    const peso = Math.log(1 + totalDocs / docsComPalavra);
    score += peso * (noTitulo.has(w) ? 2 : 1) * (n >= 2 ? 1.5 : 1);
    if (rara) {
      rarasTexto++;
      if (noTitulo.has(w)) rarasTitulo++;
      if (n >= 2) repetida = true;
    }
  }
  return { score: Math.round(score * 10) / 10, rarasTitulo, rarasTexto, repetida };
};
// Cobre o assunto: palavra rara do pedido no título, ou duas no texto, ou uma repetida no texto
const cobreAssunto = (i: ItemAvaliado): boolean => i.rarasTitulo >= 1 || i.rarasTexto >= 2 || i.repetida;

// Troca o nome do cidadão por [NOME] nas respostas antigas (modo contexto: o texto vai para outra pessoa)
const mascararNome = (texto: string, solicitante?: string | null): string => {
  let t = texto;
  const primeiro = (solicitante || "").trim().split(/\s+/)[0];
  if (primeiro && primeiro.length > 2) {
    const nomeEscapado = primeiro.replace(/[^A-Za-zÀ-ÿ0-9]/g, "\\$&");
    t = t.replace(new RegExp("(?<![A-Za-zÀ-ÿ])" + nomeEscapado + "(?![A-Za-zÀ-ÿ])", "gi"), "[NOME]");
  }
  // Saudação no começo: "Ô João,", "Oi, Dona Maria!", "Bom dia, Seu José"
  const saudacao = t.match(/^(\s*(?:ô|oi|olá|ola|opa|e aí|bom dia|boa tarde|boa noite)[,!\s]+)((?:dona|d\.|seu|sr\.?|sra\.?)\s+)?/i);
  if (saudacao) {
    const resto = t.slice(saudacao[0].length);
    const nome = resto.match(/^[A-ZÀ-Ý][a-zà-ÿ]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ]+)?(?=[,!.\s])/);
    if (nome) t = saudacao[1] + "[NOME]" + resto.slice(nome[0].length);
  }
  return t;
};

// ─── Histórico do cidadão (modo contexto) ───
// Chave de comparação de telefone: DDD + 8 últimos dígitos. Ignora o 55, o zero inicial e o 9 depois do DDD.
const chaveTelefone = (bruto: unknown): string => {
  let d = String(bruto ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return "";
  return d.slice(0, 2) + d.slice(-8);
};
// Telefones dentro de um campo de texto livre ("(34) 99999-1234 / 3232-1234")
const chavesTelefoneDe = (texto: string | null): string[] => {
  const chaves: string[] = [];
  for (const trecho of String(texto ?? "").match(/\+?\d[\d\s().-]{6,}\d/g) || []) {
    const inteiro = chaveTelefone(trecho);
    if (inteiro) chaves.push(inteiro);
    else for (const parte of trecho.split(/\s+/)) { const k = chaveTelefone(parte); if (k) chaves.push(k); }
  }
  return chaves;
};
const dataBR = (iso: string | null): string => iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Entrada do bot de WhatsApp (n8n): segredo compartilhado no header x-bot-secret.
    // O bot não tem usuário no Solar; sem o segredo certo vale a checagem de usuário logado.
    const botSecret = Deno.env.get("BOT_SECRET");
    const ehBot = !!botSecret && req.headers.get("x-bot-secret") === botSecret;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (!ehBot) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const _sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
      const { data: claimsData, error: claimsErr } = await _sb.auth.getUser(authHeader.replace("Bearer ", ""));
      if (claimsErr || !claimsData?.user) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const { modo: modoPedido, telefone, numero, assunto, destinatario, descricao, solicitante, bairro, local, secretaria, tipo_demanda, urgencia } = await req.json();

    // modo "painel" (padrão): gera a sugestão para a tela Respostas.
    // modo "contexto": só o bot usa; devolve o material encontrado, sem chamar a IA.
    const modo = modoPedido === "contexto" ? "contexto" : "painel";
    if (modo === "contexto" && !ehBot) {
      return new Response(JSON.stringify({ error: "Modo contexto é exclusivo do bot" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Palavras-chave da demanda para ranquear relevância (filtro > 2 letras)
    const demandaText = `${assunto || ""} ${descricao || ""} ${bairro || ""} ${local || ""} ${secretaria || ""} ${tipo_demanda || ""}`.toLowerCase();
    const keywords = demandaText.split(/\s+/).filter(w => w.length > 2);

    // ═══ Buscar dados em paralelo ═══
    // No modo contexto as mensagens do WhatsApp não são lidas: têm nome e assunto de outros cidadãos.
    const [scriptsRes, baseInfoRes, respostasRes, conversasRes] = await Promise.all([
      supabaseAdmin.from("scripts").select("titulo, conteudo, categoria, tags").order("created_at", { ascending: false }).limit(80),
      supabaseAdmin.from("base_conhecimento").select("titulo, descricao, categoria, orgao, bairro, link").order("created_at", { ascending: false }).limit(60),
      supabaseAdmin.from("oficios").select("resposta_cidadao, assunto, bairro, secretaria_identificada, solicitante").not("resposta_cidadao", "is", null).order("created_at", { ascending: false }).limit(50),
      modo === "contexto"
        ? Promise.resolve({ data: [] as { content: string | null; direction: string; sender_name: string | null }[] })
        : supabaseAdmin.from("whatsapp_messages").select("content, direction, sender_name").eq("direction", "outgoing").not("content", "is", null).order("created_at", { ascending: false }).limit(60),
    ]);

    const scripts = scriptsRes.data || [];
    const baseInfo = baseInfoRes.data || [];
    // Mensagens de referência com material de campanha ficam de fora (nos dois modos)
    const respostasAnteriores = respostasRes.data?.filter(r => r.resposta_cidadao && !CAMPANHA_RE.test(r.resposta_cidadao)) || [];
    const conversasEnviadas = conversasRes.data?.filter(c => c.content && c.content.length > 20 && !CAMPANHA_RE.test(c.content)) || [];

    // ═══ Ranquear scripts por relevância ═══
    const rankedScripts = scripts
      .map(s => ({
        ...s,
        score: scoreRelevance(`${s.titulo} ${s.conteudo} ${(s.tags || []).join(" ")} ${s.categoria}`, keywords)
      }))
      .sort((a, b) => b.score - a.score);

    // Top 20 scripts, com conteúdo completo se score >= 3
    const topScripts = rankedScripts.slice(0, 20);
    const topRespostas = respostasAnteriores
      .map(r => ({ ...r, score: scoreRelevance(`${r.assunto} ${r.bairro} ${r.secretaria_identificada} ${r.resposta_cidadao}`, keywords) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // Base de conhecimento ranqueada como os scripts (antes entravam as 10 mais recentes)
    const rankedBase = baseInfo
      .map(b => ({ ...b, score: scoreRelevance(`${b.titulo} ${b.descricao || ""} ${b.categoria || ""} ${b.orgao || ""} ${b.bairro || ""}`, keywords) }))
      .sort((a, b) => b.score - a.score);
    const topBase = rankedBase.slice(0, 10);

    const scriptsCount = scripts.length;
    const baseInfoCount = baseInfo.length;
    const respostasCount = respostasAnteriores.length;
    const conversasCount = conversasEnviadas.length;

    // ═══ Modo contexto (bot): devolve o material, sem gerar texto ═══
    if (modo === "contexto") {
      // Nomes de bairro não contam como assunto ("buraco no Santa Mônica" é sobre buraco)
      const bairrosRes = await supabaseAdmin.from("oficios").select("bairro").not("bairro", "is", null).order("created_at", { ascending: false }).limit(400);
      const bairros = new Set<string>();
      for (const o of bairrosRes.data || []) for (const w of palavrasDe(o.bairro || "")) bairros.add(w);
      for (const b of baseInfo) for (const w of palavrasDe(b.bairro || "")) bairros.add(w);

      const fortes = palavrasFortes(demandaText, bairros);
      const scriptsBot = scripts.filter(s => !CAMPANHA_SCRIPT_RE.test(`${s.titulo} ${s.conteudo}`));
      // Lista antiga de vagas não serve pro bot (emprego tem resposta própria no WhatsApp)
      const baseBot = baseInfo.filter(b => !/^\s*vagas\b/i.test(b.titulo || ""));

      // Em quantos documentos cada palavra aparece (palavra rara pesa mais)
      const textoScript = (s: typeof scripts[number]) => `${s.conteudo || ""} ${(s.tags || []).join(" ")}`;
      const textoBase = (b: typeof baseInfo[number]) => `${b.descricao || ""} ${b.orgao || ""}`;
      const df = new Map<string, number>();
      const docs = [...scriptsBot.map(s => `${s.titulo} ${textoScript(s)}`), ...baseBot.map(b => `${b.titulo} ${textoBase(b)}`)];
      for (const d of docs) for (const w of new Set(palavrasDe(d))) df.set(w, (df.get(w) || 0) + 1);

      const scriptsCtx = scriptsBot
        .map(s => ({ ...s, ...avaliar(`${s.titulo} ${(s.tags || []).join(" ")}`, textoScript(s), fortes, df, docs.length) }))
        .filter(cobreAssunto)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
      const baseCtx = baseBot
        .map(b => ({ ...b, ...avaliar(`${b.titulo}`, textoBase(b), fortes, df, docs.length) }))
        .filter(cobreAssunto)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
      const respostasCtx = respostasAnteriores
        .map(r => ({ ...r, ...avaliar(`${r.assunto || ""}`, `${r.secretaria_identificada || ""} ${r.resposta_cidadao || ""}`, fortes, df, docs.length) }))
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      const temBase = scriptsCtx.length > 0 || baseCtx.length > 0;

      // Pedidos deste cidadão: só pelo telefone que mandou a mensagem (nunca por nome ou endereço).
      // O banco filtra pelos 4 últimos dígitos; a comparação de verdade é feita aqui, pelos dígitos.
      const pediuHistorico = telefone !== undefined && telefone !== null && String(telefone).trim() !== "";
      const chaveTel = chaveTelefone(telefone);
      let historico: { numero: string | null; protocolo: string | null; assunto: string; bairro: string | null; secretaria: string | null; status: string; criado_em: string; atualizado_em: string }[] = [];
      if (chaveTel) {
        const candidatos = await supabaseAdmin.from("oficios")
          .select("numero, numero_protocolo, assunto, bairro, secretaria_identificada, status, created_at, updated_at, contato_solicitante")
          .is("deleted_at", null)
          .ilike("contato_solicitante", `%${chaveTel.slice(-4)}%`)
          .order("created_at", { ascending: false })
          .limit(300);
        historico = (candidatos.data || [])
          .filter(o => chavesTelefoneDe(o.contato_solicitante).includes(chaveTel))
          .slice(0, 5)
          .map(o => ({ numero: o.numero, protocolo: o.numero_protocolo, assunto: o.assunto, bairro: o.bairro, secretaria: o.secretaria_identificada, status: o.status, criado_em: o.created_at, atualizado_em: o.updated_at }));
      }
      const blocoHistorico = !pediuHistorico ? "" : `═══ PEDIDOS DESTE CIDADÃO ═══
${historico.length > 0
  ? historico.map(h => `- ${h.numero ? `Ofício ${h.numero}` : "Ofício sem número"}${h.protocolo ? ` (protocolo ${h.protocolo})` : ""} | ${h.assunto} | bairro: ${h.bairro || "não informado"} | secretaria: ${h.secretaria || "não informada"} | status: ${h.status} | criado em ${dataBR(h.criado_em)} | atualizado em ${dataBR(h.atualizado_em)}`).join("\n")
  : "Nenhum pedido registrado para este telefone."}

`;

      const contexto = `
${blocoHistorico}Respostas anteriores servem só de modelo de tom. Nunca copie nomes, endereços ou números de protocolo delas.

═══ SCRIPTS DO GABINETE (FONTE PRIMÁRIA) ═══
${scriptsCtx.length > 0
  ? scriptsCtx.map(s => `[${s.categoria}] ${s.titulo} (relevância: ${s.score}):\n${(s.conteudo || "").substring(0, 2500)}`).join("\n---\n")
  : "Nenhum script sobre esse assunto."}

═══ BANCO DE INFORMAÇÕES ═══
${baseCtx.length > 0
  ? baseCtx.map(b => `[${b.categoria || "Geral"}] ${b.titulo}: ${b.descricao?.substring(0, 400) || ""} ${b.orgao ? `(${b.orgao})` : ""} ${b.link || ""}`.trim()).join("\n")
  : "Nenhuma informação sobre esse assunto."}

═══ RESPOSTAS JÁ ENVIADAS PELO GABINETE (só modelo de tom) ═══
${respostasCtx.length > 0
  ? respostasCtx.map(r => `[${r.secretaria_identificada || "Geral"}]\n${mascararNome(r.resposta_cidadao || "", r.solicitante).substring(0, 400)}`).join("\n---\n")
  : "Nenhuma resposta anterior parecida."}
      `.trim();

      const melhores = [
        ...scriptsCtx.map(s => ({ tipo: "script", titulo: s.titulo, score: s.score })),
        ...baseCtx.map(b => ({ tipo: "base", titulo: b.titulo, score: b.score })),
      ].sort((a, b) => b.score - a.score);

      return new Response(JSON.stringify({
        contexto,
        temBase,
        fontes: { scripts: scriptsCount, base_info: baseInfoCount, respostas_anteriores: respostasCount },
        melhores,
        palavras: fortes,
        historico,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ═══ Montar contexto priorizando scripts relevantes ═══
    const contextoInterno = `
═══ SCRIPTS DO GABINETE (FONTE PRIMÁRIA — use como base!) ═══
${topScripts.length > 0
  ? topScripts.map(s => {
      // Se score >= 3, incluir conteúdo completo; senão limitar a 1000 chars
      const conteudo = s.score >= 3 ? s.conteudo : s.conteudo?.substring(0, 1000);
      return `[${s.categoria}] ${s.titulo} (relevância: ${s.score}):\n${conteudo}`;
    }).join("\n---\n")
  : "Nenhum script cadastrado."}

═══ RESPOSTAS JÁ ENVIADAS PELO GABINETE (copie o tom e estilo!) ═══
${topRespostas.length > 0
  ? topRespostas.map(r => `[${r.secretaria_identificada || "Geral"}] Assunto: ${r.assunto}\n${r.resposta_cidadao?.substring(0, 500)}`).join("\n---\n")
  : "Nenhuma resposta anterior."}

═══ MENSAGENS REAIS DO WHATSAPP DO FABÃO (referência de tom de voz) ═══
${conversasEnviadas.slice(0, 20).map(c => c.content?.substring(0, 400)).join("\n---\n") || "Nenhuma conversa encontrada."}

═══ BANCO DE INFORMAÇÕES ═══
${topBase.map(b => `[${b.categoria || "Geral"}] ${b.titulo}: ${b.descricao?.substring(0, 200) || ""} ${b.orgao ? `(${b.orgao})` : ""}`).join("\n") || "Nenhuma informação."}
    `.trim();

    const protocolo = numero ? `${numero}` : "ainda não atribuído";

    const systemPrompt = `Você É o Fabão: vereador de Uberlândia, eleito deputado estadual por Minas Gerais em 2026 pelo PV, com 52.938 votos. Você segue como vereador até a posse na Assembleia de Minas, em 1º de fevereiro de 2027. Não é uma IA respondendo por ele, você É ele. Fala na primeira pessoa como se estivesse gravando um áudio no WhatsApp para um morador que te pediu ajuda. Seu jeito é caloroso, mineiro, direto, humano e nunca robótico. Você conhece cada rua de Uberlândia, cada secretaria, cada problema da cidade. Quando alguém te manda uma demanda você responde como um amigo que realmente se importa e vai correr atrás.
A eleição já passou: nunca peça voto, nunca fale de campanha, santinho ou número de urna. Só fale de votos, partido ou da eleição se a demanda perguntar.

═══ SEU JEITO DE FALAR ═══
Use expressões naturais como "Ô", "Então", "Pode deixar", "Deixa comigo", "Vou correr atrás", "Tô em cima disso", "Obrigado por me avisar". Nunca use palavras formais como "Prezado", "Comunicamos", "Informamos", "Venho por meio deste", "Em atenção ao seu contato". Emojis com naturalidade: dois ou três por mensagem no máximo. Frases curtas como áudio transcrito. Sempre termine com compromisso concreto e acolhimento.

═══ REGRA DOS SCRIPTS ═══
Se existir script no material interno com relevância para a demanda, EXTRAIA as informações concretas como telefones, links, nomes de secretaria, procedimentos, e incorpore naturalmente na resposta como se o Fabão soubesse de cabeça. Nunca diga que está usando um script. As informações do script devem soar como conhecimento natural do Fabão sobre a cidade.
Telefone, link, endereço e horário só podem vir do MATERIAL INTERNO. Se não estiver lá, não informe.
Se o MATERIAL INTERNO não trouxer o contato de um órgão, cite o órgão sem número nenhum. Nunca complete com número de cabeça, nem número curto (156, 199 e parecidos).
Só use um telefone ou endereço se o MATERIAL INTERNO disser que ele é daquele órgão. Nunca pegue o contato de um serviço (por exemplo, de um script que só fala do mesmo bairro) para outro serviço.

═══ REGRA DO PROTOCOLO ═══
Se o PROTOCOLO for "ainda não atribuído", não diga que já mandou ofício ou que já falou com a secretaria. Diga o que vai ser feito.

═══ PROIBIDO ABSOLUTAMENTE ═══
- "Entendi que a situação", "Compreendo que", "Conforme analisado", "Segue em anexo", "Diante do exposto"
- Qualquer estrutura de ofício ou carta formal
- Resumir o problema do cidadão de forma analítica
- Parecer chatbot ou IA
- "Prezado(a)", "Vossa Senhoria", "Venho por meio deste"
- "Comunicamos", "Informamos", "Em atenção ao seu contato"
- Respostas secas, curtas ou genéricas tipo "Vou verificar."

═══ ESTRUTURA DA RESPOSTA ═══
1. Saudação pelo nome com emoji
2. Uma frase curta mostrando que entendeu o problema de forma humana e empática
3. A solução concreta com informações reais do script se existir
4. Fechamento com compromisso pessoal e emoji motivador
Máximo 6 linhas.

═══ EXEMPLOS DO FABÃO ═══

Exemplo buraco na rua:
"Ô [NOME], que situação hein! 😤 Esse buraco no [LOCAL] tá perigoso mesmo, e ninguém merece passar por isso. Vou mandar ofício pra Secretaria de Obras pedindo tapa-buraco urgente na região. Pode deixar que vou ficar em cima até resolver! 💪"

Exemplo saúde:
"Oi [NOME]! 😊 Sei como é sofrido passar por isso com a saúde, viu. Vou acionar a Secretaria de Saúde pedindo prioridade. Se precisar de mais apoio, a Defensoria Pública atende pelo [TELEFONE DO SCRIPT] e pode te ajudar também. Tô do seu lado nisso! 🙏"

Exemplo animal:
"[NOME], obrigado por me avisar! 🐾 Esse tipo de situação não pode ficar assim. Você pode ligar agora pro SIM no [TELEFONE DO SCRIPT] ou mandar zap pro [WHATSAPP DO SCRIPT] que eles atendem. Eu também vou acionar a Patrulha Ambiental por aqui. Juntos a gente resolve! 💪"

Os marcadores entre colchetes ([TELEFONE DO SCRIPT], [WHATSAPP DO SCRIPT], [LINK DO SCRIPT]) só mostram onde o dado entra. Troque pelo dado que está no MATERIAL INTERNO; se não houver, tire a frase. Nunca escreva um marcador na resposta.

═══ IMPORTANTE ═══
Retorne APENAS o texto da resposta, sem aspas, sem prefixos, sem explicações.`;

    const userPrompt = `═══ MATERIAL INTERNO DO GABINETE ═══
${contextoInterno}

═══ DEMANDA DO CIDADÃO PARA RESPONDER AGORA ═══
PROTOCOLO: ${protocolo}
NOME: ${solicitante || "Não informado"}
ASSUNTO: ${assunto || "Não informado"}
DESCRIÇÃO: ${descricao || "Não detalhada"}
LOCAL: ${local || "Não informado"}
BAIRRO: ${bairro || "Não informado"}
SECRETARIA: ${secretaria || destinatario || "A identificar"}
TIPO: ${tipo_demanda || "Solicitação"}
URGÊNCIA: ${urgencia || "Normal"}

Gere a resposta como o Fabão responderia no WhatsApp. Use os scripts e respostas anteriores como base. Seja humano, empático, e dê uma solução concreta.`;

    // ═══ Chamar IA ═══
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY não configurada");
    }

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 600,
        temperature: 0.8,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("OpenAI error:", aiResponse.status, errText);
      throw new Error(`Erro na API de IA: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiTexto = aiData.choices?.[0]?.message?.content?.trim() || "";
    const resposta = aiTexto ? cleanQuotedResponse(aiTexto) : buildFallback(solicitante, local, bairro);

    return new Response(JSON.stringify({
      resposta,
      fontes: {
        scripts: scriptsCount,
        base_info: baseInfoCount,
        respostas_anteriores: respostasCount,
        conversas_whatsapp: conversasCount,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Erro geral:", e);
    const status = e.status || 500;
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildFallback(solicitante?: string | null, local?: string | null, bairro?: string | null): string {
  const nome = solicitante && solicitante !== "Não informado" ? solicitante : "meu amigo";
  const localRef = local && local !== "Não informado"
    ? local
    : bairro && bairro !== "Não informado"
      ? `o bairro ${bairro}`
      : "essa situação que você me passou";

  return `Ô ${nome}, que bom que você me avisou! 😊 Entendo a situação com ${localRef}. Vou passar pra equipe e ficar em cima até ter um retorno. 💪`;
}
