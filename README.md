# Planning Projects — OP Consulting

Sistema de planejamento e custo de obras (versão com login, banco Supabase).

- `src/` — código do sistema (o mesmo da página do Claude).
- `sb/` — camada Supabase: `sb_backend.js` (login e acesso aos dados), `config.js` (endereço e chave **publicável**; nunca a service_role), `migracao_docs.sql` (tabela `docs` e regras de acesso).
- `build.sh` — gera o site em `docs/`, publicado pelo GitHub Pages (Settings › Pages › branch `main`, pasta `/docs`).

Depois de publicar, informe o endereço do site em Supabase › Authentication › URL Configuration (Site URL e Redirect URLs).

Dados: na página do Claude, Projetos › **Exportar tudo (Supabase)**; no site, entre como administrador e use **Importar dados**.
