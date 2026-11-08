/* Planning Projects · OP Consulting — padrão de EAP e CPUs paramétricas (usado no navegador e nos scripts de importação) */
(function (root) {
  'use strict';
  var SA = function (s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase(); };

  /* ---------- EAP padrão OP Consulting ---------- */
  var EAP = [
    ['1', 'GESTÃO, MARCOS E LIBERAÇÕES', [['1.1', 'MARCOS CONTRATUAIS'], ['1.2', 'LICENCIAMENTO E LIBERAÇÕES'], ['1.3', 'GERENCIAMENTO']]],
    ['2', 'ENGENHARIA', []],
    ['3', 'SUPRIMENTOS', []],
    ['4', 'CONSTRUÇÃO', [['4.1', 'CANTEIRO, MOBILIZAÇÃO E INFRAESTRUTURA'], ['4.2', 'OBRAS CIVIS'], ['4.3', 'MONTAGEM ELETROMECÂNICA'], ['4.4', 'INSTALAÇÕES ELÉTRICAS'], ['4.5', 'SUBESTAÇÃO, LINHA E CONEXÃO']]],
    ['5', 'COMISSIONAMENTO E ENERGIZAÇÃO', []],
    ['6', 'ENCERRAMENTO', []]];
  var REGRAS = [
    ['1.1', /\bMARCOS?\b|MILESTONE|ASSINATURA|\bL?NTP\b|ORDEM DE (SERVICO|INICIO)|\bCOD\b|\bPAC\b|\bFAC\b|CERTIFICATE|EVENTOGRAMA|\bMOU\b|TERM SHEET|\bCONTRATO\b/],
    ['1.2', /LICENC|LICENSE|LIBERACAO|ANUENCIA|IPHAN|\bASV\b|OUTORGA|AUTORIZAC|SEGURO|PERMIT|POLIGONAL LICENC/],
    ['6', /AS ?BUILT|DESMOBILIZ|ATIVIDADES FINAIS|ENCERRAM|PENDENC|PUNCH|DATA ?BOOK|COMPLETION|ACEITE FINAL|\bPRAD\b/],
    ['5', /COMISSION|COMMISSION|ENERGIZ|ENSAIO|\bTESTES?\b|START ?UP|OPERACAO ASSISTIDA|PERFORMANCE RATIO|APTAS? A CONEX|PRE.?COMISS|PRE ENERG|LIMPEZA DE MODULOS/],
    ['3', /FORNECIMENT|SUPPLY|AQUISIC|\bCOMPRAS?\b|SUPRIMENT|ENTREGA|FABRICAC|RECEBIMENTO|DILIGENC|INSPECAO EM FABRICA|\bFAT\b/],
    ['2', /ENGENHARIA|ENGINEERING|PROJETO|PROJETOS|DESIGN|ESTUDO|LEVANTAMENTO|SONDAGE|TOPOGRAF|DRILLING|SOIL|EMISSAO|APROVACAO|DOCUMENT|LAYOUT|FOLHA DE DADOS/],
    ['4.1', /CANTEIRO|CONSTRUCTION SITE|ACESSO EXTERNO|ENTROCAMENTO|ENTRONCAMENTO|MOBILIZAC|MOBILIZATION|ALOJAMENTO|INSTALACOES PROVISORIAS|USINA DE CONCRETO|CENTRAL DE CONCRETO/],
    ['4.3', /ESTACA|CRAVAC|\bPILES?\b|TRACKER|RASTREAD|MODULO|PAINEIS|INVERSOR|INVESOR|ESTRUTURA METAL|ELETROMEC|MECHANICAL|STRING BOX|MONTAGEM MECANICA|MONTAGEM D[OE]S? AEROGERADOR|ICAMENTO|NACELE|ROTOR/],
    ['4.4', /ELETRIC|ELECTRIC|\bCABOS?\b|CABLE|\bVALAS?\b|TRENCH|ATERRAMENTO|GROUNDING|BTCA|BTCC|\bMT\b|\bRMT\b|\bFO\b|FIBRA|OPTIC|ELETROCENTRO|SKID|\bPOSTES?\b|CFTV|SCADA|ILUMINAC|METEOROL|TERMINAC|SPDA|TRANSICAO|MEDIA TENSAO|REDE AEREA|REDE SUBTERRANEA/],
    ['4.2', /CIVI|SUPRESS|VEGETA|TERRAPLEN|REGULARIZ|DRENAG|CERCA|FENCE|ACESSO|\bBASES?\b|FUNDAC|CONCRET|ESCAVAC|PAVIMENT|ROCAG|ALVENARIA|EDIFICAC|ARRUAMENTO|BUEIRO|CANAIS|BACIAS|DISSIPADOR|SUBLEITO|SUBBASE|SUB-BASE|PLATAFORMA|DESMONTE|ATERRO|MEIO FIO|SARJETA|VALETA|DESCIDA D|ARMACAO|FORMA|SOLO CIMENTO|IMPERMEAB|REATERRO|LASTRO|DESFORMA|CIMBRAMENTO/],
    ['4.5', /SUBESTAC|SUBSTATION|\bSE\b|\bBAYS?\b|TRANSFORMADOR|\bTRAFO|\bLT\b|LINHA DE TRANSMISS|SECCIONAMENTO|\bGRID\b|CONEXAO|PORTICO|\bMVG\b/],
    ['1.3', /GERENCI|ADMINISTRA|MANAGEMENT|GESTAO|PLANEJAMENTO|QUALIDADE|SEGURANCA|SSMA|MEIO AMBIENTE|SOCIAL|VIGILANCIA/]];
  var GENERICO = /^(CRONOGRAMA|CONSTRUCAO|CONSTRUCTION|GERAL|OBRAS?$|EXECUCAO|IMPLANTACAO|PROJETO PV|DELEGACAO|COD PV|CONSTRUCAO\/MONTAGEM|BOP\b|PARQUE EOLICO)/;
  var FASE_FIXA = ['1.1', '1.2', '2', '3', '5', '6'];
  var FASE = /^(MARCOS?( CONTRATUAIS| GERAIS| INTERMEDIARIOS| CRITICOS)?|FORNECIMENTOS?( DE EQUIPAMENTOS PRINCIPAIS)?|SUPRIMENTOS?|ENGENHARIA|PROJETOS?( EXECUTIVOS)?|COMISSIONAMENTO|ATIVIDADES FINAIS|OBRAS? CIVIS|MONTAGEM ELETROMECANICA|INSTALACOES ELETRICAS|ENCERRAMENTO|LICENCIAMENTOS?( AMBIENTAIS)?|MILESTONES( DO CONTRATO)?|COMISSIONAMENTO A FRIO|COMISSIONAMENTO A QUENTE)$/;
  function classe(n) { var s = SA(n); for (var i = 0; i < REGRAS.length; i++) if (REGRAS[i][1].test(s)) return REGRAS[i][0]; return null; }
  var topo = function (b) { return b ? b.split('.')[0] : null; };

  /* reorganiza as tarefas na EAP padrão; mantém UIDs, vínculos e datas das tarefas de execução */
  function padronizar(tasks, opt) {
    opt = opt || {};
    var by = {}, kids = {}, ordem = {};
    tasks.forEach(function (t, i) { by[t.u] = t; ordem[t.u] = i; (kids[t.p] = kids[t.p] || []).push(t); });
    var raiz = tasks.filter(function (t) { return t.l === 0; })[0] || null;
    var folhasDe = function (t) { var r = []; (function f(x) { var k = kids[x.u]; if (!k || !k.length) { if (!x.s) r.push(x); return; } k.forEach(f); })(t); return r; };
    var mov = [], ignorados = 0;
    var visitar = function (t, ctxB, ctxL) {
      var own = classe(t.n), k = kids[t.u] || [];
      if (!k.length) { mov.push({ t: t, b: own || ctxB || '1.3', ctx: ctxL }); return; }
      var gen = t.l <= 1 || GENERICO.test(SA(t.n).trim());
      if (!gen && own) {
        var fl = folhasDe(t), cl = fl.map(function (x) { return classe(x.n); }).filter(Boolean), ag = cl.filter(function (b) { return topo(b) === topo(own); }).length;
        if (FASE_FIXA.indexOf(own) >= 0 || !cl.length || ag / cl.length >= 0.5) {
          if (FASE.test(SA(t.n).split('|')[0].trim())) k.forEach(function (c) { mov.push({ t: c, b: own, ctx: ctxL }); });
          else mov.push({ t: t, b: own, ctx: ctxL });
          return;
        }
      }
      var lab = gen ? ctxL : (ctxL ? ctxL + ' | ' : '') + String(t.n).trim();
      if (!gen && t.l >= 2 && !own) lab = (ctxL ? ctxL + ' | ' : '') + String(t.n).trim();
      if (!gen && t.l >= 2 && own) lab = (ctxL ? ctxL + ' | ' : '') + String(t.n).trim();
      k.forEach(function (c) { visitar(c, own || ctxB, lab); });
    };
    (raiz ? kids[raiz.u] || [] : tasks.filter(function (t) { return !by[t.p]; })).forEach(function (t) { visitar(t, null, null); });
    /* nova árvore */
    var maxU = tasks.reduce(function (a, t) { return Math.max(a, t.u); }, 0), novos = {}, NOVO = {};
    var R = raiz ? Object.assign({}, raiz) : { u: ++maxU, n: opt.titulo || 'PROJETO', s: 1 };
    R.l = 0; R.p = -1; R.w = '0'; R._f = []; NOVO[R.u] = R;
    var no = function (nome, pai, chave, op) { if (novos[chave]) return novos[chave]; var x = { u: ++maxU, n: nome, s: 1, _f: [] }; if (op) x.op = op; else x.cx = 1; novos[chave] = x; NOVO[x.u] = x; pai._f.push(x); return x; };
    EAP.forEach(function (e) { no(e[1], R, e[0], e[0]); e[2].forEach(function (s2) { no(s2[1], novos[e[0]], s2[0], s2[0]); }); });
    mov.sort(function (a, b) { return ordem[a.t.u] - ordem[b.t.u]; });
    mov.forEach(function (m) { var pai = novos[m.b] || novos[topo(m.b)] || novos['1.3']; if (m.ctx) pai = no(m.ctx, pai, m.b + '|' + m.ctx); pai._f.push(m.t); });
    var cheio = function (x) { return !NOVO[x.u] || x._f.some(cheio); };
    var res = [];
    var cp0 = Object.assign({}, R); delete cp0._f; res.push(cp0);
    var anda = function (x, w, l) {
      var filhos = NOVO[x.u] ? x._f.filter(cheio) : (kids[x.u] || []);
      var n = 0; filhos.forEach(function (c) { var cw = c.op || ((w ? w + '.' : '') + (++n)), cp = Object.assign({}, c); delete cp._f; cp.w = cw; cp.l = l; cp.p = x.u; res.push(cp); anda(c, cw, l + 1); });
    };
    anda(R, '', 1);
    /* vínculos para tarefas removidas */
    var vivos = {}; res.forEach(function (t) { vivos[t.u] = 1; });
    var linksPerdidos = 0;
    res.forEach(function (t) { if (t.pr) { var a = t.pr.length; t.pr = t.pr.filter(function (r) { return vivos[r[0]]; }); linksPerdidos += a - t.pr.length; if (!t.pr.length) delete t.pr; } });
    /* resumos: datas e custos pelos filhos */
    var k2 = {}; res.forEach(function (t) { (k2[t.p] = k2[t.p] || []).push(t); });
    var mn = function (a, b) { return !a ? b : !b ? a : a < b ? a : b; }, mx = function (a, b) { return !a ? b : !b ? a : a > b ? a : b; };
    for (var i = res.length - 1; i >= 0; i--) {
      var t = res[i], f = k2[t.u]; if (!f) continue;
      t.s = 1; var i0 = null, f0 = null, bi = null, bf = null, as = null, af = null, todosAf = true, bc = 0, c = 0, ph = 0, pcw = 0, dw = 0;
      f.forEach(function (x) { i0 = mn(i0, x.i); f0 = mx(f0, x.f); bi = mn(bi, x.bi); bf = mx(bf, x.bf); as = mn(as, x.as); if (x.af) af = mx(af, x.af); else todosAf = false; bc += x.bc || 0; c += (x.c != null ? x.c : x.bc) || 0; var d = Math.max(1, x.dm || 0); pcw += (x.pc || 0) * d; dw += d; ph += (x.pf != null ? x.pf : x.pc || 0) * ((x.bc || 0) || d); });
      t.i = i0; t.f = f0; if (bi) t.bi = bi; if (bf) t.bf = bf; if (as) t.as = as; else delete t.as; if (af && todosAf) t.af = af; else delete t.af;
      t.bc = Math.round(bc * 100) / 100; if (Math.abs(c - bc) > 0.005) t.c = Math.round(c * 100) / 100; else delete t.c;
      t.pc = dw ? Math.round(pcw / dw * 10) / 10 : 0;
      if (i0 && f0) { var dd = (Date.parse(f0.slice(0, 10)) - Date.parse(i0.slice(0, 10))) / 864e5 + 1; t.dm = Math.round(dd * 5 / 7) * (opt.mpd || 480); }
      if (bi && bf) { var db = (Date.parse(bf.slice(0, 10)) - Date.parse(bi.slice(0, 10))) / 864e5 + 1; t.bdm = Math.round(db * 5 / 7) * (opt.mpd || 480); }
      delete t.ct; delete t.cd; delete t.m;
    }
    return { tasks: res, linksPerdidos: linksPerdidos, movidos: mov.length };
  }

  /* macroatividades (mesma regra da tela): resumo que reúne as tarefas de execução de uma mesma atividade */
  function macros(tasks) {
    var by = {}, kids = {}, seg1 = function (n) { return SA(String(n || '').split('|')[0]).trim(); }, macro = {}, lm = {}, stem = {};
    tasks.forEach(function (t) { by[t.u] = t; (kids[t.p] = kids[t.p] || []).push(t); });
    /* atividade comum de todas as tarefas de execução de cada nó (ou null quando misturadas) */
    for (var i = tasks.length - 1; i >= 0; i--) {
      var t = tasks[i], k = kids[t.u];
      if (!k || !k.length) stem[t.u] = String(t.n).indexOf('|') >= 0 ? seg1(t.n) : null;
      else { var s0 = stem[k[0].u]; stem[t.u] = s0 && k.every(function (c) { return stem[c.u] === s0; }) ? s0 : null; }
    }
    var livre = function (x) { return x && !x.op && !x.cx && x.l >= 2; };
    tasks.forEach(function (t) {
      if (t.s) return;
      var x = t, y = t, temPadrao = false; while (y) { if (y.op) { temPadrao = true; break; } y = by[y.p]; }
      if (stem[t.u]) { while (livre(by[x.p]) && stem[x.p] === stem[t.u]) x = by[x.p]; if (x === t && livre(by[t.p])) x = by[t.p]; while (x.s && livre(by[x.p]) && seg1(by[x.p].n) === seg1(x.n)) x = by[x.p]; }
      else if (temPadrao) { while (livre(by[x.p])) x = by[x.p]; if (x === t && by[t.p] && by[t.p].cx) x = by[t.p]; }
      else if (livre(by[t.p])) x = by[t.p];
      macro[x.u] = 1; lm[t.u] = x.u;
    });
    return { by: by, kids: kids, macro: macro, lm: lm };
  }
  function bucketDe(t, by) { var x = t; while (x) { if (x.op) return x.op; x = by[x.p]; } return null; }

  /* ---------- CPUs paramétricas por MWp (UFV) ---------- */
  var PARAM_UFV = [
    { id: 'FORN_MOD', nome: 'Recebimento e descarga de módulos', re: /MODUL|PAINEIS/, b: ['3'], cpu: '02.01.01.01.01', base: 'MWP', k: 1538, un: 'UN' },
    { id: 'FORN_TRK', nome: 'Recebimento de trackers', re: /TRACKER|RASTREAD/, b: ['3'], cpu: '02.01.01.04.01', base: 'MWP', k: 18.3, un: 'UN' },
    { id: 'FORN_INV', nome: 'Recebimento de inversores string', re: /INVERSOR|STRING INVERTER|SUN2000/, b: ['3'], cpu: '02.01.01.02.01', base: 'MWP', k: 2.6, un: 'UN' },
    { id: 'FORN_ELC', nome: 'Recebimento de eletrocentros', re: /ELETROCENTRO|SKID|POWER STATION|JUPITER/, b: ['3'], cpu: '02.01.01.03.01', base: 'MWP', k: 0.11, un: 'UN' },
    { id: 'MONT_MOD', nome: 'Montagem de módulos', re: /MODUL|PAINEIS/, b: ['4.3'], cpu: '02.02.01.01.01', base: 'MWP', k: 1538, un: 'UN' },
    { id: 'MONT_TRK', nome: 'Montagem de trackers', re: /TRACKER|RASTREAD|ESTRUTURA/, b: ['4.3'], cpu: '02.02.01.04.01', base: 'MWP', k: 18.3, un: 'UN' },
    { id: 'MONT_INV', nome: 'Montagem de inversores string', re: /INVERSOR|INVESOR/, b: ['4.3'], cpu: '02.02.01.02.01', base: 'MWP', k: 2.6, un: 'UN' },
    { id: 'MONT_ELC', nome: 'Posicionamento de eletrocentros', re: /(ELETROCENTRO|SKID|POWER STATION).*(POSICION|MONTAG|INSTALA)|(POSICION|MONTAG|INSTALA).*(ELETROCENTRO|SKID)/, b: ['4.3', '4.4'], cpu: '02.02.01.03.01', base: 'MWP', k: 0.11, un: 'UN' },
    { id: 'CABO_CC', nome: 'Lançamento de cabos BT CC', re: /(BTCC|SOLAR|STRING|\bCC\b).*(CABO|LANCAMENTO)|(CABO|LANCAMENTO).*(BTCC|\bCC\b)/, nao: /VALA/, b: ['4.4'], cpu: '02.02.03.01.01', base: 'MWP', k: 3000, un: 'MT' },
    { id: 'CABO_CA', nome: 'Lançamento de cabos BT CA', re: /(BTCA|\bCA\b).*(CABO|LANCAMENTO)|(CABO|LANCAMENTO).*(BTCA|\bCA\b)/, nao: /VALA/, b: ['4.4'], cpu: '02.02.03.02.01', base: 'MWP', k: 900, un: 'MT' },
    { id: 'CABO_MT', nome: 'Cabos de média tensão subterrâneos', re: /(\bMT\b|MEDIA TENSAO|\bRMT\b).*(SUBTERR|CABO|LANCAMENTO)|(SUBTERR|CABO|LANCAMENTO).*(\bMT\b|MEDIA TENSAO)/, nao: /AEREA|AERIAL|VALA|TERMINAC|FORNEC/, b: ['4.4'], cpu: '02.02.03.03.01', base: 'MWP', k: 250, un: 'MT' },
    { id: 'RMT_AER', nome: 'Rede de MT aérea', re: /AEREA|AERIAL|\bMVG\b/, b: ['4.4', '4.5'], cpu: '02.02.03.04.01', base: 'MWP', k: 60, un: 'MT' },
    { id: 'CABO_FO', nome: 'Cabos de fibra óptica', re: /\bFO\b|FIBRA|OPTIC/, nao: /AEREA/, b: ['4.4'], cpu: '02.02.03.06.01', base: 'MWP', k: 300, un: 'MT' },
    { id: 'ATERR', nome: 'Cabos de aterramento', re: /ATERRAMENTO|GROUNDING/, b: ['4.4'], cpu: '02.02.03.05.01', base: 'MWP', k: 1500, un: 'MT' },
    { id: 'VALA_CC', nome: 'Valas de cabos BT CC', re: /VALA.*(BTCC|\bCC\b)|(BTCC|\bCC\b).*VALA/, b: ['4.4', '4.2'], cpu: '02.02.06.01', base: 'MWP', k: 400, un: 'M3' },
    { id: 'VALA_CA', nome: 'Valas de cabos BT CA', re: /VALA.*(BTCA|\bCA\b)|(BTCA|\bCA\b).*VALA/, b: ['4.4', '4.2'], cpu: '02.02.06.02', base: 'MWP', k: 150, un: 'M3' },
    { id: 'VALA_MT', nome: 'Valas de cabos de MT', re: /VALA.*(\bMT\b|MEDIA)|(\bMT\b|MEDIA).*VALA/, b: ['4.4', '4.2'], cpu: '02.02.06.03', base: 'MWP', k: 120, un: 'M3' },
    { id: 'CERCA', nome: 'Cercamento perimetral', re: /CERCA|FENCE|CERCAMENTO/, b: ['4.2', '4.1'], cpu: '02.03.01.01', base: 'RAIZ', k: 506, un: 'MT' },
    { id: 'SUPR', nome: 'Supressão vegetal', re: /SUPRESS|VEGETA|DESMATAM/, b: ['4.2'], cpu: '02.03.02.01', base: 'MWP', k: 1600, un: 'M3' },
    { id: 'TERRA_C', nome: 'Terraplenagem – corte', re: /TERRAPLEN|REGULARIZ.*AREA|\bCORTE\b/, b: ['4.2'], cpu: '02.03.06.01', base: 'MWP', k: 800, un: 'M3' },
    { id: 'TERRA_A', nome: 'Terraplenagem – aterro', re: /TERRAPLEN|REGULARIZ.*AREA|ATERRO/, b: ['4.2'], cpu: '02.03.06.02', base: 'MWP', k: 800, un: 'M3' },
    { id: 'ACES_SB', nome: 'Acessos – sub-base e subleito', re: /ACESSO|ESTRADA|SUBLEITO|SUBBASE|SUB-BASE/, b: ['4.2', '4.1'], cpu: '02.03.07.01', base: 'MWP', k: 100, un: 'M3' },
    { id: 'ACES_B', nome: 'Acessos – base', re: /ACESSO|ESTRADA|\bBASE DOS? ACESSOS?|EXECUCAO DA BASE/, b: ['4.2', '4.1'], cpu: '02.03.07.02', base: 'MWP', k: 150, un: 'M3' },
    { id: 'DREN', nome: 'Drenagem superficial (valetas)', re: /DRENAG|CANAIS|BACIAS|VALETA|BUEIRO|DISSIPADOR|ESCADAS? HIDRAUL/, b: ['4.2'], cpu: '02.03.08.01.03', base: 'MWP', k: 150, un: 'MT' },
    { id: 'BASE_MET', nome: 'Bases das estações meteorológicas', re: /METEOROL|SOLARIMETR/, b: ['4.4', '4.2'], cpu: '02.03.09.30', base: 'MWP', k: 0.01, un: 'UN' },
    { id: 'MET', nome: 'Torres solarimétricas', re: /METEOROL|SOLARIMETR/, b: ['4.4', '3'], cpu: '02.02.02.03.03', base: 'MWP', k: 0.01, un: 'UN' },
    { id: 'SCADA', nome: 'Sistema SCADA', re: /SCADA/, b: ['4.4'], cpu: '02.02.02.02.01', base: 'FIXO', k: 1, un: 'UN' },
    { id: 'CFTV', nome: 'CFTV (verba)', re: /CFTV|CAMERA/, b: ['4.4'], cpu: '05.01.07', base: 'FIXO', k: 1, un: 'VB' },
    { id: 'CANT', nome: 'Canteiro de obras', re: /CANTEIRO|CONSTRUCTION SITE|ALOJAMENTO/, b: ['4.1'], cpu: '02.02.11.01', base: 'FIXO', k: 1, un: 'UN' },
    { id: 'MOB', nome: 'Mobilização e desmobilização', re: /MOBILIZ/, b: ['4.1', '6', '1.3'], cpu: '02.02.09.02', base: 'FIXO', k: 1, un: 'UN' },
    { id: 'GER', nome: 'Gerenciamento de campo', re: /GERENCI|ADMINISTRA|MANAGEMENT/, b: ['1.3'], cpu: '02.02.09.01', base: 'FIXO', k: 1, un: 'UN' },
    { id: 'SEG', nome: 'Seguros', re: /SEGURO/, b: ['1.2'], cpu: '02.02.09.03', base: 'FIXO', k: 1, un: 'UN' },
    { id: 'PROJ', nome: 'Projeto executivo', re: /PROJETO|EMISSAO|DESIGN|ENGENHARIA|ENGINEERING/, nao: /AS ?BUILT/, b: ['2'], cpu: '02.02.10.01', base: 'FIXO', k: 1, un: 'UN' },
    { id: 'EST', nome: 'Ensaios e estudos', re: /ESTUDO|ENSAIOS? DE CAMPO|LEVANTAMENTO|SONDAG|TOPOGRAF|SOIL|DRILLING/, b: ['2'], cpu: '02.02.10.03', base: 'FIXO', k: 1, un: 'UN' },
    { id: 'ASB', nome: 'As built', re: /AS ?BUILT/, b: ['6', '2'], cpu: '02.02.10.02', base: 'FIXO', k: 1, un: 'UN' },
    { id: 'COMIS', nome: 'Comissionamento a frio e a quente', re: /COMISSION|COMMISSION|ENERGIZ/, nao: /LIMPEZA|ROCAG/, b: ['5'], cpu: '02.02.09.05', base: 'FIXO', k: 1, un: 'UN' },
    { id: 'LIMP', nome: 'Limpeza de módulos', re: /LIMPEZA/, b: ['5'], cpu: '02.02.09.06', base: 'FIXO', k: 1, un: 'UN' },
    { id: 'PR', nome: 'Ensaio de performance ratio', re: /PERFORMANCE|\bPR\b/, b: ['5'], cpu: '02.02.09.07', base: 'FIXO', k: 1, un: 'UN' },
    { id: 'OPA', nome: 'Operação assistida', re: /OPERACAO ASSISTIDA/, b: ['5', '6'], cpu: '02.02.09.08', base: 'FIXO', k: 1, un: 'VB' }];
  function qtdRegra(r, mwp) { var k = +r.k || 0; return r.base === 'FIXO' ? k : r.base === 'RAIZ' ? k * Math.sqrt(Math.max(0, mwp)) : k * mwp; }
  /* distribui as quantidades das regras entre as macroatividades e monta a CPU de cada uma (CPU do projeto, unidade VB) */
  function gerarCpus(tasks, P, sigla, existe) {
    var M = macros(tasks), mwp = +P.mwp || 0, regras = P.regras || [], margem = +P.margem || 0, comps = {}, links = {}, usos = {}, semRegra = [];
    var macs = Object.keys(M.macro).map(function (u) { return M.by[u]; }).sort(function (a, b) { return String(a.w).localeCompare(String(b.w), undefined, { numeric: true }); });
    var vOwn = {}; tasks.forEach(function (t) { if (!t.s && M.lm[t.u] != null) vOwn[M.lm[t.u]] = (vOwn[M.lm[t.u]] || 0) + (t.bc || 0); });
    var vendaDe = function (t) { return vOwn[t.u] || 0; };
    var info = macs.map(function (t) { return { t: t, nome: SA(t.n), b: bucketDe(t, M.by), v: vendaDe(t) }; });
    var porRegra = {};
    if (mwp > 0) regras.forEach(function (r) {
      if (r.off) return;
      var re = r._re || (PARAM_UFV.filter(function (x) { return x.id === r.id; })[0] || {}).re, nao = (PARAM_UFV.filter(function (x) { return x.id === r.id; })[0] || {}).nao;
      if (!re) return;
      var alvo = info.filter(function (m) { return m.b && r.b.some(function (b) { return m.b === b || m.b.indexOf(b + '.') === 0 || b.indexOf(m.b + '.') === 0 && false; }) && re.test(m.nome) && !(nao && nao.test(m.nome)); });
      if (!alvo.length) return;
      if (existe && !existe(r.cpu)) return;
      var Q = qtdRegra(r, mwp), tv = alvo.reduce(function (a, m) { return a + m.v; }, 0);
      porRegra[r.id] = alvo.length;
      alvo.forEach(function (m) { var q = tv ? Q * m.v / tv : Q / alvo.length; (usos[m.t.u] = usos[m.t.u] || []).push({ t: 'AUX', i: r.cpu, k: Math.round(q * 1e4) / 1e4, r: r.id }); });
    });
    info.forEach(function (m) {
      var cod = sigla + '-' + m.t.w, it = usos[m.t.u] || [];
      if (!it.length) { semRegra.push(m.t.u); it = [{ t: 'OUT', i: 'META', k: Math.round(m.v * (1 - margem) * 100) / 100, r: 'META' }]; }
      comps[cod] = { c: cod, d: String(m.t.n).toUpperCase().slice(0, 300), u: 'VB', tp: 'C', it: it, pj: P.pid, mu: m.t.u };
      links[m.t.u] = [{ c: cod, q: 1 }];
    });
    return { comps: comps, links: links, semRegra: semRegra, porRegra: porRegra, nMacros: macs.length };
  }
  function regrasPadrao() { return PARAM_UFV.map(function (r) { return { id: r.id, nome: r.nome, cpu: r.cpu, base: r.base, k: r.k, un: r.un, b: r.b.slice() }; }); }
  var api = { SA: SA, EAP: EAP, classe: classe, padronizar: padronizar, macros: macros, bucketDe: bucketDe, PARAM_UFV: PARAM_UFV, regrasPadrao: regrasPadrao, qtdRegra: qtdRegra, gerarCpus: gerarCpus };
  root.OPPadrao = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
