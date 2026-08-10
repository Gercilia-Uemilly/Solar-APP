/**
 * Regras de arquitetura entre camadas do Solar.
 * Camadas: pages -> components -> hooks -> lib -> integrations
 * (uma camada só pode depender das de baixo).
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Dependência circular entre módulos.",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-orphans",
      severity: "warn",
      from: { orphan: true, pathNot: ["\\.d\\.ts$", "(^|/)vite-env\\.d\\.ts$", "^src/test/"] },
      to: {},
    },
    {
      name: "lib-nao-importa-ui",
      severity: "error",
      comment: "src/lib é lógica pura: não pode importar componentes, páginas ou hooks de UI.",
      from: { path: "^src/lib/" },
      to: { path: "^src/(components|pages)/" },
    },
    {
      name: "hooks-nao-importa-pages",
      severity: "error",
      comment: "Hooks não podem depender de páginas.",
      from: { path: "^src/hooks/" },
      to: { path: "^src/pages/" },
    },
    {
      name: "components-nao-importa-pages",
      severity: "error",
      comment: "Componentes não podem depender de páginas.",
      from: { path: "^src/components/" },
      to: { path: "^src/pages/" },
    },
    {
      name: "supabase-client-somente-camadas-de-dados",
      severity: "warn",
      comment:
        "Prefira acessar o backend por hooks/lib em vez de chamar o client direto de dentro de componentes de UI.",
      from: { path: "^src/components/ui/" },
      to: { path: "^src/integrations/supabase/" },
    },
    {
      name: "no-dev-dep-em-producao",
      severity: "error",
      from: { path: "^src/", pathNot: "\\.(test|spec)\\.(ts|tsx)$" },
      to: { dependencyTypes: ["npm-dev"] },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(dist|coverage|reports|supabase/functions)/" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.app.json" },
    enhancedResolveOptions: { extensions: [".ts", ".tsx", ".js", ".jsx"] },
    reporterOptions: { text: { highlightFocused: true } },
  },
};