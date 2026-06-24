
## Visão geral

Adiciona o conceito de **Resposta** a um ofício: o órgão respondeu → operador anexa o PDF (1 ou vários), o sistema marca como **Respondido**, notifica o operador (sino + WhatsApp) e permite importar respostas antigas em massa via IA semântica.

---

## 1. Banco de dados

### Nova tabela `oficio_respostas`
- `oficio_id` (FK oficios)
- `arquivo_url` (storage)
- `arquivo_nome`, `tamanho_bytes`, `mime_type`
- `tipo_origem`: `manual` | `whatsapp` | `import_excel`
- `data_resposta` (data informada do documento)
- `orgao_respondente` (texto)
- `resumo_ia` (texto extraído/resumido pela IA)
- `match_confianca` (0-1, só para import)
- `match_metodo` (`ia_semantica` | `manual`)
- `uploaded_by`, `uploaded_by_nome`
- `created_at`

RLS: leitura para autenticados; insert/delete para autor do ofício, admin ou operador. Storage bucket novo: `respostas-oficios` (privado).

### Alterações em `oficios`
- Novo status válido: `Respondido`
- Coluna `respondido_em` (timestamp)
- Coluna `total_respostas` (int, atualizado via trigger)

---

## 2. UI — botões "Resposta" e "Subir Resposta"

**Lista de Ofícios (`MeusOficios.tsx`, `Oficios.tsx`)** — adicionar ao lado de "Histórico" e "Editar":
- **Resposta** (badge com contador) → abre modal listando respostas anexadas, com preview PDF, download, excluir.
- **Subir Resposta** → abre `UploadRespostaModal` (drag-drop múltiplos PDFs).

**Modal de detalhe do ofício (`RealPreviewDialog` / aba nova)** — mesma dupla de botões e uma aba "Respostas".

**Indicador visual** na linha do ofício: ícone ✉️ quando `total_respostas > 0` + status `Respondido` em verde.

---

## 3. Upload de resposta (`UploadRespostaModal`)

- Aceita múltiplos PDFs (até 20MB cada).
- Para cada arquivo: upload no bucket `respostas-oficios/{oficio_id}/...`, insert em `oficio_respostas`.
- Chama edge function `processar-resposta-oficio` que:
  1. Extrai texto do PDF (pdf.js no client OU Gemini no servidor).
  2. Gera `resumo_ia` (2-3 linhas) e detecta `orgao_respondente` e `data_resposta`.
  3. Atualiza `oficios.status = 'Respondido'`, `respondido_em = now()`.
  4. Dispara notificação (sino + WhatsApp via Z-API para o `telefone` do `profiles` do `author_id`).

---

## 4. Notificações

- **Sino in-app**: insert em `notificacoes` (já existe) com tipo `resposta_recebida`, link para o ofício.
- **WhatsApp**: edge function `notificar-resposta-whatsapp` usa Z-API (já configurada). Mensagem:
  > 📬 *Resposta recebida* — Ofício GVF-2026-820 (Assunto X) foi respondido por [Órgão]. Acesse o sistema para visualizar.

Só envia se `profiles.telefone` estiver preenchido. Falha silenciosa com log em `error_logs`.

---

## 5. Importação histórica via IA semântica (Excel)

Nova página/aba **"Importar Respostas Históricas"** (admin only):

1. Operador faz upload do `.xlsx` (cada linha = 1 resposta, com colunas livres tipo Assunto/Destinatário/Data/Texto/Anexo).
2. Edge function `import-respostas-historico`:
   - Parse com SheetJS (npm xlsx).
   - Para cada linha, busca os 10 ofícios mais similares via comparação semântica (embeddings ou GPT-4o com lote de candidatos por janela de data + secretaria).
   - Pede ao GPT-4o: "qual destes 10 ofícios casa com esta resposta? Retorne id + confiança 0-1 + justificativa. Se nenhum casa bem, retorne null".
   - Se `confianca >= 0.75` → cria automaticamente em `oficio_respostas` com `match_metodo='ia_semantica'`.
   - Se `0.4 <= confianca < 0.75` → fica em **fila de revisão manual** (UI lista para aprovar/rejeitar/reassignar).
   - Se `< 0.4` → marca como "sem match" para o admin reatribuir.
3. Relatório final: X auto-vinculadas, Y para revisão, Z sem match.

---

## 6. Prompt da IA (matching de respostas)

```
Você está vinculando uma RESPOSTA antiga de órgão público ao OFÍCIO original
que a gerou. Receba a resposta + 10 candidatos.

Critérios de match (em ordem de peso):
1. Assunto/tema (peso 40%) — sinônimos contam (ex: "poda" ≈ "supressão de árvore").
2. Destinatário/secretaria respondente vs. secretaria do ofício (peso 25%).
3. Local/bairro citado (peso 15%).
4. Janela temporal: resposta deve ser POSTERIOR ao ofício, idealmente em até 180 dias (peso 10%).
5. Solicitante/cidadão mencionado (peso 10%).

Retorne JSON: { "oficio_id": "uuid"|null, "confianca": 0.0-1.0, "justificativa": "..." }
Seja conservador: prefira null a chutar. Confiança >= 0.75 só com pelo menos
3 critérios fortes alinhados.
```

---

## 7. Dicas de melhoria que aplicarei

- **Versionamento**: permitir múltiplas respostas por ofício (já contemplado) com ordenação cronológica.
- **Preview inline**: visualizar PDF da resposta dentro do modal sem baixar.
- **Busca**: indexar `resumo_ia` para buscar ofícios por conteúdo da resposta.
- **Auditoria**: cada upload registra em `audit_log` (quem subiu, quando, IP).
- **Rastreabilidade**: badge "Respondido em X dias" no dashboard (tempo médio de resposta por secretaria — métrica nova para Relatórios).
- **Anti-duplicata**: hash SHA-256 do PDF; bloqueia upload do mesmo arquivo duas vezes no mesmo ofício.
- **OCR fallback**: se PDF for scaneado (sem texto extraível), passa por Whisper-like OCR (Gemini Vision) para gerar resumo.
- **Reabrir**: botão "Reabrir ofício" caso resposta seja insuficiente — volta para status anterior.

---

## 8. Arquivos a criar/editar

**Novos**
- `supabase/functions/processar-resposta-oficio/index.ts`
- `supabase/functions/notificar-resposta-whatsapp/index.ts`
- `supabase/functions/import-respostas-historico/index.ts`
- `src/components/UploadRespostaModal.tsx`
- `src/components/RespostasOficioDialog.tsx`
- `src/pages/ImportarRespostas.tsx`
- `src/hooks/useRespostas.ts`

**Editados**
- `src/pages/MeusOficios.tsx`, `src/pages/Oficios.tsx` — botões na linha
- `src/components/RealPreviewDialog.tsx` — aba Respostas
- `src/components/AppSidebar.tsx` — link "Importar Respostas" (admin)
- `src/types/index.ts` — tipos
- Migração SQL (tabela + bucket + trigger contador)

---

## 9. Ordem de execução

1. Migração DB + bucket + grants/RLS.
2. Hook + componentes UI (modal upload, modal listar).
3. Botões nas duas telas.
4. Edge function de processamento + notificação.
5. Página de importação histórica + edge function de matching IA.
6. Testes e ajuste do prompt.

Tudo OK para implementar?
