-- 05/11 Cérebro, Fase 1: fatos do Fabão no SOLAR (dono). Só acrescenta: 1 tabela nova + 1 view nova. Nada existente muda.
-- Pode rodar duas vezes (IF NOT EXISTS / ON CONFLICT). Rodar no editor SQL do Lovable Cloud.
-- Desfazer (se precisar): drop view public.fatos_fabao_ok; drop table public.fatos_fabao;

create table if not exists public.fatos_fabao (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,              -- nome fixo do fato (usado na cópia pro Júnior)
  fato text not null,                      -- o fato completo, pra equipe
  texto_junior text not null,              -- frase curta que o Júnior pode usar
  fonte text,                              -- link
  conferido_em date,
  valido_de date,
  valido_ate date,
  situacao text not null default 'rascunho' check (situacao in ('rascunho', 'conferir', 'ok', 'vencido')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create or replace function public.fatos_fabao_tocar() returns trigger language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;
drop trigger if exists fatos_fabao_tocar on public.fatos_fabao;
create trigger fatos_fabao_tocar before update on public.fatos_fabao for each row execute function public.fatos_fabao_tocar();

alter table public.fatos_fabao enable row level security;
drop policy if exists "fatos: logado le" on public.fatos_fabao;
create policy "fatos: logado le" on public.fatos_fabao for select to authenticated using (true);
drop policy if exists "fatos: admin muda" on public.fatos_fabao;
create policy "fatos: admin muda" on public.fatos_fabao for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- O que o Júnior pode usar: só "ok" e dentro da validade (data de Brasília)
create or replace view public.fatos_fabao_ok with (security_invoker = true) as
select chave, texto_junior, fonte, conferido_em, valido_de, valido_ate
from public.fatos_fabao
where situacao = 'ok'
  and (valido_de is null or valido_de <= (now() at time zone 'America/Sao_Paulo')::date)
  and (valido_ate is null or valido_ate >= (now() at time zone 'America/Sao_Paulo')::date);

insert into public.fatos_fabao (chave, fato, texto_junior, fonte, conferido_em, valido_de, valido_ate, situacao) values
('eleito_deputado_2026',
 'Fabão (PV) foi eleito deputado estadual por Minas Gerais nas eleições de 4/10/2026, com 52.938 votos (número confirmado pela Gercilia em 05/11; a matéria fala em 52.940), cerca de 51 mil deles em Uberlândia. Vaga veio pela federação PT/PCdoB/PV.',
 'Fui eleito deputado estadual por Minas Gerais em 4 de outubro de 2026, com 52.938 votos, cerca de 51 mil só aqui em Uberlândia. 🙏',
 'https://www.congressoemfoco.com.br/noticia/130535/fabao-pv-foi-eleito-deputado-estadual-em-minas-gerais',
 '2026-11-05', '2026-10-04', null, 'ok'),
('cargo_vereador',
 'Até a posse na ALMG, Fabão continua vereador de Uberlândia (PV), reeleito em 2024 com 14.596 votos.',
 'Até a posse sigo como vereador de Uberlândia, atendendo normal por aqui. 🙏',
 'https://www.tribunapr.com.br/eleicoes/2024/vereadores-eleitos-em-uberlandia-mg-nas-eleicoes-2024-veja-a-lista/',
 '2026-11-05', null, '2027-01-31', 'ok'),
('posse_almg',
 'Posse dos deputados estaduais eleitos em 2026 na ALMG: 1º de fevereiro de 2027 (início da legislatura; mesmo padrão de 1º/02/2023). A ALMG ainda não publicou a solenidade de 2027: CONFERIR no site da ALMG.',
 'Tomo posse como deputado estadual na Assembleia de Minas no dia 1º de fevereiro de 2027. 🙏',
 'https://www.almg.gov.br/',
 null, null, null, 'conferir'),
 -- CONFERIR a grafia do @ (a Gercilia escreveu "@fabaovereadro"); a página da Câmara entra quando ela mandar o link
('redes_oficiais',
 'Redes e site oficiais do Fabão: Instagram @fabaovereador e o site sosuberlandia.com.br. Página na Câmara de Uberlândia: falta o link.',
 'Meu Instagram é o @fabaovereador e o site é o sosuberlandia.com.br. 🙏',
 'informado pela Gercilia em 05/11',
 '2026-11-05', null, null, 'conferir')
on conflict (chave) do nothing;

-- Conferência
select chave, situacao, valido_de, valido_ate from public.fatos_fabao order by chave;
select chave from public.fatos_fabao_ok;
