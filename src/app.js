(function () {
'use strict';
var E = window.CustoEngine;

/* ================= utilidades ================= */
var $ = function (s, r) { return (r || document).querySelector(s); };
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
var nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
var nfq = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
var nf4 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });
var money = function (v) { return nf2.format(v || 0); };
var int = function (v) { return nf0.format(v || 0); };
var qty = function (v) { return nfq.format(v || 0); };
var pct = function (v) { return nf2.format((v || 0) * 100) + '%'; };
var zero = function (v, f) { return v ? f(v) : '-'; };
var compact = function (v) {
  v = v || 0; var a = Math.abs(v);
  if (a >= 1e9) return nf2.format(v / 1e9) + ' bi';
  if (a >= 1e6) return nf2.format(v / 1e6) + ' mi';
  if (a >= 1e3) return nfq.format(Math.round(v / 100) / 10) + ' mil';
  return nf0.format(v);
};
/* formatos de data, hora e moeda (Configurações › Formatos e moeda; gravados em base/empresa.fmt) */
var MOEDAS = [['BRL', 'R$', 'Real brasileiro'], ['USD', 'US$', 'Dólar americano'], ['EUR', '€', 'Euro'], ['GBP', '£', 'Libra esterlina'], ['CLP', 'CLP$', 'Peso chileno'], ['ARS', 'AR$', 'Peso argentino'], ['MXN', 'MX$', 'Peso mexicano'], ['COP', 'COL$', 'Peso colombiano'], ['PEN', 'S/', 'Sol peruano'], ['CNY', '¥', 'Yuan chinês']];
var MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function fmtCfg() { var e = typeof S !== 'undefined' && S.base && S.base.empresa; return (e && e.fmt) || {}; }
var fdate = function (d) {
  if (d == null) return '–'; var p = E.ymd(d), dd = ('0' + p[2]).slice(-2), mm = ('0' + (p[1] + 1)).slice(-2), f = fmtCfg().data;
  if (f === 'aaaa-mm-dd') return p[0] + '-' + mm + '-' + dd;
  if (f === 'mm/dd/aaaa') return mm + '/' + dd + '/' + p[0];
  if (f === 'dd/mm/aa') return dd + '/' + mm + '/' + String(p[0]).slice(2);
  if (f === 'dd.mm.aaaa') return dd + '.' + mm + '.' + p[0];
  if (f === 'dd-mmm-aaaa') return dd + '-' + MES3[p[1]] + '-' + p[0];
  return dd + '/' + mm + '/' + p[0];
};
function fhora(h0, m0) { var hh = Math.floor(num(h0)), mm = Math.round(num(m0)); if (mm >= 60) { hh += 1; mm -= 60; } var z = function (x) { return (x < 10 ? '0' : '') + x; }; if (fmtCfg().hora === '12') return ((hh % 12) || 12) + ':' + z(mm) + (hh % 24 < 12 ? ' AM' : ' PM'); return z(hh) + ':' + z(mm); }
function moedaSim() { var c = fmtCfg().moeda || 'BRL'; return (MOEDAS.filter(function (m) { return m[0] === c; })[0] || MOEDAS[0])[1]; }
function moedaAplica(html) { var sim = moedaSim(); return sim === 'R$' || !html ? html : html.replace(/R\$/g, sim); }
var fiso = function (s) { return fdate(E.day(s)); };
var parseNum = function (s) {
  if (typeof s === 'number') return s;
  s = String(s || '').trim().replace(/\s|R\$/g, '');
  if (s === '') return 0;
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  var n = parseFloat(s); return isFinite(n) ? n : 0;
};
var numIn = function (v) { return v === 0 || v == null || v === '' ? '' : nf4.format(v).replace(/\./g, ''); };
var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };
var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
var semAcento = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase(); };
var num = E.num;
var CORES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)', 'var(--s9)'];

/* ================= estado ================= */
var S = {
  pronto: false, semDb: false, erroCarga: '',
  papel: { dono: false, nome: '' },
  base: {}, ctx: null, projetos: [],
  v: { aba: 'PROJETOS', pid: null, nivel: 3, busca: '', dlg: null, msg: null, ghe: '', filtro: { his: { tipo: 0, valor: 'GERAL' }, det: { tipo: 0, valor: 'GERAL' } } },
  cache: {}
};
var db = null, usr = null, dl = null;
/* ganchos usados pela versão independente (Supabase); na página do Claude ficam nulos */
var telaExtra = null, rotuloPapel = null;
var podeEditar = function () {
  if (!db) return false; var pr0 = proj(); if (pr0 && pr0._rev) return false; if (ehAdmin()) return true;
  var a = S.v.aba; if (a === 'PROJETOS' || USR_ADMIN_ABAS.indexOf(a) >= 0) return false;
  if (a === 'CONFIG' && ['proj', 'cal', 'clima', 'reaj'].indexOf(S.v.cfg || 'proj') < 0) return false;
  return nivelAba(a) === 'E' && nivelProj(proj()) === 'E';
};
/* permissões: o dono e os usuários marcados como administradores editam tudo; os demais seguem o Cadastro de usuários */
var USR_ADMIN_ABAS = ['SIS', 'DADOS', 'CLI', 'USR'], USR_BANCO_ABAS = ['CPU', 'MAO', 'VEM', 'MAT', 'IND', 'SER', 'EPI', 'PCMSO', 'GHE', 'SESMT'];
function ehAdmin() { return !!(S.papel && (S.papel.dono || S.papel.admin)); }
function nivelAba(a) {
  if (ehAdmin()) return 'E'; if (a === 'MANUAL') return 'V'; if (USR_ADMIN_ABAS.indexOf(a) >= 0) return '';
  var P = S.perm; if (!P) return 'V';
  var v = P.secoes && P.secoes[a] != null ? P.secoes[a] : P.secPadrao == null ? 'V' : P.secPadrao;
  if (v === 'E' && USR_BANCO_ABAS.indexOf(a) >= 0) v = 'V'; return v || '';
}
function nivelProj(p) {
  if (ehAdmin()) return 'E'; if (!p) return 'V';
  var P = S.perm; if (!P) return 'V'; var pid = p._orig || p.id;
  var v = P.projetos && P.projetos[pid] != null ? P.projetos[pid] : P.projPadrao == null ? '' : P.projPadrao; return v || '';
}
function podeGravar(path) {
  if (!db) return false; if (/\/revs\//.test(path)) return false; var pr0 = proj(); if (pr0 && pr0._rev) return false; if (ehAdmin()) return true;
  var m = /^projetos\/([^/]+)/.exec(path); if (!m) { if (!S._avisoAdm) { S._avisoAdm = 1; setTimeout(function () { aviso('Somente administradores alteram bancos de dados, composições e cadastros do sistema. A alteração não foi gravada.'); S._avisoAdm = 0; }, 50); } return false; }
  var p = S.projetos.filter(function (x) { return x.id === m[1]; })[0]; return !!p && nivelProj(p) === 'E' && podeEditar();
}

/* ================= persistência ================= */
var fila = new Map(), falhas = 0;
function statusSalvar() {
  var el = $('#save'); if (!el) return;
  var pend = fila.size;
  el.hidden = !podeEditar();
  el.className = 'chip' + (falhas ? ' crit' : pend ? ' warn' : '');
  el.textContent = falhas ? 'Erro ao salvar' : pend ? 'Salvando…' : 'Salvo';
}
function gravar(path, data) {
  if (!podeGravar(path)) return;
  var q = fila.get(path) || { ver: 0 };
  q.data = data; q.del = data === null; q.ver++;
  fila.set(path, q);
  clearTimeout(q.timer);
  q.timer = setTimeout(function () { descarregar(path); }, 600);
  statusSalvar();
}
function descarregar(path) {
  var q = fila.get(path); if (!q || q.busy) return;
  q.busy = true;
  var ver = q.ver, p;
  try {
    if (q.del) p = db.doc(path).delete();
    else {
      var body = clone(q.data), tam = JSON.stringify(body).length;
      if (tam > 240000) { msgbox('AVISO!', 'Este cadastro ficou grande demais para salvar (' + int(tam / 1024) + ' KB). Divida a atividade ou reduza observações.'); }
      p = db.doc(path).set(body);
    }
  } catch (e) { p = Promise.reject(e); }
  p.then(function () {
    q.busy = false; falhas = 0;
    if (q.ver !== ver) descarregar(path); else fila.delete(path);
    statusSalvar();
  }, function (e) {
    q.busy = false; falhas++;
    console.error('falha ao salvar', path, e);
    statusSalvar();
    if (falhas < 4) setTimeout(function () { descarregar(path); }, 2500);
    else { fila.delete(path); msgbox('ERRO CRÍTICO!', 'Não foi possível salvar: ' + ((e && e.message) || 'erro desconhecido') + '.\nRecarregue a página antes de continuar.', 'crit'); }
  });
}
var raiz = function (p) { return p.liberado ? 'projetos' : 'rascunhos'; };
function metaDe(p) { var m = {}; Object.keys(p).forEach(function (k) { if (k !== 'atividades' && k !== 'id' && k.charAt(0) !== '_') m[k] = p[k]; }); return m; }
/* base de preços própria do projeto (ex.: obra concluída importada da planilha com os preços da época) */
var BASE_P = ['mao', 'vem', 'mat', 'ind', 'ser', 'ghe', 'tabelas'];
/* blocos de custo exibidos: Materiais/ferramentas (3) e Indiretos/insumos (5) aparecem juntos como MATERIAIS E INSUMOS.
   O cálculo continua por linha: o tipo/relação escolhido define a regra (material ou insumo). */
var CV = [{ item: 'A', nome: 'MAO DE OBRA', k: 'MAO', cs: [1] }, { item: 'B', nome: 'VEICULOS / MAQUINAS', k: 'VEM', cs: [2] }, { item: 'C', nome: 'MATERIAIS E INSUMOS', k: 'MAT', cs: [3, 5] }, { item: 'D', nome: 'AQUISICAO / COMPRAS', k: 'AQU', cs: [4] }, { item: 'E', nome: 'SERVICOS TERCEIRIZADOS', k: 'SER', cs: [6] }];
function pcV(pc) { return CV.map(function (C) { return C.cs.reduce(function (a, i) { return a + (num(pc[i - 1]) || 0); }, 0); }); }
function cvIdx(c) { for (var i = 0; i < CV.length; i++) if (CV[i].cs.indexOf(c) >= 0) return i; return -1; }
function cvDe(c) { return CV[cvIdx(c)]; }
/* elementos de custo de um bloco, com o código renumerado (C1…C6 para materiais e insumos) */
function elemsDe(C) { var n = 0; return E.ELEMENTOS.filter(function (e) { return C.cs.indexOf('ABCDEF'.indexOf(e[0][0]) + 1) >= 0; }).map(function (e) { return { k: e[0], cod: C.item + (++n), nome: e[1] }; }); }
/* tipo / relação no bloco MATERIAIS E INSUMOS: OUTROS existe nas duas listas */
function relRot(l) { return l.rel === 'OUTROS' && (l.c === 3 || l.c === 5) ? 'OUTROS - ' + (l.c === 5 ? 'INSUMO' : 'MATERIAL') : l.rel; }
function relOpsMI() { var t = S.base.tabelas, a = (t.relacao.MAT || []).filter(function (x) { return x !== 'OUTROS'; }), b = (t.relacao.IND || []).filter(function (x) { return x !== 'OUTROS'; }); return a.concat(['OUTROS - MATERIAL'], b, ['OUTROS - INSUMO']); }
function relSetMI(l, v) {
  var t = S.base.tabelas;
  if (v === 'OUTROS - MATERIAL') { l.c = 3; l.rel = 'OUTROS'; return; }
  if (v === 'OUTROS - INSUMO') { l.c = 5; l.rel = 'OUTROS'; return; }
  if ((t.relacao.IND || []).indexOf(v) >= 0) l.c = 5; else if ((t.relacao.MAT || []).indexOf(v) >= 0) l.c = 3;
  l.rel = v;
}
function empresaRot() { var e = S.base.empresa || {}; return e.razao ? (e.marca ? e.marca + ' · ' : '') + e.razao + (e.cnpj ? ' · CNPJ ' + e.cnpj : '') : 'OP CONSULTING'; }
function unificado() { return !!(S.base.mat && S.base.mat.unificado); }
function temBaseP(p) { return !!(p && p._base && p._base.mao); }
function baseDe(p) {
  if (!temBaseP(p)) return S.base;
  var b = {}; Object.keys(S.base).forEach(function (k) { b[k] = S.base[k]; });
  BASE_P.forEach(function (k) { if (k !== 'tabelas' && p._base[k]) b[k] = p._base[k]; });
  b.tabelas = Object.assign({}, S.base.tabelas, p._base.tabelas || {});
  return b;
}
function ctxDe(p) { if (!temBaseP(p)) return ctx(); if (!p._ctx) p._ctx = E.prepare(baseDe(p)); return p._ctx; }
function dirP(p) { return p._dir || (p._raiz + '/' + p.id); }
function salvarBaseP(p) { limpaCache(p.id); p._ctx = null; BASE_P.forEach(function (k) { if (p._base && p._base[k]) gravar(dirP(p) + '/base/' + k, p._base[k]); }); }
function apagarBaseP(p, raizP) { BASE_P.forEach(function (k) { gravar((raizP || p._raiz) + '/' + p.id + '/base/' + k, null); }); }
function ativDoc(a) { var m = {}; Object.keys(a).forEach(function (k) { if (k !== 'id') m[k] = a[k]; }); return m; }
function gruposDe(p) { return p && p.grupos && p.grupos.length ? p.grupos : S.base.tabelas.atividades; }
function salvarMeta(p) { limpaCache(p.id); gravar(dirP(p), metaDe(p)); }
function salvarAtiv(p, a) { limpaCache(p.id); gravar(dirP(p) + '/ativ/' + a.id, ativDoc(a)); }
function apagarAtiv(p, a) { limpaCache(p.id); gravar(dirP(p) + '/ativ/' + a.id, null); }
/* bancos de dados sempre em ordem alfabética (descrição); linhas sem descrição ficam no fim */
var ordAlfa = (function () { var co = typeof Intl !== 'undefined' ? new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true }) : null; return function (a, b) { a = String(a || '').trim(); b = String(b || '').trim(); if (!a !== !b) return a ? -1 : 1; return co ? co.compare(a, b) : (a < b ? -1 : a > b ? 1 : 0); }; })();
function ordenaBanco(rows) { if (rows && rows.length > 1) rows.sort(function (x, y) { return ordAlfa(x.d, y.d); }); return rows; }
/* bancos grandes (MAO, VEM, MAT, IND, SER) ficam divididos no banco de dados em base/mat, base/mat_2… e são reunidos na memória */
var BANCOS_P = ['mao', 'vem', 'mat', 'ind', 'ser'];
function bancosJuntar() {
  S._bkN = S._bkN || {};
  BANCOS_P.forEach(function (b) {
    var re = new RegExp('^' + b + '_(\\d+)$'), ks = Object.keys(S.base).filter(function (k) { return re.test(k); }).sort(function (x, y) { return +x.split('_')[1] - +y.split('_')[1]; });
    if (!ks.length) return;
    if (!S.base[b]) S.base[b] = { rows: [] };
    ks.forEach(function (k) { S.base[b].rows = (S.base[b].rows || []).concat(S.base[k].rows || []); delete S.base[k]; });
    S._bkN[b] = Math.max(S._bkN[b] || 1, +ks[ks.length - 1].split('_')[1]);
  });
}
function bancoSalvar(k) {
  S._bkN = S._bkN || {};
  var b = S.base[k], parts = [[]], sz = 0;
  (b.rows || []).forEach(function (r) { var z = JSON.stringify(r).length; if (sz + z > 170000 && parts[parts.length - 1].length) { parts.push([]); sz = 0; } parts[parts.length - 1].push(r); sz += z; });
  var cab = {}; Object.keys(b).forEach(function (x) { if (x !== 'rows') cab[x] = b[x]; }); cab.rows = parts[0];
  gravar('base/' + k, cab);
  for (var i = 1; i < parts.length; i++) gravar('base/' + k + '_' + (i + 1), { rows: parts[i] });
  for (var j = parts.length + 1; j <= (S._bkN[k] || 1); j++) gravar('base/' + k + '_' + j, null);
  S._bkN[k] = parts.length;
}
function salvarBase(k) { if (/^(mao|vem|mat|ind|ser)_\d+$/.test(k)) return; if (/^(mao|vem|mat|ind|ser)$/.test(k) && S.base[k]) ordenaBanco(S.base[k].rows); if (k === 'cpuins') return cpuSalvarIns(); S.ctx = null; S.cache = {}; S.projetos.forEach(function (p) { p._ctx = null; }); if (BANCOS_P.indexOf(k) >= 0 && S.base[k]) return bancoSalvar(k); gravar('base/' + k, S.base[k]); }
function limpaCache(pid) { delete S.cache[pid]; if (S.revcD && S.revcD[pid]) S.revcD[pid].atual = null; }
function moverProjeto(p, liberado) {
  var antigo = p._raiz;
  p.liberado = liberado; p._raiz = raiz(p);
  if (antigo === p._raiz) return salvarMeta(p);
  gravar(p._raiz + '/' + p.id, metaDe(p));
  p.atividades.forEach(function (a) { gravar(p._raiz + '/' + p.id + '/ativ/' + a.id, ativDoc(a)); gravar(antigo + '/' + p.id + '/ativ/' + a.id, null); });
  if (temBaseP(p)) { salvarBaseP(p); apagarBaseP(p, antigo); }
  croMover(p, antigo); mapaMover(p, antigo); revMover(p, antigo); subMover(p, antigo);
  gravar(antigo + '/' + p.id, null);
}
function excluirProjeto(p) {
  p.atividades.forEach(function (a) { gravar(p._raiz + '/' + p.id + '/ativ/' + a.id, null); });
  if (temBaseP(p)) apagarBaseP(p);
  croExcluir(p); mapaExcluir(p); revExcluir(p); subExcluir(p);
  gravar(p._raiz + '/' + p.id, null);
  S.projetos = S.projetos.filter(function (x) { return x !== p; });
  limpaCache(p.id);
}

function carregar() {
  var cap = window.claude && window.claude.use ? window.claude : null;
  if (!cap) { S.semDb = true; S.pronto = true; return Promise.resolve(); }
  return Promise.all([cap.use('db'), cap.use('user'), cap.use('downloads')]).then(function (r) {
    db = r[0]; usr = r[1]; dl = r[2];
    if (!db) { S.semDb = true; return; }
    return (usr ? usr.me() : Promise.resolve({ isOwner: false, name: '' })).then(function (me) {
      S.papel = { dono: !!me.isOwner, nome: me.name || '', email: me.email || '', uid: me.id || '' };
      if (me.id && db) try { db.doc('acessos/' + me.id).set({ u: new Date().toISOString() }).catch(function () { }); } catch (e) { }
      return lerTudo();
    });
  }).catch(function (e) { console.error(e); S.erroCarga = (e && e.message) || String(e); }).then(function () { S.pronto = true; });
}
function lerTudo() {
  S.base = {}; S.projetos = []; S.clientes = []; S.cache = {}; S.ctx = null;
  /* rascunhos: lidos por todos os administradores (dono e marcados no Cadastro de usuários); quem não pode ler recebe erro ou lista vazia */
  var raizes = ['projetos', 'rascunhos'];
  return db.collection('base').get().then(function (snap) {
    snap.docs.forEach(function (d) { S.base[d.id] = clone(d.data()); }); cpuInsJuntar(); bancosJuntar();
    return Promise.all(raizes.map(function (rz) {
      return db.collection(rz).get().catch(function () { return { docs: [] }; }).then(function (ps) {
        return Promise.all(ps.docs.map(function (d) {
          var p = clone(d.data()); p.id = d.id; p._raiz = rz; p.liberado = rz === 'projetos'; p.atividades = [];
          S.projetos.push(p);
          return db.collection(rz + '/' + d.id + '/ativ').get().then(function (as) {
            as.docs.forEach(function (x) { var a = clone(x.data()); a.id = x.id; a.linhas = a.linhas || []; p.atividades.push(a); });
          }).then(function () {
            if (!p.basePropria) return;
            return db.collection(rz + '/' + d.id + '/base').get().then(function (bs) { if (bs.docs.length) { p._base = {}; bs.docs.forEach(function (x) { p._base[x.id] = clone(x.data()); }); } });
          });
        }));
      });
    }));
  }).then(function () {
    S.projetos.sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome)); });
    return db.collection('clientes').get().then(function (cs) { cs.docs.forEach(function (d) { var c = clone(d.data()); c.id = d.id; S.clientes.push(c); }); }, function () { });
  }).then(function () {
    return db.collection('usuarios').get().then(function (us) { S.usuarios = []; S.usrCfg = {}; us.docs.forEach(function (d) { var u = clone(d.data()); u.id = d.id; if (d.id === '_cfg') S.usrCfg = u; else S.usuarios.push(u); }); }, function () { S.usuarios = []; S.usrCfg = {}; });
  }).then(function () { usrAplicar(); });
}
/* identifica o usuário no cadastro (conta vinculada ou e-mail) e aplica as permissões */
function usrAplicar() {
  S.perm = null; S.papel.admin = false; S.papel.reg = null; if (S.papel.dono) return;
  var em = String(S.papel.email || '').trim().toLowerCase(), u = (S.usuarios || []).filter(function (x) { return (S.papel.uid && x.uid === S.papel.uid) || (em && String(x.email || '').trim().toLowerCase() === em); })[0];
  if (u) { S.papel.reg = u; if (u.admin) { S.papel.admin = true; return; } S.perm = u; }
  else if ((S.usrCfg || {}).semCadastro === 'N') S.perm = { secoes: {}, projetos: {}, secPadrao: '', projPadrao: '', semCadastro: true };
  S.projetos = S.projetos.filter(function (p) { return p._raiz !== 'rascunhos'; });
  if (S.perm) S.projetos = S.projetos.filter(function (p) { return nivelProj(p) !== ''; });
}
var baseOk = function () { return !!(S.base.tabelas && S.base.mao); };
function ctx() { if (!S.ctx) S.ctx = E.prepare(S.base); return S.ctx; }
function proj() { var p = S.projetos.filter(function (p) { return p.id === S.v.pid; })[0] || null; var rv = S.v.revVer; if (p && rv && rv.pid === p.id && S.revs && S.revs[p.id + '@' + rv.n]) return S.revs[p.id + '@' + rv.n]; return p; }
function calc(p) {
  var c = S.cache[p.id];
  if (!c) { var cx = ctxDe(p), res = E.calc(p, cx); c = S.cache[p.id] = { res: res, fin: E.fin(p, cx, res) }; }
  return c;
}

/* ================= render e eventos ================= */

var HS = [], ED = {}, pend = false, proxima = null, abrirDepois = null;
function h(fn) { HS.push(fn); return 'data-h="' + (HS.length - 1) + '"'; }
function agendar() { if (pend) return; pend = true; setTimeout(function () { pend = false; render(); }, 0); }
var ABAS = [['PROJETOS', '#7a7a7a'], ['FIN', '#005a9c'], ['COM', '#005a9c'], ['INP', '#005a9c'], ['CRO', '#005a9c'], ['LPS', '#005a9c'], ['LOB', '#005a9c'], ['CPU', '#d61d1d'], ['MAO', '#d61d1d'], ['VEM', '#d61d1d'], ['MAT', '#d61d1d'], ['IND', '#d61d1d'], ['SER', '#d61d1d'],
  ['EPI', '#0c9b74'], ['PCMSO', '#0c9b74'], ['GHE', '#0c9b74'], ['SESMT', '#0c9b74'], ['HIS', '#5a4475'], ['DET', '#5a4475'], ['GRA', '#5a4475'], ['RELA', '#005a9c'], ['RELT', '#5a4475'], ['RELP', '#5a4475'], ['RELC', '#5a4475'], ['RELS', '#0c9b74'], ['CONFIG', '#000000', 'DADOS DO PROJETO'], ['SIS', '#000000', 'CONFIGURAÇÕES']];
var PRECISA_PROJ = { INP: 1, RELA: 1, RELT: 1, RELP: 1, RELC: 1, RELS: 1, CRO: 1, LPS: 1, LOB: 1, FIN: 1, COM: 1, EPI: 1, PCMSO: 1, SESMT: 1, HIS: 1, DET: 1, GRA: 1 };

/* mensagens e confirmações (equivalentes ao MsgBox da planilha) */
function msgbox(titulo, texto, tipo, sim) { S.v.msg = { titulo: titulo, texto: texto, tipo: tipo || 'info', sim: sim || null }; agendar(); }
function confirma(texto, sim) { msgbox('ATENÇÃO!', texto, 'perg', sim); }
function aviso(t) { msgbox('AVISO!', t); }
/* troca de projeto sempre confirmada, para não editar o projeto errado */
/* tema claro / escuro / automático (preferência deste navegador) */
var TEMA_K = 'pp-tema';
function temaLer() { try { return localStorage.getItem(TEMA_K) || 'auto'; } catch (e) { return S.temaMem || 'auto'; } }
function temaAplica() {
  var t = temaLer(), esc = t === 'escuro' || (t === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', esc ? 'dark' : 'light');
  if (PALETAS[t]) document.documentElement.setAttribute('data-paleta', t); else document.documentElement.removeAttribute('data-paleta');
  document.documentElement.setAttribute('data-fonte', fonteLer());
  /* cores fixas dos gráficos em SVG */
  if (typeof G_CARD !== 'undefined') { G_CARD = esc ? '#19212c' : '#ffffff'; G_GRADE = esc ? '#2b3544' : '#e8edf4'; G_EIXO = esc ? '#3a4556' : '#c3ccd8'; G_TOTAL = esc ? '#2a3b57' : '#cfe0fb'; }
  if (typeof KPC_COR !== 'undefined') { KPC_COR.lb = esc ? '#7d9cf0' : '#2f4d9e'; KPC_COR.bpl = esc ? '#4a5a74' : '#c9d9ef'; KPC_COR.bre = esc ? '#3f8a58' : '#9fd5ad'; }
}
/* temas suaves (variações do claro) e tamanho da letra */
var PALETAS = { verde: ['Verde', '#eef4ef', '#2f8a5b'], rosa: ['Rosa', '#f8eff2', '#c4547a'], amarelo: ['Amarelo', '#f8f4e6', '#a87a12'], lilas: ['Lilás', '#f2f0f8', '#7b61c4'], areia: ['Areia', '#f6f1ec', '#b8683a'] };
var FONTE_K = 'pp-fonte';
function fonteLer() { try { return localStorage.getItem(FONTE_K) || 'n'; } catch (e) { return S.fonteMem || 'n'; } }
function fonteGrava(f) { S.fonteMem = f; try { localStorage.setItem(FONTE_K, f); } catch (e) { } temaAplica(); agendar(); }
function temaGrava(t) { S.temaMem = t; try { localStorage.setItem(TEMA_K, t); } catch (e) { } temaAplica(); agendar(); }
try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (temaLer() === 'auto') temaAplica(); }); } catch (e) { }
/* idioma da interface: português (original), inglês ou espanhol — tradução aplicada sobre a tela já montada */
var IDI_K = 'pp-idioma', IDI = { l: null, M: null, RE: null, C: null, obs: null };
function idiLer() { try { return localStorage.getItem(IDI_K) || 'pt'; } catch (e) { return S.idiMem || 'pt'; } }
function idiPrep() {
  var l = idiLer(); if (IDI.l === l) return; IDI.l = l; IDI.M = null; IDI.RE = null; IDI.C = new Map();
  document.documentElement.lang = l === 'en' ? 'en' : l === 'es' ? 'es' : 'pt-BR';
  if (l === 'pt' || typeof I18N === 'undefined' || !I18N[l]) return;
  var M = new Map(), ks = []; I18N.pt.forEach(function (k, i) { var v = I18N[l][i]; if (v && v !== k) { M.set(k, v); if (k.length >= 6 && /\s/.test(k.trim())) ks.push(k); } });
  ks.sort(function (a, b) { return b.length - a.length; });
  IDI.M = M; IDI.RE = new RegExp('(^|[^A-Za-zÀ-ÿ])(' + ks.map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')(?![A-Za-zÀ-ÿ])', 'g');
}
function idiTxt(s) {
  var t = s.trim(); if (!t || /^[\d\s.,%R$\-–+×÷:()\/]+$/.test(t)) return s;
  var c = IDI.C.get(s); if (c != null) return c;
  var n = t.replace(/\s+/g, ' '), v = IDI.M.get(n), r, m;
  if (v == null && (m = n.match(/^([\d.,%()+\-–\s]*)(.*?)([\s:·|–\-]*[\d.,%()\s]*[:·|–\-]?)$/)) && m[2]) { var w = IDI.M.get(m[2]); if (w != null) v = m[1] + w + m[3]; }
  r = v != null ? s.replace(t, v) : s.replace(IDI.RE, function (a0, a, b) { return a + IDI.M.get(b); });
  if (IDI.C.size > 20000) IDI.C.clear(); IDI.C.set(s, r); return r;
}
function idiNo(n) {
  if (n.nodeType === 3) { if (n.__tr === n.nodeValue) return; var p = n.parentNode; if (!p || /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName) || (p.closest && p.closest('.notr,[contenteditable]'))) return; var v = idiTxt(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; n.__tr = n.nodeValue; return; }
  if (n.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.nodeName) || n.classList.contains('notr')) return;
  var w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT), x, L = []; while ((x = w.nextNode())) L.push(x); L.forEach(idiNo);
  var at = function (e) { ['placeholder', 'title', 'aria-label', 'data-tip'].forEach(function (a) { var v = e.getAttribute(a); if (v && e['__tr_' + a] !== v) { var t = idiTxt(v); if (t !== v) e.setAttribute(a, t); e['__tr_' + a] = t; } }); };
  if (n.hasAttribute && (n.hasAttribute('placeholder') || n.hasAttribute('title') || n.hasAttribute('aria-label') || n.hasAttribute('data-tip'))) at(n);
  Array.prototype.forEach.call(n.querySelectorAll('[placeholder],[title],[aria-label],[data-tip]'), at);
}
function idiAplica() {
  idiPrep(); if (!IDI.M) { if (IDI.obs) { IDI.obs.disconnect(); IDI.obs = null; } return; }
  idiNo(document.body);
  if (!IDI.obs && window.MutationObserver) {
    IDI.obs = new MutationObserver(function (ms) { if (!IDI.M) return; ms.forEach(function (m) { if (m.type === 'characterData') idiNo(m.target); else Array.prototype.forEach.call(m.addedNodes, idiNo); if (m.type === 'attributes') idiNo(m.target); }); });
    IDI.obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label', 'data-tip'] });
  }
}
function idiGrava(l) { try { localStorage.setItem(IDI_K, l); } catch (e) { S.idiMem = l; } if (l === 'pt') { IDI.l = null; idiPrep(); render(); } else { IDI.l = null; idiAplica(); render(); } }
function shSis() { return shTabelas(proj(), 'sis'); }
function shSisPref() {
  var t = temaLer(), op = function (k, rot, sub, a, b, c) { return '<label class="' + (t === k ? 'on' : '') + '"><input type="radio" name="tema"' + (t === k ? ' checked' : '') + ' ' + h(function () { temaGrava(k); }) + '><span class="tema-pv" style="background:' + a + '"><i style="background:' + b + '"></i><i style="background:linear-gradient(' + a + ' 30%,' + c + ' 30% 60%,' + a + ' 60%)"></i></span><b>' + rot + '</b><small class="vz">' + sub + '</small></label>'; };
  var semP = !proj();
  return '' +
    cfgCard('Tema', 'Aparência de todo o sistema neste navegador.', '<div class="tema-op" role="radiogroup" aria-label="Tema">' + op('claro', 'Claro', 'fundo claro', '#edf0f5', '#ffffff', '#1769e8') + op('escuro', 'Escuro', 'fundo escuro', '#0f141c', '#19212c', '#4d8dff') + op('auto', 'Automático', 'segue o sistema do computador', 'linear-gradient(90deg,#edf0f5 50%,#0f141c 50%)', '#7b8799', '#4d8dff') + Object.keys(PALETAS).map(function (k) { var x = PALETAS[k]; return op(k, x[0], 'tom suave', x[1], '#ffffff', x[2]); }).join('') + '</div>') +
    cfgCard('Tamanho da letra', 'Aumenta ou diminui textos, tabelas e botões de todo o sistema neste navegador.', '<div class="tema-op fonte-op" role="radiogroup" aria-label="Tamanho da letra">' + [['p', 'Menor', 13], ['n', 'Normal', 16], ['g', 'Maior', 19]].map(function (x) { var f = fonteLer(); return '<label class="' + (f === x[0] ? 'on' : '') + '"><input type="radio" name="fonte"' + (f === x[0] ? ' checked' : '') + ' ' + h(function () { fonteGrava(x[0]); }) + '><span class="fonte-pv" style="font-size:' + x[2] + 'px">Aa</span><b>' + x[1] + '</b></label>'; }).join('') + '</div>') +
    cfgCard('Formatos e moeda', 'Valem para todos os usuários e projetos. A moeda troca o símbolo exibido nos valores (não converte câmbio); o preço dos bancos de dados continua o cadastrado.', (function () {
      var F = fmtCfg(), ed = podeEditar(), grava = function (k, v) { var e = S.base.empresa || (S.base.empresa = {}); e.fmt = Object.assign({}, e.fmt || {}); e.fmt[k] = v; salvarBase('empresa'); agendar(); };
      var hoje = E.day(new Date().toISOString().slice(0, 10)), ex = function (f) { var o = (S.base.empresa || {}).fmt, sv = o && o.data; if (!S.base.empresa) S.base.empresa = {}; S.base.empresa.fmt = Object.assign({}, o || {}, { data: f }); var r = fdate(hoje); S.base.empresa.fmt = o; if (o) o.data = sv; return r; };
      var sel = function (k, ops, val) { return '<select aria-label="' + k + '"' + (ed ? '' : ' disabled') + ' ' + h(function (el) { grava(k, el.value); }) + '>' + ops.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === val ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; };
      return '<div class="cf">' + '<div class="fd"><label>Formato da data</label>' + sel('data', [['dd/mm/aaaa', 'dd/mm/aaaa'], ['dd/mm/aa', 'dd/mm/aa'], ['dd.mm.aaaa', 'dd.mm.aaaa'], ['dd-mmm-aaaa', 'dd-mmm-aaaa'], ['mm/dd/aaaa', 'mm/dd/aaaa (EUA)'], ['aaaa-mm-dd', 'aaaa-mm-dd (ISO)']].map(function (o) { return [o[0], o[1] + ' · ' + ex(o[0])]; }), F.data || 'dd/mm/aaaa') + '</div>' +
        '<div class="fd"><label>Formato da hora</label>' + sel('hora', [['24', '24 horas · 14:30'], ['12', '12 horas · 2:30 PM']], F.hora || '24') + '</div>' +
        '<div class="fd"><label>Moeda padrão dos projetos</label>' + sel('moeda', MOEDAS.map(function (m) { return [m[0], m[1] + ' · ' + m[2] + ' (' + m[0] + ')']; }), F.moeda || 'BRL') + '</div></div>';
    })()) +
    cfgCard('Idioma', 'Idioma de todo o sistema neste navegador. Nomes cadastrados (atividades, insumos, funções) ficam como foram digitados.', '<div class="idi-op" role="radiogroup" aria-label="Idioma">' + [['pt', 'Português', 'Brasil', 'PT'], ['en', 'English', 'Inglês', 'EN'], ['es', 'Español', 'Espanhol', 'ES']].map(function (x) { var l = idiLer(); return '<label class="notr' + (l === x[0] ? ' on' : '') + '"><input type="radio" name="idioma"' + (l === x[0] ? ' checked' : '') + ' ' + h(function () { idiGrava(x[0]); }) + '><span class="idi-sg">' + x[3] + '</span><b>' + x[1] + '</b></label>'; }).join('') + '</div>');
}
function trocaProj(id, depois) {
  var at = proj(), nv = S.projetos.filter(function (x) { return x.id === id; })[0];
  var ir = function () { S.v.pid = id || null; if (depois) depois(); agendar(); };
  if (!at || !id || at.id === id) return ir();
  confirma('Você tem certeza que deseja alterar o projeto\n\nde:  ' + at.nome + '\npara:  ' + (nv ? nv.nome : id) + ' ?', ir);
}

function render() {
  var ae = document.activeElement, fid = ae && ae.id ? ae.id : null, selp = null;
  var tws = Array.prototype.map.call(document.querySelectorAll('.tw[id]'), function (t) { return [t.id, t.scrollLeft, t.scrollTop]; }), main = $('#main'), st = main.scrollTop, sl = main.scrollLeft;
  try { if (fid && ae.tagName === 'INPUT' && ae.type === 'text') selp = ae.selectionStart; } catch (e) { }
  HS = []; ED = {};
  $('#rib').innerHTML = moedaAplica(faixa());
  $('#abas').innerHTML = guias();
  main.innerHTML = moedaAplica(pagina());
  var ov = $('#ov'), jan = janelas();
  ov.hidden = !jan; ov.innerHTML = jan;
  statusSalvar();
  main.scrollTop = st; main.scrollLeft = sl;
  tws.forEach(function (t) { var el = document.getElementById(t[0]); if (el) { el.scrollLeft = t[1]; el.scrollTop = t[2]; } });
  if (document.getElementById('tw-cpul')) cpuVirt();
  if (document.getElementById('mapa-svg')) mapaEscala();
  listas();
  var alvo = abrirDepois || proxima || fid, el = alvo && document.getElementById(alvo);
  if (el) { try { el.focus({ preventScroll: !(abrirDepois || proxima) }); if (selp != null && el.setSelectionRange) el.setSelectionRange(selp, selp); } catch (e) { } }
  if (abrirDepois && el) { var a = abrirDepois; abrirDepois = null; proxima = null; abrir(el); void a; }
  if (S._focoProx) { var fx = document.getElementById(S._focoProx); if (fx) { S._focoProx = null; fx.focus(); try { fx.select(); } catch (e) { } } }
  abrirDepois = null; proxima = null;
  if (IDI.M || idiLer() !== 'pt') idiAplica();
}
function despacha(e, tipo) {
  var el = e.target.closest('[data-h]'); if (!el) return;
  var campo = /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && el.type !== 'checkbox' && el.type !== 'radio';
  if (tipo === 'click' && (campo || el.type === 'checkbox' || el.type === 'radio')) return;
  if (tipo === 'change' && !campo && el.type !== 'checkbox' && el.type !== 'radio') return;
  var fn = HS[+el.dataset.h]; if (fn) fn(el, e);
}
document.addEventListener('click', function (e) {
  var td = e.target.closest && e.target.closest('td.e');
  if (td && !td.querySelector('input,select')) { abrir(td); return; }
  despacha(e, 'click');
});
document.addEventListener('change', function (e) { if (e.target.closest('td.e')) return; despacha(e, 'change'); });
var liveT = null;
document.addEventListener('input', function (e) { if (e.target.dataset && e.target.dataset.live) { clearTimeout(liveT); liveT = setTimeout(function () { despacha(e, 'change'); }, 250); } });
document.addEventListener('mouseover', function (e) {
  var t = e.target.closest && e.target.closest('[data-tip]'), tip = $('#tip');
  if (!t) { tip.hidden = true; return; }
  tip.textContent = t.getAttribute('data-tip'); tip.hidden = false;
  var r = t.getBoundingClientRect(), w = tip.offsetWidth, hh = tip.offsetHeight;
  tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
  tip.style.top = (r.top - hh - 8 < 8 ? r.bottom + 8 : r.top - hh - 8) + 'px';
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && !e.target.closest('td.e')) { if (S.v.msg) { S.v.msg = null; agendar(); } else if (S.v.dlg) { S.v.dlg = null; agendar(); } return; }
  var td = e.target;
  if (!td.classList || !td.classList.contains('e') || td.tagName !== 'TD') return;
  var mov = { ArrowRight: 'right', ArrowLeft: 'left', ArrowDown: 'down', ArrowUp: 'up', Tab: e.shiftKey ? 'left' : 'right' }[e.key];
  if (mov) { var v = vizinho(td, mov); if (v) { e.preventDefault(); document.getElementById(v).focus(); } return; }
  if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); abrir(td); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { var sp = ED[td.id]; if (sp && !sp.o.ops) { e.preventDefault(); sp.set(sp.o.t && sp.o.t !== 'text' && sp.o.t !== 'date' ? 0 : ''); proxima = td.id; agendar(); } return; }
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { var s2 = ED[td.id]; if (s2 && !s2.o.ops && s2.o.t !== 'date') { e.preventDefault(); abrir(td, e.key); } else abrir(td); }
});

/* ---------- células ---------- */
function horaTxt(v) { v = num(v); var hh = Math.floor(v), mm = Math.round((v - hh) * 60); return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm; }
function fmtCel(v, o) {
  var t = o.t;
  if (o.rotulos) return esc(o.rotulos[v] || (v == null ? '' : v));
  if (o.fmt) return v ? esc(o.fmt(v)) : '-';
  if (t === 'money') return v ? money(v) : '-';
  if (t === 'num') return v ? nf4.format(v) : '-';
  if (t === 'int') return v ? int(v) : '-';
  if (t === 'pct') return nf2.format(num(v) * 100) + '%';
  if (t === 'hora') { var vh = num(v); return fhora(Math.floor(vh), (vh - Math.floor(vh)) * 60); }
  if (t === 'date') return v ? fiso(v) : '';
  return esc(v == null ? '' : v);
}
var DIR = { money: 1, num: 1, int: 1, pct: 1, hora: 1 };
/* célula: editável para o administrador (clique, Enter ou digitação), texto para os demais */
function cel(id, valor, set, o) {
  o = o || {};
  var cls = (DIR[o.t] ? 'n ' : o.t === 'date' || o.c ? 'c ' : '') + (o.cls || ''), extra = (o.tip ? ' data-tip="' + esc(o.tip) + '"' : '') + (o.st ? ' style="' + o.st + '"' : '');
  if (!podeEditar() || o.ro || !set) return '<td class="' + cls + '"' + extra + '>' + fmtCel(valor, o) + '</td>';
  ED[id] = { v: valor, set: set, o: o };
  return '<td id="' + id + '" class="e ' + cls + '" tabindex="0"' + extra + '>' + fmtCel(valor, o) + '</td>';
}
function tdv(v, cls, tip) { return '<td class="' + (cls || '') + '"' + (tip ? ' data-tip="' + esc(tip) + '"' : '') + '>' + v + '</td>'; }
function vizinho(td, mov) {
  var tr = td.parentElement, alvo = null, i;
  if (mov === 'right' || mov === 'left') {
    var todos = Array.prototype.slice.call(td.closest('table').querySelectorAll('td.e')); i = todos.indexOf(td);
    alvo = todos[i + (mov === 'right' ? 1 : -1)];
  } else {
    var r = tr, ci = td.cellIndex;
    while ((r = mov === 'down' ? r.nextElementSibling : r.previousElementSibling)) { var c = r.cells[ci]; if (c && c.classList.contains('e')) { alvo = c; break; } }
  }
  return alvo ? alvo.id : null;
}
function abrir(td, inicial) {
  var sp = ED[td.id]; if (!sp) return;
  if (pend) { abrirDepois = td.id; return; }
  if (td.querySelector('input,select')) return;
  var o = sp.o, el, feito = false, t = o.t || 'text';
  if (o.ops) {
    el = document.createElement('select');
    var lista = o.ops.slice(); if (o.vazio != null) lista.unshift('');
    if (sp.v != null && sp.v !== '' && lista.indexOf(sp.v) < 0) lista.unshift(sp.v);
    lista.forEach(function (x) { var op = document.createElement('option'); op.value = x; op.textContent = x === '' ? (o.vazio || '') : (o.rotulos ? o.rotulos[x] || x : x); if (String(x) === String(sp.v == null ? '' : sp.v)) op.selected = true; el.appendChild(op); });
  } else {
    el = document.createElement('input'); el.type = t === 'date' ? 'date' : 'text';
    if (DIR[t]) { el.inputMode = 'decimal'; el.style.textAlign = 'right'; }
    if (o.list) el.setAttribute('list', o.list);
    el.value = inicial != null ? inicial : t === 'date' ? (sp.v || '') : t === 'pct' ? numIn(Math.round(num(sp.v) * 1e8) / 1e6) : t === 'hora' ? horaTxt(sp.v) : DIR[t] ? numIn(sp.v) : (sp.v == null ? '' : sp.v);
  }
  el.setAttribute('aria-label', o.rot || 'Valor');
  td.textContent = ''; td.appendChild(el); el.focus();
  if (el.select && inicial == null && t !== 'date') el.select();
  var commit = function (mov) {
    if (feito) return; feito = true;
    var v = el.value;
    if (!o.ops) {
      if (t === 'hora') { var m = /^(\d+):(\d+)$/.exec(v.trim()); v = m ? +m[1] + (+m[2]) / 60 : parseNum(v); }
      else if (t === 'pct') v = parseNum(v) / 100;
      else if (DIR[t]) v = parseNum(v);
      else if (t !== 'date') v = o.upper ? semAcento(v).trim() : v.trim();
    } else if (o.num) v = +v;
    var antes = sp.v == null ? (DIR[t] ? 0 : '') : sp.v;
    if (v !== antes) sp.set(v);
    proxima = (mov && vizinho(td, mov)) || td.id;
    agendar();
  };
  el.addEventListener('blur', function () { commit(null); });
  if (o.ops) el.addEventListener('change', function () { commit(null); });
  el.addEventListener('keydown', function (e) {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); commit(e.shiftKey ? 'up' : 'down'); }
    else if (e.key === 'Tab') { e.preventDefault(); commit(e.shiftKey ? 'left' : 'right'); }
    else if (e.key === 'Escape') { feito = true; proxima = td.id; agendar(); }
  });
}
/* cabeçalho de vários níveis: cada coluna tem h = [nível1, nível2, nível3]; rótulos iguais e vizinhos são mesclados */
function cabecalho(cols, niveis, extra) {
  var s = '', L, i;
  for (L = 0; L < niveis; L++) {
    s += '<tr>';
    for (i = 0; i < cols.length; i++) {
      var c = cols[i], hh = c.h || [];
      if (c.sp) { if (L === 0) s += '<th class="sp" rowspan="' + (niveis + (extra ? 1 : 0)) + '"></th>'; continue; }
      var rot = hh[L];
      if (rot == null) continue; // coberto por rowspan do nível acima
      var span = 1, j = i + 1, mesmo = function (a, b) { for (var k = 0; k <= L; k++) if ((a[k] || '') !== (b[k] || '')) return false; return true; };
      if (hh[L + 1] != null) while (j < cols.length && !cols[j].sp && cols[j].h && cols[j].h[L + 1] != null && mesmo(hh, cols[j].h)) { span++; j++; }
      var rs = hh[L + 1] == null ? niveis - L : 1;
      s += '<th' + (span > 1 ? ' colspan="' + span + '"' : '') + (rs > 1 ? ' rowspan="' + rs + '"' : '') + ' class="' + (c.fx || '') + '"' + (c.fst && span === 1 ? ' style="' + c.fst + '"' : '') + '>' + esc(rot) + '</th>';
      i = j - 1;
    }
    s += '</tr>';
  }
  return s;
}
function mesesCab(months) { return months.map(function (mi) { return E.MESES[mi % 12]; }); }
function mmaa(mi) { return ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][mi % 12] + '.' + String(Math.floor(mi / 12)).slice(2); }
function titulo(nome, extra) {
  var p = proj();
  return '<div class="a1">' + (p ? esc(p.nome) + (p.tensao ? ' (' + esc(String(p.tensao).replace('.', ',')) + ' KV)' : '') : 'CUSTO DE OBRAS') + '</div><div class="a2"><span>' + nome + '</span>' + (extra || '') + '</div>';
}

/* campos de formulário (janelas) */
function campo(id, valor, set, o) {
  o = o || {};
  var t = o.t || 'text';
  return '<input id="' + id + '" ' + (t === 'date' ? 'type="date"' : 'type="text"' + (t === 'num' ? ' inputmode="decimal"' : '')) + (o.off ? ' disabled' : '') + (o.live ? ' data-live="1"' : '') + ' value="' + esc(t === 'num' ? numIn(valor) : valor == null ? '' : valor) + '" ' +
    h(function (el) { var v = el.value; if (t === 'num') v = parseNum(v); else if (o.upper) { v = semAcento(v); } else v = v.trim(); set(v); agendar(); }) + '>';
}
function escolha(id, valor, ops, set, o) {
  o = o || {};
  return '<select id="' + id + '"' + (o.off ? ' disabled' : '') + ' ' + h(function (el) { var v = el.value; if (o.num) v = v === '' ? '' : +v; set(v); agendar(); }) + '><option value=""></option>' +
    ops.map(function (x) { return '<option value="' + esc(x) + '"' + (String(x) === String(valor) ? ' selected' : '') + '>' + esc(o.rotulos ? (o.rotulos[x] || x) : x) + '</option>'; }).join('') + '</select>';
}
function bt(rot, fn, cls, off) { return '<button class="bt ' + (cls || '') + '"' + (off ? ' disabled' : '') + ' ' + h(function (el, e) { fn(el, e); agendar(); }) + '>' + rot + '</button>'; }
function listas() {
  if (!baseOk()) return;
  var f = function (id, rows) { var el = document.getElementById(id); if (!el || el.dataset.n === String(rows.length)) return; el.innerHTML = rows.map(function (r) { return '<option value="' + esc(r.d) + '">'; }).join(''); el.dataset.n = rows.length; };
  var B = baseDe(proj()), ch = (proj() && temBaseP(proj()) ? proj().id : 'g') + ':';
  var f2 = function (id, rows) { var el = document.getElementById(id); if (el && el.dataset.n !== ch + rows.length) { el.dataset.n = ''; f(id, rows); el.dataset.n = ch + rows.length; } };
  f2('dl1', B.mao.rows); f2('dl2', B.vem.rows); f2('dl3', B.mat.rows); f2('dl5', B.mat && B.mat.unificado ? B.mat.rows : B.ind.rows); f2('dl6', B.ser.rows);
}
function invalidaListas() { ['dl1', 'dl2', 'dl3', 'dl5', 'dl6'].forEach(function (i) { var el = document.getElementById(i); if (el) el.dataset.n = ''; }); }

/* ---------- faixa de comandos ---------- */
var IC = {
  sobre: '<circle cx="16" cy="16" r="11" fill="none" stroke="#1769e8" stroke-width="2.4"/><rect x="14.6" y="14" width="2.8" height="9" fill="#1769e8"/><circle cx="16" cy="10.4" r="1.8" fill="#1769e8"/>',
  base: '<ellipse cx="16" cy="8.5" rx="9" ry="3.6" fill="#f4c542" stroke="#8a6d00" stroke-width="1.4"/><path d="M7 8.5v15c0 2 4 3.6 9 3.6s9-1.6 9-3.6v-15" fill="#fbe08a" stroke="#8a6d00" stroke-width="1.4"/><path d="M7 13.5c0 2 4 3.6 9 3.6s9-1.6 9-3.6M7 18.5c0 2 4 3.6 9 3.6s9-1.6 9-3.6" fill="none" stroke="#8a6d00" stroke-width="1.4"/>',
  ativ: '<rect x="6" y="5" width="20" height="23" rx="2" fill="#ffffff" stroke="#1769e8" stroke-width="2"/><path d="M10 12l2.3 2.3L16.5 10M10 20l2.3 2.3L16.5 18" fill="none" stroke="#2fc79b" stroke-width="2.2"/><path d="M19 12.5h4.5M19 20.5h4.5" stroke="#1769e8" stroke-width="2"/>',
  repl: '<rect x="5" y="7" width="22" height="20" rx="2" fill="#ffffff" stroke="#1769e8" stroke-width="2"/><rect x="5" y="7" width="22" height="6" fill="#1769e8"/><path d="M10 4v6M22 4v6" stroke="#1769e8" stroke-width="2.4"/><path d="M10 18h3M15 18h3M20 18h3M10 22.5h3M15 22.5h3" stroke="#f06a6a" stroke-width="2.4"/>',
  his: '<path d="M5 27h23" stroke="#7b8799" stroke-width="2"/><rect x="7" y="16" width="5" height="10" fill="#3d8ef5"/><rect x="14" y="8" width="5" height="18" fill="#f2b400"/><rect x="21" y="12" width="5" height="14" fill="#1769e8"/>',
  det: '<rect x="6" y="4" width="20" height="24" rx="2" fill="#ffffff" stroke="#b39ce0" stroke-width="2"/><path d="M10 10h12M10 15h12M10 20h8" stroke="#b39ce0" stroke-width="2"/><circle cx="22.5" cy="23" r="4.2" fill="#ffc81e" stroke="#8a6d00" stroke-width="1.2"/>',
  atu: '<path d="M25 13a9.5 9.5 0 0 0-17-3.5M7 19a9.5 9.5 0 0 0 17 3.5" fill="none" stroke="#2fc79b" stroke-width="2.8"/><path d="M8.5 3.5v7h7z" fill="#2fc79b"/><path d="M23.5 28.5v-7h-7z" fill="#2fc79b"/>',
  err: '<rect x="5" y="6" width="22" height="20" rx="2" fill="#ffffff" stroke="#7b8799" stroke-width="1.8"/><path d="M5 12h22M5 18h22M12 6v20" stroke="#7b8799" stroke-width="1.4"/><circle cx="23" cy="23" r="6.5" fill="#f06a6a"/><path d="M20 20l6 6M26 20l-6 6" stroke="#fff" stroke-width="2.2"/>',
  exp: '<rect x="4" y="7" width="17" height="18" rx="1.5" fill="#ffffff" stroke="#45c488" stroke-width="2"/><path d="M4 13h17M4 19h17M10 7v18" stroke="#45c488" stroke-width="1.5"/><path d="M19 16h9M24 11.5l4.5 4.5-4.5 4.5" fill="none" stroke="#e8790c" stroke-width="2.8"/>',
  usr: '<circle cx="12" cy="11" r="4.6" fill="#3d8ef5"/><path d="M3.5 26c0-5.5 3.8-8.5 8.500-8.500s8.500 3 8.500 8.500z" fill="#3d8ef5"/><circle cx="22.500" cy="12.500" r="3.600" fill="#9cc4fb"/><path d="M19 17.800c5.500-1.500 9.500 1.500 9.500 7.200h-6.500" fill="#9cc4fb"/>'
};
function rb(ic, rot, fn, off) { return '<button class="rb"' + (off ? ' disabled' : '') + ' ' + h(fn) + '><svg viewBox="0 0 32 32" aria-hidden="true">' + IC[ic] + '</svg><span>' + rot + '</span></button>'; }
var NOMES = { INP: 'Planilha de avanço', RELA: 'Relacionamento', RELT: 'Relatórios', RELP: 'Planejamento', RELC: 'Custo', RELS: 'SESMT', PROJETOS: 'Projetos', FIN: 'Cronograma financeiro', COM: 'CPU – Permanência', CRO: 'Cronograma físico', LPS: 'Last Planner (LPS)', LOB: 'Linhas de balanço (LoB)', CPU: 'CPU – Composições do Preço Unitário', MAO: 'Mão de obra', VEM: 'Veículos e máquinas', MAT: 'Materiais', IND: 'Insumos', SER: 'Serviços', EPI: 'EPI', PCMSO: 'Exames (PCMSO)', GHE: 'Grupos GHE', SESMT: 'SESMT', HIS: 'Histograma', DET: 'Custo detalhado', GRA: 'Painel de gráficos', CONFIG: 'Dados do projeto', SIS: 'Configurações' };
var GRUPOS_ABAS = [['', ['PROJETOS']], ['Projeto', ['CONFIG', 'GRA']], ['Planejamento', ['INP', 'CRO', 'LOB', 'MAP', 'R_KPC', 'R_KPI', 'HISP']], ['Custos', ['RELA', 'FIN', 'R_FC', 'R_DRE', 'R_PC', 'R_PV', 'R_MATV', 'R_DSLV']], ['Bancos de dados', ['CPU', 'MAO', 'VEM', 'MAT', 'IND', 'SER']], ['Relatórios', ['RELS']], ['Sistema', ['SIS']]];
/* cada relatório de planejamento e de custo é um item próprio do menu (R_<código>) */
(function () {
  var nm = { KPC: 'Controle de KPI', KPI: 'Indicadores físicos (KPI)', MO: 'Histograma de mão de obra', EQ: 'Histograma de equipamentos', MAT: 'Consumo de materiais', DSL: 'Histograma de diesel', FC: 'Fluxo de caixa', DRE: 'Demonstrativo econômico', PC: 'Planilha de custo', PV: 'Planilha de venda', MATV: 'Consumo de materiais (R$)', DSLV: 'Diesel (R$)' };
  Object.keys(nm).forEach(function (k) { NOMES['R_' + k] = nm[k]; PRECISA_PROJ['R_' + k] = 1; ABAS.push(['R_' + k, '#5a4475']); });
  NOMES.HISP = 'Histogramas'; PRECISA_PROJ.HISP = 1; ABAS.push(['HISP', '#5a4475']);
  NOMES.MAP = 'Mapas'; PRECISA_PROJ.MAP = 1; ABAS.push(['MAP', '#5a4475']);
})();
var ICA = {
  MAP: '<path d="M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
  HISP: '<path d="M4 20h16"/><rect x="5.5" y="11" width="3" height="9"/><rect x="10.5" y="6" width="3" height="14"/><rect x="15.5" y="13" width="3" height="7"/>',
  R_KPC: '<path d="M3 3v18h18"/><path d="M6 17c3-1 5-4 7-8s3.5-5 5.5-5"/><path d="M14 17h6" stroke-dasharray="1 2.5"/>',
  R_KPI: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/><circle cx="12" cy="17" r="1.2"/>',
  R_MO: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.6-3 2.8-5 5.5-5s4.9 2 5.5 5"/><path d="M17 20v-6M20 20v-9"/>',
  R_EQ: '<path d="M3 15V9h9v6M12 11h3l3 3v1"/><circle cx="6.5" cy="16.5" r="1.8"/><circle cx="15.5" cy="16.5" r="1.8"/>',
  R_MAT: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  R_DSL: '<path d="M12 3c3 4 6 7.3 6 10.5a6 6 0 0 1-12 0C6 10.3 9 7 12 3z"/>',
  R_FC: '<path d="M4 20h16"/><path d="M6 16l4-4 3 3 5-6"/><path d="M15 9h3v3"/>',
  R_DRE: '<path d="M6 3.5h12v17H6z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  R_PC: '<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5h17M9 9.5v10M15 9.5v10"/>',
  R_PV: '<path d="M20 12l-8 8-8.5-8.5V4h7.5z"/><circle cx="8" cy="8" r="1.4"/>',
  R_MATV: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M13.6 9.5c-.4-.6-1-.9-1.7-.9-1 0-1.7.5-1.7 1.3 0 1.8 3.6 1 3.6 2.8 0 .8-.8 1.4-1.9 1.4-.8 0-1.5-.3-1.9-.9M12 7.5v1M12 14.4v1"/>',
  R_DSLV: '<path d="M12 3c3 4 6 7.3 6 10.5a6 6 0 0 1-12 0C6 10.3 9 7 12 3z"/><path d="M12 10v6M10 12.5h3a1 1 0 0 1 0 2h-2"/>',
  RELA: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="12" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8.3 7.2l7.4 3.6M8.3 16.8l7.4-3.6"/>',
  RELT: '<path d="M6 3.5h9l4 4v13H6z"/><path d="M15 3.5v4h4"/><path d="M9 17v-3M12 17v-6M15 17v-4"/>',
  RELP: '<path d="M4 20h16"/><path d="M7 17v-5M11 17V7M15 17v-8M19 17v-3"/>',
  RELC: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.5.8-2.5 1.9 0 2.6 5.2 1.4 5.2 4.1 0 1.1-1.1 2-2.7 2-1.2 0-2.2-.5-2.7-1.3M12 6.5v1.5M12 16v1.5"/>',
  RELS: '<path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  PROJETOS: '<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>',
  GRA: '<path d="M4 20h16"/><path d="M7 16v-5M12 16V7M17 16v-8"/>',
  FIN: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M8 14h3M13 14h3M8 17h3"/>',
  CRO: '<path d="M4 6h9M7 11h11M5 16h7"/><path d="M3 3v18h18"/>',
  LPS: '<path d="M5 5h14v14H5z"/><path d="M8 12l2.5 2.5L16 9"/>',
  INP: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9.5h16M9.5 9.5V20M13 14l1.7 1.7L18 12.5"/>',
  LOB: '<path d="M4 20L10 4M9 20L15 4M14 20L20 4"/>',
  CPU: '<rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 8h8M8 12h3M13 12h3M8 16h3M13 16h3"/>',
  COM: '<path d="M12 3l8.5 4.5L12 12 3.5 7.5z"/><path d="M3.5 12L12 16.5l8.5-4.5M3.5 16.5L12 21l8.5-4.5"/>',
  MAO: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.8 3.5-6 7-6s6.2 2.2 7 6"/>',
  VEM: '<path d="M3 15V8.5h11V15M14 11h3.5l3 3V15"/><circle cx="7" cy="16.5" r="1.8"/><circle cx="17" cy="16.5" r="1.8"/>',
  MAT: '<path d="M14.5 5.5l4 4-9 9H5.5v-4z"/><path d="M12.5 7.5l4 4"/>',
  IND: '<path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z"/><path d="M9 8.5h6M9 12h6"/>',
  SER: '<path d="M14.7 6.3a4 4 0 0 0-5.2 5.2L4 17v3h3l5.5-5.5a4 4 0 0 0 5.2-5.2l-2.4 2.4-2.6-.6-.6-2.6z"/>',
  EPI: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>',
  PCMSO: '<path d="M6 4v5a4 4 0 0 0 8 0V4"/><path d="M10 13v2a4 4 0 0 0 8 0v-2"/><circle cx="18" cy="11" r="2"/>',
  GHE: '<circle cx="8" cy="9" r="3"/><circle cx="16.5" cy="9.5" r="2.5"/><path d="M2.5 19c.6-3 2.8-5 5.5-5s4.9 2 5.5 5M13 15c1-.7 2.2-1 3.5-1 2.4 0 4.3 1.8 4.8 5"/>',
  SESMT: '<path d="M4 16a8 8 0 0 1 16 0z"/><path d="M12 8V5M2.5 16h19v2.5h-19z"/>',
  HIS: '<path d="M4 20h16"/><rect x="5.5" y="12" width="3" height="6"/><rect x="10.5" y="6" width="3" height="12"/><rect x="15.5" y="9" width="3" height="9"/>',
  DET: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  CONFIG: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>',
  SIS: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M2.5 12h3M18.5 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/>'
};
var LOGO_OP = '<svg viewBox="0 0 40 52" aria-hidden="true"><circle cx="21" cy="19.5" r="14.5" fill="none" stroke="currentColor" stroke-width="9.5"/><rect x="2" y="19.5" width="9.5" height="31" fill="#2f62f2"/></svg>';
/* marca d'água da OP Consulting: gráficos e relatórios na tela (CSS) e planilhas exportadas (imagem de fundo + cabeçalho/rodapé) */
var WM_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 96"><g opacity="0.11"><circle cx="45" cy="37" r="26" fill="none" stroke="#5b6b82" stroke-width="17"/><rect x="11" y="37" width="17" height="55" fill="#2f62f2"/><text x="86" y="50" font-family="Poppins,Segoe UI,Arial,sans-serif" font-size="34" font-weight="600" fill="#5b6b82">OP Consulting</text><text x="87" y="76" font-family="Segoe UI,Arial,sans-serif" font-size="15" fill="#5b6b82" letter-spacing="2">PLANNING PROJECTS</text></g></svg>';
(function () { try { document.documentElement.style.setProperty('--wm', 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(WM_SVG) + '")'); } catch (e) { } })();
var WM_PNG = null;
function opMarcaPng() {
  if (WM_PNG) return Promise.resolve(WM_PNG);
  return new Promise(function (res) {
    var img = new Image(); img.onload = function () {
      try { var c = document.createElement('canvas'); c.width = 900; c.height = 288; var g = c.getContext('2d'); g.drawImage(img, 0, 0, 900, 288); WM_PNG = c.toDataURL('image/png').split(',')[1]; } catch (e) { WM_PNG = null; }
      res(WM_PNG);
    }; img.onerror = function () { res(null); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(WM_SVG.replace('opacity="0.11"', 'opacity="0.05"'));
  });
}
function xlMarca(wb) {
  return opMarcaPng().then(function (b64) {
    var id = null; try { if (b64) id = wb.addImage({ base64: b64, extension: 'png' }); } catch (e) { id = null; }
    wb.worksheets.forEach(function (ws) {
      if (id != null) try { ws.addBackgroundImage(id); } catch (e) { }
      ws.headerFooter = { oddHeader: '&R&8&"Arial,Bold"OP Consulting', oddFooter: '&L&8Planning Projects · OP Consulting&R&8Página &P de &N' };
    });
  }, function () { });
}
var MARCA = '<div class="marca">' + LOGO_OP + '<b>Planning Projects<small>OP Consulting</small></b></div>';
var KPI_IC = '<svg viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="14" fill="#fff" fill-opacity=".95"/><circle cx="15" cy="15" r="10" fill="none" stroke="#1769e8" stroke-width="1.6"/><path d="M15 8.5v13M18 11.2c-.5-1-1.6-1.6-3-1.6-1.8 0-3 .9-3 2.2 0 3.2 6.2 1.6 6.2 4.7 0 1.4-1.3 2.3-3.2 2.3-1.5 0-2.7-.6-3.2-1.7" fill="none" stroke="#1769e8" stroke-width="1.6" stroke-linecap="round"/></svg>';
function faixa() {
  NOMES.MAT = unificado() ? 'Materiais e insumos' : 'Materiais'; if (unificado() && S.v.aba === 'IND') S.v.aba = 'MAT'; if (S.v.aba === 'COM') S.v.aba = 'FIN'; if (S.v.aba === 'LPS') S.v.aba = 'CRO'; if (S.v.aba === 'HIS' || S.v.aba === 'DET') S.v.aba = 'RELT'; var sstAba = { SESMT: 'SST', EPI: 'EPI', PCMSO: 'PCMSO', GHE: 'GHE' }[S.v.aba]; if (sstAba) { S.v.aba = 'RELS'; (S.v.relt = S.v.relt || { r: 'MO', por: 'F', med: 'Q', de: 0, ate: 0, op: '' }).r = sstAba; } if (S.v.aba === 'RELT' || S.v.aba === 'RELP' || S.v.aba === 'RELC') S.v.aba = relAbaDe((S.v.relt || {}).r, S.v.aba); if (/^R_(MO|EQ|MAT|DSL)$/.test(S.v.aba)) { (S.v.relt = S.v.relt || { r: 'MO', por: 'F', med: 'Q', de: 0, ate: 0, op: '' }).r = S.v.aba.slice(2); S.v.aba = 'HISP'; }
  var p = proj(), ed = podeEditar(), ok = S.pronto && !S.semDb && baseOk(), semP = !p || !ok;
  var papel = !S.pronto ? 'Carregando…' : S.semDb ? 'Sem conexão com os dados' : (ehAdmin() ? 'Administrador' : S.perm && !S.perm.semCadastro && (Object.keys(S.perm.secoes || {}).some(function (k) { return S.perm.secoes[k] === 'E'; }) || S.perm.secPadrao === 'E') ? 'Usuário' : 'Usuário (somente leitura)') + (S.papel.nome ? ' · ' + esc(S.papel.nome) : '');
  if (rotuloPapel) papel = rotuloPapel(papel);
  if (telaExtra && telaExtra() != null) return '<div class="topo"><div class="tt"><h1>Planning Projects</h1><p>Planejamento e custo de obras · OP Consulting</p></div><div class="topo-d"><span class="quem">' + papel + '</span></div></div>';
  var s = '<div class="topo"><div class="tt"><h1>' + logosTopo(p) + (ok ? NOMES[S.v.aba] || S.v.aba : 'Planning Projects') + '</h1><p>' + (p ? esc(p.nome) + (p.tipo ? ' · ' + esc(tipoNome(p)) + (portePorTipo(p) ? ' ' + esc(nf2.format(portePorTipo(p)).replace(/,00$/, '')) + ' ' + esc(tipoUn(p)) : '') : '') + (p.fase && p.fase !== 'EM PLANEJAMENTO' ? ' · ' + FASES[p.fase] : '') + (temBaseP(p) ? ' · base de preços própria' : '') + (p.liberado ? '' : ' · rascunho') : ok ? 'Nenhum projeto selecionado' : 'Planejamento e custo de obras · OP Consulting') + '</p></div><div class="topo-d">';
  s += '<div class="rproj"><select id="selproj" aria-label="Projeto" ' + h(function (el) { var v = el.value; el.value = S.v.pid || ''; if (!v) { S.v.pid = null; S.v.aba = 'PROJETOS'; agendar(); return; } trocaProj(v, function () { if (S.v.aba === 'PROJETOS') S.v.aba = 'GRA'; }); }) + '><option value="">(selecione o projeto)</option>' +
    S.projetos.map(function (x) { return '<option value="' + x.id + '"' + (p && (p._orig || p.id) === x.id ? ' selected' : '') + '>' + esc(x.nome) + (x.liberado ? '' : ' [rascunho]') + '</option>'; }).join('') + '</select>' +
    (ehAdmin() && db && ok && !(p && p._rev) ? '<div class="row"><button class="lk" ' + h(function () { novoProjeto(); agendar(); }) + '>Novo</button><button class="lk"' + (p ? '' : ' disabled') + ' ' + h(function () { novoProjeto(p); agendar(); }) + '>Duplicar</button>' +
      '<button class="lk"' + (p ? '' : ' disabled') + ' ' + h(function () { moverProjeto(p, !p.liberado); agendar(); }) + '>' + (p && p.liberado ? 'Tornar rascunho' : 'Liberar') + '</button>' +
      '<button class="lk"' + (p ? '' : ' disabled') + ' ' + h(function () { confirma('Tem certeza que deseja excluir o projeto\n' + p.nome + ' ?\n\nEssa ação não poderá ser desfeita.', function () { excluirProjeto(p); S.v.pid = null; S.v.aba = 'PROJETOS'; }); }) + '>Excluir</button></div>' : '') + '</div>';
  if (p && ok) s = s.replace(/<\/div>$/, '') + revFaixa(p) + '</div>';
  s += '<span id="save" class="chip" hidden></span><span class="quem">' + papel + '</span></div></div>';
  if (p && ok && p._rev) s += '<div class="rev-ban"><b>Rev. ' + esc(p._rev) + ' · revisão fixa</b> — somente leitura. ' + bt('Voltar para a revisão em edição (Rev. ' + esc(revAtual(S.projetos.filter(function (x) { return x.id === p._orig; })[0])) + ')', function () { S.v.revVer = null; }, 'lk') + '</div>';
  if (p && ok && !(telaExtra && telaExtra() != null)) {
    var c = calc(p), t = c.fin.total, ne = c.res.erros.length, kp = function (rot, val) { return '<div class="kp">' + KPI_IC + '<div><span>' + rot + '</span><b>' + val + '</b></div></div>'; };
    s += '<div class="kpis">' + kp('Custo total previsto', 'R$ ' + money(t.total)) + kp('Custo médio mensal', 'R$ ' + money(t.mensal)) + kp('Custo médio diário', 'R$ ' + money(t.diario)) +
      kp('Período', t.ini == null ? '–' : fdate(t.ini) + ' a ' + fdate(t.fim)) +
      '<button class="kp ' + (ne ? 'am' : 'ok') + '" ' + h(cmdErros) + '><svg viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="14" fill="' + (ne ? '#fff' : '#e2f5eb') + '"/><path d="' + (ne ? 'M15 8v9M15 20.5v.5' : 'M9.5 15.5l3.5 3.5 7-8') + '" fill="none" stroke="' + (ne ? '#c58f00' : '#1b7f4c') + '" stroke-width="2.4" stroke-linecap="round"/></svg><div><span>Lista de erros</span><b>' + (ne ? ne + (ne === 1 ? ' erro' : ' erros') : 'Sem erros') + '</b></div>' + (ne ? '<i class="bdg">' + ne + '</i>' : '') + '</button></div>';
  }
  s += '<div class="cmds">' + rb('sobre', 'Sobre', cmdSobre) + rb('ativ', 'Atividades', cmdAtividades, semP || !ed) + rb('repl', 'Replanejar', cmdReplanejar, semP || !ed) +
    rb('his', 'Histogramas', function () { S.v.aba = 'RELP'; (S.v.relt = S.v.relt || { r: 'MO', por: 'F', med: 'Q', de: 0, ate: 0, op: '' }).r = 'MO'; agendar(); }, semP) + rb('det', 'Planilha de custo', function () { S.v.aba = 'RELC'; (S.v.relt = S.v.relt || { r: 'MO', por: 'F', med: 'Q', de: 0, ate: 0, op: '' }).r = 'PC'; agendar(); }, semP) +
    rb('exp', 'Exportar dados', cmdExportar, semP) + rb('usr', 'Usuários', cmdUsuarios, !ok) + '</div>';
  return s;
}
var menuMin = (function () { try { return localStorage.getItem('menuMin') === '1'; } catch (e) { return false; } })();
function botaoMenu() {
  return '<button class="recolhe" aria-label="' + (menuMin ? 'Expandir menu' : 'Recolher menu') + '" aria-expanded="' + !menuMin + '" data-tip="' + (menuMin ? 'Expandir menu' : 'Recolher menu') + '" ' + h(function () { menuMin = !menuMin; try { localStorage.setItem('menuMin', menuMin ? '1' : '0'); } catch (e) { } agendar(); }) + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (menuMin ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6') + '"/></svg></button>';
}
function guias() {
  var ok = S.pronto && !S.semDb && baseOk() && !(telaExtra && telaExtra() != null), app = document.getElementById('app');
  if (app) app.classList.toggle('min', menuMin && ok);
  if (!ok) return MARCA;
  return MARCA + botaoMenu() + '<nav>' + GRUPOS_ABAS.map(function (g) {
    var ks = g[1].filter(function (k) { return !(k === 'IND' && unificado()) && nivelAba(k) !== ''; }), ativo = ks.indexOf(S.v.aba) >= 0;
    if (!ks.length) return '';
    var itens = ks.map(function (k) {
      return '<a href="#" data-aba="' + k + '" class="' + (S.v.aba === k ? 'on' : '') + (k === 'CPU' || NOMES[k].length > 21 ? ' lg' : '') + '"' + (S.v.aba === k ? ' aria-current="page"' : '') + (menuMin ? ' data-tip="' + NOMES[k] + '"' : '') + ' ' + h(function (el, e) { e.preventDefault(); S.v.aba = k; S.v.busca = ''; var m = $('#main'); m.scrollTop = 0; m.scrollLeft = 0; agendar(); }) + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICA[k] + '</svg><span>' + NOMES[k] + '</span><em>' + (k === 'CONFIG' || /^R_/.test(k) ? '' : k) + '</em></a>';
    }).join('');
    /* grupos recolhidos: só o título aparece; ao passar o mouse (ou focar pelo teclado) os itens se abrem */
    return g[0] ? '<div class="gp' + (ativo ? ' on' : '') + '"><h6 tabindex="0"><span>' + g[0] + '</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></h6><div class="gpi"><div>' + itens + '</div></div></div>' : itens;
  }).join('') + '</nav><div class="lado-p">' + S.projetos.length + (S.projetos.length === 1 ? ' projeto' : ' projetos') + '<div class="op">' + LOGO_OP + '<span>Desenvolvido por<br>OP Consulting</span></div></div>';
}
function pagina() {
  if (telaExtra) { var tx = telaExtra(); if (tx != null) return tx; }
  if (!S.pronto) return '<div class="vazio">Carregando os dados…</div>';
  if (S.semDb) return '<div class="vazio"><h3>Os dados não estão disponíveis nesta visualização</h3>Abra o sistema pelo link publicado, com sua conta, para carregar projetos e bancos de dados.</div>';
  if (S.erroCarga) return '<div class="vazio">Não foi possível carregar os dados: ' + esc(S.erroCarga) + '</div>';
  if (!baseOk()) return '<div class="vazio"><h3>Os bancos de dados ainda não foram carregados</h3>' + (podeEditar() ? 'Restaure um backup do sistema para começar. ' + importarBtn() : 'Aguarde o administrador carregar a base.') + '</div>';
  if (S.v.aba === 'R_DSL' || S.v.aba === 'R_DSLV') S.v.aba = 'CMB';
  var a = S.v.aba, p = proj();
  if (nivelAba(a) === '') return titulo(NOMES[a] || a) + '<div class="vazio"><h3>Sem acesso a esta seção</h3>' + (S.perm && S.perm.semCadastro ? 'Seu usuário ainda não está no Cadastro de usuários. Peça acesso ao administrador do sistema.' : 'O administrador não liberou esta seção para o seu usuário. As seções liberadas aparecem no menu à esquerda.') + '</div>';
  if (p && nivelProj(p) === '') return titulo(NOMES[a] || a) + '<div class="vazio"><h3>Sem acesso a este projeto</h3>Peça acesso ao administrador do sistema.</div>';
  if (PRECISA_PROJ[a] && !p) return titulo(a) + '<div class="vazio"><h3>Selecione um projeto</h3>A guia ' + a + ' mostra os dados de um projeto. Escolha um na lista do canto superior esquerdo ou abra a guia PROJETOS.</div>';
  var f = { MAP: shMapa, SIS: shSis, DADOS: shDados, INP: shInp, RDO: shRdo, CLI: shCli, QDS: shQds, IDR: shIdr, RSK: shRsk, RELA: shRela, RELT: shRelt, RELP: shRelt, RELC: shRelt, RELS: shRelt, PROJETOS: shProjetos, FIN: shFin, COM: shCom, CPU: shCpu, CRO: shCro, LPS: shLps, LOB: shLob, MAO: shBanco, VEM: shBanco, MAT: shBanco, IND: shBanco, SER: shBanco, EPI: shEpi, PCMSO: shPcmso, GHE: shGhe, SESMT: shSesmt, HIS: shHis, DET: shDet, GRA: shGra, CONFIG: shTabelas }[a];
  if (a === 'CMB') f = shCmb;
  if (a === 'SUP') f = shSup;
  if (a === 'USR') f = shUsr;
  if (a === 'MANUAL') f = shManual;
  if (a === 'REVC') f = shRevc;
  if (a === 'FECH') f = shFech;
  if (a === 'CURVAS') f = shCurvas;
  if (!f && (/^R_/.test(a) || a === 'HISP')) f = shRelt;
  return f ? f(p) : '';
}
/* tabela simples editável (blocos de TABELAS e BASE) */
function bloco(pre, tit, rows, cols, salvar, novo, o) {
  o = o || {};
  var ed = podeEditar() && !o.ro, s = '<div><h4>' + tit + '</h4><table class="g"><thead><tr>' + (ed && novo ? '<th></th>' : '') + cols.map(function (c) { return '<th>' + esc(c.rot) + '</th>'; }).join('') + '</tr></thead><tbody>';
  rows.forEach(function (r, i) {
    s += '<tr>' + (ed && novo ? '<td class="x" data-tip="Excluir linha" ' + h(function () { confirma('Tem certeza que deseja excluir a linha ' + (i + 1) + (tit ? ' de ' + tit : '') + ' ?\n\nEssa ação não poderá ser desfeita.', function () { if (o.rem) o.rem(r); else rows.splice(i, 1); salvar(); }); }) + '>×</td>' : '');
    cols.forEach(function (c) {
      var val = c.get ? c.get(r, i) : r[c.k];
      if (c.calc) s += tdv(esc(c.calc(r, i)), 'k' + (c.t ? ' n' : ''));
      else s += cel(pre + '-' + i + '-' + c.k, val, ed ? function (v) { if (c.set) c.set(r, v, i); else r[c.k] = v; salvar(); } : null, { t: c.t, ops: c.ops, upper: c.upper, rot: c.rot, vazio: c.vazio, rotulos: c.rotulos, num: c.num });
    });
    s += '</tr>';
  });
  if (ed && novo) s += '<tr><td class="ad" colspan="' + (cols.length + 1) + '" ' + h(function () { var nv = novo(); if (o.add) o.add(nv); else rows.push(nv); salvar(); agendar(); }) + '>Adicionar</td></tr>';
  return s + '</tbody></table></div>';
}

/* ================= FIN — cronograma financeiro ================= */
function shFin(p) {
  if (p.filhos && p.filhos.length && !p.atividades.length) return titulo('CRONOGRAMA FINANCEIRO (FIN)') + croFilhosAviso(p);
  var c = calc(p), f = c.fin, months = c.res.months, t = f.total, nm = months.length;
  var s = titulo('CRONOGRAMA FINANCEIRO (FIN)');
  var th = function (rot, cs, rs, cls, st) { return '<th' + (cs > 1 ? ' colspan="' + cs + '"' : '') + (rs > 1 ? ' rowspan="' + rs + '"' : '') + (cls ? ' class="' + cls + '"' : '') + (st ? ' style="' + st + '"' : '') + '>' + rot + '</th>'; };
  var W1 = 'min-width:52px;width:52px', W2 = 'left:52px;min-width:300px';
  s += '<div class="tw" id="tw-fin"><table class="g"><thead><tr>' + th('ATIVIDADES', 6) + th('CENTRO DE CUSTO', 1, 4) + th('PERIODO', 5) + th('CUSTO PREVISTO (R$)', 7) + th('CUSTO MEDIO (R$)', 4) + '<th class="sp" rowspan="4"></th>' + th('RENDIMENTOS DE PRODUTIVIDADE', 5) + '<th class="sp" rowspan="4"></th>' +
    mesesCab(months).map(function (m) { return th(m); }).join('') + '</tr><tr>' +
    th('ITEM', 1, 3, 'f1', W1) + th('DESCRICAO', 1, 3, 'f2', W2) + th('UNI.', 1, 3) + th('QUANTIDADE', 1, 3) + th('TOTAL EQUIPES', 1, 3) + th('LOCAL / FRENTE', 1, 3) +
    th('INICIO', 1, 2) + th('TERMINO', 1, 2) + th('MESES / DIAS', 1, 2) + th('TOTAL DE DIAS', 2) +
    CV.map(function (C) { return th(C.nome, 1, 2); }).join('') + th('TOTAL', 1, 2) + th('PERCEN.', 1, 3) + th('MENSAL', 1, 2) + th('DIARIO', 1, 2) + th('VALOR UNITARIO MENSAL POR EQUIPE', 1, 3) + th('VALOR TOTAL POR UNIDADE', 1, 3) +
    th('MEDIA', 3) + th('JORNADA DE TRABALHO (H)', 2) + months.map(function (mi) { return th(mmaa(mi)); }).join('') + '</tr><tr>' +
    th('NORMAIS') + th('UTEIS') + th('DIARIO', 1, 2) + th('SEMANAL', 1, 2) + th('MENSAL', 1, 2) + th('HH') + th('HM') + t.acum.map(function (v) { return th(pct(v), 1, 1, 'pc'); }).join('') + '</tr><tr>' +
    th(fdate(t.ini), 1, 1, 'tt') + th(fdate(t.fim), 1, 1, 'tt') + th(t.prazo, 1, 1, 'tt') + th(int(t.dias), 1, 1, 'tt') + th(int(t.uteis), 1, 1, 'tt') +
    pcV(t.pc).map(function (v) { return th(zero(v, money), 1, 1, 'tt'); }).join('') + th(zero(t.total, money), 1, 1, 'tt') + th(zero(t.mensal, money), 1, 1, 'tt') + th(zero(t.diario, money), 1, 1, 'tt') + th(int(t.hh), 1, 1, 'tt') + th(int(t.hm), 1, 1, 'tt') +
    t.mes.map(function (v) { return th(zero(v, money), 1, 1, 'tt'); }).join('') + '</tr></thead><tbody>';
  f.linhas.forEach(function (l) {
    var g = l.tipo === 'g', u = l.uni ? ' ' + esc(l.uni) : '', n = function (v, fm) { return '<td class="n">' + zero(v, fm || money) + '</td>'; };
    s += '<tr class="' + (g ? 'gr' : '') + '"><td class="f1" style="' + W1 + '">' + l.item + '</td><td class="f2" style="' + W2 + '">' + esc(l.nome) + '</td>' +
      (g ? '<td></td><td></td><td></td><td></td><td></td>' : '<td class="c">' + esc(l.uni || '') + '</td><td class="n">' + qty(l.qtd) + '</td><td class="n">' + int(l.equipes) + '</td><td class="c">' + esc(l.trecho || '') + '</td><td>' + esc(l.cc || '') + '</td>') +
      '<td class="c">' + (l.ini == null ? '00/01/1900' : fdate(l.ini)) + '</td><td class="c">' + (l.fim == null ? '00/01/1900' : fdate(l.fim)) + '</td><td class="c">' + (l.ini == null ? '0' : l.prazo) + '</td>' + n(l.dias, int) + n(l.uteis, int) +
      pcV(l.pc).map(function (v) { return n(v); }).join('') + n(l.total) + '<td class="n">' + pct(l.pct) + '</td>' + n(l.mensal) + n(l.diario) + n(l.porEquipe) + '<td class="n">' + (l.porUnidade ? money(l.porUnidade) + ' /' + u : '0') + '</td><td class="sp"></td>' +
      '<td class="n">' + (l.rendDia ? money(l.rendDia) + u + '/DIA' : '0') + '</td><td class="n">' + (l.rendSem ? money(l.rendSem) + u + '/SEM' : '0') + '</td><td class="n">' + (l.rendMes ? money(l.rendMes) + u + '/MES' : '0') + '</td>' + n(l.hh, int) + n(l.hm, int) + '<td class="sp"></td>' +
      l.mes.map(function (v) { return n(v); }).join('') + '</tr>';
  });
  void nm;
  return s + '</tbody></table></div><div class="nota">Os valores vêm das atividades e recursos do projeto. Para criar, atualizar ou excluir atividades use o comando Atividades.</div>';
}

/* ================= COM — composição das equipes ================= */
var REL_CH = { 1: 'MAO', 2: 'VEM', 3: 'MAT', 5: 'IND' }, ST_CH = { 1: 'MAO', 2: 'VEM', 3: 'MAT', 5: 'IND', 6: 'SER' };
function linhaNova(c) { return { id: uid(), c: c, d: '', q: 0, rel: '', ini: '', fim: '', ident: '', info: '', status: '', obs: '' }; }
function shCom(p) {
  if (p.filhos && p.filhos.length && !p.atividades.length) return titulo('CPU – PERMANÊNCIA (COMPOSIÇÃO DAS EQUIPES)') + croFilhosAviso(p);
  var c = calc(p), ed = podeEditar(), t = S.base.tabelas, est = E.estrutura(p, ctxDe(p)), months = c.res.months, nv = S.v.nivel;
  var porLinha = new Map(), porItem = new Map(), errLinha = {}, C0 = ctxDe(p);
  c.res.rows.forEach(function (r) { var o = porLinha.get(r.linha); if (!o) porLinha.set(r.linha, o = { t: 0, n: 0 }); o.t += r.geral; o.n++; });
  c.fin.linhas.forEach(function (l) { porItem.set(l.tipo + (l.tipo === 'g' ? l.g : l.id), l); });
  c.res.erros.forEach(function (e) { errLinha[e.linha] = e; });
  var ne = c.res.erros.length;
  var s = titulo('CPU – PERMANÊNCIA (COMPOSIÇÃO DAS EQUIPES)', '<span class="nv" data-tip="Níveis de estrutura de tópicos">' + [1, 2, 3].map(function (n) { return '<button class="' + (nv === n ? 'on' : '') + '" ' + h(function () { S.v.nivel = n; agendar(); }) + '>' + n + '</button>'; }).join('') + '</span>') +
    '<div class="a3">' + (ne ? 'FORAM ENCONTRADOS ( ' + ('0' + ne).slice(-2) + ' ) ERROS. CLIQUE EM "LISTA DE ERROS" PARA CORRIGIR.' : '') + '</div>';
  var th = function (rot, cs, rs, cls, st) { return '<th' + (cs > 1 ? ' colspan="' + cs + '"' : '') + (rs > 1 ? ' rowspan="' + rs + '"' : '') + (cls ? ' class="' + cls + '"' : '') + (st ? ' style="' + st + '"' : '') + '>' + rot + '</th>'; };
  var W1 = 'min-width:84px;width:84px';
  s += '<div class="tw" id="tw-com"><table class="g"><thead><tr>' + th('ITEM', 1, 3, 'f1', W1) + th('STATUS', 1, 3) + th('DESCRICAO', 1, 3, '', 'min-width:330px') + th('UNI.', 1, 3) + th('QUANTIDADE', 1, 3) + th('TIPO / RELACAO', 1, 3, '', 'min-width:150px') + th('DATAS', 2) + '<th class="sp" rowspan="3"></th>' +
    th('INFORMACOES COMPLEMENTARES', 4) + '<th class="sp" rowspan="3"></th>' + th('CUSTO PREVISTO (R$)', 3) + '<th class="sp" rowspan="3"></th>' + (months.length ? th('CRONOGRAMA', months.length) : '') + '</tr><tr>' +
    th('INICIO', 1, 2) + th('TERMINO', 1, 2) + th('IDENTIFICADOR', 1, 2) + th('DESCRICAO', 1, 2, '', 'min-width:170px') + th('STATUS', 1, 2, '', 'min-width:120px') + th('COMENTARIOS / OBSERVACOES', 1, 2, '', 'min-width:200px') + th('TOTAL', 1, 2) + th('MEDIO', 2) +
    months.map(function (mi) { return th(E.MESES[mi % 12].slice(0, 3)); }).join('') + '</tr><tr>' + th('MENSAL') + th('DIARIO') + months.map(function (mi) { return th(mmaa(mi)); }).join('') + '</tr></thead><tbody>';
  var barras = function (ini, fim, cls) { return months.map(function (mi) { return '<td class="' + (ini != null && fim != null && mi >= E.mi(ini) && mi <= E.mi(fim) ? cls : '') + '"></td>'; }).join(''); };
  var dt = function (d) { return '<td class="c">' + (d == null ? '' : fdate(d)) + '</td>'; }, m3 = function (a, b, d) { return '<td class="n">' + zero(a, money) + '</td><td class="n">' + zero(b, money) + '</td><td class="n">' + zero(d, money) + '</td>'; };
  var sp = '<td class="sp"></td>', peso = { MAO: {}, VEM: {}, MAT: {} };
  if (!p.atividades.length) s += '<tr><td colspan="' + (18 + months.length) + '" style="padding:14px">Nenhuma atividade. Use o comando <b>Atividades</b> para criar a primeira.</td></tr>';
  est.forEach(function (g) {
    if (!g.ativs.length) return;
    var G = porItem.get('g' + g.i) || {};
    s += '<tr class="gr"><td class="f1" style="' + W1 + '">' + g.i + '</td><td></td><td>' + esc(g.nome) + '</td><td></td><td></td><td></td>' + dt(G.ini) + dt(G.fim) + sp + '<td></td><td></td><td></td><td></td>' + sp + m3(G.total, G.mensal, G.diario) + sp + barras(G.ini, G.fim, 'b1') + '</tr>';
    if (nv < 2) return;
    g.ativs.forEach(function (x) {
      var a = x.a, A = porItem.get('a' + a.id) || {}, sv = function () { salvarAtiv(p, a); }, lin0 = c.res.rows;
      s += '<tr class="at"><td class="f1" style="' + W1 + '">' + x.item + '</td><td></td><td>' + esc(a.nome) + '</td><td class="c">' + esc(a.uni) + '</td><td class="n">' + qty(a.qtd) + '</td><td>EQUIPES: ' + ('0' + int(a.equipes)).slice(-2) + '</td>' + dt(A.ini) + dt(A.fim) + sp +
        '<td>' + esc(a.trecho || '') + '</td><td>' + esc(a.cc || '') + '</td><td></td><td></td>' + sp + m3(A.total, A.mensal, A.diario) + sp + barras(A.ini, A.fim, 'b2') + '</tr>';
      if (nv < 3) return;
      CV.forEach(function (C, ci0) {
        var MI = C.cs.length > 1, todas = a.linhas.filter(function (l) { return C.cs.indexOf(l.c) >= 0; }), cheias = todas.filter(function (l) { return l.d; });
        /* no bloco unificado, as linhas vazias de reserva só aparecem se o bloco não tiver outra linha */
        var linhas = MI ? todas.filter(function (l) { return l.d || l.c === C.cs[0] || !todas.some(function (o) { return o !== l && (o.d || o.c === C.cs[0]); }); }) : todas;
        var rs = lin0.filter(function (r) { return r.ativ === a.id && C.cs.indexOf(r.c) >= 0; }); void cheias;
        C = { i: C.cs[0], nome: C.nome, n: ci0 + 1, MI: MI };
        var ci = null, cf = null, ct = 0, ms = {};
        rs.forEach(function (r) { if (ci == null || r.ini < ci) ci = r.ini; if (cf == null || r.fim > cf) cf = r.fim; ct += r.geral; ms[r.mi] = 1; });
        var nmes = Object.keys(ms).length;
        s += '<tr class="co"><td class="f1" style="' + W1 + '">' + x.item + '.' + C.n + '</td><td></td><td>' + C.nome + '</td><td></td><td></td><td></td>' + dt(ci) + dt(C.i === 4 ? ci : cf) + sp + '<td></td><td></td><td></td><td></td>' + sp + m3(ct, nmes ? ct / nmes : 0, ci != null ? ct / ((C.i === 4 ? ci : cf) - ci + 1) : 0) + sp + months.map(function () { return '<td></td>'; }).join('') + '</tr>';
        var DBM = { 1: C0.mao, 2: C0.vem, 3: C0.mat, 4: C0.mat, 5: C0.ind, 6: C0.ser };
        linhas.forEach(function (l, li) {
          var dbm = DBM[l.c], Ci = l.c;
          var k = 'c' + l.id, er = errLinha[l.id], tot = porLinha.get(l.id) || { t: 0, n: 0 }, R = dbm[l.d], uni = !l.d ? (Ci <= 2 ? 'UN' : '-') : (Ci <= 2 ? 'UN' : (R && R.u) || '-');
          var ini = E.day(l.ini), fim = E.day(C.i === 4 ? l.ini : l.fim), ec = function (campo) { return er && er.campo === campo ? 'er' : ''; }, tip = function (campo) { return er && er.campo === campo ? er.msg + '\n' + er.sol : ''; };
          var st = l.status ? ((t.status[ST_CH[Ci]] || []).indexOf(l.status)) : -1, pw = st < 0 ? 0 : (Ci <= 3 ? [0, 1, 2, 3, 2, 2, 2, 2, 2, 3][st] || (st > 0 ? 2 : 0) : st > 0 ? 1 : 0);
          s += '<tr>' + (ed ? '<td class="ex f1" style="' + W1 + '" ' + h(function () {
            confirma('Tem certeza que deseja excluir a linha ' + (li + 1) + ' de ' + C.nome + ' ?\n\nEssa ação não poderá ser desfeita.', function () {
              if (linhas.length > 1) a.linhas = a.linhas.filter(function (o) { return o !== l; });
              else { var nvl = linhaNova(Ci); nvl.id = l.id; a.linhas[a.linhas.indexOf(l)] = nvl; }
              sv();
            });
          }) + '>Excluir</td>' : '<td class="f1" style="' + W1 + '"></td>') + '<td class="c">' + (pw ? '<span style="color:' + ['', '#1fa86a', '#e0a100', '#e5534b'][pw] + '">●</span>' : '') + '</td>' +
            cel(k + 'd', l.d, function (v) { l.d = v; if (v && !l.rel && (C.i === 1 || C.i === 2)) l.rel = ''; sv(); }, { list: 'dl' + (Ci === 4 ? 3 : Ci), cls: ec('d'), tip: tip('d'), rot: 'Descrição' }) +
            '<td class="c">' + esc(uni) + '</td>' + cel(k + 'q', l.q, function (v) { l.q = v; sv(); }, { t: 'num', cls: ec('q'), tip: tip('q'), rot: 'Quantidade' }) +
            (C.i === 4 ? '<td>' + E.REL_AQUISICAO + '</td>' : C.i === 6 ? '<td>TERCEIRIZADO</td>' : C.MI ? cel(k + 'r', relRot(l), function (v) { var c0 = l.c; relSetMI(l, v); if (l.c !== c0 && l.status && (t.status[ST_CH[l.c]] || []).indexOf(l.status) < 0) l.status = ''; sv(); }, { ops: relOpsMI(), vazio: '', cls: ec('rel'), tip: tip('rel'), rot: 'Tipo / relação (define se é material ou insumo)' }) : cel(k + 'r', l.rel, function (v) { l.rel = v; sv(); }, { ops: t.relacao[REL_CH[C.i]] || [], vazio: '', cls: ec('rel'), tip: tip('rel'), rot: 'Tipo / relação' })) +
            cel(k + 'i', l.ini, function (v) { l.ini = v; sv(); }, { t: 'date', cls: ec('ini'), tip: tip('ini'), rot: 'Início' }) +
            (C.i === 4 ? '<td class="c">' + (ini == null ? '' : fdate(ini)) + '</td>' : cel(k + 'f', l.fim, function (v) { l.fim = v; sv(); }, { t: 'date', cls: ec('fim'), tip: tip('fim'), rot: 'Término' })) + sp +
            cel(k + 'x', l.ident, function (v) { l.ident = v; sv(); }, { rot: 'Identificador' }) + cel(k + 'n', l.info, function (v) { l.info = v; sv(); }, { rot: 'Descrição complementar' }) +
            (ST_CH[Ci] ? cel(k + 's', l.status, function (v) { l.status = v; sv(); }, { ops: t.status[ST_CH[Ci]] || [], vazio: '', cls: ec('status'), rot: 'Status' }) : '<td></td>') +
            cel(k + 'o', l.obs, function (v) { l.obs = v; sv(); }, { rot: 'Comentários' }) + sp +
            m3(tot.t, C.i === 4 ? 0 : (tot.n ? tot.t / tot.n : 0), C.i === 4 ? 0 : (ini != null && fim != null && fim >= ini ? tot.t / (fim - ini + 1) : 0)) + sp + barras(l.d ? ini : null, fim, 'b3') + '</tr>';
        });
        if (ed) s += '<tr><td class="ad f1" style="' + W1 + '" ' + h(function () { a.linhas.push(linhaNova(C.i)); sv(); agendar(); }) + '>Adicionar</td><td colspan="' + (17 + months.length) + '"></td></tr>';
      });
      s += '<tr class="fm"><td colspan="' + (18 + months.length) + '"></td></tr>';
    });
  });
  void peso;
  return s + '</tbody></table></div>' + (ed ? '<div class="nota">Clique numa célula branca (ou use as setas e digite) para editar; Enter desce, Tab avança. "Adicionar" insere uma linha no bloco e "Excluir" remove a linha.</div>' : '');
}

/* ================= MAO, VEM, MAT, IND, SER ================= */
var SN = ['NAO', 'SIM'];
function usos(c, d) {
  var n = 0;
  S.projetos.forEach(function (p) { p.atividades.forEach(function (a) { a.linhas.forEach(function (l) { if (l.d === d && (l.c === c || (c === 3 && (l.c === 4 || (l.c === 5 && unificado()))))) n++; }); }); });
  return n;
}
function renomear(c, de, para) {
  S.projetos.forEach(function (p) {
    p.atividades.forEach(function (a) {
      var mudou = false;
      if (temBaseP(p)) return; /* projeto com base própria não acompanha renomeações da base geral */
      a.linhas.forEach(function (l) { if (l.d === de && (l.c === c || (c === 3 && (l.c === 4 || (l.c === 5 && unificado()))))) { l.d = para; mudou = true; } });
      if (mudou) salvarAtiv(p, a);
    });
  });
}
function defBanco(k) {
  var t = S.base.tabelas, g = S.base.ghe, v = t.val, he = t.horasExtras, P = function (x) { return nf0.format(num(x) * 100) + '%'; };
  var e = function (key, h1, tp, ops) { return { k: key, h: h1, t: tp, ops: ops }; }, kc = function (h1, fn, tp) { return { h: h1, calc: fn, t: tp || 'money' }; };
  var ini = [{ h: ['ITEM'], item: 1 }, { k: 'd', h: ['DESCRICAO'], desc: 1 }, e('g', ['GRUPO'], '', t.grupos[k.toUpperCase()])];
  if (k === 'mao') return {
    titulo: 'MAO DE OBRA (MAO)', c: 1, niveis: 3, calc: function (r) { return E.maoCalc(r, ctx()); },
    novo: function () { return { d: '', g: t.grupos.MAO[0], cbo: '-', apr: 'NAO', hd: 8, mod: 'PF', sal: 0, ins: 'NAO', per: 'NAO', he1: 0, he2: 0, he3: 0, an: 0, dep: 0, aj: 0, vt: 0, od: 0, cb: 'NAO', ps: 'N/A', vm: 0, vr: 0, vmeio: 'N/A', exm: 12, ghe: g.grupos[0].g, epm: 6 }; },
    cols: ini.concat([e('cbo', ['CODIGO CBO']), e('apr', ['JORNADA DE TRABALHO', 'APRENDIZ', 'SIM / NAO'], '', SN), e('hd', ['JORNADA DE TRABALHO', 'HORAS POR DIA'], 'hora'), e('mod', ['MODALIDADE', 'PF / PJ'], '', ['PF', 'PJ']),
      e('sal', ['SALARIO', 'BASE'], 'money'), e('dt', ['SALARIO', 'ATUALIZADO EM'], 'date'), kc(['SALARIO', 'LIQUIDO'], function (o) { return o.liquido; }), kc(['SALARIO', 'BRUTO', 'SEM INSALUBRID.'], function (o) { return o.bruto; }), kc(['SALARIO', 'BRUTO', 'COM INSALUBRID.'], function (o) { return o.brutoIns; }),
      e('ins', ['INSALUBRIDADE', 'SIM / NAO'], '', SN), kc(['INSALUBRIDADE', P(v.insal)], function (o) { return o.insal; }), e('per', ['PERICULOSIDADE', 'SIM / NAO'], '', SN), kc(['PERICULOSIDADE', P(v.peric)], function (o) { return o.peric; }),
      e('he1', ['HORAS EXTRAS', 'SEGUNDA A SEXTA', 'QUANT.'], 'num'), kc(['HORAS EXTRAS', 'SEGUNDA A SEXTA', P(he[0].p)], function (o) { return o.he1; }), e('he2', ['HORAS EXTRAS', 'SABADOS', 'QUANT.'], 'num'), kc(['HORAS EXTRAS', 'SABADOS', P(he[1].p)], function (o) { return o.he2; }),
      e('he3', ['HORAS EXTRAS', 'DOMINGOS / FERIADOS', 'QUANT.'], 'num'), kc(['HORAS EXTRAS', 'DOMINGOS / FERIADOS', P(he[2].p)], function (o) { return o.he3; }), e('an', ['ADICIONAL NOTURNO', 'QUANT.'], 'num'), kc(['ADICIONAL NOTURNO', P(v.adNot)], function (o) { return o.adNot; }),
      kc(['DSR', P(v.dsr)], function (o) { return o.dsr; }), e('dep', ['DEPENDENTES', 'QUANT.'], 'num'), kc(['DEPENDENTES', 'VALOR'], function (o) { return o.depVal; }),
      kc(['INSS', 'FUNCIONARIO'], function (o) { return o.inssFunc; }), kc(['INSS', 'EMPRESA'], function (o) { return o.inssEmp; }), kc(['IRRF', 'PERCEN.'], function (o) { return o.irPct; }, 'pct'), kc(['IRRF', 'VALOR'], function (o) { return o.irVal; }),
      kc(['FGTS'], function (o) { return o.fgts; }), kc(['SEGURO DE VIDA COLETIVO'], function (o) { return o.seguro; }), kc(['VALOR TOTAL SEM RESCISAO'], function (o) { return o.semRescisao; }),
      kc(['PROVISAO MENSAL DE RESCISAO', '13º MENSAL', 'PARCELA'], function (o) { return o.r.mod === 'PJ' || !o.sal ? 0 : 1; }, 'num'), kc(['PROVISAO MENSAL DE RESCISAO', '13º MENSAL', 'VALOR'], function (o) { return o.p13; }),
      kc(['PROVISAO MENSAL DE RESCISAO', 'FERIAS MENSAL', 'PARCELA'], function (o) { return o.r.mod === 'PJ' || !o.sal ? 0 : 1; }, 'num'), kc(['PROVISAO MENSAL DE RESCISAO', 'FERIAS MENSAL', 'VALOR'], function (o) { return o.ferias; }),
      kc(['PROVISAO MENSAL DE RESCISAO', 'MULTA FGTS', P(v.fgtsMulta)], function (o) { return o.multaFgts; }), kc(['PROVISAO MENSAL DE RESCISAO', 'AVISO PREVIO', 'PROVISOES'], function (o) { return o.avisoProv; }),
      kc(['PROVISAO MENSAL DE RESCISAO', 'AVISO PREVIO', 'FGTS'], function (o) { return o.avisoFgts; }), kc(['PROVISAO MENSAL DE RESCISAO', 'AVISO PREVIO', 'VALOR'], function (o) { return o.aviso; }), kc(['VALOR TOTAL COM RESCISAO'], function (o) { return o.comRescisao; }),
      e('aj', ['BENEFICIOS', 'AJUDA DE CUSTO'], 'money'), e('vt', ['BENEFICIOS', 'AUXILIO TRANSPORTE'], 'money'), e('od', ['BENEFICIOS', 'AUXILIO ODONTOLOGICO'], 'money'), kc(['BENEFICIOS', 'AUXILIO ALIMENTACAO'], function (o) { return o.alim; }), kc(['BENEFICIOS', 'PLR'], function (o) { return o.plr; }),
      e('cb', ['BENEFICIOS', 'CESTA BASICA', 'SIM / NAO'], '', SN), kc(['BENEFICIOS', 'CESTA BASICA', 'VALOR'], function (o) { return o.cesta; }), e('ps', ['BENEFICIOS', 'PLANO SAUDE / ASSISTENCIA MEDICA', 'OPERADORA'], '', t.planoSaude.map(function (x) { return x.t; })),
      kc(['BENEFICIOS', 'PLANO SAUDE / ASSISTENCIA MEDICA', 'DEPEN.'], function (o) { return o.planoDep; }, 'num'), kc(['BENEFICIOS', 'PLANO SAUDE / ASSISTENCIA MEDICA', 'VALOR'], function (o) { return o.plano; }), kc(['CUSTO MENSAL EMPRESA'], function (o) { return o.custoEmpresa; }),
      e('vm', ['VIAGEM', 'PERIODICIDADE', 'MESES'], 'num'), e('vr', ['VIAGEM', 'PERIODICIDADE', 'REPOUSO'], 'num'), e('vmeio', ['VIAGEM', 'MEIO DE TRANSPORTE'], '', t.viagem.cols), kc(['VIAGEM', 'VALOR MEDIO', 'IDA'], function (o) { return o.viagIda; }), kc(['VIAGEM', 'VALOR MEDIO', 'VOLTA'], function (o) { return o.viagVolta; }),
      e('exm', ['EXAMES OCUPACIONAIS (PCMSO)', 'PERIODICIDADE', 'MESES'], 'num'), e('ghe', ['EXAMES OCUPACIONAIS (PCMSO)', 'PERIODICIDADE', 'GRUPO GHE'], '', g.grupos.map(function (x) { return x.g; })), kc(['EXAMES OCUPACIONAIS (PCMSO)', 'PERIODICIDADE', 'VALOR'], function (o) { return o.exPer; }),
      kc(['EXAMES OCUPACIONAIS (PCMSO)', 'ADMISSIONAL', 'VALOR'], function (o) { return o.exAdm; }), kc(['EXAMES OCUPACIONAIS (PCMSO)', 'DEMISSIONAL', 'VALOR'], function (o) { return o.exDem; }),
      e('epm', ['EQUIPAMENTO DE PROTECAO INDIVIDUAL (EPI)', 'PERIODICIDADE', 'MESES'], 'num'), { h: ['EQUIPAMENTO DE PROTECAO INDIVIDUAL (EPI)', 'PERIODICIDADE', 'GRUPO EPI'], calc: function (o) { return o.epiGrupo; }, t: 'txt' }, kc(['EQUIPAMENTO DE PROTECAO INDIVIDUAL (EPI)', 'PERIODICIDADE', 'VALOR'], function (o) { return o.epiPer; }),
      kc(['EQUIPAMENTO DE PROTECAO INDIVIDUAL (EPI)', 'ADMISSIONAL', 'VALOR'], function (o) { return o.epiAdm; })])
  };
  if (k === 'vem') return {
    titulo: 'VEICULOS / MAQUINAS (VEM)', c: 2, niveis: 3, calc: function (r) { return E.vemCalc(r, ctx()); },
    novo: function () { return { d: '', g: t.grupos.VEM[0], tq: 0, au: t.combCriterio[0], aq: 0, cb: 'N/A', km: 0, hd: 8, loc: 0, dep: 0, lav: 0, ofi: 0, ped: 0, seg: 0, ras: 0, dist: 0, ckm: 0, imp: 0, mm: 0, mv: 0, lm: 0, lv: 0 }; },
    cols: ini.concat([e('tq', ['CAPACIDADE', 'TANQUE', 'LITROS'], 'num'), e('au', ['CAPACIDADE', 'AUTONOMIA', 'UNIDADE'], '', t.combCriterio), e('kw', ['CONSUMO DNIT (SICRO)', 'POTENCIA (KW)'], 'num'), e('kc', ['CONSUMO DNIT (SICRO)', 'COEF. (L/KWH)'], 'num'), e('aq', ['CAPACIDADE', 'AUTONOMIA', 'QUANT.'], 'num'), kc(['CAPACIDADE', 'AUTONOMIA', 'MEDIA'], function (o) { return o.autMedia; }, 'num'),
      e('cb', ['COMBUSTIVEL', 'TIPO'], '', t.combustivel.map(function (x) { return x.t; })), kc(['COMBUSTIVEL', 'VALOR'], function (o) { return o.preco; }), e('ci', ['COMBUSTIVEL', 'JA INCLUSO NA LOCACAO'], '', ['NAO', 'SIM']),
      e('km', ['CONSUMO MEDIO', 'DISTANCIA A PERCORRER', 'KM / DIA'], 'num'), kc(['CONSUMO MEDIO', 'DISTANCIA A PERCORRER', 'KM / MES'], function (o) { return o.kmMes; }, 'num'), e('hd', ['CONSUMO MEDIO', 'JORNADA DE TRABALHO', 'H / DIA'], 'hora'), kc(['CONSUMO MEDIO', 'JORNADA DE TRABALHO', 'H / MES'], function (o) { return o.hMes; }, 'hora'),
      kc(['CONSUMO MEDIO', 'CONSUMO EM LITROS (L)', 'L / HORA'], function (o) { return o.lHora; }, 'num'), kc(['CONSUMO MEDIO', 'CONSUMO EM LITROS (L)', 'L / DIA'], function (o) { return o.lDia; }, 'num'), kc(['CONSUMO MEDIO', 'CONSUMO EM LITROS (L)', 'L / MES'], function (o) { return o.lMes; }, 'num'), kc(['CONSUMO MEDIO', 'CONSUMO MENSAL PREVISTO'], function (o) { return o.comb; }),
      e('loc', ['CUSTOS MENSAIS CONTRATUAIS', 'LOCACAO'], 'money'), e('dep', ['CUSTOS MENSAIS CONTRATUAIS', 'DEPRECIACAO'], 'money'), e('lav', ['CUSTOS MENSAIS OPERACIONAIS', 'LAVAGEM / ASPIRACAO'], 'money'), e('ofi', ['CUSTOS MENSAIS OPERACIONAIS', 'OFICINA / BORRACHARIA'], 'money'),
      e('ped', ['CUSTOS MENSAIS OPERACIONAIS', 'PEDAGIOS / ESTACIONAMENTOS'], 'money'), e('seg', ['CUSTOS MENSAIS OPERACIONAIS', 'SEGUROS'], 'money'), e('ras', ['CUSTOS MENSAIS OPERACIONAIS', 'SISTEMA DE RASTREAMENTO'], 'money'),
      kc(['CUSTO MENSAL TOTAL PREVISTO', 'PROPRIO'], function (o) { return o.totalProprio; }), kc(['CUSTO MENSAL TOTAL PREVISTO', 'TERCEIRIZADO'], function (o) { return o.totalTerceiro; }),
      e('dist', ['CUSTOS FIXOS', 'MOBILIZACAO / DESMOBILIZACAO', 'DISTANCIA (KM)'], 'num'), e('ckm', ['CUSTOS FIXOS', 'MOBILIZACAO / DESMOBILIZACAO', 'CUSTO / KM'], 'money'), kc(['CUSTOS FIXOS', 'MOBILIZACAO / DESMOBILIZACAO', 'MOBILIZACAO'], function (o) { return o.mob; }), kc(['CUSTOS FIXOS', 'MOBILIZACAO / DESMOBILIZACAO', 'DESMOBILIZACAO'], function (o) { return o.desmob; }),
      e('imp', ['CUSTOS FIXOS', 'IMPOSTOS / TAXAS'], 'money'), e('mm', ['CUSTOS PERIODICOS', 'MANUTENCAO PREVENTIVA', 'PERIODO'], 'num'), e('mv', ['CUSTOS PERIODICOS', 'MANUTENCAO PREVENTIVA', 'VALOR'], 'money'), e('lm', ['CUSTOS PERIODICOS', 'OLEOS / LUBRIFICANTES', 'PERIODO'], 'num'), e('lv', ['CUSTOS PERIODICOS', 'OLEOS / LUBRIFICANTES', 'VALOR'], 'money'), e('hmin', ['CONTRATO DE LOCACAO', 'HORAS MINIMAS / MES'], 'num'), e('disp', ['CONTRATO DE LOCACAO', 'DISPONIBILIDADE MECANICA'], 'pct'), e('dt', ['DATA ATUALIZACAO'], 'date')])
  };
  var un = t.unidades.map(function (x) { return x.s; });
  if (k === 'mat' && unificado()) return {
    titulo: 'MATERIAIS E INSUMOS (MAT)', c: 3, niveis: 3, proj: 1,
    novo: function () { return { d: '', g: t.grupos.MAT[0], u: 'UN', vu: 0, loc: 0, dep: 0, out: 0, mob: 0, des: 0, inst: 0, man: 'NAO', tmo: 'N/A', mm: 0, mv: 0, pm: 0, pv: 0, obs: '-' }; },
    cols: ini.concat([e('u', ['UNIDADE'], '', un), e('vu', ['VALOR UNITARIO'], 'money'), e('dt', ['ATUALIZADO EM'], 'date'), { h: ['QUANTIDADE PREVISTA NECESSARIA'], pj: 'nec', t: 'num' }, { h: ['AQUISICAO / COMPRAS', 'QUANTIDADE PREVISTA'], pj: 'aq', t: 'num' }, { h: ['AQUISICAO / COMPRAS', 'VALOR TOTAL'], pj: 'aqv', t: 'money' },
      { h: ['INSUMOS / RATEIO', 'QUANTIDADE PREVISTA'], pj: 'qt', t: 'num' }, { h: ['INSUMOS / RATEIO', 'VALOR PREVISTO'], pj: 'vl', t: 'money' },
      e('loc', ['CUSTOS MENSAIS', 'LOCACAO'], 'money'), e('dep', ['CUSTOS MENSAIS', 'DEPRECIACAO'], 'money'), e('out', ['CUSTOS MENSAIS', 'OUTROS'], 'money'), { h: ['CUSTOS MENSAIS', 'TOTAL', 'PROPRIO'], calcR: function (r) { return num(r.dep) + num(r.out); }, t: 'money' }, { h: ['CUSTOS MENSAIS', 'TOTAL', 'TERCEIRIZADO'], calcR: function (r) { return num(r.loc) + num(r.dep) + num(r.out); }, t: 'money' },
      e('mob', ['CUSTOS FIXOS', 'MOBILIZACAO'], 'money'), e('des', ['CUSTOS FIXOS', 'DESMOBILIZACAO'], 'money'), e('inst', ['CUSTOS FIXOS', 'INSTALACAO'], 'money'),
      e('man', ['CUSTOS PERIODICOS', 'MANUTENCAO / TROCA / REPARO', 'SIM / NAO'], '', SN), e('tmo', ['CUSTOS PERIODICOS', 'MANUTENCAO / TROCA / REPARO', 'TIPO M.O.'], '', ['N/A', 'PROPRIA', 'TERCEIRIZADA']), e('mm', ['CUSTOS PERIODICOS', 'MANUTENCAO / TROCA / REPARO', 'MESES'], 'num'), e('mv', ['CUSTOS PERIODICOS', 'MANUTENCAO / TROCA / REPARO', 'VALOR'], 'money'),
      e('pm', ['CUSTOS PERIODICOS', 'INSUMOS', 'MESES'], 'num'), e('pv', ['CUSTOS PERIODICOS', 'INSUMOS', 'VALOR UNITARIO'], 'money'), e('obs', ['COMENTARIOS / OBSERVACOES'])])
  };
  if (k === 'mat') return {
    titulo: 'MATERIAIS / FERRAMENTAS (MAT)', c: 3, niveis: 3, proj: 1,
    novo: function () { return { d: '', g: t.grupos.MAT[0], u: 'UN', vu: 0, loc: 0, dep: 0, out: 0, mob: 0, des: 0, inst: 0, man: 'NAO', tmo: 'N/A', mm: 0, mv: 0, obs: '-' }; },
    cols: ini.concat([e('u', ['UNIDADE'], '', un), { h: ['QUANTIDADE PREVISTA NECESSARIA'], pj: 'nec', t: 'num' }, e('vu', ['AQUISICAO / COMPRAS', 'VALOR UNITARIO'], 'money'), { h: ['AQUISICAO / COMPRAS', 'QUANTIDADE PREVISTA'], pj: 'aq', t: 'num' }, { h: ['AQUISICAO / COMPRAS', 'VALOR TOTAL'], pj: 'aqv', t: 'money' },
      e('loc', ['CUSTOS MENSAIS', 'LOCACAO'], 'money'), e('dep', ['CUSTOS MENSAIS', 'DEPRECIACAO'], 'money'), e('out', ['CUSTOS MENSAIS', 'OUTROS'], 'money'), { h: ['CUSTOS MENSAIS', 'TOTAL', 'PROPRIO'], calcR: function (r) { return num(r.dep) + num(r.out); }, t: 'money' }, { h: ['CUSTOS MENSAIS', 'TOTAL', 'TERCEIRIZADO'], calcR: function (r) { return num(r.loc) + num(r.dep) + num(r.out); }, t: 'money' },
      e('mob', ['CUSTOS FIXOS', 'MOBILIZACAO'], 'money'), e('des', ['CUSTOS FIXOS', 'DESMOBILIZACAO'], 'money'), e('inst', ['CUSTOS FIXOS', 'INSTALACAO'], 'money'),
      e('man', ['CUSTOS PERIODICOS', 'MANUTENCAO / TROCA / REPARO', 'SIM / NAO'], '', SN), e('tmo', ['CUSTOS PERIODICOS', 'MANUTENCAO / TROCA / REPARO', 'TIPO M.O.'], '', ['N/A', 'PROPRIA', 'TERCEIRIZADA']), e('mm', ['CUSTOS PERIODICOS', 'MANUTENCAO / TROCA / REPARO', 'MESES'], 'num'), e('mv', ['CUSTOS PERIODICOS', 'MANUTENCAO / TROCA / REPARO', 'VALOR'], 'money'), e('obs', ['COMENTARIOS / OBSERVACOES'])])
  };
  if (k === 'ind') return {
    titulo: 'INDIRETOS / INSUMOS (IND)', c: 5, niveis: 2, proj: 1,
    novo: function () { return { d: '', g: t.grupos.IND[0], u: 'UN', vu: 0, mob: 0, des: 0, pm: 0, pv: 0, obs: '-' }; },
    cols: ini.concat([e('u', ['UNIDADE'], '', un), { h: ['QUANTIDADE PREVISTA NECESSARIA'], pj: 'qt', t: 'num' }, e('vu', ['CUSTO MENSAL / RATEIO', 'VALOR UNITARIO'], 'money'), { h: ['CUSTO MENSAL / RATEIO', 'VALOR PREVISTO'], pj: 'vl', t: 'money' },
      e('mob', ['CUSTOS FIXOS', 'MOBILIZACAO'], 'money'), e('des', ['CUSTOS FIXOS', 'DESMOBILIZACAO'], 'money'), e('pm', ['CUSTOS PERIODICOS', 'MESES'], 'num'), e('pv', ['CUSTOS PERIODICOS', 'VALOR UNITARIO'], 'money'), e('obs', ['COMENTARIOS / OBSERVACOES'])])
  };
  return {
    titulo: 'SERVICOS TERCEIRIZADOS (SER)', c: 6, niveis: 2,
    novo: function () { return { d: '', g: t.grupos.SER[0], u: 'VB', men: 0, mob: 0, des: 0, pm: 0, pv: 0, obs: '-' }; },
    cols: ini.concat([e('u', ['UNIDADE'], '', un), e('men', ['CUSTO MENSAL'], 'money'), e('mob', ['CUSTOS FIXOS', 'MOBILIZACAO / INSTALACAO'], 'money'), e('des', ['CUSTOS FIXOS', 'DESMOBILIZACAO'], 'money'), e('pm', ['CUSTOS PERIODICOS', 'MESES'], 'num'), e('pv', ['CUSTOS PERIODICOS', 'VALOR'], 'money'), e('obs', ['COMENTARIOS / OBSERVACOES'])])
  };
}
function shBanco(p) {
  var k = S.v.aba.toLowerCase(), D = defBanco(k), rows = ordenaBanco(S.base[k].rows), ed = podeEditar(), b = semAcento(S.v.busca), sv = function () { salvarBase(k); invalidaListas(); };
  var pj = {};
  if (D.proj && p) calc(p).res.rows.forEach(function (r) {
    if ((k === 'mat' && (r.c === 3 || r.c === 4 || (r.c === 5 && unificado()))) || (k === 'ind' && r.c === 5)) {
      var o = pj[r.d] || (pj[r.d] = { nec: 0, aq: 0, qt: 0, vl: 0 });
      if (r.c === 3 && r.seq === 0) o.nec += r.total; if (r.c === 4) o.aq += r.total; if (r.c === 5) { o.qt += r.total; o.vl += r.geral; }
    }
  });
  var cols = (ed ? [{ h: [''], del: 1 }] : []).concat(D.cols);
  cols.forEach(function (c) { if (c.item) { c.fx = 'f1'; c.fst = 'min-width:52px;width:52px;' + (ed ? 'left:18px' : ''); } if (c.desc) { c.fst = 'min-width:320px'; } if (c.del) { c.fx = 'f1'; c.fst = 'min-width:18px;width:18px;padding:0'; } });
  var s = titulo(D.titulo, '<input id="busca" type="search" placeholder="Localizar…" aria-label="Localizar" data-live="1" value="' + esc(S.v.busca) + '" ' + h(function (el) { S.v.busca = el.value; agendar(); }) + '><button class="bxl" data-tip="Baixa todos os itens desta guia em uma planilha .xlsx" ' + h(function () { exportarBanco(k); }) + '><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v9M6 8.5l4 4 4-4M4 15.5h12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>Exportar Excel</button>' + (ed ? importarBancoBtn(k) : '') + (D.proj && !p ? '<span class="nota" style="margin:0">Selecione um projeto para ver as quantidades previstas.</span>' : '') + (p && temBaseP(p) ? '<span class="esc g" style="margin:0">O projeto selecionado usa base de preços própria; esta guia mostra a base geral</span>' : ''));
  s += '<div class="tw" id="tw-b"><table class="g"><thead>' + cabecalho(cols, D.niveis) + '</thead><tbody>';
  var lim = (S.v.bkLim && S.v.bkLim[k]) || 400, nVis = 0, nAch = 0;
  rows.forEach(function (r, i) {
    if (b && semAcento(r.d + ' ' + (r.g || '')).indexOf(b) < 0) return;
    nAch++; if (nVis >= lim && r.d) return; nVis++;
    var o = D.calc ? D.calc(r) : null, id = k + i, q = pj[r.d] || {};
    s += '<tr>';
    cols.forEach(function (c) {
      if (c.del) s += '<td class="x f1" style="left:0" data-tip="Excluir linha" ' + h(function () {
        var nu = usos(D.c, r.d), nl = cpuLinks(k, r.d);
        if (nu) return msgbox('AVISO!', 'O item\n' + r.d + '\nestá em ' + nu + ' linha(s) de composição.\n\nRemova-o das composições antes de excluir.');
        if (nl) return msgbox('AVISO!', 'O item\n' + r.d + '\nfornece o preço de ' + nl + ' insumo(s) da CPU.\n\nRetire o vínculo na guia CPU antes de excluir.');
        confirma('Tem certeza que deseja excluir a linha ' + (i + 1) + ' ?\n' + (r.d || '') + '\n\nEssa ação não poderá ser desfeita.', function () { rows.splice(i, 1); sv(); });
      }) + '>×</td>';
      else if (c.item) s += '<td class="k c f1" style="' + (ed ? 'left:18px' : '') + '">' + (i + 1) + '</td>';
      else if (c.calc) { var val = c.calc(o); s += tdv(c.t === 'txt' ? esc(val) : fmtCel(val, { t: c.t }), 'k' + (c.t === 'txt' ? ' c' : ' n')); }
      else if (c.calcR) s += tdv(fmtCel(c.calcR(r), { t: c.t }), 'k n');
      else if (c.pj) s += tdv(fmtCel(k === 'mat' && c.pj === 'aqv' ? num(q.aq) * num(r.vu) : q[c.pj], { t: c.t }), 'k n');
      else s += cel(id + c.k, r[c.k], function (v) {
        if (c.k === 'd') {
          if (!v) return msgbox('AVISO!', 'A descrição não pode ficar vazia.');
          if (rows.some(function (x) { return x !== r && x.d === v; })) return msgbox('AVISO!', 'Já existe um item com a descrição\n' + v);
          if (r.d && r.d !== v) { renomear(D.c, r.d, v); cpuRenomearBanco(k, r.d, v); }
        }
        r[c.k] = v; sv();
      }, { t: c.t, ops: c.ops, rot: c.h[c.h.length - 1], c: !!c.ops });
    });
    s += '</tr>';
  });
  if (ed) s += '<tr><td class="ad" colspan="' + cols.length + '" ' + h(function () { rows.push(D.novo()); S.v.busca = ''; sv(); proxima = k + (rows.length - 1) + 'd'; agendar(); }) + '>Adicionar</td></tr>';
  var mais = nAch > nVis ? ' Mostrando ' + nVis + ' de ' + nAch + ' (use Localizar para refinar) <button class="lk" ' + h(function () { S.v.bkLim = S.v.bkLim || {}; S.v.bkLim[k] = lim + 1000; agendar(); }) + '>Mostrar mais 1.000</button>.' : '';
  return s + '</tbody></table></div><div class="nota">' + rows.length + ' itens.' + mais + ' Colunas azuis são calculadas' + (D.proj ? '; as quantidades previstas referem-se ao projeto selecionado' : '') + '.</div>';
}

/* ================= Excel: exportar e importar os bancos de dados ================= */
function xRot(c) { return c.h.join(' > '); }
function xNorm(x) { return semAcento(String(x == null ? '' : x)).replace(/\s+/g, ' ').trim(); }
function xColsEd(D) { return D.cols.filter(function (c) { return c.k; }); }
/* exportação com o mesmo leiaute da guia: cabeçalhos mesclados, formatos, fórmulas nas colunas calculadas (bloqueadas, senha OP123) */
var SENHA_XL = 'OP123';
function carregaExcelJS() {
  return new Promise(function (ok, erro) {
    if (window.ExcelJS) return ok(window.ExcelJS);
    var sc = document.createElement('script'); sc.src = URL_EXCELJS;
    sc.onload = function () { window.ExcelJS ? ok(window.ExcelJS) : erro(new Error('biblioteca indisponível')); }; sc.onerror = function () { erro(new Error('não foi possível carregar o gerador de Excel')); };
    document.head.appendChild(sc);
  });
}
var URL_EXCELJS = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
function xlCol(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
/* nome da saída de cada coluna calculada (lido da própria função de cálculo) */
function xlChave(c) {
  var hh = c.h.join('|');
  if (/13º MENSAL\|PARCELA/.test(hh)) return 'parc13';
  if (/FERIAS MENSAL\|PARCELA/.test(hh)) return 'parcF';
  if (c.calcR) return /TERCEIRIZADO/.test(hh) ? 'mTerc' : 'mProp';
  var m = /o\.(\w+)/.exec(String(c.calc)); return m ? m[1] : '';
}
function xlFormulas(k) {
  /* R(chave) devolve a célula da linha; todas as fórmulas usam apenas funções clássicas do Excel */
  if (k === 'mao') return {
    insal: 'IF({ins}="SIM",INSAL*SALMIN,0)', peric: 'IF({per}="SIM",PERIC*{sal},0)',
    he1: '({sal}+{peric})/220*(1+HE1)*{he1}', he2: '({sal}+{peric})/220*(1+HE2)*{he2}', he3: '({sal}+{peric})/220*(1+HE3)*{he3}', adNot: '({sal}+{peric})/220*(1+ADNOT)*{an}',
    dsr: '({@he1}+{@he2}+{@he3})*DSR', bruto: '{sal}+{peric}+{@he1}+{@he2}+{@he3}+{adNot}+{dsr}', brutoIns: '{bruto}+{insal}', depVal: '{dep}*IRPFDEP',
    inssFunc: 'IF({bruto}>MAX(INSS_ATE),INSSTETO,MAX(0,{bruto}*INDEX(INSS_P,COUNTIF(INSS_ATE,"<"&{bruto})+1)-INDEX(INSS_PAR,COUNTIF(INSS_ATE,"<"&{bruto})+1)))',
    inssEmp: 'IF({mod}="PJ",0,{bruto}*IF({peric}=0,INSSEMP0,INSSEMP1))',
    irPct: 'INDEX(IR_P,COUNTIF(IR_ATE,"<"&({bruto}-{depVal}-{inssFunc}))+1)',
    irVal: '({bruto}-{depVal}-{inssFunc})*{irPct}-INDEX(IR_PAR,COUNTIF(IR_ATE,"<"&({bruto}-{depVal}-{inssFunc}))+1)',
    liquido: '{brutoIns}-({inssFunc}+{irVal})', fgts: 'IF({mod}="PJ",0,{bruto}*IF({apr}="SIM",FGTSAPR,FGTS))', seguro: 'IF(OR({mod}="PJ",{sal}=0),0,SEGVIDA)',
    semRescisao: '{bruto}+{inssEmp}+{fgts}+{seguro}', parc13: 'IF(OR({mod}="PJ",{sal}=0),0,1)', parcF: 'IF(OR({mod}="PJ",{sal}=0),0,1)',
    p13: '({bruto}/12*{parc13})*(INSSEMP0+IF({peric}=0,0,0.048))+({bruto}/12*{parc13})+({bruto}/12*{parc13})*FGTS',
    ferias: '({bruto}/12*{parc13}/3)*(1+INSSEMP0+IF({peric}=0,0,0.048)+FGTS)',
    multaFgts: 'IF({mod}="PJ",0,({bruto}*FGTS+({bruto}/12*{parc13})*FGTS+({bruto}/12*{parc13}/3)*FGTS)*FGTSMULTA)',
    avisoProv: 'IF({mod}="PJ",0,({bruto}/12+{bruto}/12+({bruto}/12)/3+{multaFgts}+{bruto})/12)', avisoFgts: 'IF({mod}="PJ",0,{avisoProv}*FGTS)', aviso: '{avisoProv}+{avisoFgts}',
    comRescisao: 'IF({mod}="PJ",{sal},{semRescisao}+{p13}+{ferias}+{aviso}+{multaFgts})',
    alim: 'IF({sal}=0,0,ALIMPRO)', plr: 'IF({sal}=0,0,PLRMENSAL)', cesta: 'IF(OR({sal}=0,{cb}<>"SIM"),0,CESTA)',
    planoDep: 'IF(OR({ps}="",{ps}="N/A",COUNTIF(PLANO_NOME,{ps})=0),0,2)', plano: 'IF({sal}=0,0,(1+{planoDep})*SUMIF(PLANO_NOME,{ps},PLANO_VAL))',
    custoEmpresa: '{comRescisao}+{aj}+{vt}+{od}+{alim}+{plr}+{cesta}+{plano}',
    viagIda: 'IF(AND({vm}>0,{vr}>0),SUMIF(VIAG_MEIO,{vmeio},VIAG_VAL)/2,0)', viagVolta: '{viagIda}',
    exPer: 'IF({exm}=0,0,SUMIF(GHE_G,{ghe},GHE_PER))', exAdm: 'IF({exm}=0,0,SUMIF(GHE_G,{ghe},GHE_ADM))', exDem: 'IF({exm}=0,0,SUMIF(GHE_G,{ghe},GHE_DEM))',
    epiGrupo: 'IFERROR(INDEX(GHE_EPI,MATCH({ghe},GHE_G,0)),"-")', epiPer: 'IF({epm}=0,0,SUMIF(EPI_KIT,{epiGrupo},EPI_VAL))', epiAdm: 'SUMIF(EPI_KIT,{epiGrupo},EPI_VAL)'
  };
  if (k === 'vem') return {
    autMedia: '{tq}*{aq}', preco: 'SUMIF(COMB_T,{cb},COMB_V)', kmMes: '{km}*30', hMes: '{hd}*30',
    lHora: 'IFERROR(IF({au}=COMBCRIT,{aq},({km}/{aq})/({hd}*24)),0)', lDia: '{lHora}*{hd}*24', lMes: '30*{lDia}', comb: '{lMes}*{preco}',
    totalProprio: 'IF({ci}="SIM",0,{comb})+{lav}+{ofi}+{ped}+{seg}+{ras}+{dep}', totalTerceiro: 'IF({ci}="SIM",0,{comb})+{lav}+{ofi}+{ped}+{ras}+{loc}+{dep}', mob: '{ckm}*{dist}/2', desmob: '{mob}'
  };
  if (k === 'mat') return { mProp: '{dep}+{out}', mTerc: '{loc}+{dep}+{out}' };
  return {};
}
function exportarBanco(k) {
  var D = defBanco(k), rows = S.base[k].rows, cols = D.cols.filter(function (c) { return !c.item && !c.pj; }), C = ctx(), t = S.base.tabelas, g = S.base.ghe, v = t.val || {};
  carregaExcelJS().then(function (X) {
    var wb = new X.Workbook(); wb.creator = 'Planning Projects · OP Consulting'; wb.created = new Date();
    var AZUL = 'FF1769E8', CALC = 'FFF3F7FD', BORDA = { style: 'thin', color: { argb: 'FFDDE3EC' } }, bordas = { top: BORDA, left: BORDA, bottom: BORDA, right: BORDA };
    var FMT = { money: '#,##0.00', num: '#,##0.00', pct: '0.00%', hora: '[h]:mm', int: '0' };
    /* ---- PARAMETROS: valores e tabelas usados pelas fórmulas ---- */
    var ws = wb.addWorksheet(k.toUpperCase(), { views: [{ state: 'frozen', xSplit: 1, ySplit: 3 + D.niveis + 1 }] });
    var ps = wb.addWorksheet('PARAMETROS'), pr = 1, nome = function (n, ref) { wb.definedNames.add("PARAMETROS!" + ref, n); };
    ps.getColumn(1).width = 44; ps.getColumn(2).width = 18; ps.getColumn(3).width = 18; ps.getColumn(4).width = 18; ps.getColumn(5).width = 18; ps.getColumn(6).width = 18;
    var tit = function (txt) { pr++; var c = ps.getCell(pr, 1); c.value = txt; c.font = { bold: true, color: { argb: AZUL } }; pr++; };
    var val = function (rot, n, x, f) { var c = ps.getCell(pr, 2); ps.getCell(pr, 1).value = rot; c.value = x; if (f) c.numFmt = f; nome(n, '$B$' + pr); pr++; };
    ps.getCell(1, 1).value = 'PARÂMETROS USADOS NAS FÓRMULAS (vêm da guia CONFIGURAÇÕES do sistema)'; ps.getCell(1, 1).font = { bold: true, size: 12 };
    var he = t.horasExtras || [], ins = (t.inss || {}).faixas || [], ir = t.irpf || [], pl = t.plr || {};
    tit('Valores');
    val('Salário mínimo', 'SALMIN', num(v.salMin), FMT.money); val('Insalubridade', 'INSAL', num(v.insal), FMT.pct); val('Periculosidade', 'PERIC', num(v.peric), FMT.pct);
    val('Adicional noturno', 'ADNOT', num(v.adNot), FMT.pct); val('DSR sobre horas extras', 'DSR', num(v.dsr), FMT.pct);
    val('Hora extra - ' + ((he[0] || {}).t || 1), 'HE1', num((he[0] || {}).p), FMT.pct); val('Hora extra - ' + ((he[1] || {}).t || 2), 'HE2', num((he[1] || {}).p), FMT.pct); val('Hora extra - ' + ((he[2] || {}).t || 3), 'HE3', num((he[2] || {}).p), FMT.pct);
    val('IRRF - dedução por dependente', 'IRPFDEP', num(v.irpfDep), FMT.money); val('Seguro de vida coletivo', 'SEGVIDA', num(v.seguroVida), FMT.money); val('Cesta básica', 'CESTA', num(v.cesta), FMT.money);
    val('FGTS', 'FGTS', num((t.fgts || {}).demais), FMT.pct); val('FGTS aprendiz', 'FGTSAPR', num((t.fgts || {}).aprendiz), FMT.pct); val('FGTS - multa rescisória', 'FGTSMULTA', num(v.fgtsMulta), FMT.pct);
    val('INSS empresa - sem periculosidade', 'INSSEMP0', num((t.inssEmp || [])[0]), FMT.pct); val('INSS empresa - com periculosidade', 'INSSEMP1', num((t.inssEmp || [])[1]), FMT.pct);
    val('INSS - desconto fixo acima da última faixa', 'INSSTETO', num((t.inss || {}).teto), FMT.money);
    val('Alimentação mão de obra própria (mensal)', 'ALIMPRO', C.alimPro, FMT.money);
    val('PLR mensal (' + (pl.criterio || '-') + ')', 'PLRMENSAL', pl.criterio === 'ANUAL' ? num(pl.valor) / 12 : pl.criterio === 'MENSAL' ? num(pl.valor) : 0, FMT.money);
    val('Critério de autonomia por hora', 'COMBCRIT', (t.combCriterio || ['L / HORA'])[0]);
    var tabela = function (titulo, cab, linhas, nomes, fmts) {
      tit(titulo); cab.forEach(function (h, j) { var c = ps.getCell(pr, j + 1); c.value = h; c.font = { bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7F0FD' } }; }); pr++;
      var i0 = pr; linhas.forEach(function (l) { l.forEach(function (x, j) { var c = ps.getCell(pr, j + 1); c.value = x; if (fmts && fmts[j]) c.numFmt = fmts[j]; }); pr++; });
      if (!linhas.length) pr++;
      nomes.forEach(function (n, j) { if (n) nome(n, '$' + xlCol(j) + '$' + i0 + ':$' + xlCol(j) + '$' + Math.max(i0, pr - 1)); });
    };
    tabela('INSS do funcionário', ['Salário até (R$)', 'Alíquota', 'Parcela a deduzir (R$)'], ins.map(function (f) { return [num(f.ate), num(f.p), num(f.par)]; }), ['INSS_ATE', 'INSS_P', 'INSS_PAR'], [FMT.money, FMT.pct, FMT.money]);
    tabela('IRRF', ['Base até (R$)', 'Alíquota', 'Parcela a deduzir (R$)'], ir.map(function (f) { return [f.ate == null ? 9e15 : num(f.ate), num(f.p), num(f.par)]; }), ['IR_ATE', 'IR_P', 'IR_PAR'], [FMT.money, FMT.pct, FMT.money]);
    tabela('Plano de saúde (valor por vida)', ['Operadora', 'Valor (R$)'], (t.planoSaude || []).map(function (x) { return [x.t, num(x.v)]; }), ['PLANO_NOME', 'PLANO_VAL'], [null, FMT.money]);
    tabela('Viagem - valor médio ida e volta por meio de transporte', ['Meio de transporte', 'Valor médio (R$)'], Object.keys(C.viagem).map(function (m) { return [m, C.viagem[m]]; }), ['VIAG_MEIO', 'VIAG_VAL'], [null, FMT.money]);
    tabela('Combustível', ['Tipo', 'Preço por litro (R$)'], (t.combustivel || []).map(function (x) { return [x.t, num(x.v)]; }), ['COMB_T', 'COMB_V'], [null, FMT.money]);
    tabela('Exames por GHE (PCMSO)', ['GHE', 'Admissional (R$)', 'Demissional (R$)', 'Periódico (R$)', 'Kit de EPI'], (g.grupos || []).map(function (x) { var gv = C.gheValor[x.g] || {}; return [x.g, num(gv.adm), num(gv.dem), num(gv.per), x.epi]; }), ['GHE_G', 'GHE_ADM', 'GHE_DEM', 'GHE_PER', 'GHE_EPI'], [null, FMT.money, FMT.money, FMT.money]);
    tabela('Kits de EPI', ['Kit', 'Valor (R$)'], (g.epigrupos || []).map(function (x) { return [x.g, num(C.epiGrupoValor[x.g])]; }), ['EPI_KIT', 'EPI_VAL'], [null, FMT.money]);
    /* ---- guia do banco: mesmo leiaute da tela ---- */
    ws.getCell(1, 1).value = 'PLANNING PROJECTS · ' + D.titulo; ws.getCell(1, 1).font = { bold: true, size: 13, color: { argb: 'FF1F2A3A' } };
    ws.getCell(2, 1).value = 'Exportado em ' + fdate(E.day(new Date().toISOString().slice(0, 10))) + ' · OP Consulting · colunas azuis são calculadas e bloqueadas'; ws.getCell(2, 1).font = { color: { argb: 'FF7B8799' }, size: 9 };
    var h0 = 4, nv = D.niveis, chaveR = h0 + nv, d0 = chaveR + 1, nlin = rows.length, extra = 200;
    /* cabeçalho em níveis, com mesclagem */
    cols.forEach(function (c, j) {
      for (var i = 0; i < nv; i++) {
        var cell = ws.getCell(h0 + i, j + 1); cell.value = i < c.h.length ? c.h[i] : null;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.k ? AZUL : 'FF0F57C9' } }; cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 }; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; cell.border = { top: { style: 'thin', color: { argb: 'FF3D80EC' } }, left: { style: 'thin', color: { argb: 'FF3D80EC' } }, bottom: { style: 'thin', color: { argb: 'FF3D80EC' } }, right: { style: 'thin', color: { argb: 'FF3D80EC' } } };
      }
    });
    for (var i = 0; i < nv; i++) {
      var j = 0;
      while (j < cols.length) {
        var c = cols[j], pre = c.h.slice(0, i + 1).join('|');
        if (c.h.length <= i) { j++; continue; }
        var f = j; while (f + 1 < cols.length && cols[f + 1].h.length > i && cols[f + 1].h.slice(0, i + 1).join('|') === pre) f++;
        var baixo = c.h.length === i + 1 && (j === f) ? h0 + nv - 1 : h0 + i;
        if (f > j || baixo > h0 + i) ws.mergeCells(h0 + i, j + 1, baixo, f + 1);
        j = f + 1;
      }
    }
    for (i = 0; i < nv; i++) ws.getRow(h0 + i).height = 30;
    /* linha-chave (oculta) usada na importação */
    cols.forEach(function (c, j) { var cell = ws.getCell(chaveR, j + 1); cell.value = xRot(c) + (c.k ? '' : ' (calculado)'); cell.font = { size: 7, color: { argb: 'FF7B8799' } }; });
    ws.getRow(chaveR).hidden = true;
    /* larguras e posições */
    var posI = {}, posO = {}; cols.forEach(function (c, j) { if (c.k) posI[c.k] = xlCol(j); else { var kk = xlChave(c); if (kk) posO[kk] = xlCol(j); } var lg = (c.h[c.h.length - 1] || '').length + 3; if (c.k && !DIR[c.t]) rows.forEach(function (r) { lg = Math.max(lg, String(r[c.k] == null ? '' : r[c.k]).length + 2); }); ws.getColumn(j + 1).width = Math.max(11, Math.min(j === 0 ? 50 : 34, lg)); });
    var FX = xlFormulas(k), fmtDe = function (c) { return c.t === 'hora' ? FMT.hora : c.t === 'pct' ? FMT.pct : c.t === 'money' ? FMT.money : c.t === 'num' ? FMT.num : null; };
    var formula = function (key, n) {
      var src = FX[key]; if (!src) return null;
      return 'IF($A' + n + '="","",' + src.replace(/\{(@?)(\w+)\}/g, function (_, o, kk) { var L = o ? posO[kk] : (posI[kk] || posO[kk]); if (!L) throw new Error('coluna ' + kk + ' não encontrada'); return L + n; }) + ')';
    };
    var opsCols = cols.filter(function (c) { return c.k && c.ops; });
    for (var r = 0; r < nlin + extra; r++) {
      var n = d0 + r, row = rows[r], o = row && D.calc ? D.calc(row) : null;
      cols.forEach(function (c, j) {
        var cell = ws.getCell(n, j + 1), key = c.k || xlChave(c), fm = fmtDe(c);
        cell.border = bordas;
        if (c.k) {
          var x = row ? row[c.k] : null;
          if (c.t === 'hora' && x != null && x !== '') x = num(x) / 24;
          cell.value = x == null || x === '' ? null : (DIR[c.t] ? num(x) : String(x));
          cell.protection = { locked: false };
          if (fm) cell.numFmt = fm;
        } else {
          var f = formula(key, n), res = null;
          if (row) res = c.calc ? c.calc(o) : c.calcR ? c.calcR(row) : null;
          if (c.t === 'hora' && typeof res === 'number') res = res / 24;
          cell.value = f ? { formula: f, result: row ? (res == null ? '' : res) : '' } : (row ? res : null);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CALC } }; cell.font = { bold: true, color: { argb: 'FF26456F' } };
          cell.protection = { locked: true, hidden: true };
          if (fm || c.t === 'n') cell.numFmt = fm || FMT.money;
          if (c.t === 'num' || c.t === 'int') cell.numFmt = c.t === 'int' ? FMT.int : FMT.num;
        }
      });
    }
    /* listas de opções (validação) */
    var op = wb.addWorksheet('OPCOES');
    opsCols.forEach(function (c, j) {
      op.getCell(1, j + 1).value = xRot(c); op.getCell(1, j + 1).font = { bold: true }; op.getColumn(j + 1).width = 30;
      c.ops.forEach(function (x, i) { op.getCell(i + 2, j + 1).value = x; });
      var ref = 'OPCOES!$' + xlCol(j) + '$2:$' + xlCol(j) + '$' + (c.ops.length + 1), cj = cols.indexOf(c);
      for (var r = 0; r < nlin + extra; r++) ws.getCell(d0 + r, cj + 1).dataValidation = { type: 'list', allowBlank: true, formulae: [ref], showErrorMessage: true, errorTitle: 'Valor inválido', error: 'Escolha um valor da lista (guia OPCOES).' };
    });
    var prot = { selectLockedCells: true, selectUnlockedCells: true, formatColumns: true, formatRows: true, autoFilter: true };
    return Promise.all([ws.protect(SENHA_XL, prot), wb.getWorksheet('PARAMETROS').protect(SENHA_XL, prot), op.protect(SENHA_XL, prot)]).then(function () {
      ws.autoFilter = { from: { row: h0 + nv - 1, column: 1 }, to: { row: h0 + nv - 1, column: cols.length } };
      return xlMarca(wb).then(function () { return wb.xlsx.writeBuffer(); });
    });
  }).then(function (buf) {
    baixar('banco-' + k + '-' + new Date().toISOString().slice(0, 10) + '.xlsx', buf);
  }, function (e) { console.error(e); msgbox('ERRO!', 'Não foi possível gerar o Excel: ' + e.message + '.', 'crit'); });
}
function xValor(c, bruto) {
  if (DIR[c.t]) {
    if (typeof bruto === 'number') return !isFinite(bruto) ? { e: 'número inválido' } : { v: c.t === 'hora' && bruto > 0 && bruto < 1 ? Math.round(bruto * 24 * 1e6) / 1e6 : bruto };
    var s = String(bruto).trim().replace(/\s|R\$/g, ''), m = c.t === 'hora' ? /^(\d+):(\d+)$/.exec(s) : null;
    if (m) return { v: +m[1] + (+m[2]) / 60 };
    if (s === '-' || s === '–') return { v: 0 };
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    return /^-?\d+(\.\d+)?$/.test(s) ? { v: parseFloat(s) } : { e: '"' + bruto + '" não é um número' };
  }
  var t = String(bruto).trim();
  if (c.ops) { var n = xNorm(t), i; for (i = 0; i < c.ops.length; i++) if (xNorm(c.ops[i]) === n) return { v: c.ops[i] }; return { e: '"' + t + '" não está na lista de opções' }; }
  return { v: t };
}
function lerPlanilhaBanco(k, nomeArq, buf) {
  return carregaXlsx().then(function (X) {
    var wb = X.read(buf, { type: 'array' }), nomeAba = wb.SheetNames.filter(function (n) { return xNorm(n) === k.toUpperCase(); })[0] || wb.SheetNames[0];
    var aoa = X.utils.sheet_to_json(wb.Sheets[nomeAba], { header: 1, defval: '', raw: true }), D = defBanco(k), ed = xColsEd(D), rows = S.base[k].rows, hi = -1, i;
    var rotulos = {}, melhor = 0; ed.forEach(function (c) { rotulos[xNorm(xRot(c))] = 1; });
    for (i = 0; i < Math.min(aoa.length, 25); i++) { var ac = aoa[i].filter(function (x) { return rotulos[xNorm(x)]; }).length; if (ac > melhor && aoa[i].some(function (x) { return xNorm(x) === 'DESCRICAO'; })) { melhor = ac; hi = i; } }
    if (hi < 0) throw new Error('não encontrei a coluna DESCRICAO na aba "' + nomeAba + '". Use como modelo o arquivo gerado em Exportar Excel');
    var mapa = [], semCol = [], ign = 0;
    aoa[hi].forEach(function (hd, j) { var n = xNorm(hd); if (!n) return; var c = ed.filter(function (c) { return xNorm(xRot(c)) === n; })[0]; if (c) mapa.push([j, c]); else if (!/\(CALCULADO\)$/.test(n) && n !== 'ITEM') ign++; });
    ed.forEach(function (c) { if (!mapa.some(function (m) { return m[1] === c; })) semCol.push(xRot(c)); });
    var jd = mapa.filter(function (m) { return m[1].k === 'd'; })[0][0], atuais = {}, vistos = {}, pl = { tipo: 'impx', k: k, arq: nomeArq, aba: nomeAba, novos: [], alter: [], iguais: 0, erros: [], fora: [], semCol: semCol, ign: ign, remover: false, campos: 0 };
    rows.forEach(function (r) { atuais[r.d] = r; });
    for (i = hi + 1; i < aoa.length; i++) {
      var L = aoa[i], d = String(L[jd] == null ? '' : L[jd]).trim(), vals = {}, errs = [];
      if (!d) continue;
      if (vistos[d]) { pl.erros.push({ l: i + 1, d: d, m: 'descrição repetida no arquivo' }); continue; }
      vistos[d] = 1;
      mapa.forEach(function (m) { var c = m[1], b = L[m[0]]; if (c.k === 'd' || b === '' || b == null) return; var r = xValor(c, b); if (r.e) errs.push(xRot(c) + ': ' + r.e); else vals[c.k] = r.v; });
      if (errs.length) { pl.erros.push({ l: i + 1, d: d, m: errs.join('; ') }); continue; }
      var at = atuais[d];
      if (!at) pl.novos.push({ d: d, vals: vals });
      else { var dif = Object.keys(vals).filter(function (q) { return typeof vals[q] === 'number' ? Math.abs(vals[q] - num(at[q])) > 1e-6 : xNorm(vals[q]) !== xNorm(at[q]) || (!ed.filter(function (c) { return c.k === q; })[0].ops && vals[q] !== (at[q] == null ? '' : String(at[q]))); }); if (dif.length) { pl.alter.push({ r: at, vals: vals, dif: dif }); pl.campos += dif.length; } else pl.iguais++; }
    }
    rows.forEach(function (r) { if (!vistos[r.d]) pl.fora.push(r); });
    return pl;
  });
}
function importarBancoBtn(k) {
  return '<label class="bxl in" data-tip="Atualiza esta guia a partir de uma planilha no mesmo formato da exportação"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 13V4M6 7.5l4-4 4 4M4 15.5h12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>Importar Excel<input type="file" accept=".xlsx,.xlsm,.xls" hidden ' + h(function (el) {
    var f = el.files && el.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () { lerPlanilhaBanco(k, f.name, rd.result).then(function (pl) { S.v.dlg = pl; agendar(); }, function (e) { msgbox('ERRO!', 'Não foi possível ler o arquivo: ' + e.message + '.', 'crit'); }); };
    rd.onerror = function () { msgbox('ERRO!', 'Não foi possível abrir o arquivo.', 'crit'); };
    rd.readAsArrayBuffer(f); el.value = '';
  }) + '></label>';
}
function dlgImpx(d) {
  var k = d.k, D = defBanco(k), rows = S.base[k].rows, nada = !d.novos.length && !d.alter.length && !(d.remover && d.fora.length), fechar = function () { S.v.dlg = null; agendar(); };
  var presos = d.fora.filter(function (r) { return usos(D.c, r.d); }).length;
  var aplicar = function () {
    d.alter.forEach(function (a) { Object.keys(a.vals).forEach(function (q) { a.r[q] = a.vals[q]; }); });
    d.novos.forEach(function (n) { var r = D.novo(); Object.keys(n.vals).forEach(function (q) { r[q] = n.vals[q]; }); r.d = n.d; rows.push(r); });
    var rem = 0;
    if (d.remover) d.fora.forEach(function (r) { if (!usos(D.c, r.d)) { rows.splice(rows.indexOf(r), 1); rem++; } });
    salvarBase(k); invalidaListas(); S.v.dlg = null; S.v.busca = '';
    msgbox('SUCESSO!', 'Importação concluída na guia ' + k.toUpperCase() + '.\n\n' + d.novos.length + ' item(ns) incluído(s)\n' + d.alter.length + ' item(ns) atualizado(s)' + (d.remover ? '\n' + rem + ' item(ns) excluído(s)' : '') + (d.erros.length ? '\n' + d.erros.length + ' linha(s) ignorada(s) por erro' : ''));
  };
  var q = function (n, r, cls) { return '<div class="' + (cls || '') + '"><b>' + n + '</b><span>' + r + '</span></div>'; };
  return janela('Importar Excel — ' + k.toUpperCase(), '<div>Arquivo <b>' + esc(d.arq) + '</b>, aba <b>' + esc(d.aba) + '</b>. Os itens são identificados pela DESCRICAO.</div>' +
    '<div class="impq">' + q(d.novos.length, 'novos') + q(d.alter.length, 'alterados (' + d.campos + ' campos)') + q(d.iguais, 'sem alteração') + q(d.erros.length, 'linhas com erro', d.erros.length ? 'er' : '') + '</div>' +
    (d.erros.length ? '<fieldset><legend>Linhas com erro (serão ignoradas)</legend><div class="impe">' + d.erros.slice(0, 30).map(function (e) { return '<div><b>Linha ' + e.l + '</b> · ' + esc(e.d) + '<br>' + esc(e.m) + '</div>'; }).join('') + (d.erros.length > 30 ? '<div>… e mais ' + (d.erros.length - 30) + '.</div>' : '') + '</div></fieldset>' : '') +
    (d.semCol.length ? '<div class="nota" style="margin:0">Colunas que não estão no arquivo e ficam como estão: ' + esc(d.semCol.join(', ')) + '.</div>' : '') +
    (d.fora.length ? '<fieldset><legend>Itens do sistema que não estão no arquivo: ' + d.fora.length + '</legend><label style="display:flex;gap:6px;align-items:flex-start"><input type="checkbox" id="ix-r"' + (d.remover ? ' checked' : '') + ' ' + h(function (el) { d.remover = el.checked; agendar(); }) + '> <span>Excluir esses itens do sistema.' + (presos ? ' ' + presos + ' deles estão em composições e serão mantidos.' : '') + '<br>Desmarcado, eles são mantidos.</span></label></fieldset>' : '') +
    '<div class="nota" style="margin:0">Células vazias e colunas calculadas não alteram nada. Para renomear um item, use a guia; no Excel, uma descrição diferente vira item novo.</div>' +
    '<div class="bts">' + bt('IMPORTAR', aplicar, '', nada) + bt('CANCELAR', fechar, 'cz') + '</div>', 560, fechar);
}

/* ================= PROJETOS (guia extra: carteira) ================= */
function novoProjeto(copia) {
  var hoje = new Date(), p;
  if (copia) { var bp = copia._base, cro = copia._cro, ccal = copia._croCalc; delete copia._ctx; delete copia._cro; delete copia._croCalc; p = clone(copia); copia._cro = cro; copia._croCalc = ccal; delete p.crono; if (bp) p._base = clone(bp); p.nome = (copia.nome + ' (COPIA)').slice(0, 120); p.atividades.forEach(function (a) { a.id = uid(); a.linhas.forEach(function (l) { l.id = uid(); }); }); delete p.exemplo; }
  else p = { nome: 'NOVO PROJETO', tipo: '', grupos: S.base.tabelas.atividades.slice(), tensao: 0, ot: '', database: hoje.getFullYear() + '-' + ('0' + (hoje.getMonth() + 1)).slice(-2) + '-01', subestacoes: [], jornada: 11, grauRisco: 4, cnae: '', reajuste: { MAO: [], VEM: [], MAT: [], SER: [], IND: [] }, feriadosMun: [], paralisacoes: [], atividades: [] };
  p.id = uid(); p.liberado = false; p._raiz = 'rascunhos';
  S.projetos.push(p);
  salvarMeta(p); p.atividades.forEach(function (a) { salvarAtiv(p, a); }); if (temBaseP(p)) salvarBaseP(p);
  S.v.pid = p.id; S.v.aba = copia ? 'GRA' : 'CONFIG'; S.v.cfg = 'proj';
}
function baixar(nome, dados) {
  if (!dl) return msgbox('AVISO!', 'O download não está disponível nesta visualização.');
  if (dados && dados.__xlsx) {
    var wbS = dados.__xlsx;
    return xlLayout(wbS, nome).then(function (buf) { baixar(nome, buf); }, function (e) { console.error(e); var X = window.XLSX; if (X) baixar(nome, X.write(wbS, { bookType: 'xlsx', type: 'array' })); });
  }
  dl.save({ filename: nome, data: dados }).catch(function (e) { if (e && e.code !== 'declined') msgbox('ERRO!', 'Não foi possível gerar o arquivo (' + ((e && e.code) || 'erro') + ').', 'crit'); });
}
function exportarBtn() {
  return '<button class="lk" ' + h(function () {
    Promise.all(S.projetos.filter(function (p) { return p.crono; }).map(croCarregar)).then(function () {
      var bk = { formato: 'custo-de-obras/1', geradoEm: new Date().toISOString(), base: S.base, projetos: S.projetos.map(function (p) { var m = metaDe(p); m.id = p.id; m.atividades = p.atividades; if (temBaseP(p)) m._base = p._base; if (p.crono && p._cro) { var c = { parts: p._cro.parts }; CRO_EXTRA.forEach(function (k) { c[k] = p._cro[k]; }); m._crono = c; } return m; }) };
      baixar('custo-de-obras-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(bk));
    });
  }) + '>Baixar backup</button>';
}
/* exportação completa (todos os documentos do banco) para carregar na versão Supabase: Importar dados */
function exportarTudoBtn() {
  return '<button class="lk" data-tip="Arquivo com todos os dados (bancos, projetos, cronogramas, mapas, RDO, clientes e usuários) para a versão com login (Supabase): use Importar dados lá" ' + h(function () {
    if (!db) return; S.v.dlg = { tipo: 'proc' }; render();
    var docs = {}, n = 0;
    var col = function (c) { return db.collection(c).get().then(function (r) { r.docs.forEach(function (d) { docs[c + '/' + d.id] = d.data(); n++; }); return r.docs.map(function (d) { return d.id; }); }, function () { return []; }); };
    Promise.all(['base', 'clientes', 'usuarios'].map(col)).then(function () {
      return Promise.all(['projetos', 'rascunhos'].map(function (rz) {
        return col(rz).then(function (ids) { return Promise.all(ids.map(function (id) { return Promise.all(['ativ', 'base', 'crono', 'mapas', 'rdo'].map(function (sc) { return col(rz + '/' + id + '/' + sc); })); })); });
      }));
    }).then(function () {
      S.v.dlg = null; agendar();
      baixar('planning-projects-dados-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify({ formato: 'planning-projects/docs', geradoEm: new Date().toISOString(), docs: docs }));
    }, function (e) { S.v.dlg = null; msgbox('ERRO!', 'Não foi possível exportar: ' + ((e && e.message) || e), 'crit'); });
  }) + '>Exportar tudo (Supabase)</button>';
}
function importarBtn() {
  return '<label class="lk">Restaurar backup<input type="file" accept=".json,application/json" hidden ' + h(function (el) {
    var f = el.files && el.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var bk = JSON.parse(rd.result);
        if (!bk || !bk.base || !bk.base.tabelas) throw new Error('arquivo sem a seção "base"');
        Object.keys(bk.base).forEach(function (k) { S.base[k] = bk.base[k]; }); cpuInsJuntar(); bancosJuntar(); Object.keys(S.base).forEach(function (k) { if (!/^cpuins/.test(k)) salvarBase(k); }); cpuSalvarIns();
        (bk.projetos || []).forEach(function (m) {
          if (S.projetos.some(function (p) { return p.id === m.id; })) return;
          var p = clone(m); p.atividades = p.atividades || []; p._raiz = raiz(p); S.projetos.push(p);
          var cr = p._crono; delete p._crono;
          salvarMeta(p); p.atividades.forEach(function (a) { salvarAtiv(p, a); }); if (temBaseP(p)) salvarBaseP(p);
          if (cr) { Object.keys(cr.parts || {}).forEach(function (k) { gravar(croRaiz(p) + '/' + k, cr.parts[k]); }); CRO_EXTRA.forEach(function (k) { if (cr[k]) gravar(croRaiz(p) + '/' + k, cr[k]); }); }
        });
        invalidaListas(); msgbox('SUCESSO!', 'Backup restaurado.\nProjetos que já existiam foram mantidos como estavam.');
      } catch (e) { msgbox('ERRO!', 'Não foi possível ler o backup: ' + e.message, 'crit'); }
    };
    rd.readAsText(f);
  }) + '></label>';
}
function shProjetos() {
  var ed = podeEditar(), lista = S.projetos, todas = [], linhas = [];
  lista.forEach(function (p) { var c = calc(p); linhas.push({ p: p, c: c }); c.res.rows.forEach(function (r) { todas.push({ mi: r.mi, geral: r.geral, pid: p.id }); }); });
  var mis = todas.map(function (r) { return r.mi; }), months = [], total = E.sum(todas);
  if (mis.length) { var a = Math.min.apply(null, mis), b = Math.min(Math.max.apply(null, mis), a + 119), m; for (m = a; m <= b; m++) months.push(m); }
  var s = '<div class="a1">CARTEIRA ' + esc((S.base.empresa || {}).marca || 'OP CONSULTING') + '</div><div class="a2"><span>PROJETOS</span>' + (ed ? exportarBtn() + importarBtn() + (S.papel.dono ? exportarTudoBtn() : '') : '') + '</div>';
  if (!lista.length) return s + '<div class="vazio"><h3>Nenhum projeto ' + (ed ? 'cadastrado' : 'liberado para você') + '</h3>' + (ed ? 'Use o botão Novo, ao lado da lista de projetos, para criar o primeiro.' : 'Quando o administrador liberar um projeto, ele aparece aqui.') + '</div>';
  var porP = E.grupo(todas, function (r) { return r.pid; });
  s += '<div class="tw" id="tw-proj"><table class="g"><thead><tr><th rowspan="2">ITEM</th><th rowspan="2" style="min-width:320px">PROJETO</th><th rowspan="2">TIPO DE OBRA</th><th rowspan="2">OBRA</th><th rowspan="2">SITUACAO</th><th colspan="3">PERIODO</th><th colspan="2">CUSTO PREVISTO (R$)</th><th rowspan="2">ATIVIDADES</th><th rowspan="2">ERROS</th><th class="sp" rowspan="2"></th>' +
    mesesCab(months).map(function (x) { return '<th>' + x + '</th>'; }).join('') + '</tr><tr><th>INICIO</th><th>TERMINO</th><th>MESES / DIAS</th><th>TOTAL</th><th>MEDIO MENSAL</th>' + months.map(function (mi) { return '<th>' + mmaa(mi) + '</th>'; }).join('') + '</tr>' +
    '<tr><th class="tt" colspan="8" style="text-align:left">TOTAL DA CARTEIRA</th><th class="tt" style="text-align:right">' + money(total) + '</th><th class="tt"></th><th class="tt"></th><th class="tt"></th><th class="sp"></th>' + E.porMes(todas, months).map(function (v) { return '<th class="tt" style="text-align:right">' + zero(v, money) + '</th>'; }).join('') + '</tr></thead><tbody>';
  linhas.forEach(function (x, i) {
    var p = x.p, t = x.c.fin.total, ne = x.c.res.erros.length;
    s += '<tr style="cursor:pointer" ' + h(function () { trocaProj(p.id, function () { S.v.aba = 'GRA'; }); }) + '><td class="c k">' + (i + 1) + '</td><td' + (p.id === S.v.pid ? ' style="font-weight:bold"' : '') + '>' + esc(p.nome) + (p.tensao ? ' (' + esc(p.tensao) + ' KV)' : '') + '</td><td class="c">' + esc(p.tipo || '-') + '</td><td class="c">' + esc((p.fase || 'EM PLANEJAMENTO')) + '</td><td class="c">' + (p.liberado ? 'LIBERADO' : 'RASCUNHO') + '</td><td class="c">' + fdate(t.ini) + '</td><td class="c">' + fdate(t.fim) + '</td><td class="c">' + t.prazo + '</td>' +
      '<td class="n">' + zero(t.total, money) + '</td><td class="n">' + zero(t.mensal, money) + '</td><td class="n">' + p.atividades.length + '</td><td class="n' + (ne ? ' er' : '') + '">' + ne + '</td><td class="sp"></td>' + E.porMes(porP.get(p.id) || [], months).map(function (v) { return '<td class="n">' + zero(v, money) + '</td>'; }).join('') + '</tr>';
  });
  s += '</tbody></table></div><div class="nota">Clique em um projeto para abri-lo. Todos os projetos usam as mesmas guias MAO, VEM, MAT, IND, SER e CONFIGURAÇÕES.</div>';
  return s + shCarteira();
}

/* ================= EPI e PCMSO ================= */
function cabMes(months, fixas, linhasExtra) {
  return '<thead><tr>' + fixas.map(function (f, i) { return '<th rowspan="2"' + (i === 0 ? ' class="f1" style="min-width:330px"' : '') + '>' + f + '</th>'; }).join('') + '<th class="sp" rowspan="' + (2 + (linhasExtra ? 1 : 0)) + '"></th>' + mesesCab(months).map(function (m) { return '<th>' + m + '</th>'; }).join('') + '</tr><tr>' + months.map(function (mi) { return '<th>' + mmaa(mi) + '</th>'; }).join('') + '</tr>' + (linhasExtra || '') + '</thead>';
}
function shEpi(p) {
  var c = calc(p), months = c.res.months, r = E.epiRel(ctxDe(p), c.res), g = S.base.ghe, n = function (v, f) { return '<td class="n">' + zero(v, f || money) + '</td>'; };
  var s = titulo('EQUIPAMENTO DE PROTECAO INDIVIDUAL (EPI)') + '<div class="tw" id="tw-epi"><table class="g">' + cabMes(months, ['DESCRICAO', 'UNIDADE', 'VALOR UNITARIO (R$)', 'QUANTIDADE PREVISTA NECESSARIA', 'VALOR TOTAL PREVISTO (R$)'],
    '<tr><th class="tt f1" colspan="4" style="text-align:left">TOTAL</th><th class="tt" style="text-align:right">' + zero(r.total, money) + '</th>' + r.totalMes.map(function (v) { return '<th class="tt" style="text-align:right">' + zero(v, money) + '</th>'; }).join('') + '</tr>') + '<tbody>';
  r.itens.forEach(function (it, i) {
    var o = g.epi[i];
    s += '<tr><td class="f1">' + esc(it.d) + '</td><td class="c">' + esc(it.u) + '</td>' + cel('epi' + i, o.v, function (v) { o.v = v; salvarBase('ghe'); }, { t: 'money', rot: 'Valor unitário' }) + '<td class="n k">' + zero(it.qtd, qty) + '</td><td class="n k">' + zero(it.valor, money) + '</td><td class="sp"></td>' + it.mes.map(function (v) { return n(v, qty); }).join('') + '</tr>';
  });
  return s + '</tbody></table></div>';
}
function shPcmso(p) {
  var c = calc(p), months = c.res.months, r = E.pcmsoRel(p, ctxDe(p), c.res), g = S.base.ghe;
  var s = titulo('PROGRAMA DE CONTROLE MEDICO DE SAUDE OCUPACIONAL (PCMSO)') + '<div class="tw" id="tw-pc"><table class="g">' + cabMes(months, ['DESCRICAO', 'VALOR UNITARIO (R$)', 'VALOR TOTAL PREVISTO (R$)'],
    '<tr><th class="tt f1" colspan="2" style="text-align:left">TOTAL</th><th class="tt" style="text-align:right">' + zero(r.total, money) + '</th>' + r.totalMes.map(function (v) { return '<th class="tt" style="text-align:right">' + zero(v, money) + '</th>'; }).join('') + '</tr>') + '<tbody>';
  r.itens.forEach(function (it, i) {
    var o = g.pcmso[i];
    s += '<tr><td class="f1">' + esc(it.d) + '</td>' + cel('pcm' + i, o.v, function (v) { o.v = v; salvarBase('ghe'); }, { t: 'money', rot: 'Valor unitário' }) + '<td class="n k">' + zero(it.valor, money) + '</td><td class="sp"></td>' + it.mes.map(function (v) { return '<td class="n">' + zero(v, money) + '</td>'; }).join('') + '</tr>';
  });
  return s + '</tbody></table></div>';
}

/* ================= GHE ================= */
function shGhe() {
  var g = S.base.ghe, C = ctx();
  if (!S.v.ghe || !C.gheGrupo[S.v.ghe]) S.v.ghe = g.grupos[0] ? g.grupos[0].g : '';
  var G = C.gheGrupo[S.v.ghe] || {}, val = C.gheValor[S.v.ghe] || { adm: 0, dem: 0, per: 0 };
  var funcs = S.base.mao.rows.filter(function (r) { return r.ghe === S.v.ghe; }).map(function (r) { return r.d; });
  var epis = g.epicomp.filter(function (x) { return x.g === G.epi; }), cont = {}; epis.forEach(function (x) { cont[x.epi] = (cont[x.epi] || 0) + 1; });
  var ep = Object.keys(cont).sort(), exs = g.comp.filter(function (x) { return x.g === S.v.ghe; }).sort(function (a, b) { return a.ex.localeCompare(b.ex); });
  var n = Math.max(funcs.length, ep.length, exs.length, 1), i, pr = function (x) { return num((C.exPreco[x.ex] || {}).v); };
  var s = titulo('GRUPOS HOMOGENEOS DE EXPOSICAO (GHE)') + '<div class="tw" id="tw-ghe" style="border:0"><table class="g"><thead><tr><th style="min-width:330px">GRUPO</th><th class="l" colspan="11">DESCRICAO</th></tr></thead><tbody>' +
    '<tr><td class="e" style="background:var(--azul-s);font-weight:bold;padding:0"><select id="ghe-s" aria-label="Grupo GHE" style="width:100%;border:0;background:var(--azul-s);color:var(--azul);font:inherit;font-weight:bold" ' + h(function (el) { S.v.ghe = el.value; agendar(); }) + '>' + g.grupos.map(function (x) { return '<option' + (x.g === S.v.ghe ? ' selected' : '') + '>' + esc(x.g) + '</option>'; }).join('') + '</select></td>' +
    '<td colspan="11">GRUPO DE TRABALHADORES QUE ESTAO SUJEITOS A CONDICOES COM IDENTICAS PROBABILIDADES DE EXPOSICAO A UM DETERMINADO AGENTE DE RISCO</td></tr>' +
    '<tr><td class="sp" colspan="12" style="width:auto"></td></tr><tr><th class="l" colspan="12">RISCOS</th></tr>' + String(G.riscos || '-').split(/\s*\/\s+/).map(function (x) { return '<tr><td colspan="12">' + esc(x) + '</td></tr>'; }).join('') +
    '<tr><td class="sp" colspan="12" style="width:auto"></td></tr><tr><th class="l" colspan="2" style="min-width:330px">FUNCOES</th><th class="sp"></th><th class="l" style="min-width:260px">EQUIPAMENTO DE PROTECAO INDIVIDUAL (EPI)</th><th>UNIDADE</th><th>QUANT.</th><th>VALOR</th><th class="sp"></th><th class="l" style="min-width:260px">PROGRAMA DE CONTROLE MEDICO DE SAUDE OCUPACIONAL (PCMSO)</th><th>ADIMISSIONAL</th><th>DEMISSIONAL</th><th>PERIODICO</th></tr>' +
    '<tr class="tt"><td colspan="2">' + funcs.length + ' FUNCAO(OES)</td><td class="sp"></td><td>' + esc(G.epi || '-') + '</td><td></td><td class="n">' + epis.length + '</td><td class="n">' + money(C.epiGrupoValor[G.epi]) + '</td><td class="sp"></td><td></td><td class="n">' + money(val.adm) + '</td><td class="n">' + money(val.dem) + '</td><td class="n">' + money(val.per) + '</td></tr>';
  for (i = 0; i < n; i++) {
    var e1 = ep[i], x = exs[i], E1 = e1 ? C.epiPreco[e1] || {} : null;
    s += '<tr><td colspan="2">' + esc(funcs[i] || (i === 0 ? '-' : '')) + '</td><td class="sp"></td>' + (e1 ? '<td>' + esc(e1) + '</td><td class="c">' + esc(E1.u || '-') + '</td><td class="n">' + cont[e1] + '</td><td class="n">' + money(E1.v) + '</td>' : '<td></td><td></td><td></td><td></td>') + '<td class="sp"></td>' +
      (x ? '<td>' + esc(x.ex) + '</td><td class="n">' + zero(pr(x) * num(x.qa), money) + '</td><td class="n">' + zero(pr(x) * num(x.qd), money) + '</td><td class="n">' + zero(pr(x) * num(x.qp), money) + '</td>' : '<td></td><td></td><td></td><td></td>') + '</tr>';
  }
  return s + '</tbody></table></div><div class="nota">Guia de consulta: escolha o grupo na célula azul.' + (S.papel.dono ? ' A composição dos grupos (exames e kits de EPI) é editada na guia CONFIGURAÇÕES, em Exames por GHE e Kits de EPI.' : '') + '</div>';
}

/* ================= SESMT ================= */
function shSesmt(p) {
  var c = calc(p), months = c.res.months, t = S.base.tabelas, ss = t.sesmt, r = E.sesmtRel(p, ctxDe(p), c.res), sv = function () { salvarMeta(p); };
  var s = titulo('SERVICOS ESPECIALIZADOS EM ENGENHARIA DE SEGURANCA E EM MEDICINA DO TRABALHO (SESMT)') + '<div class="blocos" style="flex-direction:column;gap:14px">' +
    '<table class="g"><thead><tr><th class="l" style="min-width:640px">CODIGO - DENOMINACAO</th><th>GR</th></tr></thead><tbody><tr>' + cel('ses-c', p.cnae || '', function (v) { p.cnae = v; sv(); }, { rot: 'CNAE' }) + cel('ses-g', p.grauRisco || 4, function (v) { p.grauRisco = v; sv(); }, { ops: [1, 2, 3, 4], num: true, c: 1, rot: 'Grau de risco' }) + '</tr></tbody></table>';
  s += '<table class="g"><thead><tr><th rowspan="2" class="l" style="min-width:330px">PROFISSIONAIS</th><th rowspan="2">GRAU DE RISCO</th><th colspan="8">NUMERO DE TRABALHADORES NO ESTABELECIMENTO</th></tr><tr>' + ss.rotulos.map(function (x) { return '<th>' + esc(x.toUpperCase()) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    ss.rows.map(function (x) { var on = x.gr === (p.grauRisco || 4); return '<tr' + (on ? ' class="at"' : '') + '><td>' + esc(x.p) + '</td><td class="c">' + x.gr + '</td>' + x.v.map(function (v) { return '<td class="c">' + esc(v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>' +
    '<div class="nota" style="margin:0">(*) tempo parcial, mínimo de três horas · (***) o empregador pode optar pela contratação de um enfermeiro do trabalho em tempo integral.</div>';
  var mh = months.map(function (mi) { return '<th>' + E.miLabel(mi) + '</th>'; }).join(''), linha = function (rot, arr, cls, f) { return '<tr class="' + (cls || '') + '"><td class="f1">' + esc(rot) + '</td>' + arr.map(function (v) { return '<td class="' + (typeof v === 'string' ? 'c' : 'n') + '">' + (typeof v === 'string' ? esc(v) || '-' : zero(v, f || qty)) + '</td>'; }).join('') + '</tr>'; };
  var tot = months.map(function (_, i) { return r.prev.reduce(function (m, x) { return m + x.mes[i]; }, 0); });
  s += '<div class="tw" id="tw-ses"><table class="g"><thead><tr><th class="l f1" style="min-width:330px">HISTOGRAMA</th>' + r.efetivo.map(function (v) { return '<th class="pc">' + (r.pico && v === r.pico ? '<span class="pico">PICO</span>' : '') + '</th>'; }).join('') + '</tr><tr><th class="l f1">DESCRICAO</th>' + mh + '</tr></thead><tbody>' +
    linha('PLANEJAMENTO - GERAL', r.efetivo, 'at') + linha('MAO DE OBRA', r.efetivo) + linha('NECESSARIOS CONFORME NR-4', months.map(function () { return ''; }).map(function () { return ' '; }), 'at') + r.exig.map(function (x) { return linha(x.p, x.mes.map(function (v) { return v || '0'; })); }).join('') +
    linha('PLANEJAMENTO - SESMT', tot, 'at') + (r.prev.length ? r.prev.map(function (x) { return linha(x.d, x.mes); }).join('') : linha('-', months.map(function () { return 0; }))) + '</tbody></table></div>';
  return s + '</div>';
}

/* ================= HIS e DET ================= */
var FILTROS = [['PROJETO', 'projeto'], ['ATIVIDADE', 'atividade'], ['EQUIPE', 'equipe'], ['LOCAL / FRENTE', 'trecho'], ['CENTRO DE CUSTO', 'cc']];
function filtroAtual(k) { var f = S.v.filtro[k]; return { tipo: FILTROS[f.tipo][1], valor: f.valor, rot: FILTROS[f.tipo][0] + ': ' + f.valor }; }
function matriz(id, fixas, linhas, months, o) {
  var fmt = o.fmt || money, s = '<div class="tw" id="' + id + '"><table class="g"><thead><tr>' + fixas.map(function (f, i) { return '<th' + (i === 0 ? ' class="f1" style="min-width:60px"' : i === 1 ? ' style="min-width:330px"' : '') + '>' + f + '</th>'; }).join('') + '<th class="sp"></th>' + months.map(function (mi) { return '<th>' + (o.longo ? E.MESES[mi % 12] + '/' + String(Math.floor(mi / 12)).slice(2) : E.miLabel(mi)) + '</th>'; }).join('') + '</tr></thead><tbody>';
  linhas.forEach(function (l) {
    if (l.cab) { s += '<tr><td class="sp" colspan="' + (fixas.length + 1 + months.length) + '" style="width:auto;height:12px"></td></tr>'; return; }
    s += '<tr class="' + (l.cls || '') + '"><td class="f1 c">' + esc(l.item || '') + '</td><td>' + esc(l.nome) + '</td>' + (o.uni ? '<td class="c">' + esc(l.u || '') + '</td>' : '<td class="n">' + (l.semTotal ? '' : zero(l.total, fmt)) + '</td><td class="n">' + (l.pct == null ? '' : pct(l.pct)) + '</td>') + '<td class="sp"></td>' +
      l.mes.map(function (v) { return '<td class="n">' + (typeof v === 'string' ? (v ? '<span class="pico">' + v + '</span>' : '') : zero(v, fmt)) + '</td>'; }).join('') + '</tr>';
  });
  return s + '</tbody></table></div>';
}
function shHis(p) {
  var c = calc(p), months = c.res.months, f = filtroAtual('his'), rows = E.filtrar(c.res.rows, f), q = function (r) { return r.total; }, t = S.base.tabelas;
  var mo = E.porMes(rows.filter(function (r) { return r.c === 1; }), months, q), pico = Math.max.apply(null, mo.concat([0]));
  var L = [{ nome: '', semTotal: true, mes: mo.map(function (v) { return pico && v === pico ? 'PICO' : ''; }) }], porG = E.grupo(rows, function (r) { return r.g; });
  gruposDe(p).forEach(function (nome, gi) {
    var gr = porG.get(gi + 1) || [];
    L.push({ cls: 'at', item: String(gi + 1), nome: nome, u: 'UN', mes: E.porMes(gr, months, q) });
    CV.forEach(function (C) { L.push({ item: C.item, nome: C.nome, u: 'UN', mes: E.porMes(gr.filter(function (r) { return C.cs.indexOf(r.c) >= 0; }), months, q) }); });
    L.push({ cab: 1 });
  });
  CV.forEach(function (C) {
    var cr = rows.filter(function (r) { return C.cs.indexOf(r.c) >= 0; }), n = 0;
    L.push({ cls: 'at', item: C.item, nome: C.nome, u: 'UN', mes: E.porMes(cr, months, q) });
    if (C.cs[0] === 4) { L.push({ item: C.item + '1', nome: E.REL_AQUISICAO, u: 'UN', mes: E.porMes(cr, months, q) }); return; }
    C.cs.forEach(function (ci) {
      var lista = ci === 6 ? ['TERCEIRIZADO'] : t.relacao[REL_CH[ci]] || [];
      lista.forEach(function (k) { L.push({ item: C.item + (++n), nome: relRot({ c: ci, rel: k }), u: 'UN', mes: E.porMes(cr.filter(function (r) { return r.c === ci && r.rel === k; }), months, q) }); });
    });
  });
  L.push({ cab: 1 });
  CV.forEach(function (C) {
    var cr = rows.filter(function (r) { return C.cs.indexOf(r.c) >= 0; });
    L.push({ cls: 'at', item: C.item, nome: C.nome, u: '', mes: E.porMes(cr, months, q) });
    var pd = E.grupo(cr, function (r) { return r.d2; }), ks = Array.from(pd.keys()).sort();
    if (!ks.length) L.push({ item: '-', nome: '-', u: '', mes: months.map(function () { return 0; }) });
    ks.forEach(function (d, i) { L.push({ item: String(i + 1), nome: d, u: pd.get(d)[0].u, mes: E.porMes(pd.get(d), months, q) }); });
  });
  return titulo('HISTOGRAMA (HIS)') + '<div class="a3">' + esc(f.rot) + '</div>' + matriz('tw-his', ['ITEM', 'DESCRICAO', 'UNIDADE'], L, months, { fmt: qty, uni: true }) + '<div class="nota">(*) QUANTIDADE REFERENTE À COMPRA DE MATERIAIS / FERRAMENTAS. Use o comando Histograma para trocar o filtro.</div>';
}
function shDet(p) {
  var c = calc(p), months = c.res.months, f = filtroAtual('det'), rows = E.filtrar(c.res.rows, f), total = E.sum(rows), t = S.base.tabelas;
  var L = [{ cls: 'tt', nome: 'TOTAL', total: total, pct: total ? 1 : 0, mes: E.porMes(rows, months) }], porG = E.grupo(rows, function (r) { return r.g; });
  gruposDe(p).forEach(function (nome, gi) {
    var gr = porG.get(gi + 1) || [], gt = E.sum(gr);
    L.push({ cls: 'at', item: String(gi + 1), nome: nome, total: gt, pct: total ? gt / total : 0, mes: E.porMes(gr, months) });
    CV.forEach(function (C) { var cr = gr.filter(function (r) { return C.cs.indexOf(r.c) >= 0; }), v = E.sum(cr); L.push({ item: C.item, nome: C.nome, total: v, pct: gt ? v / gt : 0, mes: E.porMes(cr, months) }); });
    L.push({ cab: 1 });
  });
  CV.forEach(function (C) {
    var cr = rows.filter(function (r) { return C.cs.indexOf(r.c) >= 0; }), ct = E.sum(cr);
    L.push({ cls: 'at', item: C.item, nome: C.nome, total: ct, pct: total ? ct / total : 0, mes: E.porMes(cr, months) });
    elemsDe(C).forEach(function (e) { var fn = function (r) { return r.el[e.k] || 0; }, v = E.sum(cr, fn); L.push({ item: e.cod, nome: e.nome, total: v, pct: ct ? v / ct : 0, mes: E.porMes(cr, months, fn) }); });
  });
  L.push({ cab: 1 });
  CV.forEach(function (C) {
    var cr = rows.filter(function (r) { return C.cs.indexOf(r.c) >= 0; }), ct = E.sum(cr);
    L.push({ cls: 'at', item: C.item, nome: C.nome, total: ct, pct: total ? ct / total : 0, mes: E.porMes(cr, months) });
    var pd = E.grupo(cr, function (r) { return r.d2; }), ks = Array.from(pd.keys()).sort();
    if (!ks.length) L.push({ item: '-', nome: '-', total: 0, pct: 0, mes: months.map(function () { return 0; }) });
    ks.forEach(function (d, i) { var v = E.sum(pd.get(d)); L.push({ item: String(i + 1), nome: d, total: v, pct: ct ? v / ct : 0, mes: E.porMes(pd.get(d), months) }); });
  });
  return titulo('CUSTO DETALHADO (DET)') + '<div class="a3">' + esc(f.rot) + '</div>' + matriz('tw-det', ['ITEM', 'DESCRICAO', 'VALOR', 'PERCENTUAL'], L, months, { longo: true }) + '<div class="nota">(*) VALOR REFERENTE À COMPRA DE MATERIAIS / FERRAMENTAS. Use o comando Custo Detalhado para trocar o filtro.</div>';
}


/* ================= GRA — gráficos e indicadores (leitura guiada) ================= */
var COR = ['#1769e8', '#f2b400', '#4fb0ff', '#0b3a87', '#ff8a3d', '#22a876', '#8b7cf6', '#e5534b'], COR_O = '#a3adbb', G_CARD = '#ffffff', G_GRADE = '#e8edf4', G_EIXO = '#c3ccd8', G_TOTAL = '#cfe0fb';
function teto(v) { if (v <= 0) return 1; var p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
var NOME_C = { 'MATERIAIS E INSUMOS': 'Materiais e insumos', 'MAO DE OBRA': 'Mão de obra', 'VEICULOS / MAQUINAS': 'Veículos / máquinas', 'MATERIAIS / FERRAMENTAS': 'Materiais / ferramentas', 'AQUISICAO / COMPRAS': 'Aquisição / compras', 'INDIRETOS / INSUMOS': 'Indiretos / insumos', 'SERVICOS TERCEIRIZADOS': 'Serviços terceirizados' };
function nomeBonito(s) { return NOME_C[s] || String(s || ''); }
function prazoExt(ini, fim) {
  if (ini == null || fim == null) return '';
  var a = E.ymd(ini), b = E.ymd(fim + 1), m = (b[0] - a[0]) * 12 + (b[1] - a[1]) - (b[2] < a[2] ? 1 : 0), d = fim + 1 - (function () { var mi = a[0] * 12 + a[1] + m, ult = E.dom(E.eom(mi)); return E.som(mi) + Math.min(a[2], ult) - 1; })();
  return (m ? m + (m === 1 ? ' mês' : ' meses') : '') + (m && d ? ' e ' : '') + (d ? d + (d === 1 ? ' dia' : ' dias') : '') || '1 dia';
}
function shGra(p) {
  var c = calc(p), t = c.fin.total, rows = c.res.rows, months = c.res.months, T = S.base.tabelas, tot = t.total, n = months.length;
  var s = '<div class="gra"><h1>' + esc(p.nome) + (p.tensao ? ' (' + esc(String(p.tensao).replace('.', ',')) + ' kV)' : '') + '</h1><p class="gsub">' + (p.tipo ? esc(tipoNome(p)) + ' · ' : '') + 'Gráficos e indicadores de custo previsto do projeto' + (S.papel.dono || !p.liberado ? '' : '') + '</p>';
  var GV = S.v.graV || 'G';
  s += '<div class="tabs" role="tablist" style="margin:0 0 14px">' + [['G', 'Gráficos'], ['R', 'Resumo econômico']].map(function (a) { return '<button role="tab" aria-selected="' + (GV === a[0]) + '" class="' + (GV === a[0] ? 'on' : '') + '" ' + h(function () { S.v.graV = a[0]; agendar(); }) + '>' + a[1] + '</button>'; }).join('') + '</div>';
  if (GV === 'R') return s + graResumo(p) + '</div>';
  if (!rows.length || !tot) return s + '<div class="gc"><h3>Este projeto ainda não tem custo calculado</h3><p class="gq">Cadastre atividades com o comando Atividades e preencha os recursos na guia Cronograma financeiro. Cada linha com descrição, quantidade, tipo e datas entra no cálculo na hora, e os indicadores aparecem aqui.</p></div></div>';
  var nMeses = t.mensal ? Math.round(tot / t.mensal) : 0, pico = Math.max.apply(null, t.mes), ip = t.mes.indexOf(pico);

  /* 1. indicadores: ficam nas pílulas do cabeçalho, comuns a todas as guias */

  /* 2. em que o custo é gasto: pizza por conceito + os seis valores */
  var pv = pcV(t.pc), conc = CV.map(function (C, i) { return { nome: C.nome, v: pv[i], cor: COR[i] }; }), maior = conc.slice().sort(function (a, b) { return b.v - a.v; });
  var ang = -Math.PI / 2, fat = '', R = 88, r0 = 52, cx = 100, cy = 100, arco = function (a1, a2, cor, tip) {
    var big = a2 - a1 > Math.PI ? 1 : 0, P = function (r, a) { return (cx + r * Math.cos(a)).toFixed(2) + ' ' + (cy + r * Math.sin(a)).toFixed(2); };
    return '<path d="M' + P(R, a1) + 'A' + R + ' ' + R + ' 0 ' + big + ' 1 ' + P(R, a2) + 'L' + P(r0, a2) + 'A' + r0 + ' ' + r0 + ' 0 ' + big + ' 0 ' + P(r0, a1) + 'Z" fill="' + cor + '" stroke="' + G_CARD + '" stroke-width="2" data-tip="' + esc(tip) + '"/>';
  };
  conc.forEach(function (x) {
    if (!(x.v > 0)) return;
    var a2 = ang + 2 * Math.PI * Math.min(x.v / tot, 0.99999); fat += arco(ang, a2, x.cor, x.nome + '\nR$ ' + money(x.v) + ' · ' + pct(x.v / tot)); ang = a2;
  });
  var mx = maior[0].v;
  s += '<div class="gc"><h3>Em que o custo é gasto</h3><p class="gq">Divisão do custo total pelos cinco blocos da composição.</p><div class="gconc">' +
    '<svg viewBox="0 0 200 200" role="img" aria-label="Participação de cada conceito no custo total">' + fat + '<text x="100" y="96" text-anchor="middle" class="f" style="font-size:15px">R$ ' + compact(tot) + '</text><text x="100" y="113" text-anchor="middle">custo total</text></svg>' +
    '<div class="gl"><span class="cab">Conceito</span><span class="cab"></span><span class="cab v">Valor (R$)</span><span class="cab p">% do total</span>' + conc.map(function (x) {
      return '<span class="nm" data-tip="' + esc(x.nome) + '"><i style="background:' + x.cor + '"></i>' + nomeBonito(x.nome) + '</span><span class="tr"><i style="width:' + (mx ? 100 * x.v / mx : 0).toFixed(1) + '%;background:' + x.cor + '"></i></span><span class="v">' + (x.v ? money(x.v) : '–') + '</span><span class="p">' + pct(x.v / tot) + '</span>';
    }).join('') + '</div></div><p class="ler"><b>Como ler:</b> cada fatia é um dos blocos de recursos da guia Cronograma financeiro. O maior é <b>' + nomeBonito(maior[0].nome) + '</b>, com ' + pct(maior[0].v / tot) + ' do custo' + (maior[1].v ? '; em seguida vem ' + nomeBonito(maior[1].nome) + ', com ' + pct(maior[1].v / tot) : '') + '.</p></div>';

  /* 3. quando o custo acontece: custo de cada mês (total e por grupo) e custo acumulado */
  var grupos = gruposDe(p).map(function (nome, i) { var gr = rows.filter(function (r) { return r.g === i + 1; }); return { nome: nome, cor: i < 8 ? COR[i] : COR_O, tracejado: i >= 8, v: E.porMes(gr, months), total: E.sum(gr), ini: null, fim: null, rows: gr }; }).filter(function (g) { return g.total > 0; });
  grupos.forEach(function (g) { g.rows.forEach(function (r) { if (r.rel === E.REL_AQUISICAO && g.rows.length > 1) { /* compras contam no período */ } if (g.ini == null || r.ini < g.ini) g.ini = r.ini; if (g.fim == null || r.fim > g.fim) g.fim = r.fim; }); });
  var W = 1000, L = 62, Rm = 14, passo = (W - L - Rm) / (n || 1), x = function (i) { return L + i * passo + passo / 2; };
  var rotMes = function (H) { var k = Math.max(1, Math.ceil(n / 16)), o = ''; months.forEach(function (mi, i) { if (i % k === 0) o += '<text x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="middle">' + E.miLabel(mi).toLowerCase() + '</text>'; }); return o; };
  var grade = function (max, y, q) { var o = '', i, v; for (i = 0; i <= q; i++) { v = max * i / q; o += '<line x1="' + L + '" x2="' + (W - Rm) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="' + (i ? G_GRADE : G_EIXO) + '"/><text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + compact(v) + '</text>'; } return o; };
  var H1 = 300, T1 = 26, B1 = 24, ph1 = H1 - T1 - B1, max1 = teto(pico), y1 = function (v) { return T1 + ph1 - (v / max1) * ph1; }, g1 = grade(max1, y1, 4), bw = Math.min(54, passo * 0.66);
  months.forEach(function (mi, i) {
    var det = grupos.filter(function (g) { return g.v[i] > 0; }).map(function (g) { return nomeBonito(g.nome) + ': R$ ' + money(g.v[i]); }).join('\n');
    g1 += '<rect x="' + (x(i) - bw / 2) + '" y="' + y1(t.mes[i]) + '" width="' + bw + '" height="' + Math.max(0, y1(0) - y1(t.mes[i])) + '" rx="3" fill="' + G_TOTAL + '" data-tip="' + esc(E.miLabel(mi) + ' — total do mês: R$ ' + money(t.mes[i]) + (det ? '\n' + det : '')) + '"/>';
  });
  g1 += '<text class="f" x="' + x(ip) + '" y="' + (y1(pico) - 7) + '" text-anchor="middle">pico: R$ ' + compact(pico) + '</text>';
  grupos.forEach(function (g) {
    var seg = [], cur = [];
    g.v.forEach(function (v, k) { if (v > 0) cur.push([k, v]); else if (cur.length) { seg.push(cur); cur = []; } }); if (cur.length) seg.push(cur);
    seg.forEach(function (sg) {
      if (sg.length > 1) g1 += '<polyline points="' + sg.map(function (q) { return x(q[0]) + ',' + y1(q[1]); }).join(' ') + '" fill="none" stroke="' + g.cor + '" stroke-width="2" stroke-linejoin="round"' + (g.tracejado ? ' stroke-dasharray="5 3"' : '') + '/>';
      sg.forEach(function (q) { g1 += '<circle cx="' + x(q[0]) + '" cy="' + y1(q[1]) + '" r="4" fill="' + g.cor + '" stroke="' + G_CARD + '" stroke-width="1.5" data-tip="' + esc(nomeBonito(g.nome) + '\n' + E.miLabel(months[q[0]]) + ': R$ ' + money(q[1])) + '"/>'; });
    });
  });
  var H2 = 230, T2 = 24, B2 = 24, ph2 = H2 - T2 - B2, max2 = teto(tot), y2 = function (v) { return T2 + ph2 - (v / max2) * ph2; }, g2 = grade(max2, y2, 4), ac = 0, kp = Math.max(1, Math.ceil(n / 14));
  months.forEach(function (mi, i) {
    ac += t.mes[i];
    g2 += '<rect x="' + (x(i) - bw / 2) + '" y="' + y2(ac) + '" width="' + bw + '" height="' + Math.max(0, y2(0) - y2(ac)) + '" rx="3" fill="' + COR[0] + '" data-tip="' + esc(E.miLabel(mi) + '\nAcumulado: R$ ' + money(ac) + ' (' + pct(ac / tot) + ')\nNo mês: R$ ' + money(t.mes[i])) + '"/>';
    if (i % kp === 0 || i === n - 1) g2 += '<text' + (i === n - 1 ? ' class="f"' : '') + ' x="' + x(i) + '" y="' + (y2(ac) - 5) + '" text-anchor="middle">' + nf0.format(100 * ac / tot) + '%</text>';
  });
  var meio = 0, acm = 0; t.mes.some(function (v, i) { acm += v; if (acm >= tot / 2) { meio = i; return true; } return false; });
  s += '<div class="gc"><h3>Quando o custo acontece</h3><p class="gq">Os dois gráficos usam os mesmos meses: em cima, quanto se gasta em cada mês; embaixo, quanto já foi gasto até aquele mês.</p>' +
    '<h4>Custo de cada mês, total e por grupo de atividade</h4><div class="gleg"><span><i class="q" style="background:' + G_TOTAL + '"></i>Total do mês</span>' + grupos.map(function (g) { return '<span><i style="background:' + g.cor + '"></i>' + nomeBonito(g.nome) + '</span>'; }).join('') + '</div>' +
    '<div class="gsvg"><svg viewBox="0 0 ' + W + ' ' + H1 + '" role="img" aria-label="Custo de cada mês, total e por grupo de atividade">' + g1 + rotMes(H1) + '</svg></div>' +
    '<p class="ler"><b>Como ler:</b> a barra azul-clara é o custo total do mês; cada linha colorida é a parte de um grupo de atividade. O mês mais caro é <b>' + E.miLabel(months[ip]).toLowerCase() + '</b>, com R$ ' + money(pico) + '. Passe o mouse sobre uma barra ou ponto para ver os valores.</p>' +
    '<h4>Custo acumulado do projeto</h4><div class="gsvg"><svg viewBox="0 0 ' + W + ' ' + H2 + '" role="img" aria-label="Custo acumulado do projeto, mês a mês">' + g2 + rotMes(H2) + '</svg></div>' +
    '<p class="ler"><b>Como ler:</b> cada barra soma tudo o que foi gasto do início até aquele mês; o número acima é o percentual do custo total. Metade do custo é atingida em <b>' + E.miLabel(months[meio]).toLowerCase() + '</b>.</p></div>';

  /* 4. cronograma por grupo de atividade */
  var Lg = 250, rh = 30, Tg = 22, Bg = 8, Hg = Tg + grupos.length * rh + Bg, d0 = E.som(months[0]), d1 = E.eom(months[n - 1]), esc2 = (W - Lg - 150) / (d1 - d0 + 1), pg = (W - Lg - 150) / (n || 1), g3 = '', kg = Math.max(1, Math.ceil(n / 14));
  months.forEach(function (mi, i) { g3 += '<line x1="' + (Lg + i * pg) + '" x2="' + (Lg + i * pg) + '" y1="' + Tg + '" y2="' + (Hg - Bg) + '" stroke="' + G_GRADE + '"/>' + (i % kg === 0 ? '<text x="' + (Lg + i * pg + pg / 2) + '" y="13" text-anchor="middle">' + E.miLabel(mi).toLowerCase() + '</text>' : ''); });
  grupos.forEach(function (g, i) {
    var yy = Tg + i * rh, x1 = Lg + (g.ini - d0) * esc2, w = Math.max(4, (g.fim - g.ini + 1) * esc2), nm = nomeBonito(g.nome);
    g3 += '<text class="f" x="' + (Lg - 10) + '" y="' + (yy + 19) + '" text-anchor="end">' + esc(nm.length > 36 ? nm.slice(0, 35) + '…' : nm) + '</text>' +
      '<rect x="' + x1 + '" y="' + (yy + 8) + '" width="' + w + '" height="14" rx="4" fill="' + g.cor + '" data-tip="' + esc(nm + '\n' + fdate(g.ini) + ' a ' + fdate(g.fim) + ' (' + prazoExt(g.ini, g.fim) + ')\nR$ ' + money(g.total)) + '"/>' +
      '<text x="' + (x1 + w + 6) + '" y="' + (yy + 19) + '">' + fdate(g.ini).slice(0, 5) + ' a ' + fdate(g.fim).slice(0, 5) + ' · R$ ' + compact(g.total) + '</text>';
  });
  s += '<div class="gc"><h3>Quando cada grupo de atividade trabalha</h3><p class="gq">Período em que cada grupo tem recursos mobilizados, do primeiro início ao último término.</p><div class="gsvg"><svg viewBox="0 0 ' + W + ' ' + Hg + '" role="img" aria-label="Cronograma por grupo de atividade">' + g3 + '</svg></div>' +
    '<p class="ler"><b>Como ler:</b> cada barra vai do início ao término do grupo; ao lado estão as datas e o custo previsto. As cores são as mesmas das linhas do gráfico mensal.</p></div>';

  /* 5. rankings */
  var soma = function (fn) { var m = new Map(); rows.forEach(function (r) { var k = fn(r); m.set(k, (m.get(k) || 0) + r.geral); }); return Array.from(m, function (q) { return { nome: q[0], v: q[1] }; }); };
  var elem = E.ELEMENTOS.map(function (e) { var k = e[0], C = cvDe('ABCDEF'.indexOf(k[0]) + 1); return { nome: C.k + ' - ' + e[1], v: E.sum(rows, function (r) { return r.el[k] || 0; }) }; });
  var rk = function (chave, tit, perg, itens, max, cor) {
    itens = itens.filter(function (i) { return i.v > 0; }).sort(function (a, b) { return b.v - a.v; }).slice(0, max);
    var aberto = S.v['rk' + chave], vis = aberto ? itens : itens.slice(0, 8), top = itens[0] ? itens[0].v : 1, tres = itens.slice(0, 3).reduce(function (a, i) { return a + i.v; }, 0);
    return '<div class="gc"><h3>' + tit + '</h3><p class="gq">' + perg + '</p><div class="gl r4"><span class="cab">#</span><span class="cab">Descrição</span><span class="cab"></span><span class="cab v">Valor (R$)</span><span class="cab p">% do total</span>' + vis.map(function (i, k) {
      var nm = i.nome;
      return '<span class="ps">' + (k + 1) + '</span><span data-tip="' + esc(nm + '\nR$ ' + money(i.v)) + '">' + esc(nm) + '</span><span class="tr"><i style="width:' + (100 * i.v / top).toFixed(1) + '%;background:' + cor + '"></i></span><span class="v">' + money(i.v) + '</span><span class="p">' + pct(i.v / tot) + '</span>';
    }).join('') + '</div>' + (itens.length > 8 ? '<button class="gmais" ' + h(function () { S.v['rk' + chave] = !aberto; agendar(); }) + '>' + (aberto ? 'Mostrar só os 8 primeiros' : 'Mostrar os ' + itens.length + ' primeiros') + '</button>' : '') +
      '<p class="ler">' + (itens.length > 3 ? 'Os 3 primeiros somam <b>' + pct(tres / tot) + '</b> do custo total.' : 'Lista completa: ' + itens.length + ' item(ns).') + '</p></div>';
  };
  s += graReal(p);
  s += '<div class="grid2">' + rk('a', 'Ranking de atividades', 'Quais grupos de atividade custam mais.', soma(function (r) { return r.atividade; }), 10, COR[0]) +
    rk('e', 'Ranking de equipes', 'Quais atividades (equipes) custam mais.', soma(function (r) { return r.equipe; }), 24, COR[0]) +
    rk('d', 'Ranking de detalhe', 'Quais parcelas de custo pesam mais (salários, encargos, locação, combustível…).', elem, 24, COR[0]) +
    rk('g', 'Ranking geral', 'Quais recursos (funções, veículos, materiais, insumos e serviços) custam mais.', soma(function (r) { return r.d; }), 24, COR[0]) + '</div>';
  return s + '</div>';
}

/* ================= TABELAS — configurações ================= */
var CFG_SECOES = [
  ['p', 'Deste projeto', [['proj', 'Dados do projeto'], ['cal', 'Calendário e jornada'], ['clima', 'Condições climáticas'], ['reaj', 'Reajustes de preço']]],
  ['g', 'De todos os projetos', [['emp', 'Empresa executora'], ['enc', 'Encargos (INSS, IRRF, FGTS)'], ['sal', 'Salários e adicionais'], ['ben', 'Benefícios'], ['comb', 'Combustível'], ['viag', 'Viagens'], ['cc', 'Centros de custo'], ['fer', 'Feriados nacionais']]],
  ['s', 'Cadastros do sistema', [['uni', 'Unidades de medida'], ['atv', 'Modelo de grupos de atividade'], ['bd', 'Listas dos bancos de dados'], ['ghe', 'Exames por GHE'], ['epi', 'Kits de EPI']]]
];
var FASES = { 'EM PLANEJAMENTO': 'Em planejamento', 'EM ANDAMENTO': 'Em andamento', 'CONCLUIDA': 'Concluída' };
var TIPOS_OBRA = [['Energia solar', 'MWp'],['Energia eólica', 'MW'],['Hidrelétricas', 'MW'],['Termelétricas', 'MW'],['Usinas nucleares', 'MW'],['BESS / Armazenamento', 'MWh'],['Subestações', 'kV'],['Linhas de transmissão', 'km'],['Redes de média tensão (RMT)', 'km'],['Redes de baixa tensão (RBT)', 'km'],['Construção residencial', 'm²'],['Edifícios comerciais', 'pavimentos'],['Arranha-céus', 'pavimentos'],['Galpões industriais', 'm²'],['Centros logísticos', 'm²'],['Data centers', 'MW'],['Refinarias', 'barris/dia'],['Petróleo e gás', 'barris/dia'],['Gasodutos', 'km'],['Oleodutos', 'km'],['Mineração', 't/dia'],['Siderurgia', 't/ano'],['Indústria química', 't/ano'],['Fábricas', 't/ano'],['Rodovias', 'km'],['Ferrovias', 'km'],['Metrôs', 'km'],['Pontes', 'km'],['Túneis', 'km'],['Aeroportos', 'm de pista'],['Terminais portuários', 't/ano'],['Saneamento (ETA)', 'm³/dia'],['Tratamento de esgoto (ETE)', 'm³/dia'],['Adutoras', 'km'],['Barragens', 'm de altura'],['Irrigação agrícola', 'ha'],['Fazendas', 'ha'],['Armazenagem de grãos', 'toneladas'],['Frigoríficos', 'cabeças/dia'],['Edificações', 'm²'],['Telecomunicações', 'km de fibra óptica'],['Torres de telecomunicações', 'm'],['Parques urbanos', 'ha'],['Loteamentos', 'ha'],['Aterros sanitários', 't/dia'],['Hotéis', 'quartos'],['Estádios', 'lugares'],['Parques temáticos', 'ha']];
var TIPO_ANTIGO = { 'USINA SOLAR FOTOVOLTAICA': 'Energia solar', 'SUBESTACAO': 'Subestações', 'LINHA DE TRANSMISSAO': 'Linhas de transmissão', 'PARQUE EOLICO': 'Energia eólica', 'EDIFICACAO RESIDENCIAL': 'Construção residencial', 'EDIFICACAO COMERCIAL': 'Edifícios comerciais', 'GALPAO INDUSTRIAL': 'Galpões industriais', 'SANEAMENTO': 'Saneamento (ETA)' };
function tipoInfo(t) { t = TIPO_ANTIGO[t] || t; var r = null; TIPOS_OBRA.forEach(function (x) { if (x[0] === t || semAcento(x[0]) === semAcento(t || '')) r = x; }); return r; }
function tipoNome(p) { var x = tipoInfo(p.tipo); return x ? x[0] : nomeFrase(p.tipo); }
function tipoUn(p) { var x = tipoInfo(p.tipo); return x ? x[1] : ''; }
function tipoCat(t) { var x = tipoInfo(t); return !x ? '' : x[0] === 'Energia solar' ? 'UFV' : x[0] === 'Subestações' ? 'SE' : x[0] === 'Energia eólica' ? 'EOL' : 'OUTRO'; }
/* tipos mais usados, na ordem em que aparecem no primeiro item de Dados do projeto */
var TIPOS_PRINC = [['Subestações', 'Subestação'], ['Energia eólica', 'Parque eólico'], ['Energia solar', 'Parque solar (UFV)'], ['Rodovias', 'Estrada / rodovia'], ['Edificações', 'Edificação'], ['Tratamento de esgoto (ETE)', 'ETE – tratamento de esgoto'], ['Saneamento (ETA)', 'ETA – tratamento de água'], ['Linhas de transmissão', 'Linha de transmissão'], ['Redes de média tensão (RMT)', 'Rede de média tensão'], ['Galpões industriais', 'Galpão industrial']];
function eolMw(p) { var e = p.eol || {}; return (e.frentes || []).reduce(function (a, f) { return a + num(f.wtg); }, 0) * num(e.mw); }
function portePorTipo(p) { return num(p.porte) || (tipoCat(p.tipo) === 'UFV' ? num(p.mwp) : tipoCat(p.tipo) === 'SE' ? num(p.tensao) : tipoCat(p.tipo) === 'EOL' ? eolMw(p) : 0); }
/* projetos antigos: tipo pela lista nova, porte pelos campos de potência/tensão */
function tipoMigrar(p) { var x = tipoInfo(p.tipo), mud = false; if (x && p.tipo !== x[0]) { p.tipo = x[0]; mud = true; } if (x && p.porte == null && portePorTipo(p)) { p.porte = portePorTipo(p); mud = true; } if (x && !p.categoria) { p.categoria = tipoCat(p.tipo); mud = true; } return mud; }
/* Dados do projeto mostra os grupos 'p' e 'g'; Sistema › Configurações mostra as preferências e os cadastros do sistema ('s') */
function cfgSecoes(modo) { if (modo === 'sis') return [['x', 'Preferências', [['pref', 'Preferências do sistema']]]].concat(CFG_SECOES.filter(function (g) { return g[0] === 's' && ehAdmin(); })); return CFG_SECOES.filter(function (g) { return g[0] !== 's'; }); }
/* seletor em botões (um item por vez) */
function cfgChips(itens, atual, escolher, novo) {
  return '<div class="chips">' + itens.map(function (x) { var k = Array.isArray(x) ? x[0] : x, r = Array.isArray(x) ? x[1] : x; return '<button class="' + (k === atual ? 'on' : '') + '" ' + h(function () { escolher(k); agendar(); }) + '>' + esc(r) + '</button>'; }).join('') + (novo && podeEditar() ? '<button class="mais" ' + h(function () { novo(); agendar(); }) + '>+ Novo</button>' : '') + '</div>';
}
function cfgFixos(arr) { return '<div class="chips fx">' + arr.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + '</div>'; }
function cfgLista(pre, arr, sv, rot, o) {
  o = o || {};
  return cfgTab(bloco(pre, '', arr, (o.num ? [{ k: 'n', rot: 'Item', t: 'n', calc: function (r, i) { return i + 1; } }] : []).concat([{ k: 'v', rot: rot, upper: true, get: function (r) { return r; }, set: function (r, x, i) { if (x && x !== arr[i]) { if (arr.indexOf(x) >= 0) return msgbox('AVISO!', 'Já existe um item com esse nome.'); if (o.ren) o.ren(arr[i], x); arr[i] = x; } } }]), sv, function () { return 'NOVO ITEM ' + (arr.length + 1); }, { rem: o.rem ? function (r) { o.rem(r); } : null }));
}
/* campo de configuração: rótulo, valor sempre visível e dica curta */
function cfgCampo(id, rot, valor, set, o) {
  o = o || {};
  var t = o.t || 'text', ed = podeEditar() && !o.ro, corpo, suf = o.suf || (t === 'pct' ? '%' : t === 'money' ? 'R$' : '');
  var mostra = t === 'pct' ? nf4.format(Math.round(num(valor) * 1e8) / 1e6) : t === 'money' ? money(valor) : t === 'num' ? (valor ? nf4.format(valor) : '0') : t === 'date' ? (valor ? fiso(valor) : '–') : (valor == null || valor === '' ? '–' : (o.rotulos ? o.rotulos[valor] || valor : valor));
  if (!ed) corpo = '<span class="ro">' + (t === 'money' ? 'R$ ' : '') + esc(mostra) + (t === 'pct' ? '%' : '') + '</span>';
  else if (o.ops) corpo = '<select id="' + id + '" ' + h(function (el) { set(o.num ? +el.value : el.value); agendar(); }) + '>' + o.ops.map(function (x) { return '<option value="' + esc(x) + '"' + (String(x) === String(valor) ? ' selected' : '') + '>' + esc(o.rotulos ? o.rotulos[x] || x : x) + '</option>'; }).join('') + '</select>';
  else {
    var val = t === 'date' ? (valor || '') : t === 'text' ? (valor == null ? '' : valor) : t === 'pct' ? numIn(Math.round(num(valor) * 1e8) / 1e6) || '0' : t === 'money' ? num(valor).toFixed(2).replace('.', ',') : numIn(valor) || '0';
    corpo = '<span class="cx">' + (suf === 'R$' ? '<em>R$</em>' : '') + '<input id="' + id + '" type="' + (t === 'date' ? 'date' : 'text') + '"' + (t === 'text' || t === 'date' ? '' : ' inputmode="decimal" style="text-align:right"') + ' value="' + esc(val) + '" ' +
      h(function (el) { var v = el.value; if (t === 'pct') v = parseNum(v) / 100; else if (t === 'money' || t === 'num') v = parseNum(v); else if (t === 'text') v = o.upper ? semAcento(v).trim() : v.trim(); if (o.obrig && !v) return agendar(); set(v); agendar(); }) + '>' + (suf && suf !== 'R$' ? '<em>' + suf + '</em>' : '') + '</span>';
  }
  return '<label' + (o.w2 ? ' class="w2"' : '') + '>' + rot + corpo + (o.dica ? '<small>' + o.dica + '</small>' : '') + '</label>';
}
function cfgCard(tit, ajuda, corpo) { return '<div class="cs"><h3>' + tit + '</h3>' + (ajuda ? '<p class="aj">' + ajuda + '</p>' : '<div style="height:8px"></div>') + corpo + '</div>'; }
function cfgTab(html) { return '<div class="tw2">' + html + '</div>'; }
function shTabelas(p, modo) {
  var sis = modo === 'sis', t = S.base.tabelas, v = t.val, sv = function () { salvarBase('tabelas'); }, svp = function () { salvarMeta(p); }, sec = sis ? (S.v.sisCfg || 'pref') : (S.v.cfg || 'proj'), ed = podeEditar();
  var ehProj = sec === 'proj' || sec === 'cal' || sec === 'clima' || sec === 'reaj', rotulo = '';
  cfgSecoes(modo).forEach(function (g) { g[2].forEach(function (x) { if (x[0] === sec) rotulo = x[1]; }); });
  if (!rotulo) { if (sis) { sec = S.v.sisCfg = 'pref'; rotulo = 'Preferências do sistema'; } else { sec = S.v.cfg = 'proj'; rotulo = 'Dados do projeto'; ehProj = true; } }
  var s = '<div class="a1">' + (sis ? 'CONFIGURAÇÕES' : 'DADOS DO PROJETO') + '</div><div class="a2"><span>' + (sis ? 'PREFERÊNCIAS E CADASTROS DO SISTEMA' : 'PARÂMETROS DO PROJETO E DA EMPRESA') + '</span></div><div class="cfg"><nav class="cfg-n" aria-label="Assuntos">' + cfgSecoes(modo).map(function (g) {
    return '<h5>' + g[1] + '</h5>' + g[2].map(function (x) { return '<button class="' + (sec === x[0] ? 'on' : '') + '" ' + h(function () { if (sis) S.v.sisCfg = x[0]; else S.v.cfg = x[0]; $('#main').scrollTop = 0; agendar(); }) + '>' + x[1] + '</button>'; }).join('');
  }).join('') + '</nav><div class="cfg-c"><h2>' + rotulo + (sec === 'pref' ? '<span class="esc">Tema e letra valem para este navegador</span>' : ehProj ? '<span class="esc">' + (p ? 'Vale para o projeto: ' + esc(p.nome) : 'Por projeto') + '</span>' : '<span class="esc g">Vale para todos os projetos</span>') + '</h2>';
  var fim = '</div></div>';
  if (sec === 'pref') return s + shSisPref() + fim;
  if (ehProj && !p) return s + '<p class="dsc">Estas configurações pertencem a um projeto.</p>' + cfgCard('Nenhum projeto selecionado', 'Escolha um projeto na lista do canto superior esquerdo' + (ed ? ' ou crie um com o botão Novo' : '') + '. As configurações "De todos os projetos" podem ser consultadas sem projeto aberto.', '') + fim;
  if (ehProj) { p.grupos = gruposDe(p) === p.grupos ? p.grupos : S.base.tabelas.atividades.slice(); p.subestacoes = p.subestacoes || []; p.reajuste = p.reajuste || {}; p.feriadosMun = p.feriadosMun || []; p.paralisacoes = p.paralisacoes || []; }

  if (sec === 'emp') {
    var em = S.base.empresa || (S.base.empresa = {}), sve = function () { salvarBase('empresa'); };
    var cpE = function (id, rot, k, o) { return cfgCampo(id, rot, em[k], function (x) { em[k] = x; sve(); }, Object.assign({ upper: true }, o || {})); };
    s += '<p class="dsc">Empresa responsável pela execução de todos os projetos da carteira. Aparece no consolidado da guia Projetos, no Sobre e nas exportações.</p>' +
      cfgCard('Logo do executor', 'Aparece no RDO, nos relatórios e nas exportações de todos os projetos.', '<div class="logo-g">' + logoCampo('Logo do executor', em.logo, function (u) { em.logo = u; sve(); }) + '</div>') +
      cfgCard('Identificação', 'Dados do cartão CNPJ (comprovante de inscrição e de situação cadastral).', '<div class="cf">' + cpE('ce-n', 'Nome da marca', 'marca') +
        cpE('ce-c', 'CNPJ', 'cnpj') + cfgCampo('ce-a', 'Data de abertura', em.abertura, function (x) { em.abertura = x; sve(); }, { t: 'date' }) + cpE('ce-p', 'Porte', 'porte') + cpE('ce-s', 'Situação cadastral', 'situacao') + '</div>') +
      cfgCard('Atividade e natureza jurídica', '', '<div class="cf">' + cpE('ce-cn', 'Atividade principal (CNAE)', 'cnae', { w2: true }) + cpE('ce-cs', 'Atividades secundárias', 'cnae2', { w2: true }) + cpE('ce-nj', 'Natureza jurídica', 'natureza', { w2: true }) + '</div>') +
      cfgCard('Endereço', '', '<div class="cf">' + cpE('ce-l', 'Logradouro', 'logradouro', { w2: true }) + cpE('ce-nu', 'Número', 'numero') + cpE('ce-co', 'Complemento', 'complemento') + cpE('ce-b', 'Bairro', 'bairro') + cpE('ce-m', 'Município', 'municipio') + cpE('ce-u', 'UF', 'uf') + cpE('ce-cep', 'CEP', 'cep') + '</div>');
    return s + fim;
  }
  if (sec === 'proj') {
    s += '<p class="dsc">Identificação do projeto e as listas que aparecem ao cadastrar atividades.</p>' + cfgTipo(p, svp) +
      cfgCard('Identificação', 'O nome forma o título de todas as guias.', '<div class="cf">' +
        cfgCampo('cp-n', 'Nome do projeto', p.nome, function (x) { p.nome = x; svp(); }, { w2: true, upper: true, obrig: true }) +
        cfgCampo('cp-cod', 'Código da obra', p.sigla, function (x) { p.sigla = semAcento(x).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); svp(); agendar(); }, { dica: 'Sigla usada nas nomenclaturas padrão (centros de custo, CPUs novas, arquivos). Ex.: SPGA, FSA.' }) +
        cfgCampo('cp-pt', 'Porte do empreendimento', portePorTipo(p), function (x) { p.porte = x; var c = tipoCat(p.tipo); if (c === 'UFV') p.mwp = x; if (c === 'SE') p.tensao = x; svp(); agendar(); }, { t: 'num', suf: tipoUn(p) || '–', dica: tipoUn(p) ? 'Tamanho medido em ' + tipoUn(p) + '.' : 'Escolha o tipo de obra para ver a unidade.' }) +
        cfgCampo('cp-o', 'OT / código do projeto', p.ot, function (x) { p.ot = x; svp(); }) + cfgCampo('cp-d', 'Data-base', p.database, function (x) { p.database = x; svp(); }, { t: 'date', dica: 'Mês de referência dos preços.' }) +
        cfgCampo('cp-f', 'Situação da obra', p.fase || 'EM PLANEJAMENTO', function (x) { p.fase = x; svp(); }, { ops: ['EM PLANEJAMENTO', 'EM ANDAMENTO', 'CONCLUIDA'], rotulos: FASES }) +
        cfgCampo('cp-ex', 'Empresa executora', empresaRot(), null, { ro: true, dica: 'Definida em Dados do projeto › Empresa executora (vale para todos os projetos).' }) +
        cfgCampo('cp-s', 'Visibilidade', p.liberado ? 'Liberado para convidados' : 'Rascunho (só o administrador vê)', null, { ro: true, dica: ed ? 'Altere com o botão Liberar / Tornar rascunho, no topo.' : '' }) + '</div>') +
      cfgLogos(p, svp) + cfgInicio(p, svp) + (p.categoria === 'UFV' ? cfgUfv(p, svp) : p.categoria === 'SE' ? cfgSe(p, svp) : p.categoria === 'EOL' ? cfgEol(p, svp) : '') + cfgCcs(p, svp) + cfgContratante(p, svp) + cfgLocal(p, svp) + cfgBdi(p, svp) +
      '<div class="duo">' + cfgCard('Grupos de atividade', 'Etapas da obra: formam o primeiro nível da numeração (1, 2, 3…) na FIN e na COM. Ajuste para o tipo de obra deste projeto.', cfgLista('pg', p.grupos, svp, 'Grupo', { num: true, rem: function (r) {
        var i = p.grupos.indexOf(r), n = p.atividades.filter(function (a) { return a.grupo === i + 1; }).length;
        if (n) return msgbox('AVISO!', 'O grupo ' + r + ' tem ' + n + ' atividade(s). Exclua ou mova as atividades antes de excluir o grupo.');
        if (p.grupos.length < 2) return msgbox('AVISO!', 'O projeto precisa de pelo menos um grupo de atividade.');
        p.grupos.splice(i, 1); p.atividades.forEach(function (a) { if (a.grupo > i + 1) { a.grupo--; salvarAtiv(p, a); } });
      } })) +
      cfgCard('Locais / frentes de obra', 'Divisões físicas da obra: subestação, bloco, trecho, pavimento… As siglas aparecem no campo Local / frente ao criar uma atividade e servem de filtro no Histograma e no Custo Detalhado.', cfgTab(bloco('ts', '', p.subestacoes, [{ k: 's', rot: 'Sigla', upper: true }, { k: 'd', rot: 'Descrição', upper: true }], svp, function () { return { d: '', tensao: 0, s: '' }; }))) + '</div>' +
      (temBaseP(p) ? cfgCard('Base de preços própria', 'Este projeto calcula com a base de preços que veio da planilha original' + (p.baseOrigem ? ' (' + esc(p.baseOrigem) + ')' : '') + ', e não com as guias MAO, VEM, MAT, IND e SER do sistema. Assim o custo fica igual ao da planilha, com os preços da época.', ed ? '<p style="margin:4px 0 0"><button class="lk pg" ' + h(function () { confirma('Passar o projeto ' + p.nome + ' para a base de preços geral do sistema?\n\nO custo será recalculado com os preços atuais das guias MAO, VEM, MAT, IND e SER. A base própria será apagada.', function () { apagarBaseP(p); p._base = null; p._ctx = null; p.basePropria = false; delete p.baseOrigem; salvarMeta(p); }); }) + '>Usar a base geral do sistema</button></p>' : '') : '') +
      cfgCard('Segurança do trabalho', 'Usado na guia SESMT para dimensionar a equipe exigida pela NR-4.', '<div class="cf">' + cfgCampo('cp-c', 'CNAE (código e denominação)', p.cnae, function (x) { p.cnae = x; svp(); }, { w2: true }) +
        cfgCampo('cp-g', 'Grau de risco', p.grauRisco || 4, function (x) { p.grauRisco = x; svp(); }, { ops: [1, 2, 3, 4], num: true, dica: 'De 1 (menor) a 4 (maior).' }) + '</div>');
  } else if (sec === 'cal') {
    var jr = {}, jAt = null; t.jornadas.forEach(function (j) { jr[j.cod] = nomeFrase(j.t); if (j.cod === p.jornada) jAt = j; });
    s += '<p class="dsc">Define quais dias contam como úteis. Isso afeta os dias úteis da FIN, o custo médio diário e as horas de trabalho (HH e HM).</p>' +
      cfgCard('Jornada de trabalho', 'Dias da semana trabalhados neste projeto.', '<div class="cf">' + cfgCampo('cc-j', 'Jornada', p.jornada, function (x) { p.jornada = x; svp(); }, { ops: t.jornadas.map(function (j) { return j.cod; }), rotulos: jr, num: true }) +
        cfgCampo('cc-m', 'Dias úteis por mês (referência)', jAt ? jAt.mes + ' dias' : '–', null, { ro: true }) + '</div>') +
      '<div class="duo">' + cfgCard('Feriados municipais', 'Datas do município da obra. Não contam como dia útil.', cfgTab(bloco('tfm2', '', p.feriadosMun, [{ k: 'dt', rot: 'Data', t: 'date' }, { k: 'd', rot: 'Descrição', upper: true }], svp, function () { return { dt: '', d: '' }; }))) +
      cfgCard('Paralisações', 'Períodos sem trabalho (recesso, carnaval…). Todos os dias do intervalo deixam de ser úteis.', cfgTab(bloco('tpa', '', p.paralisacoes, [{ k: 'i', rot: 'Início', t: 'date' }, { k: 't', rot: 'Término', t: 'date' }, { k: 'm', rot: 'Motivo', upper: true }], svp, function () { return { i: '', t: '', m: '' }; }))) + '</div>' +
      cfgCard('Feriados nacionais', 'São os mesmos para todos os projetos (' + t.feriados.length + ' datas cadastradas).', '<button class="lk" ' + h(function () { S.v.cfg = 'fer'; agendar(); }) + '>Ver feriados nacionais</button>');
  } else if (sec === 'clima') {
    s += cfgClima(p, svp);
  } else if (sec === 'reaj') {
    s += '<p class="dsc">Aumentos de preço previstos ao longo da obra. O percentual vale a partir da data informada e soma-se aos anteriores. Exemplo: 5% em 01/01/2026 deixa 5% mais caro todo custo daquele tipo de janeiro de 2026 em diante.</p><div class="duo">' +
      [['MAO', 'Mão de obra', 'Salários, encargos, benefícios, exames e EPI.'], ['VEM', 'Veículos e máquinas', 'Locação, combustível, manutenção e mobilização.'], ['MAT', 'Materiais e aquisições', 'Materiais, ferramentas e compras.'], ['SER', 'Serviços terceirizados', 'Custos mensais, fixos e periódicos de serviços.'], ['IND', 'Indiretos e insumos', 'Custos mensais, rateios e insumos.']].map(function (x) {
        var l = p.reajuste[x[0]] = p.reajuste[x[0]] || [];
        return cfgCard(x[1], x[2], cfgTab(bloco('trj' + x[0], '', l, [{ k: 'dt', rot: 'A partir de', t: 'date' }, { k: 'p', rot: 'Reajuste', t: 'pct' }, { k: 'ac', rot: 'Acumulado', t: 'n', calc: function (r, i) { var a = 0, j; for (j = 0; j <= i; j++) a += num(l[j].p); return pct(a); } }], function () { l.sort(function (a, b) { return String(a.dt || '9').localeCompare(String(b.dt || '9')); }); svp(); }, function () { return { dt: '', p: 0 }; })));
      }).join('') + '</div>';
  } else if (sec === 'enc') {
    s += '<p class="dsc">Encargos sobre a folha. Entram no cálculo do custo mensal de cada função, na guia MAO.</p>' +
      cfgCard('INSS do funcionário', 'Desconto = salário bruto × alíquota da faixa − parcela a deduzir (cálculo progressivo). Acima da última faixa vale o desconto fixo (teto).', cfgTab(bloco('ti', '', t.inss.faixas, [{ k: 'de', rot: 'Salário de (R$)', calc: function (r, i) { return i ? money(t.inss.faixas[i - 1].ate + 0.01) : '0,00'; }, t: 'n' }, { k: 'ate', rot: 'Até (R$)', t: 'money' }, { k: 'p', rot: 'Alíquota', t: 'pct' }, { k: 'par', rot: 'Parcela a deduzir (R$)', t: 'money' }], sv, function () { return { ate: 0, p: 0, par: 0 }; })) +
        '<div class="cf" style="margin-top:12px">' + cfgCampo('ce-t', 'Desconto fixo acima da última faixa', t.inss.teto, function (x) { t.inss.teto = x; sv(); }, { t: 'money' }) + '</div>') +
      cfgCard('INSS da empresa', 'Percentual sobre o salário bruto. Não se aplica a PJ.', '<div class="cf">' + cfgCampo('ce-i0', 'Função sem periculosidade', t.inssEmp[0], function (x) { t.inssEmp[0] = x; sv(); }, { t: 'pct' }) + cfgCampo('ce-i1', 'Função com periculosidade', t.inssEmp[1], function (x) { t.inssEmp[1] = x; sv(); }, { t: 'pct' }) + '</div>') +
      cfgCard('IRRF', 'Usado para estimar o salário líquido. Deixe "Até" vazio na última faixa.', cfgTab(bloco('tr', '', t.irpf, [{ k: 'de', rot: 'Base de (R$)', calc: function (r, i) { return i ? money(t.irpf[i - 1].ate + 0.01) : '0,00'; }, t: 'n' }, { k: 'ate', rot: 'Até (R$)', t: 'money', get: function (r) { return r.ate == null ? 0 : r.ate; }, set: function (r, x) { r.ate = x || null; } }, { k: 'p', rot: 'Alíquota', t: 'pct' }, { k: 'par', rot: 'Parcela a deduzir (R$)', t: 'money' }], sv, function () { return { ate: null, p: 0, par: 0 }; })) +
        '<div class="cf" style="margin-top:12px">' + cfgCampo('ce-d', 'Dedução por dependente', v.irpfDep, function (x) { v.irpfDep = x; sv(); }, { t: 'money' }) + '</div>') +
      cfgCard('FGTS', 'Depósito mensal e multa rescisória provisionada.', '<div class="cf">' + cfgCampo('ce-f0', 'FGTS mensal', t.fgts.demais, function (x) { t.fgts.demais = x; sv(); }, { t: 'pct' }) + cfgCampo('ce-f1', 'FGTS de aprendiz', t.fgts.aprendiz, function (x) { t.fgts.aprendiz = x; sv(); }, { t: 'pct' }) + cfgCampo('ce-f2', 'Multa rescisória', v.fgtsMulta, function (x) { v.fgtsMulta = x; sv(); }, { t: 'pct', dica: 'Sobre o saldo de FGTS.' }) + '</div>');
  } else if (sec === 'sal') {
    s += '<p class="dsc">Valores de referência e percentuais dos adicionais. Entram no cálculo da guia MAO.</p>' +
      cfgCard('Valores de referência', '', '<div class="cf">' + cfgCampo('cs-m', 'Salário mínimo', v.salMin, function (x) { v.salMin = x; sv(); }, { t: 'money', dica: 'Base da insalubridade.' }) +
        cfgCampo('cs-i', 'Insalubridade', v.insal, function (x) { v.insal = x; sv(); }, { t: 'pct', dica: 'Sobre o salário mínimo.' }) + cfgCampo('cs-p', 'Periculosidade', v.peric, function (x) { v.peric = x; sv(); }, { t: 'pct', dica: 'Sobre o salário base.' }) +
        cfgCampo('cs-n', 'Adicional noturno', v.adNot, function (x) { v.adNot = x; sv(); }, { t: 'pct', dica: 'Sobre a hora normal.' }) + cfgCampo('cs-d', 'DSR sobre horas extras', v.dsr, function (x) { v.dsr = x; sv(); }, { t: 'pct' }) + '</div>') +
      cfgCard('Adicional de horas extras', 'Acréscimo sobre a hora normal (salário ÷ 220), conforme o dia em que a hora extra é feita.', '<div class="cf">' + t.horasExtras.map(function (x, i) { return cfgCampo('cs-h' + i, nomeFrase(x.t), x.p, function (y) { x.p = y; sv(); }, { t: 'pct' }); }).join('') + '</div>');
  } else if (sec === 'ben') {
    var al = function (pre, l) { return cfgTab(bloco(pre, '', l, [{ k: 't', rot: 'Refeição', upper: true }, { k: 'd', rot: 'Valor por dia (R$)', t: 'money' }, { k: 'n', rot: 'Dias no mês', t: 'num' }, { k: 'm', rot: 'Mensal (R$)', calc: function (r) { return money(num(r.d) * num(r.n)); }, t: 'n' }], sv, function () { return { t: '', d: 0, n: 30 }; })); };
    s += '<p class="dsc">Benefícios por pessoa, somados ao custo mensal de cada função.</p><div class="duo">' +
      cfgCard('Alimentação — mão de obra própria', 'Vale para linhas da COM com tipo PROPRIO.', al('tap', t.alimPro)) + cfgCard('Alimentação — mão de obra local', 'Vale para linhas da COM com tipo LOCAL.', al('tal', t.alimLoc)) + '</div>' +
      cfgCard('Plano de saúde', 'Valor por vida. O custo considera o titular e 2 dependentes; a opção N/A significa sem plano e deve ser mantida.', cfgTab(bloco('tps', '', t.planoSaude, [{ k: 't', rot: 'Operadora', upper: true }, { k: 'v', rot: 'Valor por vida (R$)', t: 'money' }], sv, function () { return { t: '', v: 0 }; }))) +
      cfgCard('Outros benefícios', '', '<div class="cf">' + cfgCampo('cb-s', 'Seguro de vida coletivo', v.seguroVida, function (x) { v.seguroVida = x; sv(); }, { t: 'money', dica: 'Por pessoa, por mês.' }) + cfgCampo('cb-c', 'Cesta básica', v.cesta, function (x) { v.cesta = x; sv(); }, { t: 'money', dica: 'Para funções marcadas com cesta = SIM.' }) +
        cfgCampo('cb-p', 'PLR: como é paga', t.plr.criterio, function (x) { t.plr.criterio = x; sv(); }, { ops: ['ANUAL', 'MENSAL', 'N/A'], rotulos: { ANUAL: 'Anual (dividida em 12)', MENSAL: 'Mensal', 'N/A': 'Não se aplica' } }) + cfgCampo('cb-v', 'PLR: valor', t.plr.valor, function (x) { t.plr.valor = x; sv(); }, { t: 'money' }) + '</div>');
  } else if (sec === 'comb') {
    s += '<p class="dsc">Preço por litro de cada combustível. É multiplicado pelo consumo mensal de cada veículo, na guia VEM.</p>' + cfgCard('Preço do combustível', 'Mantenha a opção N/A com valor zero, para equipamentos sem consumo.', cfgTab(bloco('tcm', '', t.combustivel, [{ k: 't', rot: 'Combustível', upper: true }, { k: 'v', rot: 'Preço por litro (R$)', t: 'money' }], sv, function () { return { t: '', v: 0 }; })));
  } else if (sec === 'viag') {
    s += '<p class="dsc">Custo de ida e volta por trecho e meio de transporte. Cada função da guia MAO usa a média da coluna do meio de transporte escolhido, metade na ida e metade na volta.</p>' + cfgCard('Tabela de viagens', 'Valores em R$, ida e volta.', cfgTab(bloco('tvg', '', t.viagem.rows, [{ k: 'o', rot: 'Origem', upper: true }, { k: 'dst', rot: 'Destino', upper: true }].concat(t.viagem.cols.map(function (c, i) { return { k: 'v' + i, rot: nomeFrase(c), t: 'money', get: function (r) { return r.v[i]; }, set: function (r, x) { r.v[i] = x; } }; })), sv, function () { return { o: '', dst: '', v: t.viagem.cols.map(function () { return 0; }) }; })));
  } else if (sec === 'cc') {
    s += '<p class="dsc">Lista usada no campo Centro de custo das atividades. Ao criar uma atividade, aparecem primeiro os centros do mesmo grupo.</p>' + cfgCard('Centros de custo', t.centrosCusto.length + ' cadastrados.', cfgTab(bloco('tc', '', t.centrosCusto, [{ k: 'd', rot: 'Descrição unificada' }, { k: 'red', rot: 'Reduzido' }, { k: 'plan', rot: 'Usado no planejamento', ops: ['SIM', 'NAO'], get: function (r) { return r.plan ? 'SIM' : 'NAO'; }, set: function (r, x) { r.plan = x === 'SIM'; } }, { k: 'g', rot: 'Grupo de atividade', ops: t.atividades }], sv, function () { return { d: '', red: '', plan: true, g: t.atividades[0] }; })));
  } else if (sec === 'uni') {
    s += '<p class="dsc">Siglas que aparecem no campo Unidade das atividades e dos bancos de dados.</p>' + cfgCard('Unidades de medida', t.unidades.length + ' cadastradas.', cfgTab(bloco('bu', '', t.unidades, [{ k: 's', rot: 'Sigla', upper: true }, { k: 'd', rot: 'Descrição', upper: true }], sv, function () { return { s: '', d: '' }; })));
  } else if (sec === 'atv') {
    s += '<p class="dsc">Lista copiada para cada projeto novo. Depois de criado, cada projeto tem os seus próprios grupos, em Dados do projeto, e não é afetado por mudanças aqui. Dentro de cada atividade, o custo é dividido sempre nos mesmos cinco blocos.</p><div class="duo">' +
      cfgCard('Grupos do modelo', 'Use os grupos do tipo de obra mais comum. Também classificam os centros de custo.', cfgLista('ba', t.atividades, sv, 'Grupo', { num: true, ren: function (de, para) { t.centrosCusto.forEach(function (c) { if (c.g === de) c.g = para; }); }, rem: function (r) { if (t.atividades.length < 2) return msgbox('AVISO!', 'O modelo precisa de pelo menos um grupo.'); t.atividades.splice(t.atividades.indexOf(r), 1); } })) +
      cfgCard('Conceitos de custo', 'Fixos: o cálculo e os gráficos dependem deles.', cfgTab('<div><table class="g"><thead><tr><th>Item</th><th>Conceito</th><th>Guia</th></tr></thead><tbody>' + CV.map(function (c) { return '<tr><td class="k n">' + c.item + '</td><td class="k">' + esc(c.nome) + '</td><td class="k">' + esc(c.k === 'AQU' ? 'MAT' : c.k) + '</td></tr>'; }).join('') + '</tbody></table></div>')) + '</div>';
  } else if (sec === 'bd') {
    var BD = [['MAO', 'Mão de obra'], ['VEM', 'Veículos / máquinas'], ['MAT', 'Materiais'], ['SER', 'Serviços'], ['IND', 'Insumos']].filter(function (x) { return !(x[0] === 'IND' && unificado()); }).map(function (x) { return x[0] === 'MAT' && unificado() ? ['MAT', 'Materiais e insumos'] : x; }), bk = (S.v.cfgBd === 'IND' && unificado() ? 'MAT' : S.v.cfgBd) || 'MAO', bn = BD.filter(function (x) { return x[0] === bk; })[0][1], rows = S.base[bk.toLowerCase()].rows;
    s += '<p class="dsc">Listas de opções usadas nas guias MAO, VEM, MAT, SER e IND e nas linhas da COM. Escolha o banco de dados:</p>' + cfgChips(BD, bk, function (k) { S.v.cfgBd = k; }) +
      cfgCard('Grupos — ' + bn, 'Classificação dos itens da guia ' + bk + '. Ao renomear, os itens já cadastrados acompanham.', cfgLista('bg' + bk, t.grupos[bk], sv, 'Grupo', { ren: function (de, para) { var n = 0; rows.forEach(function (r) { if (r.g === de) { r.g = para; n++; } }); if (n) salvarBase(bk.toLowerCase()); }, rem: function (r) { var n = rows.filter(function (x) { return x.g === r; }).length; if (n) return msgbox('AVISO!', 'O grupo ' + r + ' é usado por ' + n + ' item(ns) da guia ' + bk + '. Troque o grupo desses itens antes de excluir.'); t.grupos[bk].splice(t.grupos[bk].indexOf(r), 1); } })) +
      '<div class="duo">' + cfgCard('Tipo / relação na COM', 'Opções da coluna Tipo / Relação. Fixas: cada uma tem uma regra de cálculo própria.', cfgFixos(t.relacao[bk])) + cfgCard('Status', 'Situações possíveis de uma linha da COM. Fixas.', cfgFixos(t.status[bk])) + '</div>';
  } else if (sec === 'ghe' || sec === 'epi') {
    var g = S.base.ghe, svg = function () { salvarBase('ghe'); }, C = ctx(), kits = g.epigrupos.map(function (x) { return x.g; });
    if (sec === 'ghe') {
      var G = g.grupos.filter(function (x) { return x.g === S.v.cfgGhe; })[0] || g.grupos[0];
      s += '<p class="dsc">Cada função da guia MAO pertence a um Grupo Homogêneo de Exposição (GHE). O grupo define os exames admissionais, periódicos e demissionais e o kit de EPI. Escolha o grupo:</p>' +
        cfgChips(g.grupos.map(function (x) { return x.g; }), G && G.g, function (k) { S.v.cfgGhe = k; }, function () { var n = g.grupos.length + 1, nm; do { nm = 'GHE ' + ('0' + n++).slice(-2); } while (g.grupos.some(function (x) { return x.g === nm; })); g.grupos.push({ g: nm, riscos: '', epi: kits[0] || '' }); S.v.cfgGhe = nm; svg(); });
      if (G) {
        var gv = C.gheValor[G.g] || {}, lin = g.comp.filter(function (c) { return c.g === G.g; }), usoG = S.base.mao.rows.filter(function (r) { return r.ghe === G.g; }).length;
        s += cfgCard(esc(G.g), usoG + ' função(ões) da guia MAO usam este grupo.', '<div class="cf">' +
          cfgCampo('cg-n', 'Nome do grupo', G.g, function (x) { if (x === G.g) return; if (g.grupos.some(function (o) { return o.g === x; })) return msgbox('AVISO!', 'Já existe um grupo com esse nome.'); var de = G.g, n = 0; g.comp.forEach(function (c) { if (c.g === de) c.g = x; }); S.base.mao.rows.forEach(function (r) { if (r.ghe === de) { r.ghe = x; n++; } }); G.g = x; S.v.cfgGhe = x; svg(); if (n) salvarBase('mao'); }, { upper: true, obrig: true }) +
          cfgCampo('cg-e', 'Kit de EPI', G.epi, function (x) { G.epi = x; svg(); }, { ops: kits, dica: 'Composição em Kits de EPI.' }) +
          cfgCampo('cg-r', 'Riscos', G.riscos, function (x) { G.riscos = x; svg(); }, { w2: true }) + '</div>' +
          '<div class="res"><div><span>Admissional</span><b>R$ ' + money(gv.adm) + '</b></div><div><span>Periódico</span><b>R$ ' + money(gv.per) + '</b></div><div><span>Demissional</span><b>R$ ' + money(gv.dem) + '</b></div><div><span>Kit de EPI</span><b>R$ ' + money(C.epiGrupoValor[G.epi]) + '</b></div></div>' +
          '<h3 class="sub">Exames do grupo</h3><p class="aj">Quantidade de cada exame por tipo de avaliação. Use 0 quando o exame não se aplica.</p>' +
          cfgTab(bloco('bgc', '', lin, [{ k: 'ex', rot: 'Exame', ops: g.pcmso.map(function (x) { return x.d; }) }, { k: 'qa', rot: 'Qtd. admissional', t: 'num' }, { k: 'qp', rot: 'Qtd. periódico', t: 'num' }, { k: 'qd', rot: 'Qtd. demissional', t: 'num' }, { k: 'vu', rot: 'Preço do exame (R$)', t: 'n', calc: function (r) { return money((C.exPreco && C.exPreco[r.ex] || g.pcmso.filter(function (x) { return x.d === r.ex; })[0] || {}).v); } }], svg, function () { return { g: G.g, ex: g.pcmso[0].d, qa: 1, qd: 0, qp: 1 }; }, { rem: function (r) { g.comp.splice(g.comp.indexOf(r), 1); }, add: function (nv) { g.comp.push(nv); } })) +
          (ed ? '<p style="margin:12px 0 0"><button class="lk pg" ' + h(function () { if (usoG) return msgbox('AVISO!', 'O grupo ' + G.g + ' é usado por ' + usoG + ' função(ões) da guia MAO. Troque o GHE dessas funções antes de excluir.'); confirma('Tem certeza que deseja excluir o grupo ' + G.g + ' e seus exames ?\n\nEssa ação não poderá ser desfeita.', function () { g.comp = g.comp.filter(function (c) { return c.g !== G.g; }); g.grupos.splice(g.grupos.indexOf(G), 1); S.v.cfgGhe = null; svg(); }); }) + '>Excluir este grupo</button></p>' : ''));
      }
      s += cfgCard('Preço dos exames', 'Tabela única de exames (PCMSO), usada por todos os grupos.', cfgTab(bloco('bpi', '', g.pcmso, [{ k: 'd', rot: 'Exame', upper: true, set: function (r, x) { if (!x || x === r.d) return; g.comp.forEach(function (c) { if (c.ex === r.d) c.ex = x; }); r.d = x; } }, { k: 'v', rot: 'Valor unitário (R$)', t: 'money' }], svg, function () { return { d: 'NOVO EXAME ' + (g.pcmso.length + 1), v: 0 }; }, { rem: function (r) { var n = g.comp.filter(function (c) { return c.ex === r.d; }).length; if (n) return msgbox('AVISO!', 'Este exame está em ' + n + ' composição(ões) de GHE. Retire-o dos grupos antes de excluir.'); g.pcmso.splice(g.pcmso.indexOf(r), 1); } })));
    } else {
      var K = g.epigrupos.filter(function (x) { return x.g === S.v.cfgEpi; })[0] || g.epigrupos[0];
      s += '<p class="dsc">Um kit é o conjunto de EPI entregue a cada pessoa de um GHE. O valor do kit é a soma dos itens e entra no custo da função, na guia MAO. Escolha o kit:</p>' +
        cfgChips(kits, K && K.g, function (k) { S.v.cfgEpi = k; }, function () { var n = g.epigrupos.length + 1, nm; do { nm = 'EPI ' + ('0' + n++).slice(-2); } while (kits.indexOf(nm) >= 0); g.epigrupos.push({ g: nm, ghe: '' }); S.v.cfgEpi = nm; svg(); });
      if (K) {
        var itens = g.epicomp.filter(function (c) { return c.g === K.g; }), usoK = g.grupos.filter(function (x) { return x.epi === K.g; }).length;
        s += cfgCard(esc(K.g), usoK + ' grupo(s) GHE usam este kit.', '<div class="cf">' +
          cfgCampo('ck-n', 'Nome do kit', K.g, function (x) { if (x === K.g) return; if (kits.indexOf(x) >= 0) return msgbox('AVISO!', 'Já existe um kit com esse nome.'); var de = K.g; g.epicomp.forEach(function (c) { if (c.g === de) c.g = x; }); g.grupos.forEach(function (o) { if (o.epi === de) o.epi = x; }); K.g = x; S.v.cfgEpi = x; svg(); }, { upper: true, obrig: true }) +
          cfgCampo('ck-g', 'Descrição / GHE atendido', K.ghe, function (x) { K.ghe = x; svg(); }, { w2: true }) + '</div>' +
          '<div class="res"><div><span>Itens no kit</span><b>' + itens.length + '</b></div><div><span>Valor do kit</span><b>R$ ' + money(C.epiGrupoValor[K.g]) + '</b></div></div>' +
          '<h3 class="sub">Itens do kit</h3><p class="aj">Cada linha é um EPI entregue. O preço vem da tabela abaixo.</p>' +
          cfgTab(bloco('bec', '', itens, [{ k: 'epi', rot: 'EPI', ops: g.epi.map(function (x) { return x.d; }) }, { k: 'v', rot: 'Valor (R$)', t: 'n', calc: function (r) { return money((C.epiPreco[r.epi] || {}).v); } }], svg, function () { return { g: K.g, epi: g.epi[0].d }; }, { rem: function (r) { g.epicomp.splice(g.epicomp.indexOf(r), 1); }, add: function (nv) { g.epicomp.push(nv); } })) +
          (ed ? '<p style="margin:12px 0 0"><button class="lk pg" ' + h(function () { if (usoK) return msgbox('AVISO!', 'O kit ' + K.g + ' é usado por ' + usoK + ' grupo(s) GHE. Troque o kit desses grupos antes de excluir.'); confirma('Tem certeza que deseja excluir o kit ' + K.g + ' e seus itens ?\n\nEssa ação não poderá ser desfeita.', function () { g.epicomp = g.epicomp.filter(function (c) { return c.g !== K.g; }); g.epigrupos.splice(g.epigrupos.indexOf(K), 1); S.v.cfgEpi = null; svg(); }); }) + '>Excluir este kit</button></p>' : ''));
      }
      s += cfgCard('Preço dos EPI', 'Tabela única de EPI, usada por todos os kits.', cfgTab(bloco('bei', '', g.epi, [{ k: 'd', rot: 'EPI', upper: true, set: function (r, x) { if (!x || x === r.d) return; g.epicomp.forEach(function (c) { if (c.epi === r.d) c.epi = x; }); r.d = x; } }, { k: 'u', rot: 'Unidade', upper: true }, { k: 'v', rot: 'Valor unitário (R$)', t: 'money' }], svg, function () { return { d: 'NOVO EPI ' + (g.epi.length + 1), u: 'UNI', v: 0 }; }, { rem: function (r) { var n = g.epicomp.filter(function (c) { return c.epi === r.d; }).length; if (n) return msgbox('AVISO!', 'Este EPI está em ' + n + ' kit(s). Retire-o dos kits antes de excluir.'); g.epi.splice(g.epi.indexOf(r), 1); } })));
    }
  } else {
    s += '<p class="dsc">Não contam como dia útil em nenhum projeto. Feriados municipais e paralisações ficam em Calendário e jornada, por projeto.</p>' + cfgCard('Feriados nacionais', t.feriados.length + ' datas cadastradas.', cfgTab(bloco('tfn', '', t.feriados, [{ k: 'dt', rot: 'Data', t: 'date' }, { k: 'd', rot: 'Descrição', upper: true }], function () { t.feriados.sort(function (a, b) { return String(a.dt || '9').localeCompare(String(b.dt || '9')); }); sv(); }, function () { return { dt: '', d: '' }; })));
  }
  if (ed) s += '<p class="nota">Campos soltos são gravados ao sair do campo. Nas listas, clique na célula para editar, use "Adicionar" para incluir e × para excluir. Tudo é recalculado na hora.</p>';
  return s + fim;
}
function nomeFrase(x) { x = String(x || '').toLowerCase(); return x.charAt(0).toUpperCase() + x.slice(1); }

/* dados da contratante e do local do projeto */
var UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
function cfgContratante(p, svp) {
  var c = p.contratante || (p.contratante = {}), cp = function (id, rot, k, o) { return cfgCampo(id, rot, c[k], function (x) { c[k] = x; svp(); }, Object.assign({ upper: true }, o || {})); };
  return cfgCard('Contratante', 'Cliente do contrato: dados do cartão CNPJ, endereço e contato.', cfgCliSel(p, svp) + '<div class="cf">' +
    cp('ct-r', 'Razão social', 'razao', { w2: true }) + cp('ct-f', 'Nome fantasia', 'fantasia') + cp('ct-c', 'CNPJ', 'cnpj') +
    cp('ct-k', 'Nº do contrato', 'contrato') + cfgCampo('ct-kd', 'Data do contrato', c.dataContrato, function (x) { c.dataContrato = x; svp(); }, { t: 'date' }) +
    cfgCampo('ct-kv', 'Valor do contrato', c.valor, function (x) { c.valor = x; svp(); }, { t: 'money' }) +
    cp('ct-l', 'Logradouro', 'logradouro', { w2: true }) + cp('ct-n', 'Número', 'numero') + cp('ct-co', 'Complemento', 'complemento') + cp('ct-b', 'Bairro', 'bairro') + cp('ct-m', 'Município', 'municipio') +
    cfgCampo('ct-u', 'UF', c.uf, function (x) { c.uf = x; svp(); }, { ops: [''].concat(UFS) }) + cp('ct-cep', 'CEP', 'cep') +
    '' + '</div>');
}
function cfgLocal(p, svp) {
  var l = p.local || (p.local = {}), cp = function (id, rot, k, o) { return cfgCampo(id, rot, l[k], function (x) { l[k] = x; svp(); agendar(); }, Object.assign({ upper: true }, o || {})); };
  var mapa = l.lat && l.lon ? '<p style="margin:8px 0 0"><a class="lk" target="_blank" rel="noopener" href="https://www.google.com/maps?q=' + encodeURIComponent(l.lat + ',' + l.lon) + '">Abrir no mapa (' + esc(l.lat) + ', ' + esc(l.lon) + ')</a></p>' : '';
  return cfgCard('Local do projeto', 'Onde a obra é executada.', '<div class="cf">' +
    cp('lc-n', 'Nome do empreendimento / local', 'nome', { w2: true }) + cp('lc-l', 'Endereço / rodovia', 'logradouro', { w2: true }) + cp('lc-c', 'Complemento / referência', 'complemento', { w2: true }) +
    cp('lc-b', 'Bairro / distrito / zona', 'bairro') + cp('lc-m', 'Município', 'municipio') + cfgCampo('lc-u', 'UF', l.uf, function (x) { l.uf = x; svp(); }, { ops: [''].concat(UFS) }) + cp('lc-cep', 'CEP', 'cep') +
   ''
    + '</div>');
}

/* responsáveis, prazo e valor do contrato (cadastro do projeto, seção 3 do escopo) */
function cfgResp(p, svp) {
  var r = p.resp || (p.resp = {}), c = p.contratante || (p.contratante = {});
  var cp = function (id, rot, k, o) { return cfgCampo(id, rot, r[k], function (x) { r[k] = x; svp(); agendar(); }, Object.assign({ upper: true }, o || {})); };
  var ini = r.inicio || (p.crono && String(p.crono.inicio || '').slice(0, 10)) || '', fim = r.termino || (p.crono && String(p.crono.fim || '').slice(0, 10)) || '';
  var dias = ini && fim ? E.day(fim) - E.day(ini) + 1 : 0;
  return cfgCard('Responsáveis, prazo e valor', 'Quem responde pelo projeto e os dados contratuais. Sem datas preenchidas, valem as do cronograma físico.', '<div class="cf">' +
    cp('rp-cl', 'Cliente (dono da obra)', 'cliente', { w2: true, dica: 'Quando for diferente da contratante. Ex.: a contratante é a EPC e o cliente é o investidor.' }) +
    cp('rp-r', 'Responsável pelo projeto', 'responsavel') + cp('rp-g', 'Gerente de contrato', 'gerente') + cp('rp-e', 'Engenheiro responsável', 'engenheiro') + cp('rp-cr', 'CREA / ART', 'crea') +
    cfgCampo('rp-i', 'Data de início', r.inicio, function (x) { r.inicio = x; svp(); agendar(); }, { t: 'date', dica: r.inicio ? '' : (ini ? 'Do cronograma: ' + fiso(ini) : '') }) +
    cfgCampo('rp-t', 'Data de término', r.termino, function (x) { r.termino = x; svp(); agendar(); }, { t: 'date', dica: r.termino ? '' : (fim ? 'Do cronograma: ' + fiso(fim) : '') }) +
    cfgCampo('rp-p', 'Prazo contratual', r.prazo || dias, function (x) { r.prazo = x; svp(); agendar(); }, { t: 'num', suf: 'dias', dica: dias ? 'Pelas datas: ' + int(dias) + ' dias corridos' : '' }) +
    cfgCampo('rp-v', 'Valor do contrato', c.valor, function (x) { c.valor = x; svp(); agendar(); }, { t: 'money', dica: 'O mesmo valor do quadro Contratante.' }) + '</div>');
}

/* BDI contratual do projeto: TCU 2622/2013 ou divisor (1 ÷ (1 − A − I − L)) */
var BDI_FORM = { TCU: 'TCU 2622/2013: [(1+AC+S+R+G)(1+DF)(1+L) ÷ (1−I)] − 1', DIV: 'Divisor: 1 ÷ (1 − A − I − L) − 1' };
function bdiPartes(b) { b = b || {}; return { A: num(b.ac) + num(b.s) + num(b.g) + num(b.r) + num(b.df), I: num(b.pis) + num(b.cofins) + num(b.iss) + num(b.cprb) + num(b.csll) + num(b.irpj), L: num(b.l) }; }
function bdiCalc(b) {
  b = b || {}; if (b.inf) return num(b.inf); var x = bdiPartes(b);
  if (b.form === 'DIV') return x.A + x.I + x.L >= 1 ? 0 : 1 / (1 - x.A - x.I - x.L) - 1;
  return x.I >= 1 ? 0 : ((1 + num(b.ac) + num(b.s) + num(b.r) + num(b.g)) * (1 + num(b.df)) * (1 + x.L)) / (1 - x.I) - 1;
}
function cfgBdi(p, svp) {
  var b = p.bdi || (p.bdi = {}), x = bdiPartes(b), pc = function (id, rot, k, dica) { return cfgCampo(id, rot, b[k], function (v) { b[k] = v; svp(); agendar(); }, { t: 'pct', dica: dica }); };
  return cfgCard('BDI contratual', 'Benefícios e despesas indiretas do contrato deste projeto. A = despesas indiretas, I = despesas legais (tributos), L = lucro bruto.', '<div class="cf">' +
    cfgCampo('bd-f', 'Fórmula', b.form || 'TCU', function (v) { b.form = v; svp(); agendar(); }, { ops: ['TCU', 'DIV'], rotulos: BDI_FORM, w2: true }) +
    pc('bd-ac', 'Administração central (AC)', 'ac') + pc('bd-df', 'Despesas financeiras (DF)', 'df') + pc('bd-r', 'Risco (R)', 'r', 'Ou risco + seguros e garantias, quando o contrato agrupa.') + pc('bd-s', 'Seguro (S)', 's') + pc('bd-g', 'Garantia (G)', 'g') +
    pc('bd-is', 'ISS', 'iss') + pc('bd-pis', 'PIS', 'pis') + pc('bd-co', 'COFINS', 'cofins') + pc('bd-cs', 'CSLL', 'csll') + pc('bd-ir', 'IRPJ', 'irpj') + pc('bd-cp', 'CPRB (desoneração)', 'cprb', 'Deixe 0 se não houver.') +
    pc('bd-l', 'Lucro bruto (L)', 'l') + pc('bd-inf', 'BDI informado no contrato', 'inf', 'Se preenchido, vale este em vez do calculado.') +
    cfgCampo('bd-tot', 'BDI do projeto', nf2.format(bdiCalc(b) * 100) + '%', null, { ro: true, dica: b.inf ? 'Valor informado no contrato.' : 'A ' + nf2.format(x.A * 100) + '% · I ' + nf2.format(x.I * 100) + '% · L ' + nf2.format(x.L * 100) + '%' }) +
    (b.contrato ? cfgCampo('bd-ct', 'BDI do contrato original', nf2.format(num(b.contrato.total) * 100) + '%', null, { ro: true, dica: b.contrato.obs || '' }) : '') + '</div>');
}
/* ================= CPU – composições do preço unitário =================
   Base geral: base/cpuins (insumos da CPU, com vínculo opcional aos bancos MAT, SER, MAO e VEM)
   e base/cpu_1, base/cpu_2… (composições, divididas em partes para respeitar o tamanho de cada documento).
   Os itens guardam só o código do insumo e o coeficiente: o preço vem sempre de um único lugar. */
var CPU_T = [
  { t: 'MO', l: 'A', nome: 'MAO DE OBRA', eq: 1 },
  { t: 'EQ', l: 'B', nome: 'EQUIPAMENTOS', eq: 1 },
  { t: 'MAT', l: 'C', nome: 'MATERIAIS' },
  { t: 'SER', l: 'D', nome: 'SERVICOS' },
  { t: 'AUX', l: 'E', nome: 'ATIVIDADES AUXILIARES (OUTRAS CPU)' },
  { t: 'OUT', l: 'F', nome: 'OUTROS' }];
var CPU_TR = { MO: 'MÃO DE OBRA', EQ: 'EQUIPAMENTO', MAT: 'MATERIAL', SER: 'SERVIÇO', OUT: 'OUTROS' };
var CPU_TIPOS = ['MO', 'EQ', 'MAT', 'SER', 'OUT'];
var CPU_BANCO = { MAT: 'mat', SER: 'ser', MAO: 'mao', VEM: 'vem' }, CPU_BROT = { MAT: 'Materiais e insumos', SER: 'Serviços', MAO: 'Mão de obra', VEM: 'Veículos e máquinas' };
var CPU_DL = { MAT: 'dl3', SER: 'dl6', MAO: 'dl1', VEM: 'dl2' };
var CHUVA_E = ['Não para', 'Paralisa meio dia', 'Paralisa o dia inteiro', 'Paralisa o dia inteiro e o outro dia'];
var CHUVA_R = ['Não reduz', 'Reduz o resto do dia', 'Reduz o outro dia'];
var TPC = { C: 'Por consumo (coeficientes)', P: 'Por produção da equipe' };
var r2 = function (v) { return Math.round((v + (v >= 0 ? 1e-9 : -1e-9)) * 100) / 100; };
var cpuCmp = function (a, b) {
  var x = String(a).split(/[.\-]/), y = String(b).split(/[.\-]/), i;
  for (i = 0; i < Math.max(x.length, y.length); i++) {
    if (x[i] == null) return -1; if (y[i] == null) return 1;
    var nx = /^\d+$/.test(x[i]), ny = /^\d+$/.test(y[i]);
    if (nx && ny && +x[i] !== +y[i]) return +x[i] - +y[i];
    if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  }
  return 0;
};
function cpuChaves() { return Object.keys(S.base).filter(function (k) { return /^cpu_\d+$/.test(k); }).sort(function (a, b) { return +a.slice(4) - +b.slice(4); }); }
/* índice montado a cada uso: composições por código, insumos por id, bancos por descrição e memória de cálculo */
function cpuDados() {
  if (!S.base.cpuins) S.base.cpuins = { rows: [], horasMes: 220 };
  var X = { comps: [], by: Object.create(null), ins: S.base.cpuins.rows, bi: Object.create(null), memo: Object.create(null), bk: {}, usos: Object.create(null), usosAux: Object.create(null), C: ctx(), hm: num(S.base.cpuins.horasMes) || 220 };
  cpuChaves().forEach(function (k) {
    (S.base[k].rows || []).forEach(function (c) {
      Object.defineProperty(c, '_k', { value: k, configurable: true, writable: true, enumerable: false });
      X.comps.push(c); X.by[c.c] = c;
      (c.it || []).forEach(function (x) { if (x.t === 'AUX') X.usosAux[x.i] = (X.usosAux[x.i] || 0) + 1; else X.usos[x.i] = (X.usos[x.i] || 0) + 1; });
    });
  });
  X.comps.sort(function (a, b) { return ordAlfa(a.d, b.d) || cpuCmp(a.c, b.c); });
  X.ins.forEach(function (e) { X.bi[e.id] = e; });
  Object.keys(CPU_BANCO).forEach(function (b) { var m = X.bk[b] = Object.create(null); ((S.base[CPU_BANCO[b]] || {}).rows || []).forEach(function (r) { if (!(r.d in m)) m[r.d] = r; }); });
  return X;
}
/* preço em uso de um insumo: do banco vinculado ou o próprio */
function cpuPreco(e, X) {
  if (!e) return { p: 0, pi: 0, err: 'insumo não encontrado' };
  var o = { p: num(e.p), pi: num(e.pi), src: 'CPU' };
  if (e.lk && e.lk.b) {
    var b = e.lk.b, r = X.bk[b] && X.bk[b][e.lk.d];
    o.src = b;
    if (!r) { o.err = e.lk.d ? 'item "' + e.lk.d + '" não existe em ' + CPU_BROT[b] : 'escolha o item de ' + CPU_BROT[b]; return o; }
    if (b === 'MAT') o.p = num(r.vu);
    else if (b === 'SER') o.p = e.u === 'MES' ? (num(r.men) || num(r.mob)) : (num(r.mob) || num(r.men));
    else if (b === 'MAO') { var m = X.C.mao[r.d]; o.p = m ? m.custoEmpresa / X.hm : 0; }
    else if (b === 'VEM') { var v = X.C.vem[r.d]; o.p = v && v.hMes ? (num(r.loc) > 0 ? v.totalTerceiro : v.totalProprio) / v.hMes : 0; }
  }
  return o;
}
var ehEquipe = function (t) { return t === 'MO' || t === 'EQ'; };
function cpuCalc(c, X, nivel) {
  var m = X.memo[c.c];
  if (m === 1) return { tot: 0, circ: true, it: [], sub: {}, err: ['referência circular'] };
  if (m) return m;
  X.memo[c.c] = 1;
  var P = c.tp === 'P', prod = num(c.pr), o = { it: [], sub: {}, ch: 0, cux: 0, ficV: 0, fitV: 0, outros: 0, tot: 0, err: [] };
  CPU_T.forEach(function (t) { o.sub[t.t] = 0; o.sub[t.t + 'h'] = 0; });
  (c.it || []).forEach(function (x) {
    var r = { x: x };
    if (x.t === 'AUX') {
      var ref = X.by[x.i];
      if (!ref) { r.err = 'CPU ' + x.i + ' não encontrada'; r.p = 0; r.nome = x.i; r.cod = x.i; r.u = ''; }
      else { var rc = (nivel || 0) > 40 ? { tot: 0, circ: true } : cpuCalc(ref, X, (nivel || 0) + 1); r.p = rc.tot; r.nome = ref.d; r.u = ref.u; r.cod = ref.c; r.src = 'AUX'; if (rc.circ) r.err = 'referência circular'; }
    } else {
      var e = X.bi[x.i], pr = cpuPreco(e, X);
      r.e = e; r.p = pr.p; r.pi = pr.pi; r.src = pr.src; r.err = pr.err; r.nome = e ? e.d : '(insumo ' + x.i + ' excluído)'; r.u = e ? e.u : ''; r.cod = e ? (e.c || e.id) : x.i;
    }
    r.pe = x.t === 'EQ' ? num(x.up == null ? 1 : x.up) * r.p + num(x.ui) * num(r.pi) : r.p;
    if (P && ehEquipe(x.t)) { r.h = num(x.q) * r.pe; o.ch += r.h; o.sub[x.t + 'h'] += r.h; r.k = prod ? num(x.q) / prod : 0; r.v = prod ? r.h / prod : 0; }
    else { r.k = num(x.k); r.v = r.k * r.pe; o.outros += r.v; }
    o.sub[x.t] += r.v;
    if (r.err) o.err.push(r.nome + ': ' + r.err);
    o.it.push(r);
  });
  if (P) {
    if (!prod) o.err.push('produção da equipe não informada');
    o.cux = prod ? o.ch / prod : 0; o.ficV = o.cux * num(c.fic); o.fitV = o.cux * num(c.fit);
  }
  o.tot = r2(o.cux + o.ficV + o.fitV + o.outros);
  o.mensal = P ? o.ch * X.hm : 0;
  X.memo[c.c] = o;
  return o;
}
/* gravação: cada composição fica na parte (cpu_N) em que nasceu */
function cpuSalvar(c) { salvarBase(c._k); }
/* insumos da CPU: na memória ficam todos em base/cpuins; no banco são divididos em base/cpuins, base/cpuins_2… (limite de tamanho por documento) */
function cpuInsJuntar() {
  if (!S.base.cpuins) S.base.cpuins = { rows: [], horasMes: 220 };
  var ks = Object.keys(S.base).filter(function (k) { return /^cpuins_\d+$/.test(k); }).sort(function (a, b) { return +a.slice(7) - +b.slice(7); });
  ks.forEach(function (k) { S.base.cpuins.rows = (S.base.cpuins.rows || []).concat(S.base[k].rows || []); delete S.base[k]; });
  S._cpuinsN = Math.max(S._cpuinsN || 1, ks.length ? +ks[ks.length - 1].slice(7) : 1);
}
function cpuSalvarIns() {
  S.ctx = null; S.cache = {}; S.projetos.forEach(function (p) { p._ctx = null; });
  var b = S.base.cpuins, parts = [[]], sz = 0;
  (b.rows || []).forEach(function (e) { var z = JSON.stringify(e).length; if (sz + z > 170000 && parts[parts.length - 1].length) { parts.push([]); sz = 0; } parts[parts.length - 1].push(e); sz += z; });
  var cab = {}; Object.keys(b).forEach(function (k) { if (k !== 'rows') cab[k] = b[k]; }); cab.rows = parts[0];
  gravar('base/cpuins', cab);
  for (var i = 1; i < parts.length; i++) gravar('base/cpuins_' + (i + 1), { rows: parts[i] });
  for (var j = parts.length + 1; j <= (S._cpuinsN || 1); j++) gravar('base/cpuins_' + j, null);
  S._cpuinsN = parts.length;
}
function cpuParteLivre() {
  var ks = cpuChaves(), k = ks.filter(function (x) { return JSON.stringify(S.base[x]).length < 170000; })[0];
  if (!k) { k = 'cpu_' + ((ks.length ? +ks[ks.length - 1].slice(4) : 0) + 1); S.base[k] = { rows: [] }; }
  return k;
}
function cpuNovaComp(X, modelo) {
  var n = 1, cod; do { cod = 'NOVA-' + ('00' + n++).slice(-3); } while (X.by[cod]);
  var c = modelo ? clone(modelo) : { d: 'NOVA COMPOSICAO', u: 'UN', tp: 'C', it: [] };
  c.c = cod; if (modelo) c.d = (modelo.d + ' (COPIA)').slice(0, 300);
  var k = cpuParteLivre(); S.base[k].rows.push(c);
  Object.defineProperty(c, '_k', { value: k, configurable: true, writable: true, enumerable: false });
  cpuSalvar(c); S.v.cpu.sel = cod; S.v.cpu.busca = '';
}
/* padrão de códigos dos insumos: CATEGORIA.GRUPO.SEQUÊNCIA (ex.: 01.04.012) */
var CPU_CAT = { MO: '01', EQ: '02', MAT: '03', SER: '04', OUT: '05' };
var CPU_GPAD = { MO: 'OPERACIONAL', EQ: 'OUTROS EQUIPAMENTOS', MAT: 'MATERIAIS DIVERSOS', SER: 'SERVICOS TERCEIRIZADOS', OUT: 'OUTROS' };
var cpuOrd = function (a, b) { return a < b ? -1 : a > b ? 1 : 0; };
function cpuCodigoNovo(X, t, g, exceto) {
  var cc = CPU_CAT[t] || '05', re = /^(\d\d)\.(\d\d)\.(\d{3})$/, gg = null, maxG = 0, maxS = 0;
  X.ins.forEach(function (o) { if (o === exceto || o.t !== t) return; var m = re.exec(o.c || ''); if (!m || m[1] !== cc) return; maxG = Math.max(maxG, +m[2]); if (o.g === g) gg = m[2]; });
  if (!gg) gg = ('0' + (maxG + 1)).slice(-2);
  X.ins.forEach(function (o) { if (o === exceto) return; var m = re.exec(o.c || ''); if (m && m[1] === cc && m[2] === gg) maxS = Math.max(maxS, +m[3]); });
  return cc + '.' + gg + '.' + ('00' + (maxS + 1)).slice(-3);
}
function cpuRecodificar(X) {
  Object.keys(CPU_CAT).forEach(function (t) {
    var its = X.ins.filter(function (e) { return e.t === t; }), gs = [];
    its.forEach(function (e) { if (!e.g) e.g = CPU_GPAD[t]; if (gs.indexOf(e.g) < 0) gs.push(e.g); });
    gs.sort(cpuOrd).forEach(function (g, gi) {
      its.filter(function (e) { return e.g === g; }).sort(function (a, b) { return cpuOrd(a.d, b.d) || cpuOrd(a.u, b.u) || cpuOrd(a.co || '', b.co || ''); })
        .forEach(function (e, si) { e.c = CPU_CAT[t] + '.' + ('0' + (gi + 1)).slice(-2) + '.' + ('00' + (si + 1)).slice(-3); });
    });
  });
  cpuSalvarIns();
}
function cpuNovoIns(X, t, d) {
  var n = X.ins.length + 1, id; do { id = 'CPU-' + ('000' + n++).slice(-4); } while (X.bi[id]);
  var e = { id: id, c: '', d: d, u: ehEquipe(t) ? 'H' : 'UN', t: t, g: CPU_GPAD[t], p: 0 };
  e.c = cpuCodigoNovo(X, t, e.g, e);
  if (t === 'EQ') e.pi = 0;
  X.ins.push(e); X.bi[id] = e; cpuSalvarIns();
  return e;
}
/* acha (ou cria) o insumo digitado: "código | descrição", só o código ou só a descrição */
function cpuAcharIns(X, t, v) {
  v = String(v || '').trim(); if (!v) return null;
  var cod = v.indexOf(' | ') > 0 ? v.split(' | ')[0].trim() : v, nv = semAcento(v.indexOf(' | ') > 0 ? v.split(' | ').slice(1).join(' | ') : v);
  var por = X.ins.filter(function (e) { return e.t === t; });
  return por.filter(function (e) { return e.id === cod || (e.c && e.c === cod) || (e.co && e.co === cod); })[0] || por.filter(function (e) { return semAcento(e.d) === nv; })[0] || null;
}
function cpuOpcao(e) { return (e.c || e.id) + ' | ' + e.d; }

function shCpu() {
  var V = S.v.cpu || (S.v.cpu = { sel: null, busca: '', vis: 'C', bi: '' }), X = cpuDados(), ed = podeEditar(); if (V.pj === 'SICRO') V.pj = 'DNIT';
  var abas = '<div class="tabs" role="tablist">' + [['C', 'Composições (' + X.comps.length + ')'], ['I', 'Insumos da CPU (' + X.ins.length + ')']].map(function (a) { return '<button role="tab" aria-selected="' + (V.vis === a[0]) + '" class="' + (V.vis === a[0] ? 'on' : '') + '" ' + h(function () { V.vis = a[0]; agendar(); }) + '>' + a[1] + '</button>'; }).join('') + '</div>';
  var s = titulo('CPU – COMPOSIÇÕES DO PREÇO UNITÁRIO', abas + '<button class="bxl" data-tip="Baixa composições e insumos em Excel, com as fórmulas ligadas (células calculadas protegidas)" ' + h(cpuExportar) + '>' + XL_IC + 'Exportar Excel</button>' + (ed ? cpuImportarBtn() : ''));
  return s + (V.vis === 'I' ? cpuInsumos(X, V, ed) : cpuComposicoes(X, V, ed) + cpuRanking(X, V));
}
/* ranking das CPUs mais utilizadas nos projetos (vínculos às atividades dos cronogramas, guia Relacionamento) */
var CPU_USO = {};
function cpuLinksProj(p) {
  if (p._cro) return p._cro.cpus.links || {};
  var u = CPU_USO[p.id];
  if (!u) {
    u = CPU_USO[p.id] = { links: null };
    db.doc(croRaiz(p) + '/cpus').get().then(function (r) { var d = r && (typeof r.data === 'function' ? r.data() : r); u.links = (d && d.links) || {}; agendar(); }, function () { u.links = {}; agendar(); });
  }
  return u.links;
}
function cpuRanking(X, V) {
  var ps = S.projetos.filter(function (p) { return p.crono; }), uso = {}, falta = 0;
  ps.forEach(function (p) {
    var L = cpuLinksProj(p); if (!L) { falta++; return; }
    Object.keys(L).forEach(function (t) { (L[t] || []).forEach(function (l) { var o = uso[l.c] || (uso[l.c] = { n: 0, pj: {}, q: 0, v: 0 }); o.n++; o.pj[p.id] = 1; o.q += num(l.q); }); });
  });
  var top = V.top || 10, lista = Object.keys(uso).map(function (c) { var o = uso[c], cp = X.by[c]; o.c = c; o.cp = cp; o.np = Object.keys(o.pj).length; o.v = cp ? o.q * cpuCalc(cp, X).tot : 0; return o; })
    .sort(function (a, b) { return b.n - a.n || b.np - a.np || b.v - a.v; });
  var s = '<div class="card cpu-top"><div class="cpu-top-h"><h3>CPUs mais utilizadas nos projetos</h3><div class="seg" role="group" aria-label="Quantidade no ranking">' + [5, 10, 20, 30].map(function (n) { return '<button class="' + (top === n ? 'on' : '') + '" aria-pressed="' + (top === n) + '" ' + h(function () { V.top = n; agendar(); }) + '>Top ' + n + '</button>'; }).join('') + '</div></div>';
  if (falta) s += '<div class="nota">Carregando os vínculos de ' + falta + (falta === 1 ? ' projeto' : ' projetos') + '…</div>';
  if (!lista.length) return s + (falta ? '' : '<div class="nota">Nenhuma composição relacionada às atividades dos projetos ainda (guia Relacionamento).</div>') + '</div>';
  s += '<div class="tw"><table class="g"><thead><tr><th>#</th><th>CÓDIGO</th><th>SERVIÇO</th><th>UND</th><th>VÍNCULOS</th><th>PROJETOS</th><th>QUANTIDADE</th><th>CUSTO UNIT. (R$)</th><th>CUSTO RELACIONADO (R$)</th></tr></thead><tbody>';
  lista.slice(0, top).forEach(function (o, i) {
    var cp = o.cp, nomes = Object.keys(o.pj).map(function (id) { var p = S.projetos.filter(function (x) { return x.id === id; })[0]; return p ? (p.sigla || p.nome || id) : id; }).join(', ');
    s += '<tr' + (cp ? ' style="cursor:pointer" ' + h(function () { V.sel = o.c; V.vis = 'C'; agendar(); }) : '') + '><td class="c">' + (i + 1) + '</td><td>' + esc(o.c) + '</td><td>' + (cp ? esc(cp.d) : '<span class="vz">composição não encontrada</span>') + '</td><td class="c">' + esc(cp ? cp.u : '') + '</td><td class="n">' + int(o.n) + '</td><td class="n" data-tip="' + esc(nomes) + '">' + int(o.np) + '</td><td class="n">' + money(o.q) + '</td><td class="n">' + (cp ? money(cpuCalc(cp, X).tot) : '–') + '</td><td class="n">' + money(o.v) + '</td></tr>';
  });
  return s + '</tbody></table></div><div class="nota">Uso = número de vínculos da composição às atividades dos cronogramas dos projetos. Custo relacionado = quantidade relacionada × custo unitário atual.</div></div>';
}
var XL_IC = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v9M6 9.5l4 4 4-4M4 16h12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function cpuComposicoes(X, V, ed) {
  var b = semAcento(V.busca), pjs = {}; X.comps.forEach(function (c) { if (c.pj) pjs[c.pj] = (pjs[c.pj] || 0) + 1; });
  var lista = X.comps.filter(function (c) { return (!V.pj || (V.pj === 'LIB' ? !c.pj && !c.o : V.pj === 'DNIT' ? (c.o === 'DNIT' || c.o === 'SICRO') : V.pj === 'SB' ? c.o === 'SB' : V.pj === 'DERMG' ? c.o === 'DER-MG' : V.pj === 'SINAPI' ? c.o === 'SINAPI-MG' : V.pj === 'SUDECAP' ? c.o === 'SUDECAP' : V.pj === 'SEINFRA' ? c.o === 'SEINFRA-CE' : c.pj === V.pj)) && (!b || semAcento(c.c + ' ' + c.d).indexOf(b) >= 0); });
  if (!V.sel || !X.by[V.sel] || (b && lista.indexOf(X.by[V.sel]) < 0)) V.sel = lista.length ? lista[0].c : null;
  var c = V.sel ? X.by[V.sel] : null, nerr = 0;
  var s = '<div class="cpu"><div class="cpu-l"><div class="cpu-lb"><input id="cpu-busca" type="search" placeholder="Localizar código ou descrição…" aria-label="Localizar composição" data-live="1" value="' + esc(V.busca) + '" ' + h(function (el) { V.busca = el.value; agendar(); }) + '>' +
    '<select aria-label="Origem das CPUs" ' + h(function (el) { V.pj = el.value; agendar(); }) + '><option value="">Todas as CPUs</option><option value="LIB"' + (V.pj === 'LIB' ? ' selected' : '') + '>Composições PV</option><option value="SB"' + (V.pj === 'SB' ? ' selected' : '') + '>Serviços básicos padrão (SB)</option><option value="DNIT"' + (V.pj === 'DNIT' ? ' selected' : '') + '>DNIT – SICRO</option><option value="DERMG"' + (V.pj === 'DERMG' ? ' selected' : '') + '>DER-MG – SICOR (Região Norte, jul/2026)</option><option value="SINAPI"' + (V.pj === 'SINAPI' ? ' selected' : '') + '>SINAPI-MG (Belo Horizonte, dez/2024)</option><option value="SUDECAP"' + (V.pj === 'SUDECAP' ? ' selected' : '') + '>SUDECAP (Belo Horizonte, jul/2026)</option><option value="SEINFRA"' + (V.pj === 'SEINFRA' ? ' selected' : '') + '>SEINFRA-CE (tabela 028, out/2023)</option>' + Object.keys(pjs).map(function (id) { var pr = S.projetos.filter(function (x) { return x.id === id; })[0]; return '<option value="' + esc(id) + '"' + (V.pj === id ? ' selected' : '') + '>' + esc(pr ? pr.nome : id) + ' (' + pjs[id] + ')</option>'; }).join('') + '</select>' +
    (ed ? '<button class="lk" ' + h(function () { cpuNovaComp(X); agendar(); }) + '>Nova CPU</button>' : '') + '</div>';
  s += '<div class="tw cpu-tl" id="tw-cpul"><table class="g"><thead><tr><th>CÓDIGO</th><th class="l">SERVIÇO</th><th>UND</th><th>TIPO</th><th>ITENS</th><th>CUSTO UNIT. (R$)</th></tr></thead><tbody>';
  /* lista completa com rolagem virtual: só as linhas visíveis vão para a tela */
  lista.forEach(function (x) { if (cpuCalc(x, X).err.length) nerr++; });
  var linha = function (x) { var o = cpuCalc(x, X); return '<tr class="' + (x === c ? 'sel' : '') + '" ' + h(function () { V.sel = x.c; agendar(); }) + '><td>' + esc(x.c) + '</td><td class="cpu-d" title="' + esc(x.d) + '">' + (o.err.length ? '<i class="cpu-er" data-tip="' + esc(o.err.join('\n')) + '">!</i>' : '') + esc(x.d) + '</td><td class="c">' + esc(x.u) + '</td><td class="c">' + (x.o ? (x.o === 'SICRO' ? 'DNIT' : x.o) : x.tp === 'P' ? 'EQUIPE' : 'CONSUMO') + '</td><td class="c">' + (x.it || []).length + '</td><td class="n">' + money(o.tot) + '</td></tr>'; };
  S._cpuV = { lista: lista, linha: linha, a: -1, b: -1, rh: (S._cpuV && S._cpuV.rh) || 25 };
  s += cpuVirtRows(0, Math.min(lista.length, 80));
  if (!lista.length) s += '<tr><td colspan="6" class="vz">Nenhuma composição encontrada.</td></tr>';
  s += '</tbody></table></div><div class="nota">' + int(lista.length) + ' de ' + int(X.comps.length) + ' composições' + (nerr ? ' · <b class="pico">' + nerr + ' com pendência</b>' : '') + '. Clique numa linha para abrir.</div></div>';
  s += '<div class="cpu-r">' + (c ? cpuDetalhe(c, X, ed) : '<div class="vazio"><h3>Nenhuma composição</h3>' + (ed ? 'Use “Nova CPU” para começar ou importe uma planilha.' : '') + '</div>') + '</div></div>';
  return s;
}

function cpuVirtRows(a, b) {
  var Vv = S._cpuV, n = Vv.lista.length, rh = Vv.rh, r = '';
  if (a > 0) r += '<tr class="cpu-sp" aria-hidden="true"><td colspan="6" style="height:' + a * rh + 'px;padding:0;border:0"></td></tr>';
  for (var i = a; i < b; i++) r += Vv.linha(Vv.lista[i]);
  if (b < n) r += '<tr class="cpu-sp" aria-hidden="true"><td colspan="6" style="height:' + (n - b) * rh + 'px;padding:0;border:0"></td></tr>';
  Vv.a = a; Vv.b = b; return r;
}
function cpuVirt() {
  var el = document.getElementById('tw-cpul'), Vv = S._cpuV; if (!el || !Vv || !Vv.lista.length) return;
  var tb = el.querySelector('tbody'), tr = tb && tb.querySelector('tr:not(.cpu-sp)'); if (tr && tr.offsetHeight) Vv.rh = tr.offsetHeight;
  var n = Vv.lista.length, vis = Math.ceil(el.clientHeight / Vv.rh) + 1, a = Math.max(0, Math.floor(el.scrollTop / Vv.rh) - 30), b = Math.min(n, a + vis + 60);
  if (a >= Vv.a && b <= Vv.b && (Vv.a === 0 || el.scrollTop / Vv.rh - Vv.a > 10) && (Vv.b === n || Vv.b - (el.scrollTop + el.clientHeight) / Vv.rh > 10)) return;
  var st = el.scrollTop; tb.innerHTML = cpuVirtRows(a, b); el.scrollTop = st;
}
document.addEventListener('scroll', function (e) { if (e.target && e.target.id === 'tw-cpul') cpuVirt(); }, true);
function cpuDetalhe(c, X, ed) {
  var o = cpuCalc(c, X), P = c.tp === 'P', sv = function () { cpuSalvar(c); }, ch = c.ch || {};
  var nAux = X.usosAux[c.c] || 0;
  var kt = function (rot, val, sub, cls) { return '<div class="kt' + (cls ? ' ' + cls : '') + '"><span>' + rot + '</span><b>' + val + '</b>' + (sub ? '<i>' + sub + '</i>' : '') + '</div>'; };
  var s = '<div class="gk cpu-k">' + kt('Custo unitário', 'R$ ' + money(o.tot), 'para executar 1 ' + esc(c.u || 'unidade'), 'hero') +
    kt('Custo horário da equipe', P ? 'R$ ' + money(o.ch) : '–', P ? 'operação da equipe' : 'só na produção da equipe') +
    kt('Custo mensal da equipe', P ? 'R$ ' + money(o.mensal) : '–', P ? int(X.hm) + ' h por mês' : '') + kt('Itens', int((c.it || []).length), nAux ? 'usada em ' + nAux + ' outra(s) CPU' : '') + '</div>';
  if (o.err.length) s += '<div class="ler cpu-av"><b>Pendências:</b> ' + esc(o.err.join(' · ')) + '</div>';
  /* cabeçalho (dados da composição) */
  var inp = function (id, rot, val, set, opt) {
    opt = opt || {};
    var campoH = ed && !opt.ro ? campo(id, val, set, { t: opt.t, upper: opt.upper }) : '<output>' + (opt.t === 'num' ? (opt.f ? opt.f(val) : nf4.format(num(val))) : esc(val == null ? '' : val)) + '</output>';
    return '<label class="' + (opt.w || '') + '"><span>' + rot + '</span>' + campoH + '</label>';
  };
  var sai = function (rot, val, cls) { return '<label class="' + (cls || '') + '"><span>' + rot + '</span><output>' + val + '</output></label>'; };
  s += '<div class="cs cpuf"><div class="cpuf-g">' +
    inp('cpu-c', 'Código', c.c, function (v) {
      v = String(v || '').trim(); if (!v || v === c.c) return;
      if (X.by[v]) return msgbox('AVISO!', 'Já existe uma composição com o código\n' + v);
      var de = c.c; X.comps.forEach(function (y) { var mud = false; (y.it || []).forEach(function (x) { if (x.t === 'AUX' && x.i === de) { x.i = v; mud = true; } }); if (mud && y !== c) cpuSalvar(y); });
      c.c = v; S.v.cpu.sel = v; sv();
    }) +
    inp('cpu-d', 'Serviço básico', c.d, function (v) { if (!v) return msgbox('AVISO!', 'A descrição não pode ficar vazia.'); c.d = v; sv(); }, { w: 'w3', upper: true }) +
    (ed ? '<label><span>Unidade</span>' + escolha('cpu-u', c.u, S.base.tabelas.unidades.map(function (u) { return u.s; }), function (v) { c.u = v; sv(); }) + '</label>' : sai('Unidade', esc(c.u))) +
    (ed ? '<label class="w2"><span>Tipo de composição</span>' + escolha('cpu-tp', c.tp || 'C', ['P', 'C'], function (v) { cpuTrocaTipo(c, v || 'C'); sv(); }, { rotulos: TPC }) + '</label>' : sai('Tipo de composição', TPC[c.tp || 'C'], 'w2')) +
    (P ? inp('cpu-pr', 'Produção (' + esc(c.u || 'und') + '/h)', c.pr, function (v) { c.pr = v; sv(); }, { t: 'num' }) +
      inp('cpu-fic', 'FIC', c.fic, function (v) { c.fic = v; sv(); }, { t: 'num' }) + sai('FIC valor (R$)', money(o.ficV), 'k') +
      inp('cpu-fit', 'FIT', c.fit, function (v) { c.fit = v; sv(); }, { t: 'num' }) + sai('FIT valor (R$)', money(o.fitV), 'k') +
      sai('Custo unitário de execução (R$)', money(o.cux), 'k') : '') +
    sai('Quantidade executada', '1 ' + esc(c.u || 'UN'), 'k') + sai('Custo unitário (R$)', money(o.tot), 'k tt') + '</div>';
  if (P) {
    var rad = function (nome, ops, val, set) { return ops.map(function (rot, i) { return '<label class="rd"><input type="radio" name="' + nome + '"' + (+val === i ? ' checked' : '') + (ed ? '' : ' disabled') + ' ' + h(function () { set(i); sv(); agendar(); }) + '> ' + rot + '</label>'; }).join(''); };
    s += '<div class="cpuf-ch"><fieldset><legend>Grau de suscetibilidade à chuva — em dia de chuva a execução do serviço</legend>' + rad('cpu-che', CHUVA_E, ch.e || 0, function (i) { c.ch = Object.assign({}, c.ch, { e: i }); }) + '</fieldset>' +
      '<fieldset class="cpuf-rd"><legend>Redução (%)</legend>' + (ed ? campo('cpu-red', ch.r || 0, function (v) { c.ch = Object.assign({}, c.ch, { r: v }); sv(); }, { t: 'num' }) : '<output>' + nf2.format(num(ch.r)) + '</output>') + '</fieldset>' +
      '<fieldset><legend>Produção ao reiniciar</legend>' + rad('cpu-chi', CHUVA_R, ch.i || 0, function (i) { c.ch = Object.assign({}, c.ch, { i: i }); }) + '</fieldset></div>';
  }
  s += '</div>';
  if (ed) s += '<div class="cpu-bt"><button class="lk" ' + h(function () { cpuNovaComp(X, c); agendar(); }) + '>Duplicar CPU</button><button class="lk" ' + h(function () {
    if (nAux) return msgbox('AVISO!', 'A composição ' + c.c + ' é atividade auxiliar de ' + nAux + ' outra(s) CPU.\n\nRemova-a dessas composições antes de excluir.');
    confirma('Tem certeza que deseja excluir a composição\n' + c.c + ' – ' + c.d + ' ?\n\nEssa ação não poderá ser desfeita.', function () { var rows = S.base[c._k].rows; rows.splice(rows.indexOf(c), 1); cpuSalvar(c); S.v.cpu.sel = null; });
  }) + '>Excluir CPU</button></div>';
  /* itens */
  var th = function (rot, st) { return '<th' + (st ? ' style="' + st + '"' : '') + '>' + rot + '</th>'; };
  s += '<div class="tw" id="tw-cpu"><table class="g cpu-it"><thead><tr>' + (ed ? th('', 'width:22px;min-width:22px;padding:0') : '') + th('ITEM') + th('CÓDIGO') + th('DESCRIÇÃO', 'min-width:300px') + th('UND') +
    th(P ? 'QUANTIDADE' : 'QUANT.') + th('CONSUMO') + th('UTIL. PROD.') + th('UTIL. IMPROD.') + th('PREÇO UNIT. (R$)') + th('CUSTO HORÁRIO (R$)') + th('VALOR (R$)') + th('ORIGEM DO PREÇO', 'min-width:150px') + '</tr></thead><tbody>';
  var nc = 12 + (ed ? 1 : 0), dls = '';
  CPU_T.forEach(function (T) {
    var its = o.it.filter(function (r) { return r.x.t === T.t; }), eqP = P && T.eq;
    s += '<tr class="co">' + (ed ? '<td></td>' : '') + '<td>' + T.l + '</td><td></td><td>' + T.nome + '</td><td></td><td></td><td></td><td></td><td></td><td></td><td class="n">' + (eqP ? money(o.sub[T.t + 'h']) : '') + '</td><td class="n">' + money(o.sub[T.t]) + '</td><td></td></tr>';
    its.forEach(function (r, j) {
      var x = r.x, e = r.e, id = 'cpi-' + T.t + j, aux = x.t === 'AUX', lig = e && e.lk && e.lk.b, nu = e ? X.usos[e.id] || 0 : 0;
      s += '<tr>' + (ed ? '<td class="x" data-tip="Excluir item" ' + h(function () { c.it.splice(c.it.indexOf(x), 1); sv(); agendar(); }) + '>×</td>' : '') +
        '<td class="c">' + T.l + (j + 1) + '</td><td>' + esc(r.cod) + '</td>' +
        cel(id + 'd', aux ? r.cod + ' | ' + r.nome : r.nome, ed ? function (v) { cpuTrocaItem(X, c, x, v); } : null, { list: 'dlc-' + T.t, rot: 'Descrição', cls: 'w' + (r.err ? ' er' : ''), tip: r.err || (aux ? 'Digite o código ou escolha outra CPU' : 'Digite o código ou a descrição para trocar o insumo') }) +
        cel(id + 'u', r.u, ed && e ? function (v) { e.u = v; cpuSalvarIns(); } : null, { ops: S.base.tabelas.unidades.map(function (u) { return u.s; }), c: true, rot: 'Unidade', tip: nu > 1 ? 'Unidade do insumo (vale para as ' + nu + ' CPU que o usam)' : '' }) +
        (eqP ? cel(id + 'q', x.q, ed ? function (v) { x.q = v; sv(); } : null, { t: 'num', rot: 'Quantidade' }) + tdv(zero(r.k, nf4.format), 'k n', 'Quantidade ÷ produção') :
          tdv('-', 'c vz') + cel(id + 'k', x.k, ed ? function (v) { x.k = v; sv(); } : null, { t: 'num', rot: 'Consumo' })) +
        (x.t === 'EQ' ? cel(id + 'up', x.up == null ? 1 : x.up, ed ? function (v) { x.up = v; sv(); } : null, { t: 'num', rot: 'Utilização produtiva' }) + cel(id + 'ui', x.ui, ed ? function (v) { x.ui = v; sv(); } : null, { t: 'num', rot: 'Utilização improdutiva', tip: 'Custo improdutivo do equipamento: R$ ' + money(r.pi) + '/h' }) : tdv('', 'vz') + tdv('', 'vz')) +
        (aux || lig || !e ? tdv(money(r.p), 'k n', aux ? 'Custo unitário da CPU ' + r.cod : lig ? 'Preço vindo do banco ' + CPU_BROT[e.lk.b] + ' — altere lá' : '') :
          cel(id + 'p', e.p, ed ? function (v) { e.p = v; cpuSalvarIns(); } : null, { t: 'money', rot: 'Preço unitário', tip: nu > 1 ? 'Preço do insumo: vale para as ' + nu + ' CPU que o usam' : '' })) +
        tdv(eqP ? money(r.h) : '', 'k n') + tdv(money(r.v), 'k n', 'Valor exato: ' + nf4.format(r.v)) +
        tdv(esc(aux ? 'CPU ' + r.cod : lig ? 'Banco ' + CPU_BROT[e.lk.b] + (e.lk.d ? ': ' + e.lk.d : '') : 'Insumos da CPU'), lig ? 'cpu-lk' : '') + '</tr>';
    });
    if (ed) s += '<tr><td class="ad" colspan="3" ' + h(function () { abrirDepois = 'cpa-' + T.t; agendar(); }) + '>Adicionar</td>' + cel('cpa-' + T.t, '', function (v) { cpuAddItem(X, c, T.t, v); }, { list: 'dlc-' + T.t, rot: 'Novo item', tip: T.t === 'AUX' ? 'Digite o código de outra CPU' : 'Digite o código ou a descrição; um nome novo cria o insumo' }) + '<td colspan="' + (nc - 4) + '"></td></tr>';
    if (ed) dls += '<datalist id="dlc-' + T.t + '">' + (T.t === 'AUX' ? X.comps.filter(function (y) { return y !== c; }).map(function (y) { return '<option value="' + esc(y.c + ' | ' + y.d) + '">'; }).join('') : X.ins.filter(function (e2) { return e2.t === T.t; }).map(function (e2) { return '<option value="' + esc(cpuOpcao(e2)) + '">'; }).join('')) + '</datalist>';
  });
  var tl = function (rot, v, cls) { return '<tr class="' + (cls || 'at') + '">' + (ed ? '<td></td>' : '') + '<td></td><td></td><td colspan="8">' + rot + '</td><td class="n">' + v + '</td><td></td></tr>'; };
  if (P) s += tl('CUSTO HORÁRIO DA EQUIPE (A + B)', money(o.ch)) + tl('PRODUÇÃO DA EQUIPE (' + esc(c.u || 'und') + '/h)', nf4.format(num(c.pr))) + tl('CUSTO UNITÁRIO DE EXECUÇÃO', money(o.cux)) +
    tl('FIC (' + nf4.format(num(c.fic)) + ')', money(o.ficV)) + tl('FIT (' + nf4.format(num(c.fit)) + ')', money(o.fitV)) + tl('MATERIAIS, SERVIÇOS, AUXILIARES E OUTROS (C + D + E + F)', money(o.outros));
  s += tl('CUSTO UNITÁRIO TOTAL', money(o.tot), 'tt');
  s += '</tbody></table></div>' + dls + '<div class="nota">Preços dos insumos são únicos: alterar um preço aqui atualiza todas as CPU que usam o insumo. Itens com origem em banco seguem o preço da guia correspondente. ' +
    (P ? 'Na produção da equipe, o consumo de mão de obra e equipamentos é quantidade ÷ produção; custo do equipamento = util. produtiva × preço operativo + util. improdutiva × preço improdutivo.' : 'Por consumo: valor = consumo × preço; o total é arredondado em centavos.') + '</div>';
  return s;
}
function cpuTrocaTipo(c, tp) {
  if ((c.tp || 'C') === tp) return;
  var prod = num(c.pr);
  if (tp === 'P') {
    if (!prod) { var eq = (c.it || []).filter(function (x) { return ehEquipe(x.t) && num(x.k) > 0; })[0]; prod = c.pr = eq ? Math.round(1 / num(eq.k) * 1e4) / 1e4 : 1; }
    (c.it || []).forEach(function (x) { if (ehEquipe(x.t)) { x.q = Math.round(num(x.k) * prod * 1e6) / 1e6; } });
  } else (c.it || []).forEach(function (x) { if (ehEquipe(x.t)) { x.k = prod ? num(x.q) / prod : 0; delete x.q; } });
  c.tp = tp;
}
function cpuAddItem(X, c, t, v) {
  v = String(v || '').trim(); if (!v) return;
  var x = { t: t };
  if (t === 'AUX') {
    var cod = v.split(' | ')[0].trim(), ref = X.by[cod];
    if (!ref) return msgbox('AVISO!', 'Não existe CPU com o código\n' + cod);
    if (ref === c) return msgbox('AVISO!', 'Uma composição não pode ser auxiliar dela mesma.');
    x.i = cod; x.k = 1;
  } else {
    var e = cpuAcharIns(X, t, v);
    if (!e) { if (v.indexOf(' | ') > 0) v = v.split(' | ').slice(1).join(' | '); e = cpuNovoIns(X, t, semAcento(v).trim()); }
    x.i = e.id; if (c.tp === 'P' && ehEquipe(t)) x.q = 1; else x.k = 1;
    if (t === 'EQ') { x.up = 1; x.ui = 0; }
  }
  c.it = c.it || []; c.it.push(x); cpuSalvar(c);
}
function cpuTrocaItem(X, c, x, v) {
  v = String(v || '').trim(); if (!v) return;
  if (x.t === 'AUX') { var cod = v.split(' | ')[0].trim(); if (!X.by[cod] || cod === c.c) return msgbox('AVISO!', 'CPU inválida: ' + cod); x.i = cod; }
  else { var e = cpuAcharIns(X, x.t, v); if (!e) { if (v.indexOf(' | ') > 0) v = v.split(' | ').slice(1).join(' | '); e = cpuNovoIns(X, x.t, semAcento(v).trim()); } x.i = e.id; }
  cpuSalvar(c);
}

function cpuInsumos(X, V, ed) {
  var b = semAcento(V.bi), unis = S.base.tabelas.unidades.map(function (u) { return u.s; });
  var lista = X.ins.filter(function (e) { return !b || semAcento((e.c || e.id) + ' ' + (e.co || '') + ' ' + e.d + ' ' + (e.g || '') + ' ' + (CPU_TR[e.t] || '')).indexOf(b) >= 0; });
  lista.sort(function (a, c) { return ordAlfa(a.d, c.d) || cpuOrd(a.c || '', c.c || ''); });
  var gruposT = {}; X.ins.forEach(function (e) { (gruposT[e.t] = gruposT[e.t] || {})[e.g || ''] = 1; });
  var nlk = X.ins.filter(function (e) { return e.lk && e.lk.b; }).length, nerr = 0;
  var s = '<div class="cpu-lb"><input id="cpu-bi" type="search" placeholder="Localizar insumo…" aria-label="Localizar insumo" data-live="1" value="' + esc(V.bi) + '" ' + h(function (el) { V.bi = el.value; agendar(); }) + '>' +
    '<label class="cpu-hm">Horas por mês da equipe ' + (ed ? campo('cpu-hm', X.hm, function (v) { S.base.cpuins.horasMes = v || 220; cpuSalvarIns(); }, { t: 'num' }) : '<b>' + int(X.hm) + '</b>') + '</label>' + (ed ? '<button class="lk" data-tip="Renumera todos os insumos no padrão categoria.grupo.sequência, em ordem alfabética" ' + h(function () { confirma('Recriar os códigos de todos os insumos no padrão CATEGORIA.GRUPO.SEQUÊNCIA?\n\nOs grupos e as descrições são reordenados em ordem alfabética. O código antigo de cada insumo continua na coluna CÓD. ORIGEM.', function () { cpuRecodificar(X); }); }) + '>Recriar códigos</button>' : '') + '</div>' +
    '<div class="chips fx cpu-cat">' + CPU_TIPOS.map(function (t) { return '<span><b>' + CPU_CAT[t] + '</b> ' + CPU_TR[t] + '</span>'; }).join('') + '<span>Código = categoria . grupo . sequência</span></div>';
  s += '<div class="tw" id="tw-cpui"><table class="g"><thead><tr>' + (ed ? '<th style="width:22px;min-width:22px;padding:0"></th>' : '') + '<th>CÓDIGO</th><th style="min-width:300px">DESCRIÇÃO</th><th>TIPO</th><th style="min-width:200px">GRUPO</th><th>UND</th><th>PREÇO (R$)</th><th>PREÇO IMPROD. (R$/h)</th><th>DIESEL (L/h) – VEM</th><th>VÍNCULO</th><th style="min-width:240px">ITEM DO BANCO</th><th>PREÇO EM USO (R$)</th><th>CPU QUE USAM</th><th>CÓD. ORIGEM</th></tr></thead><tbody>';
  var MAXI = 300, cheiaI = lista.length; lista = lista.slice(0, MAXI);
  lista.forEach(function (e, i) {
    var pr = cpuPreco(e, X), id = 'cin' + i, lig = e.lk && e.lk.b, nu = X.usos[e.id] || 0; if (pr.err) nerr++;
    s += '<tr>' + (ed ? '<td class="x" data-tip="Excluir insumo" ' + h(function () {
      if (nu) return msgbox('AVISO!', 'O insumo\n' + e.d + '\nestá em ' + nu + ' composição(ões).\n\nRemova-o das CPU antes de excluir.');
      confirma('Tem certeza que deseja excluir o insumo\n' + e.d + ' ?', function () { X.ins.splice(X.ins.indexOf(e), 1); cpuSalvarIns(); });
    }) + '>×</td>' : '') +
      tdv(esc(e.c || e.id), 'k', 'Gerado pelo padrão: muda sozinho ao trocar o tipo ou o grupo') +
      cel(id + 'd', e.d, ed ? function (v) { if (!v) return; e.d = v; cpuSalvarIns(); } : null, { upper: true, rot: 'Descrição', cls: 'w' }) +
      cel(id + 't', e.t, ed ? function (v) { cpuTrocaTipoIns(X, e, v); } : null, { ops: CPU_TIPOS, rotulos: CPU_TR, c: true, rot: 'Tipo' }) +
      cel(id + 'g', e.g, ed ? function (v) { v = semAcento(v).trim(); if (!v || v === e.g) return; e.g = v; e.c = cpuCodigoNovo(X, e.t, v, e); cpuSalvarIns(); } : null, { list: 'dlg-' + e.t, upper: true, rot: 'Grupo', cls: 'w', tip: 'Escolha um grupo da lista ou digite um novo' }) +
      cel(id + 'u', e.u, ed ? function (v) { e.u = v; cpuSalvarIns(); } : null, { ops: unis, c: true, rot: 'Unidade' }) +
      (lig ? tdv(money(e.p), 'vz n', 'Preço guardado antes do vínculo (não é usado)') : cel(id + 'p', e.p, ed ? function (v) { e.p = v; cpuSalvarIns(); } : null, { t: 'money', rot: 'Preço' })) +
      (e.t === 'EQ' ? cel(id + 'pi', e.pi, ed ? function (v) { e.pi = v; cpuSalvarIns(); } : null, { t: 'money', rot: 'Preço improdutivo' }) : tdv('', 'vz')) +
      (e.t === 'EQ' ? (function () { var dv = cpuDiesel(e, X); return tdv(dv.lh ? nfq.format(dv.lh) : '–', 'k n', dv.vem ? 'Do banco Veículos e máquinas: ' + dv.vem : 'Sem equipamento correspondente no banco Veículos e máquinas — vincule o insumo (VÍNCULO = VEM)'); })() : tdv('', 'vz')) +
      cel(id + 'b', lig ? e.lk.b : '', ed ? function (v) { if (v) e.lk = { b: v, d: '' }; else delete e.lk; cpuSalvarIns(); } : null, { ops: Object.keys(CPU_BANCO), vazio: '— (preço próprio)', rotulos: { MAT: 'MAT', SER: 'SER', MAO: 'MAO', VEM: 'VEM' }, c: true, rot: 'Vínculo' }) +
      (lig ? cel(id + 'bd', e.lk.d, ed ? function (v) { if (v && !X.bk[e.lk.b][v]) return msgbox('AVISO!', 'O item\n' + v + '\nnão existe em ' + CPU_BROT[e.lk.b] + '.'); e.lk.d = v; cpuSalvarIns(); } : null, { list: CPU_DL[e.lk.b], rot: 'Item do banco', cls: 'w' + (pr.err ? ' er' : ''), tip: pr.err || '' }) : tdv('', 'vz')) +
      tdv(money(pr.p), 'k n', e.lk && e.lk.b === 'MAO' ? 'Custo empresa mensal ÷ ' + int(X.hm) + ' h' : e.lk && e.lk.b === 'VEM' ? 'Custo mensal ÷ horas do mês do equipamento' : '') + tdv(nu ? int(nu) : '-', 'c') + tdv(esc(e.co || ''), 'vz') + '</tr>';
  });
 if (ed) s += '<tr><td class="ad" colspan="14" ' + h(function () { var e = cpuNovoIns(X, 'MAT', 'NOVO INSUMO'); V.bi = ''; proxima = 'cin' + X.ins.length; void e; agendar(); }) + '>Adicionar</td></tr>';
  s += '</tbody></table></div>' + (ed ? CPU_TIPOS.map(function (t) { return '<datalist id="dlg-' + t + '">' + Object.keys(gruposT[t] || {}).filter(Boolean).sort().map(function (g) { return '<option value="' + esc(g) + '">'; }).join('') + '</datalist>'; }).join('') : '') + '<div class="nota">' + lista.length + ' de ' + X.ins.length + ' insumos · ' + nlk + ' com preço vinculado aos bancos de dados' + (nerr ? ' · <b class="pico">' + nerr + ' vínculo(s) pendente(s)</b>' : '') +
    (cheiaI > MAXI ? '. Mostrando ' + MAXI + ' de ' + cheiaI + ' insumos (refine a busca)' : '') + '. Vínculo MAT usa o VALOR UNITÁRIO; SER usa o custo por unidade (ou mensal, se a unidade for MES); MAO e VEM convertem o custo mensal em custo por hora.</div>';
  return s;
}
/* diesel (L/h) de um equipamento da CPU: sempre do banco Veículos e máquinas (vínculo VEM ou mesma descrição) */
function cpuDiesel(e, X) {
  var C = X.C || ctx(), nome = e.lk && e.lk.b === 'VEM' && e.lk.d ? e.lk.d : null, v = nome ? C.vem[nome] : null;
  if (!v) { var k = semAcento(e.d); Object.keys(C.vem).some(function (d) { if (semAcento(d) === k) { nome = d; v = C.vem[d]; return true; } }); }
  if (!v || !/DIESEL/.test(semAcento(v.r.cb || ''))) return { lh: 0, vem: v ? nome + ' (sem diesel)' : null };
  return { lh: v.lHora, vem: nome };
}
/* combustível de um equipamento da CPU (qualquer tipo: diesel, gasolina, etanol…), pelo vínculo com o banco Veículos e máquinas */
function cpuComb(e, X) {
  var C = X.C || ctx(), nome = e.lk && e.lk.b === 'VEM' && e.lk.d ? e.lk.d : null, v = nome ? C.vem[nome] : null;
  if (!v) { var k = semAcento(e.d); Object.keys(C.vem).some(function (d) { if (semAcento(d) === k) { nome = d; v = C.vem[d]; return true; } }); }
  return v ? { lh: v.lHora, cb: v.r.cb || '', vem: nome } : { lh: 0, cb: '', vem: null };
}
function cpuTrocaTipoIns(X, e, t) {
  if (!t || t === e.t) return;
  e.t = t; if (t === 'EQ' && e.pi == null) e.pi = 0;
  if (!X.ins.some(function (o) { return o !== e && o.t === t && o.g === e.g; })) e.g = CPU_GPAD[t];
  e.c = cpuCodigoNovo(X, t, e.g, e);
  X.comps.forEach(function (c) { var m = false; (c.it || []).forEach(function (x) { if (x.t !== 'AUX' && x.i === e.id) { x.t = t; m = true; if (t === 'EQ') { if (x.up == null) x.up = 1; } } }); if (m) cpuSalvar(c); });
  cpuSalvarIns();
}
/* chamadas pelos bancos: renomear e excluir itens vinculados */
function cpuLinks(k, d) { var b = { mat: 'MAT', ser: 'SER', mao: 'MAO', vem: 'VEM', ind: 'MAT' }[k]; return ((S.base.cpuins || {}).rows || []).filter(function (e) { return e.lk && e.lk.b === b && e.lk.d === d; }).length; }
function cpuRenomearBanco(k, de, para) {
  var b = { mat: 'MAT', ser: 'SER', mao: 'MAO', vem: 'VEM' }[k], m = false;
  ((S.base.cpuins || {}).rows || []).forEach(function (e) { if (e.lk && e.lk.b === b && e.lk.d === de) { e.lk.d = para; m = true; } });
  if (m) cpuSalvarIns();
}

/* ---------- Excel: exportação com fórmulas ligadas ---------- */
function cpuExportar() {
  var X = cpuDados();
  carregaExcelJS().then(function (XL) {
    var wb = new XL.Workbook(); wb.creator = 'Planning Projects · OP Consulting'; wb.created = new Date();
    var AZUL = 'FF1769E8', CALC = 'FFF3F7FD', B = { style: 'thin', color: { argb: 'FFDDE3EC' } }, bordas = { top: B, left: B, bottom: B, right: B };
    var M = '#,##0.00', N4 = '#,##0.0000##';
    var wi = wb.addWorksheet('INSUMOS', { views: [{ state: 'frozen', ySplit: 2 }] }), wc = wb.addWorksheet('CPU', { views: [{ state: 'frozen', ySplit: 2 }] });
    var cab = function (ws, cols) {
      ws.getCell(1, 1).value = ws.name === 'CPU' ? 'CPU – COMPOSIÇÕES DO PREÇO UNITÁRIO · Planning Projects' : 'INSUMOS DA CPU · preços únicos usados por todas as composições'; ws.getCell(1, 1).font = { bold: true, size: 12 };
      cols.forEach(function (c, j) { var x = ws.getCell(2, j + 1); x.value = c[0]; x.font = { bold: true, color: { argb: 'FFFFFFFF' } }; x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }; x.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; x.border = bordas; ws.getColumn(j + 1).width = c[1]; });
      ws.getRow(2).height = 30;
    };
    var calc = function (cell, f, fm) { cell.value = { formula: f }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CALC } }; cell.font = { bold: true, color: { argb: 'FF26456F' } }; cell.protection = { locked: true, hidden: true }; if (fm) cell.numFmt = fm; };
    var livre = function (cell, v, fm) { cell.value = v; cell.protection = { locked: false }; if (fm) cell.numFmt = fm; };
    /* INSUMOS */
    cab(wi, [['ID', 12], ['CÓDIGO', 14], ['DESCRIÇÃO', 60], ['TIPO', 14], ['UND', 8], ['PREÇO (R$)', 14], ['PREÇO IMPROD. (R$/h)', 14], ['VÍNCULO', 10], ['ITEM DO BANCO', 44], ['GRUPO', 34], ['CÓD. ORIGEM', 14]]);
    var linhaIns = {};
    X.ins.forEach(function (e, i) {
      var r = i + 3, pr = cpuPreco(e, X), lig = e.lk && e.lk.b; linhaIns[e.id] = r;
      wi.getCell(r, 1).value = e.id; wi.getCell(r, 2).value = e.c || e.id; livre(wi.getCell(r, 3), e.d); livre(wi.getCell(r, 4), CPU_TR[e.t] || e.t); livre(wi.getCell(r, 5), e.u);
      if (lig) { var cp = wi.getCell(r, 6); cp.value = pr.p; cp.numFmt = '#,##0.00###'; cp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CALC } }; cp.protection = { locked: true }; cp.note = 'Preço vindo do banco ' + CPU_BROT[e.lk.b] + ' do sistema'; }
      else livre(wi.getCell(r, 6), num(e.p), '#,##0.00###');
      livre(wi.getCell(r, 7), e.t === 'EQ' ? num(e.pi) : null, '#,##0.00###');
      wi.getCell(r, 8).value = lig ? e.lk.b : ''; wi.getCell(r, 9).value = lig ? e.lk.d : ''; livre(wi.getCell(r, 10), e.g || ''); wi.getCell(r, 11).value = e.co || '';
      for (var j = 1; j <= 11; j++) wi.getCell(r, j).border = bordas;
    });
    /* CPU: cabeçalho da composição, itens por bloco, totais */
    cab(wc, [['CÓDIGO', 16], ['DESCRIÇÃO', 62], ['UND', 7], ['BLOCO / TIPO', 26], ['QUANTIDADE / PRODUÇÃO', 13], ['CONSUMO', 13], ['UTIL. PROD.', 9], ['UTIL. IMPROD.', 9], ['PREÇO UNIT. (R$)', 14], ['CUSTO HORÁRIO (R$)', 14], ['VALOR (R$)', 15], ['ID INSUMO / CPU', 14]]);
    var totCel = {}, r = 3, pend = [];
    X.comps.forEach(function (c) { var P = c.tp === 'P'; totCel[c.c] = null; void P; });
    X.comps.forEach(function (c) {
      var P = c.tp === 'P', o = cpuCalc(c, X), h0 = r;
      var hc = function (j, v) { var x = wc.getCell(r, j); x.value = v; x.font = { bold: true, color: { argb: 'FFFFFFFF' } }; x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F57C9' } }; x.border = bordas; return x; };
      for (var j = 1; j <= 12; j++) hc(j, null);
      hc(1, c.c); hc(2, c.d); hc(3, c.u); hc(4, P ? 'POR PRODUÇÃO DA EQUIPE' : 'POR CONSUMO');
      var cpr = hc(5, P ? num(c.pr) : null); if (P) { cpr.numFmt = N4; cpr.protection = { locked: false }; cpr.note = 'Produção da equipe (' + (c.u || 'und') + '/h)'; }
      if (P) { var cf = hc(6, num(c.fic)); cf.protection = { locked: false }; cf.numFmt = N4; cf.note = 'FIC'; var ct = hc(7, num(c.fit)); ct.protection = { locked: false }; ct.numFmt = N4; ct.note = 'FIT'; }
      r++;
      var equipe = [], outros = [];
      CPU_T.forEach(function (T) {
        var its = o.it.filter(function (x) { return x.x.t === T.t; }); if (!its.length) return;
        wc.getCell(r, 4).value = T.l + ' – ' + T.nome; wc.getRow(r).font = { bold: true, color: { argb: 'FF26456F' } }; for (var j2 = 1; j2 <= 12; j2++) { wc.getCell(r, j2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7F0FD' } }; wc.getCell(r, j2).border = bordas; } r++;
        its.forEach(function (it) {
          var x = it.x, eqP = P && T.eq, ri = linhaIns[x.i];
          wc.getCell(r, 1).value = it.cod; wc.getCell(r, 2).value = it.nome; wc.getCell(r, 3).value = it.u; wc.getCell(r, 4).value = x.t === 'AUX' ? 'CPU AUXILIAR' : CPU_TR[x.t]; wc.getCell(r, 12).value = x.i;
          if (eqP) { livre(wc.getCell(r, 5), num(x.q), N4); calc(wc.getCell(r, 6), 'IF($E$' + h0 + '=0,0,E' + r + '/$E$' + h0 + ')', N4); }
          else livre(wc.getCell(r, 6), num(x.k), N4);
          if (x.t === 'EQ') { livre(wc.getCell(r, 7), x.up == null ? 1 : num(x.up), N4); livre(wc.getCell(r, 8), num(x.ui), N4); }
          if (x.t === 'AUX') pend.push([r, x.i]);
          else if (ri) calc(wc.getCell(r, 9), x.t === 'EQ' ? 'G' + r + '*INSUMOS!$F$' + ri + '+H' + r + '*INSUMOS!$G$' + ri : 'INSUMOS!$F$' + ri, '#,##0.00###');
          else { wc.getCell(r, 9).value = 0; }
          if (eqP) { calc(wc.getCell(r, 10), 'E' + r + '*I' + r, M); equipe.push(r); }
          calc(wc.getCell(r, 11), 'F' + r + '*I' + r, M); if (!eqP) outros.push(r);
          for (var j3 = 1; j3 <= 12; j3++) wc.getCell(r, j3).border = bordas;
          r++;
        });
      });
      var tl = function (rot, f, fm, col) { wc.getCell(r, 2).value = rot; wc.getCell(r, 2).font = { bold: true }; calc(wc.getCell(r, col || 11), f, fm || M); var rr = r; r++; return rr; };
      var soma = function (rows, col) { return rows.length ? rows.map(function (x) { return col + x; }).join('+') : '0'; };
      var tot;
      if (P) {
        var rch = tl('CUSTO HORÁRIO DA EQUIPE', soma(equipe, 'J'), M, 10);
        var rcu = tl('CUSTO UNITÁRIO DE EXECUÇÃO', 'IF($E$' + h0 + '=0,0,J' + rch + '/$E$' + h0 + ')');
        var rfi = tl('FIC', 'K' + rcu + '*$F$' + h0), rft = tl('FIT', 'K' + rcu + '*$G$' + h0);
        tot = tl('CUSTO UNITÁRIO TOTAL', 'ROUND(K' + rcu + '+K' + rfi + '+K' + rft + '+' + soma(outros, 'K') + ',2)');
      } else tot = tl('CUSTO UNITÁRIO TOTAL', 'ROUND(' + soma(outros, 'K') + ',2)');
      wc.getCell(tot, 11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE9A8' } };
      totCel[c.c] = tot; r++;
    });
    pend.forEach(function (p) { var t = totCel[p[1]]; calc(wc.getCell(p[0], 9), t ? 'K' + t : '0', M); });
    var prot = { selectLockedCells: true, selectUnlockedCells: true, formatColumns: true, formatRows: true };
    return Promise.all([wi.protect(SENHA_XL, prot), wc.protect(SENHA_XL, prot)]).then(function () { return xlMarca(wb); }).then(function () { return wb.xlsx.writeBuffer(); });
  }).then(function (buf) { baixar('cpu-composicoes-' + new Date().toISOString().slice(0, 10) + '.xlsx', buf); },
    function (e) { console.error(e); msgbox('ERRO!', 'Não foi possível gerar o Excel: ' + e.message + '.', 'crit'); });
}

/* ---------- Excel: importação (arquivo exportado pelo sistema ou relatório "Segregado") ---------- */
function cpuImportarBtn() {
  return '<label class="bxl in" data-tip="Atualiza composições e insumos a partir do Excel exportado aqui ou do relatório de composições no formato Segregado"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 13V4M6 7.5l4-4 4 4M4 15.5h12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>Importar Excel<input type="file" accept=".xlsx,.xls,.xlsm" hidden ' + h(function (el) {
    var f = el.files && el.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () { cpuLerPlanilha(f.name, rd.result).then(function (pl) { S.v.dlg = pl; agendar(); }, function (e) { msgbox('ERRO!', 'Não foi possível ler o arquivo: ' + e.message + '.', 'crit'); }); };
    rd.readAsArrayBuffer(f); el.value = '';
  }) + '></label>';
}
var cpuNum = function (v) { if (typeof v === 'number') return v; var s = String(v == null ? '' : v).trim(); if (!s) return 0; if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.'); var n = parseFloat(s); return isFinite(n) ? n : 0; };
var CPU_UN = { 'MÊS': 'MES', 'MES': 'MES', 'UN.': 'UN', 'UND': 'UN', 'UNID': 'UN', 'METR': 'MT', 'M': 'MT', 'M³': 'M3', 'M²': 'M2', 'CONJ': 'CJ', 'PEÇA': 'PC', 'PÇ': 'PC', 'ROLO': 'RL', 'L': 'LT', 'T': 'TN', 'UMÊS': 'UMES' };
var cpuTx = function (v) { return semAcento(v).replace(/\s+/g, ' ').trim(); };
var cpuUn = function (u) { u = String(u || '').trim().toUpperCase(); return CPU_UN[u] || u; };
function cpuLerPlanilha(arq, buf) {
  return carregaXlsx().then(function (XS) {
    var wb = XS.read(buf, { type: 'array' }), aoa = function (n) { return XS.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', raw: true }); };
    var res;
    if (wb.SheetNames.indexOf('CPU') >= 0 && wb.SheetNames.indexOf('INSUMOS') >= 0) res = cpuLerExport(aoa('INSUMOS'), aoa('CPU'));
    else {
      var a = aoa(wb.SheetNames[0]), txt = a.slice(0, 60).map(function (l) { return l.join('|'); }).join('\n');
      if (/SubTotal M[aã]o de Obra/i.test(txt)) res = cpuLerSegregado(a);
      else if (/A - Equipamento/.test(txt)) throw new Error('o formato DNIT não traz a produção das equipes de forma confiável. Use o relatório Segregado ou o Excel exportado nesta guia');
      else throw new Error('formato não reconhecido. Use o relatório Segregado (com os blocos Mão de Obra, Equipamento, Material, Serviço e Outros) ou o Excel exportado nesta guia');
    }
    return cpuPlano(arq, res);
  });
}
function cpuLerExport(I, C) {
  var ins = [], comps = [], cur = null, inv = { 'MÃO DE OBRA': 'MO', 'EQUIPAMENTO': 'EQ', 'MATERIAL': 'MAT', 'SERVIÇO': 'SER', 'OUTROS': 'OUT', 'CPU AUXILIAR': 'AUX' };
  I.slice(2).forEach(function (l) { if (!l[0]) return; var e = { id: String(l[0]).trim(), c: String(l[1]).trim(), d: cpuTx(l[2]), t: inv[String(l[3]).trim().toUpperCase()] || 'OUT', u: cpuUn(l[4]), p: cpuNum(l[5]), _lk: !!String(l[7]).trim(), g: cpuTx(l[9]) || undefined, co: String(l[10] == null ? '' : l[10]).trim() || undefined }; if (e.t === 'EQ') e.pi = cpuNum(l[6]); ins.push(e); });
  C.slice(2).forEach(function (l) {
    var a = String(l[0]).trim(), d4 = String(l[3]).trim().toUpperCase();
    if (d4 === 'POR PRODUÇÃO DA EQUIPE' || d4 === 'POR CONSUMO') { cur = { c: a, d: cpuTx(l[1]), u: cpuUn(l[2]), tp: d4 === 'POR CONSUMO' ? 'C' : 'P', it: [] }; if (cur.tp === 'P') { cur.pr = cpuNum(l[4]); cur.fic = cpuNum(l[5]); cur.fit = cpuNum(l[6]); } comps.push(cur); return; }
    if (!cur || !inv[d4] || !String(l[11]).trim()) return;
    var t = inv[d4], x = { t: t, i: String(l[11]).trim() };
    if (cur.tp === 'P' && ehEquipe(t)) x.q = cpuNum(l[4]); else x.k = cpuNum(l[5]);
    if (t === 'EQ') { x.up = l[6] === '' ? 1 : cpuNum(l[6]); x.ui = cpuNum(l[7]); }
    cur.it.push(x);
  });
  return { ins: ins, comps: comps, fmt: 'Excel exportado pelo sistema' };
}
function cpuLerSegregado(A) {
  var CAT = { 'MÃO DE OBRA': 'MO', 'MAO DE OBRA': 'MO', 'EQUIPAMENTO': 'EQ', 'MATERIAL': 'MAT', 'SERVIÇO': 'SER', 'SERVICO': 'SER', 'OUTROS': 'OUT' };
  var comps = [], cur = null, cat = null, ins = {}, seq = 0, avisos = [];
  A.forEach(function (r) {
    var a = String(r[0] == null ? '' : r[0]).trim(), cu = a.toUpperCase();
    if (cu === 'CÓDIGO' || cu === 'CODIGO') return;
    if (cu === 'T O T A L') { if (cur) cur._tot = cpuNum(r[2]); cur = null; return; }
    if (!cur && /^\d/.test(a) && r[1] && String(r[9]).trim() && (r[3] === '' || r[3] == null)) { cur = { c: a, d: cpuTx(r[1]), u: cpuUn(r[9]), tp: 'C', it: [], _raw: [] }; comps.push(cur); cat = null; return; }
    if (!cur) return;
    if (CAT[cu]) { cat = CAT[cu]; return; }
    if (/^SUBTOTAL/i.test(a)) return;
    if (r[1]) cur._raw.push({ t: cat || 'OUT', cod: a, d: cpuTx(r[1]), u: cpuUn(r[3]), k: cpuNum(r[6]), p: cpuNum(r[7]) });
  });
  comps.forEach(function (c) {
    var raw = c._raw; delete c._raw;
    while (raw.length && !raw[0].cod && !raw[0].k && !raw[0].p) c.d = cpuTx(c.d + ' ' + raw.shift().d);
    raw.forEach(function (x) {
      var key = x.cod || ('#' + x.d + '|' + x.u + '|' + x.t), e = ins[key];
      if (!e) e = ins[key] = { id: x.cod || ('IMP-' + ('000' + (++seq)).slice(-4)), c: x.cod, d: x.d, u: x.u, t: x.t, _ps: [] };
      e._ps.push(x.p); x.e = e;
    });
    c._it = raw;
  });
  Object.keys(ins).forEach(function (k) { var e = ins[k], ps = e._ps.filter(function (p) { return p > 0; }); e.p = ps.length ? Math.min.apply(null, ps) : 0; if (e.t === 'EQ') e.pi = 0; delete e._ps; });
  var porId = {}; Object.keys(ins).forEach(function (k) { porId[ins[k].id] = ins[k]; });
  comps.forEach(function (c) {
    c.it = c._it.map(function (x) { var k = x.k; if (x.e.p && Math.abs(x.p - x.e.p) > 1e-9) k = k * x.p / x.e.p; var it = { t: x.t, i: x.e.id, k: k }; if (x.t === 'EQ') { it.up = 1; it.ui = 0; } return it; });
    delete c._it;
    var v = c.it.reduce(function (a, x) { var e = porId[x.i]; return a + x.k * (e ? e.p : 0); }, 0);
    if (c._tot != null && Math.abs(r2(v) - c._tot) > 0.004) avisos.push(c.c + ': total do arquivo ' + money(c._tot) + ', calculado ' + money(r2(v)));
    delete c._tot;
  });
  return { ins: Object.keys(ins).map(function (k) { return ins[k]; }), comps: comps, fmt: 'relatório Segregado', avisos: avisos };
}
/* compara com o que já existe: composições pelo código, insumos pelo ID (ou pelo código) */
function cpuPlano(arq, res) {
  var X = cpuDados(), pl = { tipo: 'impcpu', arq: arq, fmt: res.fmt, avisos: res.avisos || [], insNovos: [], insPreco: [], cNovas: [], cAlter: [], cIguais: 0, mapa: {} };
  res.ins.forEach(function (e) {
    var at = X.bi[e.id] || X.ins.filter(function (x) { return e.c && (x.c === e.c || x.id === e.c || x.co === e.c); })[0];
    if (!at) { pl.insNovos.push(e); pl.mapa[e.id] = e.id; return; }
    pl.mapa[e.id] = at.id;
    if (!(at.lk && at.lk.b) && !e._lk && (Math.abs(num(at.p) - e.p) > 1e-9 || (e.t === 'EQ' && e.pi && Math.abs(num(at.pi) - e.pi) > 1e-9))) pl.insPreco.push({ at: at, p: e.p, pi: e.pi });
  });
  res.comps.forEach(function (c) {
    c.it.forEach(function (x) { if (x.t !== 'AUX') x.i = pl.mapa[x.i] || x.i; });
    var at = X.by[c.c];
    if (!at) pl.cNovas.push(c);
    else if (JSON.stringify([at.d, at.u, at.tp || 'C', num(at.pr), num(at.fic), num(at.fit), at.it]) !== JSON.stringify([c.d, c.u, c.tp, num(c.pr), num(c.fic), num(c.fit), c.it])) pl.cAlter.push({ at: at, nv: c });
    else pl.cIguais++;
  });
  return pl;
}
function dlgImpCpu(d) {
  var fechar = function () { S.v.dlg = null; agendar(); }, nada = !d.insNovos.length && !d.insPreco.length && !d.cNovas.length && !d.cAlter.length;
  var aplicar = function () {
    var ins = S.base.cpuins.rows;
    var XN = cpuDados(); d.insNovos.forEach(function (e) { var n = {}; Object.keys(e).forEach(function (k) { if (k.charAt(0) !== '_' && e[k] !== undefined) n[k] = e[k]; }); if (!n.co) n.co = n.c; if (!n.g) n.g = CPU_GPAD[n.t] || 'OUTROS'; n.c = cpuCodigoNovo(XN, n.t, n.g, n); ins.push(n); });
    d.insPreco.forEach(function (a) { a.at.p = a.p; if (a.at.t === 'EQ' && a.pi) a.at.pi = a.pi; });
    cpuSalvarIns();
    var mud = {};
    d.cAlter.forEach(function (a) { ['d', 'u', 'tp', 'pr', 'fic', 'fit', 'it'].forEach(function (k) { if (a.nv[k] != null) a.at[k] = a.nv[k]; else delete a.at[k]; }); mud[a.at._k] = 1; });
    d.cNovas.forEach(function (c) { var k = cpuParteLivre(); S.base[k].rows.push(c); mud[k] = 1; });
    Object.keys(mud).forEach(function (k) { salvarBase(k); });
    S.v.dlg = null;
    msgbox('SUCESSO!', 'Importação concluída.\n\n' + d.cNovas.length + ' composição(ões) incluída(s)\n' + d.cAlter.length + ' composição(ões) atualizada(s)\n' + d.insNovos.length + ' insumo(s) novo(s)\n' + d.insPreco.length + ' preço(s) de insumo atualizado(s)');
  };
  var q = function (n, r, cls) { return '<div class="' + (cls || '') + '"><b>' + n + '</b><span>' + r + '</span></div>'; };
  return janela('Importar Excel — CPU', '<div>Arquivo <b>' + esc(d.arq) + '</b> (' + esc(d.fmt) + '). As composições são identificadas pelo CÓDIGO.</div>' +
    '<div class="impq">' + q(d.cNovas.length, 'CPU novas') + q(d.cAlter.length, 'CPU alteradas') + q(d.cIguais, 'CPU sem alteração') + q(d.insNovos.length, 'insumos novos') + q(d.insPreco.length, 'preços alterados') + '</div>' +
    (d.avisos.length ? '<fieldset><legend>Totais do arquivo que não fecham (' + d.avisos.length + ')</legend><div class="impe">' + d.avisos.slice(0, 20).map(function (a) { return '<div>' + esc(a) + '</div>'; }).join('') + '</div></fieldset>' : '') +
    '<div class="nota" style="margin:0">Insumos com preço vinculado a um banco de dados não têm o preço alterado pela importação.</div>' +
    '<div class="bts">' + bt('IMPORTAR', aplicar, '', nada) + bt('CANCELAR', fechar, 'cz') + '</div>', 560, fechar);
}
/* ================= cronograma físico (MS Project), Last Planner System e Linhas de Balanço =================
   Dados por projeto em <raiz>/<id>/crono: t01…tNN (tarefas), cal (calendários do MS Project), cpus (CPUs por macroatividade),
   param (impostos, CSLL, IR, TAC), lps_r (restrições) e lps_s (planos semanais). Meta do projeto: p.crono. */
var CRO_EXTRA = ['cal', 'cpus', 'param', 'lps_r', 'lps_s'];
document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target && e.target.dataset && e.target.dataset.enter) { e.preventDefault(); e.target.blur(); } });
var CRO_COR = { lb: '#8a97ab', at: '#1769e8', re: '#1fa86a', st: '#e5534b' };
var dn = function (s) { if (!s) return null; var d = E.day(s); if (d == null) return null; var m = /T(\d\d):(\d\d)/.exec(s); return d + (m ? (+m[1] * 60 + +m[2]) / 1440 : 0); };
var segunda = function (d) { d = Math.floor(d); return d - ((E.weekday(d) + 5) % 7); };
var miDe = function (d) { var y = E.ymd(Math.floor(d)); return y[0] * 12 + y[1]; };
var miIni = function (mi) { return E.day(Math.floor(mi / 12) + '-' + ('0' + (mi % 12 + 1)).slice(-2) + '-01'); };
var seg1 = function (n) { return String(n || '').split('|')[0].trim().toUpperCase(); };
var isoDia = function (d) { return E.iso(Math.floor(d)); };
/* tempo de trabalho acumulado (seg a sex = 1 dia, sábado = meio dia, domingo = 0; expediente 07:00–18:00) */
var CRO_PD = [0, 1, 1, 1, 1, 1, 0.5];
var CRO_PA = [0, 0, 1, 2, 3, 4, 5];
var wt0x = function (d) {
  var D = Math.floor(d), f = Math.max(0, Math.min(1, ((d - D) * 1440 - 420) / 660)), idx = ((D + 4) % 7 + 7) % 7, k = (D - idx + 4) / 7;
  return k * 5.5 + CRO_PA[idx] + CRO_PD[idx] * f;
};
var wt0 = wt0x, wt = wt0x;
/* calendário padrão do MS Project (dias úteis, expediente e feriados) → tempo de trabalho acumulado em minutos */
function croCalendario(p) {
  var xml = (p._cro.cal || {}).xml, uid = String(num(p.crono.cal) || 1);
  if (!xml || typeof DOMParser === 'undefined') return wt0;
  var doc = new DOMParser().parseFromString(xml, 'application/xml'), cal = null, tx = function (el, n) { for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (c.localName === n) return c.textContent; return ''; };
  var kids = function (el, n) { var r = []; if (!el) return r; for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (c.localName === n) r.push(c); return r; };
  kids(doc.documentElement, 'Calendar').forEach(function (c) { if (tx(c, 'UID') === uid) cal = c; });
  if (!cal) return wt0;
  var mins = function (wd) { return kids(kids(wd, 'WorkingTimes')[0], 'WorkingTime').map(function (w) { var a = tx(w, 'FromTime').split(':'), b = tx(w, 'ToTime').split(':'); var x = +a[0] * 60 + +a[1], y = +b[0] * 60 + +b[1]; return [x, y <= x ? 1440 : y]; }); };
  var semana = {}, exc = {};
  kids(kids(cal, 'WeekDays')[0], 'WeekDay').forEach(function (wd) {
    var dt = +tx(wd, 'DayType'), on = tx(wd, 'DayWorking') === '1', per = on ? mins(wd) : [];
    if (dt >= 1 && dt <= 7) semana[dt - 1] = per;
    else if (dt === 0) { var tp = kids(wd, 'TimePeriod')[0]; if (!tp) return; var a = E.day(tx(tp, 'FromDate')), b = E.day(tx(tp, 'ToDate')); for (var d = a; d <= b && d - a < 800; d++) exc[d] = per; }
  });
  kids(kids(cal, 'Exceptions')[0], 'Exception').forEach(function (ex) { var tp = kids(ex, 'TimePeriod')[0]; if (!tp) return; var on = tx(ex, 'DayWorking') === '1', per = on ? mins(ex) : [], a = E.day(tx(tp, 'FromDate')), b = E.day(tx(tp, 'ToDate')); for (var d = a; d <= b && d - a < 800; d++) exc[d] = per; });
  if (!Object.keys(semana).length) return wt0;
  var perDe = function (D) { return exc[D] || semana[((D + 4) % 7 + 7) % 7] || []; }, cum = {}, D0 = null, D1 = null, totDia = function (D) { return perDe(D).reduce(function (a, x) { return a + x[1] - x[0]; }, 0); };
  var semMin = [0, 1, 2, 3, 4, 5, 6].reduce(function (a, i) { return a + (semana[i] || []).reduce(function (b, x) { return b + x[1] - x[0]; }, 0); }, 0) || 2400;
  var base = function (D) {
    if (D0 == null) { D0 = D - 1500; D1 = D + 1500; var acc = 0; for (var k = D0; k <= D1; k++) { cum[k] = acc; acc += totDia(k); } }
    if (D < D0) return cum[D0] - (D0 - D) / 7 * semMin; if (D > D1) return cum[D1] + (D - D1) / 7 * semMin; return cum[D];
  };
  return function (d) { var D = Math.floor(d), m = (d - D) * 1440, w = 0; perDe(D).forEach(function (x) { w += Math.max(0, Math.min(m, x[1]) - x[0]); }); return (base(D) + w) / 480; };
}
var realDe = function (t) { return t.pf != null ? num(t.pf) : num(t.pc); };
function croRaiz(p) { return dirP(p) + '/crono'; }
function croCarregar(p) {
  if (p._cro) return Promise.resolve(p._cro);
  if (p._croP) return p._croP;
  p._croP = db.collection(croRaiz(p)).get().then(function (snap) {
    var C = { parts: {}, cal: { xml: '' }, cpus: { links: {} }, param: {}, lps_r: { rows: [] }, lps_s: { rows: [] }, tasks: [] };
    snap.docs.forEach(function (d) { var x = clone(d.data()); if (/^t\d+$/.test(d.id)) C.parts[d.id] = x; else C[d.id] = x; });
    Object.keys(C.parts).sort().forEach(function (k) { (C.parts[k].rows || []).forEach(function (t) { Object.defineProperty(t, '_k', { value: k, writable: true, configurable: true, enumerable: false }); C.tasks.push(t); }); });
    C.cpus.links = C.cpus.links || {}; C.lps_r.rows = C.lps_r.rows || []; C.lps_s.rows = C.lps_s.rows || [];
    if (C.inp_eap && C.inp_eap.partes) { var oo = []; for (var ip = 1; ip <= C.inp_eap.partes; ip++) oo = oo.concat((C['inp_eap_' + ip] || {}).ord || []); C.inp_eap.ord = oo; }
    p._cro = C; p._croCalc = null; p._croP = null; agendar(); return C;
  }, function (e) { p._croP = null; p._croErr = (e && e.message) || String(e); agendar(); });
  return p._croP;
}
function croMudou(p) { p._croCalc = null; }
function croSalvarT(p, t) { croMudou(p); gravar(croRaiz(p) + '/' + t._k, p._cro.parts[t._k]); }
function croSalvarDoc(p, k) { croMudou(p); gravar(croRaiz(p) + '/' + k, p._cro[k]); }
function croTodosDocs(p) { return Object.keys(p._cro.parts).concat(CRO_EXTRA); }
/* mover (liberar / rascunho) e excluir projetos com cronograma */
function croMover(p, antigo) {
  if (!p.crono) return;
  croCarregarDe(antigo, p).then(function (C) { Object.keys(C.parts).forEach(function (k) { gravar(croRaiz(p) + '/' + k, C.parts[k]); gravar(antigo + '/' + p.id + '/crono/' + k, null); }); CRO_EXTRA.forEach(function (k) { gravar(croRaiz(p) + '/' + k, C[k]); gravar(antigo + '/' + p.id + '/crono/' + k, null); }); });
}
function croCarregarDe(rz, p) { if (p._cro) return Promise.resolve(p._cro); var r0 = p._raiz; p._raiz = rz; var pr = croCarregar(p); p._raiz = r0; return pr; }
function croExcluir(p) {
  if (!p.crono) return;
  var n = num(p.crono.partes) || 40, i; for (i = 1; i <= n; i++) gravar(croRaiz(p) + '/t' + ('0' + i).slice(-2), null);
  CRO_EXTRA.forEach(function (k) { gravar(croRaiz(p) + '/' + k, null); });
  if (p._cro) Object.keys(p._cro).forEach(function (k) { if (/^inp_/.test(k)) gravar(croRaiz(p) + '/' + k, null); });
}

/* ---------- cálculo ---------- */
function croSpread(acc, keyFn, a, b, v) {
  if (!v) return;
  if (a == null) return;
  var A = wt(a), B = b == null ? A : wt(b);
  if (b == null || b <= a || B <= A) { var k0 = keyFn.k(b != null && b > a ? b : a); acc[k0] = (acc[k0] || 0) + v; return; }
  var x = keyFn.ini(a);
  while (x < b) { var nx = keyFn.prox(x), o = wt(Math.min(b, nx)) - wt(Math.max(a, x)); if (o > 0) { var k = keyFn.k(Math.max(a, x)); acc[k] = (acc[k] || 0) + v * o / (B - A); } x = nx; }
}
var KSEM = { k: segunda, ini: segunda, prox: function (x) { return x + 7; } };
var KMES = { k: miDe, ini: function (d) { return miIni(miDe(d)); }, prox: function (x) { return miIni(miDe(x) + 1); } };
function croParam(p) {
  var P = p._cro.param || (p._cro.param = {});
  if (P.imp == null) { P.imp = 0.1425; P.csll = 0.09; P.ir = 0.25; P.base = 'REAL'; P.presCsll = 0.12; P.presIr = 0.08; P.tac = 0; }
  if (P.margem == null) P.margem = 0.15; if (P.mwp == null) P.mwp = num(p.mwp) || 0; if (!P.sigla) P.sigla = p.sigla || semAcento(p.nome).replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'PRJ'; if (!P.pid) P.pid = p.id;
  if (!P.regras) P.regras = P.mwp > 0 && window.OPPadrao ? window.OPPadrao.regrasPadrao() : [];
  return P;
}
function croCalc(p) {
  if (p._croCalc) return p._croCalc;
  if (!p._croWt) p._croWt = croCalendario(p); wt = p._croWt;
  var C = p._cro, T = C.tasks, by = Object.create(null), kids = Object.create(null), st = dn(p.crono.status) || E.day(new Date().toISOString());
  T.forEach(function (t) { by[t.u] = t; }); T.forEach(function (t) { (kids[t.p] = kids[t.p] || []).push(t); });
  var leaves = T.filter(function (t) { return !t.s; }), MM = window.OPPadrao.macros(T), macro = MM.macro, lm = MM.lm;
  /* custo direto das CPUs por macroatividade */
  var X = cpuDados(), cpuUnit = function (c) { var o = X.by[c]; return o ? cpuCalc(o, X).tot : 0; }, mc = Object.create(null);
  Object.keys(C.cpus.links).forEach(function (u) { mc[u] = (C.cpus.links[u] || []).reduce(function (a, l) { return a + num(l.q) * cpuUnit(l.c); }, 0); });
  /* nós: venda (LB), previsto até a data de status, agregado (real), custo direto */
  var N = Object.create(null), frac = function (a, b, d) { if (a == null) return 0; if (b == null || b <= a) return d >= a ? 1 : 0; var A = wt(a), B = wt(b); if (B <= A) return d >= b ? 1 : 0; return Math.max(0, Math.min(1, (wt(d) - A) / (B - A))); };
  T.forEach(function (t) { N[t.u] = { v: 0, pv: 0, ev: 0, cd: num(mc[t.u]) || 0, du: 0, dpv: 0, dev: 0 }; });
  leaves.forEach(function (t) {
    var n = N[t.u], v = num(t.bc), bi = dn(t.bi || t.i), bf = dn(t.bf || t.f), w = Math.max(1, num(t.dm) / 480);
    n.v = v; n.pv = v * frac(bi, bf, st); n.ev = v * realDe(t) / 100;
    n.du = w; n.dpv = w * frac(bi, bf, st); n.dev = w * realDe(t) / 100;
  });
  for (var i = T.length - 1; i >= 0; i--) { var t = T[i], pn = N[t.p], n = N[t.u]; if (!pn) continue; pn.v += n.v; pn.pv += n.pv; pn.ev += n.ev; pn.cd += n.cd; pn.du += n.du; pn.dpv += n.dpv; pn.dev += n.dev; }
  /* séries semanais e mensais */
  var sp = {}, st_ = {}, sr = {}, mp = {}, mt = {}, mr = {}, mcd = {}, ini = null, fim = null;
  var porMacro = Object.create(null); leaves.forEach(function (t) { (porMacro[lm[t.u]] = porMacro[lm[t.u]] || []).push(t); });
  leaves.forEach(function (t) {
    var v = num(t.bc), bi = dn(t.bi || t.i), bf = dn(t.bf || t.f), a = dn(t.i), b = dn(t.f);
    [bi, bf, a, b].forEach(function (d) { if (d != null) { if (ini == null || d < ini) ini = d; if (fim == null || d > fim) fim = d; } });
    croSpread(sp, KSEM, bi, bf, v); croSpread(mp, KMES, bi, bf, v);
    croSpread(st_, KSEM, a, b, v); croSpread(mt, KMES, a, b, v);
    var ev = v * realDe(t) / 100;
    if (ev) { var ra = dn(t.as) || a, rb = realDe(t) >= 100 ? (dn(t.af) || b) : Math.max(ra, st); if (rb > st) rb = st; croSpread(sr, KSEM, ra, rb, ev); croSpread(mr, KMES, ra, rb, ev); }
  });
  Object.keys(mc).forEach(function (u) {
    var L = porMacro[u] || [], tot = L.reduce(function (a, t) { return a + num(t.bc); }, 0), m = by[u];
    if (!mc[u]) return;
    if (!L.length) { if (m) croSpread(mcd, KMES, dn(m.i), dn(m.f), mc[u]); return; }
    L.forEach(function (t) { croSpread(mcd, KMES, dn(t.i), dn(t.f), mc[u] * (tot ? num(t.bc) / tot : 1 / L.length)); });
  });
  var raiz0 = T.filter(function (t) { return t.p === -1 || !by[t.p]; })[0] || T[0], tot = N[raiz0.u];
  var semanas = [], w; if (ini != null) for (w = segunda(ini); w <= fim; w += 7) semanas.push(w);
  var acc = function (m, ks) { var a = 0; return ks.map(function (k) { a += m[k] || 0; return a; }); };
  var meses = [], mi; if (ini != null) for (mi = miDe(ini); mi <= miDe(fim); mi++) meses.push(mi);
  /* custo indireto (CPU – Permanência) do próprio projeto, por mês */
  var mci = {}, ciTot = 0;
  /* atividades geradas pelo próprio cronograma (cro) repetem o custo direto das CPUs: ficam fora do indireto */
  try { if (p.atividades && p.atividades.some(function (a) { return !a.cro; })) { var cc = calc(p), gera = {}; p.atividades.forEach(function (a) { if (a.cro) gera[a.id] = 1; }); cc.res.rows.forEach(function (r) { if (gera[r.ativ] || !r.geral) return; ciTot += r.geral; mci[r.mi] = (mci[r.mi] || 0) + r.geral; if (meses.indexOf(r.mi) < 0) meses.push(r.mi); }); meses.sort(function (a, b) { return a - b; }); } } catch (e) { console.error(e); }
  /* programa (projeto-pai): o custo vem das subestações (projetos-filho), cada uma com o seu controle */
  croFilhos(p).forEach(function (f) { try { calc(f).res.rows.forEach(function (r) { if (!r.geral) return; ciTot += r.geral; mci[r.mi] = (mci[r.mi] || 0) + r.geral; if (meses.indexOf(r.mi) < 0) meses.push(r.mi); }); meses.sort(function (a, b) { return a - b; }); } catch (e) { console.error(e); } });
  var cdTot = Object.keys(mc).reduce(function (a, u) { return a + mc[u]; }, 0);
  p._croCalc = { by: by, kids: kids, leaves: leaves, macro: macro, lm: lm, N: N, raiz: raiz0, tot: tot, st: st, ini: ini, fim: fim, mc: mc, porMacro: porMacro, cdTot: cdTot, ciTot: ciTot,
    semanas: semanas, sP: acc(sp, semanas), sT: acc(st_, semanas), sR: acc(sr, semanas), meses: meses, mP: mp, mT: mt, mR: mr, mCD: mcd, mCI: mci, cpuUnit: cpuUnit, X: X };
  return p._croCalc;
}
function croPct(n, k) { return n.v ? n[k] / n.v : n.du ? n['d' + k] / n.du : 0; }
function croResultado(p, R) {
  var P = croParam(p), V = R.tot.v, imp = V * num(P.imp), tac = V * num(P.tac), antes = V - imp - R.cdTot - R.ciTot - tac;
  var baseC = P.base === 'PRESUMIDO' ? V * num(P.presCsll) : Math.max(0, antes), baseI = P.base === 'PRESUMIDO' ? V * num(P.presIr) : Math.max(0, antes);
  var csll = baseC * num(P.csll), ir = baseI * num(P.ir), liq = antes - csll - ir;
  return { V: V, imp: imp, rl: V - imp, cd: R.cdTot, ci: R.ciTot, tac: tac, antes: antes, csll: csll, ir: ir, liq: liq };
}

/* ---------- tela: cronograma físico ---------- */
function croPrecisa(p, nome) {
  if (!p.crono) return titulo(nome) + '<div class="vazio"><h3>Este projeto não tem cronograma</h3>' + (podeEditar() ? (cfgFalta(p).length ? '<p><b>Antes de iniciar, complete a configuração do projeto</b> (Dados do projeto):</p><ul style="text-align:left;display:inline-block;margin:4px 0 12px">' + cfgFalta(p).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul><p><button class="bt" ' + h(function () { S.v.aba = 'CONFIG'; S.v.cfg = 'proj'; agendar(); }) + '>Abrir a configuração do projeto</button></p><p style="margin-top:10px">' : '<p><button class="bt" data-tip="EAP padrão OP da categoria (base: UFV Paraíso e UFV Seriemas), com predecessoras, linha de base e composições ligadas" ' + h(function () { var n = croGerarPadrao(p); if (n) { var fc = String(p.crono.fim || '').slice(0, 10), tc = (p.contrato || {}).termino || ''; msgbox('SUCESSO!', 'Cronograma padrão gerado com ' + int(n) + ' tarefas. Revise durações e composições na guia Relacionamento.' + (tc && fc > tc ? '\n\nATENÇÃO: o término calculado (' + fdate(E.day(fc)) + ') passa do término contratual (' + fdate(E.day(tc)) + '). Ajuste ritmo, durações ou frentes.' : '')); agendar(); } }) + '>Gerar cronograma padrão – ' + esc(tipoNome(p)) + '</button></p><p style="margin-top:10px">Ou: ') + 'Importe o cronograma salvo no MS Project como XML (Arquivo › Salvar como › XML). ' + croImportarBtn() + (p.atividades.length ? ' ou <button class="bt" data-tip="Monta o cronograma na EAP padrão OP Consulting com as atividades e datas da CPU – Permanência; a venda da linha de base é o custo ÷ (1 − margem-alvo)" ' + h(function () { var n = croDeFin(p); msgbox(n ? 'SUCESSO!' : 'ATENÇÃO!', n ? 'Cronograma gerado com ' + n + ' tarefas.' : 'As atividades não têm custo nem datas.'); agendar(); }) + '>Gerar pelas atividades (FIN)</button>' : '') : 'O administrador ainda não importou o cronograma deste projeto.') + '</div>';
  if (p._croErr) return titulo(nome) + '<div class="vazio">Não foi possível carregar o cronograma: ' + esc(p._croErr) + '</div>';
  if (!p._cro) { croCarregar(p); return titulo(nome) + '<div class="vazio">Carregando o cronograma (' + int(p.crono.n) + ' tarefas)…</div>'; }
  return null;
}
function croStatusCampo(p, R) {
  var ed = podeEditar();
  return '<label class="cro-st">Data de status ' + (ed ? '<input type="date" value="' + isoDia(R.st) + '" ' + h(function (el) { if (!el.value) return; p.crono.status = el.value + 'T17:00'; salvarMeta(p); croMudou(p); agendar(); }) + '>' : '<b>' + fdate(Math.floor(R.st)) + '</b>') + '</label>';
}
function shCro(p) {
  var w = croPrecisa(p, 'CRONOGRAMA FÍSICO'); if (w) return w;
  var V = S.v.cro || (S.v.cro = { vis: 'E', nivel: 3, exp: {}, busca: '', macros: false });
  var R = croCalc(p), ed = podeEditar(), tot = R.tot;
  var tabs = '<div class="tabs" role="tablist">' + [['E', 'EAP e Gantt'], ['S', 'Curva S'], ['R', 'Venda × custo × resultado']].map(function (a) { return '<button role="tab" aria-selected="' + (V.vis === a[0]) + '" class="' + (V.vis === a[0] ? 'on' : '') + '" ' + h(function () { V.vis = a[0]; agendar(); }) + '>' + a[1] + '</button>'; }).join('') + '</div>';
  var s = titulo('CRONOGRAMA FÍSICO', tabs + croStatusCampo(p, R) + '<button class="bxl" data-tip="Arquivo do MS Project (.xml com EAP, vínculos, linha de base, % e calendário). Abra no Project e use Salvar como › .mpp" ' + h(function () { croExportar(p); }) + '>' + XL_IC + 'MS Project</button><button class="bxl" data-tip="Cronograma completo em Excel, com predecessoras e sucessoras" ' + h(function () { croExcel(p); }) + '>' + XL_IC + 'Excel</button>' + (ed ? croImportarBtn() : ''));
  var pv = croPct(tot, 'pv'), ev = croPct(tot, 'ev');
  s += '<div class="gk cro-k">' + croKt('Avanço previsto (LB)', pct(pv), 'até ' + fdate(Math.floor(R.st))) + croKt('Avanço real', pct(ev), 'ponderado pelo custo da LB', 'hero') +
    croKt('Desvio', (ev - pv >= 0 ? '+' : '') + nf2.format((ev - pv) * 100) + ' p.p.', 'SPI ' + (pv ? nf2.format(ev / pv) : '–'), ev < pv ? 'ru' : '') +
    croKt('Venda (linha de base)', 'R$ ' + compact(tot.v), 'medido R$ ' + compact(tot.ev)) + croKt('Custo direto (CPU)', 'R$ ' + compact(R.cdTot), int(Object.keys(R.mc).filter(function (u) { return R.mc[u]; }).length) + ' de ' + int(Object.keys(R.macro).length) + ' macroatividades') + '</div>';
  s += V.vis === 'S' ? croCurvaS(p, R) : V.vis === 'R' ? croRes(p, R) : croEap(p, R, V);
  return s;
}
function croKt(rot, val, sub, cls) { return '<div class="kt' + (cls ? ' ' + cls : '') + '"><span>' + rot + '</span><b>' + val + '</b>' + (sub ? '<i>' + sub + '</i>' : '') + '</div>'; }
function croEap(p, R, V) {
  var ed = podeEditar(), b = semAcento(V.busca), C = p._cro, T = C.tasks, by = R.by, vis = [], MAXL = 1500;
  var aberto = function (t) { return V.exp[t.u] != null ? V.exp[t.u] : t.l < V.nivel; };
  if (b) {
    var marca = Object.create(null);
    T.forEach(function (t) { if (semAcento(t.w + ' ' + t.n + ' ' + (t.sc || '')).indexOf(b) >= 0 && (!V.macros || R.macro[t.u])) { var x = t; while (x && !marca[x.u]) { marca[x.u] = 1; x = by[x.p]; } } });
    vis = T.filter(function (t) { return marca[t.u]; });
  } else if (V.macros) vis = T.filter(function (t) { return R.macro[t.u] || (t.s && t.l < 4 && !R.macro[t.u]); });
  else T.forEach(function (t) { var x = by[t.p], ok = true; while (x) { if (!aberto(x)) { ok = false; break; } x = by[x.p]; } if (ok) vis.push(t); });
  var corte = vis.length > MAXL; if (corte) vis = vis.slice(0, MAXL);
  var a0 = Math.min(R.ini, dn(p.crono.inicio) || R.ini), a1 = R.fim, span = Math.max(1, a1 - a0), X = function (d) { return Math.max(0, Math.min(100, (d - a0) / span * 100)); };
  var s = '<div class="cpu-lb"><input id="cro-busca" type="search" placeholder="Localizar EAP, tarefa ou local…" aria-label="Localizar" data-live="1" value="' + esc(V.busca) + '" ' + h(function (el) { V.busca = el.value; agendar(); }) + '>' +
    '<span class="nv" data-tip="Níveis da EAP">' + [1, 2, 3, 4, 5, 6, 7, 8].map(function (n) { return '<button class="' + (V.nivel === n && !V.macros ? 'on' : '') + '" ' + h(function () { V.nivel = n; V.exp = {}; V.macros = false; agendar(); }) + '>' + n + '</button>'; }).join('') + '</span>' +
    '<button class="lk' + (V.macros ? ' on' : '') + '" ' + h(function () { V.macros = !V.macros; agendar(); }) + '>' + (V.macros ? 'Mostrar EAP completa' : 'Só macroatividades') + '</button></div>';
  var LG = croLig(p, R);
  s += '<div class="tw" id="tw-cro"><table class="g cro"><thead><tr><th>Nº</th><th style="min-width:88px">EAP</th><th style="min-width:340px">TAREFA</th><th>DUR. (d)</th><th>INÍCIO LB</th><th>TÉRMINO LB</th><th>INÍCIO</th><th>TÉRMINO</th><th style="min-width:120px">PREDECESSORAS</th><th style="min-width:120px">SUCESSORAS</th><th>PESO</th><th>PREV.</th><th>REAL</th><th>DESVIO</th><th>VENDA LB (R$)</th><th>CUSTO CPU (R$)</th><th>MARGEM</th><th style="min-width:240px">GANTT <i class="cro-leg"><b style="background:' + CRO_COR.lb + '"></b>LB <b style="background:' + CRO_COR.at + '"></b>atual <b style="background:' + CRO_COR.re + '"></b>real</i></th></tr></thead><tbody>';
  var stx = X(R.st);
  vis.forEach(function (t) {
    var n = R.N[t.u], tem = R.kids[t.u] && R.kids[t.u].length, ab = tem && (b || V.macros ? true : aberto(t)), mac = R.macro[t.u], pvp = croPct(n, 'pv'), evp = croPct(n, 'ev');
    var nl = (C.cpus.links[t.u] || []).length, mg = n.v && n.cd ? (n.v - n.cd) / n.v : null;
    var bi = dn(t.bi), bf = dn(t.bf), ai = dn(t.i), af = dn(t.f);
    var g = '<div class="gt">' + (bi != null ? '<i class="lb" style="left:' + X(bi) + '%;width:' + Math.max(0.3, X(bf) - X(bi)) + '%"></i>' : '') + '<i class="at' + (t.s ? ' sm' : '') + '" style="left:' + X(ai) + '%;width:' + Math.max(0.3, X(af) - X(ai)) + '%"><u style="width:' + Math.min(100, evp * 100) + '%"></u></i><i class="sd" style="left:' + stx + '%"></i></div>';
    s += '<tr class="' + (t.l <= 1 ? 'gr' : t.s ? (mac ? 'mc' : 'sm') : '') + '"><td class="n vz">' + LG.id[t.u] + '</td><td>' + esc(t.w) + '</td><td class="cro-n" style="padding-left:' + (6 + Math.max(0, t.l - 1) * 12) + 'px">' +
      (tem && !b && !V.macros ? '<button class="tg" aria-label="' + (ab ? 'Recolher' : 'Expandir') + '" ' + h(function () { V.exp[t.u] = !ab; agendar(); }) + '>' + (ab ? '▾' : '▸') + '</button>' : '<span class="tg"></span>') +
      (t.m ? '◆ ' : '') + esc(t.n) + (mac ? ' <button class="cro-cpu' + (nl ? ' on' : '') + '" data-tip="CPUs desta macroatividade" ' + h(function () { S.v.dlg = { tipo: 'croCpu', u: t.u, novo: '' }; agendar(); }) + '>CPU' + (nl ? ' ' + nl : '') + '</button>' : '') + '</td>' +
      '<td class="n">' + nfq.format(num(t.dm) / (num(p.crono.mpd) || 480)) + '</td><td class="c">' + (bi != null ? fdate(Math.floor(bi)) : '') + '</td><td class="c">' + (bf != null ? fdate(Math.floor(bf)) : '') + '</td><td class="c">' + fdate(Math.floor(ai)) + '</td><td class="c">' + fdate(Math.floor(af)) + '</td>' + croLigTd(LG.pre[t.u]) + croLigTd(LG.suc[t.u]) +
      '<td class="n">' + (R.tot.v ? nf2.format(n.v / R.tot.v * 100) + '%' : '') + '</td><td class="n">' + pct(pvp) + '</td>' +
      (!t.s && podeEditar() ? cel('crp' + t.u, realDe(t) / 100, function (v) { croAvanco(p, t, v, R); }, { t: 'pct', rot: 'Avanço real', cls: 'cro-r' }) : '<td class="n k">' + pct(evp) + '</td>') +
      '<td class="n' + (evp < pvp - 0.0005 ? ' pico' : '') + '">' + nf2.format((evp - pvp) * 100) + '</td><td class="n">' + zero(n.v, money) + '</td><td class="n">' + zero(n.cd, money) + '</td><td class="n' + (mg != null && mg < 0 ? ' pico' : '') + '">' + (mg == null ? '' : pct(mg)) + '</td><td class="gtc">' + g + '</td></tr>';
  });
  s += '</tbody></table></div><div class="nota">' + (corte ? '<b class="pico">Mostrando as primeiras ' + MAXL + ' linhas; use os níveis ou a busca.</b> ' : '') + int(T.length) + ' tarefas · ' + int(R.leaves.length) + ' de execução · ' + int(Object.keys(R.macro).length) + ' macroatividades (botão CPU). ' +
    'Peso, previsto e real são ponderados pelo custo da linha de base (venda); tarefas sem custo pesam pela duração. ' + 'Vínculos (Nº da tarefa + tipo): TI término-início · II início-início · TT término-término · IT início-término; +2d/-1d = folga em dias úteis. ' + (podeEditar() ? 'O avanço real é lançado nas tarefas de execução (coluna REAL).' : '') + '</div>';
  return s;
}
function croAvanco(p, t, v, R) {
  v = Math.max(0, Math.min(1, num(v))); var pc = Math.round(v * 1000) / 10, sti = isoDia(R.st);
  t.pf = pc; t.pc = pc;
  if (pc > 0 && !t.as) t.as = (t.i && dn(t.i) <= R.st ? t.i.slice(0, 10) : sti) + 'T07:00';
  if (pc === 0) { delete t.as; delete t.af; }
  if (pc >= 100) { if (!t.af) t.af = sti + 'T17:00'; } else delete t.af;
  croSalvarT(p, t);
}
function dlgCroCpu(d) {
  var p = proj(), R = croCalc(p), t = R.by[d.u], C = p._cro, L = C.cpus.links[d.u] || (C.cpus.links[d.u] = []), ed = podeEditar(), X = R.X, n = R.N[d.u];
  var fechar = function () { if (!L.length) delete C.cpus.links[d.u]; S.v.dlg = null; agendar(); }, sv = function () { croSalvarDoc(p, 'cpus'); };
  var tot = 0, linhas = L.map(function (l, i) {
    var c = X.by[l.c], u = c ? cpuCalc(c, X).tot : 0, v = num(l.q) * u; tot += v;
    return '<tr>' + (ed ? '<td class="x" ' + h(function () { L.splice(i, 1); sv(); agendar(); }) + '>×</td>' : '') + '<td>' + esc(l.c) + '</td><td class="w">' + (c ? esc(c.d) : '<b class="pico">CPU não encontrada</b>') + '</td><td class="c">' + (c ? esc(c.u) : '') + '</td>' +
      cel('ccq' + i, l.q, ed ? function (v2) { l.q = v2; sv(); } : null, { t: 'num', rot: 'Quantidade' }) + '<td class="n k">' + money(u) + '</td><td class="n k">' + money(v) + '</td></tr>';
  }).join('');
  var dl = '<datalist id="dl-crocpu">' + X.comps.map(function (c) { return '<option value="' + esc(c.c + ' | ' + c.d) + '">'; }).join('') + '</datalist>';
  var add = ed ? '<div class="cro-add"><input id="cro-novacpu" type="text" list="dl-crocpu" placeholder="Código ou descrição da CPU… (Enter para incluir)" aria-label="Adicionar CPU" data-enter="1" value="' + esc(d.novo) + '" ' + h(function (el) {
    var v = el.value.trim(); if (!v) return; var cod = v.split(' | ')[0].trim(), c = X.by[cod] || X.comps.filter(function (y) { return semAcento(y.d) === semAcento(v); })[0];
    if (!c) { d.novo = v; return msgbox('AVISO!', 'CPU não encontrada: ' + v); }
    L.push({ c: c.c, q: 1 }); d.novo = ''; sv(); abrirDepois = 'ccq' + (L.length - 1); agendar();
  }) + '>' + dl + '</div>' : '';
  var mg = n.v - tot;
  return janela('CPUs da macroatividade', '<div><b>' + esc(t.w) + '</b> · ' + esc(t.n) + '<br><span class="vz">' + fdate(Math.floor(dn(t.i))) + ' a ' + fdate(Math.floor(dn(t.f))) + ' · ' + int((R.porMacro[d.u] || []).length) + ' tarefa(s) de execução</span></div>' +
    '<div class="impq"><div><b>R$ ' + compact(n.v) + '</b><span>venda (linha de base)</span></div><div><b>R$ ' + compact(tot) + '</b><span>custo direto (CPU)</span></div><div class="' + (mg < 0 ? 'er' : '') + '"><b>' + (n.v ? pct(mg / n.v) : '–') + '</b><span>margem bruta</span></div></div>' +
    '<div class="tw" style="max-height:300px"><table class="g" style="width:100%"><thead><tr>' + (ed ? '<th></th>' : '') + '<th>CPU</th><th>DESCRIÇÃO</th><th>UND</th><th>QUANTIDADE</th><th>CUSTO UNIT. (R$)</th><th>TOTAL (R$)</th></tr></thead><tbody>' + (linhas || '<tr><td colspan="7" class="vz">Nenhuma CPU vinculada.</td></tr>') + '</tbody></table></div>' + add +
    '<div class="nota" style="margin:0">O custo é distribuído no tempo pelas datas atuais das tarefas de execução da macroatividade, na proporção do custo da linha de base de cada uma.</div><div class="bts">' + bt('FECHAR', fechar) + '</div>', 820, fechar);
}

/* ---------- curva S ---------- */
function croCurvaS(p, R) {
  var W = 980, H = 330, ml = 46, mr = 14, mt = 14, mb = 34, tot = R.tot.v || 1, n = R.semanas.length;
  if (!n) return '<div class="vazio">Sem datas no cronograma.</div>';
  var x = function (i) { return ml + (W - ml - mr) * (n > 1 ? i / (n - 1) : 0); }, y = function (v) { return mt + (H - mt - mb) * (1 - v / tot); };
  var ln = function (arr, cor, dash, ate) { var pts = []; arr.forEach(function (v, i) { if (ate != null && R.semanas[i] > ate + 6) return; pts.push(x(i).toFixed(1) + ',' + y(v).toFixed(1)); }); return '<polyline fill="none" stroke="' + cor + '" stroke-width="2.4"' + (dash ? ' stroke-dasharray="6 4"' : '') + ' points="' + pts.join(' ') + '"/>'; };
  var g = '';
  for (var k = 0; k <= 4; k++) { var yy = y(tot * k / 4); g += '<line x1="' + ml + '" x2="' + (W - mr) + '" y1="' + yy + '" y2="' + yy + '" stroke="#e8edf4"/><text x="' + (ml - 6) + '" y="' + (yy + 4) + '" text-anchor="end">' + (k * 25) + '%</text>'; }
  var ultMes = -1; R.semanas.forEach(function (w, i) { var mi = miDe(w); if (mi !== ultMes && (mi % 3 === 0 || n < 40)) { ultMes = mi; g += '<text x="' + x(i) + '" y="' + (H - 12) + '" text-anchor="middle">' + mmaa(mi) + '</text>'; } else if (mi !== ultMes) ultMes = mi; });
  var si = 0; R.semanas.forEach(function (w, i) { if (w <= R.st) si = i; });
  g += '<line x1="' + x(si) + '" x2="' + x(si) + '" y1="' + mt + '" y2="' + (H - mb) + '" stroke="' + CRO_COR.st + '" stroke-dasharray="3 3"/><text class="f" x="' + (x(si) + 4) + '" y="' + (mt + 10) + '">status</text>';
  g += ln(R.sP, CRO_COR.lb, true) + ln(R.sT, CRO_COR.at) + ln(R.sR, CRO_COR.re, false, R.st);
  var s = '<div class="gc gra" style="margin-top:0"><h3>Curva S física (ponderada pelo custo da linha de base)</h3><div class="gleg"><span><i style="background:' + CRO_COR.lb + '"></i>Previsto (linha de base)</span><span><i style="background:' + CRO_COR.at + '"></i>Tendência (cronograma atual)</span><span><i style="background:' + CRO_COR.re + '"></i>Real (até a data de status)</span></div><div class="gsvg"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Curva S">' + g + '</svg></div></div>';
  /* tabela mensal */
  var a = { p: 0, t: 0, r: 0 };
  s += '<div class="tw" id="tw-cros" style="margin-top:14px"><table class="g"><thead><tr><th>MÊS</th><th>PREVISTO MÊS</th><th>PREVISTO ACUM.</th><th>TENDÊNCIA MÊS</th><th>TENDÊNCIA ACUM.</th><th>REAL MÊS</th><th>REAL ACUM.</th><th>VENDA PREVISTA (R$)</th><th>VENDA MEDIDA (R$)</th></tr></thead><tbody>';
  R.meses.forEach(function (mi) {
    var vp = R.mP[mi] || 0, vt = R.mT[mi] || 0, vr = R.mR[mi] || 0; a.p += vp; a.t += vt; a.r += vr; var fut = miIni(mi) > R.st;
    s += '<tr><td class="c">' + mmaa(mi) + '</td><td class="n">' + pct(vp / tot) + '</td><td class="n k">' + pct(a.p / tot) + '</td><td class="n">' + pct(vt / tot) + '</td><td class="n k">' + pct(a.t / tot) + '</td><td class="n">' + (fut ? '' : pct(vr / tot)) + '</td><td class="n k">' + (fut ? '' : pct(a.r / tot)) + '</td><td class="n">' + money(vp) + '</td><td class="n">' + (fut ? '' : money(vr)) + '</td></tr>';
  });
  return s + '</tbody></table></div>';
}

/* ---------- venda × custo × resultado ---------- */
function croRes(p, R) {
  var P = croParam(p), ed = podeEditar(), D = croResultado(p, R), sv = function () { croSalvarDoc(p, 'param'); };
  var pc = function (id, rot, k, tip) { return '<label><span>' + rot + '</span>' + (ed ? '<input id="' + id + '" type="text" inputmode="decimal" value="' + nf2.format(num(P[k]) * 100).replace(/\./g, '') + '" ' + h(function (el) { P[k] = parseNum(el.value) / 100; sv(); agendar(); }) + '>' : '<output>' + pct(P[k]) + '</output>') + (tip ? '<small>' + tip + '</small>' : '') + '</label>'; };
  var s = '<div class="cs cpuf"><h3>Parâmetros do resultado</h3><div class="cpuf-g cro-par">' + pc('cr-imp', 'Impostos sobre faturamento (%)', 'imp', 'PIS + COFINS + ISS') + pc('cr-tac', 'TAC – administração central (%)', 'tac', 'sobre a venda') +
    '<label><span>Base de CSLL e IR</span>' + (ed ? escolha('cr-base', P.base, ['REAL', 'PRESUMIDO'], function (v) { P.base = v || 'REAL'; sv(); }, { rotulos: { REAL: 'Lucro real (sobre o resultado)', PRESUMIDO: 'Lucro presumido (sobre a receita)' } }) : '<output>' + P.base + '</output>') + '</label>' +
    pc('cr-csll', 'CSLL (%)', 'csll') + pc('cr-ir', 'IR – IRPJ + adicional (%)', 'ir') + (P.base === 'PRESUMIDO' ? pc('cr-pc', 'Presunção CSLL (%)', 'presCsll') + pc('cr-pi', 'Presunção IR (%)', 'presIr') : '') +
    pc('cr-mg', 'Margem-alvo (%)', 'margem', 'define o custo-meta') +
    '<label><span>Potência (MWp)</span>' + (ed ? '<input id="cr-mwp" type="text" inputmode="decimal" value="' + nf2.format(num(P.mwp)).replace(/\./g, '') + '" ' + h(function (el) { P.mwp = parseNum(el.value); if (P.mwp > 0 && (!P.regras || !P.regras.length)) P.regras = window.OPPadrao.regrasPadrao(); sv(); agendar(); }) + '>' : '<output>' + nf2.format(num(P.mwp)) + '</output>') + '<small>base das CPUs paramétricas</small></label>' +
    '<label><span>Sigla do projeto</span>' + (ed ? campo('cr-sig', P.sigla, function (v) { P.sigla = semAcento(v).replace(/[^A-Z0-9]/g, '').slice(0, 6) || P.sigla; sv(); }, { upper: true }) : '<output>' + esc(P.sigla) + '</output>') + '<small>prefixo das CPUs do projeto</small></label></div>' +
    (ed ? '<div class="cpu-bt" style="margin:12px 0 0"><button class="bt" data-tip="Refaz as CPUs do projeto: paramétricas por MWp onde há CPU correspondente na biblioteca e custo-meta nas demais" ' + h(function () { confirma('Recriar as CPUs do projeto ' + P.sigla + ' (uma por macroatividade)?\n\nAs CPUs ' + P.sigla + '-… são refeitas com os indicadores atuais. Vínculos manuais com outras CPUs são mantidos.', function () { var n = croRecriarCpus(p); msgbox('SUCESSO!', n + ' CPU(s) do projeto recriadas.'); }); }) + '>Recriar CPUs do projeto</button><button class="bt" data-tip="Refaz no Cronograma financeiro e na CPU – Permanência as atividades do custo direto: CPUs de cada macroatividade × datas da linha de base" ' + h(function () { var n = croGerarFin(p); msgbox('SUCESSO!', n + ' linha(s) de custo direto lançadas no Cronograma financeiro (FIN).'); }) + '>Atualizar FIN / Permanência</button></div>' : '') + '</div>';
  var lin = function (rot, v, cls, nota) { return '<tr class="' + (cls || '') + '"><td>' + rot + '</td><td class="n">' + money(v) + '</td><td class="n">' + (D.V ? pct(v / D.V) : '') + '</td><td class="vz">' + (nota || '') + '</td></tr>'; };
  s += '<div style="display:grid;gap:16px"><div class="gc" style="margin-top:0;max-width:900px"><h3>Resultado do projeto</h3><table class="g cro-dre" style="width:100%"><thead><tr><th class="l">DEMONSTRATIVO</th><th>R$</th><th>% VENDA</th><th class="l">ORIGEM</th></tr></thead><tbody>' +
    lin('Venda (custo da linha de base do MS Project)', D.V, 'at', 'soma das tarefas') + lin('(−) Impostos sobre faturamento', -D.imp, '', pct(P.imp)) + lin('Receita líquida', D.rl, 'at') +
    lin('(−) Custos diretos – CPU', -D.cd, '', 'CPUs das macroatividades') + lin('(−) Custos indiretos – permanência', -D.ci, '', 'equipes do projeto (FIN)') + lin('(−) TAC – administração central', -D.tac, '', pct(P.tac)) +
    lin('Resultado antes de CSLL e IR', D.antes, 'at') + lin('(−) CSLL', -D.csll, '', P.base === 'PRESUMIDO' ? 'presumido' : 'lucro real') + lin('(−) IR', -D.ir, '', P.base === 'PRESUMIDO' ? 'presumido' : 'lucro real') +
    lin('RESULTADO LÍQUIDO', D.liq, 'tt') + '</tbody></table></div>';
  /* por macroatividade, agrupado pelo nível 3 */
  var grupos = [], T = p._cro.tasks;
  T.forEach(function (t) { if (R.macro[t.u]) { var g = t; while (R.by[g.p] && R.by[g.p].l >= 3) g = R.by[g.p]; var G = grupos.filter(function (x) { return x.g === g; })[0]; if (!G) grupos.push(G = { g: g, its: [] }); G.its.push(t); } });
  var V = S.v.cro, nsem = 0, mg = num(P.margem), vOwn = function (u) { return (R.porMacro[u] || []).reduce(function (a, t) { return a + num(t.bc); }, 0); }, cOwn = function (u) { return num(R.mc[u]); };
  var tipoCpu = function (u) { var L = p._cro.cpus.links[u] || [], X = R.X, k = { P: 0, M: 0 }; L.forEach(function (l) { var c = X.by[l.c]; (c && c.it || []).forEach(function (x) { if (x.r === 'META') k.M++; else if (x.r) k.P++; }); }); return k.P && k.M ? 'misto' : k.P ? 'paramétrica' : k.M ? 'custo-meta' : L.length ? 'manual' : ''; };
  s += '<div class="gc" style="margin-top:0"><h3>Venda × custo direto por macroatividade</h3><div class="tw" style="max-height:420px"><table class="g" style="width:100%"><thead><tr><th class="l">EAP / MACROATIVIDADE</th><th>VENDA (R$)</th><th>CUSTO CPU (R$)</th><th>CUSTO-META (R$)</th><th>MARGEM</th><th>ORIGEM</th></tr></thead><tbody>';
  grupos.forEach(function (G) {
    var gv = 0, gc = 0; G.its.forEach(function (t) { gv += vOwn(t.u); gc += cOwn(t.u); if (!cOwn(t.u) && vOwn(t.u)) nsem++; });
    var ab = V.resExp && V.resExp[G.g.u];
    s += '<tr class="co"><td><button class="tg" ' + h(function () { V.resExp = V.resExp || {}; V.resExp[G.g.u] = !ab; agendar(); }) + '>' + (ab ? '▾' : '▸') + '</button>' + esc(G.g.w + ' ' + G.g.n) + ' (' + G.its.length + ')</td><td class="n">' + money(gv) + '</td><td class="n">' + money(gc) + '</td><td class="n">' + money(gv * (1 - mg)) + '</td><td class="n">' + (gv && gc ? pct((gv - gc) / gv) : '–') + '</td><td></td></tr>';
    if (ab) G.its.forEach(function (t) { var v = vOwn(t.u), c = cOwn(t.u); s += '<tr><td class="cro-n" style="padding-left:26px">' + esc(t.w + ' ' + t.n) + ' <button class="cro-cpu' + ((p._cro.cpus.links[t.u] || []).length ? ' on' : '') + '" ' + h(function () { S.v.dlg = { tipo: 'croCpu', u: t.u, novo: '' }; agendar(); }) + '>CPU</button></td><td class="n">' + money(v) + '</td><td class="n">' + (c ? money(c) : '<span class="vz">sem CPU</span>') + '</td><td class="n">' + money(v * (1 - mg)) + '</td><td class="n' + (v && c > v ? ' pico' : '') + '">' + (v && c ? pct((v - c) / v) : '–') + '</td><td class="c vz">' + tipoCpu(t.u) + '</td></tr>'; });
  });
  s += '</tbody></table></div><div class="nota">' + nsem + ' macroatividade(s) com venda ainda sem CPU. Custo-meta = venda × (1 − margem-alvo de ' + pct(mg) + '). Origem: paramétrica (quantidades por MWp × CPUs da biblioteca), custo-meta (sem CPU correspondente) ou manual.</div></div></div>';
  s += croParamSec(p, R, P, ed, sv);
  /* fluxo mensal */
  var ac = 0;
  s += '<div class="tw" id="tw-crof" style="margin-top:14px"><table class="g"><thead><tr><th>MÊS</th><th>VENDA LB (R$)</th><th>VENDA TENDÊNCIA (R$)</th><th>IMPOSTOS + TAC (R$)</th><th>CUSTO DIRETO CPU (R$)</th><th>CUSTO INDIRETO (R$)</th><th>RESULTADO DO MÊS (R$)</th><th>ACUMULADO (R$)</th></tr></thead><tbody>';
  R.meses.forEach(function (mi) {
    var vt = R.mT[mi] || 0, it = vt * (num(P.imp) + num(P.tac)), cd = R.mCD[mi] || 0, ci = R.mCI[mi] || 0, r = vt - it - cd - ci; ac += r;
    s += '<tr><td class="c">' + mmaa(mi) + '</td><td class="n">' + money(R.mP[mi] || 0) + '</td><td class="n">' + money(vt) + '</td><td class="n">' + money(it) + '</td><td class="n">' + money(cd) + '</td><td class="n">' + money(ci) + '</td><td class="n' + (r < 0 ? ' pico' : '') + '">' + money(r) + '</td><td class="n k">' + money(ac) + '</td></tr>';
  });
  return s + '</tbody></table></div><div class="nota">Fluxo antes de CSLL e IR: receita pela tendência (cronograma atual), custo direto das CPUs pelas datas atuais e custo indireto pela permanência do projeto (cronograma financeiro).</div>';
}

function croParamSec(p, R, P, ed, sv) {
  if (!P.regras || !P.regras.length) return '<div class="nota">Sem indicadores paramétricos: informe a potência (MWp) para usinas fotovoltaicas. Subestações e projetos sem potência usam o custo-meta.</div>';
  var X = R.X, M = window.OPPadrao, mwp = num(P.mwp);
  var s = '<div class="gc"><h3>Indicadores paramétricos por MWp (referência OP Consulting – revisar com o quantitativo do projeto)</h3><div class="tw" style="max-height:380px"><table class="g" style="width:100%"><thead><tr><th class="l">INDICADOR</th><th>CPU DA BIBLIOTECA</th><th>BASE</th><th>ÍNDICE</th><th>UND</th><th>QUANTIDADE NO PROJETO</th><th>CUSTO UNIT. (R$)</th><th>CUSTO TOTAL (R$)</th><th>USAR</th></tr></thead><tbody>';
  P.regras.forEach(function (r, i) {
    var c = X.by[r.cpu], u = c ? cpuCalc(c, X).tot : 0, q = M.qtdRegra(r, mwp);
    s += '<tr class="' + (r.off ? 'vz' : '') + '"><td>' + esc(r.nome) + '</td><td>' + esc(r.cpu) + (c ? '' : ' <b class="pico">não existe</b>') + '</td><td class="c">' + ({ MWP: '× MWp', RAIZ: '× √MWp', FIXO: 'fixo' }[r.base] || r.base) + '</td>' +
      cel('cpr' + i, r.k, ed ? function (v) { r.k = v; sv(); } : null, { t: 'num', rot: 'Índice' }) + '<td class="c">' + esc(r.un || '') + '</td><td class="n k">' + nfq.format(q) + '</td><td class="n k">' + money(u) + '</td><td class="n k">' + money(q * u) + '</td>' +
      cel('cpo' + i, r.off ? 'NAO' : 'SIM', ed ? function (v) { r.off = v === 'NAO'; sv(); } : null, { ops: ['SIM', 'NAO'], c: true, rot: 'Usar' }) + '</tr>';
  });
  return s + '</tbody></table></div><div class="nota">Após alterar índices, potência ou margem-alvo, clique em “Recriar CPUs do projeto”. A quantidade de cada indicador é distribuída entre as macroatividades correspondentes na proporção da venda.</div></div>';
}
function croMetaIns() {
  var X = cpuDados(); if (X.bi.META) return;
  var e = { id: 'META', c: '', d: 'VERBA - CUSTO-META (VENDA X (1 - MARGEM-ALVO))', u: 'VB', t: 'OUT', g: 'AJUSTES DE ORCAMENTO', p: 1 };
  e.c = cpuCodigoNovo(X, 'OUT', e.g, e); X.ins.push(e); cpuSalvarIns();
}
function croRecriarCpus(p) {
  var P = croParam(p), C = p._cro, X = cpuDados(), M = window.OPPadrao, sig = P.sigla, pre = sig + '-';
  croMetaIns(); X = cpuDados();
  var g = M.gerarCpus(C.tasks, P, sig, function (c) { return !!X.by[c] && cpuCalc(X.by[c], X).tot > 0; });
  /* remove as CPUs antigas do projeto */
  var mud = {};
  cpuChaves().forEach(function (k) { var rows = S.base[k].rows || [], n = rows.length; S.base[k].rows = rows.filter(function (c) { return c.esp || !(c.pj === p.id || String(c.c).indexOf(pre) === 0); }); if (S.base[k].rows.length !== n) mud[k] = 1; });
  Object.keys(g.comps).forEach(function (cod) { var c = g.comps[cod], k = cpuParteLivre(); S.base[k].rows.push(c); mud[k] = 1; });
  Object.keys(mud).forEach(function (k) { salvarBase(k); });
  /* vínculos: troca só os que apontam para CPUs do projeto */
  Object.keys(C.cpus.links).forEach(function (u) { C.cpus.links[u] = (C.cpus.links[u] || []).filter(function (l) { return String(l.c).indexOf(pre) !== 0 || String(l.c).indexOf(pre + 'ESP-') === 0; }); if (!C.cpus.links[u].length) delete C.cpus.links[u]; });
  Object.keys(g.links).forEach(function (u) { C.cpus.links[u] = g.links[u].concat(C.cpus.links[u] || []); });
  croSalvarDoc(p, 'cpus'); croSalvarDoc(p, 'param');
  croMudou(p); croGerarFin(p);
  return Object.keys(g.comps).length;
}

/* ---------- ligação cronograma ↔ CPU – Permanência (FIN, COM, HIS, DET) ---------- */
var CRO_VB = [['MO', 'CUSTO DIRETO CPU - MAO DE OBRA'], ['EQ', 'CUSTO DIRETO CPU - EQUIPAMENTOS'], ['MAT', 'CUSTO DIRETO CPU - MATERIAIS'], ['SER', 'CUSTO DIRETO CPU - SERVICOS'], ['OUT', 'CUSTO DIRETO CPU - VERBAS E OUTROS']];
function croVerbasBase() {
  var k = unificado() ? 'mat' : 'ind', B = S.base[k] || (S.base[k] = { rows: [] }), novo = false; B.rows = B.rows || [];
  CRO_VB.forEach(function (v) { if (!B.rows.some(function (r) { return r.d === v[1]; })) { B.rows.push({ d: v[1], g: 'OUTROS', u: 'VB', vu: 1, loc: 0, dep: 0, out: 0, mob: 0, des: 0, inst: 0, man: 'NAO', tmo: 'N/A', mm: 0, mv: 0, pm: 0, pv: 0, obs: 'Rateio diário do custo direto das CPUs entre o início e o término da linha de base (gerado pelo cronograma)' }); novo = true; } });
  if (novo) salvarBase(k);
}
function croEapNome(op) { var r = ''; window.OPPadrao.EAP.forEach(function (e) { if (e[0] === op) r = e[1]; e[2].forEach(function (x) { if (x[0] === op) r = x[1]; }); }); return r; }
/* custo direto das CPUs de cada macroatividade → linhas de rateio nas datas da linha de base */
function croGerarFin(p) {
  croMudou(p);
  var R = croCalc(p), C = p._cro, M = window.OPPadrao, eap = M.EAP;
  croVerbasBase(); var X = cpuDados();
  /* proteção: com composições relacionadas ausentes do banco, não apaga o cronograma financeiro já gerado */
  var falt = {}; Object.keys(C.cpus.links).forEach(function (u) { (C.cpus.links[u] || []).forEach(function (l) { if (!X.by[l.c]) falt[l.c] = 1; }); });
  var nf = Object.keys(falt); if (nf.length) { aviso('O cronograma financeiro não foi atualizado: ' + nf.length + (nf.length === 1 ? ' composição relacionada não existe' : ' composições relacionadas não existem') + ' no banco de CPUs (ex.: ' + nf.slice(0, 3).join(', ') + '). Recrie as CPUs do projeto no Cronograma físico ou troque a composição no Relacionamento.'); return 0; }
  var antigas = {}; p.atividades.forEach(function (a) { if (a.cro) antigas[a.id] = a; });
  p.atividades = p.atividades.filter(function (a) { return !a.cro; });
  if (!p.atividades.length) { var gs = eap.map(function (e) { return e[1]; }); if (JSON.stringify(p.grupos) !== JSON.stringify(gs)) { p.grupos = gs; salvarMeta(p); } }
  var gi = function (op) { var nome = croEapNome(op.split('.')[0]), i = p.grupos.indexOf(nome); if (i < 0) { p.grupos.push(nome); salvarMeta(p); i = p.grupos.length - 1; } return i + 1; };
  var porOp = {}, nl = 0, ordem = [];
  Object.keys(C.cpus.links).forEach(function (u) {
    var L = C.cpus.links[u] || [], m = R.by[u]; if (!m || !L.length) return;
    var sub = { MO: 0, EQ: 0, MAT: 0, SER: 0, OUT: 0 };
    L.forEach(function (l) {
      var c = X.by[l.c]; if (!c) return; var o = cpuCalc(c, X), q = num(l.q), soma = 0, k;
      CPU_T.forEach(function (t) { soma += num(o.sub[t.t]); });
      if (!o.tot) return;
      if (!soma) { sub.OUT += q * o.tot; return; }
      CPU_T.forEach(function (t) { var v = num(o.sub[t.t]); if (!v) return; k = sub[t.t] != null ? t.t : 'OUT'; sub[k] += q * o.tot * v / soma; });
    });
    /* datas da linha de base da macroatividade (sem linha de base, as datas atuais) */
    var lv = R.porMacro[u] || [m], a = null, b = null;
    lv.forEach(function (t) { var x = E.day(String(t.bi || t.i || '').slice(0, 10)), y = E.day(String(t.bf || t.f || '').slice(0, 10)); if (x != null && (a == null || x < a)) a = x; if (y != null && (b == null || y > b)) b = y; });
    if (a == null || b == null) return;
    var op = M.bucketDe(m, R.by) || M.classe(m.n) || '4', A = porOp[op];
    if (!A) { var id = p.id + '-c' + op.replace(/\./g, '-'); A = porOp[op] = { id: id, cro: 1, op: op, grupo: gi(op), ordem: 0, nome: croEapNome(op), uni: 'VB', qtd: 1, equipes: 1, trecho: 'N/A', cc: (p.sigla || croParam(p).sigla) + '-' + op + ' - ' + croEapNome(op), linhas: [] }; ordem.push(A); }
    CRO_VB.forEach(function (v) { var val = Math.round(sub[v[0]] * 100) / 100; if (!val) return; A.linhas.push({ id: A.id + '-' + u + '-' + v[0], c: 5, d: v[1], q: val, rel: E.REL_RATEIO, ini: E.iso(a), fim: E.iso(Math.max(a, b)), ident: (L[0] || {}).c || '', info: (m.w ? m.w + ' ' : '') + m.n, status: '', obs: 'gerado do cronograma' }); nl++; });
  });
  ordem.sort(function (a, b) { return cpuCmp(a.op, b.op); }).forEach(function (A, i) { A.ordem = 1000 + i; if (!A.linhas.length) return; p.atividades.push(A); salvarAtiv(p, A); delete antigas[A.id]; });
  Object.keys(antigas).forEach(function (id) { apagarAtiv(p, antigas[id]); });
  limpaCache(p.id); croMudou(p); agendar();
  return nl;
}
/* projeto sem cronograma: monta a EAP padrão com as atividades da CPU – Permanência */
var CRO_GRUPO_OP = { 'ESTRUTURA GERAL PROJETO': '1.1', 'SERVICOS PRELIMINARES': '4.1', 'ADMINISTRACAO': '1.3', 'CANTEIROS': '4.1', 'OBRA CIVIL': '4.2', 'MONTAGEM ELETROMECANICA': '4.3', 'COMISSIONAMENTO': '5', 'SERVICOS ESPECIAIS': '4.4', 'FORNECIMENTO MATERIAIS': '3', 'INDIRETOS': '1.3' };
function croDeFin(p, opc) {
  opc = opc || {};
  var c = calc(p), M = window.OPPadrao, mg = opc.margem != null ? opc.margem : 0.15, gr = gruposDe(p), conc = p.fase === 'CONCLUIDA';
  var As = c.fin.linhas.filter(function (l) { return l.tipo === 'a' && l.ini != null && l.fim != null && l.total > 0; });
  if (!As.length) return 0;
  var cal = E.calendar(p, ctxDe(p)), hh = function (d, h) { return E.iso(d) + 'T' + h; }, ini = Math.min.apply(null, As.map(function (l) { return l.ini; })), fim = Math.max.apply(null, As.map(function (l) { return l.fim; }));
  var folha = function (n, a, b, bc) { var dm = Math.max(0, cal.uteis(a, b)) * 480, i = hh(a, '08:00'), f = hh(b, '17:00'); if (a === b && !bc) { dm = 0; f = i; } return { n: n, i: i, f: f, dm: dm, bi: i, bf: f, bdm: dm, bc: Math.round(bc * 100) / 100, pc: conc ? 100 : 0, pf: conc ? 100 : 0, as: conc ? i : undefined, af: conc ? f : undefined, m: dm === 0 ? 1 : undefined }; };
  var filhos = {};
  var poe = function (op, t) { (filhos[op] = filhos[op] || []).push(t); };
  poe('1.1', folha('INÍCIO DA OBRA', ini, ini, 0));
  As.forEach(function (l) { var gn = gr[l.g - 1] || '', op = CRO_GRUPO_OP[gn] || M.classe(gn + ' ' + l.nome) || '4.4'; var fo = folha((l.nome || l.cc || 'ATIVIDADE') + (l.cc && l.cc !== l.nome ? ' | ' + l.cc : ''), l.ini, l.fim, l.total / (1 - mg)); if (l.trecho && l.trecho !== 'N/A') { fo.sp = l.trecho; fo.sc = l.trecho; } fo.ds = gn; poe(op, fo); });
  poe('6', folha('TÉRMINO DA OBRA', fim, fim, 0));
  var T = [], u = 0, root = { u: u++, w: '0', n: 'CRONOGRAMA ' + p.nome, l: 0, p: -1, s: 1 }; T.push(root);
  var resume = function (t, kids) { var a = null, b = null, v = 0, dm = 0; kids.forEach(function (k) { if (!a || k.i < a) a = k.i; if (!b || k.f > b) b = k.f; v += num(k.bc); }); t.i = t.bi = a; t.f = t.bf = b; t.bc = Math.round(v * 100) / 100; t.dm = t.bdm = Math.max(0, cal.uteis(E.day(a.slice(0, 10)), E.day(b.slice(0, 10)))) * 480; t.pc = t.pf = conc ? 100 : 0; if (conc) { t.as = a; t.af = b; } };
  var n1 = 0;
  M.EAP.forEach(function (e) {
    var sub = e[2].filter(function (x) { return filhos[x[0]]; }), direto = filhos[e[0]] || [];
    if (!sub.length && !direto.length) return;
    var t1 = { u: u++, w: e[0], n: e[1], l: 1, p: root.u, s: 1, op: e[0] }; T.push(t1); var k1 = [], n2 = 0;
    var folhas = function (pai, lista, kk) { var n3 = 0; lista.forEach(function (f) { f.u = u++; f.w = pai.w + '.' + (++n3); f.l = pai.l + 1; f.p = pai.u; T.push(f); kk.push(f); }); };
    if (direto.length) { folhas(t1, direto, k1); n2 = direto.length; }
    sub.forEach(function (x) { var t2 = { u: u++, w: x[0], n: x[1], l: 2, p: t1.u, s: 1, op: x[0] }; T.push(t2); var k2 = []; folhas(t2, filhos[x[0]], k2); resume(t2, k2); k1.push(t2); });
    resume(t1, k1);
  });
  resume(root, T.filter(function (t) { return t.l === 1; }));
  T.forEach(function (t) { Object.keys(t).forEach(function (k) { if (t[k] === undefined) delete t[k]; }); });
  var meta = { titulo: root.n, inicio: root.i, fim: root.f, status: conc ? root.f : hh(E.day(new Date().toISOString()), '17:00'), n: T.length, mpd: 480, mpw: 2640, dpm: 20, cal: 1, gerado: 'FIN' };
  p._cro = null; croGravarTudo(p, { tasks: T, cal: '', meta: meta, arq: 'gerado pelas atividades (CPU – Permanência)' });
  var P = croParam(p); P.margem = mg; P.mwp = 0; P.regras = []; P.sigla = String(p.id).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); P.gerado = 'FIN'; croSalvarDoc(p, 'param');
  croMudou(p); return T.length;
}
/* completa a linha de base: tarefas sem LB recebem as datas atuais; venda-alvo distribuída pela duração nas tarefas sem custo */
function croCompletarLb(p, alvo) {
  var C = p._cro, T = C.tasks, folhas = T.filter(function (t) { return !t.s; }), mud = {}, nDt = 0;
  folhas.forEach(function (t) { if (!t.bi && t.i) { t.bi = t.i; t.bf = t.f; t.bdm = t.dm; mud[t._k] = 1; nDt++; } });
  var tem = folhas.reduce(function (a, t) { return a + num(t.bc); }, 0), resto = num(alvo) - tem;
  if (alvo && resto > 1) {
    var sem = folhas.filter(function (t) { return !num(t.bc) && num(t.dm) > 0; }), du = sem.reduce(function (a, t) { return a + num(t.dm); }, 0);
    if (!du) { sem = folhas.filter(function (t) { return num(t.dm) > 0; }); du = sem.reduce(function (a, t) { return a + num(t.dm); }, 0); }
    sem.forEach(function (t) { t.bc = Math.round((num(t.bc) + resto * num(t.dm) / du) * 100) / 100; mud[t._k] = 1; });
  }
  /* resumos */
  var by = {}; T.forEach(function (t) { by[t.u] = t; if (t.s) t._v = 0; });
  for (var i = T.length - 1; i >= 0; i--) { var t = T[i], pai = by[t.p]; if (!pai) continue; pai._v = (pai._v || 0) + (t.s ? t._v : num(t.bc)); }
  T.forEach(function (t) { if (t.s) { var v = Math.round(t._v * 100) / 100; if (v !== num(t.bc)) { t.bc = v; mud[t._k] = 1; } delete t._v; if (!t.bi && t.i) { t.bi = t.i; t.bf = t.f; t.bdm = t.dm; mud[t._k] = 1; } } });
  Object.keys(mud).forEach(function (k) { gravar(croRaiz(p) + '/' + k, C.parts[k]); });
  croMudou(p);
  return { datas: nDt, venda: folhas.reduce(function (a, t) { return a + num(t.bc); }, 0), partes: Object.keys(mud).length };
}

/* ---------- programa (projeto-pai com um cronograma) e subestações (projetos-filho com custo próprio) ---------- */
function croFilhos(p) { return (p.filhos || []).map(function (f) { return S.projetos.filter(function (x) { return x.id === f.id; })[0]; }).filter(Boolean); }
function croChave(s) { return semAcento(String(s || '')).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim(); }
function croResumos(L, mpd) {
  var by = {}, kids = {}; L.forEach(function (t) { by[t.u] = t; }); L.forEach(function (t) { if (by[t.p]) (kids[t.p] = kids[t.p] || []).push(t); });
  var uteis = function (a, b) { var A = E.day(String(a).slice(0, 10)), B = E.day(String(b).slice(0, 10)), n = 0, d; if (A == null || B == null) return 0; for (d = A; d <= B; d++) { var w = E.weekday(d); if (w !== 1 && w !== 7) n++; } return n; };
  for (var i = L.length - 1; i >= 0; i--) {
    var t = L[i], K = kids[t.u]; if (!K || !K.length) continue;
    var mn = function (k) { var r = null; K.forEach(function (c) { if (c[k] && (r == null || c[k] < r)) r = c[k]; }); return r; }, mx = function (k) { var r = null; K.forEach(function (c) { if (c[k] && (r == null || c[k] > r)) r = c[k]; }); return r; };
    var v = K.reduce(function (a, c) { return a + num(c.bc); }, 0), w = K.reduce(function (a, c) { return a + (num(c.bc) || num(c.dm) / 480 || 0); }, 0);
    var med = function (k) { return w ? K.reduce(function (a, c) { return a + (num(c.bc) || num(c.dm) / 480 || 0) * num(c[k] != null ? c[k] : c.pc); }, 0) / w : 0; };
    t.s = 1; t.bc = Math.round(v * 100) / 100; ['i', 'bi', 'as'].forEach(function (k) { var x = mn(k); if (x) t[k] = x; else delete t[k]; }); ['f', 'bf'].forEach(function (k) { var x = mx(k); if (x) t[k] = x; });
    t.pc = Math.round(med('pc') * 100) / 100; if (K.some(function (c) { return c.pf != null; })) t.pf = Math.round(med('pf') * 100) / 100;
    if (t.pc >= 100) { var af = mx('af'); if (af) t.af = af; } else delete t.af;
    t.dm = uteis(t.i, t.f) * (mpd || 480); if (t.bi) t.bdm = uteis(t.bi, t.bf) * (mpd || 480);
  }
  return L;
}
/* tarefas do programa que pertencem a cada filho (pelo nome da subestação na tarefa ou em um nível acima) */
function croSelecao(T, chave, semAncestrais) {
  var by = {}, k = croChave(chave), sel = {}; T.forEach(function (t) { by[t.u] = t; });
  var rx = new RegExp('(^| )' + k.replace(/ /g, ' +') + '( |$)');
  T.forEach(function (t) { var x = t; while (x) { if (rx.test(croChave(x.n))) { sel[t.u] = 1; return; } x = by[x.p]; } });
  if (!semAncestrais) Object.keys(sel).forEach(function (u) { var x = by[by[u].p]; while (x && !sel[x.u]) { sel[x.u] = 1; x = by[x.p]; } });
  return sel;
}
function croDistribuir(pai) {
  var C = pai._cro, T = C.tasks, n = 0, mpd = num(pai.crono.mpd) || 480;
  croFilhos(pai).forEach(function (filho) {
    var f = pai.filhos.filter(function (x) { return x.id === filho.id; })[0], sel = croSelecao(T, f.chave);
    var L = croResumos(T.filter(function (t) { return sel[t.u]; }).map(function (t) { return JSON.parse(JSON.stringify(t)); }), mpd);
    if (L.length < 2) return;
    var raiz = L[0]; raiz.n = filho.nome + ' – ' + raiz.n;
    var meta = { titulo: raiz.n, inicio: raiz.i, fim: raiz.f, status: pai.crono.status, n: L.length, mpd: mpd, mpw: pai.crono.mpw, dpm: pai.crono.dpm, cal: pai.crono.cal, gerado: 'PAI', pai: pai.id };
    var antigo = filho._cro; filho._cro = { cpus: { links: {} }, param: (antigo && antigo.param) || {}, lps_r: (antigo && antigo.lps_r) || { rows: [] }, lps_s: (antigo && antigo.lps_s) || { rows: [] } };
    croGravarTudo(filho, { tasks: L, cal: (C.cal || {}).xml || '', meta: meta, arq: (pai.crono.arquivo || pai.nome) + ' › ' + f.chave });
    var P = croParam(filho); P.mwp = 0; P.regras = []; P.gerado = 'PAI'; P.pai = pai.id; croSalvarDoc(filho, 'param');
    if (filho.pai !== pai.id) { filho.pai = pai.id; salvarMeta(filho); }
    filho._croWt = null; croMudou(filho); n++;
  });
  return n;
}
function croRemoverChaves(p, chaves, ws) {
  var C = p._cro, T = C.tasks, fora = {};
  chaves.forEach(function (k) { var s = croSelecao(T, k, true); Object.keys(s).forEach(function (u) { fora[u] = 1; }); });
  (ws || []).forEach(function (w) { T.forEach(function (t) { if (t.w === w || String(t.w).indexOf(w + '.') === 0) fora[t.u] = 1; }); });
  /* mantém os ancestrais que ainda têm outros filhos */
  var by = {}; T.forEach(function (t) { by[t.u] = t; }); var tem = {};
  T.forEach(function (t) { if (fora[t.u]) return; var x = by[t.p]; while (x) { tem[x.u] = 1; x = by[x.p]; } });
  var L = T.filter(function (t) { return !fora[t.u] || tem[t.u]; }).map(function (t) { return JSON.parse(JSON.stringify(t)); });
  croResumos(L, num(p.crono.mpd) || 480);
  var r = { tasks: L, cal: (C.cal || {}).xml || '', meta: Object.assign({}, p.crono, { n: L.length, inicio: L[0].i, fim: L[0].f }), arq: p.crono.arquivo };
  croGravarTudo(p, r); croMudou(p);
  return T.length - L.length;
}
function croFilhosAviso(p) {
  var fs = croFilhos(p); if (!fs.length) return '';
  return '<div class="vazio"><h3>Custos controlados nas subestações</h3>O cronograma deste contrato é único, mas o custo de cada subestação é controlado no próprio projeto:<ul style="text-align:left;margin:10px auto;max-width:520px">' +
    fs.map(function (f) { var t = 0; try { t = calc(f).fin.total.total; } catch (e) { } return '<li><a href="#" ' + h(function () { trocaProj(f.id); return false; }) + '>' + esc(f.nome) + '</a> — ' + money(t) + '</li>'; }).join('') + '</ul></div>';
}

/* ---------- carteira consolidada (guia Projetos) ---------- */
function shCarteira() {
  var ps0 = S.projetos.filter(function (p) { return p.crono; }), ps = []; if (!ps0.length) return '';
  ps0.forEach(function (p) { if (p.pai && ps0.some(function (x) { return x.id === p.pai; })) return; ps.push(p); croFilhos(p).forEach(function (f) { if (f.crono) ps.push(f); }); });
  var em = S.base.empresa || {}, falta = ps.filter(function (p) { return !p._cro; });
  falta.forEach(function (p) { croCarregar(p); });
  var s = '<div class="gc gra cart"><h3>Carteira consolidada – ' + esc(em.marca || 'OP Consulting') + '</h3><p class="gq">Executora de todos os projetos: ' + esc(em.razao || 'OP Consulting') + (em.cnpj ? ' · CNPJ ' + esc(em.cnpj) : '') + (em.municipio ? ' · ' + esc(em.municipio) + '/' + esc(em.uf || '') : '') + '</p>';
  if (falta.length) return s + '<p class="gq">Carregando os cronogramas (' + (ps.length - falta.length) + ' de ' + ps.length + ')…</p></div>';
  var L = ps.map(function (p) { var R = croCalc(p), D = croResultado(p, R); return { p: p, R: R, D: D }; }), T = { v: 0, ev: 0, pv: 0, cd: 0, liq: 0, du: 0, dev: 0, dpv: 0 };
  var topo = L.filter(function (x) { return !x.p.pai; }); topo.forEach(function (x) { var n = x.R.tot; T.v += n.v; T.ev += n.ev; T.pv += n.pv; T.cd += x.R.cdTot + x.R.ciTot; T.liq += x.D.liq; });
  var kt = function (r, v, sub, c) { return '<div class="kt' + (c ? ' ' + c : '') + '"><span>' + r + '</span><b>' + v + '</b>' + (sub ? '<i>' + sub + '</i>' : '') + '</div>'; };
  s += '<div class="gk cro-k">' + kt('Venda da carteira', 'R$ ' + compact(T.v), topo.length + ' contratos · ' + ps.length + ' projetos', 'hero') + kt('Medido (real)', 'R$ ' + compact(T.ev), T.v ? pct(T.ev / T.v) + ' da venda' : '') +
    kt('Previsto até as datas de status', 'R$ ' + compact(T.pv), T.v ? pct(T.pv / T.v) : '') + kt('Custo previsto', 'R$ ' + compact(T.cd), T.v ? 'CPU + permanência · margem ' + pct((T.v - T.cd) / T.v) : '') + kt('Resultado líquido previsto', 'R$ ' + compact(T.liq), T.v ? pct(T.liq / T.v) + ' da venda' : '', T.liq < 0 ? 'ru' : '') + '</div>';
  s += '<div class="tw" style="margin-top:12px"><table class="g" style="width:100%"><thead><tr><th class="l">PROJETO</th><th>TIPO</th><th>SITUAÇÃO</th><th>INÍCIO</th><th>TÉRMINO</th><th>DATA DE STATUS</th><th>PREVISTO</th><th>REAL</th><th>DESVIO</th><th>VENDA (R$)</th><th>CUSTO (R$)</th><th>RESULTADO LÍQ. (R$)</th><th>MARGEM LÍQ.</th></tr></thead><tbody>';
  L.forEach(function (x) {
    var p = x.p, R = x.R, pv = croPct(R.tot, 'pv'), ev = croPct(R.tot, 'ev');
    s += '<tr style="cursor:pointer' + (p.pai ? ';color:var(--cinza)' : '') + '" ' + h(function () { trocaProj(p.id, function () { S.v.aba = 'CRO'; }); }) + '><td' + (p.pai ? ' style="padding-left:22px"' : '') + '>' + (p.pai ? '↳ ' : '') + esc(p.nome) + (p.liberado ? '' : ' <span class="chip warn">rascunho</span>') + '</td><td class="c">' + esc(nomeFrase(p.tipo || '')) + '</td><td class="c">' + esc(FASES[p.fase] || p.fase || '') + '</td><td class="c">' + (R.ini != null ? fdate(Math.floor(R.ini)) : '') + '</td><td class="c">' + (R.fim != null ? fdate(Math.floor(R.fim)) : '') + '</td><td class="c">' + fdate(Math.floor(R.st)) + '</td>' +
      '<td class="n">' + pct(pv) + '</td><td class="n k">' + pct(ev) + '</td><td class="n' + (ev < pv - 0.0005 ? ' pico' : '') + '">' + nf2.format((ev - pv) * 100) + '</td><td class="n">' + zero(R.tot.v, money) + '</td><td class="n">' + zero(R.cdTot + R.ciTot, money) + '</td><td class="n' + (x.D.liq < 0 ? ' pico' : '') + '">' + (R.tot.v ? money(x.D.liq) : '–') + '</td><td class="n">' + (R.tot.v ? pct(x.D.liq / R.tot.v) : '–') + '</td></tr>';
  });
  s += '<tr class="tt"><td>TOTAL DA CARTEIRA</td><td></td><td></td><td></td><td></td><td></td><td class="n">' + (T.v ? pct(T.pv / T.v) : '') + '</td><td class="n">' + (T.v ? pct(T.ev / T.v) : '') + '</td><td class="n">' + (T.v ? nf2.format((T.ev - T.pv) / T.v * 100) : '') + '</td><td class="n">' + money(T.v) + '</td><td class="n">' + money(T.cd) + '</td><td class="n">' + money(T.liq) + '</td><td class="n">' + (T.v ? pct(T.liq / T.v) : '') + '</td></tr></tbody></table></div>';
  /* fluxo anual consolidado */
  var anos = {}; topo.forEach(function (x) { var R = x.R; ['mP', 'mT', 'mR', 'mCD', 'mCI'].forEach(function (k) { Object.keys(R[k]).forEach(function (mi) { var a = Math.floor(mi / 12), o = anos[a] || (anos[a] = { mP: 0, mT: 0, mR: 0, mCD: 0, mCI: 0 }); o[k] += R[k][mi]; }); }); });
  s += '<h4 style="margin-top:14px">Venda e custo por ano (todos os projetos)</h4><div class="tw"><table class="g"><thead><tr><th>ANO</th><th>VENDA LB (R$)</th><th>VENDA TENDÊNCIA (R$)</th><th>MEDIDO (R$)</th><th>CUSTO DIRETO CPU (R$)</th><th>CUSTO PERMANÊNCIA (R$)</th></tr></thead><tbody>' +
    Object.keys(anos).sort().map(function (a) { var o = anos[a]; return '<tr><td class="c">' + a + '</td><td class="n">' + money(o.mP) + '</td><td class="n">' + money(o.mT) + '</td><td class="n">' + money(o.mR) + '</td><td class="n">' + money(o.mCD) + '</td><td class="n">' + money(o.mCI) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  return s + '<p class="nota">Avanço consolidado ponderado pela venda (custo da linha de base). Os projetos-filho (↳) estão contidos no contrato acima deles e não somam de novo no total. Projetos sem custo na linha de base entram só no prazo. Clique em um projeto para abrir o cronograma.</p></div>';
}

/* ---------- Last Planner System ---------- */
var LPS_TIPOS = ['PROJETO / INFORMAÇÃO', 'MATERIAL', 'MÃO DE OBRA', 'EQUIPAMENTO', 'LIBERAÇÃO DE ÁREA', 'TAREFA ANTECEDENTE', 'CONTRATO / SUPRIMENTOS', 'QUALIDADE / SEGURANÇA', 'LICENÇAS', 'OUTROS'];
var LPS_CAUSAS = ['PROJETO / INFORMAÇÃO', 'MATERIAL', 'MÃO DE OBRA', 'EQUIPAMENTO', 'TAREFA ANTECEDENTE', 'CLIMA', 'LIBERAÇÃO DE ÁREA', 'MUDANÇA DE PRIORIDADE', 'QUALIDADE / RETRABALHO', 'SEGURANÇA', 'PLANEJAMENTO', 'OUTROS'];
function shLps(p) {
  var w = croPrecisa(p, 'LAST PLANNER SYSTEM'); if (w) return w;
  var V = S.v.lps || (S.v.lps = { vis: 'L', sem: null, busca: '', ds: '' }), R = croCalc(p);
  var tabs = '<div class="tabs" role="tablist">' + [['L', 'Lookahead (6 semanas)'], ['R', 'Restrições'], ['S', 'Plano semanal'], ['P', 'PPC e causas']].map(function (a) { return '<button role="tab" aria-selected="' + (V.vis === a[0]) + '" class="' + (V.vis === a[0] ? 'on' : '') + '" ' + h(function () { V.vis = a[0]; agendar(); }) + '>' + a[1] + '</button>'; }).join('') + '</div>';
  var s = titulo('LAST PLANNER SYSTEM', tabs + croStatusCampo(p, R));
  var C = p._cro, abertas = C.lps_r.rows.filter(function (r) { return r.st !== 'REMOVIDA'; }), venc = abertas.filter(function (r) { return r.dn && E.day(r.dn) < Math.floor(R.st); }).length;
  var ppc = lpsPpc(C), ult = ppc.filter(function (x) { return x.n; }).slice(-1)[0], m4 = ppc.filter(function (x) { return x.n; }).slice(-4);
  s += '<div class="gk cro-k">' + croKt('PPC da última semana', ult ? pct(ult.ppc) : '–', ult ? 'semana de ' + fdate(ult.w) : 'nenhum plano fechado', 'hero') + croKt('PPC médio 4 semanas', m4.length ? pct(m4.reduce(function (a, x) { return a + x.ppc; }, 0) / m4.length) : '–', 'meta usual ≥ 80%') +
    croKt('Restrições abertas', int(abertas.length), venc ? venc + ' vencida(s)' : 'nenhuma vencida', venc ? 'ru' : '') + croKt('Planos semanais', int(C.lps_s.rows.length), 'registrados') + '</div>';
  return s + (V.vis === 'R' ? lpsRestricoes(p, R, V) : V.vis === 'S' ? lpsSemana(p, R, V) : V.vis === 'P' ? lpsGraf(p, R, ppc) : lpsLookahead(p, R, V));
}
function lpsPpc(C) { return C.lps_s.rows.slice().sort(function (a, b) { return cpuOrd(a.ini, b.ini); }).map(function (s) { var n = s.it.length, ok = s.it.filter(function (x) { return x.ok === 'SIM'; }).length; return { w: E.day(s.ini), n: n, ok: ok, ppc: n ? ok / n : 0, it: s.it }; }); }
function lpsRestrDe(C, u) { return C.lps_r.rows.filter(function (r) { return r.u === u && r.st !== 'REMOVIDA'; }); }
function lpsDsFiltro(V, R) {
  var ds = {}; R.leaves.forEach(function (t) { if (t.ds) ds[t.ds] = 1; });
  return '<select aria-label="Disciplina" ' + h(function (el) { V.ds = el.value; agendar(); }) + '><option value="">Todas as disciplinas</option>' + Object.keys(ds).sort().map(function (d) { return '<option' + (V.ds === d ? ' selected' : '') + '>' + esc(d) + '</option>'; }).join('') + '</select>';
}
function lpsLookahead(p, R, V) {
  var w0 = segunda(R.st) + 7, w6 = w0 + 42, C = p._cro, b = semAcento(V.busca), ed = podeEditar();
  var L = R.leaves.filter(function (t) { var a = dn(t.i), f = dn(t.f); return realDe(t) < 100 && a < w6 && f >= w0 && (!V.ds || t.ds === V.ds) && (!b || semAcento(t.w + ' ' + t.n + ' ' + (t.sc || '')).indexOf(b) >= 0); });
  L.sort(function (a, b2) { return dn(a.i) - dn(b2.i); });
  var corte = L.length > 800; if (corte) L = L.slice(0, 800);
  var sems = [0, 1, 2, 3, 4, 5].map(function (k) { return w0 + k * 7; });
  var s = '<div class="cpu-lb"><input type="search" placeholder="Localizar tarefa ou local…" aria-label="Localizar" data-live="1" id="lps-busca" value="' + esc(V.busca) + '" ' + h(function (el) { V.busca = el.value; agendar(); }) + '>' + lpsDsFiltro(V, R) + '</div>';
  s += '<div class="tw" id="tw-lps"><table class="g"><thead><tr><th>EAP</th><th style="min-width:300px">TAREFA</th><th>LOCAL</th><th>INÍCIO</th><th>TÉRMINO</th><th>REAL</th>' + sems.map(function (w) { return '<th>' + fdate(w).slice(0, 5) + '</th>'; }).join('') + '<th>RESTRIÇÕES</th><th>SITUAÇÃO</th></tr></thead><tbody>';
  L.forEach(function (t) {
    var a = dn(t.i), f = dn(t.f), rs = lpsRestrDe(C, t.u), lib = !rs.length;
    s += '<tr><td>' + esc(t.w) + '</td><td class="w">' + esc(t.n) + '</td><td>' + esc(t.sc || t.sp || '') + '</td><td class="c">' + fdate(Math.floor(a)) + '</td><td class="c">' + fdate(Math.floor(f)) + '</td><td class="n">' + pct(realDe(t) / 100) + '</td>' +
      sems.map(function (w) { return '<td class="' + (a < w + 7 && f >= w ? (lib ? 'b2' : 'b3') : '') + '"></td>'; }).join('') +
      '<td class="c">' + (rs.length ? '<b class="pico">' + rs.length + '</b> ' : '') + (ed ? '<button class="lk" ' + h(function () { C.lps_r.rows.push({ id: uid(), u: t.u, tp: 'MATERIAL', d: '', resp: '', dn: isoDia(a), st: 'ABERTA', rm: '' }); croSalvarDoc(p, 'lps_r'); V.vis = 'R'; V.rsel = t.u; agendar(); }) + '>+ restrição</button>' : '') + '</td>' +
      '<td class="c">' + (lib ? '<span class="chip">LIBERADA</span>' : '<span class="chip warn">RESTRITA</span>') + '</td></tr>';
  });
  if (!L.length) s += '<tr><td colspan="14" class="vz">Nenhuma tarefa pendente nas próximas 6 semanas.</td></tr>';
  return s + '</tbody></table></div><div class="nota">' + (corte ? '<b class="pico">Mostrando 800 tarefas; filtre por disciplina ou busca.</b> ' : '') + 'Janela de ' + fdate(w0) + ' a ' + fdate(w6 - 1) + '. Pelo LPS, só entram no plano semanal as tarefas liberadas (sem restrição aberta). Células azuis: semana com execução prevista e tarefa liberada; amarelas: com restrição.</div>';
}
function lpsRestricoes(p, R, V) {
  var C = p._cro, ed = podeEditar(), sv = function () { croSalvarDoc(p, 'lps_r'); }, rows = C.lps_r.rows.slice().sort(function (a, b) { return (a.st === 'REMOVIDA') - (b.st === 'REMOVIDA') || cpuOrd(a.dn || '', b.dn || ''); });
  var dl = '<datalist id="dl-lpst">' + R.leaves.filter(function (t) { return realDe(t) < 100; }).slice(0, 3000).map(function (t) { return '<option value="' + esc(t.w + ' | ' + t.n) + '">'; }).join('') + '</datalist>';
  var s = '<div class="tw" id="tw-lpsr"><table class="g"><thead><tr>' + (ed ? '<th></th>' : '') + '<th>EAP</th><th style="min-width:280px">TAREFA</th><th>TIPO</th><th style="min-width:260px">DESCRIÇÃO DA RESTRIÇÃO</th><th>RESPONSÁVEL</th><th>NECESSÁRIA ATÉ</th><th>SITUAÇÃO</th><th>REMOVIDA EM</th></tr></thead><tbody>';
  rows.forEach(function (r, i) {
    var t = R.by[r.u], venc = r.st !== 'REMOVIDA' && r.dn && E.day(r.dn) < Math.floor(R.st), id = 'lr' + i;
    s += '<tr>' + (ed ? '<td class="x" ' + h(function () { confirma('Excluir esta restrição?', function () { C.lps_r.rows.splice(C.lps_r.rows.indexOf(r), 1); sv(); }); }) + '>×</td>' : '') +
      '<td>' + esc(t ? t.w : '') + '</td>' + cel(id + 't', t ? t.n : '(tarefa removida)', ed ? function (v) { var w = String(v).split(' | ')[0].trim(), x = R.leaves.filter(function (y) { return y.w === w; })[0]; if (!x) return msgbox('AVISO!', 'Tarefa não encontrada: ' + v); r.u = x.u; sv(); } : null, { list: 'dl-lpst', cls: 'w', rot: 'Tarefa' }) +
      cel(id + 'p', r.tp, ed ? function (v) { r.tp = v; sv(); } : null, { ops: LPS_TIPOS, rot: 'Tipo' }) + cel(id + 'd', r.d, ed ? function (v) { r.d = v; sv(); } : null, { cls: 'w', upper: true, rot: 'Descrição' }) +
      cel(id + 'r', r.resp, ed ? function (v) { r.resp = v; sv(); } : null, { upper: true, rot: 'Responsável' }) + cel(id + 'n', r.dn, ed ? function (v) { r.dn = v; sv(); } : null, { t: 'date', rot: 'Necessária até', cls: venc ? 'er' : '' }) +
      cel(id + 's', r.st, ed ? function (v) { r.st = v; if (v === 'REMOVIDA' && !r.rm) r.rm = isoDia(R.st); if (v !== 'REMOVIDA') r.rm = ''; sv(); } : null, { ops: ['ABERTA', 'REMOVIDA'], c: true, rot: 'Situação' }) +
      cel(id + 'm', r.rm, ed ? function (v) { r.rm = v; sv(); } : null, { t: 'date', rot: 'Removida em' }) + '</tr>';
  });
  if (ed) s += '<tr><td class="ad" colspan="9" ' + h(function () { C.lps_r.rows.push({ id: uid(), u: null, tp: 'MATERIAL', d: '', resp: '', dn: isoDia(R.st + 7), st: 'ABERTA', rm: '' }); sv(); agendar(); }) + '>Adicionar</td></tr>';
  return s + '</tbody></table></div>' + dl + '<div class="nota">Registro de restrições do LPS: cada restrição tem tipo, responsável e data limite para remoção. Datas vencidas aparecem em vermelho. A tarefa fica liberada quando todas as suas restrições estão removidas.</div>';
}
function lpsSemana(p, R, V) {
  var C = p._cro, ed = podeEditar(), sv = function () { croSalvarDoc(p, 'lps_s'); };
  var w0 = segunda(R.st) + 7; if (!V.sem) V.sem = isoDia(w0);
  var opcs = []; for (var k = -8; k <= 6; k++) opcs.push(isoDia(w0 + k * 7));
  C.lps_s.rows.forEach(function (x) { if (opcs.indexOf(x.ini) < 0) opcs.push(x.ini); }); opcs.sort();
  var S0 = C.lps_s.rows.filter(function (x) { return x.ini === V.sem; })[0], w = E.day(V.sem);
  var s = '<div class="cpu-lb"><label class="cro-st">Semana de <select ' + h(function (el) { V.sem = el.value; agendar(); }) + '>' + opcs.map(function (o) { var d = E.day(o); return '<option value="' + o + '"' + (o === V.sem ? ' selected' : '') + '>' + fdate(d) + ' a ' + fdate(d + 6) + (C.lps_s.rows.some(function (x) { return x.ini === o; }) ? ' ●' : '') + '</option>'; }).join('') + '</select></label>' +
    (ed ? '<button class="lk" data-tip="Inclui as tarefas liberadas com execução prevista nesta semana" ' + h(function () {
      var Sx = S0 || (C.lps_s.rows.push(S0 = { ini: V.sem, it: [] }), S0), tem = {}; Sx.it.forEach(function (x) { tem[x.u] = 1; });
      var n = 0; R.leaves.forEach(function (t) { var a = dn(t.i), f = dn(t.f); if (realDe(t) < 100 && a < w + 7 && f >= w && !lpsRestrDe(C, t.u).length && !tem[t.u]) { Sx.it.push({ u: t.u, meta: f < w + 7 ? 100 : Math.min(100, Math.round(realDe(t) + (100 - realDe(t)) * (w + 7 - Math.max(a, w)) / Math.max(1, f - Math.max(a, w)))), ok: '', causa: '', obs: '' }); n++; } });
      sv(); msgbox('PLANO SEMANAL', n + ' tarefa(s) liberada(s) incluída(s) no plano da semana de ' + fdate(w) + '.');
    }) + '>Gerar a partir do lookahead</button>' : '') + '</div>';
  if (!S0) return s + '<div class="vazio"><h3>Sem plano para esta semana</h3>' + (ed ? 'Use “Gerar a partir do lookahead” para criar os compromissos da semana.' : '') + '</div>';
  var ok = S0.it.filter(function (x) { return x.ok === 'SIM'; }).length, av = S0.it.filter(function (x) { return x.ok; }).length;
  s += '<div class="impq cro-q"><div><b>' + S0.it.length + '</b><span>compromissos</span></div><div><b>' + ok + '</b><span>cumpridos</span></div><div><b>' + (av ? pct(ok / S0.it.length) : '–') + '</b><span>PPC</span></div></div>';
  s += '<div class="tw" id="tw-lpss"><table class="g"><thead><tr>' + (ed ? '<th></th>' : '') + '<th>EAP</th><th style="min-width:300px">TAREFA</th><th>LOCAL</th><th>META (% ATÉ SEXTA)</th><th>REAL ATUAL</th><th>CUMPRIDO?</th><th>CAUSA DO NÃO CUMPRIMENTO</th><th style="min-width:220px">OBSERVAÇÃO</th></tr></thead><tbody>';
  S0.it.forEach(function (x, i) {
    var t = R.by[x.u], id = 'ls' + i;
    s += '<tr>' + (ed ? '<td class="x" ' + h(function () { S0.it.splice(i, 1); sv(); agendar(); }) + '>×</td>' : '') + '<td>' + esc(t ? t.w : '') + '</td><td class="w">' + esc(t ? t.n : '(removida)') + '</td><td>' + esc(t ? t.sc || t.sp || '' : '') + '</td>' +
      cel(id + 'm', num(x.meta) / 100, ed ? function (v) { x.meta = Math.round(num(v) * 100); sv(); } : null, { t: 'pct', rot: 'Meta' }) + '<td class="n k">' + (t ? pct(realDe(t) / 100) : '') + '</td>' +
      cel(id + 'o', x.ok, ed ? function (v) { x.ok = v; if (v === 'SIM') x.causa = ''; sv(); } : null, { ops: ['SIM', 'NAO'], vazio: '—', c: true, rot: 'Cumprido' }) +
      cel(id + 'c', x.causa, ed && x.ok === 'NAO' ? function (v) { x.causa = v; sv(); } : null, { ops: LPS_CAUSAS, vazio: '—', rot: 'Causa', cls: x.ok === 'NAO' && !x.causa ? 'er' : '' }) + cel(id + 'b', x.obs, ed ? function (v) { x.obs = v; sv(); } : null, { cls: 'w', rot: 'Observação' }) + '</tr>';
  });
  return s + '</tbody></table></div><div class="nota">PPC = compromissos cumpridos ÷ compromissos assumidos. Ao marcar NÃO, informe a causa: ela alimenta o Pareto da aba PPC e causas.</div>';
}
function lpsGraf(p, R, ppc) {
  var F = ppc.filter(function (x) { return x.n; });
  if (!F.length) return '<div class="vazio"><h3>Ainda não há planos semanais avaliados</h3>Registre os compromissos na aba Plano semanal e marque o que foi cumprido.</div>';
  var W = 900, H = 260, ml = 40, mb = 30, mt = 12, bw = Math.min(70, (W - ml - 10) / F.length), s = '';
  for (var k = 0; k <= 4; k++) { var yy = mt + (H - mt - mb) * (1 - k / 4); s += '<line x1="' + ml + '" x2="' + W + '" y1="' + yy + '" y2="' + yy + '" stroke="#e8edf4"/><text x="' + (ml - 5) + '" y="' + (yy + 4) + '" text-anchor="end">' + (k * 25) + '%</text>'; }
  var y80 = mt + (H - mt - mb) * 0.2; s += '<line x1="' + ml + '" x2="' + W + '" y1="' + y80 + '" y2="' + y80 + '" stroke="' + CRO_COR.st + '" stroke-dasharray="4 3"/>';
  var pts = [];
  F.forEach(function (x, i) { var hh = (H - mt - mb) * x.ppc, xx = ml + i * bw + bw * 0.15; s += '<rect x="' + xx + '" y="' + (H - mb - hh) + '" width="' + bw * 0.7 + '" height="' + hh + '" rx="3" fill="' + (x.ppc >= 0.8 ? '#1fa86a' : '#f2b400') + '"><title>' + fdate(x.w) + ': ' + pct(x.ppc) + '</title></rect><text x="' + (xx + bw * 0.35) + '" y="' + (H - 10) + '" text-anchor="middle">' + fdate(x.w).slice(0, 5) + '</text>';
    var m4 = F.slice(Math.max(0, i - 3), i + 1), mm = m4.reduce(function (a, z) { return a + z.ppc; }, 0) / m4.length; pts.push((xx + bw * 0.35).toFixed(1) + ',' + (mt + (H - mt - mb) * (1 - mm)).toFixed(1)); });
  s += '<polyline fill="none" stroke="#1769e8" stroke-width="2.2" points="' + pts.join(' ') + '"/>';
  var cz = {}, tc = 0; F.forEach(function (x) { x.it.forEach(function (i) { if (i.ok === 'NAO') { var c = i.causa || 'SEM CAUSA'; cz[c] = (cz[c] || 0) + 1; tc++; } }); });
  var ks = Object.keys(cz).sort(function (a, b) { return cz[b] - cz[a]; }), ac = 0;
  var par = ks.map(function (k) { ac += cz[k]; return '<span class="nm">' + esc(k) + '</span><span class="tr"><i style="width:' + (cz[k] / cz[ks[0]] * 100) + '%;background:#e5534b"></i></span><span class="v">' + cz[k] + '</span><span class="p">' + pct(ac / tc) + '</span>'; }).join('');
  return '<div class="grid2" style="margin-top:0"><div class="gc gra" style="margin-top:0"><h3>PPC semanal</h3><div class="gleg"><span><i class="q" style="background:#1fa86a"></i>≥ 80%</span><span><i class="q" style="background:#f2b400"></i>abaixo de 80%</span><span><i style="background:#1769e8"></i>média móvel 4 semanas</span></div><div class="gsvg"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="PPC semanal">' + s + '</svg></div></div>' +
    '<div class="gc gra" style="margin-top:0"><h3>Causas de não cumprimento (Pareto)</h3>' + (tc ? '<div class="gl"><span class="cab">CAUSA</span><span class="cab"></span><span class="cab v">QTD</span><span class="cab p">ACUM.</span>' + par + '</div>' : '<p class="gq">Nenhum compromisso descumprido.</p>') + '</div></div>';
}

/* ---------- Linhas de Balanço ---------- */
function shLob(p) {
  var w = croPrecisa(p, 'LINHAS DE BALANÇO'); if (w) return w;
  var V = S.v.lob || (S.v.lob = { g: null, sp: '', lb: true, at: true, re: true, nv: 'SP' }), R = croCalc(p);
  /* locais: Sub-Parque (tarefas agregadas) ou Sub-Campo */
  var locMac = {}, agrega = function (L) {
    var m = {}; L.forEach(function (t) { if (t.sp) (m[t.sp] = m[t.sp] || []).push(t); });
    return Object.keys(m).map(function (k) {
      var G = m[k], mn = function (f) { var r = null; G.forEach(function (t) { var d = t[f]; if (d && (r == null || d < r)) r = d; }); return r; }, mx = function (f) { var r = null; G.forEach(function (t) { var d = t[f]; if (d && (r == null || d > r)) r = d; }); return r; };
      var bc = G.reduce(function (a, t) { return a + num(t.bc); }, 0), pc = bc ? G.reduce(function (a, t) { return a + num(t.bc) * realDe(t); }, 0) / bc : G.reduce(function (a, t) { return a + realDe(t); }, 0) / G.length;
      return { n: G[0].n.split('|').slice(0, -1).join('|') + '| ' + k, sc: k, sp: k, bi: mn('bi'), bf: mx('bf'), i: mn('i'), f: mx('f'), as: mn('as'), af: pc >= 100 ? mx('af') : null, pc: pc, pf: pc, bc: bc };
    });
  };
  Object.keys(R.porMacro).forEach(function (u) { var L = V.nv === 'SC' ? R.porMacro[u].filter(function (t) { return t.sc; }) : agrega(R.porMacro[u]); if (L.length >= 3) locMac[u] = L; });
  var grupos = []; Object.keys(locMac).forEach(function (u) { var g = R.by[u]; while (R.by[g.p] && R.by[g.p].l >= 3) g = R.by[g.p]; if (grupos.indexOf(g) < 0) grupos.push(g); });
  grupos.sort(function (a, b) { return cpuOrd(a.w, b.w); });
  var nMac = function (g) { return Object.keys(locMac).filter(function (u) { var x = R.by[u]; while (x && x !== g) x = R.by[x.p]; return !!x; }).length; };
  if (!grupos.length) return titulo('LINHAS DE BALANÇO') + '<div class="vazio"><h3>Sem tarefas por local</h3>A LoB usa o campo Sub-Campo (local) das tarefas do MS Project.</div>';
  if (!V.g || !grupos.some(function (g) { return g.u === V.g; })) V.g = grupos.slice().sort(function (a, b) { return nMac(b) - nMac(a); })[0].u;
  var G = R.by[V.g], macs = Object.keys(locMac).filter(function (u) { var g = R.by[u]; while (g && g.u !== V.g) g = R.by[g.p]; return !!g; }).map(function (u) { return R.by[u]; }).sort(function (a, b) { return cpuOrd(a.w, b.w); });
  var locs = {}, sps = {}; macs.forEach(function (m) { locMac[m.u].forEach(function (t) { if (!V.sp || t.sp === V.sp) locs[t.sc] = 1; sps[t.sp] = 1; }); });
  var LS = Object.keys(locs).sort(function (a, b) { return (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0) || cpuOrd(a, b); });
  var s = titulo('LINHAS DE BALANÇO (LoB)', croStatusCampo(p, R));
  s += '<div class="cpu-lb"><select aria-label="Grupo da EAP" ' + h(function (el) { V.g = +el.value; agendar(); }) + '>' + grupos.map(function (g) { return '<option value="' + g.u + '"' + (g.u === V.g ? ' selected' : '') + '>' + esc(g.w + ' ' + g.n) + '</option>'; }).join('') + '</select>' +
    '<select aria-label="Nível do local" ' + h(function (el) { V.nv = el.value; agendar(); }) + '><option value="SP"' + (V.nv !== 'SC' ? ' selected' : '') + '>Local: Sub-Parque</option><option value="SC"' + (V.nv === 'SC' ? ' selected' : '') + '>Local: Sub-Campo</option></select>' +
    '<select aria-label="Sub-Parque" ' + h(function (el) { V.sp = el.value; agendar(); }) + '><option value="">Todos os sub-parques</option>' + Object.keys(sps).filter(Boolean).sort().map(function (x) { return '<option' + (V.sp === x ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>' +
    [['lb', 'Linha de base'], ['at', 'Cronograma atual'], ['re', 'Real']].map(function (o) { return '<label class="cro-ck"><input type="checkbox"' + (V[o[0]] ? ' checked' : '') + ' ' + h(function (el) { V[o[0]] = el.checked; agendar(); }) + '> ' + o[1] + '</label>'; }).join('') + '</div>';
  if (!LS.length) return s + '<div class="vazio">Nenhum local neste filtro.</div>';
  /* gráfico */
  var a0 = null, a1 = null; macs.forEach(function (m) { locMac[m.u].forEach(function (t) { [t.bi, t.bf, t.i, t.f].forEach(function (x) { var d = dn(x); if (d == null) return; if (a0 == null || d < a0) a0 = d; if (a1 == null || d > a1) a1 = d; }); }); });
  a0 = miIni(miDe(a0)); a1 = miIni(miDe(a1) + 1);
  var rowH = Math.max(7, Math.min(V.nv === 'SC' ? 16 : 44, 520 / LS.length)), ml = 120, W = 1100, mt = 10, H = mt + LS.length * rowH + 40, xs = function (d) { return ml + (W - ml - 10) * (d - a0) / (a1 - a0); }, yi = {}; LS.forEach(function (l, i) { yi[l] = mt + i * rowH + rowH / 2; });
  var CORES_L = ['#1769e8', '#f2b400', '#22a876', '#e5534b', '#8b7cf6', '#ff8a3d', '#0b3a87', '#4fb0ff', '#b84ea8', '#6b8e23', '#c0392b', '#16a085'];
  var g = '';
  for (var mi = miDe(a0); miIni(mi) <= a1; mi++) { var xx = xs(miIni(mi)); g += '<line x1="' + xx + '" x2="' + xx + '" y1="' + mt + '" y2="' + (H - 30) + '" stroke="#eef2f7"/>' + (mi % 2 === 0 || (a1 - a0) < 400 ? '<text x="' + (xx + 2) + '" y="' + (H - 16) + '">' + mmaa(mi) + '</text>' : ''); }
  LS.forEach(function (l, i) { if (LS.length <= 45 || i % Math.ceil(LS.length / 45) === 0) g += '<text x="' + (ml - 6) + '" y="' + (yi[l] + 3) + '" text-anchor="end" style="font-size:' + (V.nv === 'SC' ? 9.5 : 11) + 'px">' + esc(String(l).replace(/^\d+\.\s*/, '')) + '</text>'; });
  var stx = xs(R.st); g += '<line x1="' + stx + '" x2="' + stx + '" y1="' + mt + '" y2="' + (H - 30) + '" stroke="' + CRO_COR.st + '" stroke-dasharray="3 3"/>';
  var tab = '', leg = '';
  macs.forEach(function (m, k) {
    var cor = CORES_L[k % CORES_L.length], off = V.off && V.off[m.u];
    leg += '<button class="cro-lg' + (off ? ' off' : '') + '" data-tip="Mostrar / ocultar" ' + h(function () { V.off = V.off || {}; V.off[m.u] = !off; agendar(); }) + '><i style="background:' + cor + '"></i>' + esc(m.n.split('|').slice(0, 2).join('|')) + '</button>';
    if (off) return;
    var Lt = locMac[m.u].filter(function (t) { return yi[t.sc] != null; }).sort(function (a, b) { return yi[a.sc] - yi[b.sc]; });
    if (!Lt.length) return;
    var linha = function (fi, ff, dash, wdt, op) {
      var ini = [], fim = [], seg = '';
      Lt.forEach(function (t) { var a = dn(fi(t)), b = dn(ff(t)); if (a == null || b == null) return; var y = yi[t.sc]; ini.push(xs(a).toFixed(1) + ',' + y.toFixed(1)); fim.push(xs(b).toFixed(1) + ',' + y.toFixed(1)); seg += '<line x1="' + xs(a).toFixed(1) + '" x2="' + Math.max(xs(a) + 1, xs(b)).toFixed(1) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="' + cor + '" stroke-width="' + wdt + '" opacity="' + op + '"/>'; });
      return seg + '<polyline fill="none" stroke="' + cor + '" stroke-width="1.4"' + (dash ? ' stroke-dasharray="5 4"' : '') + ' opacity="' + op + '" points="' + ini.join(' ') + '"/><polyline fill="none" stroke="' + cor + '" stroke-width="1.4"' + (dash ? ' stroke-dasharray="5 4"' : '') + ' opacity="' + op + '" points="' + fim.join(' ') + '"/>';
    };
    if (V.lb) g += linha(function (t) { return t.bi; }, function (t) { return t.bf; }, true, 1.2, 0.55);
    if (V.at) g += linha(function (t) { return t.i; }, function (t) { return t.f; }, false, 1.6, 0.9);
    if (V.re) Lt.forEach(function (t) { if (!realDe(t)) return; var a = dn(t.as || t.i), b = realDe(t) >= 100 ? dn(t.af || t.f) : R.st, y = yi[t.sc]; g += '<line x1="' + xs(a).toFixed(1) + '" x2="' + Math.max(xs(a) + 2, xs(b)).toFixed(1) + '" y1="' + y + '" y2="' + y + '" stroke="' + cor + '" stroke-width="' + Math.max(3, Math.min(8, rowH * 0.35)) + '" stroke-linecap="round"><title>' + esc(t.n) + ' · ' + pct(realDe(t) / 100) + '</title></line>'; });
    /* ritmos (locais por semana) */
    var rit = function (fi, ff) { var a = null, b = null; Lt.forEach(function (t) { var x = dn(fi(t)), y = dn(ff(t)); if (x != null && (a == null || x < a)) a = x; if (y != null && (b == null || y > b)) b = y; }); return a != null && b > a ? Lt.length / ((b - a) / 7) : 0; };
    var feitos = Lt.filter(function (t) { return realDe(t) >= 100; }), ri = null; Lt.forEach(function (t) { if (realDe(t) > 0) { var x = dn(t.as || t.i); if (ri == null || x < ri) ri = x; } });
    var rr = ri != null && R.st > ri ? feitos.length / ((R.st - ri) / 7) : 0, falta = Lt.length - feitos.length, prev = rr ? R.st + falta / rr * 7 : null, fimAt = Math.max.apply(null, Lt.map(function (t) { return dn(t.f); }));
    tab += '<tr><td><i class="cro-cor" style="background:' + cor + '"></i>' + esc(m.w) + '</td><td class="w">' + esc(m.n) + '</td><td class="n">' + Lt.length + '</td><td class="n">' + nf2.format(rit(function (t) { return t.bi; }, function (t) { return t.bf; })) + '</td><td class="n">' + nf2.format(rit(function (t) { return t.i; }, function (t) { return t.f; })) + '</td><td class="n k">' + (rr ? nf2.format(rr) : '–') + '</td><td class="n">' + feitos.length + ' (' + pct(feitos.length / Lt.length) + ')</td><td class="c">' + fdate(Math.floor(fimAt)) + '</td><td class="c' + (prev && prev > fimAt + 1 ? ' pico' : '') + '">' + (falta ? (prev ? fdate(Math.floor(prev)) : '–') : 'concluída') + '</td></tr>';
  });
  s += '<div class="gc gra" style="margin-top:0"><h3>' + esc(G.w + ' ' + G.n) + '</h3><div class="gleg cro-lgs">' + leg + '<button class="lk" ' + h(function () { V.off = {}; agendar(); }) + '>Todas</button><button class="lk" ' + h(function () { V.off = {}; macs.forEach(function (m) { V.off[m.u] = true; }); agendar(); }) + '>Nenhuma</button></div><div class="gleg"><span><i style="background:#8a97ab"></i>tracejado: linha de base</span><span><i style="background:#1769e8"></i>contínuo: cronograma atual</span><span><i class="q" style="background:#1769e8"></i>barra grossa: executado (real)</span><span><i style="background:' + CRO_COR.st + '"></i>data de status</span></div><div class="gsvg cro-lob"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Linhas de balanço">' + g + '</svg></div></div>';
  s += '<div class="tw" id="tw-lob" style="margin-top:14px"><table class="g"><thead><tr><th>EAP</th><th style="min-width:260px">MACROATIVIDADE</th><th>LOCAIS</th><th>RITMO LB (loc./sem.)</th><th>RITMO ATUAL</th><th>RITMO REAL</th><th>CONCLUÍDOS</th><th>TÉRMINO ATUAL</th><th>PREVISÃO PELO RITMO REAL</th></tr></thead><tbody>' + tab + '</tbody></table></div>' +
    '<div class="nota">Eixo vertical: locais (' + (V.nv === 'SC' ? 'Sub-Campo' : 'Sub-Parque, com as tarefas do sub-parque agregadas') + ' do MS Project); cada macroatividade traça as linhas de início e de término em todos os locais. Linhas mais inclinadas = ritmo maior. Cruzamentos entre atividades sucessivas indicam interferência de frentes.</div>';
  return s;
}

/* ---------- MS Project: exportação (XML) ---------- */
var CRO_CT = { AS_SOON_AS_POSSIBLE: 0, AS_LATE_AS_POSSIBLE: 1, MUST_START_ON: 2, MUST_FINISH_ON: 3, START_NO_EARLIER_THAN: 4, START_NO_LATER_THAN: 5, FINISH_NO_EARLIER_THAN: 6, FINISH_NO_LATER_THAN: 7 };
var CRO_LT = { FF: 0, FS: 1, SF: 2, SS: 3 };
var CRO_EXT = [['sp', '188743750', 'Text10', 'Sub-Parque'], ['sc', '188743997', 'Text11', 'Sub-Campo'], ['ds', '188744000', 'Text14', 'Disciplina']];
/* campos (tags) extras gravados na exportação, como aparecem no Planning Projects */
var CRO_EXT2 = [['op', '188743998', 'Text12', 'EAP OP Consulting'], ['un', '188743999', 'Text13', 'Unidade (planilha de avanço)'], ['st', '188744001', 'Text15', 'Status físico'], ['cpu', '188744002', 'Text16', 'CPUs vinculadas'], ['cod', '188744003', 'Text17', 'Código da obra'], ['qt', '188743767', 'Number1', 'Quantidade (planilha de avanço)'], ['pf', '188743768', 'Number2', '% físico real']];
/* acrescenta ao calendário do projeto os feriados (Configurações + municipais) e as paralisações cadastrados no sistema */
function croCalXml(p) {
  var C = p._cro, K = p.crono, base = C.cal && C.cal.xml ? C.cal.xml : '<Calendars><Calendar><UID>1</UID><Name>Padrão</Name><IsBaseCalendar>1</IsBaseCalendar><BaseCalendarUID>-1</BaseCalendarUID></Calendar></Calendars>';
  var doc = new DOMParser().parseFromString(base, 'application/xml'); if (doc.getElementsByTagName('parsererror').length) return base;
  var uid = String(num(K.cal) || 1), cal = null; Array.prototype.forEach.call(doc.getElementsByTagName('Calendar'), function (c) { var u = c.getElementsByTagName('UID')[0]; if (u && u.textContent.trim() === uid && !cal) cal = c; });
  if (!cal) cal = doc.getElementsByTagName('Calendar')[0]; if (!cal) return base;
  var mk = function (n, t) { var e = doc.createElement(n); if (t != null) e.textContent = t; return e; }, exs = null;
  for (var c = cal.firstElementChild; c; c = c.nextElementSibling) if (c.localName === 'Exceptions') exs = c;
  if (!exs) { exs = mk('Exceptions'); var ww = null; for (c = cal.firstElementChild; c; c = c.nextElementSibling) if (c.localName === 'WorkWeeks') ww = c; cal.insertBefore(exs, ww); }
  var tem = {}; Array.prototype.forEach.call(exs.getElementsByTagName('FromDate'), function (f) { var a = E.day(f.textContent.slice(0, 10)), b = E.day((f.nextElementSibling || f).textContent.slice(0, 10)); if (a != null) for (var d = a; d <= (b != null ? b : a); d++) tem[d] = 1; });
  var i0 = E.day(String(K.inicio || '').slice(0, 10)), i1 = E.day(String(K.fim || '').slice(0, 10)), lista = [];
  ((S.base.tabelas || {}).feriados || []).concat(p.feriadosMun || []).forEach(function (f) { var d = E.day(f.dt); if (d != null) lista.push([d, d, f.d || 'FERIADO']); });
  (p.paralisacoes || []).forEach(function (x) { var a = E.day(x.i), b = E.day(x.t); if (a != null && b != null && b >= a) lista.push([a, b, x.d || x.m || x.motivo || 'PARALISACAO']); });
  var n = 0;
  lista.forEach(function (x) {
    if (i0 != null && x[1] < i0 - 31 || i1 != null && x[0] > i1 + 31) return;
    var falta = false; for (var d = x[0]; d <= x[1]; d++) if (!tem[d]) falta = true; if (!falta) return;
    for (d = x[0]; d <= x[1]; d++) tem[d] = 1;
    var ex = mk('Exception'); ex.appendChild(mk('EnteredByOccurrences', '0'));
    var tp = mk('TimePeriod'); tp.appendChild(mk('FromDate', E.iso(x[0]) + 'T00:00:00')); tp.appendChild(mk('ToDate', E.iso(x[1]) + 'T23:59:00')); ex.appendChild(tp);
    ex.appendChild(mk('Occurrences', '1')); ex.appendChild(mk('Name', String(x[2]).slice(0, 60))); ex.appendChild(mk('Type', '1')); ex.appendChild(mk('DayWorking', '0'));
    exs.appendChild(ex); n++;
  });
  return new XMLSerializer().serializeToString(doc.documentElement).replace(/ xmlns="[^"]*"/g, '');
}
function xe(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]; }); }
function croDur(min) { min = Math.round(num(min)); return 'PT' + Math.floor(min / 60) + 'H' + (min % 60) + 'M0S'; }
function croXml(p) {
  var C = p._cro, K = p.crono, mpd = num(K.mpd) || 480, R = croCalc(p), dt = function (s) { return s ? (s.length === 16 ? s + ':00' : s) : ''; }, o = [];
  o.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Project xmlns="http://schemas.microsoft.com/project">');
  o.push('<SaveVersion>14</SaveVersion><Name>' + xe(p.nome) + '.xml</Name><Title>' + xe(K.titulo || p.nome) + '</Title><Company>OP Consulting</Company><Author>Planning Projects</Author>');
  o.push('<ScheduleFromStart>1</ScheduleFromStart><StartDate>' + dt(K.inicio) + '</StartDate><FinishDate>' + dt(K.fim) + '</FinishDate><StatusDate>' + isoDia(R.st) + 'T17:00:00</StatusDate><CurrencyDigits>2</CurrencyDigits><CurrencySymbol>R$</CurrencySymbol><CurrencyCode>BRL</CurrencyCode><CurrencySymbolPosition>2</CurrencySymbolPosition>');
  o.push('<EarnedValueMethod>1</EarnedValueMethod><CalendarUID>' + (num(K.cal) || 1) + '</CalendarUID><MinutesPerDay>' + mpd + '</MinutesPerDay><MinutesPerWeek>' + (num(K.mpw) || mpd * 5) + '</MinutesPerWeek><DaysPerMonth>' + (num(K.dpm) || 20) + '</DaysPerMonth><DurationFormat>7</DurationFormat><NewTasksEffortDriven>0</NewTasksEffortDriven><DefaultFixedCostAccrual>2</DefaultFixedCostAccrual>');
  o.push('<ExtendedAttributes>' + CRO_EXT.concat(CRO_EXT2).map(function (x) { return '<ExtendedAttribute><FieldID>' + x[1] + '</FieldID><FieldName>' + x[2] + '</FieldName><Alias>' + x[3] + '</Alias></ExtendedAttribute>'; }).join('') + '</ExtendedAttributes>');
  o.push(croCalXml(p));
  o.push('<Tasks>');
  var meta = inpMeta(p), links = (C.cpus || {}).links || {}, cod = codObra(p);
  C.tasks.forEach(function (t, i) {
    var a = ['<Task><UID>' + t.u + '</UID><ID>' + i + '</ID><Name>' + xe(t.n) + '</Name><Active>1</Active><Manual>0</Manual><Type>0</Type><IsNull>0</IsNull><WBS>' + xe(t.w) + '</WBS><OutlineNumber>' + xe(t.w) + '</OutlineNumber><OutlineLevel>' + t.l + '</OutlineLevel>'];
    a.push('<Start>' + dt(t.i) + '</Start><Finish>' + dt(t.f) + '</Finish><Duration>' + croDur(t.dm) + '</Duration><DurationFormat>7</DurationFormat><Milestone>' + (t.m ? 1 : 0) + '</Milestone><Summary>' + (t.s ? 1 : 0) + '</Summary>');
    if (!t.s) { var c = num(t.c != null ? t.c : t.bc); if (c) a.push('<FixedCost>' + Math.round(c * 100) + '</FixedCost><FixedCostAccrual>3</FixedCostAccrual>'); }
    a.push('<PercentComplete>' + Math.round(num(t.pc)) + '</PercentComplete>' + (t.s ? '' : '<PhysicalPercentComplete>' + Math.round(realDe(t)) + '</PhysicalPercentComplete>'));
    if (!t.s && t.as) a.push('<ActualStart>' + dt(t.as) + '</ActualStart>');
    if (!t.s && t.af) a.push('<ActualFinish>' + dt(t.af) + '</ActualFinish>');
    if (t.ct && CRO_CT[t.ct] != null) a.push('<ConstraintType>' + CRO_CT[t.ct] + '</ConstraintType>' + (t.cd ? '<ConstraintDate>' + dt(t.cd) + '</ConstraintDate>' : ''));
    (t.pr || []).forEach(function (r) { a.push('<PredecessorLink><PredecessorUID>' + r[0] + '</PredecessorUID><Type>' + (CRO_LT[r[1]] != null ? CRO_LT[r[1]] : 1) + '</Type><CrossProject>0</CrossProject><LinkLag>' + Math.round(num(r[2]) * 10) + '</LinkLag><LagFormat>7</LagFormat></PredecessorLink>'); });
    CRO_EXT.forEach(function (x) { if (t[x[0]]) a.push('<ExtendedAttribute><FieldID>' + x[1] + '</FieldID><Value>' + xe(t[x[0]]) + '</Value></ExtendedAttribute>'); });
    var m0 = R.by[t.u], rf = t.s ? null : realDe(t), tg = {
      op: m0 ? M0op(m0, R) : '', un: !t.s && meta.u[t.u] != null ? meta.u[t.u] : '', qt: !t.s && meta.q[t.u] != null ? num(meta.q[t.u]) : null,
      st: t.s ? '' : rf >= 99.95 ? 'CONCLUÍDA' : rf > 0 ? 'EM ANDAMENTO' : 'NÃO INICIADA', cpu: (links[t.u] || []).map(function (l) { return l.c + (num(l.q) !== 1 ? ' ×' + l.q : ''); }).join('; '), cod: cod, pf: rf };
    CRO_EXT2.forEach(function (x) { var v = tg[x[0]]; if (v != null && v !== '') a.push('<ExtendedAttribute><FieldID>' + x[1] + '</FieldID><Value>' + xe(typeof v === 'number' ? Math.round(v * 100) / 100 : v) + '</Value></ExtendedAttribute>'); });
    if (t.bi || t.bc) a.push('<Baseline><Number>0</Number>' + (t.bi ? '<Start>' + dt(t.bi) + '</Start><Finish>' + dt(t.bf) + '</Finish>' : '') + '<Duration>' + croDur(t.bdm != null ? t.bdm : t.dm) + '</Duration><DurationFormat>7</DurationFormat><Cost>' + Math.round(num(t.bc) * 100) + '</Cost></Baseline>');
    a.push('</Task>'); o.push(a.join(''));
  });
  o.push('</Tasks></Project>');
  return o.join('\n');
}
/* ZIP com um arquivo (deflate nativo do navegador; sem compressão se indisponível) — o download do artefato não aceita .xml */
function crc32(u8) { var T = crc32.t || (crc32.t = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })()), c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipUm(nome, texto) {
  var raw = new TextEncoder().encode(texto), crc = crc32(raw), nm = new TextEncoder().encode(nome);
  var comp = typeof CompressionStream !== 'undefined' ? new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer().then(function (b) { return [8, new Uint8Array(b)]; }) : Promise.resolve([0, raw]);
  return comp.then(function (r) {
    var met = r[0], dados = r[1], d = new Date(), tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    var lh = new DataView(new ArrayBuffer(30)); [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, met, 2], [10, tm, 2], [12, dt, 2], [14, crc, 4], [18, dados.length, 4], [22, raw.length, 4], [26, nm.length, 2], [28, 0, 2]].forEach(function (x) { if (x[2] === 4) lh.setUint32(x[0], x[1], true); else lh.setUint16(x[0], x[1], true); });
    var cd = new DataView(new ArrayBuffer(46)); [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, met, 2], [12, tm, 2], [14, dt, 2], [16, crc, 4], [20, dados.length, 4], [24, raw.length, 4], [28, nm.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, 0, 4]].forEach(function (x) { if (x[2] === 4) cd.setUint32(x[0], x[1], true); else cd.setUint16(x[0], x[1], true); });
    var off = 30 + nm.length + dados.length, cdl = 46 + nm.length, eo = new DataView(new ArrayBuffer(22)); [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, 1, 2], [10, 1, 2], [12, cdl, 4], [16, off, 4], [20, 0, 2]].forEach(function (x) { if (x[2] === 4) eo.setUint32(x[0], x[1], true); else eo.setUint16(x[0], x[1], true); });
    return new Blob([lh.buffer, nm, dados, cd.buffer, nm, eo.buffer], { type: 'application/zip' });
  });
}
function croExportar(p) {
  try {
    var nome = (p.crono.arquivo || p.nome).replace(/\.(mpp|xml)$/i, '').replace(/[\\/:*?"<>|]+/g, '-') + '-planning-' + isoDia(croCalc(p).st), xml = croXml(p);
    baixar(nome + '.xml', new Blob([xml], { type: 'application/xml' }));
  } catch (e) { console.error(e); msgbox('ERRO!', 'Não foi possível gerar o XML: ' + e.message, 'crit'); }
}

/* ---------- MS Project: importação (XML) ---------- */
function croImportarBtn() {
  return '<label class="bxl in" data-tip="Cronograma do MS Project salvo como XML (Arquivo › Salvar como › XML)"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 13V4M6 7.5l4-4 4 4M4 15.5h12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>Importar MS Project<input type="file" accept=".xml" hidden ' + h(function (el) {
    var f = el.files && el.files[0]; if (!f) return;
    if (/\.mpp$/i.test(f.name)) { el.value = ''; return msgbox('AVISO!', 'O arquivo .mpp é um formato fechado do MS Project.\n\nNo Project, use Arquivo › Salvar como › XML e importe o arquivo .xml.'); }
    var rd = new FileReader();
    rd.onload = function () { try { var r = croLerXml(rd.result); r.arq = f.name; var p = proj(); var mw = /(\d+(?:[.,]\d+)?)\s*MW/i.exec(r.meta.titulo + ' ' + f.name); S.v.dlg = { tipo: 'croImp', r: r, modo: p && p.crono ? 'atualizar' : 'novo', pid: p && p.crono ? p.id : '', padrao: true, cpus: true, mwp: mw ? parseNum(mw[1]) : 0, sigla: semAcento(r.meta.titulo || f.name).replace(/[^A-Z]/g, '').slice(0, 3) }; agendar(); } catch (e) { console.error(e); msgbox('ERRO!', 'Não foi possível ler o XML: ' + e.message, 'crit'); } };
    rd.readAsText(f); el.value = '';
  }) + '></label>';
}
function croLerXml(txt) {
  var doc = new DOMParser().parseFromString(txt, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('arquivo XML inválido');
  var P = doc.documentElement; if (!P || P.localName !== 'Project') throw new Error('não é um XML do MS Project');
  var tx = function (el, n) { for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (c.localName === n) return c.textContent; return ''; };
  var filhos = function (el, n) { var r = []; for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (c.localName === n) r.push(c); return r; };
  var d16 = function (s) { return s ? s.slice(0, 16) : ''; }, dur = function (s) { var m = /PT(\d+)H(\d+)M(\d+)/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : 0; };
  var ext = {}; (filhos(P, 'ExtendedAttributes')[0] ? filhos(filhos(P, 'ExtendedAttributes')[0], 'ExtendedAttribute') : []).forEach(function (e) {
    var al = semAcento(tx(e, 'Alias')), fn = tx(e, 'FieldName'), k = /SUB-?CAMPO/.test(al) ? 'sc' : /SUB-?PARQUE/.test(al) ? 'sp' : /DISCIPLINA/.test(al) ? 'ds' : fn === 'Text10' ? 'sp' : fn === 'Text11' ? 'sc' : fn === 'Text14' ? 'ds' : null;
    if (k) ext[tx(e, 'FieldID')] = k;
  });
  var LT = { 0: 'FF', 1: 'FS', 2: 'SF', 3: 'SS' }, CT = {}; Object.keys(CRO_CT).forEach(function (k) { CT[CRO_CT[k]] = k; });
  var tasks = [], pilha = [], tk = filhos(P, 'Tasks')[0];
  (tk ? filhos(tk, 'Task') : []).forEach(function (e) {
    if (tx(e, 'IsNull') === '1') return;
    var l = +tx(e, 'OutlineLevel') || 0, t = { u: +tx(e, 'UID'), w: tx(e, 'WBS') || tx(e, 'OutlineNumber'), n: tx(e, 'Name'), l: l, p: -1, i: d16(tx(e, 'Start')), f: d16(tx(e, 'Finish')), dm: dur(tx(e, 'Duration')), pc: +tx(e, 'PercentComplete') || 0 }; if (tx(e, 'PhysicalPercentComplete') !== '') t.pf = +tx(e, 'PhysicalPercentComplete') || 0;
    pilha.length = l; t.p = l > 0 && pilha[l - 1] ? pilha[l - 1].u : -1; pilha[l] = t;
    if (tx(e, 'Summary') === '1') t.s = 1; if (tx(e, 'Milestone') === '1') t.m = 1;
    if (tx(e, 'ActualStart')) t.as = d16(tx(e, 'ActualStart')); if (tx(e, 'ActualFinish')) t.af = d16(tx(e, 'ActualFinish'));
    var ct = tx(e, 'ConstraintType'); if (ct && ct !== '0' && CT[+ct]) { t.ct = CT[+ct]; t.cd = d16(tx(e, 'ConstraintDate')); }
    filhos(e, 'Baseline').forEach(function (b) { if (tx(b, 'Number') !== '0') return; if (tx(b, 'Start')) { t.bi = d16(tx(b, 'Start')); t.bf = d16(tx(b, 'Finish')); } var bd = dur(tx(b, 'Duration')); if (bd) t.bdm = bd; var bc = (+tx(b, 'Cost') || 0) / 100; if (bc) t.bc = Math.round(bc * 100) / 100; });
    var c = (+tx(e, 'Cost') || 0) / 100; if (c && Math.abs(c - num(t.bc)) > 0.005) t.c = Math.round(c * 100) / 100;
    var pr = filhos(e, 'PredecessorLink').map(function (r) { var lag = Math.round((+tx(r, 'LinkLag') || 0) / 10), x = [+tx(r, 'PredecessorUID'), LT[+tx(r, 'Type')] || 'FS']; if (lag) x.push(lag); return x; }); if (pr.length) t.pr = pr;
    filhos(e, 'ExtendedAttribute').forEach(function (x) { var k = ext[tx(x, 'FieldID')]; if (k && tx(x, 'Value').trim()) t[k] = tx(x, 'Value').trim(); });
    tasks.push(t);
  });
  if (!tasks.length) throw new Error('nenhuma tarefa encontrada');
  var a = txt.indexOf('<Calendars>'), b = txt.indexOf('</Calendars>'), cal = a >= 0 && b > a ? txt.slice(a, b + 12).replace(/>\s+</g, '><') : '';
  var cal0 = tx(P, 'CalendarUID');
  if (cal.length > 200000) { var cs = cal.match(/<Calendar>[\s\S]*?<\/Calendar>/g) || []; cal = '<Calendars>' + cs.filter(function (c) { var m = /<UID>(-?\d+)<\/UID>/.exec(c); return m && (m[1] === cal0 || m[1] === '1'); }).join('') + '</Calendars>'; }
  return { tasks: tasks, cal: cal, meta: { titulo: tx(P, 'Title') || tx(P, 'Name'), inicio: d16(tx(P, 'StartDate')), fim: d16(tx(P, 'FinishDate')), status: d16(tx(P, 'StatusDate')) || (isoDia(E.day(new Date().toISOString())) + 'T17:00'), n: tasks.length, mpd: +tx(P, 'MinutesPerDay') || 480, mpw: +tx(P, 'MinutesPerWeek') || 2400, dpm: +tx(P, 'DaysPerMonth') || 20, cal: +cal0 || 1 } };
}
function croGravarTudo(p, r) {
  var parts = {}, cur = [], sz = 0, n = 0;
  r.tasks.forEach(function (t) { var z = JSON.stringify(t).length; if (cur.length && sz + z > 170000) { parts['t' + ('0' + (++n)).slice(-2)] = { rows: cur }; cur = []; sz = 0; } cur.push(t); sz += z; });
  if (cur.length) parts['t' + ('0' + (++n)).slice(-2)] = { rows: cur };
  var antes = p.crono ? num(p.crono.partes) : 0, C = p._cro || { cpus: { links: {} }, param: {}, lps_r: { rows: [] }, lps_s: { rows: [] } };
  for (var i = n + 1; i <= antes; i++) gravar(croRaiz(p) + '/t' + ('0' + i).slice(-2), null);
  Object.keys(parts).forEach(function (k) { gravar(croRaiz(p) + '/' + k, parts[k]); });
  var nc = { parts: parts, cal: { xml: r.cal || (C.cal && C.cal.xml) || '' }, cpus: C.cpus || { links: {} }, param: C.param || {}, lps_r: C.lps_r || { rows: [] }, lps_s: C.lps_s || { rows: [] }, tasks: [] };
  Object.keys(C).forEach(function (k) { if (/^inp_/.test(k)) nc[k] = C[k]; }); p._inpC = null;
  var vivos = {}; r.tasks.forEach(function (t) { vivos[t.u] = 1; }); var perdidos = Object.keys(nc.cpus.links).filter(function (u) { return !vivos[u]; }).length;
  Object.keys(parts).forEach(function (k) { parts[k].rows.forEach(function (t) { Object.defineProperty(t, '_k', { value: k, writable: true, configurable: true, enumerable: false }); nc.tasks.push(t); }); });
  CRO_EXTRA.forEach(function (k) { gravar(croRaiz(p) + '/' + k, nc[k]); });
  p.crono = Object.assign({}, r.meta, { arquivo: r.arq, partes: n, importado: isoDia(E.day(new Date().toISOString())) });
  p._cro = nc; p._croCalc = null; p._croWt = null; salvarMeta(p);
  if (p.filhos && p.filhos.length && !r.semFilhos) croDistribuir(p);
  return perdidos;
}
function dlgCroImp(d) {
  var r = d.r, fechar = function () { S.v.dlg = null; agendar(); }, comCro = S.projetos.filter(function (x) { return x.crono; });
  var aplicar = function () {
    var p;
    if (d.modo === 'novo') {
      novoProjeto(); p = proj(); p.nome = semAcento(String(r.meta.titulo || r.arq).replace(/^cronograma( executivo)?\s*[-–]\s*/i, '')).slice(0, 120) || 'NOVO PROJETO'; p.fase = 'EM ANDAMENTO';
    } else { p = S.projetos.filter(function (x) { return x.id === d.pid; })[0]; if (!p) return msgbox('AVISO!', 'Escolha o projeto a atualizar.'); }
    var go = function () {
      if (d.padrao && window.OPPadrao) r.tasks = window.OPPadrao.padronizar(r.tasks, { mpd: r.meta.mpd, titulo: p.nome }).tasks;
      var perd = croGravarTudo(p, r), P = croParam(p);
      P.mwp = parseNum(d.mwp); if (d.sigla) P.sigla = semAcento(d.sigla).replace(/[^A-Z0-9]/g, '').slice(0, 6);
      P.regras = P.mwp > 0 ? (P.regras && P.regras.length ? P.regras : window.OPPadrao.regrasPadrao()) : [];
      var nc = d.cpus ? croRecriarCpus(p) : 0;
      S.v.pid = p.id; S.v.aba = 'CRO'; S.v.dlg = null;
      msgbox('SUCESSO!', 'Cronograma importado: ' + int(r.tasks.length) + ' tarefas' + (d.padrao ? ', na EAP padrão OP Consulting' : '') + '.' + (nc ? '\n' + nc + ' CPU(s) do projeto criadas.' : '') + (perd ? '\n\n' + perd + ' vínculo(s) de CPU apontam para tarefas que não existem mais.' : ''));
    };
    if (d.modo !== 'novo' && !p._cro) croCarregar(p).then(go); else go();
  };
  var nf = r.tasks.filter(function (t) { return !t.s; }).length, bc = r.tasks.reduce(function (a, t) { return a + (t.s ? 0 : num(t.bc)); }, 0);
  return janela('Importar MS Project', '<div>Arquivo <b>' + esc(d.r.arq) + '</b> · ' + esc(r.meta.titulo) + '</div><div class="impq"><div><b>' + int(r.tasks.length) + '</b><span>tarefas</span></div><div><b>' + int(nf) + '</b><span>de execução</span></div><div><b>R$ ' + compact(bc) + '</b><span>custo da linha de base</span></div></div>' +
    '<fieldset><legend>Destino</legend><label class="rd"><input type="radio" name="ci-m"' + (d.modo === 'novo' ? ' checked' : '') + ' ' + h(function () { d.modo = 'novo'; agendar(); }) + '> Criar projeto novo</label>' +
    '<label class="rd"><input type="radio" name="ci-m"' + (d.modo !== 'novo' ? ' checked' : '') + (comCro.length ? '' : ' disabled') + ' ' + h(function () { d.modo = 'atualizar'; agendar(); }) + '> Atualizar o cronograma de um projeto</label>' +
    (d.modo !== 'novo' ? escolha('ci-p', d.pid, comCro.map(function (x) { return x.id; }), function (v) { d.pid = v; }, { rotulos: comCro.reduce(function (o, x) { o[x.id] = x.nome; return o; }, {}) }) : '') + '</fieldset>' +
    '<fieldset><legend>Padrão OP Consulting</legend><label class="rd"><input type="checkbox"' + (d.padrao ? ' checked' : '') + ' ' + h(function (el) { d.padrao = el.checked; agendar(); }) + '> Reorganizar na EAP padrão (Gestão · Engenharia · Suprimentos · Construção · Comissionamento · Encerramento)</label>' +
    '<label class="rd"><input type="checkbox"' + (d.cpus ? ' checked' : '') + ' ' + h(function (el) { d.cpus = el.checked; agendar(); }) + '> Criar uma CPU por macroatividade (paramétrica por MWp ou custo-meta)</label>' +
    '<div class="fl"><label>Potência (MWp)' + campo('ci-mwp', d.mwp, function (v) { d.mwp = v; }, { t: 'num' }) + '</label><label>Sigla' + campo('ci-sig', d.sigla, function (v) { d.sigla = v; }, { upper: true }) + '</label></div></fieldset>' +
    '<div class="nota" style="margin:0">Na atualização, as CPUs vinculadas, os parâmetros do resultado, as restrições e os planos semanais do LPS são mantidos (as tarefas são reconhecidas pelo UID do MS Project).</div>' +
    '<div class="bts">' + bt('IMPORTAR', aplicar) + bt('CANCELAR', fechar, 'cz') + '</div>', 520, fechar);
}

/* ================= RELACIONAMENTO: composições de cada atividade da EAP ================= */
function relEsp(p, c) { return !!(c && c.pj === p.id && c.esp); }
function relNovaEsp(p, X, modelo) {
  var P = croParam(p), pre = P.sigla + '-ESP-', n = 1; while (X.by[pre + ('00' + n).slice(-3)]) n++;
  var c = modelo ? JSON.parse(JSON.stringify(modelo)) : { u: 'UN', tp: 'C', it: [] };
  c.c = pre + ('00' + n).slice(-3); c.d = modelo ? modelo.d : 'NOVA COMPOSICAO ESPECIAL DO PROJETO'; c.pj = p.id; c.esp = 1; if (modelo) c.orig = modelo.c; else delete c.orig;
  var k = cpuParteLivre(); S.base[k].rows.push(c);
  Object.defineProperty(c, '_k', { value: k, configurable: true, writable: true, enumerable: false });
  cpuSalvar(c); return c;
}
/* depois de mexer nos vínculos: grava, recalcula o cronograma e refaz o custo direto no FIN */
function relSalvar(p) { croSalvarDoc(p, 'cpus'); croMudou(p); clearTimeout(p._relT); p._relT = setTimeout(function () { croGerarFin(p); }, 900); }
function shRela(p) {
  var w = croPrecisa(p, 'RELACIONAMENTO'); if (w) return w;
  var V = S.v.rela || (S.v.rela = { u: null, c: null, busca: '', bl: '', orig: 'TODAS', so: false });
  S.v.cpu = S.v.cpu || { sel: null, busca: '', vis: 'C', bi: '' };
  var R = croCalc(p), C = p._cro, X = R.X, ed = podeEditar(), b = semAcento(V.busca);
  var keep = {}; Object.keys(R.macro).forEach(function (u) { var x = R.by[u]; while (x && !keep[x.u]) { keep[x.u] = 1; x = R.by[x.p]; } });
  var vis = {}; if (b || V.so) Object.keys(R.macro).forEach(function (u) { var t = R.by[u]; if ((b && semAcento(t.w + ' ' + t.n).indexOf(b) < 0) || (V.so && !(C.cpus.links[u] || []).length)) return; var x = t; while (x && !vis[x.u]) { vis[x.u] = 1; x = R.by[x.p]; } });
  var lista = C.tasks.filter(function (t) { return keep[t.u] && (!(b || V.so) || vis[t.u]); });
  if (!V.u || !R.macro[V.u]) { var pm = lista.filter(function (t) { return R.macro[t.u]; })[0]; V.u = pm ? pm.u : null; }
  var vOwn = function (u) { return (R.porMacro[u] || []).reduce(function (a, t) { return a + num(t.bc); }, 0); };
  var s = titulo('RELACIONAMENTO', '<span class="vz" style="font:500 12px var(--ui)">Composições (CPU) de cada atividade da EAP · ' + int(Object.keys(R.macro).length) + ' macroatividades</span>');
  /* itens da EAP */
  s += '<div class="rel"><div class="rel-l"><div class="gc rel-c"><h3>Itens da EAP</h3><div class="cpu-lb"><input id="rel-busca" type="search" placeholder="Localizar EAP ou atividade…" aria-label="Localizar atividade" data-live="1" value="' + esc(V.busca) + '" ' + h(function (el) { V.busca = el.value; agendar(); }) + '><label class="rd"><input type="checkbox"' + (V.so ? ' checked' : '') + ' ' + h(function (el) { V.so = el.checked; agendar(); }) + '> só com CPU</label></div>' +
    '<div class="tw rel-t" id="tw-rela"><table class="g"><thead><tr><th>EAP</th><th class="l">DESCRIÇÃO</th><th>CPU</th><th>CUSTO CPU (R$)</th><th>VENDA LB (R$)</th></tr></thead><tbody>';
  lista.forEach(function (t) {
    var mac = R.macro[t.u], n = R.N[t.u], nl = (C.cpus.links[t.u] || []).length;
    s += '<tr class="' + (mac ? (t.u === V.u ? 'sel' : '') : (t.l <= 1 ? 'gr' : 'sm')) + '"' + (mac ? ' style="cursor:pointer" ' + h(function () { V.u = t.u; V.c = null; agendar(); }) : '') + '><td>' + esc(t.w) + '</td><td class="cpu-d" style="padding-left:' + (6 + Math.max(0, t.l - 1) * 10) + 'px" title="' + esc(t.n) + '">' + esc(t.n) + '</td><td class="c">' + (mac ? (nl || '<span class="vz">–</span>') : '') + '</td><td class="n">' + zero(n.cd, money) + '</td><td class="n">' + zero(mac ? vOwn(t.u) : n.v, money) + '</td></tr>';
  });
  if (!lista.length) s += '<tr><td colspan="5" class="vz">Nenhuma atividade encontrada.</td></tr>';
  s += '</tbody></table></div></div>';
  /* composições relacionadas */
  var m = V.u ? R.by[V.u] : null, L = m ? (C.cpus.links[V.u] || []) : [];
  if (m) {
    if (!V.c || !L.some(function (l) { return l.c === V.c; })) V.c = L.length ? L[0].c : null;
    var tot = 0;
    s += '<div class="gc rel-c"><h3>Composições relacionadas · <span style="font-weight:500">' + esc(m.w + ' ' + m.n) + '</span></h3><p class="gq">' + fdate(Math.floor(dn(m.i))) + ' a ' + fdate(Math.floor(dn(m.f))) + ' · venda LB R$ ' + money(vOwn(V.u)) + '</p><div class="tw" style="max-height:260px"><table class="g" style="width:100%"><thead><tr>' + (ed ? '<th></th>' : '') + '<th>CÓDIGO</th><th class="l">DESCRIÇÃO</th><th>UND</th><th>QUANTIDADE</th><th>CUSTO UNIT. (R$)</th><th>TOTAL (R$)</th><th>ORIGEM</th></tr></thead><tbody>';
    L.forEach(function (l, i) {
      var c = X.by[l.c], u = c ? cpuCalc(c, X).tot : 0, v = num(l.q) * u; tot += v;
      var orig = !c ? '<b class="pico">não encontrada</b>' : relEsp(p, c) ? 'especial do projeto' : c.pj === p.id ? (c.it || []).some(function (x) { return x.r === 'META'; }) ? 'custo-meta' : 'paramétrica' : 'biblioteca';
      s += '<tr class="' + (l.c === V.c ? 'sel' : '') + '" style="cursor:pointer" ' + h(function () { V.c = l.c; agendar(); }) + '>' + (ed ? '<td class="x" data-tip="Retirar a composição desta atividade" ' + h(function (el, e) { e.stopPropagation(); L.splice(i, 1); if (!L.length) delete C.cpus.links[V.u]; relSalvar(p); agendar(); }) + '>×</td>' : '') +
        '<td>' + esc(l.c) + '</td><td class="cpu-d" title="' + esc(c ? c.d : '') + '">' + esc(c ? c.d : '') + '</td><td class="c">' + esc(c ? c.u : '') + '</td>' +
        cel('rlq' + i, l.q, ed ? function (v2) { l.q = v2; relSalvar(p); } : null, { t: 'num', rot: 'Quantidade' }) + '<td class="n k">' + money(u) + '</td><td class="n k">' + money(v) + '</td><td class="c vz">' + orig + '</td></tr>';
    });
    if (!L.length) s += '<tr><td colspan="' + (ed ? 8 : 7) + '" class="vz">Nenhuma composição. Escolha uma na biblioteca ao lado (botão +) ou crie uma composição especial.</td></tr>';
    var mg = vOwn(V.u) - tot;
    s += '<tr class="tt">' + (ed ? '<td></td>' : '') + '<td colspan="5">TOTAL DA ATIVIDADE · margem ' + (vOwn(V.u) ? pct(mg / vOwn(V.u)) : '–') + '</td><td class="n">' + money(tot) + '</td><td></td></tr></tbody></table></div>' +
      (ed ? '<div class="cpu-bt" style="margin:10px 0 0"><button class="lk" data-tip="Cria uma composição só deste projeto, vazia, e relaciona a esta atividade" ' + h(function () { var c = relNovaEsp(p, X); (C.cpus.links[V.u] = C.cpus.links[V.u] || []).push({ c: c.c, q: 1 }); V.c = c.c; relSalvar(p); agendar(); }) + '>Nova composição especial</button></div>' : '') + '</div>';
  }
  s += '</div>';
  /* biblioteca + composição selecionada */
  var ORIGS = [['TODAS', 'Todas as composições', function () { return true; }], ['LIB', 'Composições PV', function (c) { return !c.pj && !c.o; }], ['SB', 'Serviços básicos padrão (SB)', function (c) { return c.o === 'SB'; }], ['DNIT', 'DNIT – SICRO', function (c) { return c.o === 'DNIT' || c.o === 'SICRO'; }], ['DERMG', 'DER-MG – SICOR', function (c) { return c.o === 'DER-MG'; }], ['SINAPI', 'SINAPI-MG', function (c) { return c.o === 'SINAPI-MG'; }], ['SUDECAP', 'SUDECAP', function (c) { return c.o === 'SUDECAP'; }], ['SEINFRA', 'SEINFRA-CE', function (c) { return c.o === 'SEINFRA-CE'; }], ['PROJ', 'Só deste projeto', function (c) { return c.pj === p.id; }]];
  var base = X.comps.filter(function (c) { return !c.pj || c.pj === p.id; }), nOr = {}; ORIGS.forEach(function (o) { nOr[o[0]] = base.filter(o[2]).length; });
  if (!V.orig || !nOr[V.orig] && V.orig !== 'PROJ') V.orig = 'TODAS';
  var fOr = ORIGS.filter(function (o) { return o[0] === V.orig; })[0][2], bl = semAcento(V.bl), lib = base.filter(function (c) { return fOr(c) && (!bl || semAcento(c.c + ' ' + c.d).indexOf(bl) >= 0); });
  var chv = V.orig + '|' + bl; if (V.libK !== chv) { V.libK = chv; V.libLim = 500; } var lim = V.libLim || 500;
  s += '<div class="rel-r"><div class="gc rel-c"><h3>Biblioteca de composições</h3><div class="cpu-lb"><input id="rel-bl" type="search" placeholder="Localizar composição…" aria-label="Localizar composição" data-live="1" value="' + esc(V.bl) + '" ' + h(function (el) { V.bl = el.value; agendar(); }) + '>' +
    '<select aria-label="Origem" ' + h(function (el) { V.orig = el.value; agendar(); }) + '>' + ORIGS.filter(function (o) { return nOr[o[0]] || o[0] === 'PROJ'; }).map(function (o) { return '<option value="' + o[0] + '"' + (V.orig === o[0] ? ' selected' : '') + '>' + o[1] + ' (' + int(nOr[o[0]]) + ')</option>'; }).join('') + '</select></div>' +
    '<div class="tw rel-t" id="tw-rell"><table class="g"><thead><tr>' + (ed ? '<th></th>' : '') + '<th>CÓDIGO</th><th class="l">DESCRIÇÃO</th><th>UND</th><th>CUSTO (R$)</th></tr></thead><tbody>';
  lib.slice(0, lim).forEach(function (c) {
    s += '<tr class="' + (c.c === V.c ? 'sel' : '') + '" style="cursor:pointer" ' + h(function () { V.c = c.c; agendar(); }) + '>' + (ed ? '<td class="ad" data-tip="Relacionar à atividade selecionada" ' + h(function (el, e) { e.stopPropagation(); if (!V.u) return aviso('Selecione uma atividade da EAP.'); (C.cpus.links[V.u] = C.cpus.links[V.u] || []).push({ c: c.c, q: 1 }); V.c = c.c; relSalvar(p); abrirDepois = 'rlq' + (C.cpus.links[V.u].length - 1); agendar(); }) + '>+</td>' : '') +
      '<td>' + esc(c.c) + '</td><td class="cpu-d" title="' + esc(c.d) + '">' + esc(c.d) + '</td><td class="c">' + esc(c.u) + '</td><td class="n">' + money(cpuCalc(c, X).tot) + '</td></tr>';
  });
  s += '</tbody></table></div>' + (lib.length > lim ? '<div class="cpu-bt" style="margin:8px 0 0"><button class="lk" ' + h(function () { V.libLim = lim + 1000; agendar(); }) + '>Mostrar mais 1.000</button><button class="lk" ' + h(function () { V.libLim = lib.length; agendar(); }) + '>Mostrar todas (' + int(lib.length) + ')</button></div>' : '') + '<div class="nota">' + (lib.length > lim ? 'Mostrando ' + int(lim) + ' de ' + int(lib.length) + ' composições. ' : int(lib.length) + ' composições. ') + 'O + relaciona a composição à atividade selecionada à esquerda.</div></div>';
  var c = V.c ? X.by[V.c] : null;
  if (c) {
    var esp = relEsp(p, c);
    s += '<div class="gc rel-c"><h3>' + (esp ? 'Composição especial do projeto' : 'Composição') + ' · ' + esc(c.c) + '</h3>' +
      (esp ? '' : '<p class="gq">' + (c.pj === p.id ? 'Gerada pelos indicadores do projeto.' : 'Composição da biblioteca: vale para todos os projetos.') + ' Para alterar só neste projeto, crie uma cópia especial.' + (ed && V.u ? ' <button class="lk" ' + h(function () {
        var n = relNovaEsp(p, X, c), L2 = C.cpus.links[V.u] || [];
        L2.forEach(function (l) { if (l.c === c.c) l.c = n.c; });
        if (!L2.some(function (l) { return l.c === n.c; })) { L2.push({ c: n.c, q: 1 }); C.cpus.links[V.u] = L2; }
        V.c = n.c; relSalvar(p); agendar();
      }) + '>Criar cópia especial para este projeto</button>' : '') + '</p>') +
      cpuDetalhe(c, X, ed && esp) + '</div>';
  }
  return s + '</div></div>';
}

/* ================= RELATÓRIOS ================= */
var RELT = [['KPC', 'Controle de KPI'], ['KPI', 'Indicadores físicos (KPI)'], ['MO', 'Histograma de mão de obra'], ['EQ', 'Histograma de equipamentos'], ['MAT', 'Consumo de materiais e insumos'], ['DSL', 'Histograma de diesel'], ['FC', 'Fluxo de caixa'], ['DRE', 'Demonstrativo econômico'], ['PC', 'Planilha de custo'], ['PV', 'Planilha de venda'], ['MATV', 'Consumo de materiais e insumos (R$)'], ['DSLV', 'Diesel (R$)'], ['SST', 'Dimensionamento do SESMT (NR-4)'], ['EPI', 'EPI'], ['PCMSO', 'Exames (PCMSO)'], ['GHE', 'Grupos GHE']];
var RELT_GR = [['Planejamento', ['KPC', 'KPI', 'MO', 'EQ', 'MAT', 'DSL']], ['Custo', ['FC', 'DRE', 'PC', 'PV', 'MATV', 'DSLV']], ['SESMT', ['SST', 'EPI', 'PCMSO', 'GHE']]];
var RELT_ABA = { RELP: 0, RELC: 1, RELS: 2, HISP: 0 };
var HIS_P = ['MO', 'EQ', 'DSL', 'MAT'];
function relAbaDe(r, de) { var gi = -1; RELT_GR.forEach(function (g, i) { if (g[1].indexOf(r) >= 0) gi = i; }); var alvo = de === 'RELC' ? 1 : de === 'RELP' ? 0 : gi < 0 ? 0 : gi; if (alvo === 2) return 'RELS'; if (alvo === 0 && HIS_P.indexOf(gi === 0 ? r : '') >= 0) { if (S.v.relt) S.v.relt.r = r; return 'HISP'; } if (gi !== alvo) r = RELT_GR[alvo][1][0]; if (S.v.relt) S.v.relt.r = r; return 'R_' + r; }
function relGi() { if (/^R_/.test(S.v.aba)) { var r = S.v.aba.slice(2), gi = 0; RELT_GR.forEach(function (g, i) { if (g[1].indexOf(r) >= 0) gi = i; }); return gi; } return RELT_ABA[S.v.aba]; }
function relBarra(V) { if (/^R_/.test(S.v.aba)) return ''; var nm = {}; RELT.forEach(function (x) { nm[x[0]] = x[1]; }); if (S.v.aba === 'HISP') { nm.MAT = 'Histograma de consumo de materiais'; return '<div class="rel-bar">' + HIS_P.map(function (k) { return '<button class="' + (V.r === k ? 'on' : '') + '" ' + h(function () { V.r = k; agendar(); }) + '>' + nm[k] + '</button>'; }).join('') + '</div>'; } var g = RELT_GR[relGi() || 0]; return '<div class="rel-bar">' + g[1].map(function (k) { return '<button class="' + (V.r === k ? 'on' : '') + '" ' + h(function () { V.r = k; agendar(); }) + '>' + nm[k] + '</button>'; }).join('') + '</div>'; }
/* recursos do projeto: CPUs × cronograma (datas atuais) + equipes de permanência (FIN) */
function relRecursos(p) {
  var out = { ins: {}, meses: {}, ativs: {} }, dsl = null;
  var put = function (key, base, mi, q, x2, ativ) {
    var I = out.ins[key] || (out.ins[key] = Object.assign({ mes: {}, mes2: {}, q: 0, q2: 0, v: 0, at: {} }, base));
    I.mes[mi] = (I.mes[mi] || 0) + q; I.q += q; if (x2) { I.mes2[mi] = (I.mes2[mi] || 0) + x2; I.q2 += x2; }
    if (ativ) { var A = I.at[ativ] || (I.at[ativ] = { mes: {}, mes2: {} }); A.mes[mi] = (A.mes[mi] || 0) + q; if (x2) A.mes2[mi] = (A.mes2[mi] || 0) + x2; out.ativs[ativ] = 1; }
    out.meses[mi] = 1;
  };
  if (p.crono && p._cro) {
    var R = croCalc(p), X = R.X, C = p._cro, hm = X.hm || 220;
    Object.keys(C.cpus.links).forEach(function (u) {
      var L = C.cpus.links[u] || [], m = R.by[u]; if (!m || !L.length) return;
      if (S.v.relt && S.v.relt.op && String(M0op(m, R)).indexOf(S.v.relt.op) !== 0) return;
      var lv = R.porMacro[u] && R.porMacro[u].length ? R.porMacro[u] : [m], tb = lv.reduce(function (a, t) { return a + num(t.bc); }, 0), fr = {};
      lv.forEach(function (t) { croSpread(fr, KMES, dn(t.i), dn(t.f), tb ? num(t.bc) / tb : 1 / lv.length); });
      var nome = (m.w ? m.w + ' ' : '') + m.n;
      var add = function (c, mult, nv) {
        if (!c || nv > 20) return;
        cpuCalc(c, X).it.forEach(function (r) {
          var q = mult * num(r.k); if (!q) return;
          if (r.x.t === 'AUX') return add(X.by[r.x.i], q, nv + 1);
          var e = r.e, key = 'C:' + (e ? e.id : r.cod), t = r.x.t, pe = num(r.pe);
          Object.keys(fr).forEach(function (mi) {
            var f = fr[mi], qq = q * f;
            if (t === 'MO') put(key, { t: 'MO', d: r.nome, u: 'pessoas', fonte: 'CPU' }, +mi, qq / hm, qq, nome);
            else if (t === 'EQ') { put(key, { t: 'EQ', d: r.nome, u: 'un.', fonte: 'CPU', cons: e ? cpuDiesel(e, X).lh : 0, cmb: e ? cpuComb(e, X) : null }, +mi, qq / hm, qq, nome); }
            else put(key, { t: t, d: r.nome, u: r.u, fonte: 'CPU' }, +mi, qq, qq * pe, nome);
          });
        });
      };
      L.forEach(function (l) { add(X.by[l.c], num(l.q), 0); });
    });
  }
  if (!(S.v.relt && S.v.relt.op)) try {
    var cc = calc(p), cx = ctxDe(p), gera = {}; p.atividades.forEach(function (a) { if (a.cro) gera[a.id] = 1; });
    cc.res.rows.forEach(function (r) {
      if (gera[r.ativ]) return;
      var nome = r.equipe || r.atividade, key = 'P:' + r.c + ':' + r.d;
      if (r.c === 1) put(key, { t: 'MO', d: r.d, u: 'pessoas', fonte: 'Permanência' }, r.mi, r.total, r.hh * r.total, nome);
      else if (r.c === 2) { var V = cx.vem[r.d]; put(key, { t: 'EQ', d: r.d, u: 'un.', fonte: 'Permanência', lh: V ? V.lHora : 0, cb: V ? V.r.cb : '' }, r.mi, r.total, r.hh * r.total, nome); }
      else if (r.c === 3 || r.c === 4 || r.c === 5) put(key, { t: 'MAT', d: r.d2, u: r.u, fonte: 'Permanência' }, r.mi, r.total, r.geral, nome);
    });
    dsl = Object.keys(cx.combustivel || {}).filter(function (k) { return /DIESEL/.test(semAcento(k)); })[0];
    out.precoDiesel = dsl ? num(cx.combustivel[dsl].v) : 0;
  } catch (e) { console.error(e); }
  out.lista = Object.keys(out.meses).map(Number).sort(function (a, b) { return a - b; });
  return out;
}
function M0op(m, R) { var x = m; while (x) { if (x.op) return x.op; x = R.by[x.p]; } return ''; }
function relMeses(lista, V) { return lista.filter(function (mi) { return (!V.de || mi >= V.de) && (!V.ate || mi <= V.ate); }); }
/* tabela de meses: linhas {rot, u, mes{mi}, cls}; devolve html + aoa (para Excel) */
function relMatriz(cab, linhas, meses, fmt, o) {
  o = o || {};
  var tot = function (l) { return meses.reduce(function (a, mi) { return a + num(l.mes[mi]); }, 0); };
  var html = '<div class="tw rel-m" id="tw-relt"><table class="g"><thead><tr>' + cab.map(function (c) { return '<th' + (c === cab[0] ? ' class="l"' : '') + '>' + c + '</th>'; }).join('') + '<th>' + (o.totRot || 'TOTAL') + '</th>' + meses.map(function (mi) { return '<th>' + mmaa(mi) + '</th>'; }).join('') + '</tr></thead><tbody>';
  var aoa = [cab.concat([o.totRot || 'TOTAL'], meses.map(mmaa))];
  linhas.forEach(function (l) {
    var T = l.tot === false ? null : l.tot != null ? l.tot : tot(l), pico = o.pico ? Math.max.apply(null, meses.map(function (mi) { return num(l.mes[mi]); }).concat([0])) : null;
    html += '<tr class="' + (l.cls || '') + '"><td class="cpu-d" title="' + esc(l.rot) + '">' + esc(l.rot) + '</td>' + (l.extra || []).map(function (x) { return '<td class="c">' + esc(x) + '</td>'; }).join('') + '<td class="n k">' + (T == null ? '' : fmt(T)) + '</td>' +
      meses.map(function (mi) { var v = num(l.mes[mi]); return '<td class="n' + (pico && v === pico && l.cls === 'tt' ? ' pico' : '') + '">' + (v ? fmt(v) : '') + '</td>'; }).join('') + '</tr>';
    aoa.push([l.rot].concat(l.extra || [], [T == null ? '' : T], meses.map(function (mi) { return num(l.mes[mi]); })));
  });
  return { html: html + '</tbody></table></div>', aoa: aoa };
}
function relBarras(meses, vals, fmt, rot) {
  var mx = Math.max.apply(null, vals.concat([0])) || 1, W = 1400, H = 150, bw = Math.max(2, (W - 40) / Math.max(1, meses.length) - 2);
  return '<svg class="rel-g" viewBox="0 0 ' + W + ' ' + (H + 24) + '" role="img" aria-label="' + esc(rot) + '">' + vals.map(function (v, i) { var hh = v / mx * H, x = 20 + i * (bw + 2); return '<rect x="' + x + '" y="' + (H - hh + 4) + '" width="' + bw + '" height="' + hh + '" rx="2" fill="' + (v === mx ? 'var(--azul)' : 'var(--azul-2)') + '" fill-opacity="' + (v === mx ? 1 : .55) + '"><title>' + mmaa(meses[i]) + ': ' + fmt(v) + '</title></rect>'; }).join('') +
    '<text x="20" y="' + (H + 20) + '" font-size="11" fill="var(--cinza)">' + (meses.length ? mmaa(meses[0]) : '') + '</text><text x="' + (W - 20) + '" y="' + (H + 20) + '" font-size="11" fill="var(--cinza)" text-anchor="end">' + (meses.length ? mmaa(meses[meses.length - 1]) : '') + '</text><text x="' + (W - 20) + '" y="14" font-size="11" fill="var(--cinza)" text-anchor="end">pico ' + fmt(mx) + '</text></svg>';
}
function shRelt(p) {
  var V = S.v.relt || (S.v.relt = { r: 'MO', por: 'F', med: 'Q', de: 0, ate: 0, op: '' });
  if (/^R_/.test(S.v.aba)) V.r = S.v.aba.slice(2);
  else if (S.v.aba === 'HISP') { if (HIS_P.indexOf(V.r) < 0) V.r = 'MO'; }
  else if (S.v.aba !== 'RELS') S.v.aba = relAbaDe(V.r, S.v.aba);
  var G = RELT_GR[relGi()]; if (G[1].indexOf(V.r) < 0) V.r = G[1][0];
  var titR = function (extra) { return S.v.aba === 'HISP' ? titulo('HISTOGRAMAS', extra) : /^R_/.test(S.v.aba) ? titulo(NOMES[S.v.aba].toUpperCase(), '<span class="vz" style="font:500 12px var(--ui)">' + G[0] + '</span>') : titulo('RELATÓRIOS – ' + G[0].toUpperCase(), extra); };
  var SSTF = { SST: shSesmt, EPI: shEpi, PCMSO: shPcmso, GHE: shGhe };
  if (SSTF[V.r]) return titulo('RELATÓRIOS – ' + G[0].toUpperCase(), '<span class="vz" style="font:500 12px var(--ui)">' + esc(RELT.filter(function (x) { return x[0] === V.r; })[0][1]) + '</span>') + relBarra(V) + '<div class="rel-sst">' + SSTF[V.r](p) + '</div>';
  if (p.crono && !p._cro) { croCarregar(p); return titR() + '<div class="vazio">Carregando o cronograma…</div>'; }
  var nomeR = RELT.filter(function (x) { return x[0] === V.r; })[0][1], barraTop = relBarra(V);
  /* materiais e diesel: em quantidade no Planejamento e em valor (R$) no Custo */
  var rOrig = V.r, medOrig = V.med, emValor = V.r === 'MATV' || V.r === 'DSLV';
  if (V.r === 'MATV') { V.r = 'MAT'; V.med = 'H'; } else if (V.r === 'DSLV') V.r = 'DSL'; else if (V.r === 'MAT') V.med = 'Q';
  try {
  var D = relRecursos(p), meses0 = D.lista, R = p.crono ? croCalc(p) : null;
  if (R && ['FC', 'DRE'].indexOf(V.r) >= 0) meses0 = R.meses.slice();
  var meses = relMeses(meses0, V), corpo = '', aoa = [], fq = function (v) { return nfq.format(v); };
  var ops = R ? window.OPPadrao.EAP.reduce(function (a, e) { a.push([e[0], e[0] + ' ' + e[1]]); e[2].forEach(function (x) { a.push([x[0], x[0] + ' ' + x[1]]); }); return a; }, []) : [];
  /* barra: relatório + filtros */
  var sel = function (id, val, lista, set) { return '<select id="' + id + '" ' + h(function (el) { set(el.value); agendar(); }) + '>' + lista.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(val) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; };
  var mOps = [[0, '—']].concat(meses0.map(function (mi) { return [mi, mmaa(mi)]; }));
  var hist = ['MO', 'EQ', 'MAT', 'DSL'].indexOf(V.r) >= 0;
  var barra = barraTop +
    '<div class="cpu-lb rel-f"><label>Período ' + sel('rt-de', V.de, mOps, function (v) { V.de = +v; }) + ' a ' + sel('rt-ate', V.ate, mOps, function (v) { V.ate = +v; }) + '</label>' +
    (hist && R ? '<label>Atividade ' + sel('rt-op', V.op, [['', 'Todas (inclui permanência)']].concat(ops), function (v) { V.op = v; }) + '</label>' : '') +
    (V.r === 'MO' || V.r === 'EQ' || V.r === 'MAT' || V.r === 'DSL' ? '<label>Agrupar ' + sel('rt-por', V.por, [['F', V.r === 'MO' ? 'Por função' : V.r === 'MAT' ? 'Por insumo' : 'Por equipamento'], ['A', 'Por atividade']], function (v) { V.por = v; }) + '</label>' : '') +
    (V.r === 'MO' ? '<label>Mostrar ' + sel('rt-med', V.med, [['Q', 'Efetivo (pessoas)'], ['H', 'Horas-homem']], function (v) { V.med = v; }) + '</label>' : '') +
    (V.r === 'EQ' ? '<label>Mostrar ' + sel('rt-med', V.med, [['Q', 'Quantidade'], ['H', 'Horas de utilização']], function (v) { V.med = v; }) + '</label>' : '') +

    '<span style="flex:1"></span><button class="bxl" ' + h(function () { relExcel(p, nomeR, aoa); }) + '>' + XL_IC + 'Excel</button><button class="lk" ' + h(function () { try { window.print(); } catch (e) { aviso('A impressão não está disponível nesta visualização. Use o Excel.'); } }) + '>Imprimir / PDF</button></div>';
  var twoMes = function (I) { return V.med === 'H' ? I.mes2 : I.mes; };
  if (hist) {
    var tipo = V.r === 'DSL' ? 'EQ' : V.r, its = Object.keys(D.ins).map(function (k) { return D.ins[k]; }).filter(function (I) { return V.r === 'MAT' ? (I.t === 'MAT' || I.t === 'OUT') : I.t === tipo; });
    var fmt = V.r === 'MAT' && V.med === 'H' ? money : V.r === 'MO' && V.med === 'Q' ? function (v) { return nf2.format(v); } : fq, linhas = [], semCons = 0;
    if (V.r === 'DSL') {
      its.forEach(function (I) {
        var lh = I.fonte === 'CPU' ? num(I.cons) : (/DIESEL/.test(semAcento(I.cb || '')) ? num(I.lh) : 0); if (!lh) { if (I.fonte === 'CPU') semCons++; return; }
        if (emValor) lh *= D.precoDiesel || 0;
        var mes = {}; Object.keys(I.mes2).forEach(function (mi) { mes[mi] = I.mes2[mi] * lh; });
        if (V.por === 'A') Object.keys(I.at).forEach(function (a) { var L = linhas.filter(function (x) { return x.rot === a; })[0]; if (!L) linhas.push(L = { rot: a, mes: {}, extra: [] }); Object.keys(I.at[a].mes2).forEach(function (mi) { L.mes[mi] = (L.mes[mi] || 0) + I.at[a].mes2[mi] * lh; }); });
        else linhas.push({ rot: I.d, mes: mes, extra: [emValor ? 'R$ ' + money(lh) + '/h' : nfq.format(lh) + ' L/h', I.fonte] });
      });
      fmt = emValor ? money : fq;
    } else if (V.por === 'A') {
      var porA = {}; its.forEach(function (I) { Object.keys(I.at).forEach(function (a) { var L = porA[a] || (porA[a] = { rot: a, mes: {}, extra: [] }); var mm = V.med === 'H' ? I.at[a].mes2 : I.at[a].mes; Object.keys(mm).forEach(function (mi) { L.mes[mi] = (L.mes[mi] || 0) + mm[mi]; }); }); });
      linhas = Object.keys(porA).sort().map(function (a) { return porA[a]; });
    } else linhas = its.map(function (I) { return { rot: I.d, mes: twoMes(I), extra: [V.r === 'MAT' ? I.u || '' : I.u, I.fonte] }; });
    linhas = linhas.filter(function (l) { return meses.some(function (mi) { return num(l.mes[mi]); }); }).sort(function (a, b) { return cpuOrd(a.rot, b.rot); });
    /* histogramas de mão de obra e equipamentos em quantidade: sempre o inteiro acima, linha a linha (o total soma os arredondados) */
    if ((V.r === 'MO' || V.r === 'EQ') && V.med === 'Q') { linhas = linhas.map(function (l) { var m = {}; Object.keys(l.mes).forEach(function (mi) { var v = num(l.mes[mi]); m[mi] = v > 1e-9 ? Math.ceil(v - 1e-9) : 0; }); return Object.assign({}, l, { mes: m }); }); fmt = int; }
    var T = { rot: 'TOTAL', mes: {}, cls: 'tt', extra: [] }; linhas.forEach(function (l) { Object.keys(l.mes).forEach(function (mi) { T.mes[mi] = (T.mes[mi] || 0) + l.mes[mi]; }); while (T.extra.length < (l.extra || []).length) T.extra.push(''); });
    var cab = [V.por === 'A' ? 'ATIVIDADE' : V.r === 'MO' ? 'FUNÇÃO' : V.r === 'MAT' ? 'INSUMO' : 'EQUIPAMENTO'].concat(V.por === 'A' ? [] : V.r === 'DSL' ? ['CONSUMO', 'ORIGEM'] : ['UND', 'ORIGEM']);
    var unid = V.r === 'MO' ? (V.med === 'H' ? 'horas-homem por mês' : 'efetivo médio no mês (pessoas)') : V.r === 'EQ' ? (V.med === 'H' ? 'horas de utilização por mês' : 'equipamentos médios no mês') : V.r === 'MAT' ? (V.med === 'H' ? 'custo por mês (R$)' : 'quantidade consumida por mês') : emValor ? 'custo de diesel por mês (R$) · R$ ' + money(D.precoDiesel || 0) + '/L' : 'litros de diesel por mês';
    var mz = relMatriz(cab, [T].concat(linhas), meses, fmt, { pico: true, totRot: V.r === 'MO' && V.med === 'Q' || V.r === 'EQ' && V.med === 'Q' ? 'PICO' : 'TOTAL' });
    if ((V.r === 'MO' || V.r === 'EQ') && V.med === 'Q') { [T].concat(linhas).forEach(function (l) { l.tot = Math.max.apply(null, meses.map(function (mi) { return num(l.mes[mi]); }).concat([0])); }); mz = relMatriz(cab, [T].concat(linhas), meses, fmt, { pico: true, totRot: 'PICO' }); }
    if (V.r === 'MAT' && V.med === 'H') { var ac = 0, A = { rot: 'ACUMULADO (R$)', mes: {}, cls: 'at', extra: cab.slice(1).map(function () { return ''; }), tot: false }; meses.forEach(function (mi) { ac += num(T.mes[mi]); A.mes[mi] = ac; }); mz = relMatriz(cab, [T, A].concat(linhas), meses, fmt, { pico: true }); }
    var graRealH = '';
    if ((V.r === 'MO' || V.r === 'EQ') && V.med === 'Q' && !V.op && realPronto(p)) {
      var RMh = realMeses(p), temR = meses.some(function (mi) { var m = RMh[mi]; return m && (V.r === 'MO' ? m.efet.MOD + m.efet.MOI : m.efet.EQD + m.efet.EQI); });
      if (temR) {
        var rot1 = V.r === 'MO' ? ['REAL – MO direta (fechamento)', 'REAL – MO indireta (fechamento)'] : ['REAL – equip. produção (fechamento)', 'REAL – equip. apoio (fechamento)'], k1 = V.r === 'MO' ? ['MOD', 'MOI'] : ['EQD', 'EQI'];
        var RTt = { rot: V.r === 'MO' ? 'REAL – efetivo médio (fechamento)' : 'REAL – equipamentos médios (fechamento)', mes: {}, cls: 'at', extra: T.extra.map(function () { return ''; }) }, R1 = { rot: rot1[0], mes: {}, extra: T.extra.map(function () { return ''; }) }, R2 = { rot: rot1[1], mes: {}, extra: T.extra.map(function () { return ''; }) };
        meses.forEach(function (mi) { var m = RMh[mi]; if (!m) return; R1.mes[mi] = m.efet[k1[0]]; R2.mes[mi] = m.efet[k1[1]]; RTt.mes[mi] = m.efet[k1[0]] + m.efet[k1[1]]; });
        [RTt, R1, R2].forEach(function (l) { l.tot = Math.max.apply(null, meses.map(function (mi) { return num(l.mes[mi]); }).concat([0])); });
        mz = relMatriz(cab, [T, RTt, R1, R2].concat(linhas), meses, function (v) { return v % 1 ? nf2.format(v) : int(v); }, { pico: true, totRot: 'PICO' });
        graRealH = '<h4 class="rel-h4">Previsto × real</h4>' + revcLinhas([{ nome: 'Previsto', cor: REVC_COR.base, dash: true, v: meses.map(function (mi) { return num(T.mes[mi]); }) }, { nome: 'Real (fechamento)', cor: REVC_COR.at, w: 3, v: meses.map(function (mi) { return RMh[mi] ? RTt.mes[mi] : null; }) }], meses.map(mmaa), { titulo: 'Previsto × real', fmt: function (v) { return nf2.format(v); } });
      }
    }
    aoa = mz.aoa;
    var totG = meses.reduce(function (a, mi) { return a + num(T.mes[mi]); }, 0);
    corpo = '<div class="gc"><h3>' + nomeR + ' <span class="vz" style="font-weight:500">· ' + unid + '</span></h3>' + (meses.length ? relBarras(meses, meses.map(function (mi) { return num(T.mes[mi]); }), fmt, nomeR) : '') +
      (V.r === 'DSL' ? '<p class="gq">Total no período: <b>' + (emValor ? 'R$ ' + money(totG) + '</b>' + (D.precoDiesel ? ' (' + fq(totG / D.precoDiesel) + ' L × R$ ' + money(D.precoDiesel) + '/L, tabela de combustível)' : ' (sem preço de diesel na tabela de combustível)') : fq(totG) + ' L</b>') + (!emValor && D.precoDiesel ? ' · custo estimado <b>R$ ' + money(totG * D.precoDiesel) + '</b> (R$ ' + money(D.precoDiesel) + '/L, tabela de combustível)' : '') + (semCons ? ' · <b class="pico">' + semCons + ' equipamento(s) das CPUs sem correspondente com diesel no banco Veículos e máquinas (vincule na guia CPU › Insumos, VÍNCULO = VEM)</b> — informe em CPU › Insumos da CPU, coluna DIESEL (L/h)' : '') + '</p>' : '') +
      graRealH + mz.html + '<div class="nota">' + (graRealH ? 'Linhas REAL: média mensal do efetivo diário lançado no Fechamento mensal. ' : '') + 'Calculado das composições (CPU) relacionadas a cada atividade, distribuídas pelas datas atuais do cronograma, mais as equipes de permanência do Cronograma financeiro. ' + (V.r === 'MO' ? 'Efetivo das CPUs = horas-homem do mês ÷ ' + int(R ? R.X.hm : 220) + ' h.' : '') + '</div></div>';
  } else if (V.r === 'KPC') {
    corpo = relKpiCtl(p, R, function (a) { aoa = a; });
  } else if (V.r === 'KPI') {
    corpo = relKpi(p, R, function (a) { aoa = a; });
  } else if (V.r === 'FC' || V.r === 'DRE') {
    if (!R) corpo = '<div class="vazio">Este projeto não tem cronograma: o fluxo de caixa e o demonstrativo usam a venda e os custos do cronograma.</div>';
    else {
      var P = croParam(p), Dr = croResultado(p, R);
      if (V.r === 'FC') {
        var ent = { rot: 'ENTRADAS – receita (tendência do cronograma)', mes: {}, cls: 'at' }, lb = { rot: 'Receita prevista (linha de base)', mes: {} }, cd = { rot: '(−) Custo direto – CPU', mes: {} }, ci = { rot: '(−) Custo indireto – permanência', mes: {} }, it = { rot: '(−) Impostos + TAC', mes: {} }, sd = { rot: 'SALDO DO MÊS', mes: {}, cls: 'tt' }, sa = { rot: 'SALDO ACUMULADO', mes: {}, cls: 'at', tot: false };
        var acc = 0; meses.forEach(function (mi) { var vt = R.mT[mi] || 0, x = vt * (num(P.imp) + num(P.tac)); ent.mes[mi] = vt; lb.mes[mi] = R.mP[mi] || 0; cd.mes[mi] = -(R.mCD[mi] || 0); ci.mes[mi] = -(R.mCI[mi] || 0); it.mes[mi] = -x; sd.mes[mi] = vt - x - (R.mCD[mi] || 0) - (R.mCI[mi] || 0); acc += sd.mes[mi]; sa.mes[mi] = acc; });
        var linFC = [ent, lb, cd, ci, it, sd, sa], notaR = '';
        if (realPronto(p)) {
          var RM = realMeses(p), ultR = realUltimo(p);
          if (ultR != null) {
            var rR = { rot: 'REALIZADO – receita pelo avanço real', mes: {}, cls: 'at' }, rD = { rot: '(−) Custo real direto (fechamento)', mes: {} }, rI = { rot: '(−) Custo real indireto (fechamento)', mes: {} }, rT = { rot: '(−) Impostos + TAC sobre a receita real', mes: {} }, rS = { rot: 'Saldo real do mês', mes: {}, cls: 'at' }, rA = { rot: 'Saldo real acumulado', mes: {}, cls: 'tt', tot: false }, accR = 0;
            meses.forEach(function (mi) { if (mi > ultR || !RM[mi]) return; var vr = R.mR[mi] || 0, m = RM[mi], x = vr * (num(P.imp) + num(P.tac)); rR.mes[mi] = vr; rD.mes[mi] = -m.D; rI.mes[mi] = -m.I; rT.mes[mi] = -x; rS.mes[mi] = vr - x - m.D - m.I; accR += rS.mes[mi]; rA.mes[mi] = accR; });
            linFC = linFC.concat([rR, rD, rI, rT, rS, rA]);
            notaR = ' Realizado: só nos meses com fechamento lançado (até ' + mmaa(ultR) + '); receita pelo avanço físico real do mês (valor agregado) e custos lançados no Fechamento mensal.';
          }
        }
        var SDx = supDesembolso(p);
        if (SDx.n) {
          var sP2 = { rot: 'Suprimentos – desembolso previsto (informativo)', mes: {}, cls: 'sp-fc' }, sR2 = { rot: 'Suprimentos – pago (informativo)', mes: {}, cls: 'sp-fc' };
          meses.forEach(function (mi) { if (SDx.prev[mi]) sP2.mes[mi] = -SDx.prev[mi]; if (SDx.pago[mi]) sR2.mes[mi] = -SDx.pago[mi]; });
          linFC = linFC.concat([sP2, sR2]);
          notaR += ' Suprimentos: desembolso das compras da contratada pela data de pagamento (Mapa de suprimentos: valor e prazo de pagamento). É informativo e não entra no saldo, porque os materiais já estão no custo direto pelo consumo.';
        }
        var mz2 = relMatriz(['FLUXO'], linFC, meses, money); aoa = mz2.aoa;
        corpo = '<div class="gc"><h3>Fluxo de caixa (R$)</h3>' + relBarras(meses, meses.map(function (mi) { return Math.max(0, sa.mes[mi]); }), money, 'Saldo acumulado') + mz2.html + '<div class="nota">' + esc(notaR) + ' Saldo acumulado nas barras (só a parte positiva). Entradas pela tendência do cronograma; saídas pelas datas atuais (CPU) e pelo Cronograma financeiro (permanência).</div></div>';
      } else {
        var anos = {}; meses.forEach(function (mi) { var a = Math.floor(mi / 12), o = anos[a] || (anos[a] = { v: 0, cd: 0, ci: 0 }); o.v += R.mT[mi] || 0; o.cd += R.mCD[mi] || 0; o.ci += R.mCI[mi] || 0; });
        var ks = Object.keys(anos).sort(), linhasD = [
          ['Receita bruta (venda)', Dr.V, function (o) { return o.v; }], ['(−) Impostos sobre faturamento', -Dr.imp, function (o) { return -o.v * num(P.imp); }], ['Receita líquida', Dr.rl, function (o) { return o.v * (1 - num(P.imp)); }],
          ['(−) Custos diretos – CPU', -Dr.cd, function (o) { return -o.cd; }], ['(−) Custos indiretos – permanência', -Dr.ci, function (o) { return -o.ci; }], ['Margem bruta', Dr.rl - Dr.cd - Dr.ci, function (o) { return o.v * (1 - num(P.imp)) - o.cd - o.ci; }],
          ['(−) TAC – administração central', -Dr.tac, function (o) { return -o.v * num(P.tac); }], ['Resultado operacional (antes de CSLL e IR)', Dr.antes, null], ['(−) CSLL', -Dr.csll, null], ['(−) IR', -Dr.ir, null], ['RESULTADO LÍQUIDO', Dr.liq, null]];
        var DR = null;
        if (realPronto(p)) { var ultD = realUltimo(p); if (ultD != null) { var RMd = realMeses(p), vR = 0, cdR = 0, ciR = 0; Object.keys(RMd).forEach(function (k) { if (+k <= ultD) { vR += R.mR[+k] || 0; cdR += RMd[k].D; ciR += RMd[k].I; } });
          var impR = vR * num(P.imp), tacR = vR * num(P.tac), antR = vR - impR - cdR - ciR - tacR, csR = (P.base === 'PRESUMIDO' ? vR * num(P.presCsll) : Math.max(0, antR)) * num(P.csll), irR = (P.base === 'PRESUMIDO' ? vR * num(P.presIr) : Math.max(0, antR)) * num(P.ir);
          DR = { ate: ultD, v: [vR, -impR, vR - impR, -cdR, -ciR, vR - impR - cdR - ciR, -tacR, antR, -csR, -irR, antR - csR - irR] }; } }
        aoa = [['DEMONSTRATIVO', 'TOTAL (R$)', '% VENDA'].concat(DR ? ['REALIZADO ATÉ ' + mmaa(DR.ate), '% RECEITA REAL'] : [], ks)];
        corpo = '<div class="gc"><h3>Demonstrativo econômico</h3><div class="tw"><table class="g"><thead><tr><th class="l">DEMONSTRATIVO</th><th>TOTAL (R$)</th><th>% VENDA</th>' + (DR ? '<th class="dre-r">REALIZADO ATÉ ' + mmaa(DR.ate).toUpperCase() + '</th><th class="dre-r">% RECEITA REAL</th>' : '') + ks.map(function (a) { return '<th>' + a + '</th>'; }).join('') + '</tr></thead><tbody>' +
          linhasD.map(function (l, i) { aoa.push([l[0], l[1], Dr.V ? l[1] / Dr.V : 0].concat(DR ? [DR.v[i], DR.v[0] ? DR.v[i] / DR.v[0] : 0] : [], ks.map(function (a) { return l[2] ? l[2](anos[a]) : ''; }))); return '<tr class="' + ([2, 5, 7].indexOf(i) >= 0 ? 'at' : i === 10 ? 'tt' : '') + '"><td>' + l[0] + '</td><td class="n">' + money(l[1]) + '</td><td class="n">' + (Dr.V ? pct(l[1] / Dr.V) : '') + '</td>' + (DR ? '<td class="n dre-r">' + money(DR.v[i]) + '</td><td class="n dre-r">' + (DR.v[0] ? pct(DR.v[i] / DR.v[0]) : '') + '</td>' : '') + ks.map(function (a) { return '<td class="n">' + (l[2] ? money(l[2](anos[a])) : '') + '</td>'; }).join('') + '</tr>'; }).join('') +
          '</tbody></table></div><div class="nota">Base de CSLL e IR: ' + (P.base === 'PRESUMIDO' ? 'lucro presumido' : 'lucro real') + '. Impostos ' + pct(P.imp) + ', TAC ' + pct(P.tac) + ', CSLL ' + pct(P.csll) + ', IR ' + pct(P.ir) + ' (Cronograma físico › Venda × custo × resultado).' + (DR ? ' Realizado: meses com fechamento lançado até ' + mmaa(DR.ate) + ' — receita pelo avanço físico real do mês (valor agregado) e custos do Fechamento mensal, com as mesmas alíquotas.' : '') + '</div></div>';
      }
    }
  } else {
    corpo = relPlanilha(p, R, V.r === 'PV', function (a) { aoa = a; });
  }
  return titR('<span class="vz" style="font:500 12px var(--ui)">' + esc(nomeR) + '</span>') + barra + corpo;
  } finally { V.r = rOrig; if (rOrig === 'MATV') V.med = medOrig; }
}
function relPlanilha(p, R, venda, outAoa) {
  var X = R ? R.X : cpuDados(), linhas = [], tot = { MO: 0, EQ: 0, MAT: 0, SER: 0, OUT: 0, t: 0 }, cab = ['EAP / CPU', 'DESCRIÇÃO', 'UND', 'QUANT.', 'CUSTO UNIT. (R$)', 'MÃO DE OBRA', 'EQUIPAMENTOS', 'MATERIAIS', 'SERVIÇOS', 'OUTROS / VERBAS', 'CUSTO TOTAL (R$)'];
  var bdi = typeof bdiCalc === 'function' ? bdiCalc(p.bdi) : 0, aoa = [];
  var parte = function (c, q) { var o = cpuCalc(c, X), sub = { MO: 0, EQ: 0, MAT: 0, SER: 0, OUT: 0 }, soma = 0; CPU_T.forEach(function (t) { soma += num(o.sub[t.t]); }); CPU_T.forEach(function (t) { var k = sub[t.t] != null ? t.t : 'OUT'; sub[k] += soma ? q * o.tot * num(o.sub[t.t]) / soma : 0; }); if (!soma) sub.OUT = q * o.tot; return { o: o, sub: sub, t: q * o.tot }; };
  if (R) {
    var C = p._cro, vOwn = function (u) { return (R.porMacro[u] || []).reduce(function (a, t) { return a + num(t.bc); }, 0); };
    C.tasks.forEach(function (t) {
      if (!R.macro[t.u]) return; var L = C.cpus.links[t.u] || [], mt = { MO: 0, EQ: 0, MAT: 0, SER: 0, OUT: 0, t: 0 }, its = [];
      L.forEach(function (l) { var c = X.by[l.c]; if (!c) return; var r = parte(c, num(l.q)); its.push({ l: l, c: c, r: r }); Object.keys(r.sub).forEach(function (k) { mt[k] += r.sub[k]; }); mt.t += r.t; });
      Object.keys(mt).forEach(function (k) { tot[k] += mt[k]; });
      if (mt.t || vOwn(t.u)) linhas.push({ g: 1, t: t, mt: mt, v: vOwn(t.u), its: its });
    });
  }
  var ci = 0; try { var cc = calc(p), gera = {}; p.atividades.forEach(function (a) { if (a.cro) gera[a.id] = 1; }); cc.res.rows.forEach(function (r) { if (!gera[r.ativ]) ci += r.geral; }); } catch (e) { }
  var ct = tot.t + ci, pv = ct * (1 + bdi), vlb = R ? R.tot.v : 0;
  var s = '<div class="gc"><h3>' + (venda ? 'Planilha de venda' : 'Planilha de custo') + '</h3>';
  if (venda) {
    var b = p.bdi || {};
    s += '<div class="gk cpu-k">' + croKt('Custo total', 'R$ ' + compact(ct), 'direto R$ ' + compact(tot.t) + ' · indireto R$ ' + compact(ci)) + croKt('BDI contratual', nf2.format(bdi * 100) + '%', b.inf ? 'informado no contrato' : b.form === 'DIV' ? 'divisor 1 ÷ (1 − A − I − L)' : 'calculado (TCU 2622/2013)') + croKt('Preço de venda (custo × BDI)', 'R$ ' + compact(pv), '', 'hero') + croKt('Venda contratual (LB)', 'R$ ' + compact(vlb), vlb ? 'diferença ' + pct((vlb - pv) / vlb) : '') + '</div>';
    if (!bdi) s += '<div class="ler cpu-av">O BDI deste projeto ainda não foi preenchido (Dados do projeto › BDI contratual).</div>';
    aoa = [['EAP', 'DESCRIÇÃO', 'CUSTO (R$)', 'BDI', 'PREÇO DE VENDA (R$)', 'VENDA CONTRATUAL LB (R$)', 'DIFERENÇA (R$)']];
    s += '<div class="tw rel-m"><table class="g" style="width:100%"><thead><tr><th>EAP</th><th class="l">DESCRIÇÃO</th><th>CUSTO (R$)</th><th>BDI</th><th>PREÇO DE VENDA (R$)</th><th>VENDA CONTRATUAL LB (R$)</th><th>DIFERENÇA (R$)</th></tr></thead><tbody>';
    linhas.forEach(function (L) { var pr = L.mt.t * (1 + bdi); aoa.push([L.t.w, L.t.n, L.mt.t, bdi, pr, L.v, L.v - pr]); s += '<tr><td>' + esc(L.t.w) + '</td><td class="cpu-d" title="' + esc(L.t.n) + '">' + esc(L.t.n) + '</td><td class="n">' + money(L.mt.t) + '</td><td class="n">' + nf2.format(bdi * 100) + '%</td><td class="n k">' + money(pr) + '</td><td class="n">' + money(L.v) + '</td><td class="n' + (L.v - pr < 0 ? ' pico' : '') + '">' + money(L.v - pr) + '</td></tr>'; });
    aoa.push(['', 'CUSTO INDIRETO – PERMANÊNCIA', ci, bdi, ci * (1 + bdi), '', '']); aoa.push(['', 'TOTAL', ct, bdi, pv, vlb, vlb - pv]);
    s += '<tr class="at"><td></td><td>CUSTO INDIRETO – PERMANÊNCIA</td><td class="n">' + money(ci) + '</td><td class="n">' + nf2.format(bdi * 100) + '%</td><td class="n k">' + money(ci * (1 + bdi)) + '</td><td></td><td></td></tr><tr class="tt"><td></td><td>TOTAL</td><td class="n">' + money(ct) + '</td><td class="n">' + nf2.format(bdi * 100) + '%</td><td class="n">' + money(pv) + '</td><td class="n">' + money(vlb) + '</td><td class="n">' + money(vlb - pv) + '</td></tr></tbody></table></div>';
    var bp = bdiPartes(b), comp = [['1 Despesas indiretas (A)', bp.A, 'at'], ['Administração central', b.ac], ['Despesas financeiras', b.df], ['Risco, seguros e garantias', num(b.r) + num(b.s) + num(b.g)], ['2 Despesas legais (I)', bp.I, 'at'], ['ISS', b.iss], ['PIS', b.pis], ['COFINS', b.cofins], ['CSLL', b.csll], ['IRPJ', b.irpj], ['CPRB', b.cprb], ['3 Lucro bruto (L)', bp.L, 'at']].filter(function (x) { return x[2] || num(x[1]); });
    s += '<h4 style="margin-top:14px">Composição do BDI</h4><div class="tw"><table class="g"><tbody>' + comp.map(function (x) { aoa.push(['BDI', x[0], num(x[1])]); return '<tr class="' + (x[2] || '') + '"><td>' + x[0] + '</td><td class="n">' + nf2.format(num(x[1]) * 100) + '%</td></tr>'; }).join('') + '<tr class="tt"><td>BDI total</td><td class="n">' + nf2.format(bdi * 100) + '%</td></tr></tbody></table></div><div class="nota">' + (b.inf ? 'BDI informado no contrato.' : 'Fórmula ' + BDI_FORM[b.form || 'TCU'] + '.') + '</div>';
  } else {
    aoa = [cab];
    s += '<div class="tw rel-m"><table class="g"><thead><tr>' + cab.map(function (c, i) { return '<th' + (i === 1 ? ' class="l"' : '') + '>' + c + '</th>'; }).join('') + '</tr></thead><tbody>';
    var m5 = function (o) { return ['MO', 'EQ', 'MAT', 'SER', 'OUT'].map(function (k) { return '<td class="n">' + zero(o[k], money) + '</td>'; }).join(''); };
    linhas.forEach(function (L) {
      aoa.push([L.t.w, L.t.n, '', '', ''].concat(['MO', 'EQ', 'MAT', 'SER', 'OUT'].map(function (k) { return L.mt[k]; }), [L.mt.t]));
      s += '<tr class="at"><td>' + esc(L.t.w) + '</td><td class="cpu-d" title="' + esc(L.t.n) + '">' + esc(L.t.n) + '</td><td></td><td></td><td></td>' + m5(L.mt) + '<td class="n k">' + money(L.mt.t) + '</td></tr>';
      L.its.forEach(function (x) { aoa.push([x.c.c, x.c.d, x.c.u, num(x.l.q), x.r.o.tot].concat(['MO', 'EQ', 'MAT', 'SER', 'OUT'].map(function (k) { return x.r.sub[k]; }), [x.r.t])); s += '<tr><td class="vz">' + esc(x.c.c) + '</td><td class="cpu-d" title="' + esc(x.c.d) + '">' + esc(x.c.d) + '</td><td class="c">' + esc(x.c.u) + '</td><td class="n">' + nfq.format(num(x.l.q)) + '</td><td class="n">' + money(x.r.o.tot) + '</td>' + m5(x.r.sub) + '<td class="n">' + money(x.r.t) + '</td></tr>'; });
    });
    aoa.push(['', 'CUSTO DIRETO – CPU', '', '', ''].concat(['MO', 'EQ', 'MAT', 'SER', 'OUT'].map(function (k) { return tot[k]; }), [tot.t]));
    aoa.push(['', 'CUSTO INDIRETO – PERMANÊNCIA', '', '', '', '', '', '', '', '', ci]); aoa.push(['', 'CUSTO TOTAL', '', '', '', '', '', '', '', '', ct]);
    s += '<tr class="at"><td></td><td>CUSTO DIRETO – CPU</td><td></td><td></td><td></td>' + m5(tot) + '<td class="n">' + money(tot.t) + '</td></tr><tr class="at"><td></td><td>CUSTO INDIRETO – PERMANÊNCIA (equipes do Cronograma financeiro)</td><td colspan="8"></td><td class="n">' + money(ci) + '</td></tr><tr class="tt"><td></td><td>CUSTO TOTAL</td><td colspan="8"></td><td class="n">' + money(ct) + '</td></tr></tbody></table></div>';
  }
  outAoa(aoa);
  return s + '<div class="nota">' + (venda ? 'Preço de venda = custo × (1 + BDI). A venda contratual é o custo da linha de base do MS Project.' : 'Custo de cada composição aberto por natureza dos insumos (proporcional aos subtotais da CPU). Altere composições e quantidades na guia Relacionamento.') + '</div></div>';
}
function relExcel(p, nome, aoa) {
  if (!aoa || !aoa.length) return aviso('Nada para exportar.');
  carregaXlsx().then(function (XL) {
    var wb = XL.utils.book_new(); XL.utils.book_append_sheet(wb, XL.utils.aoa_to_sheet([['OP CONSULTING · Planning Projects'], [nome + ' – ' + p.nome], ['Gerado em ' + fdate(E.day(new Date().toISOString())) + ' · OP Consulting'], []].concat(aoa)), nome.slice(0, 31));
    baixar(semAcento((p.sigla ? p.sigla + '-' : '') + nome + '-' + p.nome).replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) + '.xlsx', XL.write(wb, { bookType: 'xlsx', type: 'array' }));
  }, function (e) { msgbox('ERRO!', e.message, 'crit'); });
}

/* ================= INÍCIO DO PROJETO: dados contratuais, configuração do empreendimento e cronograma padrão ================= */
var CATEGORIAS = { UFV: 'Usina solar fotovoltaica (parque solar)', SE: 'Subestação', OUTRO: 'Outro tipo de obra' };
var SE_TIPOS = ['ISOLADOR DE PEDESTAL', 'PARA-RAIOS', 'TRANSFORMADOR DE CORRENTE (TC)', 'TRANSFORMADOR DE POTENCIAL (TP/TPC)', 'BOBINA DE BLOQUEIO', 'CHAVE SECCIONADORA', 'DISJUNTOR', 'PORTICO', 'TRANSFORMADOR DE POTENCIA', 'AUTOTRANSFORMADOR', 'REATOR', 'BANCO DE CAPACITORES'];
var SE_PRINCIPAL = /^TRANSFORMADOR DE POTENCIA$|AUTOTRANSFORMADOR|REATOR/;
function cfgFalta(p) {
  var f = [], c = p.contrato || {}, ct = p.contratante || {}, l = p.local || {};
  if (!p.nome || p.nome === 'NOVO PROJETO') f.push('Nome do projeto');
  if (!tipoInfo(p.tipo)) f.push('Tipo de obra'); else if (tipoCat(p.tipo) !== 'UFV' && tipoCat(p.tipo) !== 'EOL' && !num(p.porte)) f.push('Porte do empreendimento (' + tipoUn(p) + ')');
  if (!p.categoria && tipoInfo(p.tipo)) p.categoria = tipoCat(p.tipo);
  if (!ct.razao) f.push('Contratante (razão social)');
  if (!l.municipio || !l.uf) f.push('Local do projeto (município e UF)');
  [['assinatura', 'Data de assinatura do contrato'], ['os', 'Data da ordem de serviço'], ['inicio', 'Início contratual'], ['termino', 'Término contratual']].forEach(function (x) { if (!c[x[0]]) f.push(x[1]); });
  if (c.inicio && c.termino && c.termino < c.inicio) f.push('Término contratual antes do início');
  if (p.categoria === 'UFV') { var u = p.ufv || {}; if (!num(u.wp)) f.push('Potência do módulo (Wp)'); if (!(u.parques || []).some(function (x) { return num(x.sub) > 0 && num(x.mod) > 0; })) f.push('Configuração do parque: ao menos um parque com subcampos e módulos'); }
  if (p.categoria === 'SE' && !((p.se || {}).equip || []).some(function (x) { return num(x.qtd) > 0; })) f.push('Equipamentos da subestação');
  if (p.categoria === 'EOL') { var ev = p.eol || {}; if (!num(ev.mw)) f.push('Potência do aerogerador (MW)'); if (!(ev.frentes || []).some(function (x) { return num(x.wtg) > 0; })) f.push('Configuração do parque eólico: ao menos uma frente com aerogeradores'); }
  return f;
}
function cfgInicio(p, svp) {
  var c = p.contrato || (p.contrato = {}), o = p.opc || (p.opc = {}), falta = cfgFalta(p);
  var dt = function (id, rot, k, dica) { return cfgCampo(id, rot, c[k], function (x) { c[k] = x; svp(); agendar(); }, { t: 'date', dica: dica }); };
  var sn = function (id, rot, k, dica) { return cfgCampo(id, rot, o[k] ? 'SIM' : 'NAO', function (x) { o[k] = x === 'SIM'; svp(); agendar(); }, { ops: ['SIM', 'NAO'], rotulos: { SIM: 'Sim', NAO: 'Não' }, dica: dica }); };
  var aviso = p.crono ? '' : falta.length ? '<div class="ler cpu-av"><b>Para iniciar o projeto, complete:</b> ' + falta.map(esc).join(' · ') + '. Depois disso o cronograma padrão pode ser gerado na guia Cronograma físico.</div>' : '<div class="ler cpu-av" style="background:var(--verde);color:var(--verde-fg)"><b>Dados completos.</b> Gere o cronograma padrão na guia Cronograma físico.</div>';
  return aviso + cfgCard('Categoria e contrato', 'Dados obrigatórios para iniciar o projeto. O tipo de obra define o cronograma padrão; as datas do contrato são os marcos iniciais do cronograma.', '<div class="cf">' +
    cfgCampo('ci-cat', 'Cronograma padrão', p.categoria === 'UFV' ? 'Energia solar (modelo UFV Paraíso / Seriemas)' : p.categoria === 'SE' ? 'Subestação (equipamentos por modelo)' : tipoInfo(p.tipo) ? 'Modelo geral (civil, montagem e encerramento)' : 'Escolha o tipo de obra em Identificação', null, { ro: true, w2: true, dica: 'Definido pelo tipo de obra.' }) +
    dt('ci-as', 'Assinatura do contrato', 'assinatura') + dt('ci-ln', 'LNTP (aviso de início limitado)', 'lntp', 'Opcional.') + dt('ci-os', 'Ordem de serviço', 'os') + dt('ci-lic', 'Licença ambiental (LI)', 'licenca', 'Opcional: sem data, a liberação de área parte da OS.') +
    dt('ci-ini', 'Início contratual', 'inicio') + dt('ci-fim', 'Término contratual', 'termino') +
    sn('ci-gu', 'Guarita', 'guarita', 'Opcional nos dois tipos de obra.') + sn('ci-en', 'Entroncamento / acesso externo', 'entroncamento', 'Opcional nos dois tipos de obra.') + '</div>') +
    cfgCard('Marcos contratuais', 'Marcos do contrato (parciais e finais). Entram no grupo 1.1 do cronograma como marcos com data fixa.', cfgTab(bloco('mc', '', p.marcos || (p.marcos = []), [{ k: 'd', rot: 'Marco', upper: true }, { k: 'data', rot: 'Data', t: 'date' }, { k: 'tipo', rot: 'Tipo', ops: ['PARCIAL', 'FINAL'] }, { k: 'pct', rot: '% do contrato', t: 'pct' }], svp, function () { return { d: '', data: '', tipo: 'PARCIAL', pct: 0 }; })));
}
function cfgUfv(p, svp) {
  var u = p.ufv || (p.ufv = { wp: 0, ritmo: 2, parques: [] }); u.parques = u.parques || [];
  var tot = { sub: 0, trk: 0, est: 0, mod: 0, inv: 0 }; u.parques.forEach(function (x) { var n = num(x.sub); ['trk', 'est', 'mod', 'inv'].forEach(function (k) { tot[k] += n * num(x[k]); }); tot.sub += n; });
  var mwp = tot.mod * num(u.wp) / 1e6;
  return cfgCard('Configuração do parque solar', 'Cada parque é um grupo de subcampos; cada subcampo tem um eletrocentro (1.1, 1.2… no cronograma) e é composto por estacas, trackers, módulos e inversores. Informe as quantidades por subcampo de cada parque.', '<div class="cf">' +
    cfgCampo('uf-wp', 'Potência do módulo', u.wp, function (x) { u.wp = x; svp(); agendar(); }, { t: 'num', suf: 'Wp' }) +
    cfgCampo('uf-rt', 'Ritmo de abertura de subcampos', u.ritmo == null ? 2 : u.ritmo, function (x) { u.ritmo = x; svp(); agendar(); }, { t: 'num', suf: 'dias úteis', dica: 'Intervalo entre o início de um subcampo e o próximo (UFV Paraíso: cerca de 2 dias).' }) +
    cfgCampo('uf-tt', 'Totais do parque', int(u.parques.length) + ' parques · ' + int(tot.sub) + ' subcampos/eletrocentros · ' + nf2.format(mwp) + ' MWp', null, { ro: true, w2: true, dica: int(tot.est) + ' estacas · ' + int(tot.trk) + ' trackers · ' + int(tot.mod) + ' módulos · ' + int(tot.inv) + ' inversores' }) + '</div>' +
    cfgTab(bloco('uf', '', u.parques, [{ k: 'nome', rot: 'Parque', upper: true }, { k: 'sub', rot: 'Subcampos (eletrocentros)', t: 'num' }, { k: 'est', rot: 'Estacas por subcampo', t: 'num' }, { k: 'trk', rot: 'Trackers por subcampo', t: 'num' }, { k: 'mod', rot: 'Módulos por subcampo', t: 'num' }, { k: 'inv', rot: 'Inversores por subcampo', t: 'num' }, { rot: 'MWp do parque', calc: function (r) { return nf2.format(num(r.sub) * num(r.mod) * num(u.wp) / 1e6); }, t: 'num' }], svp, function () { return { nome: 'PARQUE ' + ('0' + (u.parques.length + 1)).slice(-2), sub: 10, est: 0, trk: 0, mod: 0, inv: 0 }; })));
}
function cfgTipo(p, svp) {
  var ed = podeEditar(), atual = tipoInfo(p.tipo) ? tipoInfo(p.tipo)[0] : '', princ = TIPOS_PRINC.map(function (x) { return x[0]; });
  var muda = function (x) { var un0 = tipoUn(p); p.tipo = x; if (tipoUn(p) !== un0) p.porte = 0; var c = tipoCat(x); if (c) p.categoria = c; svp(); agendar(); };
  var outros = TIPOS_OBRA.map(function (x) { return x[0]; }).filter(function (x) { return princ.indexOf(x) < 0; }).sort(ordAlfa);
  var modelo = { UFV: 'cronograma padrão de parque solar (base UFV Paraíso)', SE: 'cronograma padrão de subestação', EOL: 'cronograma padrão de parque eólico (base Cajuína 3)' }[tipoCat(atual)] || 'cronograma padrão genérico';
  return cfgCard('Tipo do projeto', 'Primeira definição do projeto: define a unidade do porte, os campos de configuração e o modelo do cronograma padrão.',
    '<div class="tp-op" role="radiogroup" aria-label="Tipo do projeto">' + TIPOS_PRINC.map(function (x) { return '<button type="button" role="radio" aria-checked="' + (atual === x[0]) + '" class="' + (atual === x[0] ? 'on' : '') + '"' + (ed ? ' ' + h(function () { muda(x[0]); }) : ' disabled') + '><b>' + esc(x[1]) + '</b><small>' + esc(tipoInfo(x[0])[1]) + '</small></button>'; }).join('') + '</div>' +
    '<div class="cf" style="margin-top:12px">' + cfgCampo('cp-tp', 'Outros tipos de obra', princ.indexOf(atual) >= 0 ? '' : atual, function (x) { if (x) muda(x); }, { ops: [''].concat(outros), rotulos: { '': princ.indexOf(atual) >= 0 ? '— nenhum (tipo escolhido acima) —' : '— escolha —' } }) +
    cfgCampo('cp-tpm', 'Modelo de cronograma', atual ? modelo : '–', null, { ro: true, w2: true, dica: 'Gestão, engenharia, suprimentos, comissionamento e encerramento seguem sempre a EAP padrão; a construção segue o modelo do tipo.' }) + '</div>');
}
function cfgEol(p, svp) {
  var e = p.eol || (p.eol = { mw: 0, ritmo: 5, montagem: 10, frentes: [] }); e.frentes = e.frentes || [];
  var nW = e.frentes.reduce(function (a, f) { return a + num(f.wtg); }, 0), km = e.frentes.reduce(function (a, f) { return a + num(f.km); }, 0);
  return cfgCard('Configuração do parque eólico', 'Cada frente reúne acessos, plataformas e fundações dos aerogeradores (WTG) e uma entrega da rede de média tensão. As durações do cronograma padrão vêm do Parque Eólico Cajuína 3 e são ajustadas pelos quilômetros de cada frente.', '<div class="cf">' +
    cfgCampo('eo-mw', 'Potência do aerogerador', e.mw, function (x) { e.mw = x; svp(); agendar(); }, { t: 'num', suf: 'MW' }) +
    cfgCampo('eo-rt', 'Ritmo entre fundações', e.ritmo == null ? 5 : e.ritmo, function (x) { e.ritmo = x; svp(); agendar(); }, { t: 'num', suf: 'dias úteis', dica: 'Intervalo entre o início de uma fundação e a próxima na mesma frente (Cajuína 3: cerca de 5 dias).' }) +
    cfgCampo('eo-mt', 'Montagem de cada aerogerador', e.montagem == null ? 10 : e.montagem, function (x) { e.montagem = x; svp(); agendar(); }, { t: 'num', suf: 'dias úteis', dica: 'Escopo da contratante (fornecimento e montagem do aerogerador); entra no cronograma como restrição para as conexões e a energização.' }) +
    cfgCampo('eo-tt', 'Totais do parque', int(e.frentes.length) + ' frentes · ' + int(nW) + ' aerogeradores · ' + nf2.format(km) + ' km de acessos · ' + nf2.format(nW * num(e.mw)) + ' MW', null, { ro: true, w2: true }) + '</div>' +
    cfgTab(bloco('eo', '', e.frentes, [{ k: 'nome', rot: 'Frente', upper: true }, { k: 'km', rot: 'Acessos (km)', t: 'num' }, { k: 'wtg', rot: 'Aerogeradores (WTG)', t: 'num' }, { k: 'rmt', rot: 'Rede de média tensão (km)', t: 'num' }], svp, function () { return { nome: 'FRENTE ' + ('0' + (e.frentes.length + 1)).slice(-2), km: 0, wtg: 0, rmt: 0 }; })));
}
function cfgSe(p, svp) {
  var e = p.se || (p.se = { equip: [], sa: [], casa: 0, patio: 0 }); e.equip = e.equip || []; e.sa = e.sa || [];
  return cfgCard('Configuração da subestação', 'Equipamentos por modelo. Cada equipamento gera no cronograma: fundação, suporte, montagem, conexão e comissionamento até a energização. Transformadores, autotransformadores e reatores são tratados como equipamentos principais (um a um).', '<div class="cf">' +
    cfgCampo('se-cc', 'Casa de comando', e.casa, function (x) { e.casa = x; svp(); agendar(); }, { t: 'num', suf: 'm²' }) + cfgCampo('se-pt', 'Área do pátio', e.patio, function (x) { e.patio = x; svp(); agendar(); }, { t: 'num', suf: 'm²', dica: 'Opcional: dimensiona terraplenagem, malha de terra e brita.' }) + '</div>' +
    cfgTab(bloco('seq', 'Equipamentos', e.equip, [{ k: 'tipo', rot: 'Equipamento', ops: SE_TIPOS }, { k: 'modelo', rot: 'Modelo / descrição', upper: true }, { k: 'kv', rot: 'Tensão (kV)', t: 'num' }, { k: 'qtd', rot: 'Quantidade', t: 'num' }], svp, function () { return { tipo: SE_TIPOS[0], modelo: '', kv: 0, qtd: 1 }; })) +
    cfgTab(bloco('ses', 'Serviços auxiliares', e.sa, [{ k: 'd', rot: 'Item (painel CA/CC, banco de baterias, retificador, gerador…)', upper: true }, { k: 'qtd', rot: 'Quantidade', t: 'num' }], svp, function () { return { d: '', qtd: 1 }; })));
}

/* ---------- gerador do cronograma padrão ---------- */
/* atividades por subcampo da UFV: ordem, defasagem e duração tiradas da mediana dos 80 subcampos da UFV Paraíso (dias úteis; duração para 10,21 MWp) */
var TPL_UFV_SUB = [
  ['BEC1', '4.2', 'Bases dos Eletrocentros', 'Locação e Escavação', 0, 1, 'F'], ['BEC2', '4.2', 'Bases dos Eletrocentros', 'Concreto Magro', 5, 1, 'F'], ['BEC3', '4.2', 'Bases dos Eletrocentros', 'Armação e Forma', 8, 9, 'F'], ['BEC4', '4.2', 'Bases dos Eletrocentros', 'Concretagem', 17, 1, 'F'], ['BEC5', '4.2', 'Bases dos Eletrocentros', 'Impermeabilização', 29, 2, 'F'],
  ['CA1', '4.4', 'Cabos BTCA', 'Abertura de Valas', 31, 34, 'M', 'VALA_CA'], ['AT1', '4.4', 'Aterramento', 'Lançamento de Cabos', 32, 39, 'M', 'ATERR'], ['CA2', '4.4', 'Cabos BTCA', 'Lançamento', 33, 33, 'M', 'CABO_CA'], ['CA3', '4.4', 'Cabos BTCA', 'Fechamento de Valas', 36, 30, 'M'],
  ['CC1', '4.4', 'Cabos BTCC', 'Abertura de Valas', 52, 3, 'M', 'VALA_CC'], ['CC3', '4.4', 'Cabos BTCC', 'Fechamento de Valas', 53, 3, 'M'], ['IN1', '4.3', 'Inversores', 'Suporte', 55, 1, 'I'], ['EC1', '4.4', 'Eletrocentros', 'Posicionamento', 55, 1, 'F', 'MONT_ELC'],
  ['ES1', '4.3', 'Estacas', 'Distribuição', 69, 2, 'E'], ['ES2', '4.3', 'Estacas', 'Escavação', 74, 2, 'E'], ['BEC6', '4.2', 'Bases dos Eletrocentros', 'Caixas de Elétrica', 75, 4, 'F'], ['ES3', '4.3', 'Estacas', 'Cravação', 76, 2, 'E'],
  ['MT1', '4.4', 'Rede de MT e FO', 'Abertura de Valas', 77, 1, 'M', 'VALA_MT'], ['ES4', '4.3', 'Estacas', 'Concretagem', 86, 2, 'E'], ['BEC7', '4.2', 'Bases dos Eletrocentros', 'Tampas', 89, 4, 'F'],
  ['TR1', '4.3', 'Trackers', 'Distribuição', 110, 2, 'T'], ['TR2', '4.3', 'Trackers', 'Montagem', 114, 2, 'T', 'MONT_TRK'], ['AT2', '4.4', 'Aterramento', 'Trackers', 117, 1, 'T'], ['CC2', '4.4', 'Cabos BTCC', 'Lançamento', 120, 1, 'M', 'CABO_CC'],
  ['EC2', '4.4', 'Eletrocentros', 'Terminação BTCA', 126, 2, 'F'], ['AT3', '4.4', 'Aterramento', 'Eletrocentros', 127, 1, 'F'], ['MT2', '4.4', 'Rede de MT e FO', 'Lançamento de Cabos MT', 133, 1, 'M', 'CABO_MT'], ['MO1', '4.3', 'Módulos', 'Distribuição', 135, 1, 'D'], ['MT3', '4.4', 'Rede de MT e FO', 'Lançamento de Cabos FO', 136, 1, 'M', 'CABO_FO'],
  ['MT4', '4.4', 'Rede de MT e FO', 'Fechamento de Valas', 138, 1, 'M'], ['MO2', '4.3', 'Módulos', 'Montagem', 139, 2, 'D', 'MONT_MOD'], ['IN2', '4.3', 'Inversores', 'Montagem', 139, 2, 'I', 'MONT_INV'], ['TR3', '4.3', 'Trackers', 'Eletrônico', 140, 2, 'T'],
  ['AT4', '4.4', 'Aterramento', 'Inversores', 141, 1, 'I'], ['IN3', '4.4', 'Inversores', 'Terminação BTCC', 141, 1, 'I'], ['MO3', '4.3', 'Módulos', 'Interconexão', 161, 1, 'D'], ['IN4', '4.4', 'Inversores', 'Terminação BTCA', 170, 2, 'I'],
  ['CF1', '5', 'Comissionamento a Frio', 'Resistência de Isolamento | Cabos BTCA', 180, 1, 'F'], ['CF2', '5', 'Comissionamento a Frio', 'Resistência de Isolamento | Cabos BTCC', 180, 1, 'F'], ['CF3', '5', 'Comissionamento a Frio', 'Passo e Toque | Aterramento', 182, 1, 'F'], ['CF4', '5', 'Comissionamento a Frio', 'Resistência da Malha | Aterramento', 182, 1, 'F'],
  ['CF5', '5', 'Comissionamento a Frio', 'Polaridade | Cabos BTCC', 182, 1, 'F'], ['CF6', '5', 'Comissionamento a Frio', 'VoC | Cabos BTCC', 184, 1, 'F'], ['CF7', '5', 'Comissionamento a Frio', 'Amarração | Cabos BTCC', 186, 1, 'F'], ['CF8', '5', 'Comissionamento a Frio', 'Conexão nos Inversores | Cabos BTCC', 188, 1, 'F'],
  ['CF9', '5', 'Comissionamento a Frio', 'Inversores', 190, 1, 'F'], ['CF10', '5', 'Comissionamento a Frio', 'Fusão e OTDR | Cabos FO', 197, 1, 'F'], ['EC3', '4.4', 'Eletrocentros', 'Terminação MT', 201, 1, 'F'], ['CF11', '5', 'Comissionamento a Frio', 'Trackers', 202, 1, 'F'],
  ['LM1', '5', 'Limpeza de Módulos', 'Pré-Comissionamento a Quente', 203, 1, 'M'], ['CF12', '5', 'Comissionamento a Frio', 'VLF.DP | Cabos MT', 221, 1, 'F'], ['CF13', '5', 'Comissionamento a Frio', 'Eletrocentros', 237, 1, 'F']];
var ENG_UFV = ['Canteiro de Obras', 'Civil', 'Fundações e Estacas', 'Eletromecânico', 'Elétrico BT', 'Elétrico MT e RMT', 'Automação e SCADA', 'CFTV'];
var ENG_EOL = ['Canteiro de Obras e Usina de Concreto', 'Estudos Preliminares (Topografia, Sondagens e Ensaios de Solo)', 'Acessos e Plataformas (Geométrico, Terraplenagem, Drenagem e Pavimentação)', 'Fundações dos Aerogeradores (Geotécnico e Estrutural)', 'Rede de Média Tensão (Aérea e Subterrânea)', 'Sinalização'];
/* parque eólico: construção modelada no cronograma executivo R08 do Parque Eólico Cajuína 3 (durações em dias úteis) */
var EOL_WTG = [ /* chave, atividade, duração, tipo do vínculo com a anterior, defasagem, suprimentos que precisam estar entregues */
  ['EF', 'Escavação da fundação', 6], ['DR', 'Desmonte de rocha', 3, 'SS', 3, ['S_DES']], ['LR', 'Limpeza e regularização do fundo da cava', 2, 'FS', 0], ['EP', 'Ensaio de placa da cava', 1, 'FS', 10], ['SC', 'Solo-cimento', 1, 'FS', 0],
  ['LF', 'Liberação da fundação', 1, 'FS', 5], ['ED', 'Instalação de eletroduto corrugado', 1, 'FS', 0, ['F_PEAD']], ['LM', 'Lastro de concreto magro', 1, 'FS', 0, ['MUS']], ['FI', 'Fôrma interna', 1, 'FS', 0, ['F_FOR']],
  ['AR', 'Armação', 6, 'FS', 5, ['F_ACO', 'MOB_ARM', 'F_FUN']], ['MI', 'Malha de aterramento interna', 1, 'FS', 0, ['F_ATR']], ['FE', 'Fôrma externa', 1, 'FS', 0], ['CO', 'Concretagem da base', 1, 'FS', 0, ['F_CIM']],
  ['DF', 'Desforma', 1, 'FS', 5], ['AI', 'Acabamento e impermeabilização', 1, 'FS', 0], ['ME', 'Malha de aterramento externa', 1, 'FS', 0], ['RB', 'Reaterro da base', 6, 'FS', 0], ['DPE', 'Drenagem perimetral', 3, 'SS', 0],
  ['CT', 'Cimbramento e fôrma da tampa', 1, 'FS', 3, null, 'RB'], ['TA', 'Concretagem da tampa', 1, 'FS', 0], ['DT', 'Desforma da tampa', 1, 'FS', 2], ['AF', 'Arremates e acabamentos finais', 1, 'FS', 0],
  ['PV', 'Pavimentação da plataforma', 3, 'FS', 0], ['PE', 'Ensaio de placa da plataforma', 2, 'FS', 0], ['LP', 'Liberação da plataforma', 2, 'FS', 0], ['MP', 'Plataforma liberada e apta a receber componentes', 0, 'FS', 0], ['DSP', 'Drenagem superficial da plataforma', 6, 'FS', 10, null, 'LP']];
var EOL_RMT = [ /* chave, grupo, atividade, duração de referência (≈ 4 km de rede), vínculos */
  ['R1', 'Preparação do Terreno', 'Supressão vegetal semimecanizada', 14, [['@SUP', 'SS', 0]]], ['R2', 'Preparação do Terreno', 'Supressão vegetal mecanizada', 14, [['R1', 'SS', 5]]],
  ['R3', 'Preparação do Terreno', 'Conformação do solo', 17, [['R2', 'SS', 5]]], ['R4', 'Preparação do Terreno', 'Escavação das fundações dos postes', 22, [['R3', 'SS', 2], ['#4', 'FS']]],
  ['R5', 'Rede Aérea', 'Distribuição de postes', 34, [['R4', 'SS', 5]]], ['R6', 'Rede Aérea', 'Equipagem e verticalização de postes', 34, [['R5', 'SS', 11], ['F_POS', 'FS']]],
  ['R7', 'Rede Aérea', 'Concretagem das fundações dos postes', 39, [['R6', 'SS', 11], ['MUS', 'FS']]], ['R8', 'Rede Aérea', 'Lançamento dos cabos guarda', 22, [['R7', 'SS', 16], ['F_CAB', 'FS']]],
  ['R9', 'Rede Aérea', 'Lançamento dos cabos de potência', 22, [['R8', 'SS', 5]]], ['R10', 'Rede Aérea', 'Equipagem de chaves seccionadoras e para-raios', 17, [['R9', 'SS', 10], ['F_PRA', 'FS'], ['F_CHS', 'FS']]],
  ['R11', 'Rede Aérea', 'Conexão com aterramento e acessórios', 17, [['R10', 'SS', 5], ['F_MIS', 'FS']]], ['R12', 'Rede Aérea', 'Lançamento dos cabos aéreos de fibra óptica', 17, [['R11', 'SS', 5], ['F_CFO', 'FS']]],
  ['R13', 'Rede Aérea', 'Caixas de emenda e fusões ópticas', 17, [['R12', 'SS', 5]]],
  ['R14', 'Rede Subterrânea', 'Escavação de valas', 17, [['R1', 'SS', 11]]], ['R15', 'Rede Subterrânea', 'Instalação de eletrodutos e caixas', 17, [['R14', 'SS', 5], ['F_PEAD', 'FS']]],
  ['R16', 'Rede Subterrânea', 'Reaterro das valas', 17, [['R15', 'SS', 5]]], ['R17', 'Rede Subterrânea', 'Lançamento de cabos subterrâneos (MT, fibra óptica e aterramento)', 17, [['R8', 'SS', 0], ['R15', 'SS', 5]]],
  ['R18', 'Rede Subterrânea', 'Terminações externas dos cabos isolados (postes)', 17, [['R17', 'SS', 5]]]];
function eolCanteiro(add, aprov) {
  var C = ['4.1', 'Canteiro de Obras'], U = ['4.1', 'Usina de Concreto'], M = ['4.1', 'Mobilização de Mão de Obra e Equipamentos'];
  add('CT1', C, 'Elaboração do layout geral do canteiro', { du: 20, deps: [['M_OS', 'FS']] });
  add('CT2', C, 'Melhoria do acesso ao canteiro', { du: 7, deps: [['MOB', 'SS', 5]] });
  add('CT3', C, 'Terraplenagem dos platôs do canteiro', { du: 28, deps: [['CT2', 'FS'], ['CT1', 'FS']] });
  add('CANT', C, 'Construção do canteiro', { du: 28, deps: [['CT3', 'SS', 0]] });
  add('CT5', C, 'Sinalização definitiva do canteiro', { du: 8, deps: [['CANT', 'SS', 20]] });
  add('CT6', C, 'Cercamento do canteiro', { du: 8, deps: [['CANT', 'SS', 20]] });
  add('CT7', C, 'SPDA do canteiro', { du: 5, deps: [['CANT', 'SS', 23]] });
  add('MCAN', C, 'Conclusão da mobilização e do canteiro', { du: 0, m: 1, deps: [['CANT', 'FS'], ['CT6', 'FS']] });
  add('US1', U, 'Elaboração do layout da usina de concreto', { du: 30, deps: [['M_OS', 'FS']] });
  add('US2', U, 'Preparo da área de estocagem e estrutura', { du: 10, deps: [['CT3', 'SS', 10], ['US1', 'FS']] });
  add('US3', U, 'Fundação e infraestrutura da usina', { du: 21, deps: [['US2', 'FS']] });
  add('US4', U, 'Montagem da usina de concreto', { du: 30, deps: [['US3', 'FS']] });
  add('MUS', U, 'Mobilização da usina de concreto', { du: 0, m: 1, deps: [['US4', 'FS']] });
  add('MOB_SUP', M, 'Mobilização de mão de obra e equipamentos | Supressão vegetal', { du: 25, deps: [['MOB', 'SS', 0]] });
  add('MOB_TER', M, 'Mobilização de mão de obra e equipamentos | Terraplenagem', { du: 25, deps: [['MOB_SUP', 'SS', 3]] });
  add('MOB_DRE', M, 'Mobilização de mão de obra e equipamentos | Drenagem', { du: 22, deps: [['MOB_SUP', 'SS', 15]] });
  add('MOB_ARM', M, 'Mobilização de mão de obra e equipamentos | Armação', { du: 22, deps: [['MOB_SUP', 'SS', 40]] });
  add('MOB_CIV', M, 'Mobilização de mão de obra e equipamentos | Civil', { du: 22, deps: [['MOB_SUP', 'SS', 40]] });
  /* suprimentos: datas de necessidade dos materiais e serviços (Cajuína 3) */
  var F = function (k, nome, grupo, du, ap) { add(k, ['3', grupo], nome, { du: du, deps: [[ap, 'FS']] }); };
  F('F_FOR', 'Fôrmas | Fornecimento', 'Fornecimento de Material Civil', 6, aprov(3)); F('F_ACO', 'Aço CA-50 | Fornecimento', 'Fornecimento de Material Civil', 6, aprov(3));
  F('F_CIM', 'Cimento | Fornecimento', 'Fornecimento de Material Civil', 6, aprov(3)); F('F_PEAD', 'Eletroduto PEAD | Fornecimento', 'Fornecimento de Material Civil', 6, aprov(3)); F('F_ATR', 'Material de aterramento | Fornecimento', 'Fornecimento de Material Civil', 6, aprov(3));
  F('F_POS', 'Estruturas de concreto (postes e cruzetas) | Fornecimento', 'Fornecimento de Material Eletromecânico', 40, aprov(4)); F('F_PRA', 'Para-raios | Fornecimento', 'Fornecimento de Material Eletromecânico', 60, aprov(4));
  F('F_CHS', 'Chaves seccionadoras | Fornecimento', 'Fornecimento de Material Eletromecânico', 60, aprov(4)); F('F_CAB', 'Cabos condutores | Fornecimento', 'Fornecimento de Material Eletromecânico', 60, aprov(4));
  F('F_CFO', 'Cabos de fibra óptica | Fornecimento', 'Fornecimento de Material Eletromecânico', 60, aprov(4)); F('F_MIS', 'Miscelâneas da rede | Fornecimento', 'Fornecimento de Material Eletromecânico', 30, aprov(4));
  F('F_FUN', 'Materiais das fundações dos aerogeradores (insertos) | Fornecimento da contratante', 'Fornecimento da Contratante', 35, aprov(3));
  add('S_DES', ['3', 'Contratação de Serviços'], 'Desmonte de rocha | Contratação de serviço', { du: 60, deps: [['M_OS', 'FS']] });
  add('S_TOP', ['3', 'Contratação de Serviços'], 'Topografia | Contratação de serviço', { du: 45, deps: [['M_OS', 'FS']] });
  add('S_LAB', ['3', 'Contratação de Serviços'], 'Laboratório | Contratação de serviço', { du: 45, deps: [['M_OS', 'FS']] });
  add('S_JAZ', ['1.2'], 'Licenciamento de jazidas', { du: 100, deps: [['M_OS', 'FS']] });
}
function eolConstrucao(p, add, aprov, idx) {
  var e = p.eol || {}, frs = (e.frentes || []).filter(function (f) { return num(f.wtg) > 0 || num(f.km) > 0; }), rit = e.ritmo == null ? 5 : Math.max(1, num(e.ritmo)), mont = e.montagem == null ? 10 : Math.max(1, num(e.montagem));
  var pad = function (n) { return ('0' + n).slice(-2); }, gw = 0, energ = [];
  frs.forEach(function (f, fi) {
    var nm = f.nome || 'FRENTE ' + pad(fi + 1), km = Math.max(0.1, num(f.km) || 1), k = km / 2, kr = Math.min(3, Math.max(0.4, (num(f.rmt) || km) / 4));
    var d = function (ref, mn) { return Math.max(mn, Math.round(ref * k)); }, P = 'E' + fi, A = function (x) { return P + x; }, o = { sp: nm, sc: nm, ds: 'Civil' };
    var pa = ['4.2', nm, 'Acessos (' + nf2.format(km).replace(/,00$/, '') + ' km)'], dp = ['4.2', nm, 'Drenagem Profunda dos Acessos'], pv = ['4.2', nm, 'Pavimentação dos Acessos'], ds = ['4.2', nm, 'Drenagem Superficial e Sinalização'];
    var ad = function (key, path, nome, du, deps, extra) { return add(A(key), path, nome + ' | ' + nm, Object.assign({ du: du, deps: deps }, o, extra || {})); };
    ad('SUP', pa, 'Supressão vegetal dos acessos', d(6, 2), [['LIB', 'FS'], ['MOB_SUP', 'SS', 5], ['S_TOP', 'FS']]);
    ad('ESC1', pa, 'Escavação em solo e rocha de 1ª e 2ª categoria', d(25, 4), [[A('SUP'), 'SS', 3], ['MOB_TER', 'FS'], [aprov(2), 'FS']]);
    ad('DES', pa, 'Desmonte de rocha', d(25, 4), [[A('ESC1'), 'SS', 5], ['S_DES', 'FS']]);
    ad('ESC3', pa, 'Escavação em rocha de 3ª categoria', d(25, 4), [[A('DES'), 'SS', 3]]);
    ad('ATE', pa, 'Aterro', d(30, 5), [[A('ESC1'), 'SS', 8], ['S_LAB', 'FS']]);
    ad('DP1', dp, 'Escavação da drenagem profunda', d(8, 3), [[A('ESC1'), 'SS', 2], ['MOB_DRE', 'FS']]);
    ad('DP2', dp, 'Implantação de bueiros e tubos', d(8, 3), [[A('DP1'), 'FS']]); ad('DP3', dp, 'Reaterro da drenagem profunda', d(8, 3), [[A('DP2'), 'FS']]);
    ad('DP4', dp, 'Alas e caixas', d(8, 3), [[A('DP3'), 'FS']]); ad('DP5', dp, 'Dissipadores de energia', d(8, 3), [[A('DP4'), 'FS']]);
    ad('SB', pv, 'Sub-base', d(6, 2), [[A('ATE'), 'FS', 5], ['S_JAZ', 'FS']]); ad('BAS', pv, 'Base', d(7, 2), [[A('SB'), 'SS', 1]]); ad('ENS', pv, 'Ensaio de placa dos acessos', 1, [[A('BAS'), 'FS']]);
    ad('SN1', ds, 'Sinalização provisória', 6, [[A('SUP'), 'SS', 0]]);
    ad('DS', ds, 'Meio-fio, sarjetas, valetas e descidas d\'água', d(16, 4), [[A('BAS'), 'FS', 20]]);
    ad('SN2', ds, 'Sinalização definitiva', 6, [[A('BAS'), 'FS', 5], [aprov(5), 'FS']]);
    /* fundações e plataformas: uma sequência por aerogerador, uma a cada "ritmo" dias úteis */
    var n = Math.max(0, Math.round(num(f.wtg))), ant = null, mAnt = null, ultM = null;
    for (var w = 0; w < n; w++) {
      gw++; var B = P + 'W' + w, wn = 'WTG ' + pad(gw), pw = ['4.2', nm, 'Fundações e Plataformas', wn], prev = null;
      EOL_WTG.forEach(function (st, si) {
        var deps = [];
        if (!si) { deps = [[A('ESC1'), 'SS', 7], [aprov(3), 'FS'], ['MOB_CIV', 'SS', 0]]; if (ant) deps.push([ant, 'SS', rit]); }
        else deps.push([B + (st[6] || prev), st[3] || 'FS', st[4] || 0]);
        (st[5] || []).forEach(function (x) { deps.push([x, 'FS']); });
        add(B + st[0], pw, st[1] + ' | ' + wn, Object.assign({ du: st[2], deps: deps, m: st[2] ? 0 : 1 }, o, { sc: wn }));
        prev = st[0];
      });
      ant = B + 'EF';
      /* fornecimento e montagem do aerogerador: escopo da contratante */
      var kM = B + 'MON'; add(kM, ['4.3', nm, 'Aerogeradores (fornecimento e montagem pela contratante)'], 'Montagem do aerogerador | ' + wn + ' | Contratante', Object.assign({ du: mont, deps: [[B + 'MP', 'FS']].concat(mAnt ? [[mAnt, 'FS']] : []) }, o, { sc: wn, ds: 'Eletromecânico' }));
      mAnt = kM; ultM = kM;
    }
    /* rede de média tensão: uma entrega por frente */
    var pr = function (g) { return ['4.4', nm, 'Rede de Média Tensão', g]; };
    EOL_RMT.forEach(function (r) {
      var deps = r[4].map(function (x) { var key = x[0] === '@SUP' ? A('SUP') : x[0] === '#4' ? aprov(4) : /^R\d+$/.test(x[0]) ? A(x[0]) : x[0]; return [key, x[1], x[2] || 0]; });
      add(A(r[0]), pr(r[1]), r[2] + ' | ' + nm, Object.assign({ du: Math.max(3, Math.round(r[3] * kr)), deps: deps }, o, { ds: 'Elétrico' }));
    });
    var c5 = ['5', 'Comissionamento da Rede de Média Tensão', nm];
    add(A('C1'), c5, 'Ensaios preliminares nos cabos de média tensão | ' + nm, Object.assign({ du: Math.max(5, Math.round(22 * kr)), deps: [[A('R18'), 'FS', 5]] }, o));
    add(A('C2'), c5, 'Ensaios avançados nos cabos de média tensão | ' + nm, Object.assign({ du: Math.max(5, Math.round(22 * kr)), deps: [[A('C1'), 'SS', 1]] }, o));
    add(A('C3'), c5, 'Inspeção de comissionamento da RMT aérea | ' + nm, Object.assign({ du: Math.max(5, Math.round(17 * kr)), deps: [[A('C2'), 'SS', 3], [A('R13'), 'FS']] }, o));
    add(A('C4'), c5, 'RMT apta à energização | ' + nm, Object.assign({ du: 0, m: 1, deps: [[A('C3'), 'FS']] }, o));
    /* atividades vinculadas aos aerogeradores (depois da montagem pela contratante) */
    var va = ['5', 'Atividades Vinculadas aos Aerogeradores', nm], dv = Math.max(3, 4 * n), base = ultM ? [[ultM, 'FS'], [A('C4'), 'FS']] : [[A('C4'), 'FS']];
    add(A('V1'), va, 'Terminações internas dos cabos isolados (SWG) | ' + nm, Object.assign({ du: dv, deps: base }, o));
    add(A('V2'), va, 'Conexão dos cabos de média tensão nos aerogeradores | ' + nm, Object.assign({ du: dv, deps: [[A('V1'), 'SS', 0]] }, o));
    add(A('V3'), va, 'Ensaios nos cabos de média tensão dos aerogeradores | ' + nm, Object.assign({ du: dv, deps: [[A('V1'), 'SS', 2]] }, o));
    add(A('V4'), va, 'Montagem de DIOs, conexões e fusões ópticas | ' + nm, Object.assign({ du: dv, deps: [[A('V2'), 'SS', 4]] }, o));
    add(A('V5'), va, 'Comissionamento da rede óptica | ' + nm, Object.assign({ du: dv, deps: [[A('V4'), 'SS', 7]] }, o));
    add(A('V6'), va, 'Energização da RMT subterrânea | ' + nm, Object.assign({ du: dv, deps: [[A('V5'), 'SS', 3], [A('V3'), 'FS']] }, o));
    energ.push(A('V6'));
  });
  if (!energ.length) { add('EXEC', ['4'], 'Execução da obra (configure as frentes do parque eólico)', { du: 120, deps: [['MOB', 'FS']] }); return ['EXEC']; }
  add('ENERG', ['5'], 'Aptidão para energização dos aerogeradores (WTG)', { du: 0, m: 1, deps: energ.map(function (k) { return [k, 'FS']; }) });
  add('COMWTG', ['5'], 'Comissionamento e testes dos aerogeradores | Contratante', { du: 80, deps: [['ENERG', 'FS']] });
  add('OPC', ['5'], 'Operação comercial sem pendências impeditivas', { du: 0, m: 1, deps: [['COMWTG', 'FS']] });
  return ['OPC'];
}
var ENG_SE = ['Canteiro de Obras', 'Civil e Fundações', 'Malha de Aterramento', 'Eletromecânico (arranjo e estruturas)', 'Casa de Comando', 'Proteção, Controle e Supervisão (SPCS)', 'Telecomunicações', 'Serviços Auxiliares'];
function croGerarPadrao(p) {
  var falta = cfgFalta(p); if (falta.length) { msgbox('AVISO!', 'Complete os dados do projeto antes de gerar o cronograma:\n\n' + falta.join('\n')); return 0; }
  var cx = ctxDe(p), cal = E.calendar(p, cx), c = p.contrato, ufv = p.categoria === 'UFV', se = p.categoria === 'SE', eol = p.categoria === 'EOL';
  var util = function (d) { return cal.util(d); }, prox = function (d) { while (!util(d)) d++; return d; };
  var soma = function (d, n) { d = prox(d); while (n > 0) { d++; if (util(d)) n--; } return d; }; /* n-ésimo dia útil depois */
  var fim = function (s, du) { return du <= 1 ? s : soma(s, du - 1); };
  var D = function (s) { return s ? E.day(s) : null; };
  var T = [], seq = 0, idx = {}, add = function (k, path, nome, o) {
    if (/^\d\.\d$/.test(path[0])) path = [path[0].split('.')[0]].concat(path);
    var t = Object.assign({ k: k, path: path, n: nome, du: 1, deps: [] }, o || {}); t.u = ++seq; T.push(t); if (k) idx[k] = t;
    /* agenda (passada para frente): data fixa, ou a maior das restrições das predecessoras */
    var s = t.fixo != null ? t.fixo : prox(t.min != null ? t.min : D(c.os));
    if (t.fixo == null) t.deps.forEach(function (dp) { var a = idx[dp[0]]; if (!a) return; var L = dp[2] || 0, r;
      if (dp[1] === 'SS') r = L > 0 ? soma(a.s, L) : a.s; else r = a.du ? soma(a.f, 1 + L) : (L > 0 ? soma(a.f, L) : prox(a.f));
      if (r > s) s = r; });
    t.s = s; t.f = t.du ? fim(s, t.du) : s; return t;
  };
  var G1 = function (op) { return [op.split('.')[0]].concat(op.indexOf('.') > 0 ? [op] : []); };
  var dos = D(c.os), dlic = D(c.licenca) || dos;
  /* 1 marcos e liberações */
  var mk = function (k, nome, d) { if (d != null) add(k, G1('1.1'), nome, { du: 0, fixo: d, m: 1 }); };
  mk('M_ASS', 'Assinatura do contrato', D(c.assinatura)); mk('M_LNTP', 'LNTP – aviso de início limitado', D(c.lntp)); mk('M_OS', 'Ordem de serviço', dos); mk('M_INI', 'Início contratual', D(c.inicio));
  (p.marcos || []).forEach(function (m, i) { if (m.data) mk('M_C' + i, (m.tipo === 'FINAL' ? 'Marco final | ' : 'Marco parcial | ') + (m.d || 'Marco ' + (i + 1)), D(m.data)); });
  if (c.licenca) add('M_LIC', G1('1.2'), 'Licença ambiental (LI)', { du: 0, fixo: dlic, m: 1 });
  add('LIB', G1('1.2'), 'Liberação da área', { du: 20, min: dlic, deps: c.licenca ? [['M_LIC', 'FS']] : [] });
  /* 2 engenharia: emissão e aprovação, cada disciplina com planta/layout, detalhes e memorial */
  (ufv ? ENG_UFV : se ? ENG_SE : eol ? ENG_EOL : ['Canteiro de Obras', 'Civil', 'Elétrico']).forEach(function (dsc, i) {
    var b = 'E' + i, ini = soma(dos, 5 + i * 5);
    add(b + 'P', ['2', 'Emissão | Projetos Executivos', dsc], 'Planta / Layout | ' + dsc, { du: 30, min: ini });
    add(b + 'D', ['2', 'Emissão | Projetos Executivos', dsc], 'Detalhes | ' + dsc, { du: 40, deps: [[b + 'P', 'SS', 10]] });
    add(b + 'M', ['2', 'Emissão | Projetos Executivos', dsc], 'Memorial | ' + dsc, { du: 10, deps: [[b + 'P', 'FS']] });
    ['P', 'D', 'M'].forEach(function (x) { add(b + 'A' + x, ['2', 'Aprovação | Projetos Executivos', dsc], ({ P: 'Planta / Layout', D: 'Detalhes', M: 'Memorial' })[x] + ' | ' + dsc, { du: 10, deps: [[b + x, 'FS']] }); });
  });
  var aprov = function (i) { return 'E' + i + 'AD'; };
  /* 4.1 canteiro e infraestrutura; 4.2 civil básica (durações proporcionais às da UFV Paraíso, 817 MWp) */
  var u = p.ufv || {}, subs = [], mwp = 0;
  if (ufv) (u.parques || []).forEach(function (pq, a) { for (var j = 0; j < num(pq.sub); j++) { var m = num(pq.mod) * num(u.wp) / 1e6; mwp += m; subs.push({ pq: pq, a: a, j: j, mwp: m, nome: (pq.nome || 'PARQUE ' + (a + 1)) + '.' + ('0' + (j + 1)).slice(-2), cod: (a + 1) + '.' + (j + 1) }); } });
  var esc_ = function (ref, mn) { return Math.max(mn, Math.round(ufv ? ref * mwp / 817 : mn)); };
  add('MOB', G1('4.1'), 'Mobilização', { du: 15, deps: [['M_OS', 'FS']] });
  if (!eol) add('CANT', G1('4.1'), 'Canteiro de Obras', { du: ufv ? Math.max(30, Math.round(134 * Math.sqrt(mwp / 817))) : 40, deps: [['MOB', 'SS', 5]] });
  else eolCanteiro(add, aprov);
  if (p.opc && p.opc.guarita) add('GUA', G1('4.1'), 'Guarita', { du: 20, deps: [['CANT', 'SS', 10]] });
  if (p.opc && p.opc.entroncamento) add('ENT', G1('4.1'), 'Entroncamento | Acesso Externo', { du: ufv ? esc_(44, 20) : 30, deps: [[aprov(1), 'FS']] });
  if (!eol) add('SUPV', G1('4.2'), 'Supressão Vegetal', { du: esc_(116, se ? 10 : 15), deps: [['LIB', 'FS']] });
  if (!eol) add('TERR', G1('4.2'), 'Terraplenagem | Regularização de Área', { du: ufv ? esc_(124, 20) : Math.max(20, Math.round(num((p.se || {}).patio) / 600)), deps: [['SUPV', 'SS', 15]] });
  if (!eol) add('CERC', G1('4.2'), 'Cercamento Perimétrico', { du: esc_(92, 20), deps: [['TERR', 'SS', ufv ? 60 : 10]] });
  if (!eol) add('DREN', G1('4.2'), 'Drenagem', { du: esc_(253, 30), deps: [['TERR', 'SS', 30]] });
  if (!eol) add('ACES', G1('4.2'), 'Acessos Internos', { du: esc_(106, 20), deps: [['TERR', 'SS', ufv ? 100 : 20]] });
  /* 3 suprimentos e montagem */
  var ultimos = [];
  if (ufv) {
    var forn = [['F_EST', 'Fornecimento de Estacas', 2, 91, 'ES1'], ['F_TRK', 'Fornecimento de Trackers', 3, 153, 'TR1'], ['F_MOD', 'Fornecimento de Módulos', 3, 149, 'MO1'], ['F_INV', 'Fornecimento de Inversores', 4, 23, 'IN1'], ['F_EC', 'Fornecimento de Eletrocentros', 5, 63, 'EC1'],
      ['F_BTCA', 'Cabos BTCA | Fornecimento', 4, 48, 'CA2'], ['F_BTCC', 'Cabos BTCC | Fornecimento', 4, 25, 'CC2'], ['F_MT', 'Cabos MT | Fornecimento', 5, 105, 'MT2'], ['F_FO', 'Cabos FO | Fornecimento', 5, 10, 'MT3'], ['F_ATR', 'Cabos de Aterramento | Fornecimento', 4, 28, 'AT1'], ['F_TERM', 'Terminações | Fornecimento', 5, 90, 'EC2']];
    forn.forEach(function (x) { add(x[0], G1('3'), x[1], { du: x[3], deps: [[aprov(x[2]), 'FS']] }); });
    /* subcampo 1 começa quando o terreno e os materiais permitem */
    var off = {}; TPL_UFV_SUB.forEach(function (a) { off[a[0]] = a[4]; });
    var ancora = soma(idx.TERR.s, 20); forn.forEach(function (x) { var lim = soma(idx[x[0]].s, 15), o2 = off[x[4]] || 0, cand = lim; var back = 0; while (back < o2) { cand--; if (util(cand)) back++; } if (cand > ancora) ancora = cand; });
    var ritmo = u.ritmo == null ? 2 : Math.max(0, num(u.ritmo)), anc = ancora, fator = function (s) { return s.mwp / 10.21; };
    subs.forEach(function (sb, si) {
      var a0 = si ? soma(anc, ritmo) : prox(ancora); anc = a0;
      var antes = null;
      TPL_UFV_SUB.forEach(function (a) {
        var k = 'S' + si + a[0], q = a[6] === 'F' ? a[5] : Math.max(1, Math.round(a[5] * fator(sb)));
        var t = add(k, [a[1], a[2], a[3], sb.pq.nome || 'PARQUE ' + (sb.a + 1)], a[3] + ' | ' + a[2] + ' | SC ' + sb.cod, { du: q, fixo: soma(a0, a[4]), deps: antes ? [[antes[0], 'SS', a[4] - antes[1]]] : (si ? [['S' + (si - 1) + 'BEC1', 'SS', ritmo]] : [['TERR', 'SS', 20]]), sp: (sb.pq.nome || 'PARQUE ' + (sb.a + 1)), sc: ('00' + (si + 1)).slice(-3) + '. ' + sb.nome, ds: a[2], sub: sb, tpl: a });
        if (t.s < a0) t.s = a0;
        antes = [k, a[4]];
      });
      ultimos.push('S' + si + 'CF13');
    });
    forn.forEach(function (x) { var t = idx['S0' + x[4]]; if (t) t.deps.push([x[0], 'SS', 15]); });
    add('SCADA', G1('5'), 'SCADA | Comissionamento', { du: 15, deps: ultimos.slice(-1).map(function (k) { return [k, 'FS']; }) });
    add('GRID', G1('5'), 'Conexão ao GRID', { du: 0, m: 1, deps: [['SCADA', 'FS']] });
    add('TERMO', ['5', 'Comissionamento a Quente'], 'Termografia | Comissionamento a Quente', { du: 30, deps: [['GRID', 'FS']] });
    add('IXV', ['5', 'Comissionamento a Quente'], 'Curva IxV | Comissionamento a Quente', { du: 30, deps: [['GRID', 'SS', 1]] });
    ultimos = ['TERMO', 'IXV'];
  }
  if (se) {
    var sx = p.se || {}, eq = (sx.equip || []).filter(function (x) { return num(x.qtd) > 0; }), casa = num(sx.casa);
    [['F_EST', 'Estruturas Metálicas e Pórticos | Fornecimento', 3, 90], ['F_CAB', 'Cabos de Controle e Força | Fornecimento', 5, 60], ['F_MAL', 'Malha de Aterramento e Conectores | Fornecimento', 2, 45], ['F_ISO', 'Isoladores e Ferragens | Fornecimento', 3, 60], ['F_CC', 'Materiais da Casa de Comando | Fornecimento', 4, 30]].forEach(function (x) { add(x[0], ['3', 'Materiais'], x[1], { du: x[3], deps: [[aprov(x[2]), 'FS']] }); });
    eq.forEach(function (x, i) { add('FE' + i, ['3', 'Equipamentos'], x.tipo + (x.modelo ? ' ' + x.modelo : '') + ' | Fornecimento', { du: SE_PRINCIPAL.test(x.tipo) ? 240 : 120, deps: [[aprov(3), 'FS']] }); });
    add('MALHA', G1('4.2'), 'Malha de Aterramento', { du: Math.max(20, Math.round(num(sx.patio) / 800)), deps: [['TERR', 'SS', 15], ['F_MAL', 'FS']] });
    add('CANA', G1('4.2'), 'Canaletas', { du: 30, deps: [['MALHA', 'SS', 10]] });
    if (casa) { add('CC1', ['4.2', 'Casa de Comando'], 'Fundação | Casa de Comando', { du: Math.max(10, Math.round(casa / 20)), deps: [['TERR', 'SS', 20]] }); add('CC2', ['4.2', 'Casa de Comando'], 'Estrutura e Alvenaria | Casa de Comando', { du: Math.max(20, Math.round(casa / 10)), deps: [['CC1', 'FS']] }); add('CC3', ['4.2', 'Casa de Comando'], 'Cobertura e Acabamento | Casa de Comando', { du: Math.max(15, Math.round(casa / 12)), deps: [['CC2', 'FS'], ['F_CC', 'FS']] }); add('CC4', ['4.4', 'Casa de Comando'], 'Instalações Elétricas | Casa de Comando', { du: Math.max(10, Math.round(casa / 15)), deps: [['CC3', 'SS', 5]] }); }
    var fins = [];
    eq.forEach(function (x, i) {
      var q = num(x.qtd), nm = x.tipo + (x.modelo ? ' ' + x.modelo : '') + (x.kv && !/KV/i.test(x.modelo || '') ? ' ' + x.kv + 'kV' : ''), pri = SE_PRINCIPAL.test(x.tipo);
      var un = pri ? Array.from({ length: q }, function (_, j) { return { n: nm + ' – ' + ('0' + (j + 1)).slice(-2), q: 1 }; }) : [{ n: nm + ' (' + q + ' un.)', q: q }];
      un.forEach(function (it, j) {
        var b = 'Q' + i + '_' + j, d = function (por, mn) { return pri ? mn : Math.max(mn, Math.ceil(it.q / por)); };
        add(b + 'F', ['4.2', 'Fundações dos Equipamentos'], 'Fundação | ' + it.n, { du: d(4, pri ? 20 : 3), deps: [['MALHA', 'SS', 10]] });
        if (pri) add(b + 'PC', ['4.2', 'Fundações dos Equipamentos'], 'Parede Corta-Fogo | ' + it.n, { du: 15, deps: [[b + 'F', 'SS', 10]] });
        add(b + 'S', ['4.3', 'Suportes'], 'Instalação do Suporte | ' + it.n, { du: d(6, pri ? 0 : 2) || 1, deps: [[b + 'F', 'FS', 7], ['F_EST', 'FS']] });
        add(b + 'M', ['4.3', 'Montagem dos Equipamentos'], 'Montagem | ' + it.n, { du: d(4, pri ? 15 : 2), deps: [[b + 'S', 'FS'], ['FE' + i, 'FS']] });
        if (pri) add(b + 'O', ['4.3', 'Montagem dos Equipamentos'], 'Tratamento de Óleo | ' + it.n, { du: 10, deps: [[b + 'M', 'FS']] });
        add(b + 'C', ['4.4', 'Conexão dos Equipamentos'], 'Conexão | ' + it.n, { du: d(6, pri ? 5 : 2), deps: [[pri ? b + 'O' : b + 'M', 'FS'], ['F_CAB', 'FS']] });
        add(b + 'K', ['5', 'Comissionamento dos Equipamentos'], 'Comissionamento | ' + it.n, { du: d(4, pri ? 10 : 2), deps: [[b + 'C', 'FS']] });
        fins.push(b + 'K');
      });
    });
    (sx.sa || []).forEach(function (x, i) { add('SA' + i + 'M', ['4.4', 'Serviços Auxiliares'], 'Montagem | ' + (x.d || 'Serviço auxiliar ' + (i + 1)), { du: Math.max(2, 2 * num(x.qtd)), deps: casa ? [['CC3', 'FS']] : [['CANA', 'FS']] }); add('SA' + i + 'K', ['5', 'Serviços Auxiliares'], 'Comissionamento | ' + (x.d || 'Serviço auxiliar ' + (i + 1)), { du: Math.max(1, num(x.qtd)), deps: [['SA' + i + 'M', 'FS']] }); fins.push('SA' + i + 'K'); });
    add('SPCS1', ['4.4', 'Proteção, Controle e Supervisão'], 'Montagem dos Painéis | SPCS', { du: 20, deps: casa ? [['CC3', 'FS']] : [['CANA', 'FS']] });
    add('SPCS2', ['4.4', 'Proteção, Controle e Supervisão'], 'Lançamento de Cabos de Controle', { du: 30, deps: [['CANA', 'FS'], ['F_CAB', 'FS']] });
    add('SPCS3', ['5', 'Proteção, Controle e Supervisão'], 'Comissionamento | SPCS', { du: 20, deps: [['SPCS1', 'FS'], ['SPCS2', 'FS']] }); fins.push('SPCS3');
    add('BRITA', G1('4.2'), 'Britagem e Urbanização', { du: 15, deps: fins.length ? [[fins[fins.length - 1], 'SS']] : [['CANA', 'FS']] });
    add('ENERG', G1('5'), 'Energização', { du: 0, m: 1, deps: fins.map(function (k) { return [k, 'FS']; }) });
    ultimos = ['ENERG'];
  }
  if (eol) ultimos = eolConstrucao(p, add, aprov, idx);
  if (!ufv && !se && !eol) { add('EXEC', G1('4'), 'Execução da obra', { du: 120, deps: [['TERR', 'FS']] }); ultimos = ['EXEC']; }
  /* 6 encerramento */
  add('PRAD', G1('6'), 'PRAD – recuperação de áreas degradadas', { du: 30, deps: ultimos.map(function (k) { return [k, 'FS']; }) });
  add('PUNCH', G1('6'), 'Punch list', { du: 30, deps: ultimos.map(function (k) { return [k, 'SS']; }) });
  add('DATA', G1('6'), 'Databook', { du: 20, deps: [['PUNCH', 'FS']] });
  add('ASB', G1('6'), 'As built', { du: 30, deps: [['PUNCH', 'FS']] });
  add('CAP', G1('6'), 'CAP – certificado de aceitação provisória', { du: 0, m: 1, deps: [['DATA', 'FS'], ['ASB', 'FS'], ['PRAD', 'FS']] });
  add('GER', G1('1.3'), 'Gerenciamento da obra', { min: dos, du: 1 });
  idx.GER.f = Math.max(idx.CAP.s, D(c.termino) || idx.CAP.s); idx.GER.du = Math.max(1, cal.uteis(idx.GER.s, idx.GER.f));
  mk('M_FIM', 'Término contratual', D(c.termino));
  return croMontarPadrao(p, T, idx, cal, subs, mwp);
}
function croMontarPadrao(p, T, idx, cal, subs, mwp) {
  var M = window.OPPadrao, nome = function (op) { return croEapNome(op); }, rows = [], u = 0, nodes = {}, hh = function (d, h) { return E.iso(d) + 'T' + h; };
  var root = { u: u++, w: '0', n: 'CRONOGRAMA ' + p.nome, l: 0, p: -1, s: 1 }; rows.push(root);
  var no = function (path) {
    var key = '', pai = root;
    path.forEach(function (seg, i) {
      key += '/' + seg; var nd = nodes[key];
      if (!nd) {
        var ehOp = /^\d(\.\d)?$/.test(seg) && i < 2, kids = rows.filter(function (r) { return r.p === pai.u; }).length;
        nd = nodes[key] = { u: u++, w: ehOp ? seg : pai.w + '.' + (kids + 1), n: ehOp ? nome(seg) : seg, l: pai.l + 1, p: pai.u, s: 1 }; if (ehOp) nd.op = seg; rows.push(nd);
      }
      pai = nd;
    });
    return pai;
  };
  var uid = {};
  T.forEach(function (t) {
    var pai = no(t.path), kids = rows.filter(function (r) { return r.p === pai.u; }).length;
    var r = { u: u++, w: pai.w + '.' + (kids + 1), n: t.n, l: pai.l + 1, p: pai.u, i: hh(t.s, '08:00'), f: hh(t.du ? t.f : t.s, t.du ? '17:00' : '08:00'), dm: (t.du || 0) * 480, pc: 0, pf: 0 };
    r.bi = r.i; r.bf = r.f; r.bdm = r.dm; if (t.m || !t.du) r.m = 1; if (t.sp) { r.sp = t.sp; r.sc = t.sc; r.ds = t.ds; }
    if (t.fixo != null && t.m) r.ct = 'MUST_START_ON', r.cd = r.i;
    uid[t.k] = r.u; t.r = r; rows.push(r);
  });
  T.forEach(function (t) { var pr = t.deps.map(function (d) { return uid[d[0]] != null ? [uid[d[0]], d[1] || 'FS', (d[2] || 0) * 480] : null; }).filter(Boolean); if (pr.length) t.r.pr = pr; });
  /* ordena como no Project: pai antes dos filhos, irmãos na ordem de criação */
  var kids = {}; rows.forEach(function (r) { (kids[r.p] = kids[r.p] || []).push(r); });
  var ord = [], walk = function (r) {
    ord.push(r); var K = (kids[r.u] || []).sort(function (a, b) { if (a.op && b.op) return cpuCmp(a.op, b.op); if (a.op || b.op) return a.op ? -1 : 1; return a.u - b.u; }), n = 0;
    K.forEach(function (c) { if (!c.op) c.w = (r.w === '0' ? '' : r.w + '.') + (++n + K.filter(function (x) { return x.op; }).length); walk(c); });
  };
  walk(root);
  croResumos(ord, 480);
  /* CPUs paramétricas ligadas às atividades, com as quantidades da configuração */
  p.mwp = Math.round(mwp * 100) / 100; if (p.categoria === 'UFV') p.porte = p.mwp;
  var meta = { titulo: root.n, inicio: root.i, fim: root.f, status: hh(E.day(new Date().toISOString()), '17:00'), n: ord.length, mpd: 480, mpw: 2640, dpm: 20, cal: 1, gerado: 'PADRAO', categoria: p.categoria };
  p._cro = null; croGravarTudo(p, { tasks: ord, cal: '', meta: meta, arq: 'cronograma padrão OP (' + (CATEGORIAS[p.categoria] || p.categoria) + ')' });
  var P = croParam(p); P.mwp = p.mwp; P.regras = P.mwp > 0 ? M.regrasPadrao() : []; P.sigla = P.sigla || semAcento(p.nome).replace(/[^A-Z0-9]/g, '').slice(0, 3);
  var X = cpuDados(), R0 = {}; (P.regras || []).forEach(function (r) { R0[r.id] = r; });
  var links = p._cro.cpus.links = {}, liga = function (t, rid, q) { var r = R0[rid]; if (!r || !q || !X.by[r.cpu]) return; (links[t.r.u] = links[t.r.u] || []).push({ c: r.cpu, q: Math.round(q * 1000) / 1000 }); };
  T.forEach(function (t) {
    if (t.sub && t.tpl && t.tpl[7]) { var sb = t.sub, rid = t.tpl[7], q = rid === 'MONT_MOD' ? num(sb.pq.mod) : rid === 'MONT_TRK' ? num(sb.pq.trk) : rid === 'MONT_INV' ? num(sb.pq.inv) : rid === 'MONT_ELC' ? 1 : num((R0[rid] || {}).k) * sb.mwp; liga(t, rid, q); }
  });
  if (p.categoria === 'UFV') {
    var tq = { mod: 0, trk: 0, inv: 0 }; subs.forEach(function (s) { tq.mod += num(s.pq.mod); tq.trk += num(s.pq.trk); tq.inv += num(s.pq.inv); });
    [['F_MOD', 'FORN_MOD', tq.mod], ['F_TRK', 'FORN_TRK', tq.trk], ['F_INV', 'FORN_INV', tq.inv], ['F_EC', 'FORN_ELC', subs.length]].forEach(function (x) { if (idx[x[0]]) liga(idx[x[0]], x[1], x[2]); });
    [['SUPV', 'SUPR'], ['TERR', 'TERRA_C'], ['TERR', 'TERRA_A'], ['ACES', 'ACES_SB'], ['ACES', 'ACES_B'], ['DREN', 'DREN'], ['CERC', 'CERCA'], ['CANT', 'CANT'], ['MOB', 'MOB'], ['GER', 'GER'], ['ASB', 'ASB'], ['SCADA', 'SCADA'], ['TERMO', 'COMIS'], ['IXV', 'PR']].forEach(function (x) { if (idx[x[0]] && R0[x[1]]) liga(idx[x[0]], x[1], M.qtdRegra(R0[x[1]], P.mwp)); });
  }
  /* venda da linha de base = custo das CPUs × (1 + BDI) */
  var bdi = typeof bdiCalc === 'function' ? bdiCalc(p.bdi) : 0, venda = 0;
  ord.forEach(function (r) { var L = links[r.u]; if (!L) return; var v = L.reduce(function (a, l) { return a + num(l.q) * cpuCalc(X.by[l.c], X).tot; }, 0) * (1 + bdi); r.bc = Math.round(v * 100) / 100; venda += r.bc; });
  croResumos(ord, 480);
  Object.keys(p._cro.parts).forEach(function (k) { gravar(croRaiz(p) + '/' + k, p._cro.parts[k]); });
  croSalvarDoc(p, 'cpus'); croSalvarDoc(p, 'param'); salvarMeta(p);
  croMudou(p); setTimeout(function () { croGerarFin(p); }, 300);
  return ord.length;
}
/* ================= CLIMA · RESUMO ECONÔMICO · KPI FÍSICO ================= */
var CLIMA_CAT = [[0, 'Sem influência do clima'], [2, 'Influência muito baixa'], [4, 'Influência baixa'], [6, 'Influência moderada'], [9, 'Influência alta'], [12, 'Trabalho impraticável']];
var MESES_N = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
function climaRot(n) { var c = CLIMA_CAT.filter(function (x) { return x[0] === +n; })[0] || CLIMA_CAT[0]; return ('0' + c[0]).slice(-2) + ' · ' + c[1]; }
function cfgClima(p, svp) {
  var c = p.clima || (p.clima = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), ed = podeEditar(), tot = c.reduce(function (a, x) { return a + num(x); }, 0);
  var s = '<p class="dsc">Classifique cada mês do ano pela influência do clima no local da obra. O número da categoria é a quantidade de dias improdutivos no mês: esses dias deixam de contar como dias úteis em todos os cálculos do projeto (dias úteis da FIN, HH e HM, custo diário e cronograma padrão). Os dias improdutivos são distribuídos por igual ao longo do mês.</p>';
  var cab = '<tr><th class="l">MÊS</th>' + CLIMA_CAT.map(function (x) { return '<th style="min-width:84px;white-space:normal;font-size:11px">' + ('0' + x[0]).slice(-2) + '<br><span style="font-weight:500;text-transform:none">' + x[1] + '</span></th>'; }).join('') + '<th style="white-space:normal">DIAS IMPROD.</th></tr>';
  var linhas = MESES_N.map(function (m, i) {
    return '<tr><td>' + m + '</td>' + CLIMA_CAT.map(function (x) {
      var on = num(c[i]) === x[0];
      return '<td class="c"><label class="clima-r' + (on ? ' on' : '') + '"><input type="radio" name="clima-' + i + '" aria-label="' + esc(m + ': ' + x[1]) + '"' + (on ? ' checked' : '') + (ed ? '' : ' disabled') + ' ' + h(function () { c[i] = x[0]; svp(); agendar(); }) + '></label></td>';
    }).join('') + '<td class="n"><b>' + num(c[i]) + '</b></td></tr>';
  }).join('');
  s += cfgCard('Condições climáticas por mês', 'Categoria de cada mês (vale para todos os anos da obra).', '<div class="tw"><table class="g clima"><thead>' + cab + '</thead><tbody>' + linhas + '<tr class="tt"><td>TOTAL NO ANO</td><td colspan="' + CLIMA_CAT.length + '"></td><td class="n">' + tot + ' dias</td></tr></tbody></table></div>');
  /* efeito nos meses da obra */
  try {
    var cal = E.calendar(p, ctxDe(p)), R = p.crono && p._cro ? croCalc(p) : null, ms = R && R.meses.length ? R.meses : (calc(p).res.months || []);
    if (ms.length) s += cfgCard('Efeito nos meses da obra', 'Dias úteis de cada mês antes e depois dos dias improdutivos.', '<div class="tw"><table class="g"><thead><tr><th class="l">MÊS</th>' + ms.map(function (mi) { return '<th>' + mmaa(mi) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      '<tr><td>Dias úteis do calendário</td>' + ms.map(function (mi) { return '<td class="n">' + cal.chuvaMes(mi).w + '</td>'; }).join('') + '</tr>' +
      '<tr><td>(−) Improdutivos por clima</td>' + ms.map(function (mi) { return '<td class="n">' + (cal.chuvaMes(mi).n || '–') + '</td>'; }).join('') + '</tr>' +
      '<tr class="at"><td>Dias produtivos</td>' + ms.map(function (mi) { var m = cal.chuvaMes(mi); return '<td class="n">' + (m.w - m.n) + '</td>'; }).join('') + '</tr></tbody></table></div>');
  } catch (e) { console.error(e); }
  return s;
}

/* custo dos dias improdutivos por clima: indireto do mês × dias improdutivos ÷ dias úteis do calendário */
function climaCusto(p, R, miHoje) {
  var o = { fut: 0, pas: 0 }; if (!R) return o;
  var cal = E.calendar(p, ctxDe(p));
  R.meses.forEach(function (mi) { var m = cal.chuvaMes(mi), ci = num(R.mCI[mi]); if (!m.n || !m.w || !ci) return; var v = ci * m.n / (m.w - m.n || 1); if (mi >= miHoje) o.fut += v; else o.pas += v; });
  return o;
}

/* ---------- resumo econômico compacto (Painel de gráficos) ---------- */
function graResumo(p) {
  if (p.crono && !p._cro) { croCarregar(p); return '<div class="vazio">Carregando o cronograma…</div>'; }
  var R = p.crono ? croCalc(p) : null, D = R ? croResultado(p, R) : null, hoje = E.day(new Date().toISOString()), miH = (function () { var y = E.ymd(hoje); return y[0] * 12 + y[1]; })();
  var c = calc(p), ci = R ? R.ciTot : c.fin.total.total, cd = R ? R.cdTot : 0, custo = cd + ci, V = R ? R.tot.v : 0, ev = R ? R.tot.ev : 0, ct = p.contrato || {}, valC = num((p.contratante || {}).valor);
  var Rr = relRecursos(p), pm = 0, top = null; Object.keys(Rr.ins).forEach(function (k) { var I = Rr.ins[k]; if (I.t === 'MO') pm += I.q; else if (I.t !== 'EQ' && !/^VERBA|CUSTO-META/.test(semAcento(I.d || '')) && (!top || I.q2 > top.q2)) top = I; });
  var cc = climaCusto(p, R, miH), rv = R ? R.tot.ev / (R.tot.v || 1) : 0;
  /* custo incorrido estimado: direto × avanço real + indireto dos meses já passados */
  var ciPas = 0; if (R) Object.keys(R.mCI).forEach(function (mi) { if (+mi < miH) ciPas += num(R.mCI[mi]); });
  var incorrido = cd * rv + ciPas, recLiq = ev * (1 - (D ? num(croParam(p).imp) + num(croParam(p).tac) : 0));
  var ini = E.day(ct.inicio || ''), fim = E.day(ct.termino || ''), meses = ini != null && fim != null ? (E.ymd(fim)[0] - E.ymd(ini)[0]) * 12 + E.ymd(fim)[1] - E.ymd(ini)[1] + 1 : 0;
  var M = function (v) { return v == null ? '<span class="vz">–</span>' : 'R$ ' + money(v); };
  var it = function (rot, val, sub, cls) { return '<div class="rs-i' + (cls ? ' ' + cls : '') + '"><span>' + rot + '</span><b>' + val + '</b>' + (sub ? '<i>' + sub + '</i>' : '') + '</div>'; };
  var pend = '<i>lançamento manual</i>';
  var bloco = function (tit, itens) { return '<section class="rs-b"><h3>' + tit + '</h3><div class="rs-g">' + itens.join('') + '</div></section>'; };
  var mesN = MESES_N[miH % 12].slice(0, 3).toUpperCase() + '/' + Math.floor(miH / 12);
  var s = '<div class="rs"><div class="rs-top"><span>Mês atual <b>' + mesN + '</b></span>' + (R ? '<span>Data de status <b>' + fdate(Math.floor(R.st)) + '</b></span>' : '') + '</div>';
  s += bloco('Contrato', [
    it('Valor do contrato', valC ? M(valC) : '<span class="vz">–</span>', valC ? '' : 'preencha no quadro Contratante'),
    it('Planilha revisada (venda LB)', R ? M(V) : '<span class="vz">–</span>'),
    it('Valor a aditar', valC && R ? M(V - valC) : '<span class="vz">–</span>', valC && R ? pct((V - valC) / valC) + ' do contrato' : '', valC && V - valC > 0 ? 'al' : ''),
    it('Início · término · prazo', ini != null && fim != null ? mmaa(E.ymd(ini)[0] * 12 + E.ymd(ini)[1]) + ' a ' + mmaa(E.ymd(fim)[0] * 12 + E.ymd(fim)[1]) : '<span class="vz">–</span>', meses ? meses + ' meses' : 'datas do contrato')]);
  s += bloco('Custo previsto', [
    it('Orçamento (custo direto CPU)', R ? M(cd) : '<span class="vz">–</span>'),
    it('Impostos e taxa de administração', D ? M(D.imp + D.tac) : '<span class="vz">–</span>'),
    it('Custo indireto (permanência)', M(ci), custo ? pct(ci / custo) + ' do custo total' : ''),
    it('Custo total da obra', M(custo)),
    it('Ociosidade e chuvas (futuro)', M(cc.fut), 'pelos dias improdutivos do clima'),
    it('Resultado final', D ? M(D.antes) : '<span class="vz">–</span>', D && V ? pct(D.antes / V) + ' da venda' : '', D && D.antes < 0 ? 'ru' : 'ok'),
    it('Insumo mais importante', top ? esc(top.d) : '<span class="vz">–</span>', top && custo ? 'R$ ' + money(top.q2) + ' · ' + pct(top.q2 / custo) : ''),
    it('Pessoas × mês', nf2.format(pm), 'soma do efetivo mensal')]);
  s += bloco('Situação atual', [
    it('Executado (valor agregado)', R ? M(ev) : '<span class="vz">–</span>', R ? pct(rv) + ' de avanço real' : ''),
    it('A executar', R ? M(V - ev) : '<span class="vz">–</span>'),
    it('Faturado', '<span class="vz">–</span>', pend), it('A medir', '<span class="vz">–</span>', pend), it('SENM (executado não medido)', '<span class="vz">–</span>', pend),
    it('Resultado atual (estimado)', R ? M(recLiq - incorrido) : '<span class="vz">–</span>', 'receita do executado − custo incorrido estimado', R && recLiq - incorrido < 0 ? 'ru' : ''),
    it('Ociosidade e chuvas (passado)', M(cc.pas)),
    it('Despesa / receita atual', R && recLiq ? nf2.format(incorrido / recLiq) : '<span class="vz">–</span>', 'abaixo de 1,00 é superávit'),
    it('Estoque', '<span class="vz">–</span>', pend), it('Valor a receber', '<span class="vz">–</span>', pend), it('Compromissos a pagar', '<span class="vz">–</span>', pend)]);
  s += '<p class="nota" style="margin:0">Custo incorrido estimado = custo direto × avanço real + custo indireto dos meses já passados. Faturado, medições, estoque, valores a receber e compromissos dependem dos lançamentos manuais de custos e medições (ainda não cadastrados).</p></div>';
  return s;
}

/* ---------- KPI físico por atividade (Relatórios › Planejamento) ---------- */
function relKpi(p, R, outAoa) {
  if (!R) return '<div class="vazio">Este projeto não tem cronograma: os indicadores físicos usam a linha de base e o avanço real do cronograma.</div>';
  var K = S.v.kpi || (S.v.kpi = { niv: 'M', st: '' }), st = R.st, T = p._cro.tasks;
  var sel = function (id, val, lista, set) { return '<select id="' + id + '" ' + h(function (el) { set(el.value); agendar(); }) + '>' + lista.map(function (o) { return '<option value="' + o[0] + '"' + (String(val) === String(o[0]) ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>'; };
  var lista = K.niv === 'F' ? R.leaves : K.niv === 'M' ? T.filter(function (t) { return R.macro[t.u]; }) : T.filter(function (t) { return t.l === +K.niv; });
  var vt = R.tot.v || 0, dut = R.tot.du || 0;
  var stat = function (t) {
    var n = R.N[t.u], pv = croPct(n, 'pv'), ev = croPct(n, 'ev'), bi = dn(t.bi || t.i), bf = dn(t.bf || t.f), ini = dn(t.as) || dn(t.i);
    var s = ev >= 0.999 ? 'C' : ev <= 0 && pv <= 0 ? 'N' : ev < pv - 0.005 ? 'A' : ev > pv + 0.005 ? 'D' : 'P';
    var tend = null; if (ev > 0 && ev < 0.999 && ini != null && st > ini) tend = st + (1 - ev) * (st - ini) / ev;
    return { t: t, n: n, pv: pv, ev: ev, bi: bi, bf: bf, s: s, tend: tend, atr: tend != null && bf != null ? Math.round(tend - bf) : (s === 'C' && dn(t.af) != null && bf != null ? Math.round(dn(t.af) - bf) : null), peso: vt ? n.v / vt : dut ? n.du / dut : 0 };
  };
  var ST = { C: ['Concluída', 'ok'], A: ['Atrasada', 'ru'], D: ['Adiantada', 'ok'], P: ['No prazo', ''], N: ['Não iniciada', 'vz'] };
  var L = lista.map(stat), cont = { C: 0, A: 0, D: 0, P: 0, N: 0 }; R.leaves.forEach(function (t) { cont[stat(t).s]++; });
  if (K.st) L = L.filter(function (x) { return x.s === K.st; });
  var pv = croPct(R.tot, 'pv'), ev = croPct(R.tot, 'ev'), nl = R.leaves.length || 1;
  var s = '<div class="gk cro-k">' + croKt('Avanço previsto (LB)', pct(pv), 'até ' + fdate(Math.floor(st))) + croKt('Avanço real', pct(ev), 'ponderado pela venda', 'hero') + croKt('SPI', pv ? nf2.format(ev / pv) : '–', 'real ÷ previsto', ev < pv ? 'ru' : '') +
    croKt('Atrasadas', int(cont.A), pct(cont.A / nl) + ' das atividades', cont.A ? 'ru' : '') + croKt('No prazo / adiantadas', int(cont.P + cont.D), pct((cont.P + cont.D) / nl)) + croKt('Concluídas', int(cont.C), pct(cont.C / nl)) + croKt('Não iniciadas', int(cont.N), pct(cont.N / nl)) + '</div>';
  s += '<div class="cpu-lb rel-f"><label>Nível ' + sel('kp-n', K.niv, [['M', 'Macroatividades'], ['2', 'Nível 2'], ['3', 'Nível 3'], ['4', 'Nível 4'], ['F', 'Todas as atividades']], function (v) { K.niv = v; }) + '</label>' +
    '<label>Situação ' + sel('kp-s', K.st, [['', 'Todas'], ['A', 'Atrasadas'], ['P', 'No prazo'], ['D', 'Adiantadas'], ['N', 'Não iniciadas'], ['C', 'Concluídas']], function (v) { K.st = v; }) + '</label></div>';
  var cab = ['EAP', 'ATIVIDADE', 'INÍCIO LB', 'TÉRMINO LB', 'INÍCIO', 'TÉRMINO', 'PESO', 'PREVISTO', 'REAL', 'DESVIO (p.p.)', 'SPI', 'SITUAÇÃO', 'TÉRMINO TENDÊNCIA', 'ATRASO (dias)'];
  var fd = function (d) { return d == null ? '–' : fdate(Math.floor(d)); };
  var aoa = [cab];
  var corpo = L.map(function (x) {
    var t = x.t, spi = x.pv ? x.ev / x.pv : null, dsv = (x.ev - x.pv) * 100, S2 = ST[x.s];
    aoa.push([t.w, t.n, fd(x.bi), fd(x.bf), fd(dn(t.i)), fd(dn(t.f)), x.peso, x.pv, x.ev, Math.round(dsv * 100) / 100, spi == null ? '' : Math.round(spi * 100) / 100, S2[0], x.tend == null ? '' : fd(x.tend), x.atr == null ? '' : x.atr]);
    return '<tr><td class="c">' + esc(t.w) + '</td><td>' + esc(t.n) + '</td><td class="c">' + fd(x.bi) + '</td><td class="c">' + fd(x.bf) + '</td><td class="c">' + fd(dn(t.i)) + '</td><td class="c">' + fd(dn(t.f)) + '</td><td class="n">' + pct(x.peso) + '</td>' +
      '<td class="n">' + pct(x.pv) + '</td><td class="n"><span class="kpi-bar" style="--v:' + Math.round(x.ev * 100) + '%"></span>' + pct(x.ev) + '</td><td class="n' + (dsv < -0.5 ? ' pico' : '') + '">' + (dsv >= 0 ? '+' : '') + nf2.format(dsv) + '</td><td class="n">' + (spi == null ? '–' : nf2.format(spi)) + '</td>' +
      '<td class="c"><span class="kpi-s ' + S2[1] + '">' + S2[0] + '</span></td><td class="c">' + (x.tend == null ? '–' : fd(x.tend)) + '</td><td class="n' + (x.atr > 0 ? ' pico' : '') + '">' + (x.atr == null ? '–' : (x.atr > 0 ? '+' : '') + int(x.atr)) + '</td></tr>';
  }).join('');
  outAoa(aoa);
  s += '<div class="gc"><h3>Indicadores físicos por atividade <span class="vz" style="font-weight:500">· ' + int(L.length) + ' itens</span></h3><div class="tw" style="max-height:620px"><table class="g kpi" style="width:100%"><thead><tr>' + cab.map(function (c, i) { return '<th' + (i === 1 ? ' class="l"' : '') + '>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' + (corpo || '<tr><td colspan="14" class="c vz">Nenhuma atividade nesta situação.</td></tr>') + '</tbody></table></div>' +
    '<div class="nota">Previsto: avanço pela linha de base até a data de status. Real: % físico informado no cronograma. SPI = real ÷ previsto (abaixo de 1,00 = atraso). Término tendência: projeta o ritmo real desde o início da atividade. Peso: participação na venda da linha de base.</div></div>';
  return s;
}
/* ================= INPUT DE AVANÇO (planilha de avanço) =================
   Dados: projetos/<id>/crono/inp_meta { q:{uid:qtd projeto}, u:{uid:unidade}, extra:[{x,id,n,bi,bf,q,u}] }
          projetos/<id>/crono/inp_AAAAMM { v:{ uid:{ 'DD': qtd } } }  (um documento por mês)
   O avanço real lançado aqui alimenta o % físico (pf), o início e o término reais das tarefas do cronograma. */
function inpMeta(p) { var C = p._cro; if (!C.inp_meta) C.inp_meta = { q: {}, u: {}, extra: [] }; var m = C.inp_meta; m.q = m.q || {}; m.u = m.u || {}; m.extra = m.extra || []; return m; }
function inpMesDoc(p, ym, criar) { var C = p._cro, k = 'inp_' + ym; if (!C[k] && criar) C[k] = { v: {} }; if (C[k]) C[k].v = C[k].v || {}; return C[k]; }
function inpYm(d) { var y = E.ymd(d); return y[0] + ('0' + (y[1] + 1)).slice(-2); }
/* acumulados por item: total, primeiro dia com avanço, dia em que atingiu a quantidade de projeto */
function inpReal(p) {
  if (p._inpC) return p._inpC;
  var C = p._cro, m = inpMeta(p), R = {}, ks = Object.keys(C).filter(function (k) { return /^inp_\d{6}$/.test(k); }).sort();
  ks.forEach(function (k) {
    var ym = k.slice(4), y = +ym.slice(0, 4), mo = +ym.slice(4) - 1, v = C[k].v || {};
    Object.keys(v).forEach(function (u) {
      var r = R[u] || (R[u] = { tot: 0, dias: [] });
      Object.keys(v[u]).forEach(function (dd) { var q = num(v[u][dd]); if (q) r.dias.push([Math.round(Date.UTC(y, mo, +dd) / 864e5), q]); });
    });
  });
  Object.keys(R).forEach(function (u) {
    var r = R[u], qp = num(m.q[u] != null ? m.q[u] : 100); r.dias.sort(function (a, b) { return a[0] - b[0]; });
    var ac = 0; r.dias.forEach(function (x) { ac += x[1]; if (r.ini == null && x[1] > 0) r.ini = x[0]; if (r.fim == null && qp > 0 && ac >= qp - 1e-9) r.fim = x[0]; });
    r.tot = ac; r.pct = qp > 0 ? Math.max(0, Math.min(1, ac / qp)) : 0;
  });
  return (p._inpC = R);
}
/* grava um lançamento e leva o avanço para a tarefa do cronograma */
function inpLanca(p, uid, dia, v) {
  var ym = inpYm(dia), doc = inpMesDoc(p, ym, true), dd = ('0' + E.ymd(dia)[2]).slice(-2), o = doc.v[uid] || (doc.v[uid] = {});
  if (v == null || v === '' || !num(v)) delete o[dd]; else o[dd] = num(v);
  if (!Object.keys(o).length) delete doc.v[uid];
  gravar(croRaiz(p) + '/inp_' + ym, doc); p._inpC = null; inpParaCro(p, uid);
}
function inpParaCro(p, uid) {
  var C = p._cro, t = C.tasks.filter(function (x) { return String(x.u) === String(uid); })[0]; if (!t || t.s) return;
  var r = inpReal(p)[uid];
  if (!r || !r.dias.length) { delete t.as; delete t.af; t.pf = 0; }
  else { t.pf = Math.round(r.pct * 10000) / 100; t.as = isoDia(r.ini) + 'T08:00'; if (r.fim != null && r.pct >= 1) t.af = isoDia(r.fim) + 'T17:00'; else delete t.af; }
  croResumos(C.tasks, 480); croSalvarT(p, t); Object.keys(C.parts).forEach(function (k) { gravar(croRaiz(p) + '/' + k, C.parts[k]); });
}
function inpSalvarMeta(p) { p._inpC = null; gravar(croRaiz(p) + '/inp_meta', inpMeta(p)); }
/* % previsto pela linha de base, em dias úteis do calendário do projeto (feriados, paralisações, clima) */
function inpPrev(cal, bi, bf, corte) {
  if (bi == null || bf == null) return null;
  if (corte < bi) return 0; if (corte >= bf) return 1;
  var tot = cal.uteis(bi, bf); if (!tot) return corte >= bf ? 1 : 0;
  return Math.max(0, Math.min(1, cal.uteis(bi, Math.min(corte, bf)) / tot));
}
function shInp(p) {
  var w = croPrecisa(p, 'PLANILHA DE AVANÇO'); if (w) return w;
  var V = S.v.inp || (S.v.inp = { mes: null, nivel: 2, exp: {}, busca: '', so: false });
  var R = croCalc(p), C = p._cro, T = C.tasks, m = inpMeta(p), RR = inpReal(p), ed = podeEditar(), cal = E.calendar(p, ctxDe(p));
  var corte = Math.floor(R.st), vt = R.tot.v || 0, dut = R.tot.du || 0;
  var PA = C.inp_eap && C.inp_eap.ord && C.inp_eap.ord.length ? C.inp_eap : null, modoPA = PA && V.eap !== 'CRO';
  var meses = R.meses.length ? R.meses.slice() : [miDe(corte)]; var mAt = miDe(corte); if (meses.indexOf(mAt) < 0) meses.push(mAt); meses.sort(function (a, b) { return a - b; });
  if (V.mes == null || meses.indexOf(V.mes) < 0) V.mes = mAt;
  var d0 = E.som(V.mes), d1 = E.eom(V.mes), dias = []; for (var d = d0; d <= d1; d++) dias.push(d);
  var mesDoc = inpMesDoc(p, inpYm(d0), false), MV = mesDoc ? mesDoc.v : {};
  var peso = function (u) { var n = R.N[u]; if (!n) { var A = prevN[u]; return A ? (vt ? A[1] / vt : dut ? A[1] / dut : 0) : 0; } return vt ? n.v / vt : dut ? n.du / dut : 0; };
  /* agregados por nó (peso da venda) */
  var prevN = {}, realN = {};
  R.leaves.forEach(function (t) {
    var pv = inpPrev(cal, dn(t.bi || t.i) != null ? Math.floor(dn(t.bi || t.i)) : null, dn(t.bf || t.f) != null ? Math.floor(dn(t.bf || t.f)) : null, corte), wv = R.N[t.u].v || (vt ? 0 : R.N[t.u].du);
    var rv = RR[t.u] ? RR[t.u].pct : realDe(t) / 100;
    for (var x = t; x; x = R.by[x.p]) { var a = prevN[x.u] || (prevN[x.u] = [0, 0]), b = realN[x.u] || (realN[x.u] = [0, 0]); a[0] += wv * (pv || 0); a[1] += wv; b[0] += wv * rv; b[1] += wv; if (x.p == null || x.p < 0) break; }
  });
  var pct2 = function (A) { return A && A[1] ? A[0] / A[1] : 0; };
  var fd = function (x) { return x == null ? '' : fdate(x); };
  /* barra de controles */
  var sel = function (id, val, lista, set) { return '<select id="' + id + '" ' + h(function (el) { set(el.value); agendar(); }) + '>' + lista.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(val) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; };
  var s = titulo('PLANILHA DE AVANÇO', croStatusCampo(p, R) + '<button class="bxl" data-tip="Baixa a planilha de avanço do mês escolhido" ' + h(function () { inpExcel(p); }) + '>' + XL_IC + 'Exportar Excel</button>');
  s += '<div class="cpu-lb rel-f inp-f"><label>Mês ' + sel('ip-mes', V.mes, meses.map(function (mi) { return [mi, MESES_N[mi % 12] + '/' + Math.floor(mi / 12)]; }), function (v) { V.mes = +v; }) + '</label>' +
    '<label>Nível ' + sel('ip-niv', V.nivel, [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [99, 'Todos']], function (v) { V.nivel = +v; V.exp = {}; }) + '</label>' +
    '<label>Localizar <input id="ip-busca" type="search" data-live="1" value="' + esc(V.busca) + '" placeholder="ID ou atividade" ' + h(function (el) { V.busca = el.value; agendar(); }) + '></label>' +
    '<label class="rd"><input type="checkbox"' + (V.so ? ' checked' : '') + ' ' + h(function (el) { V.so = el.checked; agendar(); }) + '> Só atividades do mês</label>' +
    '<label>Visão ' + sel('ip-modo', V.modo || 'L', [['L', 'Lançamento (compacta)'], ['C', 'Completa (com datas e peso)']], function (v) { V.modo = v; }) + '</label>' +
    '<label class="ip-dia">Lançar em <input type="date" id="ip-dia" max="' + isoDia(corte) + '" value="' + isoDia(V.dia != null ? V.dia : corte) + '" ' + h(function (el) { var d = el.value ? E.day(el.value) : corte; V.dia = Math.min(d, corte); V.mes = miDe(V.dia); }) + '></label>' +
    '<label class="rd"><input type="checkbox"' + (V.dias !== false ? ' checked' : '') + ' ' + h(function (el) { V.dias = el.checked; agendar(); }) + '> Dias do mês</label>' +
    (PA ? '<label>EAP ' + sel('ip-eap', V.eap || 'PA', [['PA', 'Planilha de avanço'], ['CRO', 'Cronograma (padrão OP)']], function (v) { V.eap = v; V.exp = {}; }) + '</label>' : '') +
    (ed ? '<span style="flex:1"></span><button class="lk" data-tip="Atividade que não consta no cronograma oficial (ex.: alojamento)" ' + h(function () { var n = m.extra.length + 1; m.extra.push({ x: 'X' + Date.now().toString(36), id: 'N TEM NO CRO', n: 'ATIVIDADE ' + ('0' + n).slice(-2), bi: '', bf: '', q: 100, u: '%' }); inpSalvarMeta(p); agendar(); }) + '>+ Atividade fora do cronograma</button>' : '') + '</div>';
  /* cartões */
  var raiz = R.raiz, pv = pct2(prevN[raiz.u]), rv = pct2(realN[raiz.u]);
  s += '<div class="gk cro-k">' + croKt('Data de corte', fdate(corte), 'data de status do cronograma') + croKt('Avanço previsto (LB)', pct(pv), 'dias úteis do calendário do projeto') + croKt('Avanço real', pct(rv), 'ponderado pela venda', 'hero') + croKt('Desvio', (rv - pv >= 0 ? '+' : '') + nf2.format((rv - pv) * 100) + ' p.p.', 'SPI ' + (pv ? nf2.format(rv / pv) : '–'), rv < pv ? 'ru' : '') + '</div>';
  /* cabeçalho */
  var comp = V.modo === 'C', verD = V.dias !== false, diaL = V.dia != null ? Math.min(V.dia, corte) : corte, docL = inpMesDoc(p, inpYm(diaL), false), MVL = docL ? docL.v : {}, ddL = ('0' + E.ymd(diaL)[2]).slice(-2);
  if (!verD) dias = [];
  var nCols = 11 + (comp ? 5 : 0) + dias.length;
  var cab = '<tr><th class="l f1 ip-id">ID</th><th class="l f1 ip-at">ATIVIDADE</th>' + (comp ? '<th>INÍCIO LB</th><th>TÉRMINO LB</th><th>INÍCIO REAL</th><th>TÉRMINO REAL</th><th>PESO</th>' : '') + '<th>QTD PROJETO</th><th>UND</th><th class="ip-lc">LANÇAR<br><span>' + fdate(diaL).slice(0, 5) + '</span></th><th>QTD REAL</th><th class="ip-av">AVANÇO</th><th>% PREV.</th><th>% REAL</th><th>DESVIO</th>' +
    dias.map(function (x) { var u = cal.util(x); return '<th class="ip-d' + (u ? '' : ' ip-nu') + (x === corte ? ' ip-hj' : '') + '">' + ('0' + E.ymd(x)[2]).slice(-2) + '<br><span>' + 'DSTQQSS'.charAt(E.weekday(x) - 1) + '</span></th>'; }).join('') + '</tr>';
  var linhas = '', n = 0, MAX = 400, cheio = false, b = semAcento(V.busca);
  var linha = function (o) {
    /* o: { uid, id, nome, nivel, folha, bi, bf, extra, t } */
    var r = RR[o.uid] || null, qp = num(m.q[o.uid] != null ? m.q[o.uid] : (o.extra ? o.extra.q : 100)), un = m.u[o.uid] != null ? m.u[o.uid] : (o.extra ? o.extra.u : '%');
    var pvv = o.folha ? inpPrev(cal, o.bi, o.bf, corte) : pct2(prevN[o.uid]), rr = o.folha ? (r ? r.pct : (o.t ? realDe(o.t) / 100 : 0)) : pct2(realN[o.uid]);
    var dsv = pvv == null ? null : (rr - pvv) * 100, ps = o.pw != null ? o.pw : o.extra ? 0 : peso(o.uid), MVu = (MV || {})[o.uid] || {};
    var ini = r && r.ini != null ? r.ini : (o.t && o.t.as ? Math.floor(dn(o.t.as)) : null), fim = r && r.fim != null && r.pct >= 1 ? r.fim : (!r && o.t && o.t.af ? Math.floor(dn(o.t.af)) : null);
    var ab = V.exp[o.uid] != null ? V.exp[o.uid] : o.nivel < V.nivel;
    var tg = o.folha ? '' : '<button class="tg" ' + h(function () { V.exp[o.uid] = !ab; agendar(); }) + '>' + (ab ? '▾' : '▸') + '</button>';
    var dt = function (k, val) { return ed && o.folha ? '<td class="ip-e"><input type="date" id="ip-' + k + o.uid + '" value="' + (val != null ? isoDia(val) : '') + '" ' + h(function (el) { inpLb(p, o, k, el.value); agendar(); }) + '></td>' : '<td class="c">' + fd(val) + '</td>'; };
    var nm = o.extra && ed ? '<input class="ip-tx" id="ip-n' + o.uid + '" value="' + esc(o.nome) + '" ' + h(function (el) { o.extra.n = semAcento(el.value).trim() || o.extra.n; inpSalvarMeta(p); agendar(); }) + '>' : esc(o.nome);
    var idc = o.extra && ed ? '<input class="ip-tx ip-txs" id="ip-i' + o.uid + '" value="' + esc(o.id) + '" ' + h(function (el) { o.extra.id = semAcento(el.value).trim(); inpSalvarMeta(p); agendar(); }) + '>' : esc(o.id);
    var s2 = '<tr class="' + (o.folha ? '' : 'ip-g ip-l' + Math.min(o.nivel, 4)) + (o.extra ? ' ip-x' : '') + '"><td class="f1 ip-id">' + (o.extra && ed ? '<button class="lk ip-del" data-tip="Excluir" ' + h(function () { confirma('Excluir a atividade ' + o.nome + ' e os avanços lançados nela?', function () { m.extra.splice(m.extra.indexOf(o.extra), 1); inpSalvarMeta(p); }); }) + '>×</button>' : '') + idc + '</td>' +
      '<td class="f1 ip-at" style="padding-left:' + (6 + Math.max(0, o.nivel - 1) * 12) + 'px">' + tg + nm + '</td>' + (comp ? dt('bi', o.bi) + dt('bf', o.bf) +
      '<td class="c">' + fd(ini) + '</td><td class="c">' + fd(fim) + '</td><td class="n">' + (ps ? nf2.format(ps * 100) + '%' : '–') + '</td>' : '') +
      (o.folha && ed ? '<td class="ip-e"><input class="ip-n" inputmode="decimal" id="ip-q' + o.uid + '" value="' + nf2.format(qp).replace(/\./g, '') + '" ' + h(function (el) { m.q[o.uid] = parseNum(el.value); if (o.extra) o.extra.q = m.q[o.uid]; inpSalvarMeta(p); inpParaCro(p, o.uid); agendar(); }) + '></td><td class="ip-e"><input class="ip-tx ip-txs" id="ip-u' + o.uid + '" value="' + esc(un) + '" ' + h(function (el) { m.u[o.uid] = semAcento(el.value).trim(); inpSalvarMeta(p); agendar(); }) + '></td>' : '<td class="n">' + (o.folha ? nf2.format(qp) : '') + '</td><td class="c">' + (o.folha ? esc(un) : '') + '</td>') +
      (function () { if (!o.folha) return '<td class="ip-lc"></td>'; var vL = ((MVL || {})[o.uid] || {})[ddL]; return ed ? '<td class="ip-e ip-lc"><input class="ip-n" inputmode="decimal" id="ip-L' + o.uid + '" placeholder="0" value="' + (vL ? nf2.format(vL).replace(/\./g, '') : '') + '" ' + h(function (el) { inpLanca(p, o.uid, diaL, el.value.trim() === '' ? null : parseNum(el.value)); agendar(); }) + '></td>' : '<td class="n ip-lc">' + (vL ? nf2.format(vL) : '') + '</td>'; })() +
      '<td class="n">' + (o.folha ? nf2.format(r ? r.tot : 0) : '') + '</td><td class="ip-av"><span class="ip-bar" title="Real ' + pct(rr) + (pvv == null ? '' : ' · previsto ' + pct(pvv)) + '"><i class="' + (pvv != null && rr < pvv - 0.0005 ? 'atr' : '') + '" style="width:' + Math.min(100, rr * 100).toFixed(1) + '%"></i>' + (pvv == null ? '' : '<b style="left:' + Math.min(100, pvv * 100).toFixed(1) + '%"></b>') + '</span></td><td class="n">' + (pvv == null ? '–' : pct(pvv)) + '</td><td class="n"><b>' + pct(rr) + '</b></td><td class="n' + (dsv != null && dsv < -0.05 ? ' pico' : '') + '">' + (dsv == null ? '–' : (dsv >= 0 ? '+' : '') + nf2.format(dsv)) + '</td>';
    s2 += dias.map(function (x) {
      var dd = ('0' + E.ymd(x)[2]).slice(-2), v = MVu[dd], cls = (cal.util(x) ? '' : ' ip-nu') + (x === corte ? ' ip-hj' : '');
      if (!o.folha) return '<td class="ip-d' + cls + '"></td>';
      if (!ed || x > corte) return '<td class="n ip-d' + cls + (x > corte ? ' ip-fu' : '') + '">' + (v ? nf2.format(v) : '') + '</td>';
      return '<td class="ip-d ip-e' + cls + '"><input class="ip-n" inputmode="decimal" id="ip-' + o.uid + '-' + dd + '" value="' + (v ? nf2.format(v).replace(/\./g, '') : '') + '" ' + h(function (el) { inpLanca(p, o.uid, x, el.value.trim() === '' ? null : parseNum(el.value)); agendar(); }) + '></td>';
    }).join('') + '</tr>';
    return s2;
  };
  /* atividades fora do cronograma */
  var naPA = {}; if (modoPA) PA.ord.forEach(function (o) { naPA[o[0]] = 1; });
  m.extra.forEach(function (x) {
    if (naPA[x.x]) return;
    var bi = x.bi ? E.day(x.bi) : null, bf = x.bf ? E.day(x.bf) : null;
    if (b && semAcento(x.id + ' ' + x.n).indexOf(b) < 0) return;
    if (V.so && !(bi != null && bi <= d1 && (bf == null || bf >= d0)) && !(MV && MV[x.x])) return;
    linhas += linha({ uid: x.x, id: x.id, nome: x.n, nivel: 1, folha: true, bi: bi, bf: bf, extra: x }); n++;
  });
  /* EAP da planilha de avanço importada (ordem, códigos e níveis da planilha; agregados pela própria estrutura) */
  if (modoPA) {
    var X = {}; m.extra.forEach(function (x) { X[x.x] = x; });
    var ord = PA.ord, pai = [], pilha = [], prevP = {}, realP = {};
    ord.forEach(function (o, i) { while (pilha.length && ord[pilha[pilha.length - 1]][2] >= o[2]) pilha.pop(); pai[i] = pilha.length ? pilha[pilha.length - 1] : -1; pilha.push(i); });
    /* pesos da planilha: custo da linha de base de cada atividade (o mesmo critério do % Peso da planilha) */
    var PWo = function (o) { return o[3] ? o[4] : o[7]; }, temPW = ord.some(function (o) { return PWo(o) != null; });
    var BT = 0; if (!temPW) ord.forEach(function (o) { var t = o[3] && R.by[o[0]]; if (t && !t.s) BT += num(t.bc); });
    ord.forEach(function (o, i) {
      if (!o[3]) return; var t = R.by[o[0]]; if (!t || t.s) return;
      var pv = inpPrev(cal, dn(t.bi || t.i) != null ? Math.floor(dn(t.bi || t.i)) : null, dn(t.bf || t.f) != null ? Math.floor(dn(t.bf || t.f)) : null, corte), wv = temPW ? num(PWo(o)) : BT ? num(t.bc) : (R.N[t.u].v || (vt ? 0 : R.N[t.u].du)), rv = RR[t.u] ? RR[t.u].pct : realDe(t) / 100;
      for (var j = pai[i]; j >= 0; j = pai[j]) { var a = prevP[j] || (prevP[j] = [0, 0]), bb = realP[j] || (realP[j] = [0, 0]); a[0] += wv * (pv || 0); a[1] += wv; bb[0] += wv * rv; bb[1] += wv; }
    });
    var abre = function (i) { for (var j = pai[i]; j >= 0; j = pai[j]) { var k = 'pa' + j, ab = V.exp[k] != null ? V.exp[k] : ord[j][2] < V.nivel; if (!ab) return false; } return true; };
    ord.forEach(function (o, i) {
      if (n >= MAX) { cheio = true; return; }
      var x = X[o[0]], t = x ? null : R.by[o[0]], cab = !o[3] && !x && !t; if (!x && !t && !cab) return;
      var folha = !!o[3] && !(t && t.s), bi = cab ? (o[5] ? E.day(o[5]) : null) : x ? (x.bi ? E.day(x.bi) : null) : dn(t.bi || t.i), bf = cab ? (o[6] ? E.day(o[6]) : null) : x ? (x.bf ? E.day(x.bf) : null) : dn(t.bf || t.f);
      bi = bi == null ? null : Math.floor(bi); bf = bf == null ? null : Math.floor(bf);
      var nome = cab ? o[4] : x ? x.n : t.n;
      if (b) { if (semAcento(o[1] + ' ' + nome).indexOf(b) < 0) return; } else if (!abre(i)) return;
      if (V.so && !(bi != null && bi <= d1 && (bf == null || bf >= d0)) && !(MV && MV[o[0]])) return;
      var uid = folha ? (x ? x.x : t.u) : 'pa' + i;
      if (!folha) { prevN[uid] = prevP[i]; realN[uid] = realP[i]; }
      var pw = temPW ? num(PWo(o)) : x ? 0 : BT ? (folha ? num(t.bc) : (prevP[i] ? prevP[i][1] : 0)) / BT : null;
      linhas += linha({ uid: uid, id: o[1], nome: nome, nivel: o[2], folha: folha, bi: bi, bf: bf, t: t, extra: x, pw: pw }); n++;
    });
  } else {
  /* cronograma (ordem da EAP) */
  var vis = {}, mostra = function (t) { var x = R.by[t.p]; while (x && x.p != null && x.p >= 0 && R.by[x.p]) { var ab = V.exp[x.u] != null ? V.exp[x.u] : x.l < V.nivel; if (!ab) return false; x = R.by[x.p]; } return true; };
  T.forEach(function (t) {
    if (t === raiz || n >= MAX) { if (n >= MAX && t !== raiz) cheio = true; return; }
    var folha = !t.s, bi = dn(t.bi || t.i), bf = dn(t.bf || t.f);
    bi = bi == null ? null : Math.floor(bi); bf = bf == null ? null : Math.floor(bf);
    if (b) { if (semAcento((t.w || '') + ' ' + t.n).indexOf(b) < 0) return; }
    else if (!mostra(t)) return;
    if (V.so && folha && !(bi != null && bi <= d1 && (bf == null || bf >= d0)) && !(MV && MV[t.u])) return;
    if (V.so && !folha && !(bi != null && bi <= d1 && (bf == null || bf >= d0))) return;
    linhas += linha({ uid: t.u, id: t.w || '', nome: t.n, nivel: t.l, folha: folha, bi: bi, bf: bf, t: t }); n++;
  });
  }
  s += '<div class="tw inp-t" id="tw-inp"><table class="g inp"><thead>' + cab + '</thead><tbody>' + (linhas || '<tr><td colspan="' + nCols + '" class="vz">Nenhuma atividade.</td></tr>') + '</tbody></table></div>' +
    '<div class="nota">' + (cheio ? '<b>Mostrando as primeiras ' + MAX + ' linhas</b> — use Localizar, o nível ou "Só atividades do mês". ' : '') + 'Brancas: campos de lançamento (datas da linha de base, quantidade de projeto, unidade e a quantidade executada em cada dia até a data de corte). As demais colunas são calculadas e travadas. Peso = participação na venda da linha de base. % previsto = dias úteis decorridos entre o início e o término da linha de base (feriados, paralisações e clima do projeto). O % real, o início e o término reais lançados aqui passam para o cronograma físico, curvas, KPI e relatórios.</div>';
  return s;
}
/* datas da linha de base: das tarefas do cronograma ou das atividades fora dele */
/* Enter / ↓ / ↑ nas células de lançamento: vai para a mesma coluna na linha de baixo ou de cima */
document.addEventListener('keydown', function (ev) {
  var el = ev.target; if (!el || !el.classList || !el.classList.contains('ip-n') || !el.id) return;
  if (ev.key !== 'Enter' && ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
  var td = el.closest('td'), tr = td && td.parentNode; if (!tr) return;
  var col = Array.prototype.indexOf.call(tr.children, td), alvo = null, x = tr;
  while (!alvo) { x = ev.key === 'ArrowUp' ? x.previousElementSibling : x.nextElementSibling; if (!x) break; var c = x.children[col], inp = c && c.querySelector('input.ip-n'); if (inp && inp.id) alvo = inp.id; }
  if (!alvo) return; ev.preventDefault(); S._focoProx = alvo; el.blur();
  setTimeout(function () { if (!S._focoProx) return; var t = document.getElementById(S._focoProx); S._focoProx = null; if (t) { t.focus(); try { t.select(); } catch (e) { } } }, 80);
});
function inpLb(p, o, k, v) {
  if (o.extra) { o.extra[k] = v || ''; inpSalvarMeta(p); return; }
  var t = o.t; if (!t || !v) return;
  if (k === 'bi') { t.bi = v + 'T08:00'; if (dn(t.bf || t.f) < E.day(v)) t.bf = v + 'T17:00'; }
  else { t.bf = v + 'T17:00'; if (dn(t.bi || t.i) > E.day(v) + 1) t.bi = v + 'T08:00'; }
  croResumos(p._cro.tasks, 480); croMudou(p); Object.keys(p._cro.parts).forEach(function (kk) { gravar(croRaiz(p) + '/' + kk, p._cro.parts[kk]); });
}
function inpExcel(p) {
  var V = S.v.inp, R = croCalc(p), m = inpMeta(p), RR = inpReal(p), d0 = E.som(V.mes), d1 = E.eom(V.mes), dias = [], d, cal = E.calendar(p, ctxDe(p)), corte = Math.floor(R.st), vt = R.tot.v || 0;
  for (d = d0; d <= d1; d++) dias.push(d);
  var doc = inpMesDoc(p, inpYm(d0), false), MV = doc ? doc.v : {}, f = function (x) { return x == null ? '' : fdate(x); };
  var aoa = [['ID', 'ATIVIDADE', 'INICIO LB', 'TERMINO LB', 'INICIO REAL', 'TERMINO REAL', 'PESO', 'QTD PROJETO', 'UND', 'QTD REAL', '% PREVISTO', '% REAL'].concat(dias.map(function (x) { return fdate(x); }))];
  var naPA = {}; ((p._cro.inp_eap && V.eap !== 'CRO' && p._cro.inp_eap.ord) || []).forEach(function (o) { naPA[o[0]] = 1; });
  m.extra.forEach(function (x) { if (naPA[x.x]) return; var r = RR[x.x], bi = x.bi ? E.day(x.bi) : null, bf = x.bf ? E.day(x.bf) : null; aoa.push([x.id, x.n, f(bi), f(bf), f(r && r.ini), f(r && r.pct >= 1 ? r.fim : null), 0, num(x.q), x.u, r ? r.tot : 0, inpPrev(cal, bi, bf, corte) || 0, r ? r.pct : 0].concat(dias.map(function (z) { var v = (MV[x.x] || {})[('0' + E.ymd(z)[2]).slice(-2)]; return v || ''; }))); });
  var PA = p._cro.inp_eap && p._cro.inp_eap.ord && p._cro.inp_eap.ord.length && V.eap !== 'CRO' ? p._cro.inp_eap.ord : null;
  if (PA) {
    var XX = {}; m.extra.forEach(function (x) { XX[x.x] = x; });
    PA.forEach(function (o) {
      var x = XX[o[0]], t = x ? null : R.by[o[0]], cab = !o[3] && !x && !t; if (!x && !t && !cab) return;
      var folha = !!o[3] && !(t && t.s), uid = cab ? o[0] : x ? x.x : t.u, r = cab ? null : RR[uid], bi = cab ? (o[5] ? E.day(o[5]) : null) : x ? (x.bi ? E.day(x.bi) : null) : dn(t.bi || t.i), bf = cab ? (o[6] ? E.day(o[6]) : null) : x ? (x.bf ? E.day(x.bf) : null) : dn(t.bf || t.f);
      bi = bi == null ? null : Math.floor(bi); bf = bf == null ? null : Math.floor(bf);
      aoa.push([o[1], '  '.repeat(Math.max(0, o[2] - 1)) + (cab ? o[4] : x ? x.n : t.n), f(bi), f(bf), f(r ? r.ini : (t && t.as ? Math.floor(dn(t.as)) : null)), f(r ? (r.pct >= 1 ? r.fim : null) : (t && t.af ? Math.floor(dn(t.af)) : null)), (o[3] ? o[4] : o[7]) != null ? num(o[3] ? o[4] : o[7]) : t && vt ? R.N[t.u].v / vt : 0,
        folha ? num(m.q[uid] != null ? m.q[uid] : (x ? x.q : 100)) : '', folha ? (m.u[uid] || (x ? x.u : '%')) : '', folha ? (r ? r.tot : 0) : '', folha ? (inpPrev(cal, bi, bf, corte) || 0) : '', folha ? (r ? r.pct : (t ? realDe(t) / 100 : 0)) : ''].concat(dias.map(function (z) { var v = (MV[uid] || {})[('0' + E.ymd(z)[2]).slice(-2)]; return folha ? (v || '') : ''; })));
    });
    return relExcel(p, 'Planilha de avanço ' + MESES_N[V.mes % 12] + ' ' + Math.floor(V.mes / 12), aoa);
  }
  p._cro.tasks.forEach(function (t) {
    if (t === R.raiz) return; var r = RR[t.u], bi = dn(t.bi || t.i), bf = dn(t.bf || t.f); bi = bi == null ? null : Math.floor(bi); bf = bf == null ? null : Math.floor(bf);
    aoa.push([t.w || '', '  '.repeat(Math.max(0, t.l - 1)) + t.n, f(bi), f(bf), f(r ? r.ini : (t.as ? Math.floor(dn(t.as)) : null)), f(r ? (r.pct >= 1 ? r.fim : null) : (t.af ? Math.floor(dn(t.af)) : null)), vt ? R.N[t.u].v / vt : 0, t.s ? '' : num(m.q[t.u] != null ? m.q[t.u] : 100), t.s ? '' : (m.u[t.u] || '%'), t.s ? '' : (r ? r.tot : 0), t.s ? '' : (inpPrev(cal, bi, bf, corte) || 0), t.s ? '' : (r ? r.pct : realDe(t) / 100)].concat(dias.map(function (z) { var v = (MV[t.u] || {})[('0' + E.ymd(z)[2]).slice(-2)]; return t.s ? '' : (v || ''); })));
  });
  relExcel(p, 'Planilha de avanço ' + MESES_N[V.mes % 12] + ' ' + Math.floor(V.mes / 12), aoa);
}
/* ================= CONTROLE DE KPI (curva S por atividade geral) =================
   Fonte: planilha de avanço (lançamentos diários) + cronograma (linha de base e datas atuais = replanejamento).
   Atividade geral = tarefas folha com o mesmo nome sem o sufixo de local (SPE, SPGA, subcampo, parque…). */
function kpcBase(n) {
  var ps = String(n || '').split('|').map(function (x) { return x.trim(); }).filter(Boolean);
  while (ps.length > 1 && /^(SPE|SPGA|SC\b|SUB|PARQUE|EC\b|BLOCO|TRECHO|\d)|\d/i.test(ps[ps.length - 1]) && ps[ps.length - 1].length <= 18) ps.pop();
  return ps.join(' | ');
}
function kpcGrupos(p, R) {
  var RR = inpReal(p), G = {}, ord = [];
  var chave = function (s) { return semAcento(s).replace(/[|/\-–,.]+/g, ' ').split(/\s+/).filter(function (w) { return w && ['DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'EM', 'NA', 'NO'].indexOf(w) < 0; }).join(' '); };
  /* só construção (EAP 4); a engenharia (EAP 2) entra em dois grupos gerais: emissão e aprovação de documentos */
  var temOp = R.leaves.some(function (t) { return M0op(t, R); }), ENG = { E: null, A: null };
  R.leaves.forEach(function (t) {
    if (temOp) {
      var op = String(M0op(t, R));
      if (op.charAt(0) === '2') {
        var tipo = /^APROVA/.test(semAcento(t.n)) ? 'A' : /^EMISS/.test(semAcento(t.n)) ? 'E' : null; if (!tipo) return;
        var ge = ENG[tipo] || (ENG[tipo] = { nome: tipo === 'E' ? 'Emissão de documentos de engenharia' : 'Aprovação de documentos de engenharia', its: [], nomes: {}, doc: true, fixo: 1 });
        ge.its.push(t); return;
      }
      if (op.charAt(0) !== '4') return;
    }
    var b = kpcBase(t.n), k = chave(b); if (!G[k]) { G[k] = { nome: b, its: [], nomes: {} }; ord.push(k); } G[k].its.push(t); G[k].nomes[b] = (G[k].nomes[b] || 0) + 1;
  });
  ['E', 'A'].forEach(function (x) { if (ENG[x]) { G['#ENG' + x] = ENG[x]; ord.unshift('#ENG' + x); } });
  if (ENG.E && ENG.A) { ord.splice(ord.indexOf('#ENGA'), 1); ord.splice(ord.indexOf('#ENGE') + 1, 0, '#ENGA'); }
  ord.forEach(function (k) { var g = G[k], best = null; if (g.fixo) return; Object.keys(g.nomes).forEach(function (n) { if (!best || n.indexOf('|') < 0 && best.indexOf('|') >= 0 || (n.indexOf('|') < 0) === (best.indexOf('|') < 0) && g.nomes[n] > g.nomes[best]) best = n; }); g.nome = best; });
  return ord.map(function (k) { var g = G[k]; g.ini = g.its.some(function (t) { var r = RR[t.u]; return r && r.dias.length; }); return g; }).filter(function (g) { return g.ini; });
}
function kpcCalc(p, R, g) {
  var RR = inpReal(p), m = inpMeta(p), cal = E.calendar(p, ctxDe(p)), corte = Math.floor(R.st), util = function (d) { return cal.util(d); };
  var un = null, mesma = true; g.its.forEach(function (t) { var u = m.u[t.u] != null ? m.u[t.u] : '%'; if (un == null) un = u; else if (u !== un) mesma = false; });
  var modoQ = mesma && un && un !== '%';
  if (g.doc) { modoQ = true; un = 'DOC'; }
  var vs = g.its.reduce(function (a, t) { return a + (R.N[t.u].v || 0); }, 0);
  var its = g.its.map(function (t) {
    var qp = num(m.q[t.u] != null ? m.q[t.u] : 100), w = g.doc ? 1 / (qp || 1) : modoQ ? 1 : (vs ? (R.N[t.u].v || 0) / vs : 1 / g.its.length) * 100 / (qp || 1);
    var fl = function (s) { var d = dn(s); return d == null ? null : Math.floor(d); };
    return { t: t, tot: g.doc ? 1 : modoQ ? qp : (vs ? (R.N[t.u].v || 0) / vs * 100 : 100 / g.its.length), w: w, bi: fl(t.bi || t.i), bf: fl(t.bf || t.f), ri: fl(t.i), rf: fl(t.f), r: RR[t.u] };
  });
  var total = its.reduce(function (a, x) { return a + x.tot; }, 0);
  var dLB = {}, dRP = {}, dRE = {}, spread = function (acc, a, b, q) { if (a == null || b == null || !q) return; if (b < a) b = a; var n = 0, d; for (d = a; d <= b; d++) if (util(d)) n++; if (!n) { acc[a] = (acc[a] || 0) + q; return; } for (d = a; d <= b; d++) if (util(d)) acc[d] = (acc[d] || 0) + q / n; };
  its.forEach(function (x) { spread(dLB, x.bi, x.bf, x.tot); spread(dRP, x.ri, x.rf, x.tot); if (x.r) x.r.dias.forEach(function (z) { if (z[0] <= corte) dRE[z[0]] = (dRE[z[0]] || 0) + z[1] * x.w; }); });
  var mn = function (a, k) { var v = null; a.forEach(function (x) { if (x[k] != null && (v == null || x[k] < v)) v = x[k]; }); return v; }, mx = function (a, k) { var v = null; a.forEach(function (x) { if (x[k] != null && (v == null || x[k] > v)) v = x[k]; }); return v; };
  var o = { nome: g.nome, un: modoQ ? un : '%', total: total, corte: corte, n: its.length };
  o.lbI = mn(its, 'bi'); o.lbF = mx(its, 'bf'); o.rpI = mn(its, 'ri'); o.rpF = mx(its, 'rf');
  var dReal = Object.keys(dRE).map(Number).sort(function (a, b) { return a - b; });
  o.reI = dReal.length ? dReal[0] : null; o.real = dReal.reduce(function (a, d) { return a + dRE[d]; }, 0); o.pct = total ? Math.min(1, o.real / total) : 0;
  o.restante = Math.max(0, total - o.real); o.fim = o.restante <= 1e-9;
  o.reF = o.fim ? dReal[dReal.length - 1] : null;
  var uteis = function (a, b) { return a == null || b == null || b < a ? 0 : cal.uteis(a, b); };
  o.kLB = uteis(o.lbI, o.lbF) ? total / uteis(o.lbI, o.lbF) : 0;
  o.kRP = uteis(o.rpI, o.rpF) ? total / uteis(o.rpI, o.rpF) : 0;
  o.kRE = uteis(o.reI, Math.min(corte, o.reF != null ? o.reF : corte)) ? o.real / uteis(o.reI, Math.min(corte, o.reF != null ? o.reF : corte)) : 0;
  var semIni = corte - 6, semQ = 0; for (var d = semIni; d <= corte; d++) semQ += dRE[d] || 0; var semU = uteis(semIni, corte);
  o.kSE = semU ? semQ / semU : 0;
  /* alvo: concluir no término da linha de base (se já passou, no término replanejado) */
  o.alvoF = o.lbF != null && o.lbF > corte ? o.lbF : (o.rpF != null && o.rpF > corte ? o.rpF : null);
  var ua = o.alvoF != null ? uteis(corte + 1, o.alvoF) : 0; o.kAL = o.fim ? 0 : (ua ? o.restante / ua : null);
  o.kFC = o.kSE || o.kRE;
  /* previsão: ritmo da última semana (ou médio) a partir do dia seguinte ao corte */
  var dFC = {}, dAL = {}, ac, x;
  if (!o.fim && o.kFC > 0) { ac = 0; x = corte + 1; var lim = corte + 1500; while (ac < o.restante - 1e-9 && x < lim) { if (util(x)) { var q = Math.min(o.kFC, o.restante - ac); dFC[x] = q; ac += q; o.fcF = x; } x++; } o.fcI = corte + 1; }
  if (!o.fim && o.kAL) { for (x = corte + 1; x <= o.alvoF; x++) if (util(x)) dAL[x] = o.kAL; o.alI = corte + 1; }
  o.prevLB = 0; Object.keys(dLB).forEach(function (k) { if (+k <= corte) o.prevLB += dLB[k]; }); o.prevLB = total ? Math.min(1, o.prevLB / total) : 0;
  o.prevRP = 0; Object.keys(dRP).forEach(function (k) { if (+k <= corte) o.prevRP += dRP[k]; }); o.prevRP = total ? Math.min(1, o.prevRP / total) : 0;
  /* séries diárias acumuladas */
  /* eixo X só no período da atividade: do primeiro início (base, replanejado ou real) ao último término (base, replanejado, real ou alvo) */
  var iniL = [o.lbI, o.rpI, o.reI].filter(function (v) { return v != null; }), fimL = [o.lbF, o.rpF, o.reF, o.alvoF].filter(function (v) { return v != null; });
  var d0 = iniL.length ? Math.min.apply(null, iniL) : corte, d1 = fimL.length ? Math.max.apply(null, fimL) : corte; if (d1 < d0) d1 = d0;
  o.d0 = d0; o.d1 = d1; o.dias = []; var aLB = 0, aRP = 0, aRE = 0, aFC = o.real, aAL = o.real;
  for (x = d0; x <= d1; x++) {
    aLB += dLB[x] || 0; aRP += dRP[x] || 0; if (x <= corte) aRE += dRE[x] || 0;
    if (x > corte) { aFC += dFC[x] || 0; aAL += dAL[x] || 0; }
    o.dias.push({ d: x, lb: aLB, rp: aRP, re: x <= corte ? aRE : null, fc: x >= corte && o.kFC && !o.fim ? Math.min(total, aFC) : null, al: x >= corte && o.kAL && !o.fim && x <= o.alvoF ? Math.min(total, aAL) : null, dia: x <= corte ? (dRE[x] || 0) : 0, pl: dRP[x] || 0 });
  }
  o.replan = o.rpI !== o.lbI || o.rpF !== o.lbF;
  return o;
}
/* cores do painel (mesma organização do relatório oficial, em versão minimalista) */
var KPC_COR = { lb: '#2f4d9e', rp: '#e8762c', re: '#2e9e5b', fc: '#8fca6f', al: '#c9352b', corte: '#e8762c', bre: '#9fd5ad', bpl: '#c9d9ef' };
function kpcPasso(v) { if (!(v > 0)) return 1; var e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; }
function kpcGrafico(o) {
  var W = 1000, H = 420, L = 64, Rr = 14, T = 14, B = 64, iw = W - L - Rr, ih = H - T - B, n = o.dias.length || 1;
  var st = kpcPasso((o.total || 1) / 7), ym = Math.ceil((o.total || 1) * 1.04 / st) * st;
  var X = function (i) { return L + (n > 1 ? i * iw / (n - 1) : iw / 2); }, Y = function (v) { return T + ih - Math.min(ym, v) / ym * ih; };
  var mxd = o.dias.reduce(function (a, z) { return Math.max(a, z.dia, z.pl); }, 0) || 1, Yb = function (v) { return T + ih - v / mxd * ih * 0.55; };
  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="kpc-svg" role="img" aria-label="Curva S de ' + esc(o.nome) + '">';
  for (var v = 0; v <= ym + 1e-9; v += st) { var yy = Y(v); s += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + yy + '" y2="' + yy + '" stroke="' + G_GRADE + '" stroke-width="' + (v ? 1 : 1.2) + '"/><text x="' + (L - 8) + '" y="' + (yy + 3.5) + '" text-anchor="end" class="kpc-ax">' + nfq.format(Math.round(v * 100) / 100) + '</text>'; }
  /* datas no eixo X: passo em dias que mantém os rótulos legíveis */
  var pxd = iw / Math.max(1, n - 1), passo = [1, 2, 4, 7, 14, 28, 56, 91].filter(function (k) { return k * pxd >= 15; })[0] || 182;
  o.dias.forEach(function (z, i) {
    if ((z.d - o.dias[0].d) % passo) return; var y = E.ymd(z.d), xx = X(i);
    s += '<line x1="' + xx + '" x2="' + xx + '" y1="' + (T + ih) + '" y2="' + (T + ih + 4) + '" stroke="' + G_EIXO + '"/><text transform="translate(' + (xx + 3.5) + ',' + (T + ih + 8) + ') rotate(-90)" text-anchor="end" class="kpc-ax">' + ('0' + y[2]).slice(-2) + '/' + ('0' + (y[1] + 1)).slice(-2) + '/' + String(y[0]).slice(-2) + '</text>';
  });
  /* barras diárias: previsto (replanejamento) ao fundo, realizado à frente */
  var bw = Math.max(1, pxd * 0.7);
  o.dias.forEach(function (z, i) { if (z.pl) s += '<rect x="' + (X(i) - bw / 2) + '" y="' + Yb(z.pl) + '" width="' + bw + '" height="' + (T + ih - Yb(z.pl)) + '" fill="' + KPC_COR.bpl + '" opacity=".55"/>'; });
  o.dias.forEach(function (z, i) { if (z.dia) s += '<rect x="' + (X(i) - bw / 2) + '" y="' + Yb(z.dia) + '" width="' + bw + '" height="' + (T + ih - Yb(z.dia)) + '" fill="' + KPC_COR.bre + '"><title>' + fdate(z.d) + ': ' + nf2.format(z.dia) + ' ' + esc(o.un) + '</title></rect>'; });
  var linha = function (k, cor, dash, wid) { var pts = []; o.dias.forEach(function (z, i) { if (z[k] != null) pts.push(X(i).toFixed(1) + ',' + Y(z[k]).toFixed(1)); }); return pts.length ? '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + cor + '" stroke-width="' + (wid || 2) + '" stroke-linejoin="round" stroke-linecap="round"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>' : ''; };
  s += linha('lb', KPC_COR.lb, '', 2.2) + linha('rp', KPC_COR.rp, '', 2.2) + linha('fc', KPC_COR.fc, '0.1 4.5', 2.6) + linha('al', KPC_COR.al, '0.1 4.5', 2.6) + linha('re', KPC_COR.re, '', 2.8);
  var ic = o.dias.findIndex(function (z) { return z.d === o.corte; }); if (ic >= 0) s += '<line x1="' + X(ic) + '" x2="' + X(ic) + '" y1="' + T + '" y2="' + (T + ih) + '" stroke="' + KPC_COR.corte + '" stroke-width="2.4"/>';
  /* percentuais no canto do gráfico, como no relatório oficial */
  var tx = L + 16, ty = T + 26;
  s += '<text x="' + tx + '" y="' + ty + '" class="kpc-pt" fill="' + KPC_COR.lb + '">Previsto: ' + pct(o.prevLB) + '</text>' +
    '<text x="' + tx + '" y="' + (ty + 26) + '" class="kpc-pt" fill="' + KPC_COR.rp + '">Previsto replan.: ' + pct(o.prevRP) + '</text>' +
    '<text x="' + tx + '" y="' + (ty + 62) + '" class="kpc-pt" fill="' + KPC_COR.re + '">Real: ' + pct(o.pct) + '</text>' +
    '<text x="' + tx + '" y="' + (ty + 82) + '" class="kpc-ps" fill="' + KPC_COR.re + '">' + nfq.format(o.real) + ' de ' + nfq.format(o.total) + ' ' + esc(o.un) + '</text>';
  return s + '</svg>';
}
function kpcLegenda(o) {
  var it = [['corte', 'Data de corte', 'v'], ['bre', 'Realizado diário', 'b'], ['bpl', 'Previsto diário', 'b'], ['rp', 'Replanejamento', 'l'], ['lb', 'Linha de base contratual', 'l'], ['re', 'Realizado', 'l'], ['fc', 'Ritmo previsto', 'p'], ['al', 'Ritmo para o alvo', 'p']];
  return '<div class="kpc-lg">' + it.map(function (x) { return '<span><i class="kl-' + x[2] + '" style="--c:' + KPC_COR[x[0]] + '"></i>' + x[1] + '</span>'; }).join('') + '</div>';
}
function kpcPainel(p, o) {
  var fd = function (d) { return d == null ? '–' : fdate(d); }, k2 = function (v) { return v == null ? '–' : nf2.format(v); };
  var porte = portePorTipo(p), un2 = tipoUn(p), f2 = porte && o.total ? porte / o.total : 0;
  var fimP = o.fim ? o.reF : o.fcF;
  /* cabeçalho */
  var cab = '<div class="kpc-cab"><div class="kpc-pj">' + esc(p.nome || '') + (p.contratante && (p.contratante.fantasia || p.contratante.razao) ? '<small>' + esc(p.contratante.fantasia || p.contratante.razao) + '</small>' : '') + '</div><h4>' + esc(o.nome) + ' – Geral</h4><div class="kpc-mk">' + (function () { var lg = logosDe(p); return [lg.contr, lg.obra, lg.exec].filter(Boolean).map(function (u) { return '<img class="kpc-lg2" src="' + u + '" alt="">'; }).join(''); })() + LOGO_OP + '<span>OP Consulting</span></div></div>';
  /* datas à direita do gráfico */
  var dts = '<div class="kpc-dt"><div class="kpc-dh"><b>Datas</b> | Data</div>' +
    '<div style="--c:' + KPC_COR.lb + '"><span>Linha de base<small>Término contratual</small></span><b>' + fd(o.lbF) + '</b></div>' +
    '<div style="--c:' + KPC_COR.rp + '"><span>Alvo<small>Data alvo</small></span><b>' + fd(o.fim ? o.reF : o.alvoF) + '</b></div>' +
    '<div style="--c:' + KPC_COR.re + '"><span>' + (o.fim ? 'Concluída' : 'Previsão') + '<small>' + (o.fim ? 'Término real' : 'Data prevista') + '</small></span><b>' + fd(fimP) + '</b></div></div>';
  /* tabela de KPI */
  var cols = [['lb', 'Linha de base', 'KPI linha de base', o.kLB], ['rp', 'Replanejamento', 'KPI replanejado', o.kRP], ['re', 'Realizado', 'KPI médio em execução', o.kRE], ['re', '', 'KPI última semana', o.kSE], ['al', 'Alvo', 'KPI para o alvo', o.fim ? null : o.kAL], ['fc', 'Previsão', 'KPI previsto', o.fim ? null : o.kFC]];
  var ind = function (c, i) {
    if (c[3] == null || !o.kLB) return '<span class="kpc-i">–</span>';
    if (i === 0) return '<span class="kpc-i n" data-tip="Referência">■</span>';
    if (i === 4) return o.kFC >= c[3] ? '<span class="kpc-i up" data-tip="O ritmo previsto atinge o alvo">▲</span>' : '<span class="kpc-i dn" data-tip="O ritmo previsto não atinge o alvo">▼</span>';
    var r = c[3] / o.kLB; return r >= 1 ? '<span class="kpc-i up" data-tip="' + nf2.format(r) + ' × LB">▲</span>' : r < 0.95 ? '<span class="kpc-i dn" data-tip="' + nf2.format(r) + ' × LB">▼</span>' : '<span class="kpc-i n" data-tip="' + nf2.format(r) + ' × LB">■</span>';
  };
  var m = inpMeta(p); m.obs = m.obs || {};
  var nl = f2 ? 3 : 2, ed = podeEditar();
  var obs = '<td rowspan="' + nl + '" class="kpc-obs">' + (ed ? '<textarea rows="2" aria-label="Observações" ' + h(function (el) { m.obs[o.nome] = el.value; inpSalvarMeta(p); }) + '>' + esc(m.obs[o.nome] || '') + '</textarea>' : '<p>' + esc(m.obs[o.nome] || '') + '</p>') + '</td>';
  var kt = '<div class="tw"><table class="kpc-t"><thead><tr><th rowspan="2" class="k0">KPI</th>' +
    '<th class="g1" style="--c:' + KPC_COR.lb + '">Linha de base</th><th class="g1" style="--c:' + KPC_COR.rp + '">Replanejamento</th><th class="g1" colspan="2" style="--c:' + KPC_COR.re + '">Realizado</th><th class="g1" style="--c:' + KPC_COR.al + '">Alvo</th><th class="g1" style="--c:' + KPC_COR.fc + '">Previsão</th>' +
    '<th class="dc">Data de corte <b>' + fdate(o.corte) + '</b></th></tr><tr>' +
    cols.map(function (c) { return '<th class="g2" style="--c:' + KPC_COR[c[0]] + '">' + c[2] + '</th>'; }).join('') + '<th class="dc">Observações:</th></tr></thead><tbody>' +
    '<tr><td class="k0">' + esc(o.un) + '/dia</td>' + cols.map(function (c) { return '<td class="n">' + k2(c[3]) + '</td>'; }).join('') + obs + '</tr>' +
    (f2 ? '<tr><td class="k0">' + esc(un2) + '/dia</td>' + cols.map(function (c) { return '<td class="n">' + (c[3] == null ? '–' : nf2.format(c[3] * f2)) + '</td>'; }).join('') + '</tr>' : '') +
    '<tr><td class="k0">Ref.</td>' + cols.map(function (c, i) { return '<td class="c">' + ind(c, i) + '</td>'; }).join('') + '</tr></tbody></table></div>';
  return '<div class="kpc-p">' + cab + '<div class="kpc-cp"><div class="kpc-gw">' + kpcGrafico(o) + '</div>' + dts + '</div>' + kpcLegenda(o) + kt + '</div>';
}
function relKpiCtl(p, R, outAoa) {
  if (!R) return '<div class="vazio">Este projeto não tem cronograma.</div>';
  var G = kpcGrupos(p, R), K = S.v.kpc || (S.v.kpc = { sel: null });
  if (!G.length) return '<div class="vazio"><h3>Nenhuma atividade iniciada</h3>A curva de cada atividade aparece aqui assim que houver lançamento de avanço na Planilha de avanço.</div>';
  var L = G.map(function (g) { return kpcCalc(p, R, g); });
  if (!K.sel || !L.some(function (o) { return o.nome === K.sel; })) K.sel = L[0].nome;
  var o = L.filter(function (x) { return x.nome === K.sel; })[0], fd = function (d) { return d == null ? '–' : fdate(d); }, k2 = function (v) { return v == null ? '–' : nf2.format(v); };
  var dd = function (a, b) { return a == null || b == null ? '–' : (b - a > 0 ? '+' : '') + (b - a) + ' d'; };
  var aoa = [['ATIVIDADE', 'UND', 'TOTAL', 'REALIZADO', '% REAL', '% PREVISTO LB', 'KPI LB', 'KPI REPLAN.', 'KPI MEDIO', 'KPI ULT. SEMANA', 'KPI ALVO', 'TERMINO LB', 'TERMINO PREVISTO']];
  var tab = '<div class="tw"><table class="g"><thead><tr><th class="l">ATIVIDADE</th><th>UND</th><th>TOTAL</th><th>REALIZADO</th><th>% REAL</th><th>% PREV. LB</th><th>KPI LB</th><th>KPI REPLAN.</th><th>KPI MÉDIO</th><th>KPI ÚLT. SEMANA</th><th>KPI ALVO</th><th>TÉRMINO LB</th><th>TÉRMINO PREVISTO</th><th>DESVIO</th></tr></thead><tbody>' +
    L.map(function (x) {
      aoa.push([x.nome, x.un, x.total, x.real, x.pct, x.prevLB, x.kLB, x.kRP, x.kRE, x.kSE, x.kAL == null ? '' : x.kAL, fd(x.lbF), fd(x.fim ? x.reF : x.fcF)]);
      var fimP = x.fim ? x.reF : x.fcF;
      return '<tr class="' + (x.nome === K.sel ? 'sel' : '') + '" style="cursor:pointer" ' + h(function () { K.sel = x.nome; agendar(); }) + '><td>' + esc(x.nome) + ' <span class="vz">(' + x.n + ')</span></td><td class="c">' + esc(x.un) + '</td><td class="n">' + nfq.format(x.total) + '</td><td class="n">' + nfq.format(x.real) + '</td><td class="n"><b>' + pct(x.pct) + '</b></td><td class="n">' + pct(x.prevLB) + '</td>' +
        '<td class="n">' + k2(x.kLB) + '</td><td class="n">' + (x.replan ? k2(x.kRP) : '–') + '</td><td class="n">' + k2(x.kRE) + '</td><td class="n">' + k2(x.kSE) + '</td><td class="n">' + k2(x.kAL) + '</td><td class="c">' + fd(x.lbF) + '</td><td class="c">' + fd(fimP) + '</td><td class="c' + (fimP != null && x.lbF != null && fimP > x.lbF ? ' pico' : '') + '">' + dd(x.lbF, fimP) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  outAoa(aoa);
  return '<div class="gc"><h3>Controle de KPI <span class="vz" style="font-weight:500">· construção + engenharia geral (emissão e aprovação) · data de corte ' + fdate(o.corte) + '</span></h3>' + tab + '<div class="nota">Clique numa atividade para ver a curva. KPI em unidade por dia útil (calendário do projeto: jornada, feriados, paralisações e clima). Atividades sem unidade própria usam % ponderado pela venda.</div></div>' +
    '<div class="gc">' + kpcPainel(p, o) + '<div class="nota">Linha de base = datas de linha de base das tarefas; replanejamento = datas atuais do cronograma; KPI médio = realizado ÷ dias úteis desde o início real; última semana = produção dos 7 dias até o corte ÷ dias úteis; alvo = restante ÷ dias úteis até o término da LB (ou do replanejamento, se a LB já passou); previsão = restante no ritmo da última semana. Ref.: ▲ acima da LB, ■ até 5% abaixo, ▼ mais de 5% abaixo; no alvo, ▲ quando o ritmo previsto o alcança.</div></div>';
}
/* ---------- MAPAS (Planejamento) ----------
   Cada projeto tem seus mapas, gerados a partir de um KMZ/KML enviado pelo usuário.
   Por enquanto existe o mapa Geral; mapas de projeto e de execução serão ligados às atividades depois.
   Dados: projetos/<id>/mapas/<mapa>[_N] — { cam: [camadas], st: [estilos], fs: [elementos] }; resumo em p.mapas[mapa]. */
var MAPAS_TIPOS = [['geral', 'Geral', 'Layout geral do empreendimento']];
function mapaRaiz(p) { return dirP(p) + '/mapas'; }
/* leitor de ZIP nativo (KMZ = ZIP com o KML dentro), sem biblioteca externa */
function zipKml(buf) {
  var dv = new DataView(buf), u8 = new Uint8Array(buf), i, eocd = -1;
  for (i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return Promise.reject(new Error('arquivo KMZ inválido'));
  var n = dv.getUint16(eocd + 10, true), off = dv.getUint32(eocd + 16, true), ents = [], td = new TextDecoder();
  for (i = 0; i < n; i++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    var met = dv.getUint16(off + 10, true), csz = dv.getUint32(off + 20, true), nl = dv.getUint16(off + 28, true), xl = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true), lo = dv.getUint32(off + 42, true);
    ents.push({ nome: td.decode(u8.subarray(off + 46, off + 46 + nl)), met: met, csz: csz, lo: lo }); off += 46 + nl + xl + cl;
  }
  var ler = function (e, tipo) {
    var ini = e.lo + 30 + dv.getUint16(e.lo + 26, true) + dv.getUint16(e.lo + 28, true), dado = u8.subarray(ini, ini + e.csz);
    var bl = e.met === 0 ? new Blob([dado]) : null;
    if (!bl && (e.met !== 8 || typeof DecompressionStream === 'undefined')) return Promise.reject(new Error('compactação do KMZ não suportada neste navegador'));
    var r = bl ? new Response(bl) : new Response(new Blob([dado]).stream().pipeThrough(new DecompressionStream('deflate-raw')));
    return tipo === 'blob' ? r.blob() : r.text();
  };
  var kml = ents.filter(function (e) { return /\.kml$/i.test(e.nome); }).sort(function (a, b) { return (/(^|\/)doc\.kml$/i.test(b.nome) ? 1 : 0) - (/(^|\/)doc\.kml$/i.test(a.nome) ? 1 : 0); })[0];
  if (!kml) return Promise.reject(new Error('o KMZ não contém arquivo KML'));
  return ler(kml).then(function (txt) {
    return { txt: txt, arquivo: function (nome) { var e = ents.filter(function (x) { return x.nome === nome || x.nome.replace(/^.*\//, '') === nome.replace(/^.*\//, ''); })[0]; return e ? ler(e, 'blob') : Promise.resolve(null); } };
  });
}
/* cor KML (aabbggrr) → [#rrggbb, opacidade] */
function kmlCor(s, def) {
  s = String(s || '').trim(); if (!/^[0-9a-f]{8}$/i.test(s)) return def;
  return ['#' + s.slice(6, 8) + s.slice(4, 6) + s.slice(2, 4), Math.round(parseInt(s.slice(0, 2), 16) / 255 * 100) / 100];
}
function mapaLerKml(txt, arq) {
  var doc = new DOMParser().parseFromString(txt, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('o arquivo KML não pôde ser lido');
  var filhos = function (el, tag) { return Array.prototype.filter.call(el.children, function (c) { return c.localName === tag; }); };
  var um = function (el, tag) { return filhos(el, tag)[0] || null; };
  var txtDe = function (el, tag) { var e = el && um(el, tag); return e ? (e.textContent || '').trim() : ''; };
  /* estilos */
  var ST = {}, MAPA = {};
  var lerEstilo = function (el) {
    var ls = um(el, 'LineStyle'), ps = um(el, 'PolyStyle'), is = um(el, 'IconStyle'), o = {};
    if (ls) { var c = kmlCor(txtDe(ls, 'color')); if (c) { o.l = c[0]; o.la = c[1]; } var w = parseFloat(txtDe(ls, 'width')); if (w >= 0) o.w = w; }
    if (ps) { var f = kmlCor(txtDe(ps, 'color')); if (f) { o.f = f[0]; o.fa = f[1]; } if (txtDe(ps, 'fill') === '0') o.nf = 1; if (txtDe(ps, 'outline') === '0') o.no = 1; }
    if (is) { var ic = kmlCor(txtDe(is, 'color')); if (ic) o.p = ic[0]; }
    return o;
  };
  Array.prototype.forEach.call(doc.getElementsByTagNameNS('*', 'Style'), function (s) { var id = s.getAttribute('id'); if (id) ST[id] = lerEstilo(s); });
  Array.prototype.forEach.call(doc.getElementsByTagNameNS('*', 'StyleMap'), function (s) {
    var id = s.getAttribute('id'); if (!id) return;
    filhos(s, 'Pair').forEach(function (pr) { if (txtDe(pr, 'key') === 'normal') MAPA[id] = txtDe(pr, 'styleUrl').replace(/^.*#/, ''); });
  });
  var estiloDe = function (pm) {
    var o = {}, inl = um(pm, 'Style'), u = txtDe(pm, 'styleUrl').replace(/^.*#/, '');
    if (u) { var id = MAPA[u] || u; o = Object.assign({}, ST[id] || {}); }
    if (inl) Object.assign(o, lerEstilo(inl));
    return o;
  };
  var r6 = function (v) { return Math.round(v * 1e6) / 1e6; };
  var coords = function (el) {
    var c = el ? (el.textContent || '').trim().split(/\s+/) : [], a = [];
    c.forEach(function (t) { var x = t.split(','); var lo = parseFloat(x[0]), la = parseFloat(x[1]); if (isFinite(lo) && isFinite(la)) a.push(r6(lo), r6(la)); });
    return a;
  };
  var cam = [], camIx = {}, stl = [], stIx = {}, fs = [], bb = [180, 90, -180, -90];
  var estiloIx = function (o) { var k = JSON.stringify(o); if (!(k in stIx)) { stIx[k] = stl.length; stl.push(o); } return stIx[k]; };
  var camada = function (nome) { if (!(nome in camIx)) { camIx[nome] = cam.length; cam.push(nome); } return camIx[nome]; };
  var caixa = function (a) { for (var i = 0; i < a.length; i += 2) { if (a[i] < bb[0]) bb[0] = a[i]; if (a[i] > bb[2]) bb[2] = a[i]; if (a[i + 1] < bb[1]) bb[1] = a[i + 1]; if (a[i + 1] > bb[3]) bb[3] = a[i + 1]; } };
  var raizNome = '';
  var walk = function (el, nivel, camN) {
    Array.prototype.forEach.call(el.children, function (ch) {
      var t = ch.localName;
      if (t === 'Document' || t === 'Folder') {
        var nm = txtDe(ch, 'name') || '(sem nome)';
        if (nivel === 0) { raizNome = raizNome || nm; walk(ch, 1, nm); }
        else walk(ch, nivel + 1, nivel === 1 ? nm : camN);
      } else if (t === 'Placemark') {
        var n = txtDe(ch, 'name'), st = estiloIx(estiloDe(ch)), c = camada(camN || raizNome || 'Mapa');
        var A = [], L = [], P = null;
        Array.prototype.forEach.call(ch.getElementsByTagNameNS('*', 'Polygon'), function (pg) {
          Array.prototype.forEach.call(pg.getElementsByTagNameNS('*', 'LinearRing'), function (lr) { var k = coords(um(lr, 'coordinates')); if (k.length >= 6) { A.push(k); caixa(k); } });
        });
        Array.prototype.forEach.call(ch.getElementsByTagNameNS('*', 'LineString'), function (ls) { var k = coords(um(ls, 'coordinates')); if (k.length >= 4) { L.push(k); caixa(k); } });
        Array.prototype.forEach.call(ch.getElementsByTagNameNS('*', 'Point'), function (pt) { var k = coords(um(pt, 'coordinates')); if (k.length >= 2 && !P) { P = k.slice(0, 2); caixa(P); } });
        if (A.length) fs.push({ c: c, n: n, t: 'A', s: st, k: A });
        if (L.length) fs.push({ c: c, n: n, t: 'L', s: st, k: L });
        if (P) fs.push({ c: c, n: n, t: 'P', s: st, k: P });
      } else if (t === 'kml') walk(ch, nivel, camN);
    });
  };
  walk(doc.documentElement.localName === 'kml' ? doc.documentElement : doc, 0, '');
  var ov = [];
  Array.prototype.forEach.call(doc.getElementsByTagNameNS('*', 'GroundOverlay'), function (g) {
    var ic = um(g, 'Icon'), box = um(g, 'LatLonBox'); if (!ic || !box) return;
    var o = { href: txtDe(ic, 'href'), n: parseFloat(txtDe(box, 'north')), s: parseFloat(txtDe(box, 'south')), e: parseFloat(txtDe(box, 'east')), w: parseFloat(txtDe(box, 'west')) };
    if (o.href && [o.n, o.s, o.e, o.w].every(isFinite)) ov.push(o);
  });
  if (!fs.length && !ov.length) throw new Error('nenhum polígono, linha, ponto ou imagem encontrado no arquivo');
  if (!fs.length) bb = [ov[0].w, ov[0].s, ov[0].e, ov[0].n];
  return { nome: raizNome || arq, arq: arq, cam: cam, st: stl, fs: fs, bb: bb, ov: ov };
}
function mapaImportar(p, tipo, file) {
  var arq = file.name || 'mapa.kmz', ehKmz = /\.kmz$/i.test(arq);
  S.v.mapa = Object.assign(S.v.mapa || {}, { proc: 'Lendo ' + arq + '…' }); agendar();
  var Z = null;
  var lerTxt = ehKmz
    ? file.arrayBuffer().then(zipKml).then(function (z) { Z = z; return z.txt; })
    : file.text();
  lerTxt.then(function (txt) {
    var M = mapaLerKml(txt, arq), o = M.ov[0];
    if (o && Z && !/^https?:/i.test(o.href)) Z.arquivo(o.href).then(function (bl) { if (bl) mapaFundoSalvar(p, tipo, bl, [o.w, o.s, o.e, o.n]); });
    /* divide em partes que cabem no banco (≈200 KB cada) */
    var partes = [[]], tam = 0;
    M.fs.forEach(function (f) { var z = JSON.stringify(f).length; if (tam + z > 200000 && partes[partes.length - 1].length) { partes.push([]); tam = 0; } partes[partes.length - 1].push(f); tam += z; });
    var antigo = (p.mapas || {})[tipo], rz = mapaRaiz(p);
    partes.forEach(function (fs, i) { gravar(rz + '/' + tipo + (i ? '_' + (i + 1) : ''), i ? { fs: fs } : { nome: M.nome, arq: arq, cam: M.cam, st: M.st, bb: M.bb, fs: fs, fundo: (antigo && antigo.fundo) || null }); });
    if (antigo) for (var i = partes.length + 1; i <= (antigo.partes || 1); i++) gravar(rz + '/' + tipo + '_' + i, null);
    p.mapas = Object.assign({}, p.mapas || {}); p.mapas[tipo] = { fundo: antigo && antigo.fundo, osm: antigo && antigo.osm, arq: arq, nome: M.nome, dt: (function (d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); })(new Date()), n: M.fs.length, partes: partes.length, cam: M.cam.length };
    salvarMeta(p);
    S.mapCache = S.mapCache || {}; var M0 = S.mapCache[p.id + '/' + tipo]; if (M0 && M0.img) M.img = M0.img; if (M0 && M0.osm) M.osm = M0.osm; S.mapCache[p.id + '/' + tipo] = M;
    S.v.mapa = { tipo: tipo, off: {} };
    agendar();
  }).catch(function (e) { S.v.mapa.proc = null; msgbox('ERRO!', 'Não foi possível ler o mapa: ' + ((e && e.message) || e)); });
}
/* imagem de fundo (satélite): JPEG reduzido até caber num documento do banco */
function mapaFundoSalvar(p, tipo, blob, bb) {
  var url = URL.createObjectURL(blob), im = new Image();
  im.onload = function () {
    var lado = 2400, src = '';
    while (lado >= 600) {
      var k = Math.min(1, lado / Math.max(im.width, im.height)), cv = document.createElement('canvas');
      cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      for (var q = 0.82; q >= 0.5 && !src; q -= 0.08) { var d = cv.toDataURL('image/jpeg', q); if (d.length < 225000) src = d; }
      if (src) break; lado = Math.round(lado * 0.75);
    }
    URL.revokeObjectURL(url); if (!src) return aviso('A imagem de fundo é grande demais para salvar.');
    var F = { src: src, bb: bb }; gravar(mapaRaiz(p) + '/' + tipo + '_img', F);
    p.mapas = Object.assign({}, p.mapas); p.mapas[tipo] = Object.assign({}, p.mapas[tipo], { fundo: 1 }); salvarMeta(p);
    var M = S.mapCache && S.mapCache[p.id + '/' + tipo]; if (M) M.img = F; agendar();
  };
  im.onerror = function () { URL.revokeObjectURL(url); aviso('Não foi possível ler a imagem de fundo do KMZ.'); };
  im.src = url;
}
function mapaCarregar(p, tipo) {
  S.mapCache = S.mapCache || {}; var k = p.id + '/' + tipo;
  if (S.mapCache[k]) return S.mapCache[k];
  S.mapLoad = S.mapLoad || {};
  if (!S.mapLoad[k] && db) {
    S.mapLoad[k] = db.collection(mapaRaiz(p)).get().then(function (snap) {
      var D = {}; snap.docs.forEach(function (d) { D[d.id] = d.data(); });
      var d0 = D[tipo]; if (!d0) throw new Error('mapa não encontrado');
      var M = clone(d0), n = (p.mapas[tipo] || {}).partes || 1;
      for (var i = 2; i <= n; i++) M.fs = M.fs.concat(((D[tipo + '_' + i] || {}).fs) || []);
      if (D[tipo + '_img']) M.img = D[tipo + '_img'];
      if (D[tipo + '_osm']) { var O = clone(D[tipo + '_osm']), no = (p.mapas[tipo].osm || {}).partes || 1; for (var j = 2; j <= no; j++) O.w = O.w.concat(((D[tipo + '_osm_' + j] || {}).w) || []); M.osm = O; }
      if (D[tipo + '_osmt']) { var T = clone(D[tipo + '_osmt']); T.img = {}; Object.keys(D).forEach(function (kk) { if (kk.indexOf(tipo + '_osmt_') === 0) Object.assign(T.img, (D[kk] || {}).i || {}); }); M.osmt = T; }
      S.mapCache[k] = M; agendar();
    }).catch(function (e) { S.mapLoad[k] = null; S.v.mapa.err = (e && e.message) || String(e); agendar(); });
  }
  return null;
}
/* mover / excluir junto com o projeto */
function mapaMover(p, antigo) {
  if (!p.mapas || !Object.keys(p.mapas).length || !db) return;
  db.collection(antigo + '/' + p.id + '/mapas').get().then(function (snap) {
    snap.docs.forEach(function (d) { gravar(mapaRaiz(p) + '/' + d.id, clone(d.data())); gravar(antigo + '/' + p.id + '/mapas/' + d.id, null); });
  });
}
function mapaExcluir(p, tipo) {
  var ts = tipo ? [tipo] : Object.keys(p.mapas || {});
  ts.forEach(function (t) { var inf = p.mapas[t]; for (var i = 1; i <= (inf.partes || 1); i++) gravar(mapaRaiz(p) + '/' + t + (i > 1 ? '_' + i : ''), null); if (inf.fundo) gravar(mapaRaiz(p) + '/' + t + '_img', null); if (inf.osm) for (var j = 1; j <= (inf.osm.partes || 1); j++) gravar(mapaRaiz(p) + '/' + t + '_osm' + (j > 1 ? '_' + j : ''), null); if (inf.osmt) for (var q = 0; q <= (inf.osmt.partes || 1); q++) gravar(mapaRaiz(p) + '/' + t + '_osmt' + (q ? '_' + q : ''), null); if (S.mapCache) delete S.mapCache[p.id + '/' + t]; });
  if (tipo) { p.mapas = Object.assign({}, p.mapas); delete p.mapas[tipo]; salvarMeta(p); }
}
/* projeção local (metros), suficiente para a área de uma obra */
function mapaProj(M) {
  var lo0 = (M.bb[0] + M.bb[2]) / 2, la0 = (M.bb[1] + M.bb[3]) / 2, R = 6371008.8 * Math.PI / 180, kx = R * Math.cos(la0 * Math.PI / 180);
  return { x: function (lo) { return (lo - lo0) * kx; }, y: function (la) { return -(la - la0) * R; }, lo: function (x) { return x / kx + lo0; }, la: function (y) { return -y / R + la0; } };
}
var MAPA_PAD = ['#5b8def', '#e8762c', '#2e9e5b', '#c9352b', '#8b5cf6', '#0ea5a4', '#d9a21b', '#db2777'];
function mapaSvg(M, off) {
  var P = mapaProj(M), x0 = P.x(M.bb[0]), x1 = P.x(M.bb[2]), y0 = P.y(M.bb[3]), y1 = P.y(M.bb[1]);
  var w = Math.max(x1 - x0, 50), hh = Math.max(y1 - y0, 50), mg = Math.max(w, hh) * 0.04;
  var vb0 = [x0 - mg, y0 - mg, w + 2 * mg, hh + 2 * mg];
  var V = S.v.mapa, vb = V.vb || vb0; V.vb0 = vb0;
  var pts = function (a) { var s = ''; for (var i = 0; i < a.length; i += 2) s += (i ? 'L' : 'M') + P.x(a[i]).toFixed(1) + ' ' + P.y(a[i + 1]).toFixed(1); return s; };
  var tf = vb[2] / 95, out = '', lbl = '';
  M.fs.forEach(function (f) {
    if (off[f.c]) return;
    var s = M.st[f.s] || {}, cp = MAPA_PAD[f.c % MAPA_PAD.length], tt = '<title>' + esc((f.n ? f.n + ' · ' : '') + M.cam[f.c]) + '</title>';
    var avc = V._av && f.n && f.t !== 'P' ? V._av[f.n] : null;
    if (avc) { var corA = MAPA_AVC[mapaSt(avc.pc)]; s = Object.assign({}, s, { f: corA, fa: 1, nf: 0, no: 0, l: corA, la: 1, w: Math.max(2, s.w || 0) }); tt = '<title>' + esc(f.n + ' · área ' + avc.a + ' · avanço ' + pct(avc.pc / 100)) + '</title>'; }
    else if (V._av && f.t === 'A') { s = Object.assign({}, s, { fa: 0.15 }); }
    if (f.t === 'A') {
      var d = f.k.map(function (r) { return pts(r) + 'Z'; }).join('');
      out += '<path d="' + d + '" fill="' + (s.nf ? 'none' : (s.f || cp)) + '" fill-opacity="' + (s.nf ? 0 : Math.min(0.55, s.fa == null ? 0.25 : s.fa * 0.55)) + '" stroke="' + (s.no ? 'none' : (s.l || cp)) + '" stroke-opacity="' + (s.la == null ? 1 : Math.max(0.35, s.la)) + '" stroke-width="' + Math.max(1, Math.min(4, s.w || 1.5)) + '" vector-effect="non-scaling-stroke" fill-rule="evenodd">' + tt + '</path>';
    } else if (f.t === 'L') {
      out += '<path d="' + f.k.map(pts).join('') + '" fill="none" stroke="' + (s.l || cp) + '" stroke-opacity="' + (s.la == null ? 1 : Math.max(0.35, s.la)) + '" stroke-width="' + Math.max(1, Math.min(4, s.w || 1.2)) + '" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round">' + tt + '</path>';
    } else {
      var x = P.x(f.k[0]), y = P.y(f.k[1]);
      lbl += '<g class="mp-pt"><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (tf * 0.32).toFixed(2) + '" fill="' + (s.p || '#ffd23f') + '" stroke="#10161f" stroke-width="1.2" vector-effect="non-scaling-stroke"/>' +
        (f.n ? '<text x="' + (x + tf * 0.55).toFixed(1) + '" y="' + (y + tf * 0.35).toFixed(1) + '" font-size="' + tf.toFixed(2) + '">' + esc(f.n) + '</text>' : '') + tt + '</g>';
    }
  });
  var fundo = '';
  if (M.img && M.img.src && !V.semFundo) { var b = M.img.bb, fx = P.x(b[0]), fy = P.y(b[3]); fundo = '<image href="' + M.img.src + '" x="' + fx.toFixed(1) + '" y="' + fy.toFixed(1) + '" width="' + (P.x(b[2]) - fx).toFixed(1) + '" height="' + (P.y(b[1]) - fy).toFixed(1) + '" preserveAspectRatio="none" opacity="' + (V.opF == null ? 1 : V.opF) + '"/>'; }
  var osm = M.osm && !V.semOsm ? osmSvg(M, P, tf) : '';
  V._M = M; V._tk = null;
  var tl = M.osmt && !V.semOsmT ? '<g id="osm-tiles" pointer-events="none" opacity="' + (V.opT == null ? 1 : V.opT) + '">' + osmtSvg(M, P, vb, V.mpp || vb[2] / 900).s + '</g>' : '';
  return '<svg id="mapa-svg" class="mp-svg" viewBox="' + vb.map(function (v) { return v.toFixed(1); }).join(' ') + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Mapa ' + esc(M.nome) + '">' + osm + tl + fundo + out + lbl + '</svg>';
}
function shMapa(p) {
  var V = S.v.mapa || (S.v.mapa = { tipo: 'geral', off: {} }); V.off = V.off || {};
  var ed = podeEditar(), tipo = V.tipo || 'geral', T = MAPAS_TIPOS.filter(function (t) { return t[0] === tipo; })[0] || MAPAS_TIPOS[0];
  var inf = (p.mapas || {})[tipo];
  var abas = '<div class="rel-bar">' + MAPAS_TIPOS.map(function (t) { return '<button class="' + (t[0] === tipo ? 'on' : '') + '" ' + h(function () { S.v.mapa = { tipo: t[0], off: {} }; agendar(); }) + '>' + t[1] + '</button>'; }).join('') + '</div>';
  var up = function (rot, cls) { return ed ? '<label class="' + (cls || 'bt') + '"><svg viewBox="0 0 20 20" aria-hidden="true" width="16" height="16"><path d="M10 13V4M6 7.5l4-4 4 4M4 15.5h12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' + rot + '<input type="file" accept=".kmz,.kml" hidden ' + h(function (el) { var f = el.files && el.files[0]; el.value = ''; if (f) mapaImportar(p, tipo, f); }) + '></label>' : ''; };
  var tit = titulo('MAPAS', '<span class="vz" style="font:500 12px var(--ui)">' + esc(T[1]) + ' · ' + esc(T[2]) + '</span>');
  if (V.proc) { if (!inf || (S.mapCache && S.mapCache[p.id + '/' + tipo])) V.proc = null; }
  if (V.proc) return tit + abas + '<div class="vazio">' + esc(V.proc) + '</div>';
  if (!inf) return tit + abas + '<div class="gc mp-vazio"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 12l12-5 12 5 12-5v29l-12 5-12-5-12 5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M18 7v29M30 12v29" fill="none" stroke="currentColor" stroke-width="2"/></svg><h3>Nenhum mapa ' + esc(T[1].toLowerCase()) + ' neste projeto</h3><p>Envie o arquivo KMZ (ou KML) exportado do Google Earth, AutoCAD ou outro SIG. O mapa é gerado a partir das camadas, polígonos, linhas e pontos do arquivo.</p>' + (ed ? up('Inserir KMZ', 'bxl in') : '<p class="vz">Somente o administrador pode inserir o mapa.</p>') + '</div>';
  var M = mapaCarregar(p, tipo);
  if (!M) return tit + abas + '<div class="vazio">' + (V.err ? 'Não foi possível carregar o mapa: ' + esc(V.err) : 'Carregando o mapa…') + '</div>';
  var cont = {}, corC = {}; M.fs.forEach(function (f) { cont[f.c] = (cont[f.c] || 0) + 1; var s = M.st[f.s] || {}; if (!corC[f.c] && f.t !== 'P') corC[f.c] = (f.t === 'A' && !s.nf && s.f) || s.l; });
  var P = mapaProj(M), lx = (P.x(M.bb[2]) - P.x(M.bb[0])) / 1000, ly = (P.y(M.bb[1]) - P.y(M.bb[3])) / 1000;
  var fnd = M.img && M.img.src ? '<h4>Fundo</h4><label class="mp-cam"><input type="checkbox"' + (V.semFundo ? '' : ' checked') + ' ' + h(function () { V.semFundo = !V.semFundo; agendar(); }) + '><i style="background:linear-gradient(135deg,#6b7f4a,#a08a5c)"></i><span>Imagem de satélite</span><em></em></label>' +
    (V.semFundo ? '' : '<label class="mp-op"><span>Opacidade</span><input type="range" min="20" max="100" step="5" value="' + Math.round((V.opF == null ? 1 : V.opF) * 100) + '" aria-label="Opacidade da imagem de satélite" ' + h(function (el) { V.opF = (+el.value) / 100; agendar(); }) + '></label>') + '<div style="height:10px"></div>' : '';
  var side = '<aside class="mp-side">' + mapaAvPainel(p, tipo, M, ed) + osmPainel(p, tipo, M, ed) + fnd + '<h4>Camadas</h4><div class="mp-cams">' + M.cam.map(function (c, i) {
    return '<label class="mp-cam"><input type="checkbox"' + (V.off[i] ? '' : ' checked') + ' ' + h(function () { V.off[i] = !V.off[i]; agendar(); }) + '><i style="background:' + (corC[i] || MAPA_PAD[i % MAPA_PAD.length]) + '"></i><span>' + esc(c) + '</span><em>' + int(cont[i] || 0) + '</em></label>';
  }).join('') + '</div>' +
    '<h4>Arquivo</h4><dl class="mp-inf"><dt>Nome</dt><dd>' + esc(M.nome) + '</dd><dt>Arquivo</dt><dd>' + esc(inf.arq) + '</dd><dt>Inserido em</dt><dd>' + esc(String(inf.dt || '').split('-').reverse().join('/')) + '</dd><dt>Elementos</dt><dd>' + int(M.fs.length) + '</dd><dt>Extensão</dt><dd>' + nf2.format(lx) + ' × ' + nf2.format(ly) + ' km</dd><dt>Centro</dt><dd>' + nf6((M.bb[1] + M.bb[3]) / 2) + ', ' + nf6((M.bb[0] + M.bb[2]) / 2) + '</dd></dl>' +
    (ed ? '<div class="mp-acs">' + up('Substituir KMZ', 'lk') + '<button class="lk dn" ' + h(function () { confirma('Excluir o mapa ' + T[1].toLowerCase() + ' deste projeto?', function () { mapaExcluir(p, tipo); S.v.mapa = { tipo: tipo, off: {} }; }); }) + '>Excluir mapa</button></div>' : '') + '</aside>';
  var ctr = '<div class="mp-ctr"><button aria-label="Aproximar" data-mz="in">+</button><button aria-label="Afastar" data-mz="out">−</button><button aria-label="Ajustar à tela" data-mz="fit"><svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></button></div>' +
    '<div class="mp-n" aria-hidden="true"><svg viewBox="0 0 20 28" width="18" height="25"><path d="M10 2l6 16-6-4-6 4z" fill="currentColor"/><text x="10" y="27" text-anchor="middle" font-size="8" font-weight="700" fill="currentColor">N</text></svg></div>' +
    '<div class="mp-esc" id="mp-esc"><i></i><span></span></div><div class="mp-xy" id="mp-xy"></div>';
  return tit + abas + '<div class="mp-grid"><div class="mp-cv' + (osmVisivel(M, V) ? ' osm' : '') + '" id="mp-cv">' + mapaSvg(M, V.off) + ctr + (osmVisivel(M, V) ? '<div class="mp-attr">© colaboradores do <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a></div>' : '') + '</div>' + side + '</div>' +
    '<div class="nota">Arraste para mover e use a roda do mouse (ou os botões) para aproximar. Passe o mouse sobre um elemento para ver o nome e a camada. As camadas são as pastas do arquivo KMZ.</div>';
}
var nf6 = function (v) { return (Math.round(v * 1e6) / 1e6).toFixed(6).replace('.', ','); };
/* zoom e arraste sem redesenhar a página */
function mapaVb(svg, vb) {
  S.v.mapa.vb = vb; svg.setAttribute('viewBox', vb.map(function (v) { return v.toFixed(2); }).join(' '));
  mapaEscala();
}
function mapaEscala() {
  var svg = document.getElementById('mapa-svg'), el = document.getElementById('mp-esc'); if (!svg || !el) return;
  var vb = S.v.mapa.vb || S.v.mapa.vb0, r = svg.getBoundingClientRect(); if (!r.width) return;
  var mpp = Math.max(vb[2] / r.width, vb[3] / r.height), alvo = mpp * 110, e = Math.pow(10, Math.floor(Math.log10(alvo))), f = alvo / e, n = (f >= 5 ? 5 : f >= 2 ? 2 : 1) * e;
  el.querySelector('i').style.width = (n / mpp) + 'px'; el.querySelector('span').textContent = n >= 1000 ? nf2.format(n / 1000).replace(/,00$/, '') + ' km' : n + ' m';
  S.v.mapa.mpp = mpp; osmtAtualiza(svg, vb, mpp);
  var tf = vb[2] / 95; Array.prototype.forEach.call(svg.querySelectorAll('.mp-pt'), function (g) { var c = g.querySelector('circle'), t = g.querySelector('text'); c.setAttribute('r', (tf * 0.32).toFixed(2)); if (t) { t.setAttribute('font-size', tf.toFixed(2)); t.setAttribute('x', (+c.getAttribute('cx') + tf * 0.55).toFixed(1)); t.setAttribute('y', (+c.getAttribute('cy') + tf * 0.35).toFixed(1)); } });
}
function mapaZoom(svg, fator, cx, cy) {
  var vb = (S.v.mapa.vb || S.v.mapa.vb0).slice(), r = svg.getBoundingClientRect();
  var s = Math.max(vb[2] / r.width, vb[3] / r.height), ox = vb[0] + (vb[2] - r.width * s) / 2, oy = vb[1] + (vb[3] - r.height * s) / 2;
  var px = cx == null ? vb[0] + vb[2] / 2 : ox + (cx - r.left) * s, py = cy == null ? vb[1] + vb[3] / 2 : oy + (cy - r.top) * s;
  var w = Math.min(Math.max(vb[2] * fator, 2), S.v.mapa.vb0[2] * 8), k = w / vb[2], hh = vb[3] * k;
  mapaVb(svg, [px - (px - vb[0]) * k, py - (py - vb[1]) * k, w, hh]);
}
(function () {
  var drag = null;
  document.addEventListener('wheel', function (e) { var svg = e.target.closest && e.target.closest('#mapa-svg'); if (!svg) return; e.preventDefault(); mapaZoom(svg, e.deltaY > 0 ? 1.2 : 1 / 1.2, e.clientX, e.clientY); }, { passive: false });
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-mz]'); if (!b) return; var svg = document.getElementById('mapa-svg'); if (!svg) return; var z = b.getAttribute('data-mz'); if (z === 'fit') mapaVb(svg, S.v.mapa.vb0.slice()); else mapaZoom(svg, z === 'in' ? 1 / 1.5 : 1.5); });
  document.addEventListener('pointerdown', function (e) { var svg = e.target.closest && e.target.closest('#mapa-svg'); if (!svg || e.button !== 0) return; var vb = (S.v.mapa.vb || S.v.mapa.vb0).slice(), r = svg.getBoundingClientRect(); drag = { svg: svg, x: e.clientX, y: e.clientY, vb: vb, s: Math.max(vb[2] / r.width, vb[3] / r.height) }; svg.classList.add('arr'); try { svg.setPointerCapture(e.pointerId); } catch (x) { } });
  document.addEventListener('pointermove', function (e) {
    if (drag) { mapaVb(drag.svg, [drag.vb[0] - (e.clientX - drag.x) * drag.s, drag.vb[1] - (e.clientY - drag.y) * drag.s, drag.vb[2], drag.vb[3]]); return; }
    var svg = e.target.closest && e.target.closest('#mapa-svg'), xy = document.getElementById('mp-xy'); if (!svg || !xy) return;
    var p = proj(), M = p && S.mapCache && S.mapCache[p.id + '/' + (S.v.mapa.tipo || 'geral')]; if (!M) return;
    var vb = S.v.mapa.vb || S.v.mapa.vb0, r = svg.getBoundingClientRect(), s = Math.max(vb[2] / r.width, vb[3] / r.height), ox = vb[0] + (vb[2] - r.width * s) / 2, oy = vb[1] + (vb[3] - r.height * s) / 2, P = mapaProj(M);
    xy.textContent = nf6(P.la(oy + (e.clientY - r.top) * s)) + ', ' + nf6(P.lo(ox + (e.clientX - r.left) * s));
  });
  document.addEventListener('pointerup', function () { if (drag) { drag.svg.classList.remove('arr'); drag = null; } });
  window.addEventListener('resize', function () { mapaEscala(); });
})();

/* ================= comandos da faixa e janelas ================= */
var ICM = {
  info: '<circle cx="16" cy="16" r="14" fill="#1e73d8"/><rect x="14.300" y="13.500" width="3.400" height="10" fill="#fff"/><circle cx="16" cy="9.300" r="2.100" fill="#fff"/>',
  crit: '<circle cx="16" cy="16" r="14" fill="#d61d1d"/><path d="M10.500 10.500l11 11M21.500 10.500l-11 11" stroke="#fff" stroke-width="3.200"/>',
  perg: '<circle cx="16" cy="16" r="14" fill="#1e73d8"/><path d="M11.800 12.300c0-2.600 1.900-4.300 4.400-4.300s4.300 1.600 4.300 3.900c0 3.300-4.300 3.300-4.300 6.600" fill="none" stroke="#fff" stroke-width="2.800"/><circle cx="16.200" cy="23.300" r="1.900" fill="#fff"/>'
};
function janela(tit, corpo, w, fechar) {
  return '<div class="jan" role="dialog" aria-label="' + esc(tit) + '" style="--w:' + (w || 470) + 'px"><div class="jan-t"><b>' + esc(tit) + '</b><button aria-label="Fechar" ' + h(fechar || function () { S.v.dlg = null; agendar(); }) + '>×</button></div><div class="jan-c">' + corpo + '</div></div>';
}
function janelas() {
  var m = S.v.msg, d = S.v.dlg;
  if (m) {
    var fechar = function () { S.v.msg = null; agendar(); };
    return janela(m.titulo, '<div class="msgi"><svg viewBox="0 0 32 32" aria-hidden="true">' + ICM[m.tipo] + '</svg><div>' + esc(m.texto) + '</div></div><div class="bts">' +
      (m.sim ? bt('SIM', function () { var f = m.sim; S.v.msg = null; f(); agendar(); }) + bt('NÃO', fechar, 'cz') : '<button id="msg-ok" class="bt" ' + h(fechar) + '>OK</button>') + '</div>', 420, fechar);
  }
  if (!d) return '';
  return { sobre: dlgSobre, ativ: dlgAtiv, repl: dlgRepl, filtro: dlgFiltro, erros: dlgErros, exp: dlgExp, impx: dlgImpx, impcpu: dlgImpCpu, croCpu: dlgCroCpu, croImp: dlgCroImp, usr: dlgUsr, proc: dlgProc, supIt: dlgSupIt, supNovo: dlgSupNovo, rev: dlgRev }[d.tipo](d);
}
function resultadoAtualizar() {
  var p = proj(); if (!p) return;
  var n = calc(p).res.erros.length;
  if (n) msgbox('ERRO!', 'Foram encontrados ( ' + ('0' + n).slice(-2) + ' ) erros.\n\nPara visualização dos erros encontrados clique no menu "CUSTO" e selecione a opção "LISTA DE ERROS".', 'crit');
  else msgbox('SUCESSO!', 'Dados atualizados com sucesso.\n\nNão foram encontrados erros.');
}
/* "Processando…" curto, como o formulário da planilha, e depois o resultado */
function processar(depois) {
  S.v.dlg = { tipo: 'proc' }; render();
  setTimeout(function () { S.cache = {}; S.ctx = null; S.v.dlg = null; if (depois) depois(); else resultadoAtualizar(); agendar(); }, 350);
}
function dlgProc() { return '<div class="jan" style="--w:330px"><div class="jan-t"><b>Processando...</b></div><div class="jan-c"><div>Aguarde o término do processamento dos dados.</div></div></div>'; }

function cmdSobre() { S.v.dlg = { tipo: 'sobre' }; agendar(); }
function dlgSobre() {
  return janela('Sobre', '<fieldset><legend>Informações</legend><table style="font:12px var(--ui)"><tr><td>Software</td><td>: Planning Projects</td></tr><tr><td>Desenvolvedor</td><td>: OP Consulting</td></tr><tr><td>Executora</td><td>: ' + esc(empresaRot()) + '</td></tr>' + (function () { var p = proj(), c = p && p.contratante || {}, l = p && p.local || {}; if (!p) return ''; return '<tr><td>Contratante</td><td>: ' + esc(c.razao || c.fantasia || '–') + (c.cnpj ? ' · CNPJ ' + esc(c.cnpj) : '') + '</td></tr><tr><td>Local</td><td>: ' + esc([l.nome, l.municipio && (l.municipio + (l.uf ? '/' + l.uf : ''))].filter(Boolean).join(' · ') || '–') + '</td></tr>'; })() + '<tr><td>Versão</td><td>: web 2.0 — equivalente à planilha 24.06.28</td></tr><tr><td>Projetos</td><td>: ' + S.projetos.length + '</td></tr><tr><td>Perfil</td><td>: ' + (S.papel.dono ? 'Administrador' : 'Usuário (somente leitura)') + '</td></tr></table></fieldset>' +
    '<div class="inf">As guias e os comandos seguem a planilha original. O cálculo é refeito a cada alteração; o comando Atualizar apenas confere e mostra os erros.</div><div class="bts">' + bt('OK', function () { S.v.dlg = null; agendar(); }) + '</div>', 430);
}
function cmdBase() {
  if (!db) return msgbox('AVISO!', 'Sem conexão com os dados nesta visualização.');
  if (fila.size) return msgbox('AVISO!', 'Aguarde terminar de salvar as alterações e tente novamente.');
  S.v.dlg = { tipo: 'proc' }; render();
  lerTudo().then(function () { S.v.dlg = null; if (!proj()) { S.v.pid = null; } invalidaListas(); msgbox('SUCESSO!', 'Base de dados local atualizada com sucesso.'); }, function (e) { S.v.dlg = null; msgbox('ERRO CRÍTICO!', 'Não foi possível atualizar: ' + ((e && e.message) || e), 'crit'); });
}
function cmdAtualizar() { processar(); }
function cmdUsuarios() { S.v.dlg = { tipo: 'usr' }; agendar(); }
function dlgUsr() {
  var lib = S.projetos.filter(function (p) { return p.liberado; }).length;
  return janela('Usuários e acessos', '<fieldset><legend>Sessão atual</legend>Modo: <b>' + (ehAdmin() ? 'ADMINISTRADOR' : 'USUARIO') + '</b>' + (S.papel.nome ? ' · ' + esc(S.papel.nome) : '') + '<br>Projetos liberados: ' + lib + (S.papel.dono ? ' · rascunhos: ' + (S.projetos.length - lib) : '') + '</fieldset>' +
    '<fieldset><legend>Opções</legend><b>ADMINISTRADOR</b> — o dono da página e quem estiver marcado como administrador em Sistema › Cadastro de usuários. Edita tudo, inclusive bancos de dados e composições.<br><br><b>USUÁRIO</b> — acessa, edita ou só visualiza as seções e os projetos definidos para ele no Cadastro de usuários.</fieldset>' + (ehAdmin() ? '<div class="bts" style="justify-content:flex-start">' + bt('ABRIR CADASTRO DE USUÁRIOS', function () { S.v.dlg = null; S.v.aba = 'USR'; }) + '</div>' : '') +
    '<fieldset><legend>Informações</legend><div class="inf">1. Convide a pessoa pelo compartilhamento desta página: Colaborador para quem vai editar projetos, Editor para administradores, Leitor para quem só visualiza.<br>2. Cadastre o e-mail dela em Sistema › Cadastro de usuários e marque as seções e os projetos.<br>3. Ela entra com a própria conta; não há senha do sistema.<br>4. Projetos em rascunho não são entregues aos convidados; use Liberar para publicá-los.<br>5. Para retirar o acesso, exclua o usuário e remova a pessoa do compartilhamento.</div></fieldset><div class="bts">' + bt('FECHAR', function () { S.v.dlg = null; agendar(); }) + '</div>', 520);
}

/* ---------- Atividades ---------- */
function cmdAtividades() { S.v.dlg = { tipo: 'ativ', aba: 0, grupo: '', ativ: '', nome: '', trecho: '', cc: '', uni: '', qtd: 0, equipes: '', todos: false }; agendar(); }
function dlgAtiv(d) {
  var p = proj(), t = S.base.tabelas, grupos = gruposDe(p), ok = !!d.grupo && (d.aba === 0 || !!d.ativ), off = !ok;
  var doGrupo = p.atividades.filter(function (a) { return a.grupo === d.grupo; }).sort(function (a, b) { return num(a.ordem) - num(b.ordem); });
  var gnome = grupos[d.grupo - 1], ccL = ccLista(p), ccs = ccL.filter(function (c) { return d.todos || c.g === gnome || (p.ccs && p.ccs.length && semAcento(gnome || '') === 'INDIRETOS' && c.t === 'I'); }).map(function (c) { return c.d; }); if (!ccs.length && p.ccs && p.ccs.length) ccs = ccL.map(function (c) { return c.d; });
  if (d.cc && ccs.indexOf(d.cc) < 0) ccs.unshift(d.cc);
  var rot = {}; grupos.forEach(function (g, i) { rot[i + 1] = g; });
  var limpa = function () { d.ativ = ''; d.nome = ''; d.trecho = ''; d.cc = ''; d.uni = ''; d.qtd = 0; d.equipes = ''; d.todos = false; };
  var alvo = function () { return p.atividades.filter(function (a) { return a.id === d.ativ; })[0]; };
  var validar = function () {
    var nome = semAcento(d.nome).trim();
    if (!nome || !d.trecho || !d.uni || !d.equipes || !d.qtd) return 'Preencha todos os campos para continuar.';
    if (nome.length < 7) return 'Digite o nome da atividade com mais de 07 (sete) caracteres no campo DESCRIÇÃO em ATIVIDADE.\n\nValor atual: ' + nome + '\nTotal de caracteres: ' + ('0' + nome.length).slice(-2);
    if (/^[\d\s.,]+$/.test(nome)) return 'A descrição da atividade não pode ter somente números.\n\nValor atual: ' + nome;
    var m = /['!@#$%¨&()_+={}\[\]ªº:,?\/\\|^´><]/.exec(nome);
    if (m) return 'Remova os caracteres especiais da descrição da atividade.\n\nValor atual: ' + nome + '\nRemover caracter: ' + m[0];
    var a = alvo();
    if (p.atividades.some(function (o) { return o.nome === nome && o !== a; })) return 'Já existe uma atividade com o nome\n' + nome + '\n\nDigite outro nome pra prosseguir.';
    return '';
  };
  var criar = function () {
    var e = validar(); if (e) return msgbox('AVISO!', e);
    var nome = semAcento(d.nome).trim();
    if (d.aba === 0) {
      var ord = doGrupo.reduce(function (m, a) { return Math.max(m, num(a.ordem)); }, 0) + 1;
      var a = { id: uid(), grupo: d.grupo, ordem: ord, nome: nome, uni: d.uni, qtd: d.qtd, equipes: d.equipes, trecho: d.trecho, cc: d.cc || '', linhas: CV.map(function (C) { return linhaNova(C.cs[0]); }) };
      p.atividades.push(a); salvarAtiv(p, a);
    } else { var x = alvo(); x.nome = nome; x.uni = d.uni; x.qtd = d.qtd; x.equipes = d.equipes; x.trecho = d.trecho; x.cc = d.cc || ''; salvarAtiv(p, x); }
    S.v.dlg = null; S.v.aba = 'FIN'; S.v.nivel = 3; processar();
  };
  var excluir = function () {
    var x = alvo(); if (!x) return;
    confirma('Tem certeza que deseja excluir a atividade\n' + x.nome + ' ?\n\nEssa ação não poderá ser desfeita.', function () { p.atividades = p.atividades.filter(function (o) { return o !== x; }); apagarAtiv(p, x); S.v.dlg = null; processar(); });
  };
  var tb = function (i, r) { return '<button class="' + (d.aba === i ? 'on' : '') + '" ' + h(function () { d.aba = i; d.grupo = ''; limpa(); agendar(); }) + '>' + r + '</button>'; };
  return janela('Atividades', '<div class="tabs">' + tb(0, 'Nova Atividade') + tb(1, 'Atualizar / Excluir') + '</div>' +
    '<fieldset><legend>Filtro</legend><div class="fl"><label class="w2">Selecione uma opção abaixo' + escolha('da-g', d.grupo, grupos.map(function (_, i) { return i + 1; }), function (v) { d.grupo = v; limpa(); }, { num: true, rotulos: rot }) + '</label>' +
    (d.aba === 1 ? '<label class="w2">Selecione uma atividade' + escolha('da-a', d.ativ, doGrupo.map(function (a) { return a.id; }), function (v) { d.ativ = v; var a = alvo(); if (a) { d.nome = a.nome; d.trecho = a.trecho || 'N/A'; d.cc = a.cc || ''; d.uni = a.uni; d.qtd = a.qtd; d.equipes = a.equipes; } else limpa(); }, { rotulos: doGrupo.reduce(function (m, a) { m[a.id] = a.nome; return m; }, {}), off: !d.grupo }) + '</label>' : '') + '</div></fieldset>' +
    '<fieldset><legend>Atividade</legend><div class="fl"><label class="w2">Descrição' + campo('da-n', d.nome, function (v) { d.nome = v; }, { upper: true, off: off }) + '</label><label>Local / frente' + escolha('da-s', d.trecho, (p.subestacoes || []).map(function (x) { return x.s; }).concat(['N/A']), function (v) { d.trecho = v; }, { off: off }) + '</label>' +
    '<label class="w2">Centro de custo' + escolha('da-c', d.cc, ccs, function (v) { d.cc = v; }, { off: off }) + '</label><label class="w2" style="flex-direction:row;align-items:center;gap:6px"><input type="checkbox" id="da-t"' + (d.todos ? ' checked' : '') + (off ? ' disabled' : '') + ' ' + h(function (el) { d.todos = el.checked; agendar(); }) + '> Mostrar todos</label></div></fieldset>' +
    '<fieldset><legend>Quantidades</legend><div class="fl"><label>Unidade' + escolha('da-u', d.uni, t.unidades.map(function (u) { return u.s; }), function (v) { d.uni = v; }, { off: off }) + '</label><label>Total' + campo('da-q', d.qtd, function (v) { d.qtd = v; }, { t: 'num', off: off }) + '</label><label>Equipes' + escolha('da-e', d.equipes, Array.from({ length: 24 }, function (_, i) { return i + 1; }), function (v) { d.equipes = v; }, { num: true, off: off }) + '</label></div></fieldset>' +
    '<fieldset><legend>Informações</legend><div class="inf">1. Todos os campos são de preenchimento obrigatório.<br>2. A descrição da atividade precisa ter mais de 07 (sete) caracteres.<br>3. Caso não apareça o centro de custo desejado, marque a opção "MOSTRAR TODOS".</div></fieldset>' +
    '<div class="bts">' + (d.aba === 0 ? bt('CRIAR', criar, '', off) + bt('CANCELAR', function () { S.v.dlg = null; agendar(); }, 'cz') : bt('ATUALIZAR', criar, 'vd', off) + bt('EXCLUIR', excluir, 'vm', off)) + '</div>', 500);
}

/* ---------- Replanejar ---------- */
function cmdReplanejar() { S.v.dlg = { tipo: 'repl', sel: '', ap: '', op: '', tp: '', qtd: 0, reutilizar: false, feitos: {}, mudou: false }; S.v.aba = 'FIN'; agendar(); }
function edate(d, n) { var p = E.ymd(d), mi = p[0] * 12 + p[1] + n, ult = E.dom(E.eom(mi)); return E.som(mi) + Math.min(p[2], ult) - 1; }
function dlgRepl(d) {
  var p = proj(), c = calc(p), AP = ['APLICAR CRITÉRIOS NAS DATAS DE INÍCIO E TÉRMINO', 'APLICAR CRITÉRIOS SOMENTE NA DATA DE INÍCIO', 'APLICAR CRITÉRIOS SOMENTE NA DATA DE TÉRMINO'], OP = ['AVANÇAR', 'RECUAR'], TP = ['DIAS', 'MESES'];
  var lista = c.fin.linhas.filter(function (l) { return l.tipo === 'a' && l.ini != null && !d.feitos[l.id]; });
  var sel = lista.filter(function (l) { return l.id === d.sel; })[0];
  var mv = function (dia, qual) { // qual: 0 início, 1 término
    var ap = AP.indexOf(d.ap), aplica = ap === 0 || (ap === 1 && qual === 0) || (ap === 2 && qual === 1), n = Math.trunc(num(d.qtd)) * (d.op === 'RECUAR' ? -1 : 1);
    if (!aplica) return dia;
    return d.tp === 'MESES' ? edate(dia, n) : dia + n;
  };
  var pronto = sel && d.ap && d.op && d.tp && num(d.qtd) > 0, n1 = pronto ? mv(sel.ini, 0) : null, n2 = pronto ? mv(sel.fim, 1) : null;
  var alterar = function () {
    if (!pronto) return msgbox('AVISO!', 'Preencha todos os campos para continuar.');
    if (n1 > n2) return msgbox('AVISO!', 'A data de início não pode ser superior à data de término.');
    var a = p.atividades.filter(function (x) { return x.id === sel.id; })[0];
    a.linhas.forEach(function (l) {
      var i = E.day(l.ini), f = E.day(l.fim);
      if (i == null) return;
      l.ini = E.iso(mv(i, 0));
      if (l.c !== 4 && f != null) l.fim = E.iso(mv(f, 1));
    });
    salvarAtiv(p, a); d.feitos[sel.id] = 1; d.mudou = true; d.sel = ''; d.qtd = 0;
    if (!d.reutilizar) { d.ap = ''; d.op = ''; d.tp = ''; }
  };
  var fechar = function () { S.v.dlg = null; if (d.mudou) processar(); else agendar(); };
  return janela('Replanejar', '<div class="lb"><table><tr><th>ATIVIDADE</th><th>INÍCIO</th><th>TÉRMINO</th></tr>' + (lista.length ? lista.map(function (l) {
    return '<tr class="' + (l.id === d.sel ? 's' : '') + '" ' + h(function () { d.sel = l.id; d.qtd = 0; if (!d.reutilizar) { d.ap = ''; d.op = ''; d.tp = ''; } agendar(); }) + '><td class="w">' + esc(l.item + ' ' + l.nome) + '</td><td>' + fdate(l.ini) + '</td><td>' + fdate(l.fim) + '</td></tr>';
  }).join('') : '<tr><td colspan="3">Nenhuma atividade com datas para replanejar.</td></tr>') + '</table></div>' +
    '<fieldset><legend>Critério</legend><div class="fl"><label class="w2">Aplicação' + escolha('dr-a', d.ap, AP, function (v) { d.ap = v; }, { off: !sel }) + '</label><label>Opção' + escolha('dr-o', d.op, OP, function (v) { d.op = v; }, { off: !d.ap }) + '</label><label>Tempo' + escolha('dr-t', d.tp, TP, function (v) { d.tp = v; }, { off: !d.op }) + '</label><label>Quantidade' + campo('dr-q', d.qtd, function (v) { d.qtd = v; }, { t: 'num', off: !d.tp, live: true }) + '</label></div></fieldset>' +
    '<fieldset><legend>Período atualizado</legend><div class="fl"><label>Data de Início<input type="text" disabled value="' + (n1 == null ? '' : fdate(n1)) + '"></label><label>Data de Término<input type="text" disabled value="' + (n2 == null ? '' : fdate(n2)) + '"></label></div></fieldset>' +
    '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="dr-r"' + (d.reutilizar ? ' checked' : '') + ' ' + h(function (el) { d.reutilizar = el.checked; agendar(); }) + '> Reutilizar critérios de Aplicação, Opção e Tempo</label>' +
    '<div class="bts">' + bt('ALTERAR', alterar, '', !pronto) + (d.mudou ? bt('ATUALIZAR', fechar, 'vd') : bt('CANCELAR', fechar, 'cz')) + '</div>', 540, fechar);
}

/* ---------- Histograma / Custo detalhado ---------- */
function cmdFiltro(alvo) { var f = S.v.filtro[alvo]; S.v.dlg = { tipo: 'filtro', alvo: alvo, op: '', valor: '' }; S.v.aba = alvo.toUpperCase(); void f; agendar(); }
function dlgFiltro(d) {
  var p = proj(), rows = calc(p).res.rows, nome = d.alvo === 'his' ? 'Histograma' : 'Custo Detalhado', i = d.op === '' ? -1 : FILTROS.map(function (x) { return x[0]; }).indexOf(d.op), vals = [];
  if (i === 0) vals = ['GERAL']; else if (i > 0) { var st = {}; rows.forEach(function (r) { var v = r[FILTROS[i][1]]; if (v) st[v] = 1; }); vals = Object.keys(st).sort(); }
  var txt = ['de todo empreendimento', 'por grupo de atividade', 'por atividade / equipe', 'por local / frente', 'por centro de custo'][i] || '';
  return janela(nome, '<fieldset><legend>Filtro</legend><div class="fl"><label class="w2">Selecione uma opção abaixo' + escolha('df-o', d.op, FILTROS.map(function (x) { return x[0]; }), function (v) { d.op = v; d.valor = v === 'PROJETO' ? 'GERAL' : ''; }) + '</label>' +
    '<label class="w2">' + (txt ? nome + ' ' + txt : '&nbsp;') + escolha('df-v', d.valor, vals, function (v) { d.valor = v; }, { off: i < 0 }) + '</label></div></fieldset><div class="bts">' +
    bt('CALCULAR', function () { if (!d.valor) return msgbox('AVISO!', 'Preencha todos os campos para continuar.'); S.v.filtro[d.alvo] = { tipo: i, valor: d.valor }; S.v.aba = d.alvo.toUpperCase(); S.v.dlg = null; agendar(); }, '', !d.valor) + bt('CANCELAR', function () { S.v.dlg = null; agendar(); }, 'cz') + '</div>', 420);
}

/* ---------- Lista de erros ---------- */
function cmdErros() {
  var p = proj(), n = calc(p).res.erros.length;
  if (!n) return msgbox('AVISO!', 'Não foram encontrados erros.');
  S.v.aba = 'FIN'; S.v.nivel = 3; S.v.dlg = { tipo: 'erros', sel: '', novo: '' }; agendar();
}
function dlgErros(d) {
  var p = proj(), erros = calc(p).res.erros, t = S.base.tabelas, C = ctxDe(p), ed = podeEditar();
  var e = erros.filter(function (x) { return x.linha === d.sel; })[0], a = e && p.atividades.filter(function (x) { return x.id === e.ativ; })[0], l = a && a.linhas.filter(function (x) { return x.id === e.linha; })[0];
  var atual = !l ? '' : e.campo === 'd' ? l.d : e.campo === 'q' ? (l.q ? nf4.format(l.q) : '') : e.campo === 'rel' ? l.rel : e.campo === 'status' ? l.status : (l[e.campo] ? fiso(l[e.campo]) : '');
  var ctrl = '';
  if (l && ed) {
    var set = function (v) { d.novo = v; };
    if (e.campo === 'd') ctrl = escolha('de-n', d.novo, Object.keys({ 1: C.mao, 2: C.vem, 3: C.mat, 4: C.mat, 5: C.ind, 6: C.ser }[l.c]), set);
    else if (e.campo === 'rel') ctrl = escolha('de-n', d.novo, t.relacao[REL_CH[l.c]] || [], set);
    else if (e.campo === 'status') ctrl = escolha('de-n', d.novo, t.status[ST_CH[l.c]] || [], set);
    else if (e.campo === 'q') ctrl = campo('de-n', d.novo || 0, set, { t: 'num' });
    else ctrl = campo('de-n', d.novo, set, { t: 'date' });
  }
  var aplicar = function () {
    if (d.novo === '' || d.novo == null || d.novo === 0) return msgbox('AVISO!', 'Informe o novo valor no campo "Alterar para".');
    l[e.campo] = d.novo; salvarAtiv(p, a); d.sel = ''; d.novo = '';
    if (!calc(p).res.erros.length) { S.v.dlg = null; processar(); }
  };
  return janela('Lista de Erros', '<div class="lb"><table><tr><th>ITEM</th><th>ERRO</th><th>DESCRIÇÃO</th><th>SOLUÇÃO</th></tr>' + erros.map(function (x) {
    return '<tr class="' + (x.linha === d.sel ? 's' : '') + '" ' + h(function () { d.sel = x.linha; d.novo = ''; agendar(); }) + '><td>' + esc(x.item + '.' + x.c) + '</td><td>ERRO ' + ('0' + x.cod).slice(-2) + '</td><td class="w">' + esc(x.msg) + '<br>' + esc(x.d) + '</td><td class="w">' + esc(x.sol) + '</td></tr>';
  }).join('') + '</table></div><div>Total de erros pendentes de correção: <b>' + ('0' + erros.length).slice(-2) + '</b></div>' +
    '<fieldset><legend>Área de correção</legend><div class="fl"><label>Valor atual:<input type="text" disabled value="' + esc(l ? (atual === '' ? '*** CÉLULA VAZIA ***' : atual) : '') + '"></label><label>Alterar para:' + (ctrl || '<input type="text" disabled>') + '</label></div></fieldset>' +
    '<fieldset><legend>Informações</legend><div class="inf">1. Para realizar as correções necessárias, selecione um item da lista de erros que as opções disponíveis serão mostradas na Área de correção.<br>2. Os erros também podem ser corrigidos direto na guia COM: feche esta janela e edite a célula marcada em vermelho.<br>3. Após finalizar todas as correções, clique em "ATUALIZAR".</div></fieldset>' +
    '<div class="bts">' + (l && ed ? bt('ALTERAR', aplicar) : '') + bt('ATUALIZAR', function () { S.v.dlg = null; processar(); }, 'vd') + bt('CANCELAR', function () { S.v.dlg = null; agendar(); }, 'cz') + '</div>', 760);
}

/* ---------- Exportar dados ---------- */
function cmdExportar() {
  var p = proj(), n = calc(p).res.erros.length;
  if (n) return msgbox('ERRO!', 'Foram encontrados ( ' + ('0' + n).slice(-2) + ' ) erros.\n\nPara visualização dos erros encontrados clique no menu "CUSTO" e selecione a opção "LISTA DE ERROS".', 'crit');
  S.v.dlg = { tipo: 'exp', fmt: 'EXCEL (.XLSX)', delim: 'PONTO E VIRGULA', op: 1 }; agendar();
}
function tabelaCalculo(p) {
  var c = calc(p), els = E.ELEMENTOS.map(function (e) { return e[0]; });
  var cab = ['DESCRICAO', 'UNIDADE', 'QUANTIDADE', 'RELACAO', 'INICIO', 'TERMINO', 'OT', 'ID', 'INFORMACOES', 'STATUS', 'COMENTARIOS', 'ITEM1', 'ATIVIDADE', 'ITEM2', 'EQUIPE', 'ATIVIDADE.UNI', 'ATIVIDADE.QTD', 'EQUIPES', 'TRECHO', 'CC', 'ITEM3', 'CONCEITO', 'INDICE', 'REDUZIDO', 'MOBILIZACAO', 'DESMOBILIZACAO', 'MESES', 'SEQUENCIA', 'CALENDARIO', 'GRUPO', 'HH.HM', 'GHE.TIPO', 'GHE.ADP', 'EPI.TIPO', 'EPI.AD', 'TOTAL', 'DESCRICAO2', 'REAJUSTE'].concat(els, ['GERAL']);
  var ativ = {}, lin = {}; p.atividades.forEach(function (a) { ativ[a.id] = a; a.linhas.forEach(function (l) { lin[l.id] = l; }); });
  var adp = { ADM: 'ADIMISSIONAL', DEM: 'DEMISSIONAL', PER: 'PERIODICO', '': 0 };
  var L = c.res.rows.map(function (r) {
    var a = ativ[r.ativ], l = lin[r.linha];
    return [r.d, r.u, num(l.q), r.rel, fdate(r.ini), fdate(r.fim), p.ot || '', l.ident || '', l.info || '', l.status || '', l.obs || '', r.g, r.atividade, r.item2, r.equipe, a.uni, num(a.qtd), num(a.equipes), r.trecho, r.cc, r.item2 + '.' + (cvIdx(r.c) + 1), cvDe(r.c).nome, cvIdx(r.c) + 1, String(r.cc).split(' ')[0].replace(/\./g, ''),
      fdate(E.som(r.mob)), fdate(E.som(r.des)), r.meses, r.seq, fdate(E.som(r.mi)), r.grupoDb, r.hh, r.gheTipo || 0, adp[r.gheAdp], r.epiTipo || 0, adp[r.epiAd], r.total, r.d2, r.reaj].concat(els.map(function (k) { return r.el[k] || 0; }), [r.geral]);
  });
  return [cab].concat(L);
}
function tabelaFin(p) {
  var c = calc(p), months = c.res.months;
  var cab = ['ITEM', 'DESCRICAO', 'UNI.', 'QUANTIDADE', 'TOTAL EQUIPES', 'LOCAL / FRENTE', 'CENTRO DE CUSTO', 'INICIO', 'TERMINO', 'MESES / DIAS', 'DIAS NORMAIS', 'DIAS UTEIS'].concat(CV.map(function (C) { return C.nome; }), ['TOTAL', 'PERCEN.', 'MENSAL', 'DIARIO', 'VALOR UNITARIO MENSAL POR EQUIPE', 'VALOR TOTAL POR UNIDADE', 'HH', 'HM'], months.map(mmaa));
  return [cab].concat(c.fin.linhas.map(function (l) { return [l.item, l.nome, l.uni || '', l.qtd || 0, l.equipes || 0, l.trecho || '', l.cc || '', fdate(l.ini), fdate(l.fim), l.prazo, l.dias, l.uteis].concat(pcV(l.pc), [l.total, l.pct, l.mensal, l.diario, l.porEquipe || 0, l.porUnidade || 0, l.hh, l.hm], l.mes); }));
}
/* a gravação (write) devolve um pedido; baixar() aplica o leiaute do sistema antes de salvar o arquivo */
function xlPorta(X) { if (X.__porta) return X.__porta; var P = Object.create(X); P.write = function (wb, o) { if (o && o.bookType && o.bookType !== 'xlsx') return X.write(wb, o); return { __xlsx: wb }; }; P.writeFile = function (wb, nome) { baixar(nome, { __xlsx: wb }); }; X.__porta = P; return P; }
function carregaXlsx() {
  return new Promise(function (ok, erro) {
    if (window.XLSX) return ok(xlPorta(window.XLSX));
    var sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    sc.onload = function () { window.XLSX ? ok(xlPorta(window.XLSX)) : erro(new Error('biblioteca indisponível')); }; sc.onerror = function () { erro(new Error('não foi possível carregar o gerador de Excel')); };
    document.head.appendChild(sc);
  });
}
function dlgExp(d) {
  var p = proj(), txt = d.fmt === 'TEXTO (.TXT)';
  var exportar = function () {
    S.v.dlg = null;
    var nome = semAcento(p.nome).replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'projeto', calcT = tabelaCalculo(p);
    if (txt) {
      var dlm = { 'TABULACAO': '\t', 'VIRGULA': ',', 'PONTO E VIRGULA': ';' }[d.delim];
      baixar(nome + '-dados.txt', calcT.map(function (l) { return l.map(function (x) { return typeof x === 'number' ? String(x) : String(x).replace(/,/g, '.'); }).join(dlm); }).join('\r\n'));
    } else carregaXlsx().then(function (X) {
      var wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(calcT), 'CALCULO');
      if (d.op === 3) X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(tabelaFin(p)), 'FIN');
      baixar(nome + '-dados.xlsx', X.write(wb, { bookType: 'xlsx', type: 'array' }));
    }, function (e) { msgbox('ERRO!', e.message + '.\nTente o formato TEXTO (.TXT).', 'crit'); });
    agendar();
  };
  var rd = function (n, r) { return '<label style="display:flex;gap:6px;align-items:center"><input type="radio" name="dx" id="dx' + n + '"' + (d.op === n ? ' checked' : '') + ' ' + h(function () { d.op = n; agendar(); }) + '> ' + r + '</label>'; };
  return janela('Exportar Dados', '<div>Selecione um formato de arquivo conforme opções abaixo.</div><div class="fl"><label>Formato' + escolha('dx-f', d.fmt, ['EXCEL (.XLSX)', 'TEXTO (.TXT)'], function (v) { d.fmt = v || 'EXCEL (.XLSX)'; }) + '</label><label>Delimitador' + escolha('dx-d', txt ? d.delim : '', ['TABULACAO', 'VIRGULA', 'PONTO E VIRGULA'], function (v) { d.delim = v || 'PONTO E VIRGULA'; }, { off: !txt }) + '</label></div>' +
    '<fieldset><legend>Opção</legend>' + rd(1, 'Exportar dados sem atualizar planilha.') + rd(2, 'Atualizar planilha e depois exportar dados.') + (txt ? '' : rd(3, 'Exportar dados e o Cronograma Financeiro.')) + '</fieldset>' +
    '<div class="bts">' + bt('EXPORTAR', exportar) + bt('CANCELAR', function () { S.v.dlg = null; agendar(); }, 'cz') + '</div>', 460);
}

/* ================= início ================= */
window.__custo = { S: S, render: render, supExcel: supExcel, ccGerar: ccGerar, calc: calc, croCalc: croCalc, croCarregar: croCarregar, custoResumo: custoResumo, salvarMeta: salvarMeta, GRUPOS_ABAS: GRUPOS_ABAS, NOMES: NOMES, nivelAba: nivelAba, nivelProj: nivelProj, podeEditar: podeEditar, podeGravar: podeGravar, proj: proj, zipUm: zipUm, croXml: croXml, relRecursos: relRecursos, idrEfetivo: idrEfetivo, cpuDados: cpuDados, cpuCalc: cpuCalc, croRecriarCpus: croRecriarCpus, croCarregar: croCarregar, croGerarFin: croGerarFin, croDeFin: croDeFin, croCompletarLb: croCompletarLb, croDistribuir: croDistribuir, croRemoverChaves: croRemoverChaves, croRecriarCpus2: null, salvarBase: salvarBase, salvarMeta: salvarMeta, apagarAtiv: apagarAtiv, cpuChaves: cpuChaves, croCalc: croCalc, croResultado: croResultado, calc: calc, novoProjeto: novoProjeto, proj: proj, cfgFalta: cfgFalta, croGerarPadrao: croGerarPadrao, croLerXml: croLerXml, croGravarTudo: croGravarTudo, croParam: croParam, supCalc: supCalc };
temaAplica(); render();
carregar().then(function () {
  /* projetos antigos: passam a ter a própria lista de grupos de atividade */
  S.projetos.forEach(function (p) { if (tipoMigrar(p) && S.papel.dono) salvarMeta(p); });
  if (S.base.tabelas) S.projetos.forEach(function (p) { if (!p.grupos || !p.grupos.length) { p.grupos = S.base.tabelas.atividades.slice(); if (S.papel.dono) salvarMeta(p); } }); if (S.projetos.length === 1) { S.v.pid = S.projetos[0].id; S.v.aba = 'GRA'; } render(); });
/* ================= RDO – Relatório Diário de Obra =================
   Um relatório por dia de obra. Preenchido automaticamente:
   - cabeçalho (número, data, dia da semana, contrato, prazos) pelos dados do projeto;
   - mão de obra e equipamentos diretos = produção do dia na Planilha de avanço (PA) × composições (CPU) relacionadas às macroatividades;
   - mão de obra indireta e equipamentos de apoio = equipes de permanência do Cronograma financeiro no mês;
   - atividades executadas = lançamentos da PA no dia, agrupados pela EAP da planilha, com o % acumulado até o dia.
   Clima, ocorrências, comentários e ajustes de efetivo são digitados. "Emitir" congela o relatório. */
NOMES.RDO = 'RDO – Diário de obra'; PRECISA_PROJ.RDO = 1; ABAS.push(['RDO', '#5a4475']);
ICA.RDO = '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 3.5v2h6v-2"/><path d="M8.5 10.5h7M8.5 14h7M8.5 17.5h4"/>';
(function () { GRUPOS_ABAS.forEach(function (g) { if (g[0] === 'Planejamento' && g[1].indexOf('RDO') < 0) g[1].splice(g[1].indexOf('INP') + 1, 0, 'RDO'); }); })();
var RDO_SEM = ['Domingo', 'Segunda-Feira', 'Terça-Feira', 'Quarta-Feira', 'Quinta-Feira', 'Sexta-Feira', 'Sábado'];
var RDO_TEMPO = ['Claro', 'Parcialmente nublado', 'Nublado', 'Chuvoso', 'Garoa', 'Tempestade'];
var RDO_COND = ['Praticável', 'Impraticável'];
var KDIA = { k: function (d) { return Math.floor(d); }, ini: function (d) { return Math.floor(d); }, prox: function (x) { return x + 1; } };
function rdoRaiz(p) { return p._raiz + '/' + (p._orig || p.id) + '/rdo'; }
function rdoId(D) { var y = E.ymd(D); return 'd' + y[0] + ('0' + (y[1] + 1)).slice(-2) + ('0' + y[2]).slice(-2); }
function rdoHoje() { var n = new Date(); return Math.round(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / 864e5); }
function rdoCarregar(p) {
  if (p._rdo || p._rdoP) return;
  p._rdoP = db.collection(rdoRaiz(p)).get().then(function (snap) {
    var D = { cfg: {}, dias: {} };
    snap.docs.forEach(function (d) { var x = clone(d.data()); if (d.id === 'cfg') D.cfg = x; else D.dias[d.id] = x; });
    p._rdo = D; p._rdoP = null; agendar();
  }, function (e) { p._rdoP = null; p._rdoErr = (e && e.message) || String(e); agendar(); });
}
function rdoSalvar(p, id) { if (id === 'cfg') gravar(rdoRaiz(p) + '/cfg', p._rdo.cfg); else gravar(rdoRaiz(p) + '/' + id, p._rdo.dias[id]); }
/* configuração do cabeçalho: o que não for digitado vem do cadastro do projeto */
function rdoCfg(p) {
  var c = p._rdo.cfg, r = p.resp || {}, ct = p.contratante || {}, l = p.local || {}, cr = p.crono || {};
  /* nº do RDO conta a partir da LNTP ou da assinatura do contrato, o que vier primeiro */
  var ct0 = p.contrato || {}, okD = function (x) { x = String(x || '').slice(0, 10); return /^\d{4}-\d\d-\d\d$/.test(x) && +x.slice(0, 4) > 1990 ? x : ''; };
  var marcos = [okD(ct0.lntp), okD(ct0.assinatura)].filter(Boolean).sort();
  var ini = okD(c.ini) || marcos[0] || okD(r.inicio) || okD(ct0.inicio) || okD(cr.inicio), fim = okD(r.termino) || okD(ct0.termino) || okD(cr.fim);
  var prazo = num(c.prazo) || num(r.prazo) || (ini && fim ? E.day(fim) - E.day(ini) + 1 : 0);
  var end = [l.logradouro, l.municipio && (l.municipio + (l.uf ? ' - ' + l.uf : ''))].filter(Boolean).join(', ');
  var emp = S.base.empresa || {};
  return {
    ini: ini, n0: num(c.n0) || 1, prazo: prazo,
    obra: c.obra || l.nome || p.nome, endereco: c.endereco || end, contratante: c.contratante || ct.fantasia || ct.razao || r.cliente || '',
    contratada: c.contratada || emp.marca || emp.razao || '', responsavel: c.responsavel || r.engenheiro || r.responsavel || '',
    contrato: c.contrato || ct.contrato || '', aprov: c.aprov || [{}, {}, {}], base: c.base || 'PA', arred: c.arred || 'R'
  };
}
/* fração de [a, b) que cai no dia D, pelo tempo útil do calendário do projeto */
function rdoFracDia(a, b, D) {
  if (a == null) return 0; if (b == null || b <= a) return Math.floor(a) === D ? 1 : 0;
  var A = wt(a), B = wt(b); if (B <= A) return Math.floor(a) === D ? 1 : 0;
  var o = wt(Math.min(b, D + 1)) - wt(Math.max(a, D)); return o > 0 ? o / (B - A) : 0;
}
/* acumulado da PA até o dia D (inclusive) */
function rdoPctAte(p, R, RR, m, key, D) {
  var r = RR[key];
  if (r) { var ac = 0; r.dias.forEach(function (x) { if (x[0] <= D) ac += x[1]; }); var qp = num(m.q[key] != null ? m.q[key] : 100); return qp > 0 ? Math.max(0, Math.min(1, ac / qp)) : 0; }
  var t = R.by[key]; if (!t) return 0;
  var af = t.af ? dn(t.af) : null, as = t.as ? dn(t.as) : null;
  if (af != null && af < D + 1) return realDe(t) >= 100 ? 1 : realDe(t) / 100;
  if (as != null && as < D + 1) return Math.min(1, realDe(t) / 100);
  return 0;
}
/* conteúdo automático do dia */
function rdoAuto(p, D) {
  var ck = D + '|' + rdoCfg(p).base; if (p._rdoC && p._rdoC.k === ck && p._rdoC.cro === p._croCalc) return p._rdoC.v;
  var R = croCalc(p), C = p._cro, RR = inpReal(p), m = inpMeta(p), X = R.X, hm = X.hm || 220, dpm = num(p.crono.dpm) || 22, hd = hm / dpm, base = rdoCfg(p).base;
  var out = { mo: {}, eq: {}, at: [], util: wt(D + 1) - wt(D) > 1e-6, hd: hd };
  var put = function (L, grupo, nome, v, fonte) { var k = grupo + '|' + nome, o = L[k] || (L[k] = { g: grupo, n: nome, v: 0, f: fonte }); o.v += v; };
  /* produção do dia por tarefa folha */
  var dq = {}, fracLeaf = {};
  Object.keys(RR).forEach(function (u) { RR[u].dias.forEach(function (x) { if (x[0] === D) dq[u] = (dq[u] || 0) + x[1]; }); });
  if (base === 'PA') Object.keys(dq).forEach(function (u) { var qp = num(m.q[u] != null ? m.q[u] : 100); if (qp > 0) fracLeaf[u] = dq[u] / qp; });
  else R.leaves.forEach(function (t) { var f = rdoFracDia(dn(t.i), dn(t.f), D); if (f > 0) fracLeaf[t.u] = f; });
  /* recursos diretos: CPUs das macroatividades × fração executada no dia */
  Object.keys(C.cpus.links || {}).forEach(function (u) {
    var L = C.cpus.links[u] || [], mt = R.by[u]; if (!mt || !L.length) return;
    var lv = R.porMacro[u] && R.porMacro[u].length ? R.porMacro[u] : [mt], tb = lv.reduce(function (a, t) { return a + num(t.bc); }, 0), f = 0;
    lv.forEach(function (t) { var fl = fracLeaf[t.u]; if (fl) f += fl * (tb ? num(t.bc) / tb : 1 / lv.length); });
    if (!f) return;
    var add = function (c, mult, nv) {
      if (!c || nv > 20) return;
      cpuCalc(c, X).it.forEach(function (r) {
        var q = mult * num(r.k); if (!q) return;
        if (r.x.t === 'AUX') return add(X.by[r.x.i], q, nv + 1);
        if (r.x.t === 'MO') put(out.mo, 'MOD', r.nome, q * f / hd, 'CPU');
        else if (r.x.t === 'EQ') put(out.eq, 'Produção', r.nome, q * f / hd, 'CPU');
      });
    };
    L.forEach(function (l) { add(X.by[l.c], num(l.q), 0); });
  });
  /* indiretos: equipes de permanência do mês */
  try {
    var cc = calc(p), gera = {}, mi = miDe(D); p.atividades.forEach(function (a) { if (a.cro) gera[a.id] = 1; });
    cc.res.rows.forEach(function (r) {
      if (gera[r.ativ] || r.mi !== mi || !num(r.total)) return;
      if (r.c === 1) put(out.mo, 'MOI', r.d, num(r.total), 'Permanência');
      else if (r.c === 2) put(out.eq, 'Apoio', r.d, num(r.total), 'Permanência');
    });
  } catch (e) { console.error(e); }
  /* atividades executadas no dia (lançamentos da PA) */
  var PA = C.inp_eap && C.inp_eap.ord && C.inp_eap.ord.length ? C.inp_eap.ord : null, Xe = {}; m.extra.forEach(function (x) { Xe[x.x] = x; });
  var nomeDe = function (k) { return Xe[k] ? Xe[k].n : R.by[k] ? R.by[k].n : String(k); }, und = function (k) { return m.u[k] || (Xe[k] && Xe[k].u) || '%'; };
  var feitos = Object.keys(dq).filter(function (u) { return dq[u]; });
  if (PA) {
    var idx = {}, pai = [], pilha = []; PA.forEach(function (o, i) { idx[o[0]] = i; while (pilha.length && PA[pilha[pilha.length - 1]][2] >= o[2]) pilha.pop(); pai[i] = pilha.length ? pilha[pilha.length - 1] : -1; pilha.push(i); });
    var PW = function (o) { return o[3] ? o[4] : o[7]; }, temPW = PA.some(function (o) { return PW(o) != null; }), grupos = {};
    feitos.forEach(function (u) {
      var i = idx[u]; if (i == null) return; var j = pai[i] >= 0 ? pai[i] : i, g = j; while (pai[g] >= 0 && PA[g][2] > 2) g = pai[g];
      var G = grupos[j] || (grupos[j] = { i: j, gi: g, it: [] }); G.it.push({ i: i, n: nomeDe(u), id: PA[i][1], q: dq[u], u: und(u), pct: rdoPctAte(p, R, RR, m, u, D) });
    });
    Object.keys(grupos).map(function (j) { return grupos[j]; }).sort(function (a, b) { return a.i - b.i; }).forEach(function (G) {
      var o = PA[G.i], lv = o[2], w = 0, a = 0, n0 = 0, a0 = 0;
      if (G.it.length === 1 && G.it[0].i === G.i) { w = 1; a = G.it[0].pct; }
      else for (var k = G.i + 1; k < PA.length && PA[k][2] > lv; k++) { var x = PA[k]; if (!x[3]) continue; var pk = rdoPctAte(p, R, RR, m, x[0], D), pw = temPW ? num(PW(x)) : num((R.by[x[0]] || {}).bc); n0++; a0 += pk; if (!pw) continue; w += pw; a += pw * pk; }
      if (!w && n0) { w = n0; a = a0; }
      var go = PA[G.gi], nm = function (q) { return q[3] ? nomeDe(q[0]) : (q[4] || nomeDe(q[0])); };
      G.it.sort(function (a2, b2) { return a2.i - b2.i; });
      out.at.push({ g: G.gi !== G.i && go[2] <= 2 ? go[1] + ' - ' + nm(go) : '', c: /^N TEM/i.test(o[1]) ? '' : o[1], n: nm(o), pct: w ? a / w : 0, it: G.it.map(function (x) { return { id: x.id, n: x.n, q: x.q, u: x.u }; }) });
    });
  } else {
    var gr = {};
    feitos.forEach(function (u) {
      var t = R.by[u]; if (!t) return; var pt = R.by[t.p] || t, g = pt; while (R.by[g.p] && R.by[g.p].p != null && R.by[g.p].p >= 0) g = R.by[g.p];
      var G = gr[pt.u] || (gr[pt.u] = { t: pt, g: g, it: [] }); G.it.push({ id: t.w || '', n: t.n, q: dq[u], u: und(u) });
    });
    Object.keys(gr).forEach(function (k) {
      var G = gr[k], w = 0, a = 0; R.leaves.forEach(function (t) { for (var x = t; x; x = R.by[x.p]) { if (x === G.t) { var bw = num(t.bc) || 1; w += bw; a += bw * rdoPctAte(p, R, RR, m, t.u, D); break; } if (x.p == null || x.p < 0) break; } });
      out.at.push({ g: G.g !== G.t ? (G.g.w || '') + ' - ' + G.g.n : '', c: G.t.w || '', n: G.t.n, pct: w ? a / w : 0, it: G.it });
    });
  }
  p._rdoC = { k: ck, cro: p._croCalc, v: out };
  return out;
}
/* lista final de recursos do dia: automáticos + ajustes digitados, arredondados a inteiros */
function rdoRecursos(p, auto, doc, tipo, arred) {
  var ovr = (doc.ovr || {})[tipo] || {}, add = (doc.add || {})[tipo] || [], L = [], rnd = arred === 'C' ? Math.ceil : Math.round;
  Object.keys(auto[tipo]).forEach(function (k) { var o = auto[tipo][k], v = ovr[k] != null ? num(ovr[k]) : rnd(o.v - 1e-9); L.push({ k: k, g: o.g, n: o.n, v: v, calc: o.v, aj: ovr[k] != null }); });
  add.forEach(function (a, i) { L.push({ k: '+' + i, g: a.g || (tipo === 'mo' ? 'MOD' : 'Produção'), n: a.n, v: num(a.v), add: i }); });
  var ordem = tipo === 'mo' ? ['MOD', 'MOI'] : ['Produção', 'Apoio'];
  return L.sort(function (a, b) { return (ordem.indexOf(a.g) - ordem.indexOf(b.g)) || a.n.localeCompare(b.n, 'pt-BR'); });
}
function rdoCongelar(p, D) {
  var id = rdoId(D), doc = p._rdo.dias[id], cf = rdoCfg(p), auto = rdoAuto(p, D);
  doc.snap = {
    cab: { n: D - E.day(cf.ini) + cf.n0, obra: cf.obra, endereco: cf.endereco, contratante: cf.contratante, contratada: cf.contratada, responsavel: cf.responsavel, contrato: cf.contrato, prazo: cf.prazo, dec: D - E.day(cf.ini) + 1 },
    mo: rdoRecursos(p, auto, doc, 'mo', cf.arred).filter(function (x) { return x.v; }).map(function (x) { return [x.g, x.n, x.v]; }),
    eq: rdoRecursos(p, auto, doc, 'eq', cf.arred).filter(function (x) { return x.v; }).map(function (x) { return [x.g, x.n, x.v]; }),
    at: auto.at, aprov: cf.aprov.map(function (a) { return { n: a.n || '', e: a.e || '', f: a.f || '' }; })
  };
}
function shRdo(p) {
  var w = croPrecisa(p, 'RDO – RELATÓRIO DIÁRIO DE OBRA'); if (w) return w;
  if (p._rdoErr) return titulo('RDO – RELATÓRIO DIÁRIO DE OBRA') + '<div class="vazio">Não foi possível carregar os relatórios: ' + esc(p._rdoErr) + '</div>';
  if (!p._rdo) { rdoCarregar(p); return titulo('RDO – RELATÓRIO DIÁRIO DE OBRA') + '<div class="vazio">Carregando os relatórios diários…</div>'; }
  var V = S.v.rdo || (S.v.rdo = {}), ed = podeEditar(), cf = rdoCfg(p), D0 = cf.ini ? E.day(cf.ini) : null, hoje = rdoHoje();
  var Dfim = p.crono && p.crono.fim ? Math.floor(dn(p.crono.fim)) : hoje;
  if (V.d == null || V.p !== p.id) { V.p = p.id; V.d = Math.max(D0 || hoje, Math.min(hoje - 1, Dfim)); }
  var D = V.d, id = rdoId(D), doc = p._rdo.dias[id], emit = doc && doc.st === 'E';
  var garante = function () { if (!p._rdo.dias[id]) p._rdo.dias[id] = { data: isoDia(D), st: 'R', clima: { m: { t: 'Claro', c: 'Praticável' }, t: { t: 'Claro', c: 'Praticável' }, mm: '' } }; return p._rdo.dias[id]; };
  var sv = function () { rdoSalvar(p, id); };
  var dv = doc || { clima: { m: { t: 'Claro', c: 'Praticável' }, t: { t: 'Claro', c: 'Praticável' }, mm: '' } };
  var auto = emit ? null : rdoAuto(p, D), S0 = emit ? doc.snap : null;
  var cab = emit ? S0.cab : { n: D0 != null ? D - D0 + cf.n0 : '', obra: cf.obra, endereco: cf.endereco, contratante: cf.contratante, contratada: cf.contratada, responsavel: cf.responsavel, contrato: cf.contrato, prazo: cf.prazo, dec: D0 != null ? D - D0 + 1 : '' };
  var mo = emit ? S0.mo.map(function (x) { return { g: x[0], n: x[1], v: x[2] }; }) : rdoRecursos(p, auto, dv, 'mo', cf.arred);
  var eq = emit ? S0.eq.map(function (x) { return { g: x[0], n: x[1], v: x[2] }; }) : rdoRecursos(p, auto, dv, 'eq', cf.arred);
  var at = emit ? S0.at : auto.at, edd = ed && !emit;
  /* barra: data, navegação, status e ações */
  var go = function (d) { return h(function () { V.d = d; agendar(); }); };
  var chip = emit ? '<span class="rdo-st ok">Emitido ' + (doc.em ? fdate(E.day(doc.em.slice(0, 10))) : '') + '</span>' : doc ? '<span class="rdo-st rs">Rascunho</span>' : '<span class="rdo-st pd">Não emitido</span>';
  var s = titulo('RDO – RELATÓRIO DIÁRIO DE OBRA',
    '<span class="rdo-nav"><button class="lk" aria-label="Dia anterior" ' + go(D - 1) + '>‹</button><input type="date" aria-label="Data do relatório" value="' + isoDia(D) + '" ' + h(function (el) { if (el.value) { V.d = E.day(el.value); agendar(); } }) + '><button class="lk" aria-label="Próximo dia" ' + go(D + 1) + '>›</button><button class="lk" ' + go(Math.max(D0 || hoje, Math.min(hoje, Dfim))) + '>Hoje</button></span>' + chip +
    '<button class="bxl" data-tip="Baixa este RDO em Excel" ' + h(function () { rdoExcel(p, D, cab, mo, eq, at, dv); }) + '>' + XL_IC + 'Exportar Excel</button>');
  /* faixa do mês */
  var mi = miDe(D), d0 = E.som(mi), d1 = E.eom(mi), pend = 0, fx = '';
  for (var d = d0; d <= d1; d++) {
    var dc = p._rdo.dias[rdoId(d)], dentro = D0 != null && d >= D0 && d <= Dfim, st = dc && dc.st === 'E' ? 'ok' : dc ? 'rs' : dentro && d < hoje ? 'pd' : 'nd';
    if (st === 'pd') pend++;
    fx += '<button class="rdo-d ' + st + (d === D ? ' on' : '') + '" data-tip="' + fdate(d) + ' · ' + (st === 'ok' ? 'emitido' : st === 'rs' ? 'rascunho' : st === 'pd' ? 'não emitido' : 'fora do prazo / futuro') + '" ' + go(d) + '><i>' + RDO_SEM[((d + 4) % 7 + 7) % 7].slice(0, 3) + '</i>' + E.ymd(d)[2] + '</button>';
  }
  s += '<div class="gc rdo-mes"><div class="rdo-mh"><b>' + MESES_N[mi % 12] + '/' + Math.floor(mi / 12) + '</b><span class="vz">' + (pend ? int(pend) + (pend === 1 ? ' dia passado sem RDO emitido' : ' dias passados sem RDO emitido') : 'todos os dias passados do mês têm RDO emitido') + '</span>' +
    '<span class="rdo-lg"><i class="ok"></i>emitido <i class="rs"></i>rascunho <i class="pd"></i>não emitido</span>' +
    (ed ? '<button class="lk" ' + h(function () { V.cfg = !V.cfg; agendar(); }) + '>' + (V.cfg ? 'Fechar configuração' : 'Configurar cabeçalho') + '</button>' : '') + '</div><div class="rdo-fx">' + fx + '</div></div>';
  if (V.cfg && ed) s += rdoCfgForm(p, cf);
  if (D0 != null && (D < D0 || D > Dfim)) s += '<div class="nota" style="margin-top:12px">Data fora do prazo da obra (' + fdate(D0) + ' a ' + fdate(Dfim) + ').</div>';
  /* cabeçalho */
  var ce = function (rot, val, cls) { return '<tr><th>' + rot + '</th><td' + (cls ? ' class="' + cls + '"' : '') + '>' + val + '</td></tr>'; };
  var venc = cab.prazo && cab.dec !== '' ? cab.prazo - cab.dec : '';
  s += '<div class="gc rdo"><div class="rdo-cab"><div class="rdo-ti"><div class="rdo-emp">' + (function () { var lg = logosDe(p), it = function (u, txt, cls) { return u ? '<img class="rdo-lg2" src="' + u + '" alt="' + esc(txt) + '">' : txt ? '<' + cls + '>' + esc(txt) + '</' + cls + '>' : ''; }; return it(lg.contr, cab.contratante || '–', 'b') + it(lg.obra, '', 'span') + it(lg.exec, cab.contratada || '', 'span'); })() + '</div><h3>Relatório Diário de Obra (RDO)</h3>' +
    '<table class="rdo-kv">' + ce('Obra', esc(cab.obra)) + ce('Endereço', esc(cab.endereco || '–')) + ce('Contratada', esc(cab.contratada || '–')) + ce('Responsável', esc(cab.responsavel || '–')) + '</table></div>' +
    '<table class="rdo-kv rdo-num">' + ce('Relatório nº', cab.n === '' ? '–' : int(cab.n), 'big') + ce('Data', fdate(D)) + ce('Dia da semana', RDO_SEM[((D + 4) % 7 + 7) % 7]) + ce('Nº do contrato', esc(cab.contrato || 'Sem número')) +
    ce('Prazo contratual', cab.prazo ? int(cab.prazo) + ' dias' : '–') + ce('Prazo decorrido', cab.dec !== '' ? int(cab.dec) + ' dias' : '–') + ce('Prazo a vencer', venc !== '' ? int(venc) + ' dias' : '–', venc !== '' && venc < 0 ? 'ru' : '') + '</table></div>';
  /* clima */
  var cl = dv.clima || {}, opt = function (lst, v) { return lst.map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + o + '</option>'; }).join(''); };
  var turno = function (k, rot) {
    var t = cl[k] || {};
    return '<tr><th>' + rot + '</th><td>' + (edd ? '<select aria-label="Tempo ' + rot + '" ' + h(function (el) { var x = garante(); x.clima[k] = x.clima[k] || {}; x.clima[k].t = el.value; sv(); agendar(); }) + '>' + opt(RDO_TEMPO, t.t || 'Claro') + '</select>' : esc(t.t || '–')) + '</td>' +
      '<td>' + (edd ? '<select aria-label="Condição ' + rot + '" ' + h(function (el) { var x = garante(); x.clima[k] = x.clima[k] || {}; x.clima[k].c = el.value; sv(); agendar(); }) + '>' + opt(RDO_COND, t.c || 'Praticável') + '</select>' : '<span class="' + (t.c === 'Impraticável' ? 'ru' : '') + '">' + esc(t.c || '–') + '</span>') + '</td></tr>';
  };
  s += '<div class="rdo-cl"><table class="g rdo-tb"><thead><tr><th class="l">Clima</th><th class="l">Tempo</th><th class="l">Condição</th></tr></thead><tbody>' + turno('m', 'Manhã') + turno('t', 'Tarde') + '</tbody></table>' +
    '<table class="g rdo-tb rdo-mm"><thead><tr><th class="l">Índice pluviométrico</th></tr></thead><tbody><tr><td>' + (edd ? '<input type="number" min="0" step="0.1" aria-label="Chuva em mm" value="' + esc(cl.mm == null ? '' : cl.mm) + '" ' + h(function (el) { var x = garante(); x.clima.mm = el.value; sv(); }) + '> mm' : (cl.mm !== '' && cl.mm != null ? esc(String(cl.mm).replace('.', ',')) + ' mm' : '–')) + '</td></tr></tbody></table></div>' +
    (auto && !auto.util ? '<div class="nota">Dia não útil no calendário do projeto.</div>' : '');
  /* recursos */
  var grade = function (tipo, L, titulo2, grupos) {
    var tot = L.reduce(function (a, x) { return a + num(x.v); }, 0), r = '<div class="rdo-sec"><h4>' + titulo2 + ' (' + int(tot) + ')</h4>';
    grupos.forEach(function (g) {
      var G = L.filter(function (x) { return x.g === g[0]; }); if (!G.length && !edd) return;
      var sub = G.reduce(function (a, x) { return a + num(x.v); }, 0);
      r += '<div class="rdo-gr"><div class="rdo-cells">' + G.map(function (x) {
        var inp = edd ? '<input type="number" min="0" step="1" aria-label="' + esc(x.n) + '" value="' + num(x.v) + '" ' + h(function (el) {
          var y = garante(); if (x.add != null) { y.add[tipo][x.add].v = num(el.value); }
          else { y.ovr = y.ovr || {}; y.ovr[tipo] = y.ovr[tipo] || {}; if (el.value === '' || num(el.value) === Math.round(x.calc)) delete y.ovr[tipo][x.k]; else y.ovr[tipo][x.k] = num(el.value); }
          sv(); agendar();
        }) + '>' : '<b>' + int(x.v) + '</b>';
        return '<div class="rdo-c' + (x.aj ? ' aj' : '') + (num(x.v) ? '' : ' z') + '"' + (x.calc != null ? ' data-tip="Calculado: ' + nf2.format(x.calc) + (x.aj ? ' · ajustado à mão' : '') + '"' : '') + '><span>' + esc(x.n) + '</span>' + inp +
          (edd && x.add != null ? '<button class="rdo-x" aria-label="Remover" ' + h(function () { var y = garante(); y.add[tipo].splice(x.add, 1); sv(); agendar(); }) + '>×</button>' : '') + '</div>';
      }).join('') + (edd ? '<div class="rdo-c novo"><input type="text" placeholder="+ ' + (tipo === 'mo' ? 'função' : 'equipamento') + '" aria-label="Novo item" ' + h(function (el) { var n = el.value.trim(); if (!n) return; var y = garante(); y.add = y.add || {}; (y.add[tipo] = y.add[tipo] || []).push({ g: g[0], n: n.toUpperCase(), v: 1 }); sv(); agendar(); }) + '></div>' : '') +
        '</div><div class="rdo-gn">' + g[1] + '<b>(' + int(sub) + ')</b></div></div>';
    });
    return r + '</div>';
  };
  s += grade('mo', mo, 'Mão de obra', [['MOD', 'MOD – produção'], ['MOI', 'MOI – indireta']]) + grade('eq', eq, 'Equipamentos', [['Produção', 'Produção'], ['Apoio', 'Apoio / permanência']]);
  if (edd) s += '<div class="nota">Efetivo calculado: horas das composições (CPU) relacionadas às macroatividades × ' + (cf.base === 'PA' ? 'produção lançada no dia na Planilha de avanço' : 'parcela prevista para o dia no cronograma') + ' ÷ ' + nf2.format(auto.hd) + ' h/dia (' + int(p._cro && croCalc(p).X.hm || 220) + ' h/mês ÷ ' + int(num(p.crono.dpm) || 22) + ' dias), mais as equipes de permanência do mês (Cronograma financeiro). Digite a quantidade para ajustar; o valor calculado aparece ao passar o mouse.</div>';
  /* atividades */
  s += '<div class="rdo-sec"><h4>Atividades (' + int(at.length) + ')</h4>' + (at.length ? '<table class="g rdo-at"><tbody>' + at.map(function (a) {
    var pc = Math.round(a.pct * 100);
    return '<tr><td class="l">' + (a.g ? '<div class="rdo-ag">' + esc(a.g) + '</div>' : '') + '<div class="rdo-an">' + esc(a.c ? a.c + ' - ' : '') + esc(a.n) + '</div>' +
      a.it.map(function (x) { return '<div class="rdo-ai">' + esc(x.n) + ' <span>· ' + nf2.format(x.q) + ' ' + esc(x.u) + '</span></div>'; }).join('') + '</td><td class="rdo-ap">' + pc + '% ' + (pc >= 100 ? 'Concluída' : 'Em andamento') + '</td></tr>';
  }).join('') + '</tbody></table>' : '<div class="vz" style="padding:8px 2px">Nenhum lançamento na Planilha de avanço neste dia.</div>') + '</div>';
  /* ocorrências e comentários */
  var txt = function (k, rot) { return '<div class="rdo-sec"><h4>' + rot + '</h4>' + (edd ? '<textarea rows="3" aria-label="' + rot + '" ' + h(function (el) { var y = garante(); y[k] = el.value; sv(); }) + '>' + esc(dv[k] || '') + '</textarea>' : '<div class="rdo-tx">' + (dv[k] ? esc(dv[k]).replace(/\n/g, '<br>') : '<span class="vz">Nenhum.</span>') + '</div>') + '</div>'; };
  s += txt('oc', 'Ocorrências') + txt('com', 'Comentários');
  /* aprovações */
  var ap = emit ? S0.aprov : cf.aprov, apd = (doc && doc.ap) || [];
  s += '<div class="rdo-sec"><h4>Aprovações</h4><div class="rdo-apv">' + [0, 1, 2].map(function (i) {
    var a = ap[i] || {}, st = apd[i];
    return '<div class="rdo-ac"><b>' + (i + 1) + 'º APROVAÇÃO</b><span>' + esc(a.e || '') + '</span>' +
      (emit ? (st && st.ok ? '<span class="rdo-st ok">Aprovado ' + fdate(E.day(st.dt.slice(0, 10))) + ' ' + fhora(+st.dt.slice(11, 13), +st.dt.slice(14, 16)) + '</span>' : '<span class="rdo-st pd">Aguardando aprovação</span>') +
        (ed && a.n ? '<button class="lk" ' + h(function () { doc.ap = doc.ap || []; if (st && st.ok) doc.ap[i] = null; else { var n = new Date(); doc.ap[i] = { ok: true, dt: isoDia(rdoHoje()) + 'T' + ('0' + n.getHours()).slice(-2) + ':' + ('0' + n.getMinutes()).slice(-2) }; } sv(); agendar(); }) + '>' + (st && st.ok ? 'Desfazer' : 'Registrar aprovação') + '</button>' : '') : '<span class="vz">após a emissão</span>') +
      '<hr><b>' + esc(a.n || '—') + '</b><span>' + esc(a.f || '') + '</span></div>';
  }).join('') + '</div></div>';
  /* emissão */
  if (ed) s += '<div class="rdo-acoes">' + (emit ? '<span class="vz">Emitido em ' + fdate(E.day(doc.em.slice(0, 10))) + '. Para corrigir, reabra o relatório (as aprovações são apagadas).</span><button class="lk" ' + h(function () { confirma('Reabrir o RDO nº ' + int(cab.n) + ' de ' + fdate(D) + '?\n\nO conteúdo volta a ser calculado e as aprovações registradas são apagadas.', function () { doc.st = 'R'; delete doc.snap; delete doc.ap; delete doc.em; sv(); agendar(); }); }) + '>Reabrir</button>'
    : '<span class="vz">Confira o clima, o efetivo e as atividades. Ao emitir, o relatório fica congelado com os valores de hoje.</span><button class="bxl" style="background:var(--azul)" ' + h(function () { var y = garante(); rdoCongelar(p, D); y.st = 'E'; y.em = isoDia(rdoHoje()); sv(); agendar(); }) + '>Emitir RDO</button>') + '</div>';
  s += '</div>';
  return s;
}
function rdoCfgForm(p, cf) {
  var c = p._rdo.cfg, sv = function () { rdoSalvar(p, 'cfg'); p._rdoC = null; agendar(); };
  var f = function (rot, k, t, dica) { return '<label>' + rot + '<input type="' + (t || 'text') + '" value="' + esc(c[k] != null ? c[k] : '') + '" placeholder="' + esc(cf[k] != null ? String(cf[k]) : '') + '" ' + h(function (el) { if (el.value === '') delete c[k]; else c[k] = el.value; sv(); }) + '>' + (dica ? '<i>' + dica + '</i>' : '') + '</label>'; };
  var aprov = c.aprov || (cf.aprov.map(function () { return {}; }));
  return '<div class="gc rdo-cfg"><h3>Cabeçalho e aprovadores do RDO</h3><p class="vz">Campos vazios usam o cadastro do projeto (mostrado em cinza).</p><div class="rdo-cff">' +
    f('Obra', 'obra') + f('Endereço', 'endereco') + f('Contratante (cliente)', 'contratante') + f('Contratada', 'contratada') + f('Responsável', 'responsavel') + f('Nº do contrato', 'contrato') +
    f('Data do 1º relatório', 'ini', 'date', 'LNTP ou assinatura do contrato, o que vier primeiro') + f('Nº do 1º relatório', 'n0', 'number') + f('Prazo contratual (dias)', 'prazo', 'number') +
    '<label>Efetivo calculado por<select ' + h(function (el) { c.base = el.value; sv(); }) + '><option value="PA"' + (cf.base === 'PA' ? ' selected' : '') + '>Produção do dia (Planilha de avanço)</option><option value="CRO"' + (cf.base === 'CRO' ? ' selected' : '') + '>Previsto no cronograma</option></select></label>' +
    '<label>Arredondamento<select ' + h(function (el) { c.arred = el.value; sv(); }) + '><option value="R"' + (cf.arred === 'R' ? ' selected' : '') + '>Ao inteiro mais próximo</option><option value="C"' + (cf.arred === 'C' ? ' selected' : '') + '>Sempre para cima</option></select></label></div>' +
    '<h4>Aprovadores</h4><div class="rdo-cff">' + [0, 1, 2].map(function (i) {
      var a = aprov[i] || (aprov[i] = {}), g = function (rot, k) { return '<label>' + (i + 1) + 'º · ' + rot + '<input type="text" value="' + esc(a[k] || '') + '" ' + h(function (el) { a[k] = el.value; c.aprov = aprov; sv(); }) + '></label>'; };
      return g('nome', 'n') + g('e-mail', 'e') + g('cargo', 'f');
    }).join('') + '</div></div>';
}
function rdoExcel(p, D, cab, mo, eq, at, dv) {
  var cl = dv.clima || {}, a = [];
  a.push(['RELATÓRIO DIÁRIO DE OBRA (RDO)']); a.push(['Relatório nº', cab.n, 'Data', fdate(D), 'Dia da semana', RDO_SEM[((D + 4) % 7 + 7) % 7]]);
  a.push(['Obra', cab.obra]); a.push(['Endereço', cab.endereco]); a.push(['Contratante', cab.contratante]); a.push(['Contratada', cab.contratada]); a.push(['Responsável', cab.responsavel]); a.push(['Nº do contrato', cab.contrato || 'Sem número']);
  a.push(['Prazo contratual (dias)', cab.prazo, 'Decorrido', cab.dec, 'A vencer', cab.prazo && cab.dec !== '' ? cab.prazo - cab.dec : '']); a.push([]);
  a.push(['CLIMA', 'Tempo', 'Condição']); a.push(['Manhã', (cl.m || {}).t || '', (cl.m || {}).c || '']); a.push(['Tarde', (cl.t || {}).t || '', (cl.t || {}).c || '']); a.push(['Índice pluviométrico (mm)', cl.mm == null || cl.mm === '' ? '' : num(cl.mm)]); a.push([]);
  var rec = function (rot, L) { a.push([rot + ' (' + L.reduce(function (s, x) { return s + num(x.v); }, 0) + ')', 'Grupo', 'Quantidade']); L.filter(function (x) { return num(x.v); }).forEach(function (x) { a.push([x.n, x.g, num(x.v)]); }); a.push([]); };
  rec('MÃO DE OBRA', mo); rec('EQUIPAMENTOS', eq);
  a.push(['ATIVIDADES (' + at.length + ')', 'Executado no dia', 'Und', '% acumulado', 'Situação']);
  at.forEach(function (x) { if (x.g) a.push([x.g]); a.push([(x.c ? x.c + ' - ' : '') + x.n, '', '', Math.round(x.pct * 10000) / 10000, x.pct >= 0.995 ? 'Concluída' : 'Em andamento']); x.it.forEach(function (y) { a.push(['    ' + y.n, y.q, y.u]); }); });
  a.push([]); a.push(['OCORRÊNCIAS']); a.push([dv.oc || 'Nenhuma.']); a.push(['COMENTÁRIOS']); a.push([dv.com || 'Nenhum.']);
  relExcel(p, 'RDO ' + cab.n + ' ' + isoDia(D), a);
}
/* ================= CADASTRO DE CLIENTES e LOGOS (obra, executor, contratante) ================= */
NOMES.CLI = 'Cadastro de clientes'; ABAS.push(['CLI', '#1769e8']);
ICA.CLI = '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5"/><path d="M15.5 6.5h5M15.5 10h5M17.5 13.5h3"/>';
(function () { GRUPOS_ABAS.forEach(function (g) { if (g[0] === 'Projeto' && g[1].indexOf('CLI') < 0) g[1].unshift('CLI'); }); })();
var CLI_PAPEIS = ['CONTRATANTE', 'CONSTRUTOR / EXECUTOR', 'FISCALIZACAO / GERENCIADORA', 'PROJETISTA / CONSULTORIA'];
var CLI_CAMPOS = [['razao', 'Razão social', 1], ['fantasia', 'Nome fantasia'], ['cnpj', 'CNPJ'], ['logradouro', 'Logradouro', 1], ['numero', 'Número'], ['complemento', 'Complemento'], ['bairro', 'Bairro'], ['municipio', 'Município'], ['uf', 'UF'], ['cep', 'CEP']];
function cliNome(c) { return c ? (c.fantasia || c.razao || 'CLIENTE SEM NOME') : ''; }
function cliDe(id) { return (S.clientes || []).filter(function (c) { return c.id === id; })[0] || null; }
function cliObras(c) { return S.projetos.filter(function (p) { return p.clienteId === c.id; }); }
/* copia a identificação do cliente para a contratante dos projetos ligados a ele */
function cliCopia(c, p) { var ct = p.contratante || (p.contratante = {}); CLI_CAMPOS.forEach(function (f) { ct[f[0]] = c[f[0]] || ''; }); }
function cliSalvar(c) {
  var d = {}; Object.keys(c).forEach(function (k) { if (k !== 'id' && k.charAt(0) !== '_') d[k] = c[k]; });
  gravar('clientes/' + c.id, d);
  cliObras(c).forEach(function (p) { cliCopia(c, p); salvarMeta(p); });
}
/* logos usados no RDO, nos relatórios e nas exportações */
function logosDe(p) {
  var c = p && p.clienteId ? cliDe(p.clienteId) : null;
  return { obra: (p && p.logo) || '', exec: (S.base.empresa || {}).logo || '', contr: (c && c.logo) || (p && p.contratante && p.contratante.logo) || '' };
}
function lerLogo(file) {
  return new Promise(function (res, rej) {
    if (!file) return rej(new Error('Nenhum arquivo'));
    if (!/^image\//.test(file.type)) return rej(new Error('O arquivo não é uma imagem.'));
    var fr = new FileReader();
    fr.onerror = function () { rej(new Error('Não foi possível ler o arquivo.')); };
    fr.onload = function () {
      var img = new Image();
      img.onerror = function () { rej(new Error('Imagem inválida.')); };
      img.onload = function () {
        var w = img.naturalWidth || 480, hh = img.naturalHeight || 200, s = Math.min(1, 480 / w, 200 / hh), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(hh * s));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        var u = c.toDataURL('image/png');
        if (u.length > 170000) u = c.toDataURL('image/webp', 0.88);
        if (u.length > 170000 || u.indexOf('data:image/webp') !== 0 && u.length > 170000) u = c.toDataURL('image/jpeg', 0.85);
        res(u);
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
function logoCampo(rot, url, set, dica, edita) {
  var ed = edita == null ? podeEditar() : edita;
  return '<div class="logo-c"><span class="logo-r">' + rot + '</span><div class="logo-b">' + (url ? '<img src="' + url + '" alt="' + esc(rot) + '">' : '<i>Sem logo</i>') + '</div>' +
    (ed && set ? '<div class="logo-a"><label class="lk">' + (url ? 'Trocar imagem' : 'Inserir imagem') + '<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden ' + h(function (el) {
      var f = el.files && el.files[0]; el.value = '';
      lerLogo(f).then(function (u) { set(u); agendar(); }, function (e) { aviso(e.message || 'Não foi possível ler a imagem.'); });
    }) + '></label>' + (url ? '<button class="lk" ' + h(function () { set(''); agendar(); }) + '>Remover</button>' : '') + '</div>' : '') +
    (dica ? '<small>' + dica + '</small>' : '') + '</div>';
}
/* cartão de logos do projeto (Dados do projeto) */
function cfgLogos(p, svp) {
  var c = p.clienteId ? cliDe(p.clienteId) : null, em = S.base.empresa || (S.base.empresa = {});
  return cfgCard('Logos', 'Aparecem no cabeçalho do RDO, nos relatórios e nas exportações. Use PNG com fundo transparente; a imagem é reduzida para até 480 × 200 px.',
    '<div class="logo-g">' +
    logoCampo('Logo da obra / projeto', p.logo, function (u) { p.logo = u; svp(); }, 'Vale só para este projeto.') +
    logoCampo('Logo do executor', em.logo, function (u) { em.logo = u; salvarBase('empresa'); }, 'Empresa executora: o mesmo logo para todos os projetos.') +
    (c ? logoCampo('Logo da contratante', c.logo, function (u) { c.logo = u; cliSalvar(c); }, 'Do cadastro do cliente ' + esc(cliNome(c)) + ' (vale para todas as obras dele).')
      : logoCampo('Logo da contratante', (p.contratante || {}).logo, function (u) { (p.contratante || (p.contratante = {})).logo = u; svp(); }, 'Ligue o projeto a um cliente do Cadastro de clientes para usar o logo dele em todas as obras.')) +
    '</div>');
}
/* seleção do cliente cadastrado no cartão Contratante */
function cfgCliSel(p, svp) {
  var L = (S.clientes || []).slice().sort(function (a, b) { return ordAlfa(cliNome(a), cliNome(b)); });
  var rot = {}; L.forEach(function (c) { rot[c.id] = cliNome(c) + (c.cnpj ? ' · ' + c.cnpj : ''); });
  return '<div class="cf" style="margin-bottom:12px">' + cfgCampo('ct-cli', 'Cliente cadastrado', p.clienteId || '', function (x) {
    p.clienteId = x || null; var c = cliDe(x); if (c) cliCopia(c, p); svp(); agendar();
  }, { ops: [''].concat(L.map(function (c) { return c.id; })), rotulos: Object.assign({ '': L.length ? '— escolha um cliente —' : '— nenhum cliente cadastrado —' }, rot), w2: true,
    dica: p.clienteId ? 'Identificação e endereço vêm do Cadastro de clientes; altere por lá.' : 'Escolha um cliente para preencher os dados abaixo. Cadastre novos em Sistema › Cadastro de clientes e empresas.' }) + '</div>';
}
function shCli() {
  var V = S.v.cli || (S.v.cli = {}), ed = podeEditar(), L = (S.clientes || []).slice().sort(function (a, b) { return ordAlfa(cliNome(a), cliNome(b)); });
  var novo = function () { var c = { id: uid(), razao: '', fantasia: '', cnpj: '', criado: new Date().toISOString().slice(0, 10) }; S.clientes.push(c); cliSalvar(c); V.sel = c.id; agendar(); };
  var s = titulo('CADASTRO DE CLIENTES E EMPRESAS', (ed ? '<button class="bxl" style="background:var(--azul)" ' + h(novo) + '>+ Novo cliente</button>' : '') +
    '<input type="search" placeholder="Buscar cliente ou CNPJ" aria-label="Buscar cliente" value="' + esc(V.bl || '') + '" data-live ' + h(function (el) { V.bl = el.value; agendar(); }) + '>');
  var bl = semAcento(V.bl || ''), F = L.filter(function (c) { return !bl || semAcento(cliNome(c) + ' ' + (c.razao || '') + ' ' + (c.cnpj || '')).indexOf(bl) >= 0; });
  if (!L.length) return s + '<div class="vazio"><h3>Nenhum cliente cadastrado</h3><p>Cadastre os clientes (contratantes) com os dados do cartão CNPJ e o logo. Depois, crie as obras de cada um a partir do cadastro, ou ligue um projeto existente em Dados do projeto › Contratante.</p>' + (ed ? '<button class="bt" ' + h(novo) + '>Cadastrar o primeiro cliente</button>' : '') + '</div>';
  if (!V.sel || !cliDe(V.sel)) V.sel = (F[0] || L[0]).id;
  s += '<div class="cli"><div class="cli-l">' + F.map(function (c) {
    var n = cliObras(c).length;
    return '<button class="cli-i' + (c.id === V.sel ? ' on' : '') + '" ' + h(function () { V.sel = c.id; agendar(); }) + '><span class="cli-lg">' + (c.logo ? '<img src="' + c.logo + '" alt="">' : '<i>' + esc(cliNome(c).slice(0, 2)) + '</i>') + '</span><span class="cli-t"><b>' + esc(cliNome(c)) + '</b><small>' + (c.papel ? esc(c.papel.split(' / ')[0]) + ' · ' : '') + esc(c.cnpj || 'sem CNPJ') + (c.municipio ? ' · ' + esc(c.municipio) + (c.uf ? '/' + esc(c.uf) : '') : '') + '</small></span><em>' + n + (n === 1 ? ' obra' : ' obras') + '</em></button>';
  }).join('') + (F.length ? '' : '<div class="vz" style="padding:10px">Nenhum cliente encontrado.</div>') + '</div>';
  var c = cliDe(V.sel), sv = function () { cliSalvar(c); };
  var cp = function (f) { return cfgCampo('cl-' + f[0], f[1], c[f[0]], function (x) { c[f[0]] = x; sv(); }, f[0] === 'uf' ? { ops: [''].concat(UFS) } : { upper: true, w2: !!f[2] }); };
  var cx = function (k, rot, w2) { return cfgCampo('cl-' + k, rot, c[k], function (x) { c[k] = x; sv(); }, { w2: w2 }); };
  var obras = cliObras(c);
  s += '<div class="cli-r">' +
    cfgCard(esc(cliNome(c)), 'Dados do cartão CNPJ. As alterações valem para todas as obras deste cliente.',
      '<div class="cli-top">' + logoCampo('Logo da contratante', c.logo, function (u) { c.logo = u; sv(); }, 'PNG com fundo transparente, de preferência.') +
      '<div class="cf">' + cp(CLI_CAMPOS[0]) + cp(CLI_CAMPOS[1]) + cp(CLI_CAMPOS[2]) + cfgCampo('cl-papel', 'Papel nas obras', c.papel || '', function (x) { c.papel = x; sv(); }, { ops: [''].concat(CLI_PAPEIS) }) + '</div></div>') +
    cfgCard('Endereço', '', '<div class="cf">' + CLI_CAMPOS.slice(3).map(cp).join('') + '</div>') +
    cfgCard('Contato', '', '<div class="cf">' + cx('contato', 'Responsável') + cx('cargo', 'Cargo') + cx('email', 'E-mail') + cx('tel', 'Telefone') + cx('obs', 'Observações', true) + '</div>') +
    cfgCard('Obras deste cliente', obras.length ? 'Clique para abrir o projeto.' : 'Nenhuma obra ligada a este cliente ainda.',
      (obras.length ? '<div class="cli-ob">' + obras.map(function (p) {
        return '<button class="lk" ' + h(function () { S.v.pid = p.id; S.v.aba = 'CONFIG'; S.v.cfg = 'proj'; agendar(); }) + '>' + esc(p.nome) + (p.liberado ? '' : ' · rascunho') + '</button>';
      }).join('') + '</div>' : '') +
      (ed ? '<div class="cli-ac"><button class="bt" ' + h(function () {
        novoProjeto(); var p = proj(); p.clienteId = c.id; cliCopia(c, p); if (c.fantasia || c.razao) p.nome = ('NOVA OBRA ' + cliNome(c)).slice(0, 120); salvarMeta(p); agendar();
      }) + '>+ Criar obra para este cliente</button>' +
      (obras.length ? '' : '<button class="lk pg" ' + h(function () { confirma('Excluir o cliente ' + cliNome(c) + '?\n\nEsta ação não pode ser desfeita.', function () { S.clientes = S.clientes.filter(function (x) { return x !== c; }); gravar('clientes/' + c.id, null); V.sel = null; agendar(); }); }) + '>Excluir cliente</button>') + '</div>' : '')) +
    '</div></div>';
  return s;
}
/* ================= QUADRO DE SALDOS, INDIRETO e GESTÃO DE RISCOS ================= */
NOMES.QDS = 'Quadro de saldos'; NOMES.IDR = 'Indireto'; NOMES.RSK = 'Gestão de riscos';
PRECISA_PROJ.QDS = 1; PRECISA_PROJ.IDR = 1; PRECISA_PROJ.RSK = 1;
ABAS.push(['QDS', '#005a9c'], ['IDR', '#005a9c'], ['RSK', '#005a9c']);
ICA.QDS = '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17"/>';
ICA.IDR = '<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/><path d="M4 20h16"/>';
ICA.RSK = '<path d="M12 3.5 21 19.5H3z"/><path d="M12 10v4.5M12 17v.2"/>';
(function () {
  GRUPOS_ABAS.forEach(function (g) {
    var i = g[1].indexOf('HISP'); if (g[0] === 'Planejamento' && i >= 0) g[1].splice(i, 1);
    if (g[0] === 'Relatórios' && g[1].indexOf('HISP') < 0) g[1].push('HISP');
    if (g[0] === 'Planejamento') { var j = g[1].indexOf('LOB'); if (g[1].indexOf('QDS') < 0) g[1].splice(j >= 0 ? j + 1 : g[1].length, 0, 'QDS'); ['IDR', 'RSK'].forEach(function (k) { if (g[1].indexOf(k) < 0) g[1].push(k); }); }
  });
})();
function codObra(p) { return (p && (p.sigla || (p.crono && p._cro && p._cro.param && p._cro.param.sigla))) || ''; }

/* ---------- QUADRO DE SALDOS (Lean): atividades × áreas ---------- */
function shQds(p) {
  var w = croPrecisa(p, 'QUADRO DE SALDOS'); if (w) return w;
  var V = S.v.qds || (S.v.qds = { nv: 'SC', g: '' }), R = croCalc(p);
  var st = function (pc) { return pc >= 99.95 ? 'ok' : pc > 0.0001 ? 'an' : 'ni'; };
  var linhas = [], locs = {};
  Object.keys(R.porMacro).forEach(function (u) {
    var m = {}; R.porMacro[u].forEach(function (t) { var k = V.nv === 'SP' ? t.sp : t.sc; if (k) (m[k] = m[k] || []).push(t); });
    var ks = Object.keys(m); if (ks.length < 2) return;
    var cel = {}; ks.forEach(function (k) {
      var G = m[k], bc = G.reduce(function (a, t) { return a + num(t.bc); }, 0);
      var pc = bc ? G.reduce(function (a, t) { return a + num(t.bc) * realDe(t); }, 0) / bc : G.reduce(function (a, t) { return a + realDe(t); }, 0) / G.length;
      cel[k] = pc; locs[k] = 1;
    });
    var mt = R.by[u], g = mt; while (R.by[g.p] && R.by[g.p].l >= 2) g = R.by[g.p];
    linhas.push({ t: mt, g: g, cel: cel });
  });
  var s = titulo('QUADRO DE SALDOS', croStatusCampo(p, R));
  if (!linhas.length) return s + '<div class="vazio"><h3>Sem atividades por área</h3>O quadro usa o Sub-Parque e o Sub-Campo das tarefas do cronograma (MS Project).</div>';
  var grupos = []; linhas.forEach(function (l) { if (grupos.indexOf(l.g) < 0) grupos.push(l.g); }); grupos.sort(function (a, b) { return cpuOrd(a.w, b.w); });
  var L = linhas.filter(function (l) { return !V.g || l.g.u === +V.g; }).sort(function (a, b) { return cpuOrd(a.t.w, b.t.w); });
  var LS = Object.keys(locs).filter(function (k) { return L.some(function (l) { return l.cel[k] != null; }); }).sort(function (a, b) { return (parseInt(a.replace(/\D+/g, ''), 10) || 0) - (parseInt(b.replace(/\D+/g, ''), 10) || 0) || cpuOrd(a, b); });
  var tot = { ok: 0, an: 0, ni: 0 }; L.forEach(function (l) { LS.forEach(function (k) { if (l.cel[k] != null) tot[st(l.cel[k])]++; }); });
  var n = tot.ok + tot.an + tot.ni || 1;
  s += '<div class="cpu-lb"><select aria-label="Grupo da EAP" ' + h(function (el) { V.g = el.value; agendar(); }) + '><option value="">Todas as atividades</option>' + grupos.map(function (g) { return '<option value="' + g.u + '"' + (String(g.u) === String(V.g) ? ' selected' : '') + '>' + esc(g.w + ' ' + g.n) + '</option>'; }).join('') + '</select>' +
    '<select aria-label="Área" ' + h(function (el) { V.nv = el.value; agendar(); }) + '><option value="SC"' + (V.nv !== 'SP' ? ' selected' : '') + '>Áreas: Sub-Campos</option><option value="SP"' + (V.nv === 'SP' ? ' selected' : '') + '>Áreas: Sub-Parques</option></select>' +
    '<button class="bxl" ' + h(function () {
      var aoa = [['Atividade'].concat(LS)]; L.forEach(function (l) { aoa.push([l.t.w + ' ' + l.t.n].concat(LS.map(function (k) { var v = l.cel[k]; return v == null ? '' : Math.round(v * 10) / 1000; }))); });
      aoa.push([]); aoa.push(['Legenda: 1 = concluído (verde); entre 0 e 1 = em andamento (amarelo); 0 = não iniciado (laranja); vazio = não se aplica']); relExcel(p, 'Quadro de saldos', aoa);
    }) + '>' + XL_IC + 'Exportar Excel</button></div>';
  s += '<div class="gk qds-k"><div class="kt"><span>Concluído</span><b class="qds-c ok">' + pct(tot.ok / n) + '</b><i>' + int(tot.ok) + ' frentes</i></div><div class="kt"><span>Em andamento</span><b class="qds-c an">' + pct(tot.an / n) + '</b><i>' + int(tot.an) + ' frentes</i></div><div class="kt"><span>Não iniciado</span><b class="qds-c ni">' + pct(tot.ni / n) + '</b><i>' + int(tot.ni) + ' frentes</i></div><div class="kt"><span>Quadro</span><b>' + int(L.length) + ' × ' + int(LS.length) + '</b><i>atividades × áreas</i></div></div>';
  s += '<div class="qds-lg"><span><i class="ok"></i>Concluído</span><span><i class="an"></i>Em andamento</span><span><i class="ni"></i>Não iniciado</span><span><i class="na"></i>Não se aplica</span></div>';
  s += '<div class="tw qds-w"><table class="qds"><thead><tr><th class="qds-a">ATIVIDADE</th><th class="qds-p">%</th>' + LS.map(function (k) { return '<th class="qds-h"><span>' + esc(k) + '</span></th>'; }).join('') + '</tr></thead><tbody>';
  var gAnt = null;
  L.forEach(function (l) {
    if (!V.g && l.g !== gAnt) { gAnt = l.g; s += '<tr class="qds-g"><td class="qds-a" colspan="2">' + esc(l.g.w + ' ' + l.g.n) + '</td><td colspan="' + LS.length + '"></td></tr>'; }
    var vs = LS.filter(function (k) { return l.cel[k] != null; }), med = vs.length ? vs.reduce(function (a, k) { return a + l.cel[k]; }, 0) / vs.length : 0;
    s += '<tr><td class="qds-a" title="' + esc(l.t.w + ' ' + l.t.n) + '">' + esc(l.t.w + ' ' + l.t.n) + '</td><td class="qds-p">' + Math.round(med) + '%</td>' + LS.map(function (k) {
      var v = l.cel[k]; if (v == null) return '<td class="na"></td>';
      return '<td class="' + st(v) + '" data-tip="' + esc(l.t.n) + '\n' + esc(k) + ': ' + nf2.format(v) + '%">' + (v > 0.0001 && v < 99.95 ? Math.round(v) : '') + '</td>';
    }).join('') + '</tr>';
  });
  s += '<tr class="qds-t"><td class="qds-a">CONCLUÍDO POR ÁREA</td><td></td>' + LS.map(function (k) { var c = 0, m = 0; L.forEach(function (l) { if (l.cel[k] != null) { m++; if (l.cel[k] >= 99.95) c++; } }); return '<td>' + (m ? Math.round(100 * c / m) : '') + '</td>'; }).join('') + '</tr>';
  return s + '</tbody></table></div><div class="nota">Cada célula é o avanço real da atividade naquela área (cronograma atualizado pela Planilha de avanço). Verde: concluído · amarelo: em andamento (o número é o %) · laranja: não iniciado. A última linha mostra o % de atividades concluídas em cada área.</div>';
}

/* ---------- INDIRETO: centros de custo indiretos por permanência ---------- */
var IDR_CC = ['GERÊNCIA DE CONTRATO', 'GERÊNCIA DE PLANEJAMENTO E SALA TÉCNICA', 'GERÊNCIA DE SEGURANÇA DO TRABALHO', 'GERÊNCIA DE QUALIDADE', 'ADMINISTRAÇÃO, SUPRIMENTOS E CANTEIRO', 'ENGENHARIA E PROJETOS'];
var IDR_CAT = [
  ['MOI', 'Mão de obra indireta', 1, '', 'PROPRIO'], ['VL', 'Veículos leves', 2, 'CAMINHONETE|VEICULO LEVE|AUTOMOVEL|PICAPE|CAMIONETA', 'LOCADO'],
  ['VA', 'Veículos de apoio', 2, 'CAMINHAO|MUNCK|PIPA|COMBOIO', 'LOCADO'], ['ON', 'Ônibus e vans', 2, 'ONIBUS|VAN|MICRO', 'LOCADO'],
  ['AL', 'Alojamentos', 5, 'ALOJAMENTO|ALUGUEL|CASA|HOSPEDAGEM|HOTEL', 'LOCACAO IMOVEL'],
  ['EX', 'Material de expediente e escritório', 5, 'EXPEDIENTE|ESCRITORIO|PAPEL|TONER|CARTUCHO|IMPRESS', 'MATERIAL CONSUMO'], ['AM', 'Reposição de almoxarifado', 3, '', 'OUTROS'],
  ['TI', 'Licenças e TI', 5, 'LICENCA|SOFTWARE|COMPUTADOR|NOTEBOOK|MICROCOMPUTADOR|IMPRESSORA', 'OUTROS'],
  ['CO', 'Consultorias técnicas', 6, 'CONSULTORIA|ASSESSORIA|AUDITORIA', ''], ['EN', 'Engenharia / projetistas', 6, 'PROJETO|PROJETISTA|ENGENHARIA|TOPOGRAF|SONDAGEM', '']
];
function idrAtivs(p) { return p.atividades.filter(function (a) { return a.ind; }).sort(function (a, b) { return num(a.ordem) - num(b.ordem); }); }
function idrPeriodo(p) {
  var c = p.contrato || {}, ini = c.inicio, fim = c.termino;
  if ((!ini || !fim) && p.crono) { ini = ini || String(p.crono.inicio || '').slice(0, 10); fim = fim || String(p.crono.fim || '').slice(0, 10); }
  if (!ini || !fim) { var h0 = new Date().toISOString().slice(0, 10); ini = ini || h0; fim = fim || h0; }
  return [ini, fim];
}
function idrGrupo(p) {
  var i = p.grupos.findIndex(function (g) { return semAcento(g) === 'INDIRETOS'; });
  if (i < 0) { p.grupos.push('INDIRETOS'); salvarMeta(p); i = p.grupos.length - 1; }
  return i + 1;
}
function idrNovoCC(p, nome) {
  var g = idrGrupo(p), L = idrAtivs(p), n = L.length + 1, cod = codObra(p);
  var a = { id: uid(), grupo: g, ordem: n, ind: 1, nome: semAcento(nome).toUpperCase(), uni: 'VB', qtd: 1, equipes: 1, trecho: 'N/A', cc: (cod ? cod + '-' : '') + 'IND-' + ('0' + n).slice(-2) + ' - ' + semAcento(nome).toUpperCase(), linhas: [] };
  p.atividades.push(a); salvarAtiv(p, a); return a;
}
function custoResumo(p) {
  var c = calc(p), dir = 0, ind = 0, porA = {};
  c.fin.linhas.forEach(function (l) { if (l.tipo === 'a') porA[l.id] = l.total; });
  p.atividades.forEach(function (a) { var v = num(porA[a.id]); if (a.ind) ind += v; else dir += v; });
  var rk = rskResumo(p), bdi = bdiCalc(p.bdi), sub = dir + ind + rk.reserva;
  return { c: c, porA: porA, dir: dir, ind: ind, risco: rk.reserva, sub: sub, bdi: bdi, venda: sub * (1 + bdi), bdiR: num((p.bdi || {}).r) };
}
function resumoCustoHtml(p, X) {
  return '<div class="gk idr-k"><div class="kt"><span>Custo direto</span><b>' + money(X.dir) + '</b><i>composições (CPU × cronograma)</i></div><div class="kt"><span>Custo indireto</span><b>' + money(X.ind) + '</b><i>permanências desta guia</i></div>' +
    '<div class="kt"><span>Reserva de riscos</span><b>' + money(X.risco) + '</b><i>riscos em aberto (Gestão de riscos)</i></div><div class="kt"><span>BDI</span><b>' + pct(X.bdi) + '</b><i>' + money(X.venda - X.sub) + '</i></div>' +
    '<div class="kt hero"><span>Preço total do projeto</span><b>' + money(X.venda) + '</b><i>(direto + indireto + riscos) × (1 + BDI)</i></div></div>' +
    (X.bdiR && X.risco ? '<div class="nota">O BDI deste projeto já tem ' + pct(X.bdiR) + ' de riscos. Com a reserva da Gestão de riscos, avalie zerar esse item no BDI para não contar o risco duas vezes.</div>' : '');
}
function shIdr(p) {
  if (podeEditar()) { if (p.crono && !p._cro) croCarregar(p); try { idrSync(p); } catch (e) { console.error(e); } }
  var V = S.v.idr || (S.v.idr = { cat: 'MOI', bl: '' }), ed = podeEditar(), ctx = ctxDe(p), A = idrAtivs(p), X = custoResumo(p), c = X.c;
  var porL = {}; c.res.rows.forEach(function (r) { porL[r.linha] = (porL[r.linha] || 0) + r.geral; });
  var s = titulo('INDIRETO – CUSTOS INDIRETOS DO PROJETO', ed ? '<button class="bxl" style="background:var(--azul)" ' + h(function () {
    var nome = (V.novo || '').trim(); if (nome.length < 5) return aviso('Digite o nome do centro de custo indireto (ex.: GERÊNCIA DE CONTRATO).');
    if (A.some(function (a) { return semAcento(a.nome) === semAcento(nome).toUpperCase(); })) return aviso('Já existe esse centro de custo.');
    var a = idrNovoCC(p, nome); V.novo = ''; V.at = a.id; agendar();
  }) + '>+ Centro de custo</button><input type="text" placeholder="Novo centro de custo indireto" aria-label="Novo centro de custo" value="' + esc(V.novo || '') + '" ' + h(function (el) { V.novo = el.value; }) + '>' : '');
  s += resumoCustoHtml(p, X);
  if (!A.length) return s + '<div class="vazio"><h3>Nenhum centro de custo indireto</h3><p>O indireto é dimensionado por permanência: cada centro de custo (gerência) recebe a mão de obra indireta, veículos, alojamentos (com água, luz, internet e mobiliário), materiais, licenças e TI, consultorias e projetistas, com quantidade e período. Os itens vêm dos bancos de dados.</p>' +
    (ed ? '<button class="bt" ' + h(function () { IDR_CC.forEach(function (n) { idrNovoCC(p, n); }); agendar(); }) + '>Criar estrutura padrão (' + IDR_CC.length + ' centros de custo)</button>' : '') + '</div>';
  if (!V.at || !A.some(function (a) { return a.id === V.at; })) V.at = A[0].id;
  var at = A.filter(function (a) { return a.id === V.at; })[0], cat = IDR_CAT.filter(function (x) { return x[0] === V.cat; })[0] || IDR_CAT[0], per = idrPeriodo(p);
  /* centros de custo */
  s += '<div class="idr"><div class="idr-l"><h4>Centros de custo indiretos</h4>' + A.map(function (a) {
    return '<button class="idr-cc' + (a.id === V.at ? ' on' : '') + '" ' + h(function () { V.at = a.id; agendar(); }) + '><b>' + esc(a.nome) + '</b><small>' + esc(a.cc || '') + '</small><em>' + money(num(X.porA[a.id])) + '</em></button>';
  }).join('') + '<div class="idr-tt"><span>Total indireto</span><b>' + money(X.ind) + '</b><small>' + (X.dir + X.ind ? pct(X.ind / (X.dir + X.ind)) + ' do custo' : '') + '</small></div></div>';
  /* recursos do centro selecionado */
  var bank = { 1: ctx.mao, 2: ctx.vem, 3: ctx.mat, 5: ctx.ind, 6: ctx.ser }[cat[2]] || {}, rx = cat[3] ? new RegExp(cat[3]) : null, bl = semAcento(V.bl || '');
  var hits = Object.keys(bank).filter(function (d) { var D = semAcento(d); return (!bl || D.indexOf(bl) >= 0) && (bl || !rx || rx.test(D)); }).sort(ordAlfa).slice(0, 40);
  var REL = (S.base.tabelas.relacao || {})[{ 1: 'MAO', 2: 'VEM', 3: 'MAT', 5: 'IND' }[cat[2]]] || [];
  var add = function (d) { return h(function () { var r = cat[4] && (REL.indexOf(cat[4]) >= 0 || cat[2] === 6) ? cat[4] : (REL[0] || ''); at.linhas.push({ id: uid(), c: cat[2], d: d, q: 1, rel: cat[2] === 6 ? '' : r, ini: per[0], fim: per[1], ident: cat[1], info: '', status: '', obs: '' }); salvarAtiv(p, at); agendar(); }); };
  s += '<div class="idr-r"><div class="gc"><h3>' + esc(at.nome) + '</h3><p class="gq">Centro de custo: ' + esc(at.cc || '') + ' · Período padrão: ' + fdate(E.day(per[0])) + ' a ' + fdate(E.day(per[1])) + ' (contrato).</p>' +
    (ed ? '<div class="idr-add"><div class="chips">' + IDR_CAT.map(function (x) { return '<button class="' + (x[0] === cat[0] ? 'on' : '') + '" ' + h(function () { V.cat = x[0]; V.bl = ''; agendar(); }) + '>' + x[1] + '</button>'; }).join('') + '</div>' +
      (cat[0] === 'AL' ? idrPainelAl(p, ed) : cat[0] === 'TI' ? idrPainelTi(p, ed) :
      '<input type="search" placeholder="Buscar no banco de ' + esc(E.CONCEITOS[cat[2] - 1].nome.toLowerCase()) + '" aria-label="Buscar item" value="' + esc(V.bl || '') + '" data-live ' + h(function (el) { V.bl = el.value; agendar(); }) + '>' +
      '<div class="idr-hits">' + (hits.length ? hits.map(function (d) { return '<button class="lk" ' + add(d) + '>+ ' + esc(d) + '</button>'; }).join('') : '<span class="vz">Nenhum item encontrado no banco ' + esc(E.CONCEITOS[cat[2] - 1].nome) + '. Busque por outro termo ou cadastre o item no banco de dados.</span>') + '</div>') + '</div>' : (cat[0] === 'AL' ? idrPainelAl(p, ed) : cat[0] === 'TI' ? idrPainelTi(p, ed) : '')) +
    '<div class="tw" style="max-height:none"><table class="g idr-t"><thead><tr><th class="l">TIPO</th><th class="l">RECURSO</th><th>QTD</th><th class="l">RELAÇÃO</th><th>INÍCIO</th><th>TÉRMINO</th><th>CUSTO TOTAL</th>' + (ed ? '<th></th>' : '') + '</tr></thead><tbody>' +
    (at.linhas.filter(function (l) { return l.d; }).map(function (l) {
      var sv = function () { salvarAtiv(p, at); agendar(); }, rels = (S.base.tabelas.relacao || {})[{ 1: 'MAO', 2: 'VEM', 3: 'MAT', 5: 'IND' }[l.c]] || [];
      return '<tr' + (l.auto ? ' class="idr-a"' : '') + '><td>' + esc(E.CONCEITOS[l.c - 1].nome) + (l.ident ? '<br><small class="vz">' + esc(l.ident) + '</small>' : '') + (l.auto ? '<br><span class="idr-tag">automático</span>' : '') + '</td><td class="w">' + esc(l.d) + '</td>' +
        '<td class="n">' + (ed ? '<input class="idr-in" type="text" inputmode="decimal" value="' + numIn(l.q) + '" aria-label="Quantidade" ' + h(function (el) { l.q = parseNum(el.value); sv(); }) + '>' : qty(l.q)) + '</td>' +
        '<td>' + (ed && rels.length ? '<select aria-label="Relação" ' + h(function (el) { l.rel = el.value; sv(); }) + '>' + rels.map(function (r) { return '<option' + (r === l.rel ? ' selected' : '') + '>' + esc(r) + '</option>'; }).join('') + '</select>' : esc(l.rel || (l.c === 6 ? 'TERCEIRIZADO' : ''))) + '</td>' +
        '<td>' + (ed ? '<input type="date" value="' + esc(l.ini || '') + '" aria-label="Início" ' + h(function (el) { l.ini = el.value; sv(); }) + '>' : fdate(E.day(l.ini))) + '</td>' +
        '<td>' + (ed ? '<input type="date" value="' + esc(l.fim || '') + '" aria-label="Término" ' + h(function (el) { l.fim = el.value; sv(); }) + '>' : fdate(E.day(l.fim))) + '</td>' +
        '<td class="n">' + money(num(porL[l.id])) + '</td>' + (ed ? '<td class="x" ' + h(function () { at.linhas.splice(at.linhas.indexOf(l), 1); sv(); }) + '>×</td>' : '') + '</tr>';
    }).join('') || '<tr><td colspan="8" style="padding:12px" class="vz">Nenhum recurso. Escolha uma categoria acima e clique no item para incluir.</td></tr>') + '</tbody></table></div>' +
    (ed ? '<div class="cli-ac" style="margin-top:12px"><button class="lk" ' + h(function () { V.ren = !V.ren; agendar(); }) + '>Renomear</button>' +
      (V.ren ? '<input type="text" aria-label="Novo nome" value="' + esc(at.nome) + '" ' + h(function (el) { var nm = semAcento(el.value).toUpperCase().trim(); if (nm.length >= 5) { at.cc = at.cc.replace(at.nome, nm); at.nome = nm; salvarAtiv(p, at); V.ren = false; agendar(); } }) + '>' : '') +
      '<button class="lk pg" ' + h(function () { confirma('Excluir o centro de custo ' + at.nome + ' e os ' + at.linhas.length + ' recursos dele?', function () { p.atividades.splice(p.atividades.indexOf(at), 1); apagarAtiv(p, at); limpaCache(p.id); V.at = null; agendar(); }); }) + '>Excluir centro de custo</button></div>' : '') +
    '<p class="nota">Quantidade = pessoas, veículos ou unidades por mês durante o período (permanência). O custo usa os preços e encargos dos bancos de dados e entra no Cronograma financeiro no grupo INDIRETOS.</p></div></div></div>';
  /* centros de custo do projeto */
  var dirA = p.atividades.filter(function (a) { return !a.ind && num(X.porA[a.id]); });
  s += '<div class="gc"><h3>Centros de custo do projeto</h3><p class="gq">Cada atividade do cronograma financeiro é um centro de custo direto; o indireto é dividido pelos centros acima.</p><div class="tw" style="max-height:420px"><table class="g" style="width:100%"><thead><tr><th class="l">CENTRO DE CUSTO</th><th class="l">TIPO</th><th>CUSTO</th><th>% DO TOTAL</th></tr></thead><tbody>' +
    dirA.concat(A).map(function (a) { var v = num(X.porA[a.id]); return '<tr><td>' + esc(a.cc || a.nome) + '</td><td>' + (a.ind ? 'Indireto' : 'Direto') + '</td><td class="n">' + money(v) + '</td><td class="n">' + pct(X.dir + X.ind ? v / (X.dir + X.ind) : 0) + '</td></tr>'; }).join('') +
    '</tbody></table></div></div>';
  return s;
}

/* ---------- GESTÃO DE RISCOS (ISO 31000 / PMBOK, com restrições Lean) ---------- */
var RSK_P = [0, 0.1, 0.3, 0.5, 0.7, 0.9], RSK_PN = ['', 'Muito baixa (10%)', 'Baixa (30%)', 'Média (50%)', 'Alta (70%)', 'Muito alta (90%)'], RSK_IN = ['', 'Muito baixo', 'Baixo', 'Médio', 'Alto', 'Muito alto'];
var RSK_CAT = ['Técnico / engenharia', 'Suprimentos e logística', 'Clima e ambiente', 'Licenciamento e fundiário', 'Segurança e saúde (SSMA)', 'Mão de obra', 'Contratual / cliente', 'Financeiro / econômico', 'Gerenciamento do projeto', 'Externo / regulatório'];
var RSK_RESP = ['Mitigar', 'Evitar', 'Transferir', 'Aceitar'], RSK_ST = ['Aberto', 'Em tratamento', 'Encerrado', 'Ocorrido'];
var RSK_MODELO = [
  ['Atraso na entrega de módulos, trackers ou inversores', 'Suprimentos e logística', 3, 4], ['Chuvas acima da média histórica paralisando frentes de terraplenagem', 'Clima e ambiente', 3, 3],
  ['Atraso na emissão de licenças (LI, ASV) ou anuência de órgãos', 'Licenciamento e fundiário', 2, 5], ['Interferências não cadastradas no terreno (rochas, solo mole, lençol freático)', 'Técnico / engenharia', 3, 3],
  ['Reprovação em ensaios de cravação (pull-out) exigindo revisão de fundações', 'Técnico / engenharia', 2, 4], ['Baixa disponibilidade de mão de obra qualificada na região', 'Mão de obra', 3, 3],
  ['Acidente grave com afastamento ou paralisação da frente', 'Segurança e saúde (SSMA)', 2, 5], ['Variação cambial ou de preço de aço e cobre acima do previsto', 'Financeiro / econômico', 3, 3],
  ['Atraso na aprovação de projetos executivos pelo cliente', 'Contratual / cliente', 3, 3], ['Atraso na conexão / energização pela concessionária', 'Externo / regulatório', 2, 4],
  ['Furto ou vandalismo de cabos e equipamentos no canteiro', 'Externo / regulatório', 3, 2], ['Falha no planejamento de lookahead gerando restrições não removidas', 'Gerenciamento do projeto', 3, 2]
];
function rskEmv(r) { return RSK_P[num(r.p)] * num(r.v); }
function rskResumo(p) {
  var L = p.riscos || [], res = 0, tot = 0, enc = 0, oc = 0;
  L.forEach(function (r) { var e = rskEmv(r); tot += e; if (r.st === 'Encerrado') enc += e; else if (r.st === 'Ocorrido') oc += e; else res += e; });
  return { reserva: res, total: tot, liberada: enc, consumida: oc };
}
function rskNivel(r) { var x = num(r.p) * num(r.i); return x >= 15 ? 'al' : x >= 8 ? 'me' : x ? 'ba' : ''; }
function shRsk(p) {
  var V = S.v.rsk || (S.v.rsk = { f: '' }), ed = podeEditar(), L = p.riscos || (p.riscos = []), sv = function () { salvarMeta(p); limpaCache(p.id); agendar(); }, R = rskResumo(p);
  var hoje = new Date().toISOString().slice(0, 10);
  var novo = function (x) { var n = L.reduce(function (m, r) { return Math.max(m, parseInt(String(r.cod).replace(/\D/g, ''), 10) || 0); }, 0) + 1; L.push(Object.assign({ id: uid(), cod: 'R' + ('00' + n).slice(-3), d: '', cat: RSK_CAT[0], causa: '', efeito: '', p: 3, i: 3, v: 0, resp: 'Mitigar', acao: '', dono: '', prazo: '', st: 'Aberto', ab: hoje, enc: '' }, x || {})); };
  var s = titulo('GESTÃO DE RISCOS – RESERVA DE CONTINGÊNCIA', ed ? '<button class="bxl" style="background:var(--azul)" ' + h(function () { novo(); sv(); }) + '>+ Novo risco</button>' +
    (L.length ? '' : '<button class="lk" ' + h(function () { RSK_MODELO.forEach(function (m) { novo({ d: m[0].toUpperCase(), cat: m[1], p: m[2], i: m[3] }); }); sv(); }) + '>Carregar riscos típicos de obra de energia</button>') : '');
  s += '<div class="gk"><div class="kt hero"><span>Reserva de contingência atual</span><b>' + money(R.reserva) + '</b><i>soma de probabilidade × impacto dos riscos em aberto</i></div><div class="kt"><span>Reserva identificada (total)</span><b>' + money(R.total) + '</b><i>' + int(L.length) + ' riscos</i></div><div class="kt"><span>Liberada (riscos encerrados)</span><b>' + money(R.liberada) + '</b><i>volta para a margem</i></div><div class="kt"><span>Consumida (riscos ocorridos)</span><b>' + money(R.consumida) + '</b><i>virou custo</i></div></div>';
  /* matriz 5x5 e evolução */
  var M = {}; L.forEach(function (r) { if (r.st === 'Encerrado' || r.st === 'Ocorrido') return; var k = num(r.p) + '-' + num(r.i); (M[k] = M[k] || []).push(r.cod); });
  var mat = '<table class="rsk-m"><tbody>' + [5, 4, 3, 2, 1].map(function (pp) { return '<tr><th>' + RSK_PN[pp].replace(/ \(.*/, '') + '</th>' + [1, 2, 3, 4, 5].map(function (ii) { var x = pp * ii, c = x >= 15 ? 'al' : x >= 8 ? 'me' : 'ba', k = pp + '-' + ii; return '<td class="' + c + '" data-tip="' + (M[k] ? M[k].join(', ') : 'nenhum risco') + '">' + (M[k] ? M[k].length : '') + '</td>'; }).join('') + '</tr>'; }).join('') +
    '<tr><th></th>' + [1, 2, 3, 4, 5].map(function (ii) { return '<th class="rsk-ih">' + RSK_IN[ii] + '</th>'; }).join('') + '</tr></tbody></table>';
  var ev = ''; if (L.length) {
    var d0 = E.day((idrPeriodo(p))[0]), d1 = Math.max(E.day(hoje), E.day((idrPeriodo(p))[1])), m0 = miDe(d0), m1 = miDe(d1), pts = [];
    for (var mi = m0; mi <= m1; mi++) { var de = E.eom(mi), v = 0; L.forEach(function (r) { var ab = r.ab ? E.day(r.ab) : d0, fe = r.enc ? E.day(r.enc) : null; if (ab <= de && (fe == null || fe > de || (r.st !== 'Encerrado' && r.st !== 'Ocorrido'))) v += rskEmv(r); }); pts.push([mi, E.day(hoje) >= E.som(mi) ? v : null]); }
    var mx = Math.max.apply(null, pts.map(function (x) { return x[1] || 0; }).concat([1])), W = 560, H = 190, xs = function (i) { return 40 + (W - 50) * i / Math.max(1, pts.length - 1); }, ys = function (v) { return 10 + (H - 40) * (1 - v / mx); };
    var path = pts.filter(function (x) { return x[1] != null; }).map(function (x, i) { return (i ? 'L' : 'M') + xs(pts.indexOf(x)).toFixed(1) + ' ' + ys(x[1]).toFixed(1); }).join(' ');
    ev = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="rsk-ev" role="img" aria-label="Evolução da reserva de contingência"><line x1="40" x2="' + (W - 10) + '" y1="' + ys(0) + '" y2="' + ys(0) + '" stroke="var(--borda)"/>' +
      '<text x="36" y="' + (ys(mx) + 4) + '" text-anchor="end">' + money(mx).replace(/,\d+$/, '') + '</text><text x="36" y="' + (ys(0) + 4) + '" text-anchor="end">0</text>' +
      pts.map(function (x, i) { return i % Math.ceil(pts.length / 8) ? '' : '<text x="' + xs(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + mmaa(x[0]) + '</text>'; }).join('') +
      '<path d="' + path + '" fill="none" stroke="var(--azul)" stroke-width="2.5"/></svg>';
  }
  s += '<div class="grid2"><div class="gc"><h3>Matriz de probabilidade × impacto</h3><p class="gq">Riscos em aberto. Vermelho: alto · amarelo: médio · verde: baixo.</p>' + mat + '</div><div class="gc"><h3>Evolução da reserva de contingência</h3><p class="gq">A reserva cai à medida que os riscos são encerrados ou ocorrem.</p>' + (ev || '<span class="vz">Cadastre riscos para ver a curva.</span>') + '</div></div>';
  /* registro de riscos */
  var F = L.filter(function (r) { return !V.f || r.st === V.f; });
  var inp = function (r, k, ph, w) { return ed ? '<input type="text" value="' + esc(r[k] || '') + '" placeholder="' + ph + '" aria-label="' + ph + '"' + (w ? ' style="min-width:' + w + 'px"' : '') + ' ' + h(function (el) { r[k] = k === 'd' ? semAcento(el.value).toUpperCase() : el.value; sv(); }) + '>' : esc(r[k] || ''); };
  var sel = function (r, k, ops, rot, n) { return ed ? '<select aria-label="' + k + '" ' + h(function (el) { r[k] = n ? +el.value : el.value; if (k === 'st' && (r.st === 'Encerrado' || r.st === 'Ocorrido') && !r.enc) r.enc = hoje; if (k === 'st' && r.st !== 'Encerrado' && r.st !== 'Ocorrido') r.enc = ''; sv(); }) + '>' + ops.map(function (o, i) { var v = n ? i : o; return n && !i ? '' : '<option value="' + esc(v) + '"' + (String(r[k]) === String(v) ? ' selected' : '') + '>' + esc(rot ? rot[i] : o) + '</option>'; }).join('') + '</select>' : esc(rot ? rot[r[k]] : r[k]); };
  s += '<div class="gc"><h3>Registro de riscos</h3><p class="gq">Identifique, analise (probabilidade × impacto), defina a resposta e o responsável e acompanhe até o encerramento (ISO 31000). A ação de tratamento entra como restrição no planejamento Lean (lookahead) até ser removida.</p>' +
    '<div class="chips">' + [''].concat(RSK_ST).map(function (x) { var n = L.filter(function (r) { return !x || r.st === x; }).length; return '<button class="' + (V.f === x ? 'on' : '') + '" ' + h(function () { V.f = x; agendar(); }) + '>' + (x || 'Todos') + ' (' + n + ')</button>'; }).join('') + '</div>' +
    '<div class="tw" style="max-height:none"><table class="g rsk-t"><thead><tr><th>CÓD.</th><th class="l">RISCO</th><th class="l">CATEGORIA</th><th class="l">CAUSA / EFEITO</th><th>PROB.</th><th>IMPACTO</th><th>IMPACTO (R$)</th><th>RESERVA (R$)</th><th class="l">RESPOSTA / AÇÃO</th><th class="l">RESPONSÁVEL / PRAZO</th><th class="l">SITUAÇÃO</th>' + (ed ? '<th></th>' : '') + '</tr></thead><tbody>' +
    (F.map(function (r) {
      return '<tr class="rsk-' + rskNivel(r) + '"><td class="c"><b>' + esc(r.cod) + '</b></td><td class="w">' + inp(r, 'd', 'Descrição do risco', 240) + '</td><td>' + sel(r, 'cat', RSK_CAT) + '</td><td class="w">' + inp(r, 'causa', 'Causa', 160) + inp(r, 'efeito', 'Efeito', 160) + '</td>' +
        '<td>' + sel(r, 'p', RSK_P, RSK_PN, 1) + '</td><td>' + sel(r, 'i', RSK_P, RSK_IN, 1) + '</td>' +
        '<td class="n">' + (ed ? '<input class="idr-in" type="text" inputmode="decimal" value="' + numIn(r.v) + '" aria-label="Impacto em reais" ' + h(function (el) { r.v = parseNum(el.value); sv(); }) + '>' : money(r.v)) + '</td><td class="n"><b>' + money(rskEmv(r)) + '</b></td>' +
        '<td class="w">' + sel(r, 'resp', RSK_RESP) + inp(r, 'acao', 'Ação de tratamento', 180) + '</td><td class="w">' + inp(r, 'dono', 'Responsável', 120) + (ed ? '<input type="date" value="' + esc(r.prazo || '') + '" aria-label="Prazo" ' + h(function (el) { r.prazo = el.value; sv(); }) + '>' : (r.prazo ? fdate(E.day(r.prazo)) : '')) + '</td>' +
        '<td>' + sel(r, 'st', RSK_ST) + (r.enc ? '<br><small class="vz">em ' + fdate(E.day(r.enc)) + '</small>' : '') + '</td>' + (ed ? '<td class="x" ' + h(function () { confirma('Excluir o risco ' + r.cod + '?', function () { L.splice(L.indexOf(r), 1); sv(); }); }) + '>×</td>' : '') + '</tr>';
    }).join('') || '<tr><td colspan="12" style="padding:12px" class="vz">Nenhum risco neste filtro.</td></tr>') + '</tbody></table></div>' +
    '<p class="nota">Reserva = probabilidade × impacto em R$ (valor monetário esperado). A reserva dos riscos em aberto entra no preço do projeto na guia Indireto. Ao encerrar um risco a reserva é liberada; quando ele ocorre, a reserva é consumida.</p></div>';
  return s;
}
/* ================= SISTEMA › DADOS E VERIFICAÇÃO ================= */
NOMES.DADOS = 'Dados e verificação'; ABAS.push(['DADOS', '#7a7a7a']);
ICA.DADOS = '<ellipse cx="12" cy="6" rx="7.5" ry="2.8"/><path d="M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>';
(function () { GRUPOS_ABAS.forEach(function (g) { if (g[0] === 'Sistema' && g[1].indexOf('DADOS') < 0) { var i = g[1].indexOf('SIS'); g[1].splice(i >= 0 ? i + 1 : g[1].length, 0, 'DADOS'); } }); })();
function shDados() {
  var semP = !proj();
  return '<div class="a1">SISTEMA</div><div class="a2"><span>DADOS E VERIFICAÇÃO</span></div>' +
    cfgCard('Dados e verificação', 'Atualizar base de dados recarrega bancos e projetos do servidor. Atualizar recalcula o projeto aberto. Lista de erros mostra as inconsistências do projeto aberto.', '<div class="cmds" style="padding:4px 0 0;margin:0">' + rb('base', 'Atualizar base de dados', cmdBase, !S.pronto) + rb('atu', 'Atualizar', cmdAtualizar, semP) + rb('err', 'Lista de erros', cmdErros, semP) + '</div>' + (semP ? '<p class="nota">Selecione um projeto no topo para usar Atualizar e Lista de erros.</p>' : ''));
}

/* ================= INDIRETO AUTOMÁTICO (alojamentos pelo histograma, TI pelas funções) e RELATÓRIO DE COMBUSTÍVEIS ================= */
/* itens de referência com preço pesquisado (fonte na observação); entram no banco só quando o usuário pede */
var IDR_REF = [
  { d: 'GELADEIRA FROST FREE 377 L (CONSUL CRM44MB)', u: 'UN', vu: 3098, g: 'ELETRODOMESTICO', obs: 'Loja oficial Consul (consul.com.br), preço de tabela em 06/11/2026' },
  { d: 'INTERNET FIBRA RESIDENCIAL 500 MBPS (ALOJAMENTO)', u: 'MES', vu: 90, g: 'COMUNICACAO', obs: 'Vivo Fibra Lite 500 Mbps, R$ 1.080/ano = R$ 90/mês, preço verificado em 18/08/2026' },
  { d: 'LICENCA AUTOCAD (ASSINATURA ANUAL - VALOR MENSAL)', u: 'MES', vu: 623.33, g: 'INFORMATICA', obs: 'Autodesk Brasil (autodesk.com/br): assinatura anual R$ 7.480 ÷ 12, consulta em 06/11/2026' },
  { d: 'LICENCA MICROSOFT 365 APPS PARA EMPRESAS (OFFICE)', u: 'MES', vu: 57.30, g: 'INFORMATICA', obs: 'Microsoft Brasil (microsoft.com/pt-br): usuário/mês, cobrança anual, sem impostos, nov/2026' },
  { d: 'LICENCA MICROSOFT 365 BUSINESS BASIC (E-MAIL E TEAMS)', u: 'MES', vu: 33.40, g: 'INFORMATICA', obs: 'Microsoft Brasil (microsoft.com/pt-br): usuário/mês, cobrança anual, sem impostos, nov/2026' },
  { d: 'LICENCA PLANNER AND PROJECT PLAN 3 (MS PROJECT)', u: 'MES', vu: 171.80, g: 'INFORMATICA', obs: 'Microsoft Brasil (microsoft.com/pt-br): usuário/mês, cobrança anual, sem impostos, nov/2026' },
  { d: 'LICENCA WINDOWS 11 PRO', u: 'UN', vu: 1599, g: 'INFORMATICA', obs: 'Microsoft Store Brasil, preço em 06/11/2026' },
  { d: 'PLANO DE TELEFONIA MOVEL CORPORATIVO 20 GB', u: 'MES', vu: 59.99, g: 'COMUNICACAO', obs: 'Vivo Empresas 20 GB por linha (melhorplano.net, 17/03/2026)' },
  { d: 'SMARTPHONE CORPORATIVO (GALAXY A16 5G 128 GB)', u: 'UN', vu: 1200, g: 'INFORMATICA', obs: 'Canaltech, ago/2026: varejo R$ 900 a R$ 1.100; preço justo até R$ 1.200 (lançamento R$ 1.599)' }
];
var IDR_TI = [
  ['NB', 'Notebook (locação mensal)', 'NOTEBOOK', 'M'], ['WIN', 'Windows 11 Pro', 'LICENCA WINDOWS 11 PRO', 'U'],
  ['M365', 'E-mail e Teams (M365 Basic)', 'LICENCA MICROSOFT 365 BUSINESS BASIC (E-MAIL E TEAMS)', 'M'], ['OFF', 'Office (M365 Apps)', 'LICENCA MICROSOFT 365 APPS PARA EMPRESAS (OFFICE)', 'M'],
  ['CAD', 'AutoCAD', 'LICENCA AUTOCAD (ASSINATURA ANUAL - VALOR MENSAL)', 'M'], ['PRJ', 'MS Project', 'LICENCA PLANNER AND PROJECT PLAN 3 (MS PROJECT)', 'M'],
  ['CEL', 'Celular (aparelho)', 'SMARTPHONE CORPORATIVO (GALAXY A16 5G 128 GB)', 'U'], ['LIN', 'Linha móvel', 'PLANO DE TELEFONIA MOVEL CORPORATIVO 20 GB', 'M']
];
var IDR_PERFIS = [
  ['GES', 'Gestão (gerente, coordenador, supervisor)', /GERENTE|COORDENAD|SUPERVISOR|DIRETOR|ADMINISTRADOR DE CONTRATO/, ['NB', 'WIN', 'M365', 'OFF', 'PRJ', 'CEL', 'LIN']],
  ['PLA', 'Planejamento e controle', /PLANEJ|PROGRAMAD|CUSTO|MEDICAO|MEDICOES|CONTROLE|ORCAMENT/, ['NB', 'WIN', 'M365', 'OFF', 'PRJ', 'CEL', 'LIN']],
  ['ENG', 'Engenharia e projetos', /ENGENHEIR|PROJETIST|DESENHIST|CADISTA|TOPOGRAF|ARQUITET|GEOLOG/, ['NB', 'WIN', 'M365', 'OFF', 'CAD', 'CEL', 'LIN']],
  ['CAM', 'Liderança de campo', /ENCARREGAD|MESTRE|LIDER/, ['M365', 'CEL', 'LIN']],
  ['ADM', 'Administrativo e técnico', /TECNICO|ANALISTA|ASSISTENTE|AUXILIAR ADM|ADMINISTRATIV|COMPRADOR|ALMOXARIF|APONTADOR|SECRETARI|RECEPCION|ESTAGIARI|ENFERMEI|INSPETOR|COMERCIAL|FINANCEIR|RH|PESSOAL/, ['NB', 'WIN', 'M365', 'OFF']],
  ['OPE', 'Operacional (sem TI)', null, []]
];
function idrCfg(p) {
  var c = p.idrCfg || (p.idrCfg = {});
  c.al = Object.assign({ on: true, pct: 100, cap: 5, cc: '', aluguel: 'ALUGUEL DE REPUBLICAS (5 PESSOAS/CASA)',
    ut: [{ d: 'AGUA / ESGOTO', q: 1 }, { d: 'ENERGIA ELETRICA', q: 1 }, { d: 'INTERNET FIBRA RESIDENCIAL 500 MBPS (ALOJAMENTO)', q: 1 }],
    mob: [{ d: 'CAMAS E ARMARIOS', q: 1, por: 'P' }, { d: 'KIT DORMITORIO COMPLETO', q: 1, por: 'P' }, { d: 'FOGAO INCLUSO INSUMOS', q: 1, por: 'A' }, { d: 'GELADEIRA FROST FREE 377 L (CONSUL CRM44MB)', q: 1, por: 'A' }, { d: 'VENTILADOR TETO', q: 2, por: 'A' }] }, c.al || {});
  c.ti = Object.assign({ on: true, fx: {}, m: {}, it: {} }, c.ti || {});
  IDR_PERFIS.forEach(function (pf) { if (!c.ti.m[pf[0]]) c.ti.m[pf[0]] = pf[3].slice(); });
  IDR_TI.forEach(function (x) { if (!c.ti.it[x[0]]) c.ti.it[x[0]] = x[2]; });
  return c;
}
function idrItem(p, d) { return ctxDe(p).ind[d] || null; }
function idrRefFaltam(p) { return IDR_REF.filter(function (r) { return !idrItem(p, r.d); }); }
function idrRefIncluir(p) {
  var k = unificado() ? 'mat' : 'ind', B = S.base[k] || (S.base[k] = { rows: [] }), n = 0;
  idrRefFaltam(p).forEach(function (r) { B.rows.push(Object.assign({ dep: 0, des: 0, inst: 0, loc: 0, man: 0, mm: 0, mob: 0, mv: 0, out: 0, pm: 0, pv: 0, tmo: 0 }, r)); n++; });
  if (n) { salvarBase(k); S.projetos.forEach(function (x) { x._ctx = null; limpaCache(x.id); }); }
  return n;
}
function idrPerfilDe(cfg, func) { if (cfg.ti.fx[func]) return cfg.ti.fx[func]; var F = semAcento(func); for (var i = 0; i < IDR_PERFIS.length; i++) if (IDR_PERFIS[i][2] && IDR_PERFIS[i][2].test(F)) return IDR_PERFIS[i][0]; return 'OPE'; }
function idrNovaLinha(o) { return Object.assign({ id: uid(), info: '', status: '', obs: '' }, o); }
/* linhas desejadas de TI: cada função de mão de obra indireta recebe os itens do seu perfil, com o mesmo período */
function idrTiDesejado(p) {
  var cfg = idrCfg(p), out = [], falta = {};
  idrAtivs(p).forEach(function (a) {
    var ag = {};
    a.linhas.forEach(function (l) {
      if (l.c !== 1 || l.auto || !l.d || !num(l.q) || !l.ini || !l.fim) return;
      (cfg.ti.m[idrPerfilDe(cfg, l.d)] || []).forEach(function (k) {
        var x = IDR_TI.filter(function (t) { return t[0] === k; })[0]; if (!x) return;
        var d = cfg.ti.it[k] || x[2]; if (!idrItem(p, d)) { falta[d] = 1; return; }
        var uni = x[3] === 'U', key = k + '|' + l.ini + '|' + (uni ? l.ini : l.fim), o = ag[key] || (ag[key] = { c: 5, d: d, q: 0, rel: uni ? E.REL_RATEIO : 'OUTROS', ini: l.ini, fim: uni ? l.ini : l.fim, ident: 'Licenças e TI', auto: 'TI' });
        o.q += num(l.q);
      });
    });
    Object.keys(ag).sort().forEach(function (k) { out.push({ cc: a.id, l: ag[k] }); });
  });
  return { linhas: out, falta: Object.keys(falta) };
}
/* efetivo mensal do histograma (CPU × cronograma + permanência), arredondado para cima linha a linha, como no relatório */
function idrEfetivo(p) {
  var c = calc(p); if (c.efet) return c.efet;
  var V = S.v.relt, op = V && V.op; if (V) V.op = '';
  var D; try { D = relRecursos(p); } finally { if (V) V.op = op; }
  var m = {}; Object.keys(D.ins).forEach(function (k) { var I = D.ins[k]; if (I.t !== 'MO') return; Object.keys(I.mes).forEach(function (mi) { var v = num(I.mes[mi]); if (v > 1e-9) m[mi] = (m[mi] || 0) + Math.ceil(v - 1e-9); }); });
  return (c.efet = m);
}
function idrAlCC(p) { var cfg = idrCfg(p), A = idrAtivs(p); return A.filter(function (a) { return a.id === cfg.al.cc; })[0] || A.filter(function (a) { return /ADMINISTRA|CANTEIRO/.test(a.nome); })[0] || A[0] || null; }
/* alojamentos: n(mês) = teto(efetivo × % alojado ÷ capacidade); cada "camada" de alojamento vai do 1º ao último mês em que é necessária */
function idrAlDesejado(p) {
  var cfg = idrCfg(p).al, ef = idrEfetivo(p), cc = idrAlCC(p), mis = Object.keys(ef).map(Number).sort(function (a, b) { return a - b; }), n = {}, mx = 0, falta = {};
  mis.forEach(function (mi) { var v = Math.ceil(ef[mi] * num(cfg.pct) / 100 / Math.max(1, num(cfg.cap)) - 1e-9); n[mi] = Math.max(0, v); mx = Math.max(mx, n[mi]); });
  var camadas = {};
  for (var k = 1; k <= mx; k++) { var f = null, l = null; mis.forEach(function (mi) { if (n[mi] >= k) { if (f == null) f = mi; l = mi; } }); if (f != null) { var key = f + '|' + l; camadas[key] = (camadas[key] || 0) + 1; } }
  var out = [], iso = function (d) { return E.iso(d); }, cap = Math.max(1, num(cfg.cap));
  var add = function (d, q, mensal, a, b, rel) { if (!d || !q) return; if (!idrItem(p, d)) { falta[d] = 1; return; } out.push({ cc: cc && cc.id, l: { c: 5, d: d, q: q, rel: mensal ? rel || 'OUTROS' : E.REL_RATEIO, ini: iso(E.som(a)), fim: iso(mensal ? E.eom(b) : E.som(a)), ident: 'Alojamentos', auto: 'AL' } }); };
  Object.keys(camadas).sort(function (x, y) { return +x.split('|')[0] - +y.split('|')[0] || +x.split('|')[1] - +y.split('|')[1]; }).forEach(function (key) {
    var a = +key.split('|')[0], b = +key.split('|')[1], q = camadas[key];
    add(cfg.aluguel, q, true, a, b, 'LOCACAO IMOVEL');
    cfg.ut.forEach(function (u) { add(u.d, q * num(u.q), true, a, b); });
    cfg.mob.forEach(function (m) { add(m.d, q * num(m.q) * (m.por === 'P' ? cap : 1), false, a, b); });
  });
  return { linhas: out, n: n, mis: mis, ef: ef, pico: mx, falta: Object.keys(falta) };
}
function idrAssin(L) { return L.map(function (x) { var l = x.l || x; return [x.cc || '', l.d, Math.round(num(l.q) * 1000), l.ini, l.fim, l.rel].join('~'); }).sort().join('\n'); }
function idrAtuais(p, tipo) { var o = []; idrAtivs(p).forEach(function (a) { a.linhas.forEach(function (l) { if (l.auto === tipo) o.push({ cc: a.id, l: l }); }); }); return o; }
function idrAplicar(p, tipo, des) {
  var mud = 0;
  idrAtivs(p).forEach(function (a) {
    var antes = idrAssin(a.linhas.filter(function (l) { return l.auto === tipo; }).map(function (l) { return { cc: a.id, l: l }; }));
    var novas = des.filter(function (x) { return x.cc === a.id; });
    if (antes === idrAssin(novas)) return;
    a.linhas = a.linhas.filter(function (l) { return l.auto !== tipo; }).concat(novas.map(function (x) { return idrNovaLinha(x.l); }));
    salvarAtiv(p, a); mud++;
  });
  return mud;
}
/* sincroniza as linhas automáticas quando a opção está ligada (só grava se mudou) */
function idrSync(p) {
  var cfg = idrCfg(p), n = 0;
  if (cfg.ti.on) n += idrAplicar(p, 'TI', idrTiDesejado(p).linhas);
  if (cfg.al.on && (!p.crono || p._cro)) { try { n += idrAplicar(p, 'AL', idrAlDesejado(p).linhas); } catch (e) { console.error(e); } }
  return n;
}
function idrOpsBanco(p, rx, atual) {
  var I = ctxDe(p).ind, L = Object.keys(I).filter(function (d) { return rx.test(semAcento(d)); }).sort(ordAlfa);
  if (atual && L.indexOf(atual) < 0) L.unshift(atual);
  return L.map(function (d) { var r = I[d]; return '<option value="' + esc(d) + '"' + (d === atual ? ' selected' : '') + '>' + esc(d) + (r ? ' · R$ ' + money(num(r.vu)) + '/' + esc(r.u || '') : ' · (não está no banco)') + '</option>'; }).join('');
}
function idrRefAviso(p, falta, ed) {
  if (!falta.length) return '';
  var ref = idrRefFaltam(p).filter(function (r) { return falta.indexOf(r.d) >= 0; });
  return '<div class="idr-av"><b>Itens que não estão no banco de dados:</b> ' + falta.map(esc).join(' · ') + '.' +
    (ed && ref.length ? ' <button class="lk" ' + h(function () { var n = idrRefIncluir(p); aviso(n + ' item(ns) de referência incluído(s) no banco, com o preço e a fonte na observação.'); agendar(); }) + '>Incluir os itens de referência no banco (' + ref.length + ')</button>' : ' Escolha outro item ou cadastre-o no banco.') + '</div>';
}
/* painel de alojamentos */
function idrPainelAl(p, ed) {
  var cfg = idrCfg(p), A = cfg.al, sv = function () { salvarMeta(p); limpaCache(p.id); agendar(); };
  if (p.crono && !p._cro) { croCarregar(p); return '<div class="vz" style="padding:10px">Carregando o cronograma para ler o histograma…</div>'; }
  var D = idrAlDesejado(p), at = idrAtuais(p, 'AL'), ok = idrAssin(at) === idrAssin(D.linhas);
  var picoEf = Math.max.apply(null, D.mis.map(function (mi) { return D.ef[mi]; }).concat([0])), am = D.mis.reduce(function (s, mi) { return s + D.n[mi]; }, 0);
  var cc = idrAlCC(p), I = function (d) { var r = idrItem(p, d); return r ? num(r.vu) : 0; };
  var custoMes = I(A.aluguel) + A.ut.reduce(function (s, u) { return s + I(u.d) * num(u.q); }, 0), custoMob = A.mob.reduce(function (s, m) { return s + I(m.d) * num(m.q) * (m.por === 'P' ? num(A.cap) : 1); }, 0);
  var s = '<div class="idr-auto"><div class="idr-ah"><h4>Alojamentos pelo histograma de mão de obra</h4><label class="idr-on"><input type="checkbox"' + (A.on ? ' checked' : '') + (ed ? '' : ' disabled') + ' ' + h(function (el) { A.on = el.checked; if (A.on) idrAplicar(p, 'AL', idrAlDesejado(p).linhas); sv(); }) + '> Gerar automaticamente</label></div>' +
    '<div class="gk"><div class="kt"><span>Pico do efetivo</span><b>' + int(picoEf) + '</b><i>pessoas (histograma)</i></div><div class="kt"><span>Pico de alojamentos</span><b>' + int(D.pico) + '</b><i>' + int(A.cap) + ' pessoas por alojamento</i></div><div class="kt"><span>Alojamentos × mês</span><b>' + int(am) + '</b><i>soma do período</i></div><div class="kt"><span>Por alojamento</span><b>' + money(custoMes) + '</b><i>/mês + ' + money(custoMob) + ' de mobiliário</i></div></div>';
  if (D.mis.length) s += relBarras(D.mis, D.mis.map(function (mi) { return D.n[mi]; }), int, 'Alojamentos necessários por mês');
  var num2 = function (v, set, rot, w) { return '<label>' + rot + ' <input class="idr-in" style="width:' + (w || 64) + 'px" type="text" inputmode="decimal" value="' + numIn(v) + '"' + (ed ? '' : ' disabled') + ' ' + h(function (el) { set(parseNum(el.value)); sv(); }) + '></label>'; };
  s += '<div class="idr-cfg">' + num2(A.cap, function (v) { A.cap = Math.max(1, Math.round(v) || 1); }, 'Pessoas por alojamento') + num2(A.pct, function (v) { A.pct = Math.min(100, Math.max(0, v)); }, '% do efetivo alojado') +
    '<label>Centro de custo <select' + (ed ? '' : ' disabled') + ' ' + h(function (el) { A.cc = el.value; sv(); }) + '>' + idrAtivs(p).map(function (a) { return '<option value="' + a.id + '"' + (cc && a.id === cc.id ? ' selected' : '') + '>' + esc(a.nome) + '</option>'; }).join('') + '</select></label></div>';
  var selI = function (rx, atual, set) { return '<select class="idr-sel"' + (ed ? '' : ' disabled') + ' ' + h(function (el) { set(el.value); sv(); }) + '>' + idrOpsBanco(p, rx, atual) + '</select>'; };
  s += '<table class="g idr-ct"><thead><tr><th class="l">ITEM DO ALOJAMENTO</th><th class="l">BANCO DE DADOS</th><th>QTD</th><th>BASE</th>' + (ed ? '<th></th>' : '') + '</tr></thead><tbody>' +
    '<tr><td>Aluguel</td><td>' + selI(/ALUGUEL|ALOJAMENTO|REPUBLICA|HOSPEDAGEM|CASA/, A.aluguel, function (v) { A.aluguel = v; }) + '</td><td class="n">1</td><td>por alojamento / mês</td>' + (ed ? '<td></td>' : '') + '</tr>' +
    A.ut.map(function (u, i) { return '<tr><td>' + (['Água', 'Luz', 'Internet'][i] || 'Conta') + '</td><td>' + selI(/AGUA|ENERGIA|INTERNET|TELEF|LUZ|ESGOTO|GAS/, u.d, function (v) { u.d = v; }) + '</td><td class="n">' + (ed ? '<input class="idr-in" type="text" inputmode="decimal" value="' + numIn(u.q) + '" ' + h(function (el) { u.q = parseNum(el.value); sv(); }) + '>' : qty(u.q)) + '</td><td>por alojamento / mês</td>' + (ed ? '<td class="x" ' + h(function () { A.ut.splice(i, 1); sv(); }) + '>×</td>' : '') + '</tr>'; }).join('') +
    A.mob.map(function (m, i) { return '<tr><td>' + (i ? '' : 'Mobiliário') + '</td><td>' + selI(/CAMA|BELICHE|COLCH|ARMARIO|GELADEIRA|REFRIGERADOR|FOGAO|VENTILADOR|AR CONDICIONADO|MESA|CADEIRA|KIT DORMITORIO|MOVE|MICROONDAS|LAVADORA|BEBEDOURO|SOFA|TELEVIS/, m.d, function (v) { m.d = v; }) + '</td><td class="n">' + (ed ? '<input class="idr-in" type="text" inputmode="decimal" value="' + numIn(m.q) + '" ' + h(function (el) { m.q = parseNum(el.value); sv(); }) + '>' : qty(m.q)) + '</td><td>' + (ed ? '<select ' + h(function (el) { m.por = el.value; sv(); }) + '><option value="P"' + (m.por === 'P' ? ' selected' : '') + '>por pessoa (compra)</option><option value="A"' + (m.por !== 'P' ? ' selected' : '') + '>por alojamento (compra)</option></select>' : (m.por === 'P' ? 'por pessoa' : 'por alojamento')) + '</td>' + (ed ? '<td class="x" ' + h(function () { A.mob.splice(i, 1); sv(); }) + '>×</td>' : '') + '</tr>'; }).join('') +
    '</tbody></table>' + (ed ? '<div class="cli-ac"><button class="lk" ' + h(function () { A.ut.push({ d: '', q: 1 }); sv(); }) + '>+ Conta mensal</button><button class="lk" ' + h(function () { A.mob.push({ d: '', q: 1, por: 'A' }); sv(); }) + '>+ Item de mobiliário</button></div>' : '');
  s += idrRefAviso(p, D.falta, ed);
  s += '<div class="idr-st ' + (ok ? 'ok' : 'pend') + '">' + (ok ? (at.length ? '✓ Alojamentos atualizados: ' + int(at.length) + ' linhas automáticas em ' + esc(cc ? cc.nome : '') + '.' : 'Nenhum alojamento gerado ainda.') : 'As linhas de alojamento estão desatualizadas em relação ao histograma.') +
    (ed && (!ok || !at.length) ? ' <button class="bt" ' + h(function () { var n = idrAplicar(p, 'AL', D.linhas); aviso(n ? 'Alojamentos atualizados pelo histograma.' : 'Nada a atualizar.'); agendar(); }) + '>Gerar / atualizar alojamentos</button>' : '') +
    (ed && at.length ? ' <button class="lk pg" ' + h(function () { A.on = false; idrAplicar(p, 'AL', []); sv(); }) + '>Remover linhas automáticas</button>' : '') + '</div>';
  return s + '<p class="nota">Alojamentos por mês = teto(efetivo do histograma × % alojado ÷ pessoas por alojamento). Cada alojamento fica alugado do primeiro ao último mês em que é necessário; água, luz e internet são cobradas por alojamento e mês; o mobiliário é comprado uma vez, quando o alojamento abre. Com "Gerar automaticamente" ligado, as linhas acompanham o histograma sempre que o cronograma ou as composições mudarem.</p></div>';
}
/* painel de licenças e TI */
function idrPainelTi(p, ed) {
  var cfg = idrCfg(p), T = cfg.ti, sv = function () { salvarMeta(p); if (T.on) idrAplicar(p, 'TI', idrTiDesejado(p).linhas); limpaCache(p.id); agendar(); };
  var F = {}; idrAtivs(p).forEach(function (a) { a.linhas.forEach(function (l) { if (l.c === 1 && !l.auto && l.d) { var o = F[l.d] || (F[l.d] = { q: 0, cc: {} }); o.q = Math.max(o.q, num(l.q)); o.cc[a.nome] = 1; } }); });
  var D = idrTiDesejado(p), at = idrAtuais(p, 'TI'), ok = idrAssin(at) === idrAssin(D.linhas);
  /* quantidade simultânea máxima de cada item (pico mensal) */
  var cnt = {}, pm = {}; D.linhas.forEach(function (x) { var a = E.mi(E.day(x.l.ini)), b = E.mi(E.day(x.l.fim)), M = pm[x.l.d] || (pm[x.l.d] = {}); for (var mi = a; mi <= b; mi++) M[mi] = (M[mi] || 0) + num(x.l.q); });
  Object.keys(pm).forEach(function (d) { cnt[d] = Math.max.apply(null, Object.keys(pm[d]).map(function (k) { return pm[d][k]; })); });
  var s = '<div class="idr-auto"><div class="idr-ah"><h4>Licenças e TI pelas funções da mão de obra indireta</h4><label class="idr-on"><input type="checkbox"' + (T.on ? ' checked' : '') + (ed ? '' : ' disabled') + ' ' + h(function (el) { T.on = el.checked; if (!T.on) idrAplicar(p, 'TI', idrTiDesejado(p).linhas); sv(); }) + '> Gerar automaticamente</label></div>';
  var fs = Object.keys(F).sort(ordAlfa);
  s += '<table class="g idr-ct"><thead><tr><th class="l">FUNÇÃO (MÃO DE OBRA INDIRETA)</th><th>PESSOAS</th><th class="l">PERFIL DE TI</th><th class="l">RECEBE</th></tr></thead><tbody>' +
    (fs.map(function (f) {
      var pf = idrPerfilDe(cfg, f);
      return '<tr><td>' + esc(f) + '<br><small class="vz">' + esc(Object.keys(F[f].cc).join(' · ')) + '</small></td><td class="n">' + qty(F[f].q) + '</td><td>' + (ed ? '<select ' + h(function (el) { if (el.value === idrPerfilDe({ ti: { fx: {} } }, f)) delete T.fx[f]; else T.fx[f] = el.value; sv(); }) + '>' + IDR_PERFIS.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === pf ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('') + '</select>' : esc(IDR_PERFIS.filter(function (x) { return x[0] === pf; })[0][1])) + '</td><td class="idr-rc">' + ((T.m[pf] || []).map(function (k) { return IDR_TI.filter(function (t) { return t[0] === k; })[0][1]; }).join(', ') || '—') + '</td></tr>';
    }).join('') || '<tr><td colspan="4" class="vz" style="padding:10px">Nenhuma função de mão de obra indireta nos centros de custo. Inclua as funções em "Mão de obra indireta"; os equipamentos e licenças saem delas.</td></tr>') + '</tbody></table>';
  s += '<h4 style="margin:14px 0 6px">Itens por perfil</h4><div class="tw" style="max-height:none"><table class="g idr-ct idr-mx"><thead><tr><th class="l">ITEM</th><th class="l">BANCO DE DADOS</th>' + IDR_PERFIS.slice(0, -1).map(function (x) { return '<th title="' + esc(x[1]) + '">' + esc(x[1].replace(/ \(.*/, '')) + '</th>'; }).join('') + '<th>PICO (UN.)</th></tr></thead><tbody>' +
    IDR_TI.map(function (t) {
      var d = T.it[t[0]], r = idrItem(p, d);
      return '<tr><td>' + esc(t[1]) + '<br><small class="vz">' + (t[3] === 'U' ? 'compra única, no início da função' : 'mensal, durante a função') + '</small></td><td>' + (ed ? '<select class="idr-sel" ' + h(function (el) { T.it[t[0]] = el.value; sv(); }) + '>' + idrOpsBanco(p, /NOTEBOOK|COMPUTADOR|LICENCA|SOFTWARE|MICROSOFT|OFFICE|WINDOWS|AUTOCAD|PROJECT|CELULAR|SMARTPHONE|TELEFON|PLANO|INTERNET|TABLET|IMPRESSORA/, d) + '</select>' : esc(d) + (r ? ' · R$ ' + money(num(r.vu)) : '')) + '</td>' +
        IDR_PERFIS.slice(0, -1).map(function (x) { var on = (T.m[x[0]] || []).indexOf(t[0]) >= 0; return '<td class="c"><input type="checkbox" aria-label="' + esc(t[1] + ' para ' + x[1]) + '"' + (on ? ' checked' : '') + (ed ? '' : ' disabled') + ' ' + h(function (el) { var L = T.m[x[0]] || (T.m[x[0]] = []), i = L.indexOf(t[0]); if (el.checked && i < 0) L.push(t[0]); else if (!el.checked && i >= 0) L.splice(i, 1); sv(); }) + '></td>'; }).join('') +
        '<td class="n">' + (cnt[d] ? qty(cnt[d]) : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  s += idrRefAviso(p, D.falta, ed);
  s += '<div class="idr-st ' + (ok ? 'ok' : 'pend') + '">' + (ok ? (at.length ? '✓ Licenças e TI atualizados: ' + int(at.length) + ' linhas automáticas nos centros de custo.' : 'Nenhuma linha de TI gerada ainda.') : 'As linhas de TI estão desatualizadas em relação às funções.') +
    (ed && (!ok || !at.length) ? ' <button class="bt" ' + h(function () { var n = idrAplicar(p, 'TI', D.linhas); aviso(n ? 'Licenças e TI atualizados pelas funções.' : 'Nada a atualizar.'); agendar(); }) + '>Gerar / atualizar licenças e TI</button>' : '') +
    (ed && at.length ? ' <button class="lk pg" ' + h(function () { T.on = false; idrAplicar(p, 'TI', []); salvarMeta(p); agendar(); }) + '>Remover linhas automáticas</button>' : '') + '</div>';
  return s + '<p class="nota">Cada função de mão de obra indireta recebe os itens do seu perfil, na mesma quantidade de pessoas e no mesmo período, dentro do mesmo centro de custo. Itens mensais (notebook locado, licenças, linha móvel) são cobrados por mês; itens de compra única (Windows, aparelho celular) entram no mês de início. O perfil é sugerido pelo nome da função e pode ser trocado.</p></div>';
}

/* ---------- RELATÓRIO: DIESEL E COMBUSTÍVEIS ---------- */
NOMES.CMB = 'Diesel e combustíveis'; PRECISA_PROJ.CMB = 1; ABAS.push(['CMB', '#5a4475']);
ICA.CMB = '<path d="M5 20V5.5A1.5 1.5 0 0 1 6.5 4h6A1.5 1.5 0 0 1 14 5.5V20"/><path d="M4 20h11M7 8h5"/><path d="M14 10h2a1.5 1.5 0 0 1 1.5 1.5V16a1.5 1.5 0 0 0 3 0V9l-2.5-2.5"/>';
function cmbCat(d) { var D = semAcento(d); return /ONIBUS|MICRO-ONIBUS|MICROONIBUS|\bVAN\b|VANS\b/.test(D) ? 'Ônibus e vans' : /CAMINHONETE|PICAPE|PICK|AUTOMOVEL|VEICULO LEVE|CAMIONETA|CARRO\b|PASSEIO|\bSUV\b|MOTOCICLETA|UTILITARIO/.test(D) ? 'Veículos leves' : /CAMINHAO|MUNCK|PIPA|COMBOIO|BASCULANTE|CARROCERIA|CAVALO MECANICO|PRANCHA|BETONEIRA AUTO/.test(D) ? 'Veículos de apoio' : 'Equipamentos e máquinas'; }
function cmbFam(cb) { var C = semAcento(cb || ''); return /DIESEL/.test(C) ? 'Diesel' : /GASOLINA/.test(C) ? 'Gasolina' : /ETANOL|ALCOOL/.test(C) ? 'Etanol' : /GNV|GAS NATURAL/.test(C) ? 'GNV' : C ? 'Outros' : 'Sem combustível'; }
function shCmb(p) {
  var w = p.crono ? croPrecisa(p, 'DIESEL E COMBUSTÍVEIS') : null; if (w) return w;
  var V = S.v.cmb || (S.v.cmb = { de: 0, ate: 0, f: '', med: 'L', por: 'E' }), cx = ctxDe(p), RV = S.v.relt, op = RV && RV.op;
  if (RV) RV.op = ''; var D; try { D = relRecursos(p); } finally { if (RV) RV.op = op; }
  var fq = function (v) { return nfq.format(v); }, preco = function (cb) { return num((cx.combustivel[cb] || {}).v); };
  var its = [], semVinc = 0;
  Object.keys(D.ins).forEach(function (k) {
    var I = D.ins[k]; if (I.t !== 'EQ') return;
    var cb = I.fonte === 'CPU' ? (I.cmb && I.cmb.cb) || '' : I.cb || '', lh = I.fonte === 'CPU' ? num(I.cmb && I.cmb.lh) || num(I.cons) : num(I.lh);
    if (I.fonte === 'CPU' && !(I.cmb && I.cmb.vem)) { semVinc++; return; }
    if (!lh || !cb) return;
    var fam = cmbFam(cb); if (V.f && fam !== V.f) return;
    var pr = preco(cb), mult = V.med === 'R' ? lh * pr : lh, mes = {}; Object.keys(I.mes2).forEach(function (mi) { mes[mi] = I.mes2[mi] * mult; });
    its.push({ I: I, d: I.d, cat: cmbCat(I.d), cb: cb, fam: fam, lh: lh, pr: pr, mes: mes, mult: mult });
  });
  var meses = relMeses(D.lista, V), linhas = [];
  var soma = function (rot, extra, mes) { var L = linhas.filter(function (x) { return x.rot === rot; })[0]; if (!L) linhas.push(L = { rot: rot, mes: {}, extra: extra }); Object.keys(mes).forEach(function (mi) { L.mes[mi] = (L.mes[mi] || 0) + mes[mi]; }); };
  its.forEach(function (x) {
    if (V.por === 'C') soma(x.cat, [], x.mes);
    else if (V.por === 'F') soma(x.cb, ['R$ ' + money(x.pr) + '/L'], x.mes);
    else if (V.por === 'A') Object.keys(x.I.at).forEach(function (a) { var m = {}; Object.keys(x.I.at[a].mes2).forEach(function (mi) { m[mi] = x.I.at[a].mes2[mi] * x.mult; }); soma(a, [], m); });
    else soma(x.d, [x.cat, x.cb, fq(x.lh) + ' L/h', x.I.fonte], x.mes);
  });
  linhas = linhas.filter(function (l) { return meses.some(function (mi) { return num(l.mes[mi]); }); }).sort(function (a, b) { return cpuOrd(a.rot, b.rot); });
  var T = { rot: 'TOTAL', mes: {}, cls: 'tt', extra: [] }; linhas.forEach(function (l) { Object.keys(l.mes).forEach(function (mi) { T.mes[mi] = (T.mes[mi] || 0) + l.mes[mi]; }); while (T.extra.length < l.extra.length) T.extra.push(''); });
  var fmt = V.med === 'R' ? money : fq;
  var cab = [V.por === 'C' ? 'CATEGORIA' : V.por === 'F' ? 'COMBUSTÍVEL' : V.por === 'A' ? 'ATIVIDADE' : 'VEÍCULO / EQUIPAMENTO'].concat(V.por === 'E' ? ['CATEGORIA', 'COMBUSTÍVEL', 'CONSUMO', 'ORIGEM'] : V.por === 'F' ? ['PREÇO'] : []);
  var mz = relMatriz(cab, [T].concat(linhas), meses, fmt, { pico: true });
  /* resumo por combustível (sempre em litros e R$) */
  var R = {}; its.forEach(function (x) { var o = R[x.fam] || (R[x.fam] = { L: 0, V: 0 }); meses.forEach(function (mi) { var h2 = num(x.I.mes2[mi]); o.L += h2 * x.lh; o.V += h2 * x.lh * x.pr; }); });
  var catT = {}; its.forEach(function (x) { meses.forEach(function (mi) { catT[x.cat] = (catT[x.cat] || 0) + num(x.I.mes2[mi]) * x.lh * (V.med === 'R' ? x.pr : 1); }); });
  var sel = function (val, lista, set, rot) { return '<label>' + rot + ' <select ' + h(function (el) { set(el.value); agendar(); }) + '>' + lista.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(val) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>'; };
  var mOps = [[0, '—']].concat(D.lista.map(function (mi) { return [mi, mmaa(mi)]; }));
  var s = titulo('DIESEL E COMBUSTÍVEIS', '<span class="vz" style="font:500 12px var(--ui)">Relatórios</span>');
  s += '<div class="cpu-lb rel-f">' + sel(V.de, mOps, function (v) { V.de = +v; }, 'Período') + sel(V.ate, mOps, function (v) { V.ate = +v; }, 'a') +
    sel(V.f, [['', 'Todos os combustíveis'], ['Diesel', 'Diesel'], ['Gasolina', 'Gasolina'], ['Etanol', 'Etanol'], ['GNV', 'GNV']], function (v) { V.f = v; }, 'Combustível') +
    sel(V.med, [['L', 'Litros'], ['R', 'Custo (R$)']], function (v) { V.med = v; }, 'Mostrar') +
    sel(V.por, [['E', 'Por veículo / equipamento'], ['C', 'Por categoria'], ['F', 'Por combustível'], ['A', 'Por atividade']], function (v) { V.por = v; }, 'Agrupar') +
    '<span style="flex:1"></span><button class="bxl" ' + h(function () { relExcel(p, 'Diesel e combustiveis', mz.aoa); }) + '>' + XL_IC + 'Excel</button></div>';
  var famK = Object.keys(R).sort();
  s += '<div class="gk">' + (famK.length ? famK.map(function (f) { return '<div class="kt"><span>' + esc(f) + '</span><b>' + fq(R[f].L) + ' L</b><i>R$ ' + money(R[f].V) + '</i></div>'; }).join('') : '<div class="kt"><span>Consumo</span><b>0 L</b><i>sem veículos ou equipamentos com consumo</i></div>') +
    '<div class="kt hero"><span>Total no período</span><b>R$ ' + money(famK.reduce(function (a, f) { return a + R[f].V; }, 0)) + '</b><i>' + fq(famK.reduce(function (a, f) { return a + R[f].L; }, 0)) + ' L</i></div></div>';
  s += '<div class="grid2"><div class="gc"><h3>' + (V.med === 'R' ? 'Custo de combustível por mês (R$)' : 'Consumo de combustível por mês (L)') + '</h3>' + (meses.length ? relBarras(meses, meses.map(function (mi) { return num(T.mes[mi]); }), fmt, 'Combustível por mês') : '<span class="vz">Sem consumo no período.</span>') + '</div>' +
    '<div class="gc"><h3>Por categoria</h3><table class="g" style="width:100%"><tbody>' + Object.keys(catT).sort().map(function (c) { var tt = Object.keys(catT).reduce(function (a, k) { return a + catT[k]; }, 0); return '<tr><td>' + esc(c) + '</td><td class="n">' + fmt(catT[c]) + (V.med === 'R' ? '' : ' L') + '</td><td class="n">' + pct(tt ? catT[c] / tt : 0) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  s += '<div class="gc"><h3>Detalhamento mensal <span class="vz" style="font-weight:500">· ' + (V.med === 'R' ? 'R$' : 'litros') + '</span></h3>' + mz.html +
    (semVinc ? '<p class="gq"><b class="pico">' + semVinc + ' equipamento(s) das CPUs sem vínculo com o banco Veículos e máquinas</b> não entram no relatório. Vincule em CPU › Insumos (VÍNCULO = VEM).</p>' : '') +
    '<div class="nota">Consumo = horas de utilização × L/h do banco Veículos e máquinas (potência × coeficiente DNIT/SICRO, ou L/h e km informados). Equipamentos vêm das composições (CPU) distribuídas pelo cronograma; veículos leves, de apoio, ônibus e vans vêm das permanências do Cronograma financeiro e dos centros de custo indiretos. Preço por litro: tabela de combustível de Configurações.</div></div>';
  return s;
}

/* ---------- menus: KPI, mapas e linhas de balanço; fluxo de caixa e demonstrativo vão para Relatórios ---------- */
(function () {
  var tira = { 'Planejamento': ['LOB', 'MAP', 'R_KPC'], 'Custos': ['R_FC', 'R_DRE', 'R_DSLV'] };
  GRUPOS_ABAS.forEach(function (g) {
    (tira[g[0]] || []).forEach(function (k) { var i = g[1].indexOf(k); if (i >= 0) g[1].splice(i, 1); });
    if (g[0] === 'Relatórios') {
      var resto = g[1].filter(function (k) { return ['R_KPC', 'LOB', 'MAP', 'HISP', 'CMB', 'R_FC', 'R_DRE'].indexOf(k) < 0; });
      g[1].length = 0; ['R_KPC', 'LOB', 'MAP', 'HISP', 'CMB', 'R_FC', 'R_DRE'].concat(resto).forEach(function (k) { g[1].push(k); });
    }
  });
  var i = HIS_P.indexOf('DSL'); if (i >= 0) HIS_P.splice(i, 1);
})();


/* ---------- menu: Projeto começa por Dados do projeto; Cadastro de clientes e empresas vai para Sistema ---------- */
NOMES.CLI = 'Cadastro de clientes e empresas';
if (CLI_PAPEIS.indexOf('EMPRESA DO GRUPO') < 0) CLI_PAPEIS.push('EMPRESA DO GRUPO');
(function () {
  GRUPOS_ABAS.forEach(function (g) {
    if (g[0] === 'Projeto') { var r = g[1].filter(function (k) { return k !== 'CLI' && k !== 'CONFIG' && k !== 'GRA'; }); g[1].length = 0; ['CONFIG', 'GRA'].concat(r).forEach(function (k) { g[1].push(k); }); }
    if (g[0] === 'Sistema') { var r2 = g[1].filter(function (k) { return ['SIS', 'DADOS', 'CLI'].indexOf(k) < 0; }); g[1].length = 0; ['SIS', 'DADOS', 'CLI'].concat(r2).forEach(function (k) { g[1].push(k); }); }
  });
})();

/* ---------- OpenStreetMap: links e fundo vetorial a partir dos dados oficiais (.osm) ----------
   O artefato não carrega imagens de outros sites; por isso o fundo usa os dados do OSM (ruas, rios, matas, linhas de energia…),
   baixados pelo usuário no link oficial da API para a área do KMZ e desenhados aqui na mesma projeção do mapa. */
var OSM_CAT = {
  campo: ['A', '#e9efd2', null, 0, 'Lavoura e pastagem'], mata: ['A', '#b8d5a4', null, 0, 'Mata'], urb: ['A', '#e2dfdc', null, 0, 'Área urbana'], ind: ['A', '#e9dbe6', null, 0, 'Indústria / energia'],
  agua: ['A', '#a9cfe0', '#7fb2cc', 1, 'Água'], pred: ['A', '#d8cfc6', '#bfb2a6', 0.6, 'Edificações'],
  rio: ['L', null, '#7fb6d4', 2.4, 'Rios e canais'], corr: ['L', null, '#9cc6dd', 1.2, 'Córregos'],
  via1: ['L', null, '#e8915f', 3.2, 'Rodovias'], via2: ['L', null, '#d9b44a', 2.4, 'Estradas'], via3: ['L', null, '#ffffff', 1.8, 'Ruas e acessos'], trilha: ['L', null, '#a98b6a', 1.2, 'Estradas de terra'],
  ferro: ['L', null, '#6f6f6f', 1.6, 'Ferrovias'], ener: ['L', null, '#7a6ba8', 1.2, 'Linhas de energia']
};
var OSM_ORD = ['campo', 'mata', 'urb', 'ind', 'agua', 'pred', 'corr', 'rio', 'trilha', 'via3', 'via2', 'via1', 'ferro', 'ener'];
function osmCat(t) {
  var hw = t.highway, ww = t.waterway, lu = t.landuse, na = t.natural;
  if (na === 'water' || ww === 'riverbank' || lu === 'reservoir' || lu === 'basin' || t.water) return 'agua';
  if (ww === 'river' || ww === 'canal') return 'rio';
  if (ww === 'stream' || ww === 'ditch' || ww === 'drain') return 'corr';
  if (/^(motorway|trunk|primary)(_link)?$/.test(hw || '')) return 'via1';
  if (/^(secondary|tertiary)(_link)?$/.test(hw || '')) return 'via2';
  if (/^(unclassified|residential|service|road|living_street)$/.test(hw || '')) return 'via3';
  if (/^(track|path|footway|bridleway)$/.test(hw || '')) return 'trilha';
  if (t.railway && t.railway !== 'abandoned') return 'ferro';
  if (t.power === 'line' || t.power === 'minor_line') return 'ener';
  if (t.building) return 'pred';
  if (na === 'wood' || lu === 'forest' || na === 'scrub') return 'mata';
  if (/^(farmland|meadow|grass|orchard|plantation|farmyard|vineyard)$/.test(lu || '') || na === 'grassland') return 'campo';
  if (/^(residential|commercial|retail)$/.test(lu || '')) return 'urb';
  if (/^(industrial|quarry)$/.test(lu || '') || t.power === 'plant' || t.power === 'substation' || t.power === 'generator') return 'ind';
  return null;
}
function osmLer(txt) {
  var doc = new DOMParser().parseFromString(txt, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length || !doc.documentElement || doc.documentElement.localName !== 'osm') throw new Error('o arquivo não é um .osm (XML do OpenStreetMap)');
  var N = {}, w = [], lb = [], tg = function (el) { var o = {}; Array.prototype.forEach.call(el.getElementsByTagName('tag'), function (t) { o[t.getAttribute('k')] = t.getAttribute('v'); }); return o; }, r5 = function (v) { return Math.round(v * 1e5) / 1e5; };
  Array.prototype.forEach.call(doc.getElementsByTagName('node'), function (n) {
    var lo = +n.getAttribute('lon'), la = +n.getAttribute('lat'); N[n.getAttribute('id')] = [lo, la];
    if (n.getElementsByTagName('tag').length) { var t = tg(n); if (t.name && /^(city|town|village|hamlet|locality|suburb|neighbourhood|isolated_dwelling|farm)$/.test(t.place || '')) lb.push([t.name, r5(lo), r5(la), t.place]); }
  });
  Array.prototype.forEach.call(doc.getElementsByTagName('way'), function (el) {
    var t = tg(el), c = osmCat(t); if (!c) return;
    var k = [], pl = null; Array.prototype.forEach.call(el.getElementsByTagName('nd'), function (nd) { var q = N[nd.getAttribute('ref')]; if (!q) return; var x = r5(q[0]), y = r5(q[1]); if (pl && pl[0] === x && pl[1] === y) return; k.push(x, y); pl = [x, y]; });
    if (k.length >= 4) w.push([c, t.name || t.ref || '', k]);
  });
  if (!w.length && !lb.length) throw new Error('nenhuma rua, rio, mata ou outro elemento reconhecido no arquivo');
  return { w: w, lb: lb };
}
function osmBbox(M) { var b = M.bb, dx = (b[2] - b[0]) * 0.1, dy = (b[3] - b[1]) * 0.1; return [b[0] - dx, b[1] - dy, b[2] + dx, b[3] + dy].map(function (v) { return Math.round(v * 1e5) / 1e5; }); }
function osmImportar(p, tipo, f) {
  var fr = new FileReader();
  fr.onerror = function () { aviso('Não foi possível ler o arquivo.'); };
  fr.onload = function () {
    var O; try { O = osmLer(String(fr.result)); } catch (e) { return msgbox('AVISO!', 'Não foi possível usar o arquivo: ' + e.message + '.'); }
    O.dt = isoDia(E.day(new Date().toISOString().slice(0, 10))); O.arq = f.name;
    var partes = [], cur = [], tam = 0;
    O.w.forEach(function (x) { var t = JSON.stringify(x).length; if (tam + t > 200000 && cur.length) { partes.push(cur); cur = []; tam = 0; } cur.push(x); tam += t; });
    if (cur.length || !partes.length) partes.push(cur);
    if (partes.length > 12) return msgbox('AVISO!', 'A área baixada tem elementos demais para salvar (' + int(O.w.length) + '). Baixe só a área do empreendimento pelo link "Baixar dados da área".');
    var rz = mapaRaiz(p), ant = (p.mapas[tipo] || {}).osm;
    partes.forEach(function (w, i) { gravar(rz + '/' + tipo + '_osm' + (i ? '_' + (i + 1) : ''), i ? { w: w } : { w: w, lb: O.lb, dt: O.dt, arq: O.arq }); });
    if (ant) for (var i = partes.length + 1; i <= (ant.partes || 1); i++) gravar(rz + '/' + tipo + '_osm_' + i, null);
    p.mapas = Object.assign({}, p.mapas); p.mapas[tipo] = Object.assign({}, p.mapas[tipo], { osm: { partes: partes.length, n: O.w.length, dt: O.dt } }); salvarMeta(p);
    var M = S.mapCache && S.mapCache[p.id + '/' + tipo]; if (M) M.osm = O;
    S.v.mapa.semOsm = false; aviso('Fundo do OpenStreetMap carregado: ' + int(O.w.length) + ' elementos e ' + int(O.lb.length) + ' nomes de lugares.'); agendar();
  };
  fr.readAsText(f);
}
function osmRemover(p, tipo) {
  var inf = (p.mapas[tipo] || {}).osm; if (!inf) return;
  for (var i = 1; i <= (inf.partes || 1); i++) gravar(mapaRaiz(p) + '/' + tipo + '_osm' + (i > 1 ? '_' + i : ''), null);
  p.mapas = Object.assign({}, p.mapas); p.mapas[tipo] = Object.assign({}, p.mapas[tipo]); delete p.mapas[tipo].osm; salvarMeta(p);
  var M = S.mapCache && S.mapCache[p.id + '/' + tipo]; if (M) delete M.osm; agendar();
}
function osmSvg(M, P, tf) {
  var O = M.osm, b = osmBbox(M), x0 = P.x(b[0] - (b[2] - b[0]) * 3), y0 = P.y(b[3] + (b[3] - b[1]) * 3), x1 = P.x(b[2] + (b[2] - b[0]) * 3), y1 = P.y(b[1] - (b[3] - b[1]) * 3);
  var off = S.v.mapa.osmOff || {}, G = {}; OSM_ORD.forEach(function (c) { G[c] = []; });
  O.w.forEach(function (x) { if (G[x[0]] && !off[x[0]]) G[x[0]].push(x); });
  var pts = function (a, fecha) { var s = ''; for (var i = 0; i < a.length; i += 2) s += (i ? 'L' : 'M') + P.x(a[i]).toFixed(1) + ' ' + P.y(a[i + 1]).toFixed(1); return s + (fecha ? 'Z' : ''); };
  var out = '<rect x="' + x0.toFixed(0) + '" y="' + y0.toFixed(0) + '" width="' + (x1 - x0).toFixed(0) + '" height="' + (y1 - y0).toFixed(0) + '" fill="#f2efe9"/>';
  OSM_ORD.forEach(function (c) {
    var K = OSM_CAT[c], L = G[c]; if (!L.length) return;
    var d = L.map(function (x) { return pts(x[2], K[0] === 'A'); }).join('');
    if (K[0] === 'A') out += '<path class="osm" d="' + d + '" fill="' + K[1] + '"' + (K[2] ? ' stroke="' + K[2] + '" stroke-width="' + K[3] + '" vector-effect="non-scaling-stroke"' : ' stroke="none"') + '/>';
    else {
      if (/^via/.test(c)) out += '<path class="osm" d="' + d + '" fill="none" stroke="#b9ae9f" stroke-width="' + (K[3] + 1.6) + '" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>';
      out += '<path class="osm" d="' + d + '" fill="none" stroke="' + K[2] + '" stroke-width="' + K[3] + '" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"' + (c === 'trilha' ? ' stroke-dasharray="5 3"' : c === 'ener' ? ' stroke-dasharray="8 3 2 3"' : c === 'ferro' ? ' stroke-dasharray="7 4"' : '') + '/>';
    }
  });
  (O.lb || []).forEach(function (l) { if (off.lugar) return; var big = /city|town/.test(l[3]); out += '<text class="osm-t" x="' + P.x(l[1]).toFixed(1) + '" y="' + P.y(l[2]).toFixed(1) + '" font-size="' + (tf * (big ? 1.25 : 0.9)).toFixed(2) + '" text-anchor="middle">' + esc(l[0]) + '</text>'; });
  return '<g class="osm-g">' + out + '</g>';
}
function osmPainel(p, tipo, M, ed) {
  var V = S.v.mapa, b = osmBbox(M), area = (b[2] - b[0]) * (b[3] - b[1]), c = [(b[1] + b[3]) / 2, (b[0] + b[2]) / 2];
  var ver = 'https://www.openstreetmap.org/?minlon=' + b[0] + '&minlat=' + b[1] + '&maxlon=' + b[2] + '&maxlat=' + b[3];
  var dados = 'https://api.openstreetmap.org/api/0.6/map?bbox=' + b.join(','), inf = (p.mapas[tipo] || {}).osm;
  var s = '<h4>OpenStreetMap</h4><div class="mp-osm">';
  if (M.osmt) {
    s += '<label class="mp-cam"><input type="checkbox"' + (V.semOsmT ? '' : ' checked') + ' ' + h(function () { V.semOsmT = !V.semOsmT; agendar(); }) + '><i style="background:#f2efe9;border:1px solid #cfc6b8"></i><span>Mapa OpenStreetMap</span><em></em></label>' +
      (V.semOsmT ? '' : '<label class="mp-op"><span>Opacidade</span><input type="range" min="20" max="100" step="5" value="' + Math.round((V.opT == null ? 1 : V.opT) * 100) + '" aria-label="Opacidade do mapa OpenStreetMap" ' + h(function (el) { V.opT = (+el.value) / 100; var g = document.getElementById('osm-tiles'); if (g) g.setAttribute('opacity', V.opT); }) + '></label>') +
      '<small class="vz">Mapa gravado no projeto em ' + esc(fdate(E.day(M.osmt.dt))) + ' · zoom ' + M.osmt.z[0] + ' a ' + M.osmt.z[M.osmt.z.length - 1] + ' · © colaboradores do OpenStreetMap (ODbL)</small>';
  }
  s += '<a class="lk" target="_blank" rel="noopener" href="' + ver + '">Abrir a área no OpenStreetMap ↗</a>';
  if (M.osm) {
    var cnt = {}; M.osm.w.forEach(function (x) { cnt[x[0]] = (cnt[x[0]] || 0) + 1; }); V.osmOff = V.osmOff || {};
    s += '<label class="mp-cam"><input type="checkbox"' + (V.semOsm ? '' : ' checked') + ' ' + h(function () { V.semOsm = !V.semOsm; agendar(); }) + '><i style="background:#f2efe9;border:1px solid #cfc6b8"></i><span>Fundo OpenStreetMap</span><em></em></label>';
    if (!V.semOsm) s += '<div class="mp-osmc">' + OSM_ORD.filter(function (k) { return cnt[k]; }).map(function (k) { var K = OSM_CAT[k]; return '<label class="mp-cam sm"><input type="checkbox"' + (V.osmOff[k] ? '' : ' checked') + ' ' + h(function () { V.osmOff[k] = !V.osmOff[k]; agendar(); }) + '><i style="background:' + (K[1] || K[2]) + '"></i><span>' + K[4] + '</span><em>' + int(cnt[k]) + '</em></label>'; }).join('') +
      (M.osm.lb && M.osm.lb.length ? '<label class="mp-cam sm"><input type="checkbox"' + (V.osmOff.lugar ? '' : ' checked') + ' ' + h(function () { V.osmOff.lugar = !V.osmOff.lugar; agendar(); }) + '><i style="background:#3b3b3b"></i><span>Nomes de lugares</span><em>' + int(M.osm.lb.length) + '</em></label>' : '') + '</div>';
    s += '<small class="vz">Dados de ' + esc(fdate(E.day(M.osm.dt || (inf || {}).dt))) + ' · © colaboradores do OpenStreetMap (ODbL)</small>';
  }
  if (ed) s += '<ol class="mp-osm-p"><li><a class="lk" target="_blank" rel="noopener" href="' + dados + '">Baixar os dados da área ↗</a> e salve a página (Ctrl+S) como <b>.osm</b>' + (area > 0.25 ? ' <span class="pico">(área maior que o limite de 0,25 grau² da API)</span>' : '') + '</li>' +
    '<li><label class="lk">' + (M.osm ? 'Atualizar o fundo' : 'Inserir o arquivo .osm') + '<input type="file" accept=".osm,.xml,text/xml,application/xml" hidden ' + h(function (el) { var f = el.files && el.files[0]; el.value = ''; if (f) osmImportar(p, tipo, f); }) + '></label></li></ol>' +
    (M.osm ? '<button class="lk dn" ' + h(function () { confirma('Remover o fundo do OpenStreetMap deste mapa?', function () { osmRemover(p, tipo); }); }) + '>Remover fundo OSM</button>' : '');
  return s + '</div><div style="height:10px"></div>';
}

/* mapa OpenStreetMap gravado no projeto (blocos de imagem), desenhado sob o KMZ */
function osmVisivel(M, V) { return (M.osm && !V.semOsm) || (M.osmt && !V.semOsmT); }
function osmtLa(y, n) { var t = Math.PI * (1 - 2 * y / n); return Math.atan(Math.sinh(t)) * 180 / Math.PI; }
function osmtSvg(M, P, vb, mpp) {
  var T = M.osmt, zs = T.z, la = (M.bb[1] + M.bb[3]) / 2, base = 156543.034 * Math.cos(la * Math.PI / 180);
  var zi = Math.log(base / Math.max(mpp, 0.01)) / Math.LN2, zd = zs[0];
  zs.forEach(function (z) { if (z <= zi + 0.6) zd = z; });
  var mx = vb[2] * 0.5, my = vb[3] * 0.5, a0 = vb[0] - mx, a1 = vb[0] + vb[2] + mx, b0 = vb[1] - my, b1 = vb[1] + vb[3] + my;
  var lst = zd === zs[0] ? [zd] : [zs[0], zd], s = '', key = [];
  lst.forEach(function (z) {
    var m = T.m[z] || {}, n = Math.pow(2, z);
    Object.keys(m).forEach(function (k) {
      var q = k.split('_'), x = +q[0], y = +q[1], src = T.img[m[k]]; if (!src) return;
      var X0 = P.x(x / n * 360 - 180), X1 = P.x((x + 1) / n * 360 - 180), Y0 = P.y(osmtLa(y, n)), Y1 = P.y(osmtLa(y + 1, n));
      if (X1 < a0 || X0 > a1 || Y1 < b0 || Y0 > b1) return;
      var ew = (X1 - X0) * 0.004, eh = (Y1 - Y0) * 0.004;
      s += '<image href="' + src + '" x="' + (X0 - ew).toFixed(1) + '" y="' + (Y0 - eh).toFixed(1) + '" width="' + (X1 - X0 + 2 * ew).toFixed(1) + '" height="' + (Y1 - Y0 + 2 * eh).toFixed(1) + '" preserveAspectRatio="none"/>';
      if (z === zd) key.push(k);
    });
  });
  return { s: s, k: zd + ':' + key.join(',') };
}
function osmtAtualiza(svg, vb, mpp) {
  var V = S.v.mapa, M = V && V._M, g = document.getElementById('osm-tiles'); if (!M || !M.osmt || !g) return;
  var r = osmtSvg(M, mapaProj(M), vb, mpp); if (r.k === V._tk) return; V._tk = r.k; g.innerHTML = r.s;
}

/* ================= MAPA DE SUPRIMENTOS (Planejamento) =================
   Não tem base própria de quantidades ou datas: lê o cronograma (ramo de fornecimentos e atividades que consomem),
   as composições ligadas ao cronograma, as permanências (indiretos) e o calendário do projeto.
   Em p.sup ficam só as decisões e o acompanhamento: prazos por categoria, responsabilidade, fornecedor,
   status, datas informadas, quantidades informadas quando o projeto não as tem, histórico. */
var SUP_CAT = ['Civil', 'Elétrica', 'Fotovoltaica', 'Mecânica', 'Equipamentos de produção e apoio', 'Consumo e apoio', 'Serviços e contratações'];
var SUP_CATC = { 'Civil': '#8a6d3b', 'Elétrica': '#d98e04', 'Fotovoltaica': '#1769e8', 'Mecânica': '#5a6b85', 'Equipamentos de produção e apoio': '#2e9e5b', 'Consumo e apoio': '#8b5cf6', 'Serviços e contratações': '#0ea5a4' };
var SUP_RESP = ['Contratada', 'Contratante', 'Terceiros', 'Locação', 'Compartilhado', 'A definir'];
var SUP_RESPN = { 'Contratada': 'Fornecimento da contratada', 'Contratante': 'Fornecimento da contratante', 'Terceiros': 'Fornecimento de terceiros', 'Locação': 'Locação', 'Compartilhado': 'Fornecimento compartilhado', 'A definir': 'A definir' };
var SUP_ST = ['Não iniciado', 'Em planejamento', 'Aguardando cotação', 'Em processo de cotação', 'Aguardando aprovação', 'Aguardando contratação', 'Pedido emitido', 'Em fabricação', 'Aguardando expedição', 'Em transporte', 'Entregue parcialmente', 'Entregue', 'Em inspeção', 'Liberado para utilização', 'Atrasado', 'Bloqueado', 'Cancelado'];
var SUP_PZ = [['cot', 'Cotação'], ['apr', 'Aprovação'], ['ctr', 'Contratação / pedido'], ['fab', 'Fabricação'], ['tra', 'Transporte'], ['ins', 'Inspeção e recebimento'], ['lib', 'Integração / liberação']];
var SUP_CRIT = ['Crítica', 'Alta', 'Média', 'Baixa', 'Indefinida', 'Concluído'];
var SUP_CRITC = { 'Crítica': 'sp-cr', 'Alta': 'sp-al', 'Média': 'sp-me', 'Baixa': 'sp-ba', 'Indefinida': 'sp-in', 'Concluído': 'sp-ok' };
var SUP_ORIG = { CRO: 'Cronograma (fornecimentos)', CPU: 'Composições (CPU)', PER: 'Permanências (indiretos)', MAN: 'Inserido no mapa', SUG: 'Sugestão UFV (confirmar)' };
var SUP_AL = {
  LIM_VENC: 'Data-limite de recebimento vencida', LIM_PROX: 'Data-limite de recebimento próxima', NAO_CONTR: 'Ainda não contratado', PED_VENC: 'Prazo para emitir o pedido vencido',
  FAB: 'Em fabricação', PREV_VENC: 'Entrega programada vencida sem recebimento', ENT_APOS: 'Entrega prevista depois da data-limite', QTD_INS: 'Quantidade pedida/recebida insuficiente', PARCIAL: 'Entrega parcial',
  SEM_FORN: 'Sem fornecedor definido', CTE_CONF: 'Contratante sem confirmação de disponibilidade', ATV_CRIT: 'Atividade crítica (folga ≤ 1 dia)', CAM_CRIT: 'Pode impactar o caminho crítico',
  PZ_PEND: 'Prazos de suprimento pendentes', QTD_PEND: 'Quantidade pendente', VINC_PEND: 'Sem atividade vinculada'
};
var SUP_STOP = { DE: 1, DA: 1, DO: 1, DOS: 1, DAS: 1, E: 1, EM: 1, PARA: 1, COM: 1, A: 1, O: 1, AS: 1, OS: 1, FORNECIMENTO: 1, AQUISICAO: 1, COMPRA: 1, ENTREGA: 1, RECEBIMENTO: 1 };
var SUP_SIN = { INVERTER: 'INVERSOR', INVERTERS: 'INVERSOR', SUB: 'SUBTERRANEA', SUBT: 'SUBTERRANEA', PILES: 'ESTACA', MODULES: 'MODULO', TRACK: 'TRACKER', SKIDS: 'SKID' };
var SUP_OPC = { STRING: 1, FORCA: 1, SUBTERRANEA: 1, GERAL: 1, PRINCIPAL: 1 };
var SUP_GEN = { CABO: 1, MATERIAL: 1, MATERIAI: 1, EQUIPAMENTO: 1, ITEN: 1, ACESSORIO: 1 };
var SUP_VERBO = /MONTAG|DISTRIBU|POSICION|LANCAMENT|INSTALA|CRAVA|TERMINAC|IMPLANT|INTERCONEX|APLICAC|ASSENT|FIXAC|ERGU|IÇAM|ICAMENT|LIGAC|ENTERRAMENT|COLOCAC|ESPALHAMENT|EXECUC/;
var SUP_FORA = /^(EMISSAO|APROVACAO|REVISAO|ANALISE)\b|COMISSIONAMENTO|\bTESTE|ENSAIO|INSPECAO|TERMOGRAF|CURVA IXV|DATABOOK|AS BUILT|PUNCHLIST/;
function supHoje() { return E.day(new Date().toISOString().slice(0, 10)); }
function supDados(p) { var s = p.sup || {}; s.cfg = s.cfg || {}; s.cfg.cat = s.cfg.cat || {}; s.cfg.resp = s.cfg.resp || {}; s.it = s.it || {}; s.man = s.man || []; s.sn = s.sn || {}; s.hist = s.hist || []; return s; }
function supEd(p) { if (!p.sup) p.sup = {}; return supDados(p); }
function supSalvar(p) { S._supVer = (S._supVer || 0) + 1; salvarMeta(p); }
function supNum(v) { return v === '' || v == null || isNaN(+v) ? null : +v; }
/* ---------- texto: tokens, frentes e nomes ---------- */
function supStem(w) { w = SUP_SIN[w] || w; if (w.length > 4) w = w.replace(/(OES|AES)$/, 'AO').replace(/(ES)$/, w.length > 6 ? '' : 'ES').replace(/S$/, ''); return SUP_SIN[w] || w; }
function supTok(s) { return semAcento(s).replace(/[^A-Z0-9]+/g, ' ').trim().split(' ').filter(function (w) { return w && !SUP_STOP[w] && !/^\d+$/.test(w); }).map(supStem); }
var SUP_FR = /\b(SPE|SPGA|MAR|PARQUE|SUBPARQUE|BLOCO|SETOR|USINA|UFV)[ .\-_]?0*(\d{1,3})\b/;
function supFrente(t) { var s = semAcento((t.n || '') + ' ' + (t.sp || '')), m = SUP_FR.exec(s); if (!m) return ''; var pre = m[1] === 'SPGA' ? 'SPE' : m[1]; return pre + ('0' + m[2]).slice(-2); }
function supSemFrente(s) { return String(s || '').replace(/\b(SPE|SPGA|MAR|PARQUE|SUBPARQUE|BLOCO|SETOR)[ .\-_]?\d{1,3}(\.\d+)*\b/ig, ' '); }
function supNomeLimpo(n) {
  var partes = supSemFrente(n).split('|').map(function (x) { return x.replace(/\bfornecimento\s*(de|do|da|dos|das)?\b/ig, ' ').replace(/\s+/g, ' ').trim(); }).filter(Boolean);
  if (!partes.length) return String(n || '').trim();
  return partes.join(' – ').replace(/\s*\.\s*$/, '');
}
function supBase(n) { return supTok(supNomeLimpo(n)).join(' '); }
function supCasa(itens, alvo) { /* todos os tokens obrigatórios do item aparecem na atividade */
  return itens.every(function (x) { return alvo.some(function (y) { return x === y || (x.length >= 2 && y.indexOf(x) === 0) || (y.length >= 4 && x.indexOf(y) === 0); }); });
}
function supCat(nome, tipo) {
  var s = ' ' + semAcento(nome) + ' ';
  if (tipo === 'EQ') return 'Equipamentos de produção e apoio';
  if (/MODULO|TRACKER|INVERSOR|INVERTER|ELETROCENTRO|STRING BOX|\bSKID|FOTOVOLT|\bNCU\b|ESTACAS?\b|SOLARIMETR|METEOROLOG|SCADA|MONITORAMENTO|PPC\b/.test(s)) return 'Fotovoltaica';
  if (/\bCABO|ELETRODUT|ELETROCALHA|DISJUNT|SECCIONA|TRANSFORMADOR|QUADRO|PAINE(L|IS) (DE|ELETR)|ATERRAMENTO|SPDA|PARA-?RAIO|CONECTOR|TERMINAC|TERMINAL|MUFLA|POSTE|CRUZETA|ISOLADOR|LUMINARIA|TOMADA|INTERRUPTOR|FIBRA|\bFO\b|\bRMT\b|MEDIDOR|\bRELE\b|CFTV|\bBT\b|\bMT\b/.test(s)) return 'Elétrica';
  if (/PARAFUSO|PORCA|ARRUELA|BARRA ROSC|CHUMBADOR|PERFIL|CANTONEIRA|CHAPA|SOLDA|ELETRODO|LUBRIFIC|GRAXA|HIDRAUL|PNEUMAT|ABRACADEIRA|ESTRUTURA (METAL|PARA FIX)|GALVANIZ|ROLAMENTO|MANCAL/.test(s)) return 'Mecânica';
  if (/\bEPI\b|\bEPC\b|LUVA|CAPACETE|\bBOTA|OCULOS|PROTETOR|UNIFORME|SINALIZ|\bCONE\b|FITA ZEBRA|LIMPEZA|MATERIA(L|IS) DE ESCRITORIO|\bPAPEL|TONER|AGUA MINERAL|CONSUMIVE|EXTINTOR|PRIMEIROS SOCORROS/.test(s)) return 'Consumo e apoio';
  if (tipo === 'SER') return 'Serviços e contratações';
  return 'Civil';
}
function supRespTxt(txt, p) {
  var s = ' ' + semAcento(txt).replace(/[^A-Z0-9]+/g, ' ') + ' ', nomes = [], ct = p.contratante || {};
  [ct.razao, ct.fantasia, ct.nome].forEach(function (n) { if (n) nomes.push(n); });
  (S.clientes || []).forEach(function (c) { if (c.papel === 'CONTRATANTE') [c.fantasia, c.razao].forEach(function (n) { if (n) nomes.push(n); }); });
  var tem = function (n) { n = semAcento(n).replace(/[^A-Z0-9]+/g, ' ').replace(/\b(S ?A|LTDA|ME|EPP|GRUPO|ENERGIA|ENERGIAS)\b/g, ' ').replace(/\s+/g, ' ').trim(); return n.length >= 4 && s.indexOf(' ' + n + ' ') >= 0; };
  if (/ CONTRATANTE | CLIENTE | OWNER | PROPRIETARI/.test(s) || nomes.some(tem)) return 'Contratante';
  if (/ CONSORCIO | CONTRATADA | EPCISTA | EPC /.test(s)) return 'Contratada';
  if (/ LOCACAO | ALUGUEL /.test(s)) return 'Locação';
  if (/ TERCEIRO/.test(s)) return 'Terceiros';
  return '';
}
/* ---------- datas: dias úteis pelo calendário do cronograma ---------- */
function supUtil(p) { var w = p._cro ? (p._croWt || (p._croWt = croCalendario(p))) : null; return function (D) { return w ? w(D + 1) - w(D) > 0 : ((E.weekday(D) + 6) % 7) < 5; }; }
function supMenos(D, n, util, ehUtil) {
  if (D == null || n == null) return null; D = Math.floor(D); n = Math.round(n);
  if (!util) return D - n;
  var k = 0, d = D; while (k < n && D - d < 4000) { d--; if (ehUtil(d)) k++; } return d;
}
function supMais(D, n, util, ehUtil) {
  if (D == null || n == null) return null; D = Math.floor(D); n = Math.round(n);
  if (!util) return D + n;
  var k = 0, d = D; while (k < n && d - D < 4000) { d++; if (ehUtil(d)) k++; } return d;
}
/* ---------- folga total das atividades (passagem de volta pelas predecessoras, em dias úteis do calendário) ---------- */
function supFolgas(p, R) {
  if (R._folga) return R._folga;
  var w = p._croWt || (p._croWt = croCalendario(p)), L = R.leaves, by = R.by, F = Object.create(null), es = {}, ef = {}, lf = {}, fim = -Infinity, cache = {};
  var folhas = function (u) { if (cache[u]) return cache[u]; var t = by[u]; if (!t) return []; if (!t.s) return (cache[u] = [t]); var o = []; (R.kids[u] || []).forEach(function (k) { o = o.concat(folhas(k.u)); }); return (cache[u] = o); };
  L.forEach(function (t) { var a = dn(t.i), b = dn(t.f); if (a == null || b == null) return; es[t.u] = w(a); ef[t.u] = w(b); if (ef[t.u] > fim) fim = ef[t.u]; });
  var suc = Object.create(null);
  R.leaves.concat(Object.keys(by).map(function (u) { return by[u]; }).filter(function (t) { return t.s; })).forEach(function (t) {
    (t.pr || []).forEach(function (r) {
      var lag = num(r[2]) / 480, tipo = r[1] || 'FS', ps = folhas(r[0]), ss = folhas(t.u);
      ps.forEach(function (pt) { (suc[pt.u] = suc[pt.u] || []).push([ss, tipo, lag]); });
    });
  });
  L.forEach(function (t) { if (es[t.u] != null) lf[t.u] = fim; });
  var ordem = L.filter(function (t) { return es[t.u] != null; }).sort(function (a, b) { return es[b.u] - es[a.u]; });
  for (var it = 0; it < 12; it++) {
    var mudou = false;
    ordem.forEach(function (t) {
      var S0 = suc[t.u]; if (!S0) return; var d = ef[t.u] - es[t.u], v = lf[t.u];
      S0.forEach(function (x) {
        x[0].forEach(function (s) {
          if (lf[s.u] == null) return; var ls = lf[s.u] - (ef[s.u] - es[s.u]), c;
          /* relação já violada nas datas do cronograma (restrição, progresso fora de sequência): não dirige a folga */
          var viol = x[1] === 'FS' ? es[s.u] < ef[t.u] + x[2] - 0.13 : x[1] === 'SS' ? es[s.u] < es[t.u] + x[2] - 0.13 : x[1] === 'FF' ? ef[s.u] < ef[t.u] + x[2] - 0.13 : ef[s.u] < es[t.u] + x[2] - 0.13;
          if (viol) return;
          if (x[1] === 'FS') c = ls - x[2]; else if (x[1] === 'SS') c = ls - x[2] + d; else if (x[1] === 'FF') c = lf[s.u] - x[2]; else c = lf[s.u] - x[2] + d;
          if (c < v) v = c;
        });
      });
      if (v < lf[t.u] - 0.001) { lf[t.u] = v; mudou = true; }
    });
    if (!mudou) break;
  }
  L.forEach(function (t) { if (lf[t.u] != null) F[t.u] = lf[t.u] - ef[t.u]; });
  R._folga = F; return F;
}
/* ---------- montagem do mapa ---------- */
function supCalc(p) {
  var R = p.crono && p._cro ? croCalc(p) : null, D = supDados(p), hoje = supHoje();
  var chave = [R, S._supVer || 0, hoje, (S.clientes || []).length].join('|');
  if (p._supC && p._supC.k === chave && p._supC.R === R) return p._supC.M;
  var util = (D.cfg.modo || 'U') === 'U', ehUtil = supUtil(p), itens = [], porK = {};
  var folga = R ? supFolgas(p, R) : {};
  var novo = function (k, o) { var I = Object.assign({ k: k, lin: [], lotes: [], cons: [], q: null, u: '', cod: '', nome: '', orig: '', cat: '', resp: '', eap: '', obs: [] }, o); porK[k] = I; itens.push(I); return I; };
  var macroDe = function (t) { if (!R) return null; var u = R.lm[t.u]; return u != null ? R.by[u] : R.by[t.p]; };
  var ehForn = Object.create(null);
  /* 1) fornecimentos programados no cronograma */
  var consumidores = [];
  if (R) {
    var T = p._cro.tasks, kids = R.kids;
    var cand = function (t) { var s = semAcento(t.n); return /FORNECIMENTO/.test(s) && !SUP_FORA.test(s.trim()); };
    var marcaForn = function (t) { ehForn[t.u] = 1; (kids[t.u] || []).forEach(marcaForn); };
    var visita = function (t) {
      if (!cand(t)) { (kids[t.u] || []).forEach(visita); return; }
      var ks = kids[t.u] || [], b = supBase(t.n);
      var soLotes = ks.length && ks.every(function (k) { return !k.s && supBase(k.n) === b; });
      if (!t.s || soLotes) {
        marcaForn(t); var anc = [], x = t; while (x) { anc.push(x.n); x = R.by[x.p]; }
        var I = novo('R:' + t.u, { orig: 'CRO', nome: supNomeLimpo(t.n), cod: t.w, eap: t.w + ' ' + t.n, base: b, tk: supTok(supNomeLimpo(t.n)), respAuto: anc.map(function (n) { return supRespTxt(n, p); }).filter(Boolean)[0] || '' });
        (t.s ? ks : [t]).forEach(function (k) { I.lotes.push({ t: k, fr: supFrente(k), ini: dn(k.i), fim: dn(k.f), pc: realDe(k), as: dn(k.as), af: dn(k.af) }); });
        return;
      }
      ks.forEach(visita);
    };
    T.filter(function (t) { return !R.by[t.p]; }).forEach(visita);
    R.leaves.forEach(function (t) { if (ehForn[t.u] || t.m || !(num(t.dm) > 0)) return; var s = semAcento(t.n); if (SUP_FORA.test(s.trim())) return; var pai = R.by[t.p], avo = pai && R.by[pai.p], ctx0 = [t.n, pai && pai.l > 1 ? pai.n : '', avo && avo.l > 1 ? avo.n : ''].join(' | '); consumidores.push({ t: t, tkL: supTok(supSemFrente(t.n)), tk: supTok(supSemFrente(ctx0)), v: SUP_VERBO.test(s), fr: supFrente(t), i: dn(t.i), f: dn(t.f) }); });
  }
  var ligar = function (I, tk) {
    if (!tk || !tk.length) return;
    var obr = tk.filter(function (x) { return !SUP_OPC[x]; }); if (!obr.length) obr = tk;
    var o2 = obr.filter(function (x) { return !SUP_GEN[x]; }), achou = [];
    [['tkL', obr], ['tkL', o2], ['tk', obr], ['tk', o2]].some(function (z) { if (!z[1].length || (z[1] === o2 && o2.length === obr.length)) return false; achou = consumidores.filter(function (c) { return supCasa(z[1], c[z[0]]); }); return achou.length > 0; });
    var comVerbo = achou.filter(function (c) { return c.v; }); if (comVerbo.length) achou = comVerbo;
    I.cons = achou.map(function (c) { return { t: c.t, fr: c.fr, i: c.i, f: c.f, q: null, bc: num(c.t.bc) }; });
  };
  itens.forEach(function (I) { var o = D.it[I.k] || {}; ligar(I, o.kw ? supTok(o.kw) : I.tk); });
  /* 2) insumos das composições ligadas ao cronograma (quantidade e data por tarefa) */
  if (R) {
    var C = p._cro, X = R.X;
    Object.keys(C.cpus.links).forEach(function (u) {
      var Lk = C.cpus.links[u] || [], m = R.by[u]; if (!m || !Lk.length) return;
      var lv = R.porMacro[u] && R.porMacro[u].length ? R.porMacro[u] : [m], tb = lv.reduce(function (a, t) { return a + num(t.bc); }, 0);
      var add = function (c, mult, nv) {
        if (!c || nv > 20) return;
        cpuCalc(c, X).it.forEach(function (r) {
          var q = mult * num(r.k); if (!q) return;
          if (r.x.t === 'AUX') return add(X.by[r.x.i], q, nv + 1);
          var t0 = r.x.t; if (t0 === 'MO' || t0 === 'OUT') return;
          var e = r.e, k = 'C:' + (e ? e.id : r.cod), I = porK[k];
          if (!I) I = novo(k, { orig: 'CPU', nome: r.nome, cod: e ? (e.co || e.c || e.id) : r.cod, u: t0 === 'EQ' ? 'h' : r.u, tipo: t0, q: 0, cat: '' });
          lv.forEach(function (t) { var f = tb ? num(t.bc) / tb : 1 / lv.length, qq = q * f; if (!qq) return; I.q += qq; I.cons.push({ t: t, fr: supFrente(t), i: dn(t.i), f: dn(t.f), q: qq, bc: num(t.bc), cpu: c.c }); });
        });
      };
      Lk.forEach(function (l) { add(X.by[l.c], num(l.q), 0); });
    });
  }
  /* 3) permanências (custo indireto do próprio projeto) */
  try {
    if (p.atividades && p.atividades.length) {
      var cc = calc(p), gera = {}; p.atividades.forEach(function (a) { if (a.cro) gera[a.id] = 1; });
      cc.res.rows.forEach(function (r) {
        if (gera[r.ativ] || !(r.c === 2 || r.c === 3 || r.c === 4 || r.c === 5) || !num(r.total)) return;
        var nm = r.c === 2 ? r.d : r.d2, k = 'P:' + r.c + ':' + nm, I = porK[k];
        if (!I) I = novo(k, { orig: 'PER', nome: nm, cod: 'IND', u: r.c === 2 ? 'un.·mês' : r.u, tipo: r.c === 2 ? 'EQ' : 'MAT', q: 0, per: {} });
        var d0 = miIni(r.mi); I.q += num(r.total); I.per[r.mi] = (I.per[r.mi] || 0) + num(r.total);
        I.cons.push({ t: { n: r.atividade || r.equipe || 'Indireto', w: 'IND', sc: '' }, fr: '', i: d0, f: miIni(r.mi + 1) - 1, q: num(r.total), ind: 1 });
      });
    }
  } catch (e) { console.error(e); }
  /* 4) inseridos no mapa e sugestões de fornecimento da contratante em usinas solares */
  D.man.forEach(function (m) { var I = novo('M:' + m.id, { orig: 'MAN', nome: m.nome, cod: m.cod || 'MAN-' + m.id, u: m.u || '', cat: m.cat || '', tk: supTok(m.kw || m.nome), respAuto: m.resp || '' }); ligar(I, supTok(((D.it[I.k] || {}).kw) || m.kw || m.nome)); if (!I.cons.length && m.dn) I.cons.push({ t: { n: 'Data informada', w: '' }, fr: '', i: E.day(m.dn), f: E.day(m.dn) }); });
  if (R && (p.categoria === 'UFV' || tipoCat(p.tipo) === 'UFV')) {
    [['TRK', 'Trackers', 'TRACKER'], ['MOD', 'Módulos fotovoltaicos', 'MODULO'], ['INV', 'Inversores', 'INVERSOR'], ['ELC', 'Eletrocentros', 'ELETROCENTRO']].forEach(function (s) {
      var tem = itens.some(function (I) { return (I.orig === 'CRO' || I.orig === 'MAN') && (I.tk || []).some(function (x) { return x.indexOf(s[2]) === 0; }); });
      if (tem || (D.it['S:' + s[0]] || {}).off) return;
      var I = novo('S:' + s[0], { orig: 'SUG', nome: s[1], cod: 'UFV-' + s[0], u: 'un.', tk: [s[2]], respAuto: 'Contratante' }); ligar(I, supTok(((D.it[I.k] || {}).kw) || s[2]));
    });
  }
  /* ---------- cálculo por item ---------- */
  itens.forEach(function (I) {
    var o = D.it[I.k] || {}, cat = o.cat || I.cat || supCat(I.nome, I.tipo); I.cat = cat;
    I.resp = o.resp || D.cfg.resp[cat] || I.respAuto || (I.orig === 'CPU' && I.tipo !== 'EQ' ? 'Contratada' : 'A definir');
    I.respOrigem = o.resp ? 'informada' : D.cfg.resp[cat] ? 'padrão da categoria' : I.respAuto ? 'identificada no cronograma' : I.orig === 'CPU' && I.tipo !== 'EQ' ? 'composição da contratada' : '';
    if (o.q != null && o.q !== '') { I.qInf = true; I.q = +o.q; } else if ((I.orig === 'CRO' || I.orig === 'MAN' || I.orig === 'SUG') && I.q == null) I.q = null;
    if (I.orig === 'MAN') { var mm = D.man.filter(function (m) { return 'M:' + m.id === I.k; })[0]; if (mm && I.q == null && mm.q != null && mm.q !== '') I.q = +mm.q; }
    if (o.u) I.u = o.u;
    I.modo = o.modo || (I.tipo === 'EQ' || I.orig === 'CRO' || I.orig === 'SUG' ? 'I' : 'P');
    I.forn = o.forn || ''; I.dtPed = o.dtPed ? E.day(o.dtPed) : null; I.qPed = supNum(o.qPed); I.dtLib = o.dtLib ? E.day(o.dtLib) : null; I.conf = o.conf ? E.day(o.conf) : null; I.nota = o.obs || '';
    I.dtPrevI = o.dtPrev ? E.day(o.dtPrev) : null; I.dtRecI = o.dtRec ? E.day(o.dtRec) : null;
    /* prazos: item › categoria; vazio = pendente */
    var dc = D.cfg.cat[cat] || {}, oz = o.pz || {}; I.pz = {}; I.pzPend = [];
    SUP_PZ.forEach(function (z) { var v = supNum(oz[z[0]]); if (v == null) v = supNum(dc[z[0]]); I.pz[z[0]] = v; if (v == null) I.pzPend.push(z[1]); });
    I.mg = supNum(o.mg); if (I.mg == null) I.mg = supNum(D.cfg.margem); if (I.mg == null) I.pzPend.push('Margem de segurança');
    /* frentes: consumo e lotes */
    var fr = {}; I.cons.forEach(function (c) { (fr[c.fr] = fr[c.fr] || { fr: c.fr, cons: [], lotes: [] }).cons.push(c); });
    var lotG = I.lotes.filter(function (l) { return !l.fr; });
    I.lotes.forEach(function (l) { if (l.fr) (fr[l.fr] = fr[l.fr] || { fr: l.fr, cons: [], lotes: [] }).lotes.push(l); });
    if (!Object.keys(fr).length && I.lotes.length) fr[''] = { fr: '', cons: [], lotes: [] };
    var todos = I.cons.slice().sort(function (a, b) { return a.i - b.i; });
    var bcTot = I.cons.reduce(function (a, c) { return a + num(c.bc); }, 0);
    I.fr = Object.keys(fr).map(function (k) {
      var F = fr[k], cs = F.cons.length ? F.cons : todos, c0 = cs.slice().sort(function (a, b) { return a.i - b.i; })[0];
      if (!c0) return { fr: k, cons: [], lotes: F.lotes, nec: null };
      var nec = I.modo === 'I' || !c0 ? Math.floor(c0.i) : Math.floor(c0.i), fimC = Math.max.apply(null, cs.map(function (c) { return c.f || c.i; }));
      var qF = I.orig === 'CPU' || I.orig === 'PER' ? F.cons.reduce(function (a, c) { return a + num(c.q); }, 0) : I.q != null && bcTot ? I.q * F.cons.reduce(function (a, c) { return a + num(c.bc); }, 0) / bcTot : null;
      var x = { fr: k, cons: F.cons, lotes: F.lotes, c0: c0, nec: nec, fimC: Math.floor(fimC), q: qF, folga: c0.t.u != null ? folga[c0.t.u] : null };
      var a = I.pz, rec = a.ins != null && a.lib != null && I.mg != null ? a.ins + a.lib + I.mg : null;
      x.lRec = rec == null ? null : supMenos(nec, rec, util, ehUtil);
      x.lPed = x.lRec == null || a.fab == null || a.tra == null ? null : supMenos(x.lRec, a.fab + a.tra, util, ehUtil);
      x.lAq = x.lPed == null || a.cot == null || a.apr == null || a.ctr == null ? null : supMenos(x.lPed, a.cot + a.apr + a.ctr, util, ehUtil);
      /* previsto e realizado */
      var lt = (F.lotes.length ? F.lotes : lotG).slice().sort(function (a2, b2) { return (a2.fim || 0) - (b2.fim || 0); });
      x.pcL = lt.length ? lt.reduce(function (a2, l) { return a2 + num(l.pc); }, 0) / lt.length : null;
      x.prev = I.dtPrevI || (lt.length ? Math.floor(lt[lt.length - 1].fim) : null);
      x.prevOrig = I.dtPrevI ? 'informada' : lt.length ? 'cronograma' : '';
      x.rec = lt.length && x.pcL >= 99.95 ? Math.floor(Math.max.apply(null, lt.map(function (l) { return l.af || l.fim; }))) : null;
      if (!lt.length && x.rec == null) { var ini = F.cons.filter(function (c) { return c.t.u != null && realDe(c.t) > 0; }); if (ini.length) { x.atend = true; x.rec = Math.floor(Math.min.apply(null, ini.map(function (c) { return dn(c.t.as) || c.i; }))); } }
      return x;
    }).filter(function (x) { return x.nec != null || x.lotes.length; }).sort(function (a, b) { return (a.nec == null ? 1e9 : a.nec) - (b.nec == null ? 1e9 : b.nec) || cpuOrd(a.fr, b.fr); });
    var Fn = I.fr.filter(function (x) { return x.nec != null; }), F0 = Fn.filter(function (x) { return x.rec == null; })[0] || Fn[0] || null; I.F0 = F0; I.nec1 = Fn.length ? Fn[0].nec : null;
    I.nec = F0 ? F0.nec : null; I.lRec = F0 ? F0.lRec : null; I.lPed = F0 ? F0.lPed : null; I.lAq = F0 ? F0.lAq : null;
    I.ativIni = I.cons.length ? Math.floor(Math.min.apply(null, I.cons.map(function (c) { return c.i; }))) : null;
    I.ativFim = I.cons.length ? Math.floor(Math.max.apply(null, I.cons.map(function (c) { return c.f || c.i; }))) : null;
    I.lead = I.pzPend.length ? null : SUP_PZ.reduce(function (a, z) { return a + I.pz[z[0]]; }, 0) + I.mg;
    I.frentes = I.fr.map(function (x) { return x.fr; }).filter(Boolean);
    var ativs = {}; I.cons.forEach(function (c) { var m = c.ind ? null : macroDe(c.t); var nm = m ? m.n : c.t.n; ativs[nm] = (ativs[nm] || 0) + 1; }); I.ativs = Object.keys(ativs);
    var m0 = F0 && !F0.c0.ind ? macroDe(F0.c0.t) : null; I.ativ0 = F0 ? (m0 ? m0.n : F0.c0.t.n) : ''; I.eapAt = m0 ? m0.w : F0 ? F0.c0.t.w || '' : '';
    /* quantidades recebidas */
    var pcG = I.lotes.length ? I.lotes.reduce(function (a, l) { return a + num(l.pc); }, 0) / I.lotes.length : null, viaAt = false;
    if (pcG == null && supNum(o.qRec) == null && I.fr.some(function (x) { return x.atend; })) { var qa = 0, qt = 0; I.fr.forEach(function (x) { var w0 = x.q != null ? x.q : 1; qt += w0; if (x.atend) qa += w0; }); pcG = qt ? qa / qt * 100 : 0; viaAt = true; }
    I.qRec = supNum(o.qRec); I.qRecOrig = I.qRec != null ? 'informada' : '';
    if (I.qRec == null && pcG != null && I.q != null) { I.qRec = I.q * pcG / 100; I.qRecOrig = viaAt ? 'atividades já iniciadas no cronograma' : 'avanço do cronograma'; }
    I.viaAt = viaAt;
    I.pcRec = pcG != null ? pcG : I.q && I.qRec != null ? Math.min(100, I.qRec / I.q * 100) : I.qRec ? 0 : 0;
    I.saldo = I.q != null && I.qRec != null ? Math.max(0, I.q - I.qRec) : I.q;
    I.dtRec = I.dtRecI || (I.lotes.length && pcG >= 99.95 ? Math.floor(Math.max.apply(null, I.lotes.map(function (l) { return l.af || l.fim; }))) : viaAt && pcG >= 99.95 ? Math.max.apply(null, I.fr.map(function (x) { return x.rec || 0; })) : null);
    I.dtPrev = I.dtPrevI || (I.lotes.length ? Math.floor(Math.max.apply(null, I.lotes.filter(function (l) { return realDe(l.t) < 99.95; }).map(function (l) { return l.fim; }).concat([0]))) || null : null);
    I.prevOrig = I.dtPrevI ? 'informada' : I.lotes.length ? 'cronograma' : '';
    /* status efetivo */
    var auto = pcG != null ? (pcG >= 99.95 ? 'Entregue' : pcG > 0 ? 'Entregue parcialmente' : '') : I.q && I.qRec != null ? (I.qRec >= I.q - 1e-9 ? 'Entregue' : I.qRec > 0 ? 'Entregue parcialmente' : '') : '';
    var man = o.st || '', ix = function (s) { return SUP_ST.indexOf(s); };
    var st = man || (auto ? auto : I.dtPed ? 'Pedido emitido' : 'Não iniciado');
    if (auto && (ix(auto) > ix(man) || ['Atrasado', 'Bloqueado'].indexOf(man) >= 0) && man !== 'Cancelado' && !(man === 'Em inspeção' && auto === 'Entregue')) st = auto;
    if (I.dtLib) st = 'Liberado para utilização';
    I.st = st; I.stAuto = !man || st !== man;
    I.recebido = ['Entregue', 'Em inspeção', 'Liberado para utilização'].indexOf(st) >= 0;
    I.cancel = st === 'Cancelado';
    I.contratado = I.dtPed != null || (ix(st) >= ix('Pedido emitido') && ix(st) <= ix('Liberado para utilização')) || (pcG != null && pcG > 0);
    if (I.recebido && !I.dtRec) I.dtRec = I.dtRecI;
    /* folga, criticidade e alertas (pela frente mais restritiva ainda não recebida) */
    var al = [], cte = I.resp === 'Contratante', ab = I.fr.filter(function (x) { return x.nec != null && x.rec == null && !I.recebido; });
    var pior = null;
    ab.forEach(function (x) {
      var lim = x.lRec != null ? x.lRec : null;
      x.prevVenc = x.prev != null && x.prev < hoje;
      var pe = x.prev != null ? Math.max(x.prev, hoje) : null;
      x.desv = pe != null && lim != null ? lim - pe : null;
      x.desvNec = pe != null ? x.nec - pe : null;
      var nv = 'Baixa', mot = '';
      if (pe != null && pe > x.nec) { nv = 'Crítica'; mot = x.prevVenc ? 'entrega programada vencida sem recebimento e a necessidade já passou' : 'entrega prevista depois da necessidade'; }
      else if (x.desv != null && x.desv < 0) { nv = 'Crítica'; mot = 'entrega prevista depois da data-limite'; }
      else if (x.desv != null && x.prevVenc && x.desv <= num(D.cfg.alerta == null ? 15 : D.cfg.alerta)) { nv = 'Alta'; mot = 'entrega programada vencida sem recebimento registrado'; }
      else if (!I.contratado && !cte && x.lPed != null && hoje > x.lPed) { nv = pe != null ? 'Alta' : 'Crítica'; mot = pe != null ? 'pedido não registrado (há entrega programada)' : 'pedido não registrado até a data-limite'; }
      else if (!I.contratado && !cte && x.lAq != null && hoje > x.lAq) { nv = 'Alta'; mot = 'aquisição deveria ter começado'; }
      else if (lim != null && hoje > lim) { nv = 'Alta'; mot = 'data-limite de recebimento vencida'; }
      else if (cte && !I.conf && lim != null && lim - hoje <= num(D.cfg.alerta == null ? 15 : D.cfg.alerta)) { nv = 'Alta'; mot = 'contratante sem confirmação perto da data-limite'; }
      else if (x.desv != null && x.desv <= num(D.cfg.alerta == null ? 15 : D.cfg.alerta)) { nv = 'Média'; mot = 'pouca folga entre a entrega prevista e a data-limite'; }
      else if (!I.contratado && !cte && x.lAq != null && x.lAq - hoje <= num(D.cfg.alerta == null ? 15 : D.cfg.alerta)) { nv = 'Média'; mot = 'início da aquisição próximo'; }
      else if (lim == null && x.prev == null) { nv = 'Indefinida'; mot = 'prazos ou entrega prevista pendentes'; }
      var crit = x.folga != null && x.folga <= 1;
      if (crit && nv === 'Alta') { nv = 'Crítica'; mot += ' em atividade crítica'; } else if (crit && nv === 'Média') { nv = 'Alta'; mot += ' em atividade crítica'; }
      x.nv = nv; x.mot = mot; x.crit = crit;
      if (!pior || SUP_CRIT.indexOf(nv) < SUP_CRIT.indexOf(pior.nv) || (nv === pior.nv && x.nec < pior.nec)) pior = x;
    });
    I.pior = pior;
    I.crit = I.cancel || I.recebido ? 'Concluído' : !I.fr.length || I.nec == null ? 'Indefinida' : pior ? pior.nv : 'Concluído';
    I.motivo = pior ? pior.mot : I.nec == null ? 'sem atividade vinculada' : '';
    var refx = pior || F0;
    I.desv = refx ? (refx.desv != null ? refx.desv : null) : null;
    I.desvNec = refx ? refx.desvNec : null;
    I.dias = I.desv != null ? I.desv : !I.contratado && !cte && refx && refx.lPed != null ? refx.lPed - hoje : refx && refx.lRec != null ? refx.lRec - hoje : null;
    I.diasRot = I.desv != null ? 'folga entre a entrega prevista e a data-limite' : !I.contratado && !cte && refx && refx.lPed != null ? 'dias até a data-limite do pedido' : refx && refx.lRec != null ? 'dias até a data-limite de recebimento' : '';
    I.folgaAt = refx && refx.folga != null ? refx.folga : null;
    if (!I.recebido && !I.cancel) {
      if (refx && refx.lRec != null && hoje > refx.lRec) al.push('LIM_VENC'); else if (refx && refx.lRec != null && refx.lRec - hoje <= num(D.cfg.alerta == null ? 15 : D.cfg.alerta)) al.push('LIM_PROX');
      if (!I.contratado && !cte) al.push(refx && refx.lPed != null && hoje > refx.lPed ? 'PED_VENC' : 'NAO_CONTR');
      if (st === 'Em fabricação') al.push('FAB');
      if (ab.some(function (x) { return (x.desv != null && x.desv < 0) || (x.desvNec != null && x.desvNec < 0); })) al.push('ENT_APOS');
      if (ab.some(function (x) { return x.prevVenc; })) al.push('PREV_VENC');
      if ((I.qPed != null && I.q != null && I.qPed < I.q - 1e-9) || (I.recebido && I.q != null && I.qRec != null && I.qRec < I.q - 1e-9)) al.push('QTD_INS');
      if (st === 'Entregue parcialmente') al.push('PARCIAL');
      if (!I.forn && !cte) al.push('SEM_FORN');
      if (cte && !I.conf) al.push('CTE_CONF');
      if (ab.some(function (x) { return x.crit; })) al.push('ATV_CRIT');
      if (ab.some(function (x) { return x.crit && (x.nv === 'Crítica' || x.nv === 'Alta'); })) al.push('CAM_CRIT');
    }
    if (I.pzPend.length && !I.recebido) al.push('PZ_PEND');
    if (I.q == null) al.push('QTD_PEND');
    if (!I.cons.length) al.push('VINC_PEND');
    I.al = al;
    I.risco = (I.crit === 'Crítica' || I.crit === 'Alta') && al.some(function (a) { return /LIM_VENC|PED_VENC|ENT_APOS|CAM_CRIT|NAO_CONTR|CTE_CONF/.test(a); });
    var rx = pior; I.impacto = '';
    if (rx && (rx.nv === 'Crítica' || rx.nv === 'Alta')) {
      var pe2 = rx.prev != null ? Math.max(rx.prev, hoje) : null, at = rx.c0 ? (rx.c0.t.w ? rx.c0.t.w + ' ' : '') + rx.c0.t.n : I.ativ0, atr = pe2 != null && pe2 > rx.nec ? pe2 - rx.nec : rx.lRec != null && hoje > rx.lRec ? hoje - rx.lRec : null;
      I.impacto = (atr ? 'Pode atrasar em ' + atr + ' dia(s) o início de ' : 'Risco para o início de ') + at + (rx.fr ? ' (' + rx.fr + ')' : '') + (rx.crit ? ' – atividade crítica: pode atrasar o término do projeto' : rx.folga != null ? ' – folga da atividade: ' + Math.round(rx.folga) + ' dia(s)' : '');
    }
  });
  itens.sort(function (a, b) { return (a.nec == null ? 1e9 : a.nec) - (b.nec == null ? 1e9 : b.nec) || ordAlfa(a.nome, b.nome); });
  var M = { itens: itens, porK: porK, R: R, hoje: hoje, util: util };
  p._supC = { k: chave, R: R, M: M };
  return M;
}
/* histórico: compara com a última leitura gravada e registra o que mudou */
function supHistorico(p, M) {
  if (!podeEditar() || !M.R) return;
  var D = supDados(p), sn = D.sn, prim = !Object.keys(sn).length, mud = [], dt = isoDia(M.hoje), fd = function (d) { return d == null ? 'pendente' : fdate(d); };
  var nsn = {};
  M.itens.forEach(function (I) {
    var a = sn[I.k], b = [I.nec, I.lRec, I.q == null ? null : Math.round(I.q * 100) / 100, I.crit, I.lPed];
    nsn[I.k] = b; if (prim || !a) return;
    if (a[0] !== b[0]) mud.push({ d: dt, k: I.k, n: I.nome, c: 'Data de necessidade', de: fd(a[0]), para: fd(b[0]), imp: b[0] != null && a[0] != null ? (b[0] < a[0] ? 'Necessidade antecipada em ' + (a[0] - b[0]) + ' dia(s) (cronograma)' : 'Necessidade adiada em ' + (b[0] - a[0]) + ' dia(s) (cronograma)') : 'Vínculo com o cronograma alterado' });
    if (a[1] !== b[1]) mud.push({ d: dt, k: I.k, n: I.nome, c: 'Data-limite de recebimento', de: fd(a[1]), para: fd(b[1]), imp: b[1] != null && a[1] != null && b[1] < a[1] ? 'Prazo para receber ficou ' + (a[1] - b[1]) + ' dia(s) menor' : '' });
    if (a[4] !== b[4] && a[1] === b[1]) mud.push({ d: dt, k: I.k, n: I.nome, c: 'Data-limite de pedido', de: fd(a[4]), para: fd(b[4]), imp: '' });
    if (a[2] !== b[2]) mud.push({ d: dt, k: I.k, n: I.nome, c: 'Quantidade', de: a[2] == null ? 'pendente' : nfq.format(a[2]), para: b[2] == null ? 'pendente' : nfq.format(b[2]), imp: 'Quantitativo ou composição alterados' });
    if (a[3] !== b[3] && SUP_CRIT.indexOf(b[3]) >= 0 && SUP_CRIT.indexOf(a[3]) >= 0 && SUP_CRIT.indexOf(b[3]) < SUP_CRIT.indexOf(a[3]) && (b[3] === 'Crítica' || b[3] === 'Alta')) mud.push({ d: dt, k: I.k, n: I.nome, c: 'Criticidade', de: a[3], para: b[3], imp: 'Passou a apresentar risco: ' + (I.motivo || '') });
  });
  var muda = prim || mud.length || Object.keys(nsn).length !== Object.keys(sn).length;
  if (!muda) return;
  var Ed = supEd(p); Ed.sn = nsn; if (mud.length) Ed.hist = mud.concat(Ed.hist).slice(0, 600);
  salvarMeta(p);
}
function supLog(p, I, campo, de, para) { var Ed = supEd(p); Ed.hist.unshift({ d: isoDia(supHoje()), k: I.k, n: I.nome, c: campo, de: de == null || de === '' ? '—' : String(de), para: para == null || para === '' ? '—' : String(para), imp: 'Alterado no mapa', u: 1 }); if (Ed.hist.length > 600) Ed.hist.length = 600; }
function supSet(p, I, campo, rot, v, fmt) {
  var Ed = supEd(p), o = Ed.it[I.k] || (Ed.it[I.k] = {}), ant = o[campo];
  if (v === '' || v == null) delete o[campo]; else o[campo] = v;
  if (!Object.keys(o).length) delete Ed.it[I.k];
  supLog(p, I, rot, fmt ? fmt(ant) : ant, fmt ? fmt(v) : v); supSalvar(p); agendar();
}

/* ---------- tela ---------- */
var SUP_COLS = [
  ['cod', 'Código', 1], ['nome', 'Insumo', 1], ['cat', 'Categoria', 1], ['u', 'Unidade', 1], ['q', 'Quantidade total', 1], ['qn', 'Quantidade necessária (1ª frente)', 0], ['resp', 'Responsabilidade', 1],
  ['ativ', 'Atividade vinculada', 1], ['eap', 'EAP', 0], ['fr', 'Frente de serviço', 1], ['ini', 'Início da atividade', 0], ['nec', 'Data de necessidade', 1], ['lrec', 'Data-limite de recebimento', 1],
  ['lped', 'Data-limite de pedido', 1], ['laq', 'Data-limite para início da aquisição', 0], ['lead', 'Lead time total (dias)', 0], ['forn', 'Fornecedor', 1], ['st', 'Status', 1], ['qrec', 'Quantidade recebida', 0],
  ['saldo', 'Saldo a receber', 0], ['prev', 'Data prevista de entrega', 1], ['rec', 'Data efetiva de recebimento', 0], ['desv', 'Desvio de prazo (dias)', 1], ['crit', 'Criticidade', 1], ['imp', 'Impacto no cronograma', 0],
  ['al', 'Alertas', 0], ['orig', 'Origem dos dados', 0], ['obs', 'Observações', 0]];
function supColsOn() {
  var V = S.v.sup; if (V.cols) return V.cols;
  var c = null; try { c = JSON.parse(localStorage.getItem('pp-sup-cols') || 'null'); } catch (e) { }
  V.cols = c && c.length ? c : SUP_COLS.filter(function (x) { return x[2]; }).map(function (x) { return x[0]; }); return V.cols;
}
function supFd(d, pend) { return d == null ? (pend === false ? '' : '<i class="sp-pd">pendente</i>') : fdate(d); }
function supFdT(d) { return d == null ? 'pendente' : fdate(d); }
function supQ(v) { return v == null ? null : nfq.format(Math.round(v * 100) / 100); }
function supCel(I, k, txt) {
  var F = I.F0 || {};
  switch (k) {
    case 'cod': return I.cod || '';
    case 'nome': return I.nome;
    case 'cat': return I.cat;
    case 'u': return I.u || '';
    case 'q': return I.q == null ? (txt ? 'pendente' : '<i class="sp-pd">pendente</i>') : supQ(I.q);
    case 'qn': return F.q == null ? (txt ? '' : '–') : supQ(F.q);
    case 'resp': return txt ? SUP_RESPN[I.resp] : '<span class="sp-r sp-r' + SUP_RESP.indexOf(I.resp) + '">' + esc(I.resp) + '</span>';
    case 'ativ': return I.cons.length ? I.ativ0 + (I.ativs.length > 1 ? ' (+' + (I.ativs.length - 1) + ')' : '') : (txt ? 'sem atividade vinculada' : '<i class="sp-pd">sem atividade vinculada</i>');
    case 'eap': return I.eapAt || '';
    case 'fr': return I.frentes.length > 2 ? I.frentes[0] + ' … (' + I.frentes.length + ' frentes)' : I.frentes.join(', ') || (I.cons.length ? 'Geral' : '');
    case 'ini': return txt ? supFdT(I.ativIni) : supFd(I.ativIni);
    case 'nec': return txt ? supFdT(I.nec) : supFd(I.nec);
    case 'lrec': return txt ? supFdT(I.lRec) : supFd(I.lRec);
    case 'lped': return txt ? supFdT(I.lPed) : supFd(I.lPed);
    case 'laq': return txt ? supFdT(I.lAq) : supFd(I.lAq);
    case 'lead': return I.lead == null ? (txt ? 'pendente' : '<i class="sp-pd">pendente</i>') : int(I.lead);
    case 'forn': return I.forn || (I.resp === 'Contratante' ? (txt ? '' : '<span class="vz">contratante</span>') : (txt ? '' : '<i class="sp-pd">a definir</i>'));
    case 'st': return txt ? I.st : '<span class="sp-st">' + esc(I.st) + '</span>';
    case 'qrec': return I.qRec == null ? '' : supQ(I.qRec);
    case 'saldo': return I.saldo == null ? '' : supQ(I.saldo);
    case 'prev': return I.dtPrev == null ? '' : fdate(I.dtPrev) + (txt || I.prevOrig !== 'cronograma' ? '' : ' <span class="vz" data-tip="Fim da janela de fornecimento no cronograma">cron.</span>');
    case 'rec': return I.dtRec == null ? '' : fdate(I.dtRec);
    case 'desv': return I.dias == null ? '' : txt ? I.dias : '<span class="' + (I.dias < 0 ? 'sp-neg' : 'sp-pos') + '" data-tip="' + esc(I.diasRot) + '">' + (I.dias > 0 ? '+' : '') + int(I.dias) + '</span>';
    case 'crit': return txt ? I.crit : '<span class="sp-c ' + SUP_CRITC[I.crit] + '"' + (I.motivo ? ' data-tip="' + esc(I.motivo) + '"' : '') + '>' + I.crit + '</span>';
    case 'imp': return I.impacto;
    case 'al': return txt ? I.al.map(function (a) { return SUP_AL[a]; }).join('; ') : I.al.filter(function (a) { return !/_PEND$/.test(a); }).length ? '<span class="sp-n">' + I.al.filter(function (a) { return !/_PEND$/.test(a); }).length + '</span>' : '';
    case 'orig': return SUP_ORIG[I.orig];
    case 'obs': return I.nota;
  }
  return '';
}
function supFiltra(M, V) {
  var b = semAcento(V.b || '');
  return M.itens.filter(function (I) {
    if (V.cat && I.cat !== V.cat) return false;
    if (V.resp && I.resp !== V.resp) return false;
    if (V.st && I.st !== V.st) return false;
    if (V.crit && I.crit !== V.crit) return false;
    if (V.forn && (I.forn || '(sem fornecedor)') !== V.forn) return false;
    if (V.fr && I.frentes.indexOf(V.fr) < 0) return false;
    if (V.eap && !I.cons.some(function (c) { return String(c.t.w || '').split('.')[0] === V.eap; })) return false;
    if (V.risco && !I.risco) return false;
    if (V.ab && (I.recebido || I.cancel)) return false;
    if (V.de && (I.lRec == null || miDe(I.lRec) < V.de)) return false;
    if (V.ate && (I.lRec == null || miDe(I.lRec) > V.ate)) return false;
    if (b && semAcento(I.nome + ' ' + I.cod + ' ' + I.ativs.join(' ') + ' ' + I.forn).indexOf(b) < 0) return false;
    return true;
  });
}
function supSel(val, lista, set, rot, cls) { return '<label class="' + (cls || '') + '">' + rot + ' <select ' + h(function (el) { set(el.value); agendar(); }) + '>' + lista.map(function (o) { o = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(o[0]) + '"' + (String(val) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>'; }
function shSup(p) {
  var w = p.crono ? croPrecisa(p, 'MAPA DE SUPRIMENTOS') : null; if (w) return w;
  var V = S.v.sup || (S.v.sup = { aba: 'P', esc: 'M', ord: 'nec', ab: true });
  var M = supCalc(p); supHistorico(p, M);
  var D = supDados(p), ed = podeEditar();
  var abas = [['P', 'Painel'], ['M', 'Mapa'], ['T', 'Linha do tempo'], ['C', 'Prazos e regras'], ['H', 'Histórico']];
  var s = titulo('MAPA DE SUPRIMENTOS', '<span class="vz" style="font:500 12px var(--ui)">Planejamento · ' + int(M.itens.length) + ' insumos</span>');
  s += '<div class="rel-bar">' + abas.map(function (a) { return '<button class="' + (V.aba === a[0] ? 'on' : '') + '" ' + h(function () { V.aba = a[0]; agendar(); }) + '>' + a[1] + '</button>'; }).join('') + '</div>';
  if (!M.itens.length) return s + '<div class="vazio"><h3>Nenhum insumo encontrado</h3>O mapa é montado a partir do cronograma (ramo de fornecimentos e atividades), das composições ligadas às tarefas e das permanências. ' + (ed ? 'Ligue composições na guia Relacionamento do cronograma ou insira insumos em Prazos e regras.' : '') + '</div>';
  var pend = M.itens.filter(function (I) { return I.pzPend.length && !I.recebido; }).length;
  if (pend && V.aba !== 'C') s += '<div class="sp-av"><b>' + int(pend) + ' insumo(s) sem prazos de suprimento definidos.</b> Sem esses prazos as datas-limite de recebimento, pedido e aquisição ficam pendentes – o sistema não usa prazos presumidos.' + (ed ? ' <button class="lk" ' + h(function () { V.aba = 'C'; agendar(); }) + '>Definir prazos por categoria</button>' : '') + '</div>';
  if (V.aba === 'P') s += supPainel(p, M, V);
  else if (V.aba === 'M') s += supFiltros(p, M, V) + supTabela(p, M, V);
  else if (V.aba === 'T') s += supFiltros(p, M, V) + supLinha(p, M, V);
  else if (V.aba === 'C') s += supConfig(p, M, V);
  else s += supHist(p, M, V);
  return s;
}
function supFiltros(p, M, V) {
  var uniq = function (f) { var o = {}; M.itens.forEach(function (I) { [].concat(f(I)).forEach(function (x) { if (x != null && x !== '') o[x] = 1; }); }); return Object.keys(o).sort(ordAlfa); };
  var meses = uniq(function (I) { return I.lRec != null ? miDe(I.lRec) : null; }).map(Number).sort(function (a, b) { return a - b; });
  var eaps = uniq(function (I) { return I.cons.map(function (c) { return String(c.t.w || '').split('.')[0]; }); }).filter(function (x) { return /^\d+$/.test(x); }).sort(function (a, b) { return a - b; });
  var R = M.R, nomeEap = function (n) { if (!R) return n; for (var u in R.by) { if (R.by[u].w === n) return n + ' – ' + R.by[u].n; } return n; };
  var f = '<div class="cpu-lb rel-f sp-f">' +
    '<label class="sp-b">Buscar <input type="text" data-live="1" value="' + esc(V.b || '') + '" placeholder="insumo, código, atividade, fornecedor" ' + h(function (el) { V.b = el.value; agendar(); }) + '></label>' +
    supSel(V.cat || '', [['', 'Todas']].concat(SUP_CAT), function (v) { V.cat = v; }, 'Categoria') +
    supSel(V.resp || '', [['', 'Todas']].concat(SUP_RESP.map(function (r) { return [r, SUP_RESPN[r]]; })), function (v) { V.resp = v; }, 'Responsabilidade') +
    supSel(V.st || '', [['', 'Todos']].concat(SUP_ST), function (v) { V.st = v; }, 'Status') +
    supSel(V.crit || '', [['', 'Todas']].concat(SUP_CRIT), function (v) { V.crit = v; }, 'Criticidade') +
    supSel(V.eap || '', [['', 'Toda a EAP']].concat(eaps.map(function (e) { return [e, nomeEap(e)]; })), function (v) { V.eap = v; }, 'EAP') +
    supSel(V.fr || '', [['', 'Todas']].concat(uniq(function (I) { return I.frentes; })), function (v) { V.fr = v; }, 'Frente') +
    supSel(V.forn || '', [['', 'Todos']].concat(uniq(function (I) { return I.forn || '(sem fornecedor)'; })), function (v) { V.forn = v; }, 'Fornecedor') +
    supSel(V.de || 0, [[0, '—']].concat(meses.map(function (mi) { return [mi, mmaa(mi)]; })), function (v) { V.de = +v; }, 'Recebimento de') +
    supSel(V.ate || 0, [[0, '—']].concat(meses.map(function (mi) { return [mi, mmaa(mi)]; })), function (v) { V.ate = +v; }, 'até') +
    '<label class="sp-ck"><input type="checkbox"' + (V.ab ? ' checked' : '') + ' ' + h(function () { V.ab = !V.ab; agendar(); }) + '> Só em aberto</label>' +
    '<label class="sp-ck"><input type="checkbox"' + (V.risco ? ' checked' : '') + ' ' + h(function () { V.risco = !V.risco; agendar(); }) + '> Só com risco no cronograma</label>' +
    (['b', 'cat', 'resp', 'st', 'crit', 'eap', 'fr', 'forn', 'de', 'ate', 'risco'].some(function (k) { return V[k]; }) ? '<button class="lk" ' + h(function () { ['b', 'cat', 'resp', 'st', 'crit', 'eap', 'fr', 'forn', 'de', 'ate', 'risco'].forEach(function (k) { V[k] = k === 'de' || k === 'ate' ? 0 : ''; }); agendar(); }) + '>Limpar filtros</button>' : '') +
    '</div>';
  return f;
}
function supOrdena(L, V) {
  var o = V.ord || 'nec', n = function (v) { return v == null ? 1e9 : v; };
  return L.slice().sort(function (a, b) {
    if (o === 'crit') return SUP_CRIT.indexOf(a.crit) - SUP_CRIT.indexOf(b.crit) || n(a.nec) - n(b.nec);
    if (o === 'lped') return n(a.lPed) - n(b.lPed) || n(a.nec) - n(b.nec);
    if (o === 'nome') return ordAlfa(a.nome, b.nome);
    if (o === 'desv') return n(a.dias) - n(b.dias);
    return n(a.nec) - n(b.nec) || ordAlfa(a.nome, b.nome);
  });
}
function supTabela(p, M, V) {
  var L = supOrdena(supFiltra(M, V), V), on = supColsOn(), cols = SUP_COLS.filter(function (c) { return on.indexOf(c[0]) >= 0; });
  var s = '<div class="cpu-lb sp-acs"><span class="vz">' + int(L.length) + ' de ' + int(M.itens.length) + ' insumos</span>' +
    supSel(V.ord || 'nec', [['nec', 'Data de necessidade'], ['lped', 'Data-limite de pedido'], ['crit', 'Criticidade'], ['desv', 'Folga / atraso'], ['nome', 'Insumo (A–Z)']], function (v) { V.ord = v; }, 'Ordenar por') +
    '<details class="sp-cols"><summary class="lk">Colunas (' + cols.length + ')</summary><div>' + SUP_COLS.map(function (c) { return '<label><input type="checkbox"' + (on.indexOf(c[0]) >= 0 ? ' checked' : '') + (c[0] === 'nome' ? ' disabled' : '') + ' ' + h(function () { var i = on.indexOf(c[0]); if (i >= 0) on.splice(i, 1); else on.push(c[0]); V.cols = SUP_COLS.map(function (x) { return x[0]; }).filter(function (k) { return on.indexOf(k) >= 0; }); try { localStorage.setItem('pp-sup-cols', JSON.stringify(V.cols)); } catch (e) { } agendar(); }) + '> ' + esc(c[1]) + '</label>'; }).join('') +
    '<button class="lk" ' + h(function () { V.cols = null; try { localStorage.removeItem('pp-sup-cols'); } catch (e) { } agendar(); }) + '>Restaurar padrão</button></div></details>' +
    (podeEditar() ? '<button class="lk" ' + h(function () { S.v.dlg = { tipo: 'supNovo', m: {} }; agendar(); }) + '>+ Inserir insumo</button>' : '') +
    '<span style="flex:1"></span><button class="bxl" ' + h(function () { supExcel(p, M, L, cols); }) + '>' + XL_IC + 'Excel</button><button class="bxl sp-pdf" ' + h(function () { supPdf(p, M, L, cols, V); }) + '>' + XL_IC + 'PDF</button></div>';
  s += '<div class="tw sp-tw"><table class="g sp-t"><thead><tr>' + cols.map(function (c) { return '<th' + (c[0] === 'nome' || c[0] === 'ativ' || c[0] === 'imp' || c[0] === 'obs' ? ' class="l"' : '') + '>' + esc(c[1]) + '</th>'; }).join('') + '</tr></thead><tbody>';
  if (!L.length) s += '<tr><td colspan="' + cols.length + '" class="c vz" style="padding:18px">Nenhum insumo com esses filtros.</td></tr>';
  L.forEach(function (I) {
    s += '<tr class="sp-l ' + SUP_CRITC[I.crit] + '" tabindex="0" ' + h(function () { S.v.dlg = { tipo: 'supIt', k: I.k }; agendar(); }) + '>' + cols.map(function (c) {
      var k = c[0], cl = { nome: 'w l', ativ: 'w l', imp: 'w l', obs: 'w l', q: 'n', qn: 'n', qrec: 'n', saldo: 'n', lead: 'n', desv: 'n' }[k] || 'c';
      return '<td class="' + cl + '"' + (k === 'nome' ? ' title="' + esc(I.nome) + '"' : '') + '>' + (k === 'nome' ? esc(I.nome) + (I.orig === 'SUG' ? ' <span class="sp-sug" data-tip="Item típico de usina solar fornecido pela contratante, sugerido porque o cronograma não tem o fornecimento. Confirme ou desative no detalhe.">sugestão</span>' : '') : /^(cod|cat|u|ativ|eap|fr|forn|imp|obs|orig)$/.test(k) && k !== 'forn' && k !== 'ativ' ? esc(supCel(I, k)) : supCel(I, k)) + '</td>';
    }).join('') + '</tr>';
  });
  s += '</tbody></table></div>';
  s += '<div class="nota">As datas da linha são da próxima frente ainda não atendida; a criticidade considera a frente mais restritiva. Clique em um insumo para ver a necessidade por frente e atividade e para registrar fornecedor, pedido, entregas e liberação. <b>Data-limite de recebimento</b> = data de necessidade − inspeção e recebimento − integração/liberação − margem de segurança. <b>Data-limite de pedido</b> = data-limite de recebimento − transporte − fabricação. <b>Início da aquisição</b> = data-limite de pedido − cotação − aprovação − contratação. Prazos em ' + ((supDados(p).cfg.modo || 'U') === 'U' ? 'dias úteis do calendário do cronograma' : 'dias corridos') + '. Desvio positivo = folga; negativo = atraso.</div>';
  return s;
}
/* ---------- painel ---------- */
function supPainel(p, M, V) {
  var L = M.itens, ab = L.filter(function (I) { return !I.recebido && !I.cancel; }), n = function (f) { return L.filter(f).length; };
  var kt = function (rot, v, sub, cls, fil) { return '<div class="kt' + (cls ? ' ' + cls : '') + (fil ? ' sp-kc' : '') + '"' + (fil ? ' tabindex="0" ' + h(function () { Object.assign(V, { aba: 'M', b: '', cat: '', resp: '', st: '', crit: '', fr: '', forn: '', eap: '', de: 0, ate: 0, risco: false, ab: false }, fil); agendar(); }) : '') + '><span>' + rot + '</span><b>' + int(v) + '</b><i>' + sub + '</i></div>'; };
  var stIn = function (lst) { return function (I) { return lst.indexOf(I.st) >= 0; }; };
  var s = '<div class="gk sp-k">' +
    kt('Insumos do projeto', L.length, int(ab.length) + ' em aberto', '', {}) +
    kt('Pendentes de contratação', n(function (I) { return !I.contratado && !I.recebido && !I.cancel && I.resp !== 'Contratante'; }), 'sem pedido emitido', '', { ab: true }) +
    kt('Contratados', n(function (I) { return I.contratado && !I.recebido && !I.cancel; }), 'pedido emitido, a receber', '', { ab: true }) +
    kt('Em fabricação', n(stIn(['Em fabricação'])), 'status informado', '', { st: 'Em fabricação' }) +
    kt('Em transporte', n(stIn(['Aguardando expedição', 'Em transporte'])), 'expedição e transporte', '', { st: 'Em transporte' }) +
    kt('Recebidos', n(function (I) { return I.recebido; }), int(n(stIn(['Liberado para utilização']))) + ' liberados para uso', '', { st: 'Entregue' }) +
    kt('Atrasados', n(function (I) { return !I.recebido && !I.cancel && (I.al.indexOf('LIM_VENC') >= 0 || I.al.indexOf('PED_VENC') >= 0 || I.al.indexOf('ENT_APOS') >= 0 || I.st === 'Atrasado'); }), 'limite vencido ou entrega após o limite', 'sp-kr', { ab: true, crit: 'Crítica' }) +
    kt('Críticos', n(function (I) { return I.crit === 'Crítica'; }), int(n(function (I) { return I.crit === 'Alta'; })) + ' de criticidade alta', 'sp-kr', { crit: 'Crítica' }) +
    kt('Da contratante', n(function (I) { return I.resp === 'Contratante'; }), int(n(function (I) { return I.resp === 'Contratante' && !I.conf && !I.recebido; })) + ' sem confirmação', '', { resp: 'Contratante' }) +
    kt('Risco no cronograma', n(function (I) { return I.risco; }), 'podem atrasar atividades', 'sp-kr', { risco: true }) + '</div>';
  /* barras por categoria, responsabilidade e status */
  var barras = function (tit, lista, f, cor) {
    var tot = {}; L.forEach(function (I) { var k = f(I); tot[k] = (tot[k] || 0) + 1; });
    var mx = Math.max.apply(null, lista.map(function (k) { return tot[k] || 0; }).concat([1]));
    return '<div class="gc sp-bar"><h4>' + tit + '</h4>' + lista.filter(function (k) { return tot[k]; }).map(function (k) { return '<div class="sp-br"><span title="' + esc(k) + '">' + esc(k) + '</span><i><b style="width:' + (100 * tot[k] / mx).toFixed(1) + '%;background:' + (cor ? cor(k) : 'var(--azul)') + '"></b></i><em>' + int(tot[k]) + '</em></div>'; }).join('') + '</div>';
  };
  s += '<div class="sp-g3">' + barras('Por categoria', SUP_CAT, function (I) { return I.cat; }, function (k) { return SUP_CATC[k]; }) +
    barras('Por responsabilidade de fornecimento', SUP_RESP, function (I) { return I.resp; }, function (k) { return k === 'Contratante' ? '#c9352b' : k === 'Contratada' ? 'var(--azul)' : '#7b8799'; }) +
    barras('Por criticidade', SUP_CRIT, function (I) { return I.crit; }, function (k) { return { 'Crítica': '#c8322b', 'Alta': '#e8762c', 'Média': '#f2b400', 'Baixa': '#2e9e5b', 'Indefinida': '#9aa4b2', 'Concluído': '#5b8def' }[k]; }) + '</div>';
  /* concentração de recebimentos por mês */
  var mesL = {}, mesP = {}, mesR = {};
  L.forEach(function (I) { I.fr.forEach(function (x) { if (x.lRec != null) mesL[miDe(x.lRec)] = (mesL[miDe(x.lRec)] || 0) + 1; if (x.prev != null) mesP[miDe(x.prev)] = (mesP[miDe(x.prev)] || 0) + 1; }); if (I.dtRec != null) mesR[miDe(I.dtRec)] = (mesR[miDe(I.dtRec)] || 0) + 1; });
  var ks = Object.keys(mesL).concat(Object.keys(mesP), Object.keys(mesR)).map(Number);
  if (ks.length) {
    var a = Math.min.apply(null, ks), b = Math.max.apply(null, ks), ms = []; for (var mi = a; mi <= b; mi++) ms.push(mi);
    var mx = Math.max.apply(null, ms.map(function (m) { return Math.max(mesL[m] || 0, mesP[m] || 0, mesR[m] || 0); }).concat([1]));
    var W = Math.max(640, ms.length * 46), H = 190, bw = (W - 50) / ms.length, y = function (v) { return 150 - 130 * v / mx; };
    var svg = '<svg class="sp-ch" viewBox="0 0 ' + W + ' ' + H + '" style="min-width:' + W + 'px" role="img" aria-label="Recebimentos por mês">';
    [0, 0.5, 1].forEach(function (f) { var v = Math.round(mx * f); svg += '<line x1="40" x2="' + W + '" y1="' + y(v) + '" y2="' + y(v) + '" class="sp-gl"/><text x="34" y="' + (y(v) + 4) + '" text-anchor="end">' + v + '</text>'; });
    ms.forEach(function (m, i) {
      var x = 44 + i * bw, w3 = Math.max(4, (bw - 10) / 3);
      [[mesL[m], '#c8322b', 'Data-limite de recebimento'], [mesP[m], '#1769e8', 'Entrega prevista'], [mesR[m], '#2e9e5b', 'Recebido']].forEach(function (z, j) { if (z[0]) svg += '<rect x="' + (x + j * w3).toFixed(1) + '" y="' + y(z[0]).toFixed(1) + '" width="' + (w3 - 1).toFixed(1) + '" height="' + (150 - y(z[0])).toFixed(1) + '" rx="2" fill="' + z[1] + '"><title>' + mmaa(m) + ' – ' + z[2] + ': ' + z[0] + '</title></rect>'; });
      svg += '<text x="' + (x + bw / 2 - 5).toFixed(1) + '" y="168" text-anchor="middle">' + mmaa(m).slice(0, 3) + '/' + String(Math.floor(m / 12)).slice(2) + '</text>';
    });
    svg += '</svg>';
    s += '<div class="gc"><h4 class="sp-h4">Concentração de recebimentos por mês <span class="vz">(lotes por frente)</span></h4><div class="sp-lg"><span><i style="background:#c8322b"></i>Data-limite de recebimento</span><span><i style="background:#1769e8"></i>Entrega prevista</span><span><i style="background:#2e9e5b"></i>Recebido</span></div><div class="tw">' + svg + '</div></div>';
  }
  /* listas de ação */
  var lista = function (tit, nota, X, cols) {
    return '<div class="gc sp-lst"><h4 class="sp-h4">' + tit + ' <span class="vz">' + int(X.length) + '</span></h4>' + (nota ? '<p class="vz sp-np">' + nota + '</p>' : '') + (X.length ? '<table class="g sp-t"><tbody>' + X.slice(0, 12).map(function (I) {
      return '<tr class="sp-l ' + SUP_CRITC[I.crit] + '" tabindex="0" ' + h(function () { S.v.dlg = { tipo: 'supIt', k: I.k }; agendar(); }) + '><td class="w l">' + esc(I.nome) + '<div class="vz">' + esc(I.ativ0 || '') + '</div></td>' + cols.map(function (c) { return '<td class="c">' + c(I) + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody></table>' + (X.length > 12 ? '<p class="vz">… e mais ' + (X.length - 12) + '.</p>' : '') : '<p class="vz">Nada nesta lista.</p>') + '</div>';
  };
  var h0 = M.hoje, alerta = num(supDados(p).cfg.alerta == null ? 15 : supDados(p).cfg.alerta);
  var ja = ab.filter(function (I) { return !I.contratado && I.resp !== 'Contratante' && I.lAq != null && I.lAq - h0 <= alerta; }).sort(function (a, b) { return a.lAq - b.lAq; });
  var rs = ab.filter(function (I) { return I.crit === 'Crítica' || I.crit === 'Alta'; }).sort(function (a, b) { return SUP_CRIT.indexOf(a.crit) - SUP_CRIT.indexOf(b.crit) || (a.nec || 0) - (b.nec || 0); });
  var ct = ab.filter(function (I) { return I.resp === 'Contratante'; }).sort(function (a, b) { return (a.nec || 1e9) - (b.nec || 1e9); });
  var at = {}; ab.filter(function (I) { return I.risco; }).forEach(function (I) { var k = I.pior && I.pior.c0 ? (I.pior.c0.t.w ? I.pior.c0.t.w + ' ' : '') + I.pior.c0.t.n : I.ativ0; (at[k] = at[k] || []).push(I.nome); });
  s += '<div class="sp-g2">' +
    lista('Adquirir ou contratar imediatamente', 'Sem pedido e com o início da aquisição vencido ou nos próximos ' + alerta + ' dias.', ja, [function (I) { return '<span class="vz">início da aquisição</span><br>' + fdate(I.lAq); }, function (I) { return '<span class="vz">pedido até</span><br>' + supFd(I.lPed); }]) +
    lista('Maior risco de atraso', '', rs, [function (I) { return '<span class="sp-c ' + SUP_CRITC[I.crit] + '">' + I.crit + '</span>'; }, function (I) { return '<span class="vz">' + esc(I.motivo) + '</span>'; }]) +
    lista('Fornecimentos da contratante a acompanhar', 'Ordem de necessidade; confirmação de disponibilidade registrada no detalhe do insumo.', ct, [function (I) { return '<span class="vz">necessidade</span><br>' + supFd(I.nec); }, function (I) { return I.conf ? '<span class="sp-pos">confirmado ' + fdate(I.conf) + '</span>' : '<span class="sp-neg">sem confirmação</span>'; }]) +
    '<div class="gc sp-lst"><h4 class="sp-h4">Atividades que podem ser impactadas <span class="vz">' + int(Object.keys(at).length) + '</span></h4>' + (Object.keys(at).length ? '<ul class="sp-ul">' + Object.keys(at).sort(cpuOrd).slice(0, 14).map(function (k) { return '<li><b>' + esc(k) + '</b><span class="vz"> – ' + esc(at[k].join(', ')) + '</span></li>'; }).join('') + '</ul>' : '<p class="vz">Nenhuma atividade com risco de falta de suprimento identificado.</p>') + '</div></div>';
  var pq = n(function (I) { return I.q == null; }), pv = n(function (I) { return !I.cons.length; });
  s += '<div class="nota">Pendências de dados: ' + int(n(function (I) { return I.pzPend.length; })) + ' insumo(s) sem prazos, ' + int(pq) + ' sem quantidade e ' + int(pv) + ' sem atividade vinculada. Nenhum desses dados é presumido: informe-os no detalhe do insumo ou em Prazos e regras. A criticidade considera o prazo restante, o lead time, a margem de segurança e a folga da atividade no cronograma (folga total calculada pelas predecessoras), não só a proximidade da data.</div>';
  return s;
}
/* ---------- linha do tempo (Gantt de suprimentos) ---------- */
function supLinha(p, M, V) {
  var L = supOrdena(supFiltra(M, V), { ord: V.ord || 'nec' }).filter(function (I) { return I.nec != null; });
  var esc0 = V.esc || 'M', ppd = esc0 === 'D' ? 26 : esc0 === 'S' ? 6 : 1.6;
  var s = '<div class="cpu-lb sp-acs">' + supSel(esc0, [['M', 'Mês'], ['S', 'Semana'], ['D', 'Dia']], function (v) { V.esc = v; }, 'Escala') + '<span class="vz">' + int(L.length) + ' insumos com data de necessidade</span><span style="flex:1"></span>' +
    '<div class="sp-lg"><span><i class="sp-g-at"></i>Atividade</span><span><i style="background:#7aa7f0"></i>Aquisição</span><span><i style="background:#a98be8"></i>Fabricação</span><span><i style="background:#f2b400"></i>Transporte</span><span><i style="background:#3fb9b2"></i>Inspeção / liberação</span><span><i style="background:#6fcf97"></i>Entregas no cronograma</span><span><b class="sp-mk" style="color:#c8322b">|</b>Limite de recebimento</span><span><b class="sp-mk">▼</b>Necessidade</span><span><b class="sp-mk" style="color:#1769e8">◆</b>Entrega prevista</span><span><b class="sp-mk" style="color:#1b7f4c">◆</b>Recebido</span></div></div>';
  if (!L.length) return s + '<div class="vazio">Nenhum insumo com data de necessidade nos filtros escolhidos.</div>';
  var d0 = Infinity, d1 = -Infinity, ac = function (d) { if (d != null) { if (d < d0) d0 = d; if (d > d1) d1 = d; } };
  L.forEach(function (I) { [I.lAq, I.lPed, I.lRec, I.nec, I.ativFim, I.dtPrev, I.dtRec].forEach(ac); I.lotes.forEach(function (l) { ac(Math.floor(l.ini)); ac(Math.floor(l.fim)); }); });
  ac(M.hoje); d0 = (esc0 === 'M' ? miIni(miDe(d0)) : segunda(d0)) - 3; d1 += 10;
  var LW = 0, LBW = 300, RH = 30, W = (d1 - d0) * ppd, H = 34 + L.length * RH, X = function (d) { return LW + (d - d0) * ppd; };
  var g = '<svg class="sp-gt" width="' + W.toFixed(0) + '" height="' + H + '" viewBox="0 0 ' + W.toFixed(0) + ' ' + H + '" role="img" aria-label="Linha do tempo de suprimentos">';
  var gl = '<svg class="sp-gt" width="' + LBW + '" height="' + H + '" viewBox="0 0 ' + LBW + ' ' + H + '" aria-hidden="true"><text x="8" y="15" class="sp-gx">Insumo</text>';
  /* grade */
  if (esc0 === 'M') { for (var mi = miDe(d0); miIni(mi) <= d1; mi++) { var x = X(miIni(mi)); g += '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="22" y2="' + H + '" class="sp-gl"/><text x="' + (x + 3).toFixed(1) + '" y="15" class="sp-gx">' + mmaa(mi).slice(0, 3) + '/' + String(Math.floor(mi / 12)).slice(2) + '</text>'; } }
  else { for (var d = segunda(d0); d <= d1; d += esc0 === 'D' ? 1 : 7) { var x2 = X(d); g += '<line x1="' + x2.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y1="22" y2="' + H + '" class="sp-gl' + (esc0 === 'D' && E.weekday(d) !== 1 ? ' sp-gl2' : '') + '"/>' + (esc0 === 'S' || E.weekday(d) === 1 || ppd >= 20 ? '<text x="' + (x2 + 2).toFixed(1) + '" y="15" class="sp-gx">' + fdate(d).slice(0, 5) + '</text>' : ''); } }
  var xh = X(M.hoje); g += '<line x1="' + xh.toFixed(1) + '" x2="' + xh.toFixed(1) + '" y1="18" y2="' + H + '" class="sp-hj"/><text x="' + (xh + 3).toFixed(1) + '" y="28" class="sp-hjt">hoje</text>';
  L.forEach(function (I, i) {
    var y = 34 + i * RH, ym = y + RH / 2, F = I.F0, cor = { 'Crítica': '#c8322b', 'Alta': '#e8762c' }[I.crit];
    g += '<g class="sp-gr" ' + h(function () { S.v.dlg = { tipo: 'supIt', k: I.k }; agendar(); }) + '><rect x="0" y="' + y + '" width="' + W.toFixed(0) + '" height="' + RH + '" class="sp-rw' + (i % 2 ? ' z' : '') + '"/>';
    gl += '<g class="sp-gr" ' + h(function () { S.v.dlg = { tipo: 'supIt', k: I.k }; agendar(); }) + '><rect x="0" y="' + y + '" width="' + LBW + '" height="' + RH + '" class="sp-rw' + (i % 2 ? ' z' : '') + '"/><text x="8" y="' + (ym + 4) + '" class="sp-gn"' + (cor ? ' style="fill:' + cor + ';font-weight:700"' : '') + '><title>' + esc(I.nome) + '</title>' + esc(I.nome.length > (I.resp === 'Contratante' ? 30 : 40) ? I.nome.slice(0, I.resp === 'Contratante' ? 29 : 39) + '…' : I.nome) + '</text>' + (I.resp === 'Contratante' ? '<text x="' + (LBW - 8) + '" y="' + (ym + 4) + '" text-anchor="end" class="sp-gc">CONTRATANTE</text>' : '') + '</g>';
    var bar = function (a, b, c, op, hh, tt) { if (a == null || b == null || b < a) return ''; return '<rect x="' + X(a).toFixed(1) + '" y="' + (ym - hh / 2).toFixed(1) + '" width="' + Math.max(2, (b - a) * ppd).toFixed(1) + '" height="' + hh + '" rx="3" fill="' + c + '"' + (op ? ' opacity="' + op + '"' : '') + '><title>' + esc(tt) + '</title></rect>'; };
    if (I.ativIni != null) g += '<rect x="' + X(I.ativIni).toFixed(1) + '" y="' + (ym - 11) + '" width="' + Math.max(2, (I.ativFim - I.ativIni) * ppd).toFixed(1) + '" height="22" rx="4" class="sp-ga"><title>' + esc('Atividades que consomem: ' + fdate(I.ativIni) + ' a ' + fdate(I.ativFim)) + '</title></rect>';
    if (F) {
      var a = I.pz, util = M.util, eu = supUtil(p), fimFab = F.lPed != null && a.fab != null ? supMais(F.lPed, a.fab, util, eu) : null;
      g += bar(F.lAq, F.lPed, '#7aa7f0', 0, 10, 'Aquisição: ' + supFdT(F.lAq) + ' a ' + supFdT(F.lPed));
      g += bar(F.lPed, fimFab, '#a98be8', 0, 10, 'Fabricação: ' + supFdT(F.lPed) + ' a ' + supFdT(fimFab));
      g += bar(fimFab, F.lRec, '#f2b400', 0, 10, 'Transporte até ' + supFdT(F.lRec));
      g += bar(F.lRec, F.nec, '#3fb9b2', 0, 10, 'Inspeção, liberação e margem: ' + supFdT(F.lRec) + ' a ' + supFdT(F.nec));
    }
    if (I.lotes.length) { var li = Math.floor(Math.min.apply(null, I.lotes.map(function (l) { return l.ini; }))), lf = Math.floor(Math.max.apply(null, I.lotes.map(function (l) { return l.fim; }))); g += bar(li, lf, '#6fcf97', 0.9, 5, 'Entregas programadas no cronograma: ' + fdate(li) + ' a ' + fdate(lf) + ' (' + I.lotes.length + ' lote(s))').replace('y="' + (ym - 2.5).toFixed(1) + '"', 'y="' + (ym + 7) + '"'); }
    if (I.lRec != null) g += '<line x1="' + X(I.lRec).toFixed(1) + '" x2="' + X(I.lRec).toFixed(1) + '" y1="' + (y + 4) + '" y2="' + (y + RH - 4) + '" stroke="#c8322b" stroke-width="2.5"><title>Data-limite de recebimento: ' + fdate(I.lRec) + '</title></line>';
    g += '<path d="M' + (X(I.nec) - 5).toFixed(1) + ' ' + (y + 3) + 'h10l-5 7z" class="sp-nk"><title>Necessidade na obra: ' + fdate(I.nec) + '</title></path>';
    var dia = function (d, c, tt) { if (d == null) return ''; var x3 = X(d); return '<path d="M' + x3.toFixed(1) + ' ' + (ym - 6) + 'l6 6-6 6-6-6z" fill="' + c + '" stroke="#fff" stroke-width="1"><title>' + tt + '</title></path>'; };
    if (I.dtRec != null) g += dia(I.dtRec, '#1b7f4c', 'Recebido: ' + fdate(I.dtRec)); else g += dia(I.dtPrev, '#1769e8', 'Entrega prevista: ' + supFdT(I.dtPrev) + (I.prevOrig ? ' (' + I.prevOrig + ')' : ''));
    g += '</g>';
  });
  g += '</svg>'; gl += '</svg>';
  return s + '<div class="sp-gw"><div class="sp-glc">' + gl + '</div><div>' + g + '</div></div><div class="nota">Cada linha mostra a frente mais restritiva do insumo: os períodos de aquisição, fabricação, transporte e inspeção são calculados de trás para a frente a partir da data de necessidade, com os prazos da categoria (ou do próprio insumo). Clique na linha para ver todas as frentes. Itens em vermelho são críticos; em laranja, criticidade alta.</div>';
}
/* ---------- prazos, responsabilidade padrão, itens inseridos ---------- */
function supConfig(p, M, V) {
  var D = supDados(p), ed = podeEditar(), C = D.cfg;
  var nIn = function (v, set, ph) { return ed ? '<input type="text" inputmode="numeric" class="sp-in" value="' + (v == null || v === '' ? '' : esc(v)) + '" placeholder="' + (ph || '–') + '" ' + h(function (el) { var x = el.value.trim() === '' ? null : Math.max(0, Math.round(parseNum(el.value))); set(x); }) + '>' : (v == null || v === '' ? '<i class="sp-pd">pendente</i>' : esc(v)); };
  var cont = {}; M.itens.forEach(function (I) { cont[I.cat] = (cont[I.cat] || 0) + 1; });
  var s = '<div class="gc"><h4 class="sp-h4">Regras de cálculo</h4><div class="sp-cfg">' +
    '<label>Contagem dos prazos ' + (ed ? '<select ' + h(function (el) { var Ed = supEd(p); Ed.cfg.modo = el.value; supSalvar(p); agendar(); }) + '><option value="U"' + ((C.modo || 'U') === 'U' ? ' selected' : '') + '>Dias úteis (calendário do cronograma)</option><option value="C"' + (C.modo === 'C' ? ' selected' : '') + '>Dias corridos</option></select>' : '<b>' + ((C.modo || 'U') === 'U' ? 'Dias úteis' : 'Dias corridos') + '</b>') + '</label>' +
    '<label>Margem de segurança (dias) ' + nIn(C.margem, function (x) { var Ed = supEd(p); Ed.cfg.margem = x; supSalvar(p); agendar(); }) + '</label>' +
    '<label>Alertar com antecedência de (dias) ' + nIn(C.alerta == null ? 15 : C.alerta, function (x) { var Ed = supEd(p); Ed.cfg.alerta = x == null ? 15 : x; supSalvar(p); agendar(); }) + '</label></div>' +
    '<p class="vz sp-np">Campo vazio = pendente: o mapa não usa prazos presumidos. Informe 0 quando a etapa não existir para a categoria. O prazo informado no próprio insumo prevalece sobre o da categoria.</p></div>';
  s += '<div class="gc"><h4 class="sp-h4">Prazos de suprimento por categoria <span class="vz">(dias)</span></h4><div class="tw"><table class="g sp-t sp-pz"><thead><tr><th class="l">Categoria</th><th>Insumos</th>' + SUP_PZ.map(function (z) { return '<th>' + z[1] + '</th>'; }).join('') + '<th>Lead time</th><th>Responsabilidade padrão</th></tr></thead><tbody>' +
    SUP_CAT.map(function (c) {
      var o = C.cat[c] || {}, tot = SUP_PZ.every(function (z) { return supNum(o[z[0]]) != null; }) && supNum(C.margem) != null ? SUP_PZ.reduce(function (a, z) { return a + supNum(o[z[0]]); }, 0) + supNum(C.margem) : null;
      return '<tr><td class="l"><i class="sp-dot" style="background:' + SUP_CATC[c] + '"></i>' + esc(c) + '</td><td class="c">' + int(cont[c] || 0) + '</td>' + SUP_PZ.map(function (z) { return '<td class="c">' + nIn(o[z[0]], function (x) { var Ed = supEd(p), oo = Ed.cfg.cat[c] || (Ed.cfg.cat[c] = {}); if (x == null) delete oo[z[0]]; else oo[z[0]] = x; supSalvar(p); agendar(); }) + '</td>'; }).join('') +
        '<td class="c">' + (tot == null ? '<i class="sp-pd">pendente</i>' : int(tot)) + '</td><td class="c">' + (ed ? '<select ' + h(function (el) { var Ed = supEd(p); if (el.value) Ed.cfg.resp[c] = el.value; else delete Ed.cfg.resp[c]; supSalvar(p); agendar(); }) + '><option value="">Automática</option>' + SUP_RESP.map(function (r) { return '<option' + (C.resp[c] === r ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select>' : esc(C.resp[c] || 'Automática')) + '</td></tr>';
    }).join('') + '</tbody></table></div><p class="vz sp-np">Lead time = cotação + aprovação + contratação + fabricação + transporte + inspeção + liberação + margem. Responsabilidade automática: o que o cronograma indica no ramo de fornecimentos (nome da contratante cadastrada em Cadastro de clientes e empresas, "Consórcio", "Contratada"…); itens das composições = contratada; equipamentos = a definir.</p></div>';
  /* inseridos no mapa */
  s += '<div class="gc"><h4 class="sp-h4">Insumos inseridos no mapa <span class="vz">' + int(D.man.length) + '</span></h4><p class="vz sp-np">Para insumos que não estão nas composições nem no cronograma (por exemplo, equipamentos fornecidos pela contratante). Informe as palavras-chave da atividade que consome o insumo para ligar ao cronograma.</p>' +
    (D.man.length ? '<table class="g sp-t"><thead><tr><th class="l">Insumo</th><th>Categoria</th><th>Unidade</th><th>Quantidade</th><th>Responsabilidade</th><th class="l">Vínculo (palavras-chave)</th><th>Atividades ligadas</th>' + (ed ? '<th></th>' : '') + '</tr></thead><tbody>' + D.man.map(function (m, i) {
      var I = M.porK['M:' + m.id] || { cons: [] };
      return '<tr><td class="l w">' + esc(m.nome) + '</td><td class="c">' + esc(m.cat || I.cat || '') + '</td><td class="c">' + esc(m.u || '') + '</td><td class="n">' + (m.q == null || m.q === '' ? '<i class="sp-pd">pendente</i>' : nfq.format(m.q)) + '</td><td class="c">' + esc(m.resp || I.resp || '') + '</td><td class="l">' + esc(m.kw || '') + '</td><td class="c">' + int(I.cons.length) + '</td>' +
        (ed ? '<td class="c"><button class="lk" ' + h(function () { S.v.dlg = { tipo: 'supNovo', m: clone(m), i: i }; agendar(); }) + '>Editar</button> <button class="lk dn" ' + h(function () { confirma('Remover "' + m.nome + '" do mapa de suprimentos?', function () { var Ed = supEd(p); Ed.man.splice(i, 1); delete Ed.it['M:' + m.id]; supSalvar(p); }); }) + '>Remover</button></td>' : '') + '</tr>';
    }).join('') + '</tbody></table>' : '') + (ed ? '<p><button class="bt" ' + h(function () { S.v.dlg = { tipo: 'supNovo', m: {} }; agendar(); }) + '>+ Inserir insumo</button></p>' : '') + '</div>';
  s += '<div class="nota">Fontes do mapa: ramo de fornecimentos do cronograma (tarefas com "Fornecimento" no nome, com lotes por frente), composições ligadas às tarefas (guia Relacionamento), permanências do cronograma financeiro e insumos inseridos aqui. Qualquer mudança de datas, durações, predecessoras, quantitativos, composições, calendário, prazos ou responsabilidade recalcula o mapa na próxima abertura, e as mudanças de necessidade, limites e criticidade ficam no Histórico.</div>';
  return s;
}
function supHist(p, M, V) {
  var H = supDados(p).hist, f = V.hf || '';
  var L = H.filter(function (x) { return !f || (f === 'u' ? x.u : !x.u); });
  var s = '<div class="cpu-lb sp-acs">' + supSel(f, [['', 'Todas as alterações'], ['a', 'Recalculadas pelo cronograma / composições'], ['u', 'Registradas no mapa']], function (v) { V.hf = v; }, 'Mostrar') + '<span class="vz">' + int(L.length) + ' registro(s)</span><span style="flex:1"></span>' +
    '<button class="bxl" ' + h(function () { relExcel(p, 'Historico de suprimentos', [['Data', 'Insumo', 'Dado alterado', 'De', 'Para', 'Impacto']].concat(L.map(function (x) { return [fdate(E.day(x.d)), x.n, x.c, x.de, x.para, x.imp]; }))); }) + '>' + XL_IC + 'Excel</button></div>';
  if (!L.length) return s + '<div class="vazio">Nenhuma alteração registrada ainda. A primeira leitura do mapa grava a situação atual; a partir dela, mudanças no cronograma, nas composições e no próprio mapa aparecem aqui.</div>';
  return s + '<div class="tw sp-tw"><table class="g sp-t"><thead><tr><th>Data</th><th class="l">Insumo</th><th>Dado alterado</th><th>De</th><th>Para</th><th class="l">Impacto no planejamento</th></tr></thead><tbody>' +
    L.slice(0, 400).map(function (x) { var I = M.porK[x.k]; return '<tr' + (I ? ' class="sp-l" tabindex="0" ' + h(function () { S.v.dlg = { tipo: 'supIt', k: x.k }; agendar(); }) : '') + '><td class="c">' + fdate(E.day(x.d)) + '</td><td class="l w">' + esc(x.n) + '</td><td class="c">' + esc(x.c) + '</td><td class="c">' + esc(x.de) + '</td><td class="c">' + esc(x.para) + '</td><td class="l w">' + esc(x.imp || '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
}
/* ---------- detalhe do insumo ---------- */
function dlgSupIt(d) {
  var p = proj(), M = p ? supCalc(p) : null, I = M && M.porK[d.k], fechar = function () { S.v.dlg = null; agendar(); };
  if (!I) return janela('Insumo', '<p>Insumo não encontrado no mapa atual.</p>', 420);
  var ed = podeEditar(), o = (supDados(p).it[I.k]) || {}, util = M.util, eu = supUtil(p);
  var dIn = function (campoK, rot, v) { return '<label>' + rot + (ed ? '<input type="date" value="' + (v ? esc(v) : '') + '" ' + h(function (el) { supSet(p, I, campoK, rot, el.value || null, function (x) { return x ? fdate(E.day(x)) : ''; }); }) + '>' : '<b>' + (v ? fdate(E.day(v)) : '–') + '</b>') + '</label>'; };
  var tIn = function (campoK, rot, v, ph, num0) { return '<label>' + rot + (ed ? '<input type="text"' + (num0 ? ' inputmode="decimal"' : '') + ' value="' + esc(v == null ? '' : num0 ? numIn(v) : v) + '" placeholder="' + esc(ph || '') + '" ' + h(function (el) { var x = el.value.trim(); supSet(p, I, campoK, rot, x === '' ? null : num0 ? parseNum(x) : x); }) + (campoK === 'forn' ? ' list="sp-forn"' : '') + '>' : '<b>' + esc(v == null || v === '' ? '–' : num0 ? nfq.format(v) : v) + '</b>') + '</label>'; };
  var sIn = function (campoK, rot, v, ops, rots) { return '<label>' + rot + (ed ? '<select ' + h(function (el) { supSet(p, I, campoK, rot, el.value || null); }) + '><option value="">' + (campoK === 'st' ? 'Automático (' + esc(I.stAuto ? I.st : 'Não iniciado') + ')' : 'Automática (' + esc(campoK === 'cat' ? supCat(I.nome, I.tipo) : I.respAuto || (I.orig === 'CPU' && I.tipo !== 'EQ' ? 'Contratada' : 'A definir')) + ')') + '</option>' + ops.map(function (x) { return '<option value="' + esc(x) + '"' + (v === x ? ' selected' : '') + '>' + esc(rots ? rots[x] : x) + '</option>'; }).join('') + '</select>' : '<b>' + esc(v || '–') + '</b>') + '</label>'; };
  var ap = function (k, v) { return '<dt>' + k + '</dt><dd>' + v + '</dd>'; };
  var s = '<div class="sp-dh"><span class="sp-c ' + SUP_CRITC[I.crit] + '">' + I.crit + '</span>' + (I.motivo ? '<span class="vz">' + esc(I.motivo) + '</span>' : '') + '<span style="flex:1"></span><span class="vz">' + esc(SUP_ORIG[I.orig]) + (I.cod ? ' · ' + esc(I.cod) : '') + '</span></div>';
  if (I.impacto) s += '<div class="sp-av sp-avr">' + esc(I.impacto) + '</div>';
  if (I.al.length) s += '<div class="sp-als">' + I.al.map(function (a) { return '<span class="chip' + (/VENC|ENT_APOS|CAM_CRIT/.test(a) ? ' crit' : /_PEND|CONF|NAO_CONTR|SEM_FORN|QTD/.test(a) ? ' warn' : '') + '">' + SUP_AL[a] + '</span>'; }).join('') + '</div>';
  s += '<dl class="sp-dl">' + ap('Necessidade (próxima frente)', supFd(I.nec) + (I.nec1 != null && I.nec1 !== I.nec ? ' <span class="vz">1ª: ' + fdate(I.nec1) + '</span>' : '')) + ap('Limite de recebimento', supFd(I.lRec)) + ap('Limite de pedido', supFd(I.lPed)) + ap('Início da aquisição', supFd(I.lAq)) + ap('Lead time total', I.lead == null ? '<i class="sp-pd">pendente</i>' : int(I.lead) + ' dia(s) ' + (util ? 'úteis' : 'corridos')) +
    ap('Quantidade total', I.q == null ? '<i class="sp-pd">pendente</i>' : supQ(I.q) + ' ' + esc(I.u) + (I.qInf ? ' <span class="vz">(informada)</span>' : '')) + ap('Recebido', I.qRec == null ? '–' : supQ(I.qRec) + ' ' + esc(I.u) + ' <span class="vz">(' + esc(I.qRecOrig) + ')</span>') + ap('Saldo a receber', I.saldo == null ? '–' : supQ(I.saldo) + ' ' + esc(I.u)) +
    ap('Entrega prevista', I.dtPrev == null ? '–' : fdate(I.dtPrev) + ' <span class="vz">(' + esc(I.prevOrig) + ')</span>') + ap('Folga / atraso', I.dias == null ? '–' : '<span class="' + (I.dias < 0 ? 'sp-neg' : 'sp-pos') + '">' + (I.dias > 0 ? '+' : '') + int(I.dias) + ' dia(s)</span> <span class="vz">' + esc(I.diasRot) + '</span>') +
    ap('Folga da atividade', I.folgaAt == null ? '–' : int(Math.round(I.folgaAt)) + ' dia(s) útil(eis)' + (I.folgaAt <= 1 ? ' <b class="sp-neg">crítica</b>' : '')) + '</dl>';
  s += '<h4 class="sp-h4">Classificação e acompanhamento</h4><div class="sp-fm">' +
    sIn('cat', 'Categoria', o.cat, SUP_CAT) + sIn('resp', 'Responsabilidade de fornecimento', o.resp, SUP_RESP, SUP_RESPN) + sIn('st', 'Status', o.st, SUP_ST) +
    tIn('forn', 'Fornecedor', o.forn, I.resp === 'Contratante' ? 'opcional para itens da contratante' : 'fornecedor previsto ou contratado') +
    dIn('dtPed', 'Pedido emitido em', o.dtPed) + tIn('qPed', 'Quantidade pedida', o.qPed, '', 1) + dIn('dtPrev', 'Data prevista de entrega (fornecedor)', o.dtPrev) +
    (I.lotes.length ? '' : tIn('qRec', 'Quantidade recebida', o.qRec, '', 1)) + dIn('dtRec', 'Data efetiva de recebimento', o.dtRec) + dIn('dtLib', 'Liberado para utilização em', o.dtLib) +
    (I.resp === 'Contratante' || I.resp === 'Compartilhado' ? dIn('conf', 'Contratante confirmou disponibilidade em', o.conf) : '') +
    '<label class="sp-w2">Observações' + (ed ? '<input type="text" value="' + esc(o.obs || '') + '" ' + h(function (el) { supSet(p, I, 'obs', 'Observações', el.value.trim() || null); }) + '>' : '<b>' + esc(o.obs || '–') + '</b>') + '</label></div>' +
    (I.resp === 'Contratante' ? '' : '<h4 class="sp-h4">Valor e pagamento <span class="vz" style="font-weight:500">· vai para o Fluxo de caixa</span></h4><div class="sp-fm">' +
      tIn('valor', 'Valor da compra (R$)', o.valor, 'valor do pedido', 1) + tIn('pgDias', 'Pagamento: dias após a entrega', o.pgDias, '30 (0 = na entrega; negativo = antecipado)', 1) +
      dIn('dtPag', 'Pago em', o.dtPag) + tIn('vPag', 'Valor pago (R$)', o.vPag, 'se diferente do valor da compra', 1) + '</div>');
  s += '<h4 class="sp-h4">Planejamento</h4><div class="sp-fm">' +
    ((I.orig === 'CRO' || I.orig === 'SUG' || I.orig === 'MAN' || I.q == null) ? tIn('q', 'Quantidade total (' + esc(I.u || 'un.') + ')', o.q, 'pendente – informe', 1) : '') +
    ((I.orig === 'CRO' || I.orig === 'SUG') ? tIn('u', 'Unidade', o.u, I.u || 'un.') : '') +
    '<label>Consumo' + (ed ? '<select ' + h(function (el) { supSet(p, I, 'modo', 'Consumo', el.value || null, function (x) { return x === 'I' ? 'No início da atividade' : x === 'P' ? 'Progressivo' : ''; }); }) + '><option value="">Automático</option><option value="I"' + (o.modo === 'I' ? ' selected' : '') + '>Todo no início da atividade</option><option value="P"' + (o.modo === 'P' ? ' selected' : '') + '>Progressivo ao longo da execução</option></select>' : '<b>' + (I.modo === 'I' ? 'No início' : 'Progressivo') + '</b>') + '</label>' +
    ((I.orig === 'CRO' || I.orig === 'SUG' || I.orig === 'MAN') ? tIn('kw', 'Vínculo: palavras-chave da atividade', o.kw, (I.tk || []).join(' ').toLowerCase()) : '') +
    (I.orig === 'SUG' && ed ? '<label>Sugestão<button class="lk dn" ' + h(function () { supSet(p, I, 'off', 'Sugestão desativada', 1); S.v.dlg = null; }) + '>Não se aplica – remover do mapa</button></label>' : '') + '</div>';
  var dc = (supDados(p).cfg.cat[I.cat]) || {};
  s += '<div class="sp-pzg">' + SUP_PZ.concat([['mg', 'Margem de segurança']]).map(function (z) {
    var vi = z[0] === 'mg' ? o.mg : (o.pz || {})[z[0]], vc = z[0] === 'mg' ? supDados(p).cfg.margem : dc[z[0]];
    return '<label>' + z[1] + (ed ? '<input type="text" inputmode="numeric" value="' + (vi == null ? '' : esc(vi)) + '" placeholder="' + (vc == null || vc === '' ? 'pendente' : 'categoria: ' + vc) + '" ' + h(function (el) {
      var x = el.value.trim() === '' ? null : Math.max(0, Math.round(parseNum(el.value))), Ed = supEd(p), oo = Ed.it[I.k] || (Ed.it[I.k] = {});
      if (z[0] === 'mg') { if (x == null) delete oo.mg; else oo.mg = x; } else { oo.pz = oo.pz || {}; if (x == null) delete oo.pz[z[0]]; else oo.pz[z[0]] = x; if (!Object.keys(oo.pz).length) delete oo.pz; }
      supLog(p, I, 'Prazo – ' + z[1], vi, x); supSalvar(p); agendar();
    }) + '>' : '<b>' + (vi != null ? vi : vc != null ? vc : '–') + '</b>') + '</label>';
  }).join('') + '</div><p class="vz sp-np">Prazos em dias ' + (util ? 'úteis' : 'corridos') + '. Vazio = usa o prazo da categoria' + (I.pzPend.length ? '; ainda pendentes: ' + esc(I.pzPend.join(', ')) : '') + '.</p>';
  /* necessidade por frente */
  s += '<h4 class="sp-h4">Necessidade por frente de serviço <span class="vz">' + int(I.fr.length) + '</span></h4><div class="tw sp-dtw"><table class="g sp-t"><thead><tr><th>Frente</th><th class="l">Primeira atividade que consome</th><th>Início</th><th>Término</th><th>Quantidade</th><th>Necessidade</th><th>Limite receb.</th><th>Limite pedido</th><th>Início aquisição</th><th>Entrega prevista</th><th>Recebido</th><th>Folga</th><th>Folga ativ.</th><th>Criticidade</th></tr></thead><tbody>' +
    I.fr.map(function (x) {
      var c0 = x.c0, at = c0 ? (c0.t.w ? c0.t.w + ' ' : '') + c0.t.n : '<i class="sp-pd">sem atividade</i>';
      return '<tr class="' + (x.nv ? SUP_CRITC[x.nv] : '') + '"><td class="c">' + esc(x.fr || 'Geral') + '</td><td class="l w">' + (c0 ? esc(at) : at) + (x.cons.length > 1 ? ' <span class="vz">+' + (x.cons.length - 1) + '</span>' : '') + '</td><td class="c">' + supFd(c0 ? Math.floor(c0.i) : null, false) + '</td><td class="c">' + supFd(x.fimC, false) + '</td><td class="n">' + (x.q == null ? '–' : supQ(x.q) + (I.orig === 'CRO' || I.orig === 'SUG' || I.orig === 'MAN' ? ' <span class="vz" data-tip="Rateio da quantidade informada pelo valor das atividades da frente">rateio</span>' : '')) + '</td>' +
        '<td class="c">' + supFd(x.nec) + '</td><td class="c">' + supFd(x.lRec) + '</td><td class="c">' + supFd(x.lPed) + '</td><td class="c">' + supFd(x.lAq) + '</td><td class="c">' + (x.prev == null ? '–' : fdate(x.prev) + (x.prevOrig === 'cronograma' ? ' <span class="vz">cron.</span>' : '')) + '</td><td class="c">' + (x.rec != null ? '<span class="sp-pos">' + fdate(x.rec) + '</span>' : x.pcL != null ? pct(x.pcL / 100) : '–') + '</td>' +
        '<td class="n">' + (x.desv != null ? '<span class="' + (x.desv < 0 ? 'sp-neg' : 'sp-pos') + '">' + (x.desv > 0 ? '+' : '') + int(x.desv) + '</span>' : x.desvNec != null ? '<span class="' + (x.desvNec < 0 ? 'sp-neg' : 'sp-pos') + '" data-tip="até a data de necessidade (limite de recebimento pendente)">' + (x.desvNec > 0 ? '+' : '') + int(x.desvNec) + '*</span>' : '–') + '</td><td class="n">' + (x.folga == null ? '–' : int(Math.round(x.folga))) + '</td><td class="c">' + (x.nv ? '<span class="sp-c ' + SUP_CRITC[x.nv] + '">' + x.nv + '</span>' : x.rec != null ? '<span class="sp-c sp-ok">Concluído</span>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  /* atividades e lotes */
  var at = I.cons.slice().sort(function (a, b) { return a.i - b.i; });
  if (at.length) s += '<details class="sp-det"><summary class="lk">Atividades vinculadas (' + at.length + ')</summary><div class="tw sp-dtw"><table class="g sp-t"><thead><tr><th>EAP</th><th class="l">Atividade</th><th>Frente</th><th>Local</th><th>Início</th><th>Término</th><th>Quantidade</th></tr></thead><tbody>' + at.slice(0, 300).map(function (c) { return '<tr><td class="c">' + esc(c.t.w || '') + '</td><td class="l w">' + esc(c.t.n) + '</td><td class="c">' + esc(c.fr || '') + '</td><td class="c">' + esc(c.t.sc || '') + '</td><td class="c">' + fdate(Math.floor(c.i)) + '</td><td class="c">' + fdate(Math.floor(c.f || c.i)) + '</td><td class="n">' + (c.q == null ? '–' : supQ(c.q)) + '</td></tr>'; }).join('') + '</tbody></table></div></details>';
  if (I.lotes.length) s += '<details class="sp-det"><summary class="lk">Entregas programadas no cronograma (' + I.lotes.length + ')</summary><div class="tw sp-dtw"><table class="g sp-t"><thead><tr><th>EAP</th><th class="l">Tarefa</th><th>Frente</th><th>Início</th><th>Término</th><th>% realizado</th><th>Término real</th></tr></thead><tbody>' + I.lotes.map(function (l) { return '<tr><td class="c">' + esc(l.t.w) + '</td><td class="l w">' + esc(l.t.n) + '</td><td class="c">' + esc(l.fr || '') + '</td><td class="c">' + fdate(Math.floor(l.ini)) + '</td><td class="c">' + fdate(Math.floor(l.fim)) + '</td><td class="c">' + pct(num(l.pc) / 100) + '</td><td class="c">' + (l.af ? fdate(Math.floor(l.af)) : '') + '</td></tr>'; }).join('') + '</tbody></table></div></details>';
  /* consumo programado */
  if (I.modo === 'P' && I.q != null && I.cons.length) {
    var acc = {}; I.cons.forEach(function (c) { var q = c.q != null ? c.q : I.q * (num(c.bc) / (I.cons.reduce(function (a, z) { return a + num(z.bc); }, 0) || 1)); croSpread(acc, KMES, c.i, c.f, q); });
    var ms = Object.keys(acc).map(Number).sort(function (a, b) { return a - b; });
    if (ms.length) s += '<details class="sp-det" open><summary class="lk">Consumo programado por mês</summary><div class="tw"><table class="g sp-t"><thead><tr>' + ms.map(function (m) { return '<th>' + mmaa(m) + '</th>'; }).join('') + '</tr></thead><tbody><tr>' + ms.map(function (m) { return '<td class="n">' + supQ(acc[m]) + '</td>'; }).join('') + '</tr></tbody></table></div></details>';
  }
  s += '<datalist id="sp-forn">' + (S.clientes || []).map(function (c) { return '<option value="' + esc(c.fantasia || c.razao || '') + '">'; }).join('') + '</datalist>';
  s += '<div class="bts"><button class="bt" ' + h(fechar) + '>Fechar</button></div>';
  return janela(I.nome + (I.u ? ' (' + I.u + ')' : '') + ' · ' + I.cat + ' · ' + SUP_RESPN[I.resp], s, 1080, fechar);
}
function dlgSupNovo(d) {
  var p = proj(), m = d.m, fechar = function () { S.v.dlg = null; agendar(); };
  var f = function (k, rot, o) { o = o || {}; return '<label>' + rot + (o.ops ? '<select ' + h(function (el) { m[k] = el.value; }) + '><option value=""></option>' + o.ops.map(function (x) { return '<option' + (m[k] === x ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>' : '<input type="' + (o.date ? 'date' : 'text') + '" value="' + esc(m[k] == null ? '' : o.n ? numIn(m[k]) : m[k]) + '" placeholder="' + esc(o.ph || '') + '" ' + h(function (el) { m[k] = o.n ? (el.value.trim() === '' ? null : parseNum(el.value)) : el.value.trim(); }) + '>') + '</label>'; };
  var s = '<div class="sp-fm">' + f('nome', 'Insumo / equipamento', { ph: 'ex.: Transformador elevador 34,5/138 kV' }) + f('cod', 'Código', { ph: 'opcional' }) + f('cat', 'Categoria', { ops: SUP_CAT }) + f('u', 'Unidade', { ph: 'un., m, kg…' }) + f('q', 'Quantidade total', { n: 1, ph: 'deixe vazio se ainda não souber' }) +
    f('resp', 'Responsabilidade de fornecimento', { ops: SUP_RESP }) + '<label class="sp-w2">Vínculo: palavras-chave da atividade que consome<input type="text" value="' + esc(m.kw || '') + '" placeholder="ex.: montagem transformador" ' + h(function (el) { m.kw = el.value.trim(); }) + '></label>' + f('dn', 'Ou data de necessidade (se não houver atividade)', { date: 1 }) + '</div>' +
    '<p class="vz">A data de necessidade vem da primeira atividade do cronograma que tenha todas as palavras-chave no nome (sem acentos e no singular ou plural).</p>';
  s += '<div class="bts">' + bt('SALVAR', function () {
    if (!m.nome) return aviso('Informe o nome do insumo.');
    var Ed = supEd(p); if (d.i != null) { Ed.man[d.i] = m; } else { m.id = Date.now().toString(36); Ed.man.push(m); }
    supLog(p, { k: 'M:' + m.id, nome: m.nome }, d.i != null ? 'Insumo editado' : 'Insumo inserido', '', m.nome); supSalvar(p); S.v.dlg = null;
  }) + bt('CANCELAR', fechar, 'cz') + '</div>';
  return janela(d.i != null ? 'Editar insumo' : 'Inserir insumo no mapa', s, 640, fechar);
}
/* ---------- exportação ---------- */
function supExcel(p, M, L, cols) {
  carregaXlsx().then(function (XL) {
    var wb = XL.utils.book_new(), cab = [['OP CONSULTING · Planning Projects'], ['Mapa de suprimentos – ' + p.nome], ['Gerado em ' + fdate(M.hoje) + ' · ' + L.length + ' insumos (filtros aplicados)'], []];
    var a1 = cab.concat([cols.map(function (c) { return c[1]; })], L.map(function (I) { return cols.map(function (c) { var v = supCel(I, c[0], true); if (c[0] === 'q' || c[0] === 'qn' || c[0] === 'qrec' || c[0] === 'saldo') { var n0 = c[0] === 'q' ? I.q : c[0] === 'qn' ? (I.F0 || {}).q : c[0] === 'qrec' ? I.qRec : I.saldo; return n0 == null ? (c[0] === 'q' ? 'pendente' : '') : Math.round(n0 * 100) / 100; } return v; }); }));
    var ws1 = XL.utils.aoa_to_sheet(a1); ws1['!cols'] = cols.map(function (c) { return { wch: c[0] === 'nome' || c[0] === 'ativ' || c[0] === 'imp' ? 42 : 16 }; }); XL.utils.book_append_sheet(wb, ws1, 'Mapa');
    var a2 = cab.concat([['Código', 'Insumo', 'Frente', 'EAP', 'Primeira atividade', 'Início', 'Término', 'Quantidade', 'Necessidade', 'Limite recebimento', 'Limite pedido', 'Início aquisição', 'Entrega prevista', 'Recebido em', 'Folga (dias)', 'Folga da atividade', 'Criticidade']]);
    L.forEach(function (I) { I.fr.forEach(function (x) { var c0 = x.c0; a2.push([I.cod, I.nome, x.fr || 'Geral', c0 ? c0.t.w || '' : '', c0 ? c0.t.n : '', c0 ? fdate(Math.floor(c0.i)) : '', x.fimC != null ? fdate(x.fimC) : '', x.q == null ? '' : Math.round(x.q * 100) / 100, supFdT(x.nec), supFdT(x.lRec), supFdT(x.lPed), supFdT(x.lAq), x.prev != null ? fdate(x.prev) : '', x.rec != null ? fdate(x.rec) : '', x.desv != null ? x.desv : '', x.folga != null ? Math.round(x.folga) : '', x.nv || (x.rec != null ? 'Concluído' : '')]); }); });
    XL.utils.book_append_sheet(wb, XL.utils.aoa_to_sheet(a2), 'Por frente');
    var a3 = cab.concat([['Insumo', 'Criticidade', 'Alerta', 'Impacto']]); L.forEach(function (I) { I.al.forEach(function (a) { a3.push([I.nome, I.crit, SUP_AL[a], I.impacto]); }); });
    XL.utils.book_append_sheet(wb, XL.utils.aoa_to_sheet(a3), 'Alertas');
    baixar(semAcento((p.sigla ? p.sigla + '-' : '') + 'Mapa-de-suprimentos-' + p.nome).replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) + '.xlsx', XL.write(wb, { bookType: 'xlsx', type: 'array' }));
  }, function (e) { msgbox('ERRO!', e.message, 'crit'); });
}
var URL_JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', URL_JSPDF_AT = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
function carregaScript(url, ok0) { return new Promise(function (ok, erro) { if (ok0()) return ok(); var sc = document.createElement('script'); sc.src = url; sc.onload = function () { ok0() ? ok() : erro(new Error('biblioteca indisponível')); }; sc.onerror = function () { erro(new Error('não foi possível carregar o gerador de PDF')); }; document.head.appendChild(sc); }); }
function supPdf(p, M, L, cols, V) {
  carregaScript(URL_JSPDF, function () { return window.jspdf && window.jspdf.jsPDF; }).then(function () { return carregaScript(URL_JSPDF_AT, function () { return window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API.autoTable; }); }).then(function () {
    var doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: cols.length > 12 ? 'a3' : 'a4' }), W = doc.internal.pageSize.getWidth();
    var fil = [['cat', 'Categoria'], ['resp', 'Responsabilidade'], ['st', 'Status'], ['crit', 'Criticidade'], ['eap', 'EAP'], ['fr', 'Frente'], ['forn', 'Fornecedor'], ['b', 'Busca']].filter(function (f) { return V[f[0]]; }).map(function (f) { return f[1] + ': ' + V[f[0]]; });
    if (V.de || V.ate) fil.push('Recebimento: ' + (V.de ? mmaa(V.de) : '…') + ' a ' + (V.ate ? mmaa(V.ate) : '…')); if (V.ab) fil.push('Só em aberto'); if (V.risco) fil.push('Só com risco no cronograma');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('MAPA DE SUPRIMENTOS – ' + String(p.nome || ''), 10, 12);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90);
    doc.text('Gerado em ' + fdate(M.hoje) + ' · ' + L.length + ' de ' + M.itens.length + ' insumos · ' + (fil.length ? 'Filtros: ' + fil.join(' · ') : 'Sem filtros') + ' · Prazos em ' + (M.util ? 'dias úteis' : 'dias corridos'), 10, 17);
    var cor = { 'Crítica': [200, 50, 43], 'Alta': [232, 118, 44], 'Média': [242, 180, 0], 'Baixa': [46, 158, 91], 'Indefinida': [154, 164, 178], 'Concluído': [91, 141, 239] };
    var ic = cols.map(function (c) { return c[0]; }).indexOf('crit');
    doc.autoTable({
      startY: 21, head: [cols.map(function (c) { return c[1]; })], body: L.map(function (I) { return cols.map(function (c) { var v = supCel(I, c[0], true); return v == null ? '' : String(v); }); }),
      styles: { fontSize: cols.length > 12 ? 6.6 : 7.2, cellPadding: 1.2, overflow: 'linebreak', valign: 'middle' }, headStyles: { fillColor: [23, 105, 232], textColor: 255, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: (function () { var o = {}; cols.forEach(function (c, i) { if (c[0] === 'nome' || c[0] === 'ativ' || c[0] === 'imp') o[i] = { cellWidth: c[0] === 'imp' ? 50 : 42 }; }); return o; })(),
      didParseCell: function (d0) { if (d0.section === 'body' && d0.column.index === ic) { var c = cor[d0.cell.raw]; if (c) { d0.cell.styles.fillColor = c; d0.cell.styles.textColor = 255; d0.cell.styles.fontStyle = 'bold'; } } },
      didDrawPage: function () { doc.setFontSize(7); doc.setTextColor(120); doc.text('OP Consulting · Planning Projects · página ' + doc.internal.getNumberOfPages(), W - 10, doc.internal.pageSize.getHeight() - 5, { align: 'right' }); }
    });
    baixar(semAcento((p.sigla ? p.sigla + '-' : '') + 'Mapa-de-suprimentos-' + p.nome).replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) + '.pdf', doc.output('arraybuffer'));
  }).catch(function (e) { msgbox('ERRO!', e.message, 'crit'); });
}
/* ---------- menu: Planejamento › Mapa de suprimentos (depois do cronograma) ---------- */
NOMES.SUP = 'Mapa de suprimentos'; PRECISA_PROJ.SUP = 1; ABAS.push(['SUP', '#005a9c']);
ICA.SUP = '<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/><path d="M7.5 5l9 4"/>';
(function () { GRUPOS_ABAS.forEach(function (g) { if (g[0] === 'Planejamento' && g[1].indexOf('SUP') < 0) { var i = g[1].indexOf('CRO'); g[1].splice(i >= 0 ? i + 1 : g[1].length, 0, 'SUP'); } }); })();

/* ================= CADASTRO DE USUÁRIOS: seções e projetos por usuário (editar · visualizar · sem acesso) ================= */
NOMES.USR = 'Cadastro de usuários'; ABAS.push(['USR', '#1769e8']);
ICA.USR = '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5"/><path d="M17 10.5l1.6 1.6 3-3.2"/>';
(function () { GRUPOS_ABAS.forEach(function (g) { if (g[0] === 'Sistema' && g[1].indexOf('USR') < 0) { var i = g[1].indexOf('CLI'); g[1].splice(i >= 0 ? i + 1 : g[1].length, 0, 'USR'); } }); })();
var USR_NIV = { E: 'Editar', V: 'Visualizar', '': 'Sem acesso' };
function usrSlug(em) { return 'u-' + String(em || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80); }
function usrSalvar(u) { var d = {}; Object.keys(u).forEach(function (k) { if (k !== 'id' && k.charAt(0) !== '_') d[k] = u[k]; }); gravar('usuarios/' + u.id, d); }
function usrGrupos() {
  return GRUPOS_ABAS.map(function (g) { return [g[0] || 'Geral', g[1].filter(function (k) { return k !== 'PROJETOS' && k !== 'MANUAL' && USR_ADMIN_ABAS.indexOf(k) < 0 && NOMES[k]; })]; }).filter(function (g) { return g[1].length; });
}
function usrNivelSec(u, k) { var v = u.secoes && u.secoes[k] != null ? u.secoes[k] : u.secPadrao == null ? 'V' : u.secPadrao; if (v === 'E' && USR_BANCO_ABAS.indexOf(k) >= 0) v = 'V'; return v || ''; }
function usrNivelPrj(u, id) { var v = u.projetos && u.projetos[id] != null ? u.projetos[id] : u.projPadrao || ''; return v || ''; }
function usrProx(v, banco) { return banco ? (v === 'V' ? '' : 'V') : v === '' ? 'V' : v === 'V' ? 'E' : ''; }
function usrAcessos() {
  if (S._acc || !db || !ehAdmin()) return; S._acc = { uid: {}, em: {} };
  db.collection('acessos').get().then(function (r) {
    var ids = []; r.docs.forEach(function (d) { S._acc.uid[d.id] = (d.data() || {}).u; ids.push(d.id); });
    if (!ids.length || !usr || !usr.profiles) return agendar();
    return usr.profiles(ids).then(function (ps) { ids.forEach(function (i) { var e = ps && ps[i] && ps[i].email; if (e) S._acc.em[String(e).toLowerCase()] = S._acc.uid[i]; }); agendar(); });
  }).catch(function () { });
}
function usrUltimo(u) { var a = S._acc || { uid: {}, em: {} }; return (u.uid && a.uid[u.uid]) || a.em[String(u.email || '').toLowerCase()] || ''; }
function fdh(iso) { if (!iso) return '—'; var d = new Date(iso); if (isNaN(d)) return '—'; var z = function (n) { return ('0' + n).slice(-2); }; return z(d.getDate()) + '/' + z(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()); }
function shUsr() {
  var V = S.v.usr || (S.v.usr = { em: '', nome: '', cp: '', bl: '' }), adm = ehAdmin() && !!db, L = (S.usuarios || []).slice().sort(function (a, b) { return ordAlfa(a.email || '', b.email || ''); });
  usrAcessos();
  var cfgU = S.usrCfg || {};
  var s = titulo('CADASTRO DE USUÁRIOS', '<input type="search" placeholder="Buscar e-mail ou nome" aria-label="Buscar usuário" value="' + esc(V.bl) + '" data-live ' + h(function (el) { V.bl = el.value; agendar(); }) + '>');
  s += '<div class="usr-top">' + cfgCard('Novo usuário', window.PP_CONFIG ? 'Cadastre pelo e-mail com que a pessoa cria a conta na tela de entrada. As permissões valem assim que ela entrar.' : 'Cadastre pelo e-mail da conta Claude da pessoa. Ela também precisa estar convidada no compartilhamento desta página (Colaborador para editar projetos; Editor para administradores).',
    '<div class="usr-nv"><input type="email" placeholder="email@empresa.com.br" aria-label="E-mail do novo usuário" value="' + esc(V.em) + '" data-live ' + h(function (el) { V.em = el.value; }) + '>' +
    '<input placeholder="Nome (opcional)" aria-label="Nome" value="' + esc(V.nome) + '" data-live ' + h(function (el) { V.nome = el.value; }) + '>' +
    '<select aria-label="Copiar permissões de" ' + h(function (el) { V.cp = el.value; }) + '><option value="">Permissões padrão</option>' + L.map(function (u) { return '<option value="' + esc(u.id) + '"' + (V.cp === u.id ? ' selected' : '') + '>Copiar de ' + esc(u.email) + '</option>'; }).join('') + '</select>' +
    '<button class="bt" ' + (adm ? '' : 'disabled ') + h(function () {
      var em = String(V.em || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return aviso('Digite um e-mail válido.');
      if (L.some(function (u) { return String(u.email).toLowerCase() === em; })) return aviso('Este e-mail já está cadastrado.');
      var base = L.filter(function (u) { return u.id === V.cp; })[0], u = { id: usrSlug(em), email: em, nome: String(V.nome || '').trim(), criado: new Date().toISOString(), admin: base ? !!base.admin : false, secoes: base ? clone(base.secoes || {}) : {}, projetos: base ? clone(base.projetos || {}) : {}, secPadrao: base ? (base.secPadrao == null ? 'V' : base.secPadrao) : 'V', projPadrao: base ? base.projPadrao || '' : '' };
      S.usuarios.push(u); usrSalvar(u); V.em = ''; V.nome = ''; V.cp = ''; V.sel = u.id; agendar();
    }) + '>+ Cadastrar</button></div>') +
    cfgCard('Quem não está cadastrado', 'Vale para pessoas que abrem a página e não aparecem nesta lista.',
      '<div class="usr-pol">' + [['V', 'Visualiza os projetos liberados'], ['N', 'Não vê nenhum projeto']].map(function (o) {
        var on = (cfgU.semCadastro || 'V') === o[0];
        return '<button class="' + (on ? 'on' : '') + '" ' + (adm ? '' : 'disabled ') + h(function () { S.usrCfg = Object.assign({}, cfgU, { semCadastro: o[0] }); gravar('usuarios/_cfg', { semCadastro: o[0] }); agendar(); }) + '>' + o[1] + '</button>';
      }).join('') + '</div>') + '</div>';
  s += '<div class="usr-leg"><span class="uc E">Editar</span><span class="uc V">Visualizar</span><span class="uc">Sem acesso</span><small>Clique no item para trocar o nível. Bancos de dados e composições: somente visualizar (edição só por administradores). Sistema: somente administradores.</small></div>';
  var bl = semAcento(V.bl || ''), F = L.filter(function (u) { return !bl || semAcento((u.email || '') + ' ' + (u.nome || '')).indexOf(bl) >= 0; });
  if (!L.length) return s + '<div class="vazio"><h3>Nenhum usuário cadastrado</h3><p>Enquanto a lista estiver vazia, quem abre a página segue a regra “Quem não está cadastrado”. O dono da página é sempre administrador.</p></div>';
  var G = usrGrupos(), P = S.projetos.slice().sort(function (a, b) { return ordAlfa(a.nome || '', b.nome || ''); });
  s += F.map(function (u) {
    var sv = function () { usrSalvar(u); agendar(); };
    var setSec = function (k, v) { u.secoes = u.secoes || {}; u.secoes[k] = v; };
    var cab = '<div class="usr-cab"><div><b>' + esc(u.email) + '</b>' + (u.nome ? ' <span class="usr-nm">' + esc(u.nome) + '</span>' : '') + '<small>Criado em ' + fdh(u.criado) + ' · Último acesso ' + fdh(usrUltimo(u)) + '</small></div>' +
      '<label class="usr-adm"><input type="checkbox"' + (u.admin ? ' checked' : '') + (adm ? '' : ' disabled') + ' ' + h(function (el) { u.admin = !!el.checked; sv(); }) + '> Administrador</label>' +
      (adm ? '<button class="usr-del" aria-label="Excluir usuário" data-tip="Excluir usuário" ' + h(function () { confirma('Excluir o usuário ' + u.email + '?\n\nEle passa a seguir a regra de quem não está cadastrado.', function () { S.usuarios = S.usuarios.filter(function (x) { return x !== u; }); gravar('usuarios/' + u.id, null); agendar(); }); }) + '><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/></svg></button>' : '') + '</div>';
    if (u.admin) return '<div class="cs usr">' + cab + '<p class="aj">Administrador: acessa e edita todas as seções e todos os projetos, inclusive bancos de dados, composições e Sistema.</p></div>';
    var chip = function (k, rot, v, banco, fn) { return '<button class="uc ' + v + '"' + (adm ? '' : ' disabled') + ' data-tip="' + USR_NIV[v] + (banco ? ' · edição só por administradores' : '') + '" ' + h(function () { fn(usrProx(v, banco)); sv(); }) + '>' + (v === 'E' ? '✎ ' : v === 'V' ? '👁 ' : '') + esc(rot) + '</button>'; };
    var todos = function (fnE, fnV, fn0) { return adm ? '<span class="usr-tod">' + (fnE ? '<button class="lk" ' + h(function () { fnE(); sv(); }) + '>Editar todas</button> · ' : '') + '<button class="lk" ' + h(function () { fnV(); sv(); }) + '>Ver todas</button> · <button class="lk" ' + h(function () { fn0(); sv(); }) + '>Nenhuma</button></span>' : ''; };
    var secs = G.map(function (g) {
      var all = function (v) { return function () { g[1].forEach(function (k) { setSec(k, v === 'E' && USR_BANCO_ABAS.indexOf(k) >= 0 ? 'V' : v); }); }; };
      return '<div class="usr-g"><h5>' + esc(g[0]) + todos(g[1].every(function (k) { return USR_BANCO_ABAS.indexOf(k) >= 0; }) ? null : all('E'), all('V'), all('')) + '</h5><div class="usr-ch">' + g[1].map(function (k) { var b = USR_BANCO_ABAS.indexOf(k) >= 0; return chip(k, NOMES[k], usrNivelSec(u, k), b, function (v) { setSec(k, v); }); }).join('') + '</div></div>';
    }).join('');
    var allP = function (v) { return function () { u.projetos = {}; u.projPadrao = v; }; };
    var prjs = '<div class="usr-g"><h5>Por projeto' + todos(allP('E'), allP('V'), allP('')) + '</h5><div class="usr-ch">' + (P.length ? P.map(function (p) { return chip(p.id, (p.nome || 'Sem nome') + (p.liberado ? '' : ' · rascunho'), usrNivelPrj(u, p.id), false, function (v) { u.projetos = u.projetos || {}; u.projetos[p.id] = v; }); }).join('') : '<small>Nenhum projeto.</small>') + '</div>' +
      '<p class="aj">Novos projetos: ' + USR_NIV[u.projPadrao || ''].toLowerCase() + '. Rascunhos só ficam visíveis depois de liberados.</p></div>';
    return '<div class="cs usr">' + cab + '<div class="usr-cols"><div><h4>Seções</h4>' + secs + '</div><div><h4>Projetos</h4>' + prjs + '</div></div></div>';
  }).join('') + (F.length ? '' : '<div class="vazio">Nenhum usuário encontrado.</div>');
  return s;
}


/* ================= REVISÕES DO PROJETO =================
   O projeto nasce na Rev. 00, que é a linha de base inicial. "Nova revisão" congela a revisão em edição
   (cópia completa em <raiz>/<id>/revs/<NN>: dados do projeto, atividades, base própria, cronograma, mapas) e abre a seguinte.
   Revisões fixas não podem ser alteradas: abrem só para leitura, podem ser duplicadas para teste (novo projeto em rascunho)
   ou restauradas (o conteúdo delas vira a próxima revisão). O RDO é um registro diário e não muda com a revisão.
   Meta: p.rev = { atual: 'NN', lista: [{ n, criada, por, obs }] }. */
var REV_SUB = ['ativ', 'base', 'crono', 'mapas'];
function revAtual(p) { return (p && p.rev && p.rev.atual) || '00'; }
function revLista(p) { return (p && p.rev && p.rev.lista) || []; }
function revNum(n) { return ('0' + n).slice(-2); }
function revFaixa(p) {
  var base = p._rev ? S.projetos.filter(function (x) { return x.id === p._orig; })[0] : p, rot = p._rev ? 'Rev. ' + p._rev + ' · fixa' : 'Rev. ' + revAtual(base) + ' · em edição';
  return '<div class="row rev-row"><button class="rev-bt' + (p._rev ? ' fixa' : '') + '" data-tip="Revisões do projeto" ' + h(function () { S.v.dlg = { tipo: 'rev' }; agendar(); }) + '>' + rot + ' ▾</button>' +
    (ehAdmin() && db && !p._rev ? '<button class="lk" data-tip="Congela a revisão atual e abre a próxima" ' + h(function () { S.v.dlg = { tipo: 'rev', nova: { obs: '' } }; agendar(); }) + '>Nova revisão</button>' : '') + '</div>';
}
/* espera a fila de gravação esvaziar (para copiar o que já está no servidor) */
function revEsperaFila() {
  fila.forEach(function (q, k) { if (q.timer) { clearTimeout(q.timer); q.timer = null; descarregar(k); } });
  return new Promise(function (ok, nok) { var t0 = Date.now(); (function ve() { if (!fila.size) return ok(); if (Date.now() - t0 > 90000) return nok(new Error('as alterações pendentes ainda não foram salvas')); setTimeout(ve, 300); })(); });
}
/* copia os documentos de uma pasta de projeto para outra (subcoleções; o documento principal é tratado por quem chama) */
function revCopiar(de, para, apagar) {
  var tarefas = [];
  return Promise.all(REV_SUB.map(function (sc) {
    return db.collection(de + '/' + sc).get().then(function (r) { r.docs.forEach(function (d) { tarefas.push([para + '/' + sc + '/' + d.id, d.data()]); }); }, function () { });
  })).then(function () {
    if (!apagar) return;
    return Promise.all(REV_SUB.map(function (sc) {
      return db.collection(para + '/' + sc).get().then(function (r) { var novos = {}; tarefas.forEach(function (t) { novos[t[0]] = 1; }); r.docs.forEach(function (d) { var k = para + '/' + sc + '/' + d.id; if (!novos[k]) tarefas.push([k, null]); }); }, function () { });
    }));
  }).then(function () {
    var i = 0;
    var um = function () { if (i >= tarefas.length) return Promise.resolve(); var t = tarefas[i++]; return (t[1] === null ? db.doc(t[0]).delete() : db.doc(t[0]).set(t[1])).then(um); };
    return Promise.all([um(), um(), um(), um()]).then(function () { return tarefas.length; });
  });
}
function revProc(prom, fim) {
  S.v.dlg = { tipo: 'proc' }; render();
  return prom.then(function (r) { S.v.dlg = null; if (fim) fim(r); agendar(); }, function (e) { S.v.dlg = null; msgbox('ERRO!', 'Não foi possível concluir: ' + ((e && e.message) || e), 'crit'); });
}
function revCriar(p, obs) {
  var n = revAtual(p), dst = dirP(p) + '/revs/' + n, item = { n: n, criada: new Date().toISOString(), por: S.papel.nome || S.papel.email || '', obs: obs || '' };
  var ind = null;
  return revInd(p).then(function (o) { ind = o; }, function (e) { console.error('indicadores da revisão', e); }).then(revEsperaFila).then(function () { return revCopiar(dirP(p), dst); }).then(function () {
    var m = metaDe(p); m.rev = { atual: n, lista: revLista(p).concat([item]) };
    var doc = { n: n, criada: item.criada, por: item.por, obs: item.obs, meta: m }; if (ind) doc.ind = ind;
    if (S.revcD && S.revcD[p.id]) S.revcD[p.id].docs[n] = doc;
    return db.doc(dst).set(doc);
  }).then(function () {
    p.rev = { atual: revNum(+n + 1), lista: revLista(p).concat([item]) }; salvarMeta(p);
    return item;
  });
}
function revAbrir(p, n) {
  var k = p.id + '@' + n; S.revs = S.revs || {};
  if (S.revs[k]) { S.v.revVer = { pid: p.id, n: n }; return Promise.resolve(); }
  var dir = dirP(p) + '/revs/' + n, v;
  return db.doc(dir).get().then(function (d) {
    if (!d) throw new Error('a Rev. ' + n + ' não foi encontrada');
    v = clone(d.data().meta || {}); v.id = k; v._dir = dir; v._raiz = p._raiz; v._orig = p.id; v._rev = n; v.liberado = p.liberado; v.atividades = [];
    return db.collection(dir + '/ativ').get();
  }).then(function (as) {
    as.docs.forEach(function (x) { var a = clone(x.data()); a.id = x.id; a.linhas = a.linhas || []; v.atividades.push(a); });
    if (!v.basePropria) return;
    return db.collection(dir + '/base').get().then(function (bs) { if (bs.docs.length) { v._base = {}; bs.docs.forEach(function (x) { v._base[x.id] = clone(x.data()); }); } });
  }).then(function () { S.revs[k] = v; S.v.revVer = { pid: p.id, n: n }; });
}
/* duplica a revisão (ou a revisão em edição) como um projeto de teste, em rascunho */
function revDuplicar(p, n) {
  var src = n == null ? dirP(p) : dirP(p) + '/revs/' + n, id = uid(), dst = 'rascunhos/' + id, meta;
  return revEsperaFila().then(function () { return n == null ? { meta: metaDe(p) } : db.doc(src).get().then(function (d) { return d.data(); }); }).then(function (d) {
    meta = clone(d.meta); meta.nome = (meta.nome || 'Projeto') + ' – TESTE Rev. ' + (n == null ? revAtual(p) : n); meta.liberado = false; meta.rev = { atual: '00', lista: [], origem: { projeto: p.nome, n: n == null ? revAtual(p) : n } };
    return revCopiar(src, dst);
  }).then(function () { return db.doc(dst).set(meta); }).then(function () {
    var q = clone(meta); q.id = id; q._raiz = 'rascunhos'; q.atividades = [];
    return db.collection(dst + '/ativ').get().then(function (as) { as.docs.forEach(function (x) { var a = clone(x.data()); a.id = x.id; a.linhas = a.linhas || []; q.atividades.push(a); }); })
      .then(function () { if (!q.basePropria) return; return db.collection(dst + '/base').get().then(function (bs) { if (bs.docs.length) { q._base = {}; bs.docs.forEach(function (x) { q._base[x.id] = clone(x.data()); }); } }); })
      .then(function () { S.projetos.push(q); S.projetos.sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome)); }); S.v.revVer = null; S.v.pid = id; return q; });
  });
}
/* restaura uma revisão fixa: congela a revisão em edição e copia o conteúdo da fixa para a nova revisão */
function revRestaurar(p, n) {
  var dir = dirP(p), rv;
  return revCriar(p, 'Congelada antes de restaurar a Rev. ' + n).then(function () { return revEsperaFila(); })
    .then(function () { return db.doc(dir + '/revs/' + n).get(); }).then(function (d) { rv = d.data(); return revCopiar(dir + '/revs/' + n, dir, true); })
    .then(function () {
      var m = clone(rv.meta || {}); m.rev = clone(p.rev); m.rev.restaurada = { de: n, em: new Date().toISOString() }; m.liberado = p.liberado; m.nome = p.nome;
      return db.doc(dir).set(m);
    }).then(function () { S.v.revVer = null; S.revs = {}; S.pronto = false; return lerTudo(); }).then(function () { S.pronto = true; });
}
function revMover(p, antigo) {
  revLista(p).forEach(function (r) {
    var de = antigo + '/' + p.id + '/revs/' + r.n, para = dirP(p) + '/revs/' + r.n;
    db.doc(de).get().then(function (d) { if (!d) return; return db.doc(para).set(d.data()).then(function () { return revCopiar(de, para); }).then(function () { return revApagarDir(de); }); }).catch(function (e) { console.error('revisão', r.n, e); });
  });
}
function revApagarDir(dir) {
  return Promise.all(REV_SUB.map(function (sc) { return db.collection(dir + '/' + sc).get().then(function (r) { return Promise.all(r.docs.map(function (d) { return db.doc(dir + '/' + sc + '/' + d.id).delete(); })); }, function () { }); }))
    .then(function () { return db.doc(dir).delete(); });
}
function revExcluir(p) { revLista(p).forEach(function (r) { revApagarDir(dirP(p) + '/revs/' + r.n).catch(function () { }); }); }
function dlgRev(d) {
  var p0 = proj(), p = p0 && p0._rev ? S.projetos.filter(function (x) { return x.id === p0._orig; })[0] : p0, fechar = function () { S.v.dlg = null; agendar(); };
  if (!p) return '';
  var adm = ehAdmin() && !!db, L = revLista(p).slice().reverse(), at = revAtual(p), vendo = p0 && p0._rev;
  if (d.nova) {
    return janela('Nova revisão do projeto', '<p>A <b>Rev. ' + at + '</b> será congelada como está agora (dados do projeto, atividades, cronograma, composições, mapas e suprimentos) e passará a ser só leitura. O projeto continua na <b>Rev. ' + revNum(+at + 1) + '</b>.</p>' +
      '<label class="rev-obs">Motivo / observação da Rev. ' + at + '<textarea rows="3" placeholder="ex.: Linha de base contratual aprovada pelo cliente" data-live ' + h(function (el) { d.nova.obs = el.value; }) + '>' + esc(d.nova.obs || '') + '</textarea></label>' +
      '<div class="bts">' + bt('CRIAR REV. ' + revNum(+at + 1), function () { revProc(revCriar(p, d.nova.obs), function (it) { aviso('Rev. ' + it.n + ' congelada. O projeto agora está na Rev. ' + revAtual(p) + '.'); }); }) + bt('CANCELAR', fechar, 'cz') + '</div>', 520, fechar);
  }
  var linha = function (r) {
    var aberta = vendo && p0._rev === r.n;
    return '<tr' + (aberta ? ' class="on"' : '') + '><td><b>Rev. ' + esc(r.n) + '</b><small>fixa</small></td><td>' + fdh(r.criada) + (r.por ? '<small>' + esc(r.por) + '</small>' : '') + '</td><td>' + esc(r.obs || '—') + '</td><td class="rev-ac">' +
      (aberta ? '<span class="chip">aberta</span>' : '<button class="lk" ' + h(function () { revProc(revAbrir(p, r.n), function () { S.v.dlg = null; }); }) + '>Abrir</button>') +
      (adm ? '<button class="lk" data-tip="Cria um projeto de teste (rascunho) com o conteúdo desta revisão" ' + h(function () { revProc(revDuplicar(p, r.n), function (q) { aviso('Projeto de teste criado: ' + q.nome); }); }) + '>Duplicar</button>' +
        '<button class="lk" data-tip="Congela a revisão em edição e traz o conteúdo desta revisão para a próxima" ' + h(function () { confirma('Restaurar a Rev. ' + r.n + '?\n\nA Rev. ' + at + ' (em edição) será congelada como está, e o conteúdo da Rev. ' + r.n + ' passa a ser a Rev. ' + revNum(+at + 1) + ', em edição.', function () { revProc(revRestaurar(p, r.n), function () { S.v.dlg = null; aviso('Rev. ' + r.n + ' restaurada como Rev. ' + revAtual(S.projetos.filter(function (x) { return x.id === p.id; })[0]) + '.'); }); }); }) + '>Restaurar</button>' : '') + '</td></tr>';
  };
  var s = '<p class="aj">A Rev. 00 é a linha de base inicial. Cada nova revisão congela a anterior, que não pode mais ser alterada.</p>' +
    '<div class="tw"><table class="rev-t"><thead><tr><th>Revisão</th><th>Criada em</th><th>Motivo / observação</th><th></th></tr></thead><tbody>' +
    '<tr' + (vendo ? '' : ' class="on"') + '><td><b>Rev. ' + at + '</b><small>em edição</small></td><td>—</td><td>Revisão atual do projeto</td><td class="rev-ac">' + (vendo ? '<button class="lk" ' + h(function () { S.v.revVer = null; S.v.dlg = null; agendar(); }) + '>Abrir</button>' : '<span class="chip">aberta</span>') +
    (adm ? '<button class="lk" data-tip="Cria um projeto de teste (rascunho) com o conteúdo atual" ' + h(function () { revProc(revDuplicar(p, null), function (q) { aviso('Projeto de teste criado: ' + q.nome); }); }) + '>Duplicar</button>' : '') + '</td></tr>' +
    L.map(linha).join('') + '</tbody></table></div>' +
    (adm && !vendo ? '<div class="bts">' + bt('NOVA REVISÃO', function () { d.nova = { obs: '' }; }) + bt('FECHAR', fechar, 'cz') + '</div>' : '<div class="bts">' + bt('FECHAR', fechar, 'cz') + '</div>');
  return janela('Revisões · ' + esc(p.nome), s, 760, fechar);
}


/* ================= MANUAL DO USUÁRIO (Sistema) =================
   Para cada item do menu: o que é (resumo), como funciona (detalhado) e o fluxo do processo. */
NOMES.MANUAL = 'Manual do usuário'; ABAS.push(['MANUAL', '#1769e8']);
ICA.MANUAL = '<path d="M5 4.5h9.5a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h9.5M9 8.5h5M9 11h3"/>';
(function () { GRUPOS_ABAS.forEach(function (g) { if (g[0] === 'Sistema' && g[1].indexOf('MANUAL') < 0) g[1].unshift('MANUAL'); }); })();
var MANUAL_GERAL = {
  fluxo: ['Cadastrar o projeto (Dados do projeto)', 'Gerar ou importar o cronograma', 'Relacionar composições (CPU) às atividades', 'Dimensionar indireto e riscos', 'Congelar a Rev. 00 (linha de base)', 'Lançar avanço e RDO no dia a dia', 'Acompanhar KPI, suprimentos e custos', 'Emitir relatórios', 'Nova revisão quando houver replanejamento'],
  texto: ['O sistema organiza o planejamento e o custo de cada obra em um só lugar. O cronograma é a espinha dorsal: as composições (CPU) dão custo às atividades, os bancos de dados dão preço aos insumos, e o avanço lançado no dia a dia mede o realizado contra a linha de base.',
    'Bancos de dados, composições e cadastros do sistema são comuns a todos os projetos e só os administradores alteram. Os dados de cada projeto ficam no próprio projeto. O que cada pessoa vê e edita é definido em Sistema › Cadastro de usuários.']
};
var MANUAL_REV = {
  titulo: 'Revisões do projeto (Rev. 00, 01, 02…)',
  resumo: 'Todo projeto nasce na Rev. 00, a linha de base inicial. "Nova revisão" congela a revisão em edição e abre a seguinte. Revisões fixas não podem ser alteradas: só abrir, duplicar para teste ou restaurar.',
  det: ['O controle fica no topo da tela, ao lado do projeto: o botão "Rev. NN · em edição" abre a lista de revisões e "Nova revisão" (administradores) cria a próxima.',
    'Ao criar uma revisão, a revisão em edição é copiada por inteiro (dados do projeto, atividades, base de preços própria, cronograma com composições, avanço lançado, mapas e mapa de suprimentos) e fica só leitura. Informe o motivo (ex.: "Linha de base contratual", "Replanejamento após chuvas").',
    'Abrir uma revisão fixa mostra o projeto exatamente como estava, em modo leitura, com uma faixa amarela no topo. "Voltar para a revisão em edição" retorna ao trabalho.',
    'Duplicar cria um projeto de teste em rascunho (nome com "TESTE Rev. NN") para simulações e validações, sem mexer na numeração do projeto original.',
    'Restaurar congela a revisão em edição e traz o conteúdo da revisão escolhida como próxima revisão. Nada é apagado: a revisão que estava em edição também fica guardada.',
    'O RDO é registro diário da obra e é o mesmo em todas as revisões.',
    'Rotina mensal: atualize o avanço e a data de status, crie a nova revisão e analise o Comparativo de revisões (Custos), que compara cada revisão com a Rev. 00 e com a anterior.'],
  fluxo: ['Projeto criado: Rev. 00 em edição', 'Cadastro e planejamento completos', 'Nova revisão: Rev. 00 fica fixa (linha de base)', 'Fechamento do mês: avanço, custo real e efetivo', 'Nova revisão: mês congelado', 'Comparativo × Rev. 00 e × anterior']
};
var MANUAL = {
  PROJETOS: { r: 'Carteira de projetos: lista todos os projetos com tipo, fase, prazo, custo e venda, e é o ponto de partida para abrir, criar, liberar, exportar e importar projetos.',
    d: ['Clique em um projeto para abri-lo; o nome e a revisão aparecem no topo da tela em todas as guias.', 'Novo cria um projeto em rascunho (só administradores veem rascunhos). Liberar publica o projeto para os usuários com acesso a ele; Tornar rascunho recolhe.', 'Duplicar copia o projeto aberto. Excluir apaga o projeto e as revisões (não pode ser desfeito).', 'Baixar backup e Restaurar backup salvam e recarregam projetos em arquivo. Exportar tudo (Supabase) gera o arquivo completo para a versão com login.'],
    f: ['Novo projeto (rascunho)', 'Preencher Dados do projeto', 'Montar cronograma e custos', 'Liberar para a equipe', 'Acompanhar pela carteira'] },
  CONFIG: { r: 'Cadastro do projeto: tipo de obra, identificação, contrato, contratante, local, prazos, calendário, clima, reajustes e BDI. É daqui que sai o cronograma padrão.',
    d: ['O primeiro item é o tipo do projeto (subestação, eólico, parque solar, estrada, edificação, ETE…). Ele define o modelo de cronograma padrão e os dados técnicos pedidos (ex.: MWp e estruturas no solar; frentes, km e aerogeradores no eólico).', 'Os quadros Contratante e Local alimentam o RDO, os relatórios e o Sobre. Responsáveis, prazo e valor guardam datas e valor do contrato; BDI contratual calcula o BDI pela fórmula escolhida.', 'Calendário (jornada, feriados, paralisações) e clima definem os dias úteis usados em todo o planejamento.', 'Centros de custo do projeto: lista própria gerada pelo tipo de obra — diretos por frente de serviço (obra civil, montagem mecânica, montagem elétrica, comissionamento, fornecimento) e indiretos por natureza (MO indireta, veículos leves, equipamentos de apoio, diesel, gasolina, agregados, transportes, fretes, taxas, seguros, contingências). Código SIGLA.G.SEQ; a lista alimenta as atividades e o Fechamento mensal.', 'Gerar cronograma padrão monta a EAP OP Consulting com marcos, engenharia, suprimentos, construção, comissionamento e encerramento a partir dos dados técnicos; a lista "falta preencher" mostra o que ainda impede a geração.'],
    f: ['Escolher o tipo do projeto', 'Preencher identificação, contrato e local', 'Informar dados técnicos do tipo', 'Conferir calendário e BDI', 'Gerar cronograma padrão'] },
  GRA: { r: 'Painel de gráficos: visão rápida do projeto com custo previsto × realizado acumulado e CPI, curva S, resumo econômico e rankings de custo.',
    d: ['Os números vêm do cronograma, do avanço lançado e do custo calculado; não há digitação nesta guia.', 'Use para reuniões de acompanhamento e para conferir rapidamente se o projeto está adiantado ou atrasado.'],
    f: ['Cronograma e avanço atualizados', 'Painel recalcula sozinho', 'Ler curva S e desvios', 'Detalhar nos relatórios'] },
  INP: { r: 'Planilha de avanço: lançamento diário das quantidades executadas em cada atividade do cronograma.',
    d: ['Cada linha é uma atividade de execução com quantidade de projeto e unidade; cada coluna é um dia do mês.', 'O avanço lançado calcula o % físico, o início e o término reais das tarefas no Cronograma físico, e alimenta RDO, KPI, Quadro de saldos e curva S.', 'Atividades extras podem ser incluídas quando não existem no cronograma.', 'Visão Lançamento (compacta) ou Completa; escolha a data em “Lançar em” e digite na coluna amarela. Enter ou setas ↑↓ passam para a linha seguinte. A barra mostra o avanço real e a marca o previsto.'],
    f: ['Produção do dia em campo', 'Lançar quantidade na data', '% físico e datas reais atualizam', 'RDO, KPI e curva S refletem o avanço'] },
  RDO: { r: 'RDO – Diário de obra: um relatório por dia, montado automaticamente com cabeçalho, efetivo, equipamentos e atividades executadas.',
    d: ['Cabeçalho (número, data, contrato, prazos) vem dos dados do projeto.', 'Mão de obra e equipamentos diretos = produção do dia na Planilha de avanço × composições relacionadas; indiretos = equipes de permanência do mês.', 'Clima, ocorrências, comentários e ajustes de efetivo são digitados. Emitir congela o relatório do dia.'],
    f: ['Avanço do dia lançado', 'Abrir o RDO da data', 'Conferir efetivo e equipamentos', 'Registrar clima e ocorrências', 'Emitir (congela)'] },
  CRO: { r: 'Cronograma físico: o cronograma do projeto (importado do MS Project ou gerado pelo padrão), com linha de base, % físico, curva S e venda × custo × resultado.',
    d: ['Importar MS Project lê arquivos XML (o .mpp pode ser salvo como XML no MS Project). As tarefas são reorganizadas na EAP padrão OP Consulting.', 'Avanço real = % físico concluído ponderado pelo custo da linha de base; previsto = linha de base no calendário do projeto.', 'Cada macroatividade recebe composições (CPU) com quantidades, que distribuem o custo direto no tempo.', 'Colunas Nº, Predecessoras e Sucessoras com os vínculos TI (término-início), II (início-início), TT (término-término) e IT (início-término), com folga em dias.', 'Exportar: botão MS Project gera o XML (abra no MS Project e use Salvar como .mpp) com linha de base, % físico, vínculos e calendários; botão Excel gera a planilha do cronograma com vínculos.'],
    f: ['Gerar padrão ou importar XML', 'Conferir EAP e vínculos', 'Relacionar CPUs (Relacionamento)', 'Congelar linha de base (revisão)', 'Atualizar avanço e replanejar'] },
  SUP: { r: 'Mapa de suprimentos: lista o que precisa ser comprado ou fornecido, quando é necessário e quando precisa ser pedido, a partir do cronograma.',
    d: ['A data de necessidade vem da primeira atividade que consome o item; a data limite de pedido desconta o prazo (lead time) da categoria e a folga.', 'Responsabilidade (contratada ou contratante), fornecedor, status, datas e quantidades informadas ficam registrados com histórico.', 'Valor da compra, prazo de pagamento (dias após a entrega), data e valor pago alimentam o Fluxo de caixa (itens da contratada).', 'Painel com alertas (atrasado, crítico, alta), tabela, linha do tempo (Gantt) e exportação Excel e PDF.'],
    f: ['Cronograma com atividades e fornecimentos', 'Mapa calcula necessidade e data de pedido', 'Definir prazos e responsáveis', 'Atualizar status das compras', 'Tratar alertas'] },
  QDS: { r: 'Quadro de saldos: matriz atividades × áreas (subcampos, subparques, frentes) mostrando o que está concluído, em andamento ou não iniciado.',
    d: ['Usa o cronograma e o avanço lançado; filtre por grupo da EAP e escolha o tipo de área.', 'Os totais mostram o percentual de frentes em cada situação. Exporta para Excel.'],
    f: ['Avanço lançado', 'Escolher grupo e áreas', 'Ler saldos por área', 'Direcionar equipes (Lean)'] },
  R_KPI: { r: 'Indicadores físicos (KPI): avanço físico por atividade, comparando previsto e realizado.',
    d: ['Mostra, por atividade, quantidade prevista, executada e o índice de desempenho no período.', 'Base para a reunião semanal de produção.'],
    f: ['Avanço lançado', 'Escolher período', 'Comparar previsto × realizado', 'Definir ações'] },
  IDR: { r: 'Indireto: centros de custo indiretos dimensionados por permanência (gerência, administração, alojamento, TI…), somados ao direto, aos riscos e ao BDI para chegar ao preço total.',
    d: ['Criar estrutura padrão monta 6 centros de custo. Cada centro recebe mão de obra indireta, veículos, alojamentos e despesas com período de permanência.', 'Preço total = (direto + indireto + reserva de riscos) × (1 + BDI).'],
    f: ['Criar centros de custo', 'Informar equipes e permanência', 'Conferir indireto mensal', 'Preço total atualiza'] },
  RSK: { r: 'Gestão de riscos: registro de riscos com probabilidade × impacto, resposta, responsável e reserva de contingência.',
    d: ['Cada risco tem probabilidade, impacto, valor, resposta, responsável e situação (aberto, encerrado, ocorreu).', 'A matriz mostra os riscos em aberto; a reserva de contingência é a soma de probabilidade × impacto e entra no preço total do Indireto.', 'Riscos encerrados liberam reserva; riscos ocorridos viram custo.'],
    f: ['Identificar o risco', 'Avaliar probabilidade e impacto', 'Definir resposta e responsável', 'Acompanhar', 'Encerrar ou registrar ocorrência'] },
  REVC: { r: 'Comparativo de revisões: acompanhamento mensal do projeto, comparando a revisão analisada com a Rev. 00 (linha de base) e com a revisão anterior.',
    d: ['Cada revisão guarda seus indicadores no momento em que é congelada: preço total, custo direto, indireto, riscos, venda, resultado, margem, avanço previsto e real, data de status e término previsto, custo mês a mês e custo por item da EAP.', 'Escolha a revisão analisada; os cartões mostram o valor e a variação contra a Rev. 00 e contra a anterior (vermelho = piora, verde = melhora).', 'Gráficos: evolução cenário a cenário, avanço físico em cada revisão, custo acumulado mês a mês (Rev. 00 × anterior × analisada) e variação do custo direto por grupo da EAP.', 'Tabelas de indicadores, custo por mês e itens da EAP, com exportação para Excel.'],
    f: ['Atualizar avanço e data de status do mês', 'Nova revisão (congela o mês)', 'Abrir o Comparativo de revisões', 'Ler variações × Rev. 00 e × anterior', 'Registrar ações e replanejar'] },
  RELA: { r: 'Relacionamento: liga as composições (CPU) às atividades da EAP, com quantidades, formando o custo direto do projeto.',
    d: ['À esquerda, os itens da EAP; ao lado, as composições relacionadas à atividade selecionada (quantidade editável).', 'A biblioteca permite buscar e relacionar composições. Composições da biblioteca não são editadas aqui; use "Criar cópia especial para este projeto" para ajustar.', 'Cada mudança recalcula o custo direto no Cronograma financeiro.'],
    f: ['Selecionar atividade da EAP', 'Buscar composição na biblioteca', 'Relacionar e informar quantidade', 'Custo direto recalcula'] },
  FIN: { r: 'Cronograma financeiro: custo do projeto mês a mês, somando o custo direto (CPU × cronograma) e as equipes de permanência.',
    d: ['As equipes de permanência (mão de obra, veículos, materiais, serviços) são cadastradas em Atividades, com início e término.', 'Replanejar desloca períodos. Exportar dados e a Lista de erros ajudam a conferir.'],
    f: ['Custos diretos do Relacionamento', 'Cadastrar permanências', 'Conferir mês a mês', 'Replanejar quando necessário'] },
  R_PC: { r: 'Planilha de custo: custo por item da EAP aberto em composições e em mão de obra, equipamentos, materiais, serviços e indireto.',
    d: ['Filtre por período e atividade; exporte para Excel.'], f: ['Escolher filtros', 'Conferir custos por EAP', 'Exportar'] },
  R_PV: { r: 'Planilha de venda: custo × (1 + BDI) comparado à venda da linha de base, com a composição do BDI.',
    d: ['Mostra a margem por item da EAP e o BDI usado. Exporta para Excel.'], f: ['BDI do projeto definido', 'Abrir planilha', 'Comparar custo e venda', 'Exportar'] },
  R_MATV: { r: 'Consumo de materiais (R$): valor dos materiais e insumos consumidos por mês, a partir das composições e do cronograma.',
    d: ['Agrupe por material, grupo ou atividade e exporte.'], f: ['CPUs relacionadas', 'Escolher período e agrupamento', 'Exportar'] },
  CPU: { r: 'CPU – Composições do preço unitário: biblioteca de composições (SINAPI, SICRO, DER-MG, SUDECAP, SEINFRA e próprias), com insumos e coeficientes.',
    d: ['Cada composição guarda só o código do insumo e o coeficiente; o preço vem dos bancos (Mão de obra, Veículos e máquinas, Materiais, Serviços).', 'Filtros por origem, grupo e busca; ranking das composições mais usadas nos projetos.', 'Somente administradores criam ou alteram composições; os demais usuários só visualizam.'],
    f: ['Buscar ou criar composição', 'Informar insumos e coeficientes', 'Preço vem dos bancos', 'Relacionar aos projetos'] },
  MAO: { r: 'Mão de obra: funções com salário, encargos, benefícios e custo mensal e por hora.',
    d: ['O custo usa encargos e parâmetros de Configurações. Lista sempre em ordem alfabética. Importa e exporta Excel. Só administradores alteram.'], f: ['Cadastrar função e salário', 'Encargos aplicados', 'Custo usado nas CPUs e permanências'] },
  VEM: { r: 'Veículos e máquinas: equipamentos com custo mensal, mobilização, combustível e consumo (L/h).',
    d: ['O consumo de diesel (L/h) deste banco alimenta os relatórios de diesel e combustíveis. Ordem alfabética; importa e exporta Excel. Só administradores alteram.'], f: ['Cadastrar equipamento', 'Informar custo e consumo', 'Usado em CPUs, permanências e diesel'] },
  MAT: { r: 'Materiais e insumos: cadastro único de materiais, ferramentas e insumos com unidade e preço.',
    d: ['Ordem alfabética; importa e exporta Excel. Só administradores alteram.'], f: ['Cadastrar item e preço', 'Usado em CPUs e permanências'] },
  IND: { r: 'Insumos: banco de insumos indiretos (usado apenas em projetos com base própria antiga, quando materiais e insumos são separados).',
    d: ['Na base geral os insumos ficam em Materiais e insumos.'], f: ['Cadastrar insumo', 'Usado nas permanências'] },
  SER: { r: 'Serviços: serviços terceirizados com unidade e preço.',
    d: ['Ordem alfabética; importa e exporta Excel. Só administradores alteram.'], f: ['Cadastrar serviço e preço', 'Usado em CPUs e permanências'] },
  R_KPC: { r: 'Controle de KPI: curva S por atividade geral (linha de base, replanejamento, realizado, alvo e previsão), no layout oficial.',
    d: ['Atividade geral = tarefas de mesmo nome em vários locais (subcampos, parques…). Cada uma tem observações e indicadores ▲ ■ ▼.'], f: ['Avanço lançado', 'Escolher atividade geral', 'Ler tendência e previsão', 'Registrar observações'] },
  LOB: { r: 'Linhas de balanço: ritmo de execução por local para cada grupo da EAP, com linha de base, cronograma atual e executado.',
    d: ['Tabela de ritmos (linha de base, atual, real) e previsão de término pelo ritmo real.'], f: ['Escolher grupo e locais', 'Comparar ritmos', 'Ajustar equipes'] },
  MAP: { r: 'Mapas: desenho do empreendimento (KMZ/KML) sobre o mapa do OpenStreetMap, colorido pelo avanço de cada área do cronograma.',
    d: ['Envie o KMZ do projeto; camadas e elementos podem ser ligados e desligados. Fundo © colaboradores do OpenStreetMap.', '“Colorir pelo avanço” pinta cada elemento ligado a uma área (Sub-Campo ou Sub-Parque do cronograma): verde concluído, amarelo em andamento, laranja não iniciado. O filtro de grupo da EAP mostra o avanço de uma frente de serviço (ex.: só cravação).', 'A ligação é automática quando o nome do elemento no KMZ é o nome da área (ex.: “SPGA.01.01”). Os demais são ligados à mão em “Ligar elementos às áreas”.'],
    f: ['Enviar KMZ/KML', 'Conferir ligação dos elementos às áreas', 'Ligar o colorido pelo avanço', 'Filtrar por grupo da EAP', 'Usar em reuniões'] },
  HISP: { r: 'Histogramas: mão de obra, equipamentos, diesel e consumo de materiais ao longo do tempo, com o real dos fechamentos.',
    d: ['Calculados pelas composições × cronograma mais as permanências. Mão de obra e equipamentos arredondados para o inteiro acima.', 'Em mão de obra e equipamentos (quantidade, todas as atividades) aparecem as linhas REAL — média mensal do efetivo lançado no Fechamento mensal — e o gráfico previsto × real.'], f: ['Escolher histograma e período', 'Agrupar por função ou atividade', 'Exportar'] },
  CMB: { r: 'Diesel e combustíveis: consumo em litros e em reais por mês, por veículo, categoria, combustível ou atividade.',
    d: ['Usa o consumo L/h do banco Veículos e máquinas e as horas previstas.'], f: ['Escolher período e combustível', 'Agrupar', 'Exportar Excel'] },
  R_FC: { r: 'Fluxo de caixa: entradas (venda) e saídas (custo) por mês e acumulado, previsto e realizado, com o desembolso das compras de suprimentos.', d: ['Previsto: receita pela tendência do cronograma, custo direto (CPU) e indireto (permanência), impostos e TAC.', 'Realizado: nos meses com fechamento lançado, receita pelo avanço físico real e custos reais do Fechamento mensal, com saldo real acumulado.', 'Suprimentos: desembolso previsto e pago das compras da contratada (valor e prazo de pagamento no Mapa de suprimentos); informativo, não entra no saldo.', 'Exporta para Excel.'], f: ['Custo e venda calculados', 'Fechamentos e compras lançados', 'Ler saldo previsto e real'] },
  R_DRE: { r: 'Demonstrativo econômico: venda, impostos, custo direto, indireto, CSLL e IR, total, por ano e realizado até o último fechamento.', d: ['Impostos e regime (lucro real ou presumido) vêm dos parâmetros do cronograma.', 'A coluna Realizado usa os meses com fechamento lançado: receita pelo avanço real e custos reais.'], f: ['Parâmetros definidos', 'Ler resultado por ano', 'Exportar'] },
  RELS: { r: 'SESMT: EPI, exames (PCMSO), grupos GHE e dimensionamento do SESMT a partir do efetivo previsto.', d: ['Usa o histograma de mão de obra do projeto.'], f: ['Efetivo previsto', 'Gerar relatórios de SST'] },
  SIS: { r: 'Configurações: preferências (tema, tamanho da letra, idioma, formatos de data, hora e moeda) e cadastros do sistema (unidades de medida, modelo de grupos de atividade, listas dos bancos de dados, exames por GHE, kits de EPI).', d: ['Tema e letra valem para o navegador; formatos e cadastros valem para todos. Só administradores acessam.', 'Os parâmetros da empresa (encargos, salários, benefícios, combustível, viagens, centros de custo gerais, feriados) ficam em Dados do projeto › De todos os projetos.'], f: ['Ajustar preferências', 'Manter os cadastros do sistema'] },
  DADOS: { r: 'Dados e verificação: recarrega bancos e projetos do servidor, recalcula o projeto aberto e mostra a lista de erros.', d: ['Use quando outra pessoa alterou dados ou para conferir inconsistências antes de emitir relatórios.'], f: ['Atualizar base de dados', 'Atualizar projeto', 'Corrigir a lista de erros'] },
  CLI: { r: 'Cadastro de clientes e empresas: razão social, CNPJ, contatos e logos usados nos projetos e relatórios.', d: ['Só administradores alteram.'], f: ['Cadastrar empresa e logo', 'Vincular ao projeto'] },
  USR: { r: 'Cadastro de usuários: define, para cada pessoa, quais seções e quais projetos ela pode editar, só visualizar ou não acessar.',
    d: ['Cadastre pelo e-mail. Cada seção e cada projeto alterna entre Editar, Visualizar e Sem acesso.', 'Bancos de dados e composições: no máximo visualizar (só administradores editam). Sistema: só administradores.', 'Administrador edita tudo. A regra "Quem não está cadastrado" define o que vê quem não está na lista.'],
    f: ['Pessoa recebe acesso ao sistema', 'Cadastrar e-mail', 'Marcar seções e projetos', 'Pessoa entra e vê só o liberado'] },
  FECH: { r: 'Fechamento mensal (realizado): lançamento do que realmente aconteceu no mês — custo real direto e indireto e efetivo diário de mão de obra e equipamentos — comparado com o previsto.',
    d: ['Custo real: cada lançamento tem tipo (direto ou indireto), categoria (mão de obra, equipamentos, materiais, serviços, outros), item da EAP ou centro de custo, descrição/documento e valor.', 'Efetivo real por dia: pessoas (MO direta e indireta) e equipamentos (produção e apoio) presentes em cada dia; a média do mês forma o histograma real, comparado ao previsto de cada função. “Trazer dos RDOs” preenche com os RDOs emitidos; “Copiar lista do mês anterior” repete as linhas.', 'O avanço físico vem da Planilha de avanço. Os cartões mostram avanço acumulado, custo real do mês e acumulado contra o previsto, CPI (valor agregado ÷ custo real) e efetivo médio.', 'Fechar mês trava os lançamentos (administradores podem reabrir). Os dados do realizado são do projeto e valem para todas as revisões; ao criar a revisão do mês, o custo real acumulado, o CPI e o efetivo entram no Comparativo de revisões.'],
    f: ['Lançar avanço na Planilha de avanço', 'Lançar custos reais do mês', 'Lançar efetivo diário (ou trazer dos RDOs)', 'Conferir previsto × real', 'Fechar mês', 'Criar nova revisão', 'Analisar no Comparativo de revisões'] },
  MANUAL: { r: 'Este manual.', d: [], f: [] }
};
function manFluxo(f) {
  if (!f || !f.length) return '';
  return '<ol class="man-fx">' + f.map(function (x, i) { return '<li><span>' + (i + 1) + '</span>' + esc(x) + '</li>'; }).join('') + '</ol>';
}
function shManual() {
  var V = S.v.man || (S.v.man = { q: '', ab: {} }), q = semAcento(V.q || '');
  var bate = function (k, m) { return !q || semAcento((NOMES[k] || k) + ' ' + m.r + ' ' + m.d.join(' ') + ' ' + m.f.join(' ')).indexOf(q) >= 0; };
  var s = titulo('MANUAL DO USUÁRIO', '<input type="search" placeholder="Buscar no manual" aria-label="Buscar no manual" value="' + esc(V.q) + '" data-live ' + h(function (el) { V.q = el.value; agendar(); }) + '>' +
    '<button class="lk" ' + h(function () { var ab = {}; Object.keys(MANUAL).forEach(function (k) { ab[k] = 1; }); ab._rev = 1; V.ab = ab; agendar(); }) + '>Abrir tudo</button><button class="lk" ' + h(function () { V.ab = {}; agendar(); }) + '>Fechar tudo</button>');
  if (!q) s += '<section class="cs man-geral"><h3>Como o sistema funciona</h3>' + MANUAL_GERAL.texto.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') + '<h4>Fluxo geral do projeto</h4>' + manFluxo(MANUAL_GERAL.fluxo) + '</section>';
  var item = function (k, tit, r, d, f) {
    var on = !!V.ab[k];
    return '<article class="man-it' + (on ? ' on' : '') + '"><button class="man-h" aria-expanded="' + on + '" ' + h(function () { V.ab[k] = !V.ab[k]; agendar(); }) + '><b>' + esc(tit) + '</b><span>' + esc(r) + '</span><i>' + (on ? '−' : '+') + '</i></button>' +
      (on ? '<div class="man-b">' + (d.length ? '<h5>Como funciona</h5><ul>' + d.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') + (f.length ? '<h5>Fluxo do processo</h5>' + manFluxo(f) : '') + '</div>' : '') + '</article>';
  };
  var R = MANUAL_REV;
  if (!q || semAcento(R.titulo + ' ' + R.resumo + R.det.join(' ')).indexOf(q) >= 0) s += '<section class="man-g"><h3>Revisões</h3>' + item('_rev', R.titulo, R.resumo, R.det, R.fluxo) + '</section>';
  GRUPOS_ABAS.forEach(function (g) {
    var ks = g[1].filter(function (k) { return MANUAL[k] && k !== 'MANUAL' && bate(k, MANUAL[k]); });
    if (!ks.length) return;
    s += '<section class="man-g"><h3>' + esc(g[0] || 'Início') + '</h3>' + ks.map(function (k) { var m = MANUAL[k]; return item(k, NOMES[k] || k, m.r, m.d, m.f); }).join('') + '</section>';
  });
  return s;
}


/* ================= COMPARATIVO DE REVISÕES (acompanhamento mensal) =================
   Cada revisão guarda, ao ser congelada, os indicadores do projeto (revs/<NN>.ind). A revisão analisada é sempre
   comparada com a Rev. 00 (linha de base) e com a revisão imediatamente anterior. */
NOMES.REVC = 'Comparativo de revisões'; PRECISA_PROJ.REVC = 1; ABAS.push(['REVC', '#5a4475']);
ICA.REVC = '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/><path d="M4 9l6-4 6 7 5-5" stroke-dasharray="2 2"/>';
(function () { GRUPOS_ABAS.forEach(function (g) { if (g[0] === 'Custos' && g[1].indexOf('REVC') < 0) g[1].unshift('REVC'); }); })();
/* indicadores de uma revisão (a revisão em edição é calculada na hora) */
function revInd(p) {
  var pr = Promise.all([p.crono && !p._cro ? croCarregar(p) : null, db ? fechCarregar(p) : null]);
  return pr.then(function () {
    var X = custoResumo(p), c = X.c, o = { em: new Date().toISOString(), dir: X.dir, ind: X.ind, risco: X.risco, bdi: X.bdi, preco: X.venda, custo: X.dir + X.ind + X.risco, mes: { custo: {} }, eap: [] };
    (c.res.months || []).forEach(function (mi, i) { var v = num(c.fin.total.mes[i]); if (v) o.mes.custo[mi] = v; });
    if (p.crono && p._cro) {
      var R = croCalc(p), D = croResultado(p, R), lbF = null, atF = null, lbI = null, atI = null;
      R.leaves.forEach(function (t) { var a = dn(t.bi || t.i), b = dn(t.bf || t.f), x = dn(t.i), y = dn(t.f); if (a != null && (lbI == null || a < lbI)) lbI = a; if (b != null && (lbF == null || b > lbF)) lbF = b; if (x != null && (atI == null || x < atI)) atI = x; if (y != null && (atF == null || y > atF)) atF = y; });
      o.cro = { st: Math.floor(R.st), V: R.tot.v, pv: croPct(R.tot, 'pv'), ev: croPct(R.tot, 'ev'), cd: R.cdTot, ci: R.ciTot, imp: D.imp, tac: D.tac, antes: D.antes, csll: D.csll, ir: D.ir, liq: D.liq, lbI: lbI, lbF: lbF, atI: atI, atF: atF, n: R.leaves.length };
      var cp = function (m) { var r = {}; Object.keys(m || {}).forEach(function (k) { if (m[k]) r[k] = m[k]; }); return r; };
      o.mes.vLB = cp(R.mP); o.mes.vAt = cp(R.mT); o.mes.vR = cp(R.mR); o.mes.cd = cp(R.mCD); o.mes.ci = cp(R.mCI);
      p._cro.tasks.forEach(function (t) { if (t.l >= 1 && t.l <= 2 && R.N[t.u]) { var n = R.N[t.u]; o.eap.push({ u: t.u, w: t.w, n: t.n, l: t.l, v: n.v, cd: n.cd, ev: n.ev, pv: n.pv }); } });
    }
    try {
      var stMi = o.cro ? miDe(o.cro.st) : null, A = fechAcum(p, stMi), ult = Object.keys(A.meses).map(Number).sort(function (x, y) { return x - y; }).pop();
      if (A.total || ult != null) o.real = { D: A.D, I: A.I, total: A.total, cpi: A.total && o.cro ? realEV(p, stMi) / A.total : null, mi: ult, efet: ult != null ? A.meses[ult].efet : null, mes: (function () { var m = {}; Object.keys(A.meses).forEach(function (k) { m[k] = A.meses[k].D + A.meses[k].I; }); return m; })() };
    } catch (e) { console.error(e); }
    return o;
  });
}
function revcDados(p) {
  var K = S.revcD || (S.revcD = {}), D = K[p.id] || (K[p.id] = { docs: {}, carregando: false, atual: null });
  var faltam = revLista(p).filter(function (r) { return !(r.n in D.docs); });
  if (!D.carregando && faltam.length) {
    D.carregando = true;
    Promise.all(faltam.map(function (r) { return db.doc(dirP(p) + '/revs/' + r.n).get().then(function (d) { D.docs[r.n] = d ? d.data() : null; }, function () { D.docs[r.n] = null; }); }))
      .then(function () { D.carregando = false; agendar(); });
  }
  if (!D.atual && !D.calc) { D.calc = true; revInd(p).then(function (o) { D.atual = o; D.calc = false; agendar(); }, function (e) { D.calc = false; D.erro = (e && e.message) || String(e); agendar(); }); }
  return D;
}
function revcInvalidar(p) { if (S.revcD && S.revcD[p.id]) { S.revcD[p.id].atual = null; } }
/* calcula e grava os indicadores das revisões fixas que ainda não têm (revisões criadas antes do comparativo) */
function revcCalcularFaltantes(p) {
  var D = revcDados(p), L = revLista(p).filter(function (r) { return !(D.docs[r.n] && D.docs[r.n].ind); }), ok = 0;
  var um = function (i) {
    if (i >= L.length) return Promise.resolve(ok);
    var r = L[i], k = p.id + '@' + r.n, dir = dirP(p) + '/revs/' + r.n;
    return revAbrir(p, r.n).then(function () { var v = S.revs[k]; S.v.revVer = null; return revInd(v); }).then(function (ind) {
      var doc = Object.assign({}, D.docs[r.n] || {}, { ind: ind }); D.docs[r.n] = doc; ok++;
      return db.doc(dir).set(doc);
    }).then(function () { return um(i + 1); });
  };
  return um(0);
}
/* ---------- gráficos simples (SVG) ---------- */
var REVC_COR = { base: '#8a94a6', ant: '#d08a00', at: '#1769e8', ok: '#1b7f4c', ru: '#c8322b' };
function revcLinhas(series, rotX, opt) {
  opt = opt || {}; var W = 900, H = 280, ml = 70, mr = 16, mt = 16, mb = 40, n = rotX.length;
  if (!n) return '<div class="vazio">Sem dados.</div>';
  var all = []; series.forEach(function (s) { s.v.forEach(function (v) { if (v != null) all.push(v); }); });
  var mx = Math.max.apply(null, all.concat([0])), mn = Math.min.apply(null, all.concat([0])); if (mx === mn) mx = mn + 1;
  var x = function (i) { return ml + (W - ml - mr) * (n > 1 ? i / (n - 1) : 0.5); }, y = function (v) { return mt + (H - mt - mb) * (1 - (v - mn) / (mx - mn)); };
  var g = '';
  for (var k = 0; k <= 4; k++) { var vv = mn + (mx - mn) * k / 4, yy = y(vv); g += '<line x1="' + ml + '" x2="' + (W - mr) + '" y1="' + yy + '" y2="' + yy + '" stroke="var(--borda)"/><text x="' + (ml - 6) + '" y="' + (yy + 4) + '" text-anchor="end">' + (opt.fmt ? opt.fmt(vv) : compact(vv)) + '</text>'; }
  var passo = Math.max(1, Math.ceil(n / 12));
  rotX.forEach(function (r, i) { if (i % passo === 0 || i === n - 1) g += '<text x="' + x(i) + '" y="' + (H - 14) + '" text-anchor="' + (n > 1 && i === 0 ? 'start' : n > 1 && i === n - 1 ? 'end' : 'middle') + '">' + esc(r) + '</text>'; });
  series.forEach(function (s) {
    var pts = []; s.v.forEach(function (v, i) { if (v != null) pts.push(x(i).toFixed(1) + ',' + y(v).toFixed(1)); });
    g += '<polyline fill="none" stroke="' + s.cor + '" stroke-width="' + (s.w || 2.2) + '"' + (s.dash ? ' stroke-dasharray="6 4"' : '') + ' points="' + pts.join(' ') + '"/>';
    if (opt.pontos) s.v.forEach(function (v, i) { if (v != null) g += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="3.5" fill="' + s.cor + '"><title>' + esc(s.nome + ' · ' + rotX[i] + ': ' + (opt.fmt ? opt.fmt(v) : money(v))) + '</title></circle>'; });
  });
  return '<div class="gleg">' + series.map(function (s) { return '<span><i style="background:' + s.cor + '"></i>' + esc(s.nome) + '</span>'; }).join('') + '</div><svg class="revc-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opt.titulo || 'gráfico') + '">' + g + '</svg>';
}
function revcBarras(itens) {
  /* itens: [{rot, a, b}] — a = variação contra a Rev. 00, b = contra a anterior */
  if (!itens.length) return '<div class="vazio">Sem itens da EAP para comparar.</div>';
  var mx = Math.max.apply(null, itens.map(function (i) { return Math.max(Math.abs(i.a), Math.abs(i.b)); }).concat([1]));
  var bar = function (v, cor) { var w = Math.abs(v) / mx * 50; return '<span class="revc-b" style="' + (v < 0 ? 'right:50%' : 'left:50%') + ';width:' + w.toFixed(2) + '%;background:' + cor + '"></span>'; };
  return '<div class="revc-bars">' + itens.map(function (i) {
    return '<div class="revc-br"><div class="revc-bl">' + esc(i.rot) + '</div><div class="revc-bt"><div class="revc-bz">' + bar(i.a, REVC_COR.base) + '</div><div class="revc-bz">' + bar(i.b, REVC_COR.at) + '</div></div>' +
      '<div class="revc-bv"><span class="' + (i.a > 0 ? 'ru' : i.a < 0 ? 'ok' : '') + '">' + revcSinal(i.a) + '</span><span class="' + (i.b > 0 ? 'ru' : i.b < 0 ? 'ok' : '') + '">' + revcSinal(i.b) + '</span></div></div>';
  }).join('') + '</div>';
}
function revcSinal(v, f) { if (v == null || isNaN(v)) return '–'; return (v > 0 ? '+' : v < 0 ? '−' : '') + (f ? f(Math.abs(v)) : money(Math.abs(v))); }
function revcDia(d) { return d == null ? '–' : fdate(d); }
/* ---------- tela ---------- */
function shRevc(p) {
  if (p._rev) return titulo('COMPARATIVO DE REVISÕES') + '<div class="vazio">Volte para a revisão em edição para ver o comparativo.</div>';
  var D = revcDados(p), V = S.v.revc || (S.v.revc = {}), L = revLista(p), at = revAtual(p), adm = ehAdmin() && !!db;
  /* colunas: fixas + em edição */
  var cols = L.map(function (r) { var d = D.docs[r.n]; return { n: r.n, rot: 'Rev. ' + r.n, data: r.criada, obs: r.obs, ind: d && d.ind, fixa: true }; });
  cols.push({ n: at, rot: 'Rev. ' + at, data: null, obs: 'em edição', ind: D.atual, fixa: false });
  var semInd = cols.filter(function (c) { return c.fixa && !c.ind && (c.n in D.docs); });
  var sel = V[p.id] != null && cols.some(function (c) { return c.n === V[p.id]; }) ? V[p.id] : at;
  var iA = cols.map(function (c) { return c.n; }).indexOf(sel), A = cols[iA], B = iA > 1 ? cols[iA - 1] : null, Z = cols[0];
  var s = titulo('COMPARATIVO DE REVISÕES', '<label class="revc-sel">Revisão analisada <select aria-label="Revisão analisada" ' + h(function (el) { V[p.id] = el.value; agendar(); }) + '>' +
    cols.slice().reverse().map(function (c) { return '<option value="' + c.n + '"' + (c.n === sel ? ' selected' : '') + '>' + c.rot + (c.fixa ? ' · ' + fdh(c.data).slice(0, 10) : ' · em edição') + '</option>'; }).join('') + '</select></label>' +
    '<button class="bxl" ' + h(function () { revcExcel(p, cols); }) + '>' + XL_IC + 'Exportar Excel</button>');
  if (!L.length) s += '<div class="nota">Este projeto ainda está na Rev. 00. Ao criar a primeira revisão (botão “Nova revisão” no topo), a Rev. 00 fica fixa como linha de base e os comparativos aparecem aqui. Crie uma revisão por mês para o acompanhamento mensal.</div>';
  if (D.carregando || !D.atual) return s + '<div class="vazio">' + (D.erro ? 'Não foi possível calcular: ' + esc(D.erro) : 'Calculando os indicadores das revisões…') + '</div>';
  if (semInd.length) s += '<div class="nota">' + semInd.map(function (c) { return c.rot; }).join(', ') + (semInd.length > 1 ? ' foram criadas' : ' foi criada') + ' antes do comparativo e ainda não ' + (semInd.length > 1 ? 'têm' : 'tem') + ' indicadores. ' +
    (adm ? bt('Calcular agora', function () { revProc(revcCalcularFaltantes(p), function (n) { aviso(n + ' revisão(ões) calculada(s).'); }); }, 'lk') : 'Peça a um administrador para calcular.') + '</div>';
  var a = A.ind || {}, b = (B && B.ind) || null, z = Z.ind || null, ac = a.cro || {}, bc = b && b.cro || {}, zc = z && z.cro || {};
  var temCro = !!a.cro;
  var dlt = function (va, vb) { return vb == null || va == null ? null : va - vb; };
  var margem = function (o) { return o && o.cro && o.cro.V ? o.cro.liq / o.cro.V : null; };
  var prazo = function (o) { return o && o.cro && o.cro.atF != null && o.cro.lbI != null ? o.cro.atF - o.cro.lbI : null; };
  /* cartões */
  var card = function (rot, va, vz, vb, fmt, menorMelhor, hero, fmtD) {
    var d0 = dlt(va, vz), d1 = dlt(va, vb), cl = function (d) { return d == null || !d ? '' : (menorMelhor ? d > 0 : d < 0) ? 'ru' : 'ok'; }; fmtD = fmtD || fmt;
    return '<div class="kt' + (hero ? ' hero' : '') + '"><span>' + rot + '</span><b>' + (va == null ? '–' : fmt(va)) + '</b><i class="revc-d"><em class="' + cl(d0) + '">vs Rev. ' + Z.n + ': ' + revcSinal(d0, fmtD) + '</em>' +
      (B ? '<em class="' + cl(d1) + '">vs Rev. ' + B.n + ': ' + revcSinal(d1, fmtD) + '</em>' : '') + '</i></div>';
  };
  var fm = function (v) { return 'R$ ' + compact(v); }, fp = function (v) { return nf2.format(v * 100) + '%'; }, fpp = function (v) { return nf2.format(v * 100) + ' p.p.'; }, fd = function (v) { return int(v) + ' d'; };
  s += '<div class="revc-cab"><b>' + esc(A.rot) + '</b> ' + (A.fixa ? '· congelada em ' + fdh(A.data) : '· em edição') + (A.obs && A.fixa ? ' · ' + esc(A.obs) : '') + '<span>comparada com a <b>Rev. ' + Z.n + '</b> (linha de base)' + (B ? ' e com a <b>' + esc(B.rot) + '</b> (anterior)' : '') + '</span></div>';
  s += '<div class="gk revc-k">' + card('Preço total do projeto', a.preco, z && z.preco, b && b.preco, fm, false, true) + card('Custo total (direto + indireto + riscos)', a.custo, z && z.custo, b && b.custo, fm, true) +
    (temCro ? card('Resultado líquido', ac.liq, zc.liq, bc.liq, fm, false) + card('Margem líquida', margem(a), margem(z), margem(b), fp, false, false, fpp) +
      card('Avanço real', ac.ev, zc.ev, bc.ev, fp, false, false, fpp) + card('Término previsto', ac.atF, zc.atF, bc.atF, fdate, true, false, function (v) { return int(v) + ' d'; }) : card('Custo direto', a.dir, z && z.dir, b && b.dir, fm, true) + card('Custo indireto', a.ind, z && z.ind, b && b.ind, fm, true)) + '</div>';
  /* tabela de indicadores por revisão */
  var linhas = [['Preço total (R$)', function (o) { return o.preco; }, 'm'], ['Custo direto (R$)', function (o) { return o.dir; }, 'm'], ['Custo indireto (R$)', function (o) { return o.ind; }, 'm'], ['Reserva de riscos (R$)', function (o) { return o.risco; }, 'm'], ['Custo total (R$)', function (o) { return o.custo; }, 'm'], ['BDI', function (o) { return o.bdi; }, 'p']];
  if (temCro) linhas = linhas.concat([['Venda – linha de base do cronograma (R$)', function (o) { return o.cro && o.cro.V; }, 'm'], ['Custo direto – CPU (R$)', function (o) { return o.cro && o.cro.cd; }, 'm'], ['Custo indireto – permanência (R$)', function (o) { return o.cro && o.cro.ci; }, 'm'],
    ['Resultado antes de CSLL e IR (R$)', function (o) { return o.cro && o.cro.antes; }, 'm'], ['Resultado líquido (R$)', function (o) { return o.cro && o.cro.liq; }, 'm'], ['Margem líquida', margem, 'p'],
    ['Data de status', function (o) { return o.cro && o.cro.st; }, 'd'], ['Avanço previsto (LB)', function (o) { return o.cro && o.cro.pv; }, 'p'], ['Avanço real', function (o) { return o.cro && o.cro.ev; }, 'p'], ['SPI', function (o) { return o.cro && o.cro.pv ? o.cro.ev / o.cro.pv : null; }, 'n'],
    ['Custo real acumulado – direto (R$)', function (o) { return o.real && o.real.D; }, 'm'], ['Custo real acumulado – indireto (R$)', function (o) { return o.real && o.real.I; }, 'm'], ['Custo real acumulado – total (R$)', function (o) { return o.real && o.real.total; }, 'm'], ['CPI (valor agregado ÷ custo real)', function (o) { return o.real && o.real.cpi; }, 'n'],
    ['MO direta média no mês (real)', function (o) { return o.real && o.real.efet && o.real.efet.MOD; }, 'n'], ['MO indireta média no mês (real)', function (o) { return o.real && o.real.efet && o.real.efet.MOI; }, 'n'], ['Equipamentos médios no mês (real)', function (o) { return o.real && o.real.efet && o.real.efet.EQD + o.real.efet.EQI; }, 'n'],
    ['Término pela linha de base', function (o) { return o.cro && o.cro.lbF; }, 'd'], ['Término previsto (atual)', function (o) { return o.cro && o.cro.atF; }, 'd'], ['Prazo total (dias corridos)', prazo, 'i']]);
  var fv = function (v, t) { return v == null || isNaN(v) ? '–' : t === 'm' ? money(v) : t === 'p' ? pct(v) : t === 'd' ? fdate(v) : t === 'i' ? int(v) : nf2.format(v); };
  var fdv = function (v, t) { return v == null || isNaN(v) ? '–' : t === 'm' ? revcSinal(v) : t === 'p' ? revcSinal(v, function (x) { return nf2.format(x * 100) + ' p.p.'; }) : t === 'd' || t === 'i' ? revcSinal(v, function (x) { return int(x) + ' d'; }) : revcSinal(v, function (x) { return nf2.format(x); }); };
  s += '<div class="gc"><h3>Indicadores por revisão</h3><div class="tw revc-tw"><table class="g revc-t"><thead><tr><th class="l">INDICADOR</th>' + cols.map(function (c) { return '<th class="' + (c.n === A.n ? 'on' : '') + '">' + c.rot + '<small>' + (c.fixa ? fdh(c.data).slice(0, 10) : 'em edição') + '</small></th>'; }).join('') + '<th class="dv">Δ ' + esc(A.rot) + ' × Rev. ' + Z.n + '</th>' + (B ? '<th class="dv">Δ ' + esc(A.rot) + ' × ' + esc(B.rot) + '</th>' : '') + '</tr></thead><tbody>' +
    linhas.map(function (l) { var va = A.ind ? l[1](A.ind) : null; return '<tr><td>' + l[0] + '</td>' + cols.map(function (c) { return '<td class="n' + (c.n === A.n ? ' on' : '') + '">' + (c.ind ? fv(l[1](c.ind), l[2]) : '–') + '</td>'; }).join('') +
      '<td class="n dv">' + (z ? fdv(dlt(va, l[1](z)), l[2]) : '–') + '</td>' + (B ? '<td class="n dv">' + (b ? fdv(dlt(va, l[1](b)), l[2]) : '–') + '</td>' : '') + '</tr>'; }).join('') + '</tbody></table></div></div>';
  /* evolução por revisão */
  var comInd = cols.filter(function (c) { return c.ind; });
  if (comInd.length > 1) {
    var ser = [{ nome: 'Preço total', cor: REVC_COR.at, v: comInd.map(function (c) { return c.ind.preco; }) }, { nome: 'Custo total', cor: REVC_COR.ru, v: comInd.map(function (c) { return c.ind.custo; }) }];
    if (temCro) ser.push({ nome: 'Resultado líquido', cor: REVC_COR.ok, v: comInd.map(function (c) { return c.ind.cro ? c.ind.cro.liq : null; }) });
    s += '<div class="gc"><h3>Evolução cenário a cenário</h3>' + revcLinhas(ser, comInd.map(function (c) { return c.rot; }), { pontos: true, titulo: 'Evolução por revisão', fmt: function (v) { return compact(v); } }) + '</div>';
    if (temCro) s += '<div class="gc"><h3>Avanço físico em cada revisão</h3>' + revcLinhas([{ nome: 'Previsto (LB)', cor: REVC_COR.base, dash: true, v: comInd.map(function (c) { return c.ind.cro ? c.ind.cro.pv : null; }) }, { nome: 'Real', cor: REVC_COR.at, v: comInd.map(function (c) { return c.ind.cro ? c.ind.cro.ev : null; }) }], comInd.map(function (c) { return c.rot + (c.ind.cro ? ' (' + fdate(c.ind.cro.st).slice(0, 5) + ')' : ''); }), { pontos: true, fmt: function (v) { return nf2.format(v * 100) + '%'; }, titulo: 'Avanço físico' }) + '</div>';
  }
  /* custo acumulado mês a mês: Rev. 00 × anterior × analisada */
  var trio = [{ c: Z, nome: 'Rev. ' + Z.n + ' (linha de base)', cor: REVC_COR.base, dash: true }]; if (B && B !== Z) trio.push({ c: B, nome: B.rot + ' (anterior)', cor: REVC_COR.ant }); if (A !== Z) trio.push({ c: A, nome: A.rot + ' (analisada)', cor: REVC_COR.at, w: 3 });
  var meses = {}; trio.forEach(function (t) { if (t.c.ind) Object.keys(t.c.ind.mes.custo || {}).forEach(function (k) { meses[k] = 1; }); });
  var ks = Object.keys(meses).map(Number).sort(function (x, y) { return x - y; });
  if (ks.length) {
    var acum = function (m) { var x = 0; return ks.map(function (k) { x += num((m || {})[k]); return x; }); };
    s += '<div class="gc"><h3>Custo acumulado mês a mês</h3>' + revcLinhas(trio.filter(function (t) { return t.c.ind; }).map(function (t) { return { nome: t.nome, cor: t.cor, dash: t.dash, w: t.w, v: acum(t.c.ind.mes.custo) }; }), ks.map(mmaa), { titulo: 'Custo acumulado' }) + '</div>';
    s += '<div class="gc"><h3>Custo por mês</h3><div class="tw revc-tw"><table class="g revc-t"><thead><tr><th class="l">MÊS</th>' + trio.map(function (t) { return '<th>' + esc(t.nome) + '</th>'; }).join('') + '<th class="dv">Δ × Rev. ' + Z.n + '</th>' + (B ? '<th class="dv">Δ × ' + esc(B.rot) + '</th>' : '') + '</tr></thead><tbody>' +
      ks.map(function (k) { var va = A.ind ? num(A.ind.mes.custo[k]) : 0; return '<tr><td class="c">' + mmaa(k) + '</td>' + trio.map(function (t) { return '<td class="n">' + (t.c.ind ? money(num(t.c.ind.mes.custo[k])) : '–') + '</td>'; }).join('') + '<td class="n dv">' + (z ? revcSinal(va - num(z.mes.custo[k])) : '–') + '</td>' + (B ? '<td class="n dv">' + (b ? revcSinal(va - num(b.mes.custo[k])) : '–') + '</td>' : '') + '</tr>'; }).join('') + '</tbody></table></div></div>';
  }
  /* variação por grupo da EAP */
  if (temCro) {
    var mapa = function (o) { var m = {}; ((o && o.eap) || []).forEach(function (e) { m[e.w] = e; }); return m; }, mA = mapa(a), mZ = mapa(z), mB = mapa(b);
    var grupos = (a.eap || []).filter(function (e) { return e.l === 1; });
    s += '<div class="gc"><h3>Variação do custo direto por grupo da EAP</h3><div class="gleg"><span><i style="background:' + REVC_COR.base + '"></i>' + esc(A.rot) + ' × Rev. ' + Z.n + '</span>' + (B ? '<span><i style="background:' + REVC_COR.at + '"></i>' + esc(A.rot) + ' × ' + esc(B.rot) + '</span>' : '') + '<span>vermelho = aumento de custo · verde = redução</span></div>' +
      revcBarras(grupos.map(function (e) { return { rot: e.w + ' ' + e.n, a: e.cd - num((mZ[e.w] || {}).cd), b: B ? e.cd - num((mB[e.w] || {}).cd) : 0 }; })) + '</div>';
    var it = (a.eap || []);
    s += '<div class="gc"><h3>Itens da EAP: venda, custo direto e avanço</h3><div class="tw revc-tw" style="max-height:520px"><table class="g revc-t"><thead><tr><th class="l">EAP</th><th>VENDA LB (R$)</th><th>CUSTO DIRETO Rev. ' + Z.n + '</th>' + (B ? '<th>CUSTO DIRETO ' + esc(B.rot) + '</th>' : '') + '<th class="on">CUSTO DIRETO ' + esc(A.rot) + '</th><th class="dv">Δ × Rev. ' + Z.n + '</th>' + (B ? '<th class="dv">Δ × ' + esc(B.rot) + '</th>' : '') + '<th>AVANÇO REAL</th></tr></thead><tbody>' +
      it.map(function (e) { var ez = mZ[e.w], eb = mB[e.w]; return '<tr class="' + (e.l === 1 ? 'co' : '') + '"><td' + (e.l === 2 ? ' style="padding-left:22px"' : '') + '>' + esc(e.w + ' ' + e.n) + '</td><td class="n">' + money(e.v) + '</td><td class="n">' + (ez ? money(ez.cd) : '–') + '</td>' + (B ? '<td class="n">' + (eb ? money(eb.cd) : '–') + '</td>' : '') + '<td class="n on">' + money(e.cd) + '</td><td class="n dv">' + (ez ? revcSinal(e.cd - ez.cd) : 'novo') + '</td>' + (B ? '<td class="n dv">' + (eb ? revcSinal(e.cd - eb.cd) : 'novo') + '</td>' : '') + '<td class="n">' + (e.v ? pct(e.ev / e.v) : '–') + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  }
  return s + '<div class="nota">Os indicadores de cada revisão são guardados no momento em que ela é congelada. A revisão em edição é calculada na hora. Crie uma revisão por mês, depois de atualizar a data de status e o avanço, para formar o histórico mensal.</div>';
}
function revcExcel(p, cols) {
  carregaXlsx().then(function (X) { revcExcelX(p, cols, X); });
}
function revcExcelX(p, cols, X) {
  var wb = X.utils.book_new(), rot = cols.map(function (c) { return c.rot; });
  var lin = [['Preço total', 'preco'], ['Custo direto', 'dir'], ['Custo indireto', 'ind'], ['Reserva de riscos', 'risco'], ['Custo total', 'custo'], ['BDI', 'bdi']];
  var cro = [['Venda LB', 'V'], ['Custo direto CPU', 'cd'], ['Custo indireto permanência', 'ci'], ['Resultado antes CSLL/IR', 'antes'], ['Resultado líquido', 'liq'], ['Avanço previsto', 'pv'], ['Avanço real', 'ev']];
  var aoa = [['Indicador'].concat(rot)];
  lin.forEach(function (l) { aoa.push([l[0]].concat(cols.map(function (c) { return c.ind ? c.ind[l[1]] : null; }))); });
  cro.forEach(function (l) { aoa.push([l[0]].concat(cols.map(function (c) { return c.ind && c.ind.cro ? c.ind.cro[l[1]] : null; }))); });
  aoa.push(['Data de status'].concat(cols.map(function (c) { return c.ind && c.ind.cro ? fdate(c.ind.cro.st) : null; })));
  aoa.push(['Término previsto'].concat(cols.map(function (c) { return c.ind && c.ind.cro ? fdate(c.ind.cro.atF) : null; })));
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(aoa), 'Indicadores');
  var ms = {}; cols.forEach(function (c) { if (c.ind) Object.keys(c.ind.mes.custo || {}).forEach(function (k) { ms[k] = 1; }); });
  var ks = Object.keys(ms).map(Number).sort(function (x, y) { return x - y; }), m2 = [['Mês'].concat(rot)];
  ks.forEach(function (k) { m2.push([mmaa(k)].concat(cols.map(function (c) { return c.ind ? num(c.ind.mes.custo[k]) : null; }))); });
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(m2), 'Custo mensal');
  var e = [['EAP', 'Item'].concat(rot)], ws = {}, ordem = [];
  cols.forEach(function (c, i) { ((c.ind && c.ind.eap) || []).forEach(function (x) { if (!ws[x.w]) { ws[x.w] = { n: x.n, v: [] }; ordem.push(x.w); } ws[x.w].v[i] = x.cd; }); });
  ordem.forEach(function (w) { e.push([w, ws[w].n].concat(cols.map(function (c, i) { return ws[w].v[i] == null ? null : ws[w].v[i]; }))); });
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(e), 'Custo direto por EAP');
  var out = X.write(wb, { bookType: 'xlsx', type: 'array' });
  baixar('Comparativo-revisoes-' + semAcento(p.nome || 'projeto').replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '') + '.xlsx', out);
}


/* ================= FECHAMENTO MENSAL (REALIZADO) =================
   Por mês: custo real (direto e indireto, por categoria e por item da EAP / centro de custo) e efetivo diário real
   (mão de obra direta e indireta, equipamentos de produção e de apoio). O avanço físico vem da Planilha de avanço.
   Dados em <raiz>/<id>/real/m<AAAAMM> — são do projeto, iguais em todas as revisões (como o RDO). */
NOMES.FECH = 'Fechamento mensal (realizado)'; PRECISA_PROJ.FECH = 1; ABAS.push(['FECH', '#5a4475']);
ICA.FECH = '<rect x="3.5" y="4.5" width="17" height="16" rx="2"/><path d="M3.5 9h17M8 3v3M16 3v3"/><path d="M8 14.5l2.5 2.5 5-5"/>';
(function () { GRUPOS_ABAS.forEach(function (g) { if (g[0] === 'Planejamento' && g[1].indexOf('FECH') < 0) { var i = g[1].indexOf('RDO'); g[1].splice(i >= 0 ? i + 1 : g[1].length, 0, 'FECH'); } }); })();
var FECH_CAT = ['MO', 'EQ', 'MAT', 'SER', 'OUT'], FECH_CATN = { MO: 'Mão de obra', EQ: 'Equipamentos e veículos', MAT: 'Materiais e insumos', SER: 'Serviços', OUT: 'Outros' };
var FECH_TIPO = { MOD: 'MO direta', MOI: 'MO indireta', EQD: 'Equip. produção', EQI: 'Equip. apoio' };
function realRaiz(p) { return p._raiz + '/' + (p._orig || p.id) + '/real'; }
function fechId(mi) { return 'm' + Math.floor(mi / 12) + ('0' + (mi % 12 + 1)).slice(-2); }
function fechMiDe(id) { var m = /^m(\d{4})(\d\d)$/.exec(id); return m ? +m[1] * 12 + +m[2] - 1 : null; }
function fechDias(mi) { return new Date(Date.UTC(Math.floor(mi / 12), mi % 12 + 1, 0)).getUTCDate(); }
function fechCarregar(p) {
  var q = S.projetos.filter(function (x) { return x.id === (p._orig || p.id); })[0] || p;
  if (q._real) return Promise.resolve(q._real);
  if (q._realP) return q._realP;
  q._realP = db.collection(realRaiz(q)).get().then(function (r) { var M = {}; r.docs.forEach(function (d) { M[d.id] = clone(d.data()); }); q._real = M; q._realP = null; return M; }, function () { q._real = {}; q._realP = null; return q._real; });
  return q._realP;
}
function fechDoc(p, mi) {
  var q = S.projetos.filter(function (x) { return x.id === (p._orig || p.id); })[0] || p, id = fechId(mi);
  return q._real[id] || (q._real[id] = { mi: mi, custo: [], efet: [], fechado: false });
}
function fechSalvar(p, mi) { var q = S.projetos.filter(function (x) { return x.id === (p._orig || p.id); })[0] || p; limpaCache(q.id); gravar(realRaiz(q) + '/' + fechId(mi), q._real[fechId(mi)]); }
/* totais de um mês: custo real por tipo/categoria e efetivo médio por grupo */
function fechTot(doc) {
  var t = { D: 0, I: 0, cat: {}, efet: { MOD: 0, MOI: 0, EQD: 0, EQI: 0 }, pico: { MOD: 0, MOI: 0, EQD: 0, EQI: 0 }, dias: 0 };
  (doc.custo || []).forEach(function (l) { var v = num(l.v); t[l.t === 'I' ? 'I' : 'D'] += v; var k = (l.t === 'I' ? 'I' : 'D') + ':' + (l.c || 'OUT'); t.cat[k] = (t.cat[k] || 0) + v; });
  var porDia = {}; (doc.efet || []).forEach(function (r) { Object.keys(r.d || {}).forEach(function (dd) { var v = num(r.d[dd]); if (!v) return; var P = porDia[dd] || (porDia[dd] = { MOD: 0, MOI: 0, EQD: 0, EQI: 0 }); P[r.t] = (P[r.t] || 0) + v; }); });
  var ds = Object.keys(porDia); t.dias = ds.length;
  ds.forEach(function (dd) { Object.keys(t.efet).forEach(function (k) { t.efet[k] += porDia[dd][k] || 0; t.pico[k] = Math.max(t.pico[k], porDia[dd][k] || 0); }); });
  if (ds.length) Object.keys(t.efet).forEach(function (k) { t.efet[k] = t.efet[k] / ds.length; });
  t.porDia = porDia; t.total = t.D + t.I; return t;
}
/* acumulado do realizado até o mês (inclusive) */
function fechAcum(p, ate) {
  var q = S.projetos.filter(function (x) { return x.id === (p._orig || p.id); })[0] || p, M = q._real || {}, a = { D: 0, I: 0, meses: {} };
  Object.keys(M).forEach(function (id) { var mi = fechMiDe(id); if (mi == null || (ate != null && mi > ate)) return; var t = fechTot(M[id]); a.D += t.D; a.I += t.I; a.meses[mi] = { D: t.D, I: t.I, efet: t.efet, fechado: !!M[id].fechado }; });
  a.total = a.D + a.I; return a;
}
/* previsto do mês: custo (cronograma financeiro) e histograma (composições × cronograma + permanências) */
function fechPrevisto(p, mi) {
  var c = calc(p), o = { custo: 0, custoAc: 0, mo: { D: 0, I: 0 }, eq: { D: 0, I: 0 }, itens: {} };
  (c.res.months || []).forEach(function (m, i) { var v = num(c.fin.total.mes[i]); if (m === mi) o.custo = v; if (m <= mi) o.custoAc += v; });
  try {
    var RR = relRecursos(p);
    Object.keys(RR.ins).forEach(function (k) { var I = RR.ins[k]; if (I.t !== 'MO' && I.t !== 'EQ') return; var q = num(I.mes[mi]); if (!q) return; var ind = I.fonte !== 'CPU', g = I.t === 'MO' ? 'mo' : 'eq'; o[g][ind ? 'I' : 'D'] += q; var tk = (I.t === 'MO' ? (ind ? 'MOI' : 'MOD') : (ind ? 'EQI' : 'EQD')) + '|' + semAcento(I.d); o.itens[tk] = (o.itens[tk] || 0) + q; });
  } catch (e) { console.error(e); }
  return o;
}
function fechAvanco(p, mi) {
  if (!p.crono || !p._cro) return null;
  var R = croCalc(p), tot = R.tot.v || 1, ap = 0, ar = 0, at = 0;
  R.meses.forEach(function (m) { if (m <= mi) { ap += num(R.mP[m]); ar += num(R.mR[m]); at += num(R.mT[m]); } });
  return { pv: ap / tot, ev: ar / tot, mpv: num(R.mP[mi]) / tot, mev: num(R.mR[mi]) / tot, V: R.tot.v };
}
/* traz o efetivo dos RDOs emitidos no mês */
function fechDoRdo(p, mi) {
  var q = S.projetos.filter(function (x) { return x.id === (p._orig || p.id); })[0] || p, doc = fechDoc(p, mi), y = Math.floor(mi / 12), m = ('0' + (mi % 12 + 1)).slice(-2), n = 0;
  var D = q._rdo && q._rdo.dias || {}, idx = {};
  doc.efet.forEach(function (r) { idx[r.t + '|' + semAcento(r.n)] = r; });
  Object.keys(D).forEach(function (id) {
    if (id.indexOf('d' + y + m) !== 0 || !D[id].snap) return; var dd = id.slice(-2); n++;
    var put = function (t, nome, v) { var k = t + '|' + semAcento(nome), r = idx[k]; if (!r) { r = idx[k] = { id: uid(), t: t, n: nome, d: {} }; doc.efet.push(r); } r.d[dd] = num(v); };
    (D[id].snap.mo || []).forEach(function (x) { put(x[0] === 'MOI' ? 'MOI' : 'MOD', x[1], x[2]); });
    (D[id].snap.eq || []).forEach(function (x) { put(x[0] === 'Apoio' ? 'EQI' : 'EQD', x[1], x[2]); });
  });
  return n;
}
function shFech(p) {
  var q = S.projetos.filter(function (x) { return x.id === (p._orig || p.id); })[0] || p;
  if (!q._real) { fechCarregar(p).then(agendar); return titulo('FECHAMENTO MENSAL (REALIZADO)') + '<div class="vazio">Carregando os lançamentos…</div>'; }
  if (p.crono && !p._cro) { croCarregar(p); return titulo('FECHAMENTO MENSAL (REALIZADO)') + '<div class="vazio">Carregando o cronograma…</div>'; }
  var V = S.v.fech || (S.v.fech = {}), c = calc(p), hojeMi = (function () { var d = new Date(); return d.getFullYear() * 12 + d.getMonth(); })();
  var meses = (c.res.months || []).slice(); if (p.crono && p._cro) croCalc(p).meses.forEach(function (m) { if (meses.indexOf(m) < 0) meses.push(m); });
  Object.keys(q._real).forEach(function (id) { var mi = fechMiDe(id); if (mi != null && meses.indexOf(mi) < 0) meses.push(mi); });
  meses.sort(function (a, b) { return a - b; });
  if (!meses.length) meses = [hojeMi];
  var mi = V[q.id] != null ? V[q.id] : (meses.indexOf(hojeMi) >= 0 ? hojeMi : meses.filter(function (m) { return m <= hojeMi; }).pop() || meses[0]);
  var doc = fechDoc(p, mi), ed = podeEditar() && !doc.fechado, adm = ehAdmin() && podeEditar(), sv = function () { fechSalvar(p, mi); agendar(); };
  var t = fechTot(doc), ac = fechAcum(p, mi), pr = fechPrevisto(p, mi), av = fechAvanco(p, mi), X = custoResumo(p), orc = X.dir + X.ind;
  var s = titulo('FECHAMENTO MENSAL (REALIZADO)', '<label class="revc-sel">Mês <select aria-label="Mês do fechamento" ' + h(function (el) { V[q.id] = +el.value; agendar(); }) + '>' +
    meses.map(function (m) { var d = q._real[fechId(m)]; return '<option value="' + m + '"' + (m === mi ? ' selected' : '') + '>' + mmaa(m) + (d && d.fechado ? ' · fechado' : d && ((d.custo || []).length || (d.efet || []).length) ? ' · em aberto' : '') + '</option>'; }).join('') + '</select></label>' +
    '<span class="chip ' + (doc.fechado ? 'ok' : '') + '">' + (doc.fechado ? 'Fechado em ' + fdh(doc.fechadoEm) : 'Em aberto') + '</span>' +
    (podeEditar() ? (doc.fechado ? (adm ? bt('Reabrir mês', function () { doc.fechado = false; sv(); }, 'lk') : '') : bt('Fechar mês', function () { confirma('Fechar ' + mmaa(mi) + '?\n\nOs lançamentos do mês ficam travados. Depois, crie a nova revisão do projeto para congelar o planejamento deste fechamento.', function () { doc.fechado = true; doc.fechadoEm = new Date().toISOString(); doc.por = S.papel.nome || S.papel.email || ''; doc.av = av; sv(); }); }, 'lk')) : ''));
  /* cartões */
  var evR = realEV(p, mi), cpi = ac.total && evR != null ? evR / ac.total : null;
  var kt = function (rot, val, sub, cls) { return '<div class="kt' + (cls ? ' ' + cls : '') + '"><span>' + rot + '</span><b>' + val + '</b>' + (sub ? '<i>' + sub + '</i>' : '') + '</div>'; };
  s += '<div class="gk fech-k">' + (av ? kt('Avanço físico acumulado', pct(av.ev), 'previsto ' + pct(av.pv) + ' · no mês ' + pct(av.mev) + ' (prev. ' + pct(av.mpv) + ')', 'hero') : '') +
    kt('Custo real do mês', 'R$ ' + compact(t.total), 'direto ' + compact(t.D) + ' · indireto ' + compact(t.I) + ' · previsto ' + compact(pr.custo), t.total > pr.custo && pr.custo ? 'ru' : '') +
    kt('Custo real acumulado', 'R$ ' + compact(ac.total), 'previsto até o mês ' + compact(pr.custoAc), ac.total > pr.custoAc && pr.custoAc ? 'ru' : '') +
    kt('CPI (desempenho de custo)', cpi == null ? '–' : nf2.format(cpi), 'valor agregado ÷ custo real, nos meses lançados · acima de 1 = economia', cpi != null && cpi < 1 ? 'ru' : '') +
    kt('Efetivo médio do mês', int(Math.round(t.efet.MOD + t.efet.MOI)) + ' pessoas', 'direta ' + nf2.format(t.efet.MOD) + ' · indireta ' + nf2.format(t.efet.MOI) + ' · previsto ' + nf2.format(pr.mo.D + pr.mo.I)) +
    kt('Equipamentos médios', nf2.format(t.efet.EQD + t.efet.EQI), 'produção ' + nf2.format(t.efet.EQD) + ' · apoio ' + nf2.format(t.efet.EQI) + ' · previsto ' + nf2.format(pr.eq.D + pr.eq.I)) + '</div>';
  /* custo real */
  var eap = [], cc = idrAtivs(p).map(function (a) { return a.nome; });
  if (p.crono && p._cro) p._cro.tasks.forEach(function (x) { if (x.l >= 1 && x.l <= 2) eap.push(x.w + ' ' + x.n); });
  if (p.ccs && p.ccs.length) { eap = p.ccs.filter(function (c) { return c.t !== 'I'; }).map(function (c) { return c.d; }).concat(eap); cc = p.ccs.filter(function (c) { return c.t === 'I'; }).map(function (c) { return c.d; }).concat(cc); }
  s += '<div class="gc"><h3>Custo real do mês</h3><p class="aj">Lance o que foi gasto no mês (notas, folha, medições de terceiros, aluguel de equipamentos…). Direto = obra; indireto = administração, canteiro, apoio.</p>' +
    '<div class="tw"><table class="g fech-t"><thead><tr><th>TIPO</th><th>CATEGORIA</th><th class="l">EAP / CENTRO DE CUSTO</th><th class="l">DESCRIÇÃO / DOCUMENTO</th><th>VALOR (R$)</th>' + (ed ? '<th></th>' : '') + '</tr></thead><tbody>' +
    (doc.custo.length ? doc.custo.map(function (l, i) {
      return '<tr>' + cel('fc-t' + i, l.t || 'D', ed ? function (v) { l.t = v; sv(); } : null, { ops: ['D', 'I'], rotulos: { D: 'Direto', I: 'Indireto' }, c: true }) +
        cel('fc-c' + i, l.c || 'OUT', ed ? function (v) { l.c = v; sv(); } : null, { ops: FECH_CAT, rotulos: FECH_CATN }) +
        cel('fc-r' + i, l.r || '', ed ? function (v) { l.r = v; sv(); } : null, { ops: [''].concat(l.t === 'I' ? cc : eap), rotulos: { '': '—' } }) +
        cel('fc-d' + i, l.d || '', ed ? function (v) { l.d = v; sv(); } : null) +
        cel('fc-v' + i, num(l.v), ed ? function (v) { l.v = num(v); sv(); } : null, { t: 'money' }) +
        (ed ? '<td class="c"><button class="lk" aria-label="Excluir lançamento" ' + h(function () { doc.custo.splice(i, 1); sv(); }) + '>×</button></td>' : '') + '</tr>';
    }).join('') : '<tr><td colspan="6" class="vz c">Nenhum lançamento de custo neste mês.</td></tr>') +
    '</tbody><tfoot><tr><td colspan="4">TOTAL DO MÊS · direto ' + money(t.D) + ' · indireto ' + money(t.I) + '</td><td class="n">' + money(t.total) + '</td>' + (ed ? '<td></td>' : '') + '</tr></tfoot></table></div>' +
    (ed ? '<div class="row" style="gap:8px;margin-top:8px">' + bt('+ Custo direto', function () { doc.custo.push({ id: uid(), t: 'D', c: 'MO', r: '', d: '', v: 0 }); fechSalvar(p, mi); }, 'lk') + bt('+ Custo indireto', function () { doc.custo.push({ id: uid(), t: 'I', c: 'MO', r: '', d: '', v: 0 }); fechSalvar(p, mi); }, 'lk') + '</div>' : '');
  /* resumo por categoria */
  s += '<div class="tw" style="margin-top:12px"><table class="g fech-t"><thead><tr><th class="l">CATEGORIA</th><th>DIRETO (R$)</th><th>INDIRETO (R$)</th><th>TOTAL (R$)</th></tr></thead><tbody>' +
    FECH_CAT.map(function (k) { var d = num(t.cat['D:' + k]), i = num(t.cat['I:' + k]); return '<tr><td>' + FECH_CATN[k] + '</td><td class="n">' + money(d) + '</td><td class="n">' + money(i) + '</td><td class="n k">' + money(d + i) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  /* efetivo diário */
  var nd = fechDias(mi), dias = []; for (var d = 1; d <= nd; d++) dias.push(('0' + d).slice(-2));
  var wd = function (dd) { return new Date(Date.UTC(Math.floor(mi / 12), mi % 12, +dd)).getUTCDay(); };
  var grupos = ['MOD', 'MOI', 'EQD', 'EQI'];
  var nomesMo = Object.keys(ctxDe(p).mao || {}).sort(ordAlfa), nomesEq = Object.keys(ctxDe(p).vem || {}).sort(ordAlfa);
  s += '<div class="gc"><h3>Efetivo e equipamentos – real por dia</h3><p class="aj">Quantidade de pessoas e de equipamentos presentes em cada dia. A média do mês forma o histograma real.' + (ed ? ' Use “Trazer dos RDOs” para preencher com os RDOs emitidos.' : '') + '</p>' +
    (ed ? '<div class="row fech-add">' + '<select aria-label="Tipo" ' + h(function (el) { V.tipoNovo = el.value; }) + '>' + grupos.map(function (g) { return '<option value="' + g + '"' + ((V.tipoNovo || 'MOD') === g ? ' selected' : '') + '>' + FECH_TIPO[g] + '</option>'; }).join('') + '</select>' +
      '<input list="dl-fech-' + ((V.tipoNovo || 'MOD').charAt(0) === 'M' ? 'mo' : 'eq') + '" placeholder="Função ou equipamento (dos bancos de dados)" aria-label="Função ou equipamento" value="' + esc(V.nomeNovo || '') + '" data-live ' + h(function (el) { V.nomeNovo = el.value; }) + '>' +
      bt('+ Incluir', function () { var n = String(V.nomeNovo || '').trim(); if (!n) return aviso('Digite a função ou o equipamento.'); doc.efet.push({ id: uid(), t: V.tipoNovo || 'MOD', n: n.toUpperCase(), d: {} }); V.nomeNovo = ''; fechSalvar(p, mi); }, 'lk') +
      bt('Trazer dos RDOs', function () { if (!q._rdo) { rdoCarregar(q); return aviso('Carregando os RDOs… clique de novo em instantes.'); } var n = fechDoRdo(p, mi); fechSalvar(p, mi); aviso(n ? n + ' RDO(s) emitido(s) do mês importado(s).' : 'Nenhum RDO emitido neste mês.'); }, 'lk') +
      bt('Copiar lista do mês anterior', function () { var ant = q._real[fechId(mi - 1)]; if (!ant || !(ant.efet || []).length) return aviso('O mês anterior não tem efetivo lançado.'); var ex = {}; doc.efet.forEach(function (r) { ex[r.t + '|' + r.n] = 1; }); ant.efet.forEach(function (r) { if (!ex[r.t + '|' + r.n]) doc.efet.push({ id: uid(), t: r.t, n: r.n, d: {} }); }); fechSalvar(p, mi); }, 'lk') +
      '</div><datalist id="dl-fech-mo">' + nomesMo.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist><datalist id="dl-fech-eq">' + nomesEq.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>' : '');
  if (!doc.efet.length) s += '<div class="vazio">Nenhum efetivo lançado neste mês.</div>';
  else {
    s += '<div class="tw fech-tw" id="tw-fech"><table class="g fech-d"><thead><tr><th class="l fx">FUNÇÃO / EQUIPAMENTO</th><th>MÉDIA</th><th>PREV.</th>' + dias.map(function (dd) { var w = wd(dd); return '<th class="' + (w === 0 || w === 6 ? 'fds' : '') + '">' + dd + '<small>' + 'DSTQQSS'.charAt(w) + '</small></th>'; }).join('') + (ed ? '<th></th>' : '') + '</tr></thead><tbody>';
    grupos.forEach(function (g) {
      var L = doc.efet.filter(function (r) { return r.t === g; }).sort(function (a, b) { return ordAlfa(a.n, b.n); }); if (!L.length) return;
      var tg = dias.map(function (dd) { return L.reduce(function (a, r) { return a + num((r.d || {})[dd]); }, 0); });
      s += '<tr class="co"><td class="fx">' + FECH_TIPO[g] + '</td><td class="n">' + nf2.format(t.efet[g]) + '</td><td class="n">' + nf2.format(g === 'MOD' ? pr.mo.D : g === 'MOI' ? pr.mo.I : g === 'EQD' ? pr.eq.D : pr.eq.I) + '</td>' + tg.map(function (v) { return '<td class="n">' + (v ? int(v) : '') + '</td>'; }).join('') + (ed ? '<td></td>' : '') + '</tr>';
      L.forEach(function (r) {
        var ds = Object.keys(r.d || {}).filter(function (dd) { return num(r.d[dd]); }), med = t.dias ? ds.reduce(function (a, dd) { return a + num(r.d[dd]); }, 0) / t.dias : 0, prv = num(pr.itens[g + '|' + semAcento(r.n)]);
        s += '<tr><td class="fx">' + esc(r.n) + '</td><td class="n">' + nf2.format(med) + '</td><td class="n vz">' + (prv ? nf2.format(prv) : '–') + '</td>' +
          dias.map(function (dd) { return cel('fe-' + r.id + '-' + dd, num((r.d || {})[dd]) || null, ed ? function (v) { r.d = r.d || {}; if (num(v)) r.d[dd] = num(v); else delete r.d[dd]; sv(); } : null, { t: 'int', cls: wd(dd) === 0 || wd(dd) === 6 ? 'fds' : '' }); }).join('') +
          (ed ? '<td class="c"><button class="lk" aria-label="Excluir linha" ' + h(function () { doc.efet = doc.efet.filter(function (x) { return x !== r; }); sv(); }) + '>×</button></td>' : '') + '</tr>';
      });
    });
    s += '</tbody></table></div><p class="nota">Média = soma do mês ÷ dias com efetivo lançado (' + t.dias + '). Pico do mês: MO direta ' + int(t.pico.MOD) + ' · MO indireta ' + int(t.pico.MOI) + ' · equipamentos ' + int(t.pico.EQD + t.pico.EQI) + '.</p>';
  }
  s += '</div>';
  /* histórico dos fechamentos */
  var hist = Object.keys(ac.meses).map(Number).sort(function (a, b) { return a - b; });
  if (hist.length) {
    var acD = 0, acI = 0;
    s += '<div class="gc"><h3>Histórico dos fechamentos</h3><div class="tw"><table class="g fech-t"><thead><tr><th>MÊS</th><th>SITUAÇÃO</th><th>DIRETO (R$)</th><th>INDIRETO (R$)</th><th>TOTAL (R$)</th><th>ACUMULADO (R$)</th><th>MO DIRETA</th><th>MO INDIRETA</th><th>EQUIPAMENTOS</th></tr></thead><tbody>' +
      hist.map(function (m) { var x = ac.meses[m]; acD += x.D; acI += x.I; return '<tr' + (m === mi ? ' class="on"' : '') + '><td class="c">' + mmaa(m) + '</td><td class="c">' + (x.fechado ? 'Fechado' : 'Em aberto') + '</td><td class="n">' + money(x.D) + '</td><td class="n">' + money(x.I) + '</td><td class="n">' + money(x.D + x.I) + '</td><td class="n k">' + money(acD + acI) + '</td><td class="n">' + nf2.format(x.efet.MOD) + '</td><td class="n">' + nf2.format(x.efet.MOI) + '</td><td class="n">' + nf2.format(x.efet.EQD + x.efet.EQI) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  }
  return s;
}

/* RDO e realizado acompanham o projeto ao liberar ou tornar rascunho; somem ao excluir */
var SUB_PROJ = ['rdo', 'real'];
function subMover(p, antigo) {
  SUB_PROJ.forEach(function (sc) {
    db.collection(antigo + '/' + p.id + '/' + sc).get().then(function (r) {
      r.docs.forEach(function (d) { gravar(p._raiz + '/' + p.id + '/' + sc + '/' + d.id, clone(d.data())); gravar(antigo + '/' + p.id + '/' + sc + '/' + d.id, null); });
    }, function () { });
  });
  p._rdo = null; p._real = null;
}
function subExcluir(p) {
  SUB_PROJ.forEach(function (sc) { db.collection(p._raiz + '/' + p.id + '/' + sc).get().then(function (r) { r.docs.forEach(function (d) { gravar(p._raiz + '/' + p.id + '/' + sc + '/' + d.id, null); }); }, function () { }); });
}


/* ================= REALIZADO NOS GRÁFICOS E RELATÓRIOS ================= */
/* valor agregado (orçamento × avanço físico real) só dos meses com fechamento lançado, para o CPI comparar períodos iguais */
function realEV(p, ate) {
  if (!p.crono || !p._cro) return null;
  var R = croCalc(p), X = custoResumo(p), orc = X.dir + X.ind, M = fechAcum(p, ate).meses, f = 0;
  Object.keys(M).forEach(function (k) { if (M[k].D || M[k].I) f += num(R.mR[+k]) / (R.tot.v || 1); });
  return orc * f;
}
function realPronto(p) { var q = S.projetos.filter(function (x) { return x.id === (p._orig || p.id); })[0] || p; if (!q._real && db) { fechCarregar(p).then(agendar); return false; } return true; }
function realMeses(p) { var A = fechAcum(p, null); return A.meses; }
function realUltimo(p) { var ks = Object.keys(realMeses(p)).map(Number).filter(function (k) { var m = realMeses(p)[k]; return m.D || m.I || m.efet.MOD || m.efet.MOI || m.efet.EQD || m.efet.EQI; }).sort(function (a, b) { return a - b; }); return ks.length ? ks[ks.length - 1] : null; }
/* bloco do Painel: custo previsto × real acumulado */
function graReal(p) {
  if (!realPronto(p)) return '';
  var c = calc(p), M = realMeses(p), ult = realUltimo(p), X = custoResumo(p);
  if (ult == null) return '<div class="gc gra-real"><h3>Custo previsto × realizado</h3><p class="gq">Ainda não há realizado lançado. Lance o custo real e o efetivo em <b>Planejamento › Fechamento mensal (realizado)</b> para comparar com o previsto aqui.</p></div>';
  var ms = (c.res.months || []).slice(); Object.keys(M).forEach(function (k) { k = +k; if (ms.indexOf(k) < 0) ms.push(k); }); ms.sort(function (a, b) { return a - b; });
  var prevMes = {}; (c.res.months || []).forEach(function (mi, i) { prevMes[mi] = num(c.fin.total.mes[i]); });
  var ap = 0, ar = 0, sP = [], sR = [], prevAte = 0, realAte = 0;
  ms.forEach(function (mi) { ap += num(prevMes[mi]); sP.push(ap); if (mi <= ult) { ar += M[mi] ? M[mi].D + M[mi].I : 0; sR.push(ar); } else sR.push(null); if (mi <= ult) { prevAte = ap; realAte = ar; } });
  var av = p.crono && p._cro ? fechAvanco(p, ult) : null, ev = realEV(p, ult), cpi = ev != null && realAte ? ev / realAte : null;
  var k = function (rot, v, sub, cls) { return '<div class="kt' + (cls ? ' ' + cls : '') + '"><span>' + rot + '</span><b>' + v + '</b>' + (sub ? '<i>' + sub + '</i>' : '') + '</div>'; };
  return '<div class="gc gra-real"><h3>Custo previsto × realizado <span class="vz" style="font-weight:500">· até ' + mmaa(ult) + '</span></h3>' +
    '<div class="gk fech-k">' + k('Previsto acumulado', 'R$ ' + compact(prevAte), 'cronograma financeiro') + k('Realizado acumulado', 'R$ ' + compact(realAte), 'fechamentos lançados', realAte > prevAte ? 'ru' : '') +
    k('Diferença', revcSinal(realAte - prevAte, function (v) { return 'R$ ' + compact(v); }), prevAte ? pct((realAte - prevAte) / prevAte) + ' do previsto' : '', realAte > prevAte ? 'ru' : '') +
    (ev != null ? k('Valor agregado', 'R$ ' + compact(ev), 'orçamento × avanço real dos meses lançados') + k('CPI', cpi == null ? '–' : nf2.format(cpi), 'acima de 1 = custo abaixo do agregado', cpi != null && cpi < 1 ? 'ru' : '') : '') + '</div>' +
    revcLinhas([{ nome: 'Previsto acumulado', cor: REVC_COR.base, dash: true, v: sP }, { nome: 'Realizado acumulado', cor: REVC_COR.at, w: 3, v: sR }], ms.map(mmaa), { titulo: 'Custo acumulado previsto e realizado' }) +
    '<p class="gq">O realizado considera só os meses lançados no Fechamento mensal; o CPI compara o valor agregado e o custo real desses mesmos meses.</p></div>';
}


/* desembolso das compras de suprimentos (responsabilidade da contratada) por mês: previsto pela data de entrega + prazo de pagamento; pago pela data informada */
function supDesembolso(p) {
  var out = { prev: {}, pago: {}, n: 0, tot: 0, totPago: 0 };
  if (!p.sup || !p.sup.it) return out;
  var M; try { M = supCalc(p); } catch (e) { return out; }
  var D = supDados(p).it, dia = function (x) { return x ? E.day(x) : null; };
  (M.itens || []).forEach(function (I) {
    var o = D[I.k] || {}, v = num(o.valor); if (!v || I.resp === 'Contratante') return;
    out.n++; out.tot += v;
    if (o.dtPag) { var vp = o.vPag != null && o.vPag !== '' ? num(o.vPag) : v, mp = miDe(dia(o.dtPag)); out.pago[mp] = (out.pago[mp] || 0) + vp; out.totPago += vp; return; }
    var base = dia(o.dtRec) || dia(o.dtPrev) || I.dtPrev || I.lRec || I.nec; if (base == null) return;
    var pg = o.pgDias == null || o.pgDias === '' ? 30 : num(o.pgDias), mi = miDe(base + pg); out.prev[mi] = (out.prev[mi] || 0) + v;
  });
  return out;
}


/* ---------- mapa colorido pelo avanço ----------
   Cada elemento do KMZ é ligado a uma área do cronograma (Sub-Campo ou Sub-Parque) pelo nome; o que não casar
   automaticamente pode ser ligado à mão (p.mapas[tipo].vinc). A cor segue o Quadro de saldos. */
var MAPA_AVC = { ok: '#2e9e5b', an: '#e0b000', ni: '#e8762c' };
function mapaSt(pc) { return pc >= 99.95 ? 'ok' : pc > 0.0001 ? 'an' : 'ni'; }
function mapaNorm(x) { return semAcento(x || '').replace(/[^A-Z0-9]+/g, ' ').trim().replace(/\b0+(\d)/g, '$1').replace(/\s+/g, ''); }
function mapaNum(x) { var m = semAcento(x || '').match(/\d+/g); return m ? m.map(function (n) { return +n; }).join('-') : null; }
function mapaLimpa(a) { return String(a || '').replace(/^\s*\d+\s*[.)-]\s*/, ''); }
function mapaAreas(p, nv, g) {
  var R = croCalc(p), A = {};
  var dentro = function (t) { if (!g) return true; var x = t; while (x) { if (x.u === g) return true; x = R.by[x.p]; } return false; };
  R.leaves.forEach(function (t) {
    var k = nv === 'SP' ? t.sp : t.sc; if (!k || !dentro(t)) return;
    var o = A[k] || (A[k] = { bc: 0, sb: 0, n: 0, sp: 0 }), b = num(t.bc), r = realDe(t); o.bc += b; o.sb += b * r; o.n++; o.sp += r;
  });
  var out = {}; Object.keys(A).forEach(function (k) { var o = A[k]; out[k] = o.bc ? o.sb / o.bc : o.sp / o.n; });
  return out;
}
function mapaVincular(M, areas, man) {
  var ix = {}, num1 = {}, dup = {}; Object.keys(areas).forEach(function (a) { ix[mapaNorm(a)] = a; ix[mapaNorm(mapaLimpa(a))] = a; var n = mapaNum(mapaLimpa(a)); if (n) { if (num1[n]) dup[n] = 1; num1[n] = a; } });
  var V = {}, nomes = {}, ok = 0, tot = 0;
  M.fs.forEach(function (f) { if (f.t === 'P' || !f.n || nomes[f.n]) return; nomes[f.n] = 1; tot++;
    var a = man && man[f.n] !== undefined ? man[f.n] : ix[mapaNorm(f.n)] || (function () { var n = mapaNum(f.n); return n && !dup[n] ? num1[n] : null; })();
    if (a && areas[a] != null) { V[f.n] = { a: a, pc: areas[a] }; ok++; } });
  return { V: V, ok: ok, tot: tot, nomes: Object.keys(nomes) };
}
function mapaAvPainel(p, tipo, M, ed) {
  var V = S.v.mapa; V._av = null;
  if (!p.crono) return '';
  if (!p._cro) { croCarregar(p); return '<h4>Avanço da obra</h4><p class="mp-av-n">Carregando o cronograma…</p>'; }
  var nv = V.nv || 'SC', inf = (p.mapas || {})[tipo] || {}, man = (inf.vinc || {})[nv] || {}, areas = mapaAreas(p, nv, V.g ? +V.g : 0), nA = Object.keys(areas).length;
  var L = mapaVincular(M, areas, man);
  if (V.av) V._av = L.V;
  var R = croCalc(p), grupos = []; Object.keys(R.porMacro).forEach(function (u) { var g = R.by[u]; while (R.by[g.p] && R.by[g.p].l >= 2) g = R.by[g.p]; if (grupos.indexOf(g) < 0) grupos.push(g); }); grupos.sort(function (a, b) { return cpuOrd(a.w, b.w); });
  var cont = { ok: 0, an: 0, ni: 0 }; Object.keys(L.V).forEach(function (k) { cont[mapaSt(L.V[k].pc)]++; });
  var s = '<h4>Avanço da obra</h4><label class="mp-cam"><input type="checkbox"' + (V.av ? ' checked' : '') + ' ' + h(function () { V.av = !V.av; agendar(); }) + '><i style="background:linear-gradient(90deg,' + MAPA_AVC.ok + ',' + MAPA_AVC.an + ',' + MAPA_AVC.ni + ')"></i><span>Colorir pelo avanço</span><em></em></label>' +
    '<div class="mp-av-f"><select aria-label="Áreas" ' + h(function (el) { V.nv = el.value; agendar(); }) + '><option value="SC"' + (nv === 'SC' ? ' selected' : '') + '>Áreas: Sub-Campos</option><option value="SP"' + (nv === 'SP' ? ' selected' : '') + '>Áreas: Sub-Parques</option></select>' +
    '<select aria-label="Grupo da EAP" ' + h(function (el) { V.g = el.value; agendar(); }) + '><option value="">Todas as atividades</option>' + grupos.map(function (g) { return '<option value="' + g.u + '"' + (String(g.u) === String(V.g || '') ? ' selected' : '') + '>' + esc(g.w + ' ' + g.n) + '</option>'; }).join('') + '</select></div>' +
    (nA ? '<p class="mp-av-n">' + int(L.ok) + ' de ' + int(L.tot) + ' elementos ligados a ' + int(nA) + ' áreas do cronograma.' + (V.av ? '<br><span class="mp-av-l"><i style="background:' + MAPA_AVC.ok + '"></i>Concluído ' + cont.ok + '</span><span class="mp-av-l"><i style="background:' + MAPA_AVC.an + '"></i>Em andamento ' + cont.an + '</span><span class="mp-av-l"><i style="background:' + MAPA_AVC.ni + '"></i>Não iniciado ' + cont.ni + '</span>' : '') + '</p>'
      : '<p class="mp-av-n">As tarefas do cronograma não têm ' + (nv === 'SP' ? 'Sub-Parque' : 'Sub-Campo') + '. O mapa usa esses campos do MS Project para saber a área de cada tarefa.</p>');
  if (nA && ed) {
    var areaN = {}; M.fs.forEach(function (f) { if (f.t !== 'P' && f.n && !/^(POLYLINE|POLYGON|PATH|LINE|CAMINHO|LINHA|POLIGONO)\b|^\s*\[/i.test(semAcento(f.n))) areaN[f.n] = 1; });
    var sem = L.nomes.filter(function (n) { return !L.V[n] && areaN[n]; }).sort(cpuOrd), lig = L.nomes.filter(function (n) { return L.V[n]; }).sort(cpuOrd), ops = [''].concat(Object.keys(areas).sort(cpuOrd));
    var linha = function (n) { return '<div class="mp-vc"><span title="' + esc(n) + '">' + esc(n) + '</span><select aria-label="Área de ' + esc(n) + '" ' + h(function (el) { var I = p.mapas[tipo], vv = I.vinc || (I.vinc = {}), m2 = vv[nv] || (vv[nv] = {}); if (el.value === '__auto') delete m2[n]; else m2[n] = el.value || null; salvarMeta(p); agendar(); }) + '><option value="__auto">automático</option>' + ops.map(function (a) { return '<option value="' + esc(a) + '"' + (man[n] !== undefined && (man[n] || '') === a ? ' selected' : '') + '>' + (a ? esc(a) : '— não é área —') + '</option>'; }).join('') + '</select></div>'; };
    s += '<details class="mp-vd"' + (V.vincAb ? ' open' : '') + '><summary ' + h(function () { V.vincAb = !V.vincAb; }) + '>Ligar elementos às áreas (' + sem.length + ' sem área)</summary><p class="mp-av-n">A ligação automática compara o nome do elemento com o nome da área (ex.: “SPGA.01.01”). Para os demais, escolha a área.</p>' + sem.concat(lig).slice(0, 400).map(linha).join('') + '</details>';
  }
  return s;
}


/* ================= CENTROS DE CUSTO DO PROJETO =================
   Cada projeto tem a sua lista (p.ccs), gerada pelo tipo de obra: diretos por frente de serviço (civil, mecânica,
   elétrica, comissionamento, fornecimento) e indiretos por natureza (MO indireta, veículos leves, equipamentos de apoio,
   diesel, gasolina, agregados, transportes, fretes, taxas, seguros, contingências…). Código: SIGLA.G.SEQ.
   G: 0 indiretos gerais · 1 administração local · 2 canteiro · 3 serviços preliminares · 4 obra civil · 5 montagem mecânica
   · 6 montagem elétrica · 7 comissionamento · 8 fornecimento. Sem lista própria, vale a lista geral (Configurações). */
var CC_GRUPO = { 0: 'INDIRETOS', 1: 'ADMINISTRACAO', 2: 'CANTEIROS', 3: 'SERVICOS PRELIMINARES', 4: 'OBRA CIVIL', 5: 'MONTAGEM MECANICA', 6: 'MONTAGEM ELETRICA', 7: 'COMISSIONAMENTO', 8: 'FORNECIMENTO MATERIAIS' };
var CC_IND = [[0, 100, 'ENGENHARIA / PROJETOS', 0], [0, 101, 'TESTES / ENSAIOS', 0], [0, 102, 'TAXAS, LICENCAS E EMOLUMENTOS', 0], [0, 103, 'SEGUROS / FIANCAS / GARANTIAS', 0], [0, 104, 'CONTINGENCIAS', 0],
  [1, 100, 'ADMINISTRACAO LOCAL - MAO DE OBRA INDIRETA', 1], [1, 101, 'VEICULOS LEVES', 1], [1, 102, 'EQUIPAMENTOS DE APOIO', 1], [1, 103, 'COMBUSTIVEL - DIESEL', 1], [1, 104, 'COMBUSTIVEL - GASOLINA', 1], [1, 105, 'TRANSPORTE DE PESSOAL', 1], [1, 106, 'FRETES', 1], [1, 107, 'AGREGADOS (AREIA, BRITA, CASCALHO)', 1],
  [2, 100, 'MOBILIZACAO, DESMOBILIZACAO E MONTAGEM DO CANTEIRO', 1], [2, 101, 'OPERACAO E MANUTENCAO DO CANTEIRO', 1], [3, 100, 'TOPOGRAFIA, SONDAGEM E RESISTIVIDADE', 1]];
var CC_DIR = {
  UFV: [[4, 100, 'SUPRESSAO VEGETAL E LIMPEZA'], [4, 101, 'TERRAPLENAGEM'], [4, 102, 'DRENAGEM'], [4, 103, 'ACESSOS E VIAS INTERNAS'], [4, 104, 'CERCAMENTO E PORTARIA'], [4, 105, 'FUNDACOES - CRAVACAO DE ESTACAS'], [4, 106, 'BASES DE ELETROCENTROS / INVERSORES / TRANSFORMADORES'], [4, 107, 'VALAS, ESCAVACAO E REATERRO DE CABOS'], [4, 108, 'EDIFICACOES (O&M, ALMOXARIFADO, SALA DE CONTROLE)'],
    [5, 100, 'MONTAGEM DE TRACKERS / ESTRUTURAS'], [5, 101, 'MONTAGEM DE MODULOS FOTOVOLTAICOS'], [5, 102, 'MONTAGEM DE ELETROCENTROS / INVERSORES / TRANSFORMADORES'],
    [6, 100, 'CABEAMENTO CC (STRINGS E STRING BOX)'], [6, 101, 'CABEAMENTO CA / MEDIA TENSAO'], [6, 102, 'SISTEMA DE ATERRAMENTO E SPDA'], [6, 103, 'SCADA, TELECOM E CFTV'], [6, 104, 'ILUMINACAO E SERVICOS AUXILIARES'], [6, 105, 'SUBESTACAO ELEVADORA E LINHA DE CONEXAO'],
    [7, 100, 'COMISSIONAMENTO A FRIO'], [7, 101, 'COMISSIONAMENTO A QUENTE E ENERGIZACAO'], [7, 102, 'OPERACAO ASSISTIDA / TESTES DE DESEMPENHO'], [8, 100, 'FORNECIMENTO DE EQUIPAMENTOS E MATERIAIS']],
  EOL: [[4, 100, 'SUPRESSAO VEGETAL E LIMPEZA'], [4, 101, 'ACESSOS E ESTRADAS INTERNAS'], [4, 102, 'DRENAGEM'], [4, 103, 'PLATAFORMAS DE MONTAGEM'], [4, 104, 'FUNDACOES DOS AEROGERADORES'], [4, 105, 'USINA DE CONCRETO'], [4, 106, 'OBRAS CIVIS DA SUBESTACAO E EDIFICACOES'],
    [5, 100, 'MONTAGEM DE AEROGERADORES (TORRE, NACELE, ROTOR)'], [5, 101, 'MONTAGEM ELETROMECANICA DA SUBESTACAO'],
    [6, 100, 'REDE DE MEDIA TENSAO (AEREA / SUBTERRANEA)'], [6, 101, 'SISTEMA DE ATERRAMENTO E SPDA'], [6, 102, 'SCADA, FIBRA OPTICA E TELECOM'], [6, 103, 'SUBESTACAO COLETORA E LINHA DE TRANSMISSAO'],
    [7, 100, 'COMISSIONAMENTO DA REDE DE MEDIA TENSAO E SUBESTACAO'], [7, 101, 'COMISSIONAMENTO DOS AEROGERADORES E ENERGIZACAO'], [8, 100, 'FORNECIMENTO DE EQUIPAMENTOS E MATERIAIS']],
  SE: [[4, 101, 'TERRAPLENAGEM'], [4, 102, 'DRENAGEM'], [4, 103, 'MALHA DE TERRA'], [4, 104, 'FUNDACOES / BASES / PAREDES CORTA-FOGO / CX SEPARADORA DE OLEO'], [4, 105, 'CANALETAS E DUTOS'], [4, 106, 'EDIFICACOES / SISTEMA DE AGUA E ESGOTO'], [4, 107, 'URBANIZACAO / PROTECAO CONTRA INCENDIO / AR CONDICIONADO'],
    [5, 100, 'MONTAGEM DE ESTRUTURAS, SUPORTES E BARRAMENTOS'], [5, 101, 'MONTAGEM DE EQUIPAMENTOS AT'],
    [6, 100, 'MONTAGEM DE EQUIPAMENTOS EXTERNOS 13,8 KV - SERVICOS AUXILIARES'], [6, 101, 'MONTAGEM E INTERLIGACAO SPCS / TELECOM / CFTV'], [6, 102, 'MONTAGEM E INTERLIGACAO SERVICOS AUXILIARES CA/CC'], [6, 103, 'MONTAGEM DE ELETRODUTOS E ACESSORIOS'], [6, 104, 'MONTAGEM DE CABOS DE FORCA E CONTROLE'], [6, 105, 'MONTAGEM DO SISTEMA DE ATERRAMENTO'], [6, 106, 'MONTAGEM DE ILUMINACAO EXTERNA / PROTECAO CONTRA INCENDIO'],
    [7, 100, 'COMISSIONAMENTO'], [8, 100, 'FORNECIMENTO DE EQUIPAMENTOS E MATERIAIS']],
  GEN: [[4, 100, 'TERRAPLENAGEM'], [4, 101, 'DRENAGEM'], [4, 102, 'FUNDACOES'], [4, 103, 'ESTRUTURA'], [4, 104, 'ALVENARIA E VEDACOES'], [4, 105, 'PAVIMENTACAO'], [4, 106, 'ACABAMENTOS'],
    [5, 100, 'MONTAGEM MECANICA E DE EQUIPAMENTOS'], [6, 100, 'INSTALACOES ELETRICAS'], [6, 101, 'INSTALACOES HIDROSSANITARIAS'], [7, 100, 'COMISSIONAMENTO E TESTES'], [8, 100, 'FORNECIMENTO DE EQUIPAMENTOS E MATERIAIS']]
};
function ccSigla(p) { var s = semAcento(p.sigla || '').replace(/[^A-Z0-9]/g, ''); if (s) return s.slice(0, 6); var w = semAcento(p.nome || 'OBRA').replace(/[^A-Z ]/g, ' ').split(/\s+/).filter(function (x) { return x.length > 2 && ['UFV', 'SE', 'PARQUE', 'EOLICO', 'SOLAR', 'MWP', 'KV'].indexOf(x) < 0; }); return (w.map(function (x) { return x.charAt(0); }).join('') || 'OBRA').slice(0, 4); }
function ccModelo(p) { var c = tipoCat(p.tipo || '') || p.categoria; return c === 'UFV' || c === 'EOL' || c === 'SE' ? c : 'GEN'; }
function ccGerar(p) {
  var sg = ccSigla(p), L = [];
  var add = function (g, seq, nome, plan, t) { L.push({ d: sg + '.' + g + '.' + seq + ' - ' + nome, red: sg + g + seq, plan: !!plan, g: CC_GRUPO[g], t: t }); };
  CC_IND.forEach(function (x) { add(x[0], x[1], x[2], x[3], 'I'); });
  CC_DIR[ccModelo(p)].forEach(function (x) { add(x[0], x[1], x[2], 1, 'D'); });
  L.sort(function (a, b) { return a.red < b.red ? -1 : a.red > b.red ? 1 : 0; });
  return L;
}
/* lista em uso no projeto: própria ou a geral */
function ccLista(p) { return p && p.ccs && p.ccs.length ? p.ccs : (S.base.tabelas.centrosCusto || []); }
function cfgCcs(p, svp) {
  var ed = podeEditar(), L = p.ccs || [], modelo = { UFV: 'parque solar', EOL: 'parque eólico', SE: 'subestação', GEN: 'obra civil geral' }[ccModelo(p)];
  var gerar = function (substituir) {
    var novos = ccGerar(p);
    if (substituir || !L.length) p.ccs = novos;
    else { var ex = {}; L.forEach(function (c) { ex[c.red] = 1; }); novos.forEach(function (c) { if (!ex[c.red]) L.push(c); }); L.sort(function (a, b) { return a.red < b.red ? -1 : a.red > b.red ? 1 : 0; }); }
    svp(); agendar();
  };
  var corpo = L.length ? cfgTab(bloco('pcc', '', L, [{ k: 'd', rot: 'Centro de custo' }, { k: 'red', rot: 'Reduzido' }, { k: 't', rot: 'Tipo', ops: ['DIRETO', 'INDIRETO'], get: function (r) { return r.t === 'I' ? 'INDIRETO' : 'DIRETO'; }, set: function (r, x) { r.t = /^I/.test(x) ? 'I' : 'D'; } }, { k: 'plan', rot: 'Usado no planejamento', ops: ['SIM', 'NAO'], get: function (r) { return r.plan ? 'SIM' : 'NAO'; }, set: function (r, x) { r.plan = x === 'SIM'; } }, { k: 'g', rot: 'Grupo', ops: Object.keys(CC_GRUPO).map(function (k) { return CC_GRUPO[k]; }) }], svp, function () { return { d: ccSigla(p) + '.0.000 - NOVO CENTRO DE CUSTO', red: '', plan: true, g: 'INDIRETOS', t: 'I' }; }))
    : '<p class="aj">O projeto usa a lista geral de Configurações › Centros de custo (' + (S.base.tabelas.centrosCusto || []).length + ' centros). Gere a lista própria para separar os centros deste projeto.</p>';
  return cfgCard('Centros de custo do projeto', (L.length ? L.length + ' centros · ' + L.filter(function (c) { return c.t !== 'I'; }).length + ' diretos e ' + L.filter(function (c) { return c.t === 'I'; }).length + ' indiretos' : 'Sem lista própria') + ' · modelo: ' + modelo + ' · código ' + ccSigla(p) + '.G.SEQ',
    corpo + (ed ? '<div class="row" style="gap:8px;margin-top:8px">' + bt(L.length ? 'Incluir os que faltam do modelo' : 'Gerar pelo tipo de obra', function () { gerar(false); }, 'lk') + (L.length ? bt('Refazer pelo modelo', function () { confirma('Substituir a lista de centros de custo do projeto pelo modelo de ' + modelo + '?\n\nCentros incluídos à mão serão perdidos.', function () { gerar(true); }); }, 'lk') : '') + '</div>' : ''));
}


/* ================= EXCEL COM O LEIAUTE DO SISTEMA =================
   Toda planilha gerada pelas telas (tabelas montadas em linhas) passa por aqui antes do download: vira um arquivo
   com cabeçalho da marca (logos do executor, da contratante e da obra; título; projeto; data e usuário), tabela com
   cabeçalho azul, linhas zebradas, bordas, formatos numéricos, totais destacados, painéis congelados, filtro,
   configuração de impressão e marca-d'água OP Consulting. */
var XL_COR = { azul: 'FF1769E8', azulEsc: 'FF0F3F8C', tinta: 'FF1F2A3A', cinza: 'FF7B8799', zebra: 'FFF5F8FC', borda: 'FFDDE3EC', total: 'FFE7F0FD' };
var OP_LOGO_PNG = null;
function opLogoPng() {
  if (OP_LOGO_PNG) return Promise.resolve(OP_LOGO_PNG);
  return new Promise(function (res) { var im = new Image(); im.onload = function () { try { var c = document.createElement('canvas'); c.width = 720; c.height = 192; c.getContext('2d').drawImage(im, 0, 0, 720, 192); OP_LOGO_PNG = c.toDataURL('image/png'); } catch (e) { OP_LOGO_PNG = null; } res(OP_LOGO_PNG); }; im.onerror = function () { res(null); }; im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(WM_SVG.replace('opacity="0.11"', 'opacity="1"').replace('viewBox="0 0 360 96"', 'viewBox="0 0 360 96" width="720" height="192"')); });
}
function xlLogo(url) {
  if (!url || !/^data:image\/(png|jpe?g)/.test(url)) return Promise.resolve(null);
  return new Promise(function (ok) { var im = new Image(); im.onload = function () { ok({ base64: url, extension: /jpe?g/.test(url.slice(5, 16)) ? 'jpeg' : 'png', w: im.naturalWidth || 200, h: im.naturalHeight || 80 }); }; im.onerror = function () { ok(null); }; im.src = url; });
}
function xlTituloDe(nomeArq, aba) {
  var t = String(aba || '').trim(); if (t && !/^(sheet|planilha|plan)\d*$/i.test(t)) return t.toUpperCase();
  return String(nomeArq || 'Relatório').replace(/\.xlsx$/i, '').replace(/[-_]+/g, ' ').toUpperCase();
}
function xlLayout(wbS, nomeArq) {
  return Promise.all([carregaExcelJS(), carregaXlsx()]).then(function (L) {
    var XJ = L[0], XS = L[1], p = proj(), em = S.base.empresa || {}, cli = p && p.clienteId && typeof cliDe === 'function' ? cliDe(p.clienteId) : null;
    var LG = logosDe(p);
    return opLogoPng().then(function (op) { return Promise.all([xlLogo(op), xlLogo(LG.exec), xlLogo(LG.obra)]); }).then(function (logos) {
      var wb = new XJ.Workbook(); wb.creator = 'Planning Projects · OP Consulting'; wb.created = new Date();
      var B = { style: 'thin', color: { argb: XL_COR.borda } }, bordas = { top: B, left: B, bottom: B, right: B };
      var ids = logos.map(function (lg) { try { return lg ? wb.addImage({ base64: lg.base64, extension: lg.extension }) : null; } catch (e) { return null; } });
      var quem = S.papel && (S.papel.nome || S.papel.email) || '', agora = new Date();
      wbS.SheetNames.forEach(function (nomeAba) {
        var wsS = wbS.Sheets[nomeAba], ref = wsS && wsS['!ref']; if (!ref) return;
        var R = XS.utils.decode_range(ref), nC = R.e.c - R.s.c + 1;
        /* linhas de título que a tela já põe antes da tabela: viram notas acima dela (sem repetir marca e data) */
        var cheias = function (r) { var n = 0; for (var c = R.s.c; c <= R.e.c; c++) { var x = wsS[XS.utils.encode_cell({ r: r, c: c })]; if (x && x.v !== '' && x.v != null) n++; } return n; };
        var notas = [], r0 = R.s.r;
        while (r0 < R.e.r && cheias(r0) < Math.min(2, nC)) { var t0 = wsS[XS.utils.encode_cell({ r: r0, c: R.s.c })]; var tx = t0 && t0.v != null ? String(t0.v).trim() : ''; if (tx && !/OP CONSULTING|PLANNING PROJECTS|^GERADO EM|^EXPORTADO EM/i.test(tx)) notas.push(tx); r0++; }
        R = { s: { r: r0, c: R.s.c }, e: R.e }; var nR = R.e.r - R.s.r + 1;
        var ws = wb.addWorksheet(String(nomeAba).slice(0, 31));
        var H0 = 6 + notas.length; /* linha do cabeçalho da tabela */
        notas.forEach(function (tx, i) { var cn = ws.getCell(6 + i, 1); cn.value = tx; cn.font = { size: 10, italic: true, color: { argb: XL_COR.cinza } }; });
        if (notas.length) H0++;
        /* ---- faixa da marca ---- */
        var ncTit = Math.max(nC, 6);
        ws.getRow(1).height = 22; ws.getRow(2).height = 20; ws.getRow(3).height = 16; ws.getRow(4).height = 16; ws.getRow(5).height = 8;
        var tit = ws.getCell(2, 3); tit.value = xlTituloDe(nomeArq, nomeAba); tit.font = { name: 'Calibri', size: 15, bold: true, color: { argb: XL_COR.tinta } };
        var sub = ws.getCell(3, 3); sub.value = (p ? p.nome + (p.tipo ? ' · ' + tipoNome(p) : '') : 'Planning Projects') + (cli ? ' · Contratante: ' + (cli.fantasia || cli.razao || cli.nome || '') : '') + (p && p.rev ? ' · Rev. ' + revAtual(p) : '');
        sub.font = { size: 10, color: { argb: XL_COR.tinta } };
        var info = ws.getCell(4, 3); info.value = 'Emitido em ' + fdate(E.day(agora.toISOString().slice(0, 10))) + ' ' + ('0' + agora.getHours()).slice(-2) + ':' + ('0' + agora.getMinutes()).slice(-2) + (quem ? ' · por ' + quem : '') + ' · ' + (em.fantasia || em.razao || 'OP Consulting') + ' · Planning Projects';
        info.font = { size: 9, color: { argb: XL_COR.cinza } };
        for (var c0 = 1; c0 <= ncTit; c0++) { var cb = ws.getCell(5, c0); cb.border = { top: { style: 'medium', color: { argb: XL_COR.azul } } }; }
        var pos = function (id, lg, col, dir) {
          if (id == null || !lg) return; var hMax = 58, wMax = 170, k = Math.min(hMax / lg.h, wMax / lg.w);
          ws.addImage(id, { tl: { col: dir ? Math.max(col - 1.6, 2) : col, row: 0.15 }, ext: { width: Math.round(lg.w * k), height: Math.round(lg.h * k) }, editAs: 'oneCell' });
        };
        pos(ids[0], logos[0], 0.1, false);
        if (ids[1] != null) pos(ids[1], logos[1], ncTit, true);
        if (ids[2] != null) pos(ids[2], logos[2], ids[1] != null ? Math.max(ncTit - 2.2, 3) : ncTit, true);
        /* logos: OP à esquerda; executor e projeto à direita */
        /* ---- tabela ---- */
        var cab = [], larg = [];
        for (var c = 0; c < nC; c++) { var hc = wsS[XS.utils.encode_cell({ r: R.s.r, c: R.s.c + c })]; cab.push(hc ? String(hc.v == null ? '' : hc.v) : ''); larg.push(Math.min(60, Math.max(8, cab[c].length * 0.95 + 2))); }
        var pctCol = cab.map(function (t) { return /%|PERCENT|AVAN[CÇ]O|MARGEM|BDI/i.test(t); });
        for (var r = 0; r < nR; r++) {
          var row = ws.getRow(H0 + r), primeira = '', ehTot = false;
          for (var cc = 0; cc < nC; cc++) {
            var sc = wsS[XS.utils.encode_cell({ r: R.s.r + r, c: R.s.c + cc })], cell = row.getCell(cc + 1);
            if (sc) {
              if (sc.f) cell.value = { formula: sc.f, result: sc.v };
              else if (sc.t === 'd' || sc.v instanceof Date) cell.value = sc.v instanceof Date ? sc.v : new Date(sc.v);
              else cell.value = sc.v == null ? null : sc.v;
              if (cc === 0) primeira = String(sc.v == null ? '' : sc.v);
              var tam = String(sc.w != null ? sc.w : sc.v == null ? '' : sc.v).length;
              if (r > 0) larg[cc] = Math.min(60, Math.max(larg[cc], tam * 0.95 + 2));
              if (r > 0 && typeof sc.v === 'number') cell.numFmt = sc.z && sc.z !== 'General' ? sc.z : pctCol[cc] && Math.abs(sc.v) <= 5 ? '0.00%' : Number.isInteger(sc.v) && Math.abs(sc.v) < 1e6 && !/R\$|VALOR|CUSTO|VENDA|PRE[CÇ]O|TOTAL|SALDO/i.test(cab[cc]) ? '#,##0' : '#,##0.00';
              if (r > 0 && cell.value instanceof Date) cell.numFmt = 'dd/mm/yyyy';
            }
            cell.border = bordas;
            if (r === 0) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_COR.azul } }; cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; }
            else { cell.font = { size: 10, color: { argb: XL_COR.tinta } }; cell.alignment = { vertical: 'middle', horizontal: typeof (sc && sc.v) === 'number' ? 'right' : 'left', wrapText: false }; }
          }
          if (r === 0) { row.height = 30; continue; }
          ehTot = /^\s*(\(=\)|TOTAL|SUBTOTAL|SALDO|RESULTADO|PICO|PRE[CÇ]O TOTAL|LUCRO|MARGEM)/i.test(primeira);
          for (var c2 = 1; c2 <= nC; c2++) {
            var ce = row.getCell(c2);
            if (ehTot) { ce.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_COR.total } }; ce.font = { size: 10, bold: true, color: { argb: XL_COR.azulEsc } }; }
            else if (r % 2 === 0) ce.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_COR.zebra } };
          }
        }
        (wsS['!merges'] || []).forEach(function (m) { try { ws.mergeCells(H0 + m.s.r - R.s.r, m.s.c - R.s.c + 1, H0 + m.e.r - R.s.r, m.e.c - R.s.c + 1); } catch (e) { } });
        larg.forEach(function (w, i) { ws.getColumn(i + 1).width = Math.round(w); });
        if (larg[0] < 18) ws.getColumn(1).width = 18;
        ws.views = [{ state: 'frozen', xSplit: 1, ySplit: H0, showGridLines: false }];
        if (nR > 1) ws.autoFilter = { from: { row: H0, column: 1 }, to: { row: H0 + nR - 1, column: nC } };
        ws.pageSetup = { orientation: nC > 6 ? 'landscape' : 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: H0 + ':' + H0, margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } };
      });
      return xlMarca(wb).then(function () { return wb.xlsx.writeBuffer(); });
    });
  });
}


/* faixa de logos no topo de todas as telas: OP Consulting, executor e projeto (troca junto com o projeto) */
var OP_LOGO_URI = null;
function logosTopo(p) {
  if (!OP_LOGO_URI) OP_LOGO_URI = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(WM_SVG.replace('opacity="0.11"', 'opacity="1"'));
  var L = logosDe(p), it = function (u, t, cls) { return u ? '<img class="lgt' + (cls ? ' ' + cls : '') + '" src="' + u + '" alt="' + esc(t) + '" title="' + esc(t) + '">' : ''; };
  return '<span class="lgt-f">' + it(OP_LOGO_URI, 'OP Consulting', 'op') + it(L.exec, 'Executor') + it(p && L.obra, p ? 'Projeto: ' + p.nome : '') + '</span>';
}


/* ---------- vínculos: predecessoras e sucessoras (notação do MS Project em português) ----------
   TI término-início (FS) · II início-início (SS) · TT término-término (FF) · IT início-término (SF); folga em dias úteis (+2d / -1d). */
var CRO_LT_PT = { FS: 'TI', SS: 'II', FF: 'TT', SF: 'IT' };
function croLig(p, R) {
  var C = p._cro; if (C._lig && C._ligN === C.tasks.length && C._ligV === (C._ver || 0)) return C._lig;
  var id = {}, pre = {}, suc = {}, mpd = num(p.crono.mpd) || 480;
  C.tasks.forEach(function (t, i) { id[t.u] = i + 1; });
  var txt = function (u, tp, lag) { var d = num(lag) / mpd, s = (id[u] || '?') + (CRO_LT_PT[tp] || 'TI'); if (Math.abs(d) >= 0.01) s += (d > 0 ? '+' : '') + nfq.format(d) + 'd'; return s; };
  C.tasks.forEach(function (t) { (t.pr || []).forEach(function (r) { (pre[t.u] || (pre[t.u] = [])).push(txt(r[0], r[1], r[2])); (suc[r[0]] || (suc[r[0]] = [])).push(txt(t.u, r[1], r[2])); }); });
  C._lig = { id: id, pre: pre, suc: suc }; C._ligN = C.tasks.length; C._ligV = C._ver || 0; return C._lig;
}
function croLigTd(L) { if (!L || !L.length) return '<td class="c vz">–</td>'; var t = L.join('; '); return '<td class="cro-lig" title="' + esc(t) + '">' + esc(t.length > 34 ? t.slice(0, 32) + '…' : t) + '</td>'; }
function croExcel(p) {
  var R = croCalc(p), C = p._cro, LG = croLig(p, R), mpd = num(p.crono.mpd) || 480;
  carregaXlsx().then(function (X) {
    var a = [['Nº', 'EAP', 'Tarefa', 'Nível', 'Duração (d)', 'Início LB', 'Término LB', 'Início', 'Término', 'Início real', 'Término real', 'Predecessoras', 'Sucessoras', '% Previsto', '% Real', 'Venda LB (R$)', 'Custo CPU (R$)', 'Sub-Parque', 'Sub-Campo']];
    var fd = function (x) { var d = dn(x); return d == null ? '' : fdate(Math.floor(d)); };
    C.tasks.forEach(function (t) {
      var n = R.N[t.u] || {};
      a.push([LG.id[t.u], t.w || '', new Array(Math.max(0, t.l - 1) * 3 + 1).join(' ') + (t.m ? '◆ ' : '') + t.n, t.l, Math.round(num(t.dm) / mpd * 100) / 100, fd(t.bi), fd(t.bf), fd(t.i), fd(t.f), fd(t.as), fd(t.af),
        (LG.pre[t.u] || []).join('; '), (LG.suc[t.u] || []).join('; '), n.v != null ? croPct(n, 'pv') : '', n.v != null ? croPct(n, 'ev') : '', n.v || 0, n.cd || 0, t.sp || '', t.sc || '']);
    });
    var wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(a), 'Cronograma');
    var leg = [['Vínculo', 'Significado'], ['TI', 'Término-início: a tarefa começa quando a predecessora termina'], ['II', 'Início-início: começa junto com a predecessora'], ['TT', 'Término-término: termina junto com a predecessora'], ['IT', 'Início-término: termina quando a predecessora começa'], ['+2d / -1d', 'Folga (latência) em dias úteis']];
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(leg), 'Legenda dos vínculos');
    baixar(semAcento('Cronograma-' + (p.sigla ? p.sigla + '-' : '') + p.nome).replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) + '-' + isoDia(R.st) + '.xlsx', X.write(wb, { bookType: 'xlsx', type: 'array' }));
  }, function (e) { msgbox('ERRO!', e.message, 'crit'); });
}


/* ================= CURVAS S (Relatórios) =================
   Geral, Construção, Engenharia e Fornecimento, a partir do cronograma: previsto pela linha de base, tendência pelas
   datas atuais e real pelos lançamentos da planilha de avanço (ou pelo % concluído, linear entre o início e o término reais).
   Ponderação pela venda da linha de base de cada tarefa; sem venda, pela duração. */
NOMES.CURVAS = 'Curva S'; PRECISA_PROJ.CURVAS = 1; ABAS.push(['CURVAS', '#1b7f4c']);
ICA.CURVAS = '<path d="M3 20h18"/><path d="M4 18c5 0 5-12 16-13"/><path d="M6 18v-2M10 18v-5M14 18v-8M18 18v-11" stroke-dasharray="1 2"/>';
(function () { GRUPOS_ABAS.forEach(function (g) { if (g[0] === 'Relatórios' && g[1].indexOf('CURVAS') < 0) g[1].unshift('CURVAS'); }); })();
var CURVAS_DEF = [
  { k: 'G', nome: 'Curva S Geral', curto: 'Geral' },
  { k: 'C', nome: 'Curva S Construção', curto: 'Construção' },
  { k: 'E', nome: 'Curva S Engenharia', curto: 'Engenharia' },
  { k: 'F', nome: 'Curva S Fornecimento', curto: 'Fornecimento' }];
var CURVAS_COR = { lb: '#2f6fd6', re: '#2e9e4f', tend: '#6b7280', barP: '#b9c0ca', barR: '#9fdcae', st: 'var(--tinta)' };
/* classe da tarefa pela EAP: o primeiro nome (de cima para baixo) que indica engenharia, fornecimento ou construção */
function curvaClasse(t, by) {
  var cad = [], x = t; while (x) { cad.unshift(x); x = by[x.p]; }
  for (var i = 0; i < cad.length; i++) {
    var n = semAcento(cad[i].n || '');
    if (/ENGENHAR|PROJETO(S)? (BASICO|EXECUTIVO)|DETALHAMENTO|AS[ -]?BUILT/.test(n)) return 'E';
    if (/SUPRIMENTO|FORNECIMENTO|AQUISIC|COMPRAS?\b|FABRICAC|LOGISTICA|ENTREGA|DILIGENCIAMENTO/.test(n)) return 'F';
    if (/CONSTRU|OBRAS?\b|CIVIL|MONTAGE|ELETROMEC|COMISSIONAM|CANTEIRO|TERRAPLEN|IMPLANTAC/.test(n)) return 'C';
  }
  return '';
}
function isoSemana(d) { var D = new Date(Math.floor(d) * 864e5), dia = (D.getUTCDay() + 6) % 7; D.setUTCDate(D.getUTCDate() - dia + 3); var a = new Date(Date.UTC(D.getUTCFullYear(), 0, 4)); return 1 + Math.round(((D - a) / 864e5 - 3 + ((a.getUTCDay() + 6) % 7)) / 7); }
function curvasCalc(p) {
  var R = croCalc(p); if (p._curvas && p._curvas.R === R && p._curvas.inp === p._inpC) return p._curvas;
  var IR = inpReal(p), M = inpMeta(p), st = R.st, ini = R.ini, fim = R.fim, out = { R: R, inp: p._inpC, st: st, c: {} };
  var cls = {}; R.leaves.forEach(function (t) { cls[t.u] = curvaClasse(t, R.by); });
  var sem = []; if (ini != null) for (var w = segunda(ini); w <= Math.max(fim, st); w += 7) sem.push(w);
  CURVAS_DEF.forEach(function (D) {
    var L = R.leaves.filter(function (t) { return D.k === 'G' || cls[t.u] === D.k; });
    var porVenda = L.some(function (t) { return num(t.bc) > 0; }), peso = function (t) { return porVenda ? num(t.bc) : Math.max(1, num(t.dm) / 480); };
    var tot = L.reduce(function (a, t) { return a + peso(t); }, 0), sp = {}, stn = {}, sr = {};
    L.forEach(function (t) {
      var v = peso(t); if (!v) return;
      var bi = dn(t.bi || t.i), bf = dn(t.bf || t.f), a = dn(t.i), b = dn(t.f);
      croSpread(sp, KSEM, bi, bf, v); croSpread(stn, KSEM, a, b, v);
      var r = IR[t.u], qp = num(M.q[t.u] != null ? M.q[t.u] : 100);
      if (r && r.dias.length && qp > 0) { r.dias.forEach(function (x) { if (x[0] <= st) { var k = segunda(x[0]); sr[k] = (sr[k] || 0) + v * Math.min(1, x[1] / qp); } }); return; }
      var ev = v * realDe(t) / 100;
      if (ev) { var ra = dn(t.as) || a, rb = realDe(t) >= 100 ? (dn(t.af) || b) : Math.max(ra, st); if (rb > st) rb = st; croSpread(sr, KSEM, ra, rb, ev); }
    });
    var pP = [], pT = [], pR = [], aP = [], aT = [], aR = [], cP = 0, cT = 0, cR = 0, si = -1;
    sem.forEach(function (w, i) {
      var q = tot || 1, vp = (sp[w] || 0) / q, vt = (stn[w] || 0) / q, vr = (sr[w] || 0) / q; cP += vp; cT += vt; cR += vr;
      pP.push(vp); pT.push(vt); pR.push(w <= st ? vr : null); aP.push(Math.min(1, cP)); aT.push(Math.min(1, cT)); aR.push(w <= st ? Math.min(1, cR) : null);
      if (w <= st) si = i;
    });
    out.c[D.k] = { def: D, n: L.length, tot: tot, porVenda: porVenda, sem: sem, pP: pP, pT: pT, pR: pR, aP: aP, aT: aT, aR: aR, si: si,
      prev: si >= 0 ? aP[si] : 0, real: si >= 0 ? aR[si] : 0 };
  });
  return (p._curvas = out);
}
function curvaSvg(K, st) {
  var n = K.sem.length, W = 1000, H = 380, ml = 62, mr = 50, mt = 18, mb = 44, pw = W - ml - mr, ph = H - mt - mb, bw = pw / n;
  var xc = function (i) { return ml + bw * (i + 0.5); }, y = function (v) { return mt + ph * (1 - v); };
  var mx = 0; K.pP.forEach(function (v, i) { mx = Math.max(mx, v, K.pR[i] || 0); }); mx = mx > 0 ? Math.ceil(mx * 100 / 2) * 2 / 100 : 0.02; if (mx < 0.02) mx = 0.02;
  var yb = function (v) { return mt + ph * (1 - v / mx); };
  var g = '';
  for (var k = 0; k <= 5; k++) { var yy = y(k / 5); g += '<line x1="' + ml + '" x2="' + (W - mr) + '" y1="' + yy + '" y2="' + yy + '" stroke="var(--cs-grid)"/><text x="' + (ml - 6) + '" y="' + (yy + 4) + '" text-anchor="end">' + (k * 20) + '%</text><text x="' + (W - mr + 6) + '" y="' + (yy + 4) + '">' + nf2.format(mx * 100 * k / 5) + '%</text>'; }
  var bwi = Math.max(1, Math.min(14, bw * 0.38));
  K.sem.forEach(function (w, i) {
    var v = K.pP[i]; if (v > 0) g += '<rect x="' + (xc(i) - bwi).toFixed(1) + '" y="' + yb(v).toFixed(1) + '" width="' + bwi.toFixed(1) + '" height="' + (mt + ph - yb(v)).toFixed(1) + '" fill="' + CURVAS_COR.barP + '"><title>' + fdate(w) + ' · previsto na semana ' + pct(v) + '</title></rect>';
    var r = K.pR[i]; if (r > 0) g += '<rect x="' + xc(i).toFixed(1) + '" y="' + yb(r).toFixed(1) + '" width="' + bwi.toFixed(1) + '" height="' + (mt + ph - yb(r)).toFixed(1) + '" fill="' + CURVAS_COR.barR + '"><title>' + fdate(w) + ' · real na semana ' + pct(r) + '</title></rect>';
  });
  var passo = Math.max(1, Math.ceil(n / 22));
  K.sem.forEach(function (w, i) { if (i % passo === 0) g += '<text x="' + xc(i).toFixed(1) + '" y="' + (H - mb + 14) + '" text-anchor="end" transform="rotate(-40 ' + xc(i).toFixed(1) + ' ' + (H - mb + 14) + ')">' + fdate(w).slice(0, 5) + '/' + fdate(w).slice(8, 10) + '</text>'; });
  var ln = function (arr, cor, extra) { var pts = []; arr.forEach(function (v, i) { if (v != null) pts.push(xc(i).toFixed(1) + ',' + y(v).toFixed(1)); }); return pts.length ? '<polyline fill="none" stroke="' + cor + '" stroke-width="2.4" stroke-linejoin="round" ' + (extra || '') + ' points="' + pts.join(' ') + '"/>' : ''; };
  g += ln(K.aT, CURVAS_COR.tend, 'stroke-dasharray="2 4" stroke-width="2"') + ln(K.aP, CURVAS_COR.lb) + ln(K.aR, CURVAS_COR.re, 'stroke-width="3"');
  if (K.si >= 0) {
    var xs = xc(K.si);
    g += '<line x1="' + xs + '" x2="' + xs + '" y1="' + mt + '" y2="' + (mt + ph) + '" style="stroke:' + CURVAS_COR.st + '" stroke-dasharray="6 4" stroke-width="1.4"/><text class="cs-f" x="' + (xs + 5) + '" y="' + (mt + 11) + '">Data status ' + fdate(Math.floor(st)) + '</text>';
    g += '<circle cx="' + xs + '" cy="' + y(K.prev) + '" r="4" fill="' + CURVAS_COR.lb + '"/><text class="cs-v" x="' + (xs - 6) + '" y="' + (y(K.prev) + (K.prev >= K.real ? -8 : 16)) + '" text-anchor="end" fill="' + CURVAS_COR.lb + '">' + pct(K.prev) + '</text>';
    g += '<circle cx="' + xs + '" cy="' + y(K.real) + '" r="4" fill="' + CURVAS_COR.re + '"/><text class="cs-v" x="' + (xs + 6) + '" y="' + (y(K.real) + (K.real > K.prev ? -8 : 16)) + '" fill="' + CURVAS_COR.re + '">' + pct(K.real) + '</text>';
  }
  return '<svg class="cs-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(K.def.nome) + '">' + g + '</svg>';
}
function curvaCard(p, K, st) {
  var gap = K.real - K.prev, s = '<section class="cs-card" id="cs-' + K.def.k + '">';
  s += '<header class="cs-h"><div class="cs-ds"><span>Data status <b>' + fdate(Math.floor(st)) + '</b></span><span>Semana <b>' + isoSemana(st) + '</b></span></div><h3>Curva S: ' + esc(p.nome) + ' – ' + esc(K.def.curto) + '</h3>' + logosTopo(p) + '</header>';
  if (!K.n) return s + '<div class="vazio">Nenhuma tarefa de ' + esc(K.def.curto.toLowerCase()) + ' no cronograma. A classificação usa os nomes da EAP (ex.: “Engenharia”, “Suprimentos/Fornecimento”, “Construção/Montagem”).</div></section>';
  s += '<div class="cs-gl"><span><i class="cs-li" style="background:' + CURVAS_COR.re + '"></i>Real</span><span><i class="cs-li" style="background:' + CURVAS_COR.lb + '"></i>LB previsto</span><span><i class="cs-li cs-dot" style="border-color:' + CURVAS_COR.tend + '"></i>Tendência (cronograma atual)</span><span><i class="cs-sq" style="background:' + CURVAS_COR.barR + '"></i>Real na semana</span><span><i class="cs-sq" style="background:' + CURVAS_COR.barP + '"></i>Previsto na semana</span></div>';
  s += '<div class="cs-body"><div class="cs-ch">' + curvaSvg(K, st) + '</div><div class="cs-kp"><div><span>Previsto</span><b>' + pct(K.prev) + '</b></div><div><span>Real</span><b>' + pct(K.real) + '</b></div><div class="' + (gap < -1e-9 ? 'ru' : 'ok') + '"><span>GAP</span><b>' + (gap > 0 ? '+' : '') + pct(gap) + '</b></div></div></div>';
  /* 7 semanas antes, a semana do status e 10 depois */
  var i0 = Math.max(0, K.si - 7), i1 = Math.min(K.sem.length - 1, (K.si < 0 ? 0 : K.si) + 10), off = Math.floor(st) - segunda(st), cols = [];
  for (var i = i0; i <= i1; i++) cols.push(i);
  var cel = function (v, cls) { return '<td class="' + (cls || '') + '">' + (v == null ? '' : pct(v)) + '</td>'; };
  s += '<div class="tw cs-tw"><table class="cs-t"><thead><tr><th>Data de corte</th>' + cols.map(function (i) { return '<th class="' + (i === K.si ? 'cs-at' : '') + '">' + fdate(K.sem[i] + off) + '</th>'; }).join('') + '</tr></thead><tbody>';
  s += '<tr><th>Previsto %</th>' + cols.map(function (i) { return cel(K.pP[i], i === K.si ? 'cs-at' : ''); }).join('') + '</tr>';
  s += '<tr><th>Real %</th>' + cols.map(function (i) { return cel(K.pR[i], i === K.si ? 'cs-at' : ''); }).join('') + '</tr>';
  s += '<tr><th>GAP</th>' + cols.map(function (i) { var r = K.pR[i]; if (r == null) return '<td class="' + (i === K.si ? 'cs-at' : '') + '"></td>'; var g = r - K.pP[i]; return '<td class="' + (g < -1e-9 ? 'cs-ru' : g > 1e-9 ? 'cs-ok' : '') + (i === K.si ? ' cs-at' : '') + '">' + (g > 0 ? '+' : '') + pct(g) + '</td>'; }).join('') + '</tr>';
  s += '<tr class="cs-ac"><th>Previsto acum.</th>' + cols.map(function (i) { return cel(K.aP[i], i === K.si ? 'cs-at' : ''); }).join('') + '</tr>';
  s += '<tr class="cs-ac"><th>Real acum.</th>' + cols.map(function (i) { return cel(K.aR[i], i === K.si ? 'cs-at' : ''); }).join('') + '</tr>';
  s += '</tbody></table></div><div class="nota">' + int(K.n) + ' tarefa(s) · ponderação pela ' + (K.porVenda ? 'venda da linha de base' : 'duração') + '. Previsto: linha de base; real: planilha de avanço (ou % concluído do cronograma).</div></section>';
  return s;
}
function shCurvas(p) {
  var tit = function (x) { return titulo('CURVA S', x || ''); };
  if (!p.crono) return tit() + '<div class="vazio"><h3>Sem cronograma</h3>Importe o cronograma do projeto (guia Cronograma) para gerar as curvas S.</div>';
  if (!p._cro) { croCarregar(p).then(agendar); return tit() + '<div class="vazio">Carregando o cronograma…</div>'; }
  var Q; try { Q = curvasCalc(p); } catch (e) { console.error(e); return tit() + '<div class="vazio">Não foi possível calcular as curvas: ' + esc(e.message) + '</div>'; }
  var V = S.v.curvas || (S.v.curvas = { k: 'T' }), ops = [['T', 'Todas']].concat(CURVAS_DEF.map(function (d) { return [d.k, d.curto]; }));
  var s = tit('<div class="cs-sel" role="group" aria-label="Curvas">' + ops.map(function (o) { return '<button class="cs-b' + (V.k === o[0] ? ' on' : '') + '" ' + h(function () { V.k = o[0]; agendar(); }) + '>' + o[1] + '</button>'; }).join('') + '</div>' +
    '<button class="bxl" ' + h(function () { curvasExcel(p); }) + '>' + XL_IC + 'Exportar Excel</button>');
  CURVAS_DEF.forEach(function (d) { if (V.k === 'T' || V.k === d.k) s += curvaCard(p, Q.c[d.k], Q.st); });
  return s;
}
function curvasExcel(p) {
  var Q = curvasCalc(p), st = Q.st, off = Math.floor(st) - segunda(st);
  carregaXlsx().then(function (X) {
    var wb = X.utils.book_new(), r2 = function (v) { return v == null ? '' : Math.round(v * 1e6) / 1e6; };
    CURVAS_DEF.forEach(function (d) {
      var K = Q.c[d.k], a = [['Semana', 'Início da semana', 'Data de corte', 'Previsto semana (%)', 'Previsto acum. (%)', 'Tendência acum. (%)', 'Real semana (%)', 'Real acum. (%)', 'GAP acum. (%)']];
      K.sem.forEach(function (w, i) { a.push(['S' + ('0' + isoSemana(w)).slice(-2), fdate(w), fdate(w + off), r2(K.pP[i]), r2(K.aP[i]), r2(K.aT[i]), r2(K.pR[i]), r2(K.aR[i]), K.aR[i] == null ? '' : r2(K.aR[i] - K.aP[i])]); });
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(a), d.curto.slice(0, 31));
    });
    baixar(semAcento('Curvas-S-' + (p.sigla ? p.sigla + '-' : '') + p.nome).replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) + '-' + isoDia(st) + '.xlsx', X.write(wb, { bookType: 'xlsx', type: 'array' }));
  }, function (e) { msgbox('ERRO!', e.message, 'crit'); });
}
MANUAL.CURVAS = { r: 'Curva S: quatro curvas do projeto (Geral, Construção, Engenharia e Fornecimento) geradas a partir do cronograma.',
  d: ['Previsto = linha de base; tendência = datas atuais do cronograma; real = lançamentos da Planilha de avanço (ou % concluído do cronograma). Ponderação pela venda da linha de base de cada tarefa.', 'As tarefas são classificadas pelos nomes da EAP: Engenharia/Projetos, Suprimentos/Fornecimento e Construção/Montagem/Comissionamento. A curva Geral soma todas.', 'Cada curva mostra barras semanais (previsto e real), curvas acumuladas, linha da data de status, quadro Previsto/Real/GAP e a tabela de 7 semanas antes até 10 semanas depois do status.', 'Exportação para Excel com uma planilha por curva.'],
  f: ['Lançar o avanço da semana', 'Atualizar data de status', 'Abrir Relatórios › Curva S', 'Ler GAP previsto × real', 'Replanejar'] };

})();
