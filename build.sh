#!/bin/sh
# Gera o site estático da versão Supabase em ./docs (publicado pelo GitHub Pages)
set -e
cd "$(dirname "$0")"
OUT=${1:-docs}
rm -rf "$OUT"; mkdir -p "$OUT"
cp src/engine.js src/padrao.js src/i18n.js src/app.js "$OUT"/
cp sb/config.js sb/supabase.js sb/591.supabase.js sb/sb_backend.js "$OUT"/
python3 - "$OUT" <<'PY'
import sys
out=sys.argv[1]
h=open('src/index.html',encoding='utf-8').read()
inj='<script src="config.js"></script>\n<script src="supabase.js"></script>\n<script src="sb_backend.js"></script>\n<script src="engine.js"></script>'
assert '<script src="engine.js"></script>' in h
h=h.replace('<script src="engine.js"></script>',inj,1)
pg='<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>*,*::before,*::after{box-sizing:border-box}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>\n'+h+'\n</body></html>\n'
open(out+'/index.html','w',encoding='utf-8').write(pg)
PY
touch "$OUT/.nojekyll"
echo "site gerado em $OUT/"
