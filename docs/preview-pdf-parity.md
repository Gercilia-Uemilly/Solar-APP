# Paridade Preview x PDF exportado

Auditoria automática que garante que a paginação e as margens do preview são
idênticas às do PDF gerado na exportação.

## Como rodar

```bash
PLAYWRIGHT_CHROMIUM_PATH=/opt/ms-playwright/chromium-1194/chrome-linux/chrome \
E2E_BASE_URL=http://localhost:8080 \
PARITY_SAMPLE=5 \
npm run test:parity
```

- `PARITY_SAMPLE`: quantidade de ofícios recentes auditados (padrão 5).
- `PARITY_OFICIO_IDS`: lista de UUIDs separados por vírgula para auditar ofícios específicos.

## O que é comparado

| Verificação | Regra |
| --- | --- |
| Número de páginas | preview == PDF (exato) |
| Margem esquerda/direita | diferença <= 12pt |
| Margem superior | diferença <= 12pt |
| Margem inferior | texto do PDF nunca abaixo da margem reservada no preview |
| Transbordo | nenhuma folha do preview com `scrollHeight > clientHeight` |

Cabeçalho (logos) e número da página vivem na margem do Word e são ignorados no
cálculo da caixa útil.

## Saída

- `reports/parity/relatorio.txt` — medições página a página.
- `reports/parity/oficio-<numero>.pdf` — PDF exportado usado na comparação.

## Infra

- Rota `/dev/parity?id=<uuid>` (**apenas em desenvolvimento**) renderiza o preview
  somente-leitura e expõe `window.__parity.buildPdfBase64()`, que usa o mesmo
  pipeline de exportação de produção (`buildMergedPdfBlob`).
- Teste: `e2e/preview-parity.spec.ts`.
