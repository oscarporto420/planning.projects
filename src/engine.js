/* Motor de cálculo — planejamento de custo de obra.
   Funções puras: recebem os bancos de dados e um projeto, devolvem as linhas de cálculo
   (uma por recurso x mês) e os resumos usados nas telas. */
(function (root) {
  'use strict';
  var E = {};

  /* ---------- datas: dia = nº de dias desde 1970-01-01 (UTC); mês = ano*12 + (mês-1) ---------- */
  var DAY = 86400000;
  E.day = function (s) {
    if (s == null || s === '') return null;
    if (typeof s === 'number') return s;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (!m) return null;
    var t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    return isNaN(t) ? null : Math.round(t / DAY);
  };
  E.iso = function (d) {
    if (d == null) return '';
    return new Date(d * DAY).toISOString().slice(0, 10);
  };
  E.ymd = function (d) { var x = new Date(d * DAY); return [x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()]; };
  E.mi = function (d) { var p = E.ymd(d); return p[0] * 12 + p[1]; };
  E.som = function (mi) { return Math.round(Date.UTC(Math.floor(mi / 12), mi % 12, 1) / DAY); };
  E.eom = function (mi) { return E.som(mi + 1) - 1; };
  E.dom = function (d) { return E.ymd(d)[2]; };
  E.weekday = function (d) { return ((d + 4) % 7 + 7) % 7 + 1; }; // 1 = domingo ... 7 = sábado
  var MESES = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
  E.MESES = MESES;
  E.miLabel = function (mi) { return MESES[mi % 12].slice(0, 3) + '/' + String(Math.floor(mi / 12)).slice(2); };

  /* ---------- catálogo fixo ---------- */
  E.CONCEITOS = [
    { i: 1, k: 'MAO', item: 'A', nome: 'MAO DE OBRA' },
    { i: 2, k: 'VEM', item: 'B', nome: 'VEICULOS / MAQUINAS' },
    { i: 3, k: 'MAT', item: 'C', nome: 'MATERIAIS / FERRAMENTAS' },
    { i: 4, k: 'AQU', item: 'D', nome: 'AQUISICAO / COMPRAS' },
    { i: 5, k: 'IND', item: 'E', nome: 'INDIRETOS / INSUMOS' },
    { i: 6, k: 'SER', item: 'F', nome: 'SERVICOS TERCEIRIZADOS' }
  ];
  E.ELEMENTOS = [
    ['A1', 'SALARIOS'], ['A2', 'INSALUBRIDADE'], ['A3', 'ADICIONAL PERICULOSIDADE'], ['A4', 'HORAS EXTRAS'], ['A5', 'ADICIONAL NOTURNO'],
    ['A6', 'DESCANSO SEMANAL REMUNERADO (DSR)'], ['A7', 'INSS'], ['A8', 'FGTS'], ['A9', 'SEGURO DE VIDA'], ['A10', 'PROVISAO DE 13. SALARIO'],
    ['A11', 'PROVISAO DE FERIAS'], ['A12', 'PROVISAO FGTS RESCISAO'], ['A13', 'AVISO PREVIO'], ['A14', 'AJUDA DE CUSTO'], ['A15', 'VALE TRANSPORTE'],
    ['A16', 'ASSISTENCIA ODONTOLOGICA'], ['A17', 'ALIMENTACAO'], ['A18', 'CESTA BASICA'], ['A19', 'PLANO SAUDE / ASSISTENCIA MEDICA'], ['A20', 'DESPESAS VIAGENS'],
    ['A21', 'ADMISSIONAL / DEMISSIONAL / PERIODICO (PCMSO)'], ['A22', 'EQUIPAMENTOS DE SEGURANCA (EPI)'], ['A23', 'PARTICIPACAO NOS LUCROS E RESULTADOS (PLR)'],
    ['B1', 'LOCACAO / DEPRECIACAO'], ['B2', 'COMBUSTIVEIS'], ['B3', 'LAVAGEM / ASPIRACAO'], ['B4', 'OFICINA / BORRACHARIA'], ['B5', 'PEDAGIOS / ESTACIONAMENTOS'],
    ['B6', 'SISTEMA DE RASTREAMENTO'], ['B7', 'MANUTENCAO PREVENTIVA'], ['B8', 'OLEOS / LUBRIFICANTES'], ['B9', 'MOBILIZACAO / DESMOBILIZACAO'], ['B10', 'IMPOSTOS / TAXAS'], ['B11', 'SEGUROS'],
    ['C1', 'LOCACAO / DEPRECIACAO / OUTROS'], ['C2', 'MOBILIZACAO / DESMOBILIZACAO / INSTALACAO'], ['C3', 'MANUTENCAO / TROCA / REPARO'],
    ['D1', 'AQUISICAO DE MATERIAIS / FERRAMENTAS / EQUIPAMENTOS'],
    ['E1', 'CUSTOS MENSAIS / RATEIO'], ['E2', 'CUSTOS FIXOS'], ['E3', 'CUSTOS PERIODICOS'],
    ['F1', 'CUSTOS MENSAIS'], ['F2', 'CUSTOS FIXOS'], ['F3', 'CUSTOS PERIODICOS']
  ];
  E.REL_AQUISICAO = 'AQUISICAO / COMPRAS';
  E.REL_RATEIO = 'RATEIO';

  function num(v) { return typeof v === 'number' && isFinite(v) ? v : 0; }
  function sim(v) { return v === 'SIM'; }
  function index(rows, key) {
    var m = Object.create(null);
    (rows || []).forEach(function (r) { var k = r[key || 'd']; if (k != null && !(k in m)) m[k] = r; });
    return m;
  }
  E.num = num;

  /* ---------- preparação dos bancos ---------- */
  E.prepare = function (base) {
    var t = base.tabelas || {}, g = base.ghe || {};
    var ctx = { base: base, t: t, v: t.val || {} };
    // preços de EPI e exames
    var epiPreco = index(g.epi), exPreco = index(g.pcmso);
    ctx.epiPreco = epiPreco; ctx.exPreco = exPreco;
    ctx.epiGrupoValor = Object.create(null);
    (g.epicomp || []).forEach(function (c) {
      ctx.epiGrupoValor[c.g] = (ctx.epiGrupoValor[c.g] || 0) + num((epiPreco[c.epi] || {}).v);
    });
    ctx.gheValor = Object.create(null);
    (g.comp || []).forEach(function (c) {
      var p = num((exPreco[c.ex] || {}).v), o = ctx.gheValor[c.g] || (ctx.gheValor[c.g] = { adm: 0, dem: 0, per: 0 });
      o.adm += p * num(c.qa); o.dem += p * num(c.qd); o.per += p * num(c.qp);
    });
    ctx.gheGrupo = index(g.grupos, 'g');
    ctx.combustivel = index(t.combustivel, 't');
    ctx.plano = index(t.planoSaude, 't');
    var soma = function (l) { return (l || []).reduce(function (a, r) { return a + num(r.d) * num(r.n); }, 0); };
    ctx.alimPro = soma(t.alimPro); ctx.alimLoc = soma(t.alimLoc);
    // valor médio de viagem por meio de transporte
    ctx.viagem = Object.create(null);
    var vg = t.viagem || { cols: [], rows: [] };
    vg.cols.forEach(function (c, i) {
      var n = vg.rows.length, s = vg.rows.reduce(function (a, r) { return a + num(r.v[i]); }, 0);
      ctx.viagem[c] = n ? s / n : 0;
    });
    ctx.mao = Object.create(null); ctx.vem = Object.create(null);
    ((base.mao || {}).rows || []).forEach(function (r) { if (!(r.d in ctx.mao)) ctx.mao[r.d] = E.maoCalc(r, ctx); });
    ((base.vem || {}).rows || []).forEach(function (r) { if (!(r.d in ctx.vem)) ctx.vem[r.d] = E.vemCalc(r, ctx); });
    /* materiais e insumos unificados: um só cadastro atende os blocos 3, 4 e 5 */
    var indRows = base.mat && base.mat.unificado ? base.mat.rows : (base.ind || {}).rows;
    ctx.mat = index((base.mat || {}).rows); ctx.ind = index(indRows); ctx.ser = index((base.ser || {}).rows);
    // soma dos periódicos de indiretos duplicados (a planilha usa SUMIF nesse campo)
    ctx.indPerSoma = Object.create(null);
    (indRows || []).forEach(function (r) { ctx.indPerSoma[r.d] = (ctx.indPerSoma[r.d] || 0) + num(r.pv); });
    return ctx;
  };

  /* ---------- mão de obra: custo mensal de uma função ---------- */
  E.maoCalc = function (r, ctx) {
    var t = ctx.t, v = ctx.v, o = { r: r };
    var he = t.horasExtras || [], pj = r.mod === 'PJ', H = num(r.sal);
    var INSS = (t.inssEmp || [0.3, 0.3]), FG = (t.fgts || {}).demais || 0, FGA = (t.fgts || {}).aprendiz || 0;
    o.sal = H;
    o.insal = sim(r.ins) ? num(v.insal) * num(v.salMin) : 0;                       // M
    o.peric = sim(r.per) ? num(v.peric) * H : 0;                                    // O
    var hora = (H + o.peric) / 220;
    o.he1 = hora * (1 + num((he[0] || {}).p)) * num(r.he1);                          // Q
    o.he2 = hora * (1 + num((he[1] || {}).p)) * num(r.he2);                          // S
    o.he3 = hora * (1 + num((he[2] || {}).p)) * num(r.he3);                          // U
    o.adNot = hora * (1 + num(v.adNot)) * num(r.an);                                 // W
    o.dsr = (o.he1 + o.he2 + o.he3) * num(v.dsr);                                    // X
    o.bruto = H + o.peric + o.he1 + o.he2 + o.he3 + o.adNot + o.dsr;                 // J
    o.brutoIns = o.bruto + o.insal;                                                  // K
    o.depVal = num(r.dep) * num(v.irpfDep);                                          // Z
    // INSS do funcionário (alíquota da faixa sobre o bruto menos a parcela a deduzir, com teto)
    var fx = (t.inss || {}).faixas || [], teto = num((t.inss || {}).teto);
    var maxAte = fx.length ? fx[fx.length - 1].ate : 0, i;
    o.inssFunc = 0;
    if (o.bruto > maxAte) o.inssFunc = teto;
    else for (i = 0; i < fx.length; i++) if (o.bruto <= fx[i].ate) { o.inssFunc = Math.max(0, o.bruto * fx[i].p - (Number(fx[i].par) || 0)); break; }
    o.inssEmp = pj ? 0 : o.bruto * (o.peric === 0 ? INSS[0] : INSS[1]);              // AB
    // IRRF
    var baseIr = o.bruto - o.depVal - o.inssFunc, ir = t.irpf || [];
    o.irPct = 0; o.irVal = 0;
    for (i = 0; i < ir.length; i++) if (ir[i].ate == null || baseIr <= ir[i].ate) { o.irPct = ir[i].p; o.irVal = baseIr * ir[i].p - num(ir[i].par); break; }
    o.liquido = o.brutoIns - (o.inssFunc + o.irVal);                                 // I
    o.fgts = pj ? 0 : o.bruto * (sim(r.apr) ? FGA : FG);                             // AE
    o.seguro = (pj || H === 0) ? 0 : num(v.seguroVida);                              // AF
    o.semRescisao = o.bruto + o.inssEmp + o.fgts + o.seguro;                         // AG
    var parc = (pj || H === 0) ? 0 : 1, T = (o.bruto / 12) * parc, ad = o.peric === 0 ? 0 : 0.048;
    o.p13 = T * (INSS[0] + ad) + T + T * FG;                                         // AI
    var Tf = T / 3;
    o.ferias = Tf + Tf * (INSS[0] + ad) + Tf * FG;                                   // AK
    o.multaFgts = pj ? 0 : (o.bruto * FG + T * FG + Tf * FG) * num(v.fgtsMulta);     // AL
    o.avisoProv = pj ? 0 : (o.bruto / 12 + o.bruto / 12 + (o.bruto / 12) / 3 + o.multaFgts + o.bruto) / 12; // AM
    o.avisoFgts = pj ? 0 : o.avisoProv * FG;                                         // AN
    o.aviso = o.avisoProv + o.avisoFgts;                                             // AO
    o.comRescisao = pj ? H : o.semRescisao + o.p13 + o.ferias + o.aviso + o.multaFgts; // AP
    o.ajuda = num(r.aj); o.transp = num(r.vt); o.odonto = num(r.od);
    o.alim = H === 0 ? 0 : ctx.alimPro;                                              // AT
    var plr = t.plr || {};
    o.plr = H === 0 ? 0 : (plr.criterio === 'ANUAL' ? num(plr.valor) / 12 : plr.criterio === 'MENSAL' ? num(plr.valor) : 0); // AU
    o.cesta = (H === 0 || !sim(r.cb)) ? 0 : num(v.cesta);                            // AW
    var temPlano = r.ps && r.ps !== 'N/A' && ctx.plano[r.ps];
    o.planoDep = temPlano ? 2 : 0;                                                   // AY
    o.plano = H === 0 ? 0 : (1 + o.planoDep) * num((ctx.plano[r.ps] || {}).v);       // AZ
    o.custoEmpresa = o.comRescisao + o.ajuda + o.transp + o.odonto + o.alim + o.plr + o.cesta + o.plano; // BA
    o.viagIda = (num(r.vm) > 0 && num(r.vr) > 0) ? num(ctx.viagem[r.vmeio]) / 2 : 0; // BE
    o.viagVolta = o.viagIda;                                                         // BF
    var gv = ctx.gheValor[r.ghe] || { adm: 0, dem: 0, per: 0 }, tem = num(r.exm) !== 0;
    o.exPer = tem ? gv.per : 0; o.exAdm = tem ? gv.adm : 0; o.exDem = tem ? gv.dem : 0; // BI BJ BK
    o.epiGrupo = (ctx.gheGrupo[r.ghe] || {}).epi || '-';                             // BM
    var ev = num(ctx.epiGrupoValor[o.epiGrupo]);
    o.epiPer = num(r.epm) === 0 ? 0 : ev;                                            // BN
    o.epiAdm = ev;                                                                   // BO
    return o;
  };

  /* ---------- veículos / máquinas ---------- */
  E.vemCalc = function (r, ctx) {
    var o = { r: r }, crit = (ctx.t.combCriterio || ['L / HORA'])[0];
    /* consumo pelo método DNIT/SICRO: potência (kW) × coeficiente de combustível (L/kWh) */
    var aq = r.au === crit && num(r.kw) > 0 && num(r.kc) > 0 ? num(r.kw) * num(r.kc) : num(r.aq);
    o.aqEf = aq;
    o.autMedia = num(r.tq) * aq;                                                     // G
    o.preco = num((ctx.combustivel[r.cb] || {}).v);                                  // I
    o.kmMes = num(r.km) * 30;                                                        // K
    o.hMes = num(r.hd) * 30;                                                         // M
    var lh = r.au === crit ? aq : (num(r.km) / aq) / num(r.hd);
    o.lHora = isFinite(lh) ? lh : 0;                                                 // N
    o.lDia = o.lHora * num(r.hd);                                                    // O
    o.lMes = 30 * o.lDia;                                                            // P
    o.comb = o.lMes * o.preco;                                                       // Q
    var op = (r.ci === 'SIM' ? 0 : o.comb) + num(r.lav) + num(r.ofi) + num(r.ped) + num(r.seg) + num(r.ras);
    o.totalProprio = op + num(r.dep);                                                // Y
    o.totalTerceiro = op - num(r.seg) + num(r.loc) + num(r.dep);                     // Z
    o.mob = num(r.ckm) * num(r.dist) / 2;                                            // AC
    o.desmob = o.mob;                                                                // AD
    return o;
  };

  /* ---------- calendário do projeto ---------- */
  E.calendar = function (project, ctx) {
    var fer = Object.create(null);
    ((ctx.t.feriados) || []).concat(project.feriadosMun || []).forEach(function (f) { var d = E.day(f.dt); if (d != null) fer[d] = 1; });
    (project.paralisacoes || []).forEach(function (p) {
      var a = E.day(p.i), b = E.day(p.t), d;
      if (a == null || b == null) return;
      for (d = a; d <= b && d - a < 400; d++) fer[d] = 1;
    });
    var j = null;
    (ctx.t.jornadas || []).forEach(function (x) { if (x.cod === project.jornada) j = x; });
    j = j || { f1: 1, f2: 0 };
    /* condições climáticas: N dias improdutivos no mês (categoria do mês), distribuídos por igual entre os dias úteis */
    var base = function (d) { var w = E.weekday(d); return (fer[d] || w === j.f1 || w === j.f2) ? 0 : 1; };
    var clima = project.clima && project.clima.some(function (x) { return +x > 0; }) ? project.clima : null, chv = Object.create(null);
    var chuvaMes = function (mi) {
      var m = chv[mi]; if (m) return m; m = chv[mi] = { d: Object.create(null), n: 0, w: 0 };
      var N = clima ? +clima[mi % 12] || 0 : 0, us = [], d; for (d = E.som(mi); d <= E.eom(mi); d++) if (base(d)) us.push(d);
      m.w = us.length; N = Math.min(N, us.length); m.n = N;
      for (var i = 0; i < N; i++) m.d[us[Math.floor((i + 0.5) * us.length / N)]] = 1;
      return m;
    };
    var miD = function (d) { var y = E.ymd(d); return y[0] * 12 + y[1]; };
    var cal = {
      utilBase: base, chuvaMes: chuvaMes, chuva: function (d) { return clima && base(d) ? (chuvaMes(miD(d)).d[d] ? 1 : 0) : 0; },
      util: function (d) { var b = base(d); if (!b || !clima) return b; return chuvaMes(miD(d)).d[d] ? 0 : 1; },
      uteis: function (a, b) { var n = 0, d; if (a == null || b == null) return 0; for (d = a; d <= b; d++) n += cal.util(d); return n; }
    };
    return cal;
  };

  function reajusteDe(lista, somDia) {
    // LOOKUP: último índice com data <= mês; acumulado = soma dos percentuais até ali
    var ac = 0, ok = false, i, d;
    lista = lista || [];
    for (i = 0; i < lista.length; i++) { d = E.day(lista[i].dt); if (d != null && d <= somDia) { ac += num(lista[i].p); ok = true; } }
    return ok ? ac : 0;
  }
  E.reajuste = function (project, k, mi) {
    var tb = { MAO: 'MAO', VEM: 'VEM', MAT: 'MAT', AQU: 'MAT', IND: 'IND', SER: 'SER' }[k];
    return 1 + reajusteDe(((project.reajuste || {})[tb]), E.som(mi));
  };

  /* ---------- numeração e estrutura ---------- */
  E.estrutura = function (project, ctx) {
    var grupos = (project.grupos && project.grupos.length ? project.grupos : ctx.t.atividades || []).map(function (nome, i) { return { i: i + 1, nome: nome, ativs: [] }; });
    (project.atividades || []).slice().sort(function (a, b) { return (a.grupo - b.grupo) || (num(a.ordem) - num(b.ordem)); }).forEach(function (a) {
      var g = grupos[a.grupo - 1]; if (!g) return;
      g.ativs.push({ item: g.i + '.' + (g.ativs.length + 1), a: a });
    });
    return grupos;
  };

  /* ---------- validação (lista de erros da planilha) ---------- */
  E.validar = function (project, ctx) {
    var erros = [], t = ctx.t, rel = t.relacao || {}, st = t.status || {};
    var bancos = { 1: ctx.mao, 2: ctx.vem, 3: ctx.mat, 4: ctx.mat, 5: ctx.ind, 6: ctx.ser };
    var nomes = { 1: 'MAO DE OBRA', 2: 'VEICULOS / MAQUINAS', 3: 'MATERIAIS / FERRAMENTAS', 4: 'AQUISICAO / COMPRAS', 5: 'INDIRETOS / INSUMOS', 6: 'SERVICOS TERCEIRIZADOS' };
    var relK = { 1: 'MAO', 2: 'VEM', 3: 'MAT', 5: 'IND' };
    E.estrutura(project, ctx).forEach(function (g) {
      g.ativs.forEach(function (x) {
        var a = x.a, linhas = a.linhas || [];
        linhas.forEach(function (l) {
          var e = function (cod, campo, msg, sol) { erros.push({ cod: cod, campo: campo, msg: msg, sol: sol, ativ: a.id, linha: l.id, item: x.item, nome: a.nome, d: l.d || '(sem descrição)', c: l.c }); };
          var vazia = !l.d && !l.q && !l.ini && !l.fim;
          if (vazia) return;
          var ini = E.day(l.ini), fim = E.day(l.c === 4 ? l.ini : l.fim);
          if (l.d && !bancos[l.c][l.d]) return e(l.c, 'd', 'Descrição inválida ou inexistente no banco de ' + nomes[l.c] + '.', 'Selecione um item da lista.');
          if (!l.d) return e(l.c, 'd', 'Linha sem descrição.', 'Selecione um item da lista ou exclua a linha.');
          if (!(typeof l.q === 'number') || l.q === 0) return e(7, 'q', 'Quantidade inválida ou vazia.', 'Digite um valor numérico (exemplo: 10).');
          if (ini == null) return e(8, 'ini', 'Data de início inválida ou vazia.', 'Informe a data de início.');
          if (fim == null) return e(9, 'fim', 'Data de término inválida ou vazia.', 'Informe a data de término.');
          if (fim < ini) return e(10, 'fim', 'Data de término é menor que a data de início.', 'Altere o término para depois do início.');
          if (relK[l.c] && (rel[relK[l.c]] || []).indexOf(l.rel) < 0) return e(10 + l.c, 'rel', 'Tipo / relação não selecionado ou inválido.', 'Selecione um item da lista de tipo / relação.');
          if (l.c === 4) {
            var nec = 0, tem = false;
            linhas.forEach(function (m) { if (m.c === 3 && m.d === l.d) { tem = true; nec += num(m.q); } });
            if (!tem) return e(18, 'd', 'Aquisição / compra de material não relacionado.', 'Adicione o item em Materiais / Ferramentas desta atividade.');
            if (l.q > nec) return e(17, 'q', 'Quantidade superior ao necessário (' + nec + ').', 'Digite um valor menor ou igual à quantidade necessária.');
          }
          var sk = { 1: 'MAO', 2: 'VEM', 3: 'MAT' }[l.c];
          if (sk && l.status && (st[sk] || []).indexOf(l.status) < 0) return e(18 + l.c, 'status', 'Status inválido.', 'Selecione um status válido.');
        });
      });
    });
    return erros;
  };

  /* ---------- CALCULO: uma linha por recurso x mês ---------- */
  E.calc = function (project, ctx) {
    var out = [], cal = E.calendar(project, ctx), v = ctx.v;
    var erros = E.validar(project, ctx), ruins = Object.create(null);
    erros.forEach(function (e) { ruins[e.linha] = 1; });
    var subs = Object.create(null);
    (project.subestacoes || []).forEach(function (s) { subs[s.s] = 1; });

    E.estrutura(project, ctx).forEach(function (g) {
      g.ativs.forEach(function (x) {
        var a = x.a, equipes = Math.max(0, Math.trunc(num(a.equipes)));
        (a.linhas || []).forEach(function (l) {
          if (ruins[l.id] || !l.d) return;
          var C = E.CONCEITOS[l.c - 1], ini = E.day(l.ini), fim = E.day(l.c === 4 ? l.ini : l.fim);
          if (!C || ini == null || fim == null || fim < ini) return;
          var relacao = l.c === 4 ? E.REL_AQUISICAO : l.c === 6 ? 'TERCEIRIZADO' : l.rel;
          var mob = E.mi(ini), des = E.mi(fim), meses = des - mob + 1, q = num(l.q);
          var M = l.c === 1 ? ctx.mao[l.d] : null, V = l.c === 2 ? ctx.vem[l.d] : null;
          var R = l.c === 3 || l.c === 4 ? ctx.mat[l.d] : l.c === 5 ? ctx.ind[l.d] : l.c === 6 ? ctx.ser[l.d] : null;
          var unidade = (l.c === 1 || l.c === 2) ? 'UN' : (R && R.u) || '-';
          var grupoDb = (M && M.r.g) || (V && V.r.g) || (R && R.g) || '';
          var horasDia = M ? num(M.r.hd) : V ? num(V.r.hd) : 0;
          var domIni = E.dom(ini), domFim = E.dom(fim), fimEhEom = E.eom(des) === fim;
          var periodico = function (P, mi) { // mês coincide com mob + k*P (k = 1..meses)
            P = Math.trunc(num(P));
            if (P === 0) return mi === mob;
            var d = mi - mob; return d > 0 && d % P === 0 && d / P <= meses;
          };
          for (var s = 0; s < meses; s++) {
            var mi = mob + s, eMob = mi === mob, eDes = mi === des, meio = mi > mob && mi < des;
            var somD = E.som(mi), eomD = E.eom(mi);
            // quantidade do mês
            var total;
            if (relacao === E.REL_RATEIO) {
              var den = fim - ini, f;
              if (den === 0) f = q;
              else if (eMob) f = (q / den) * (Math.min(fim, eomD) - ini);
              else if (eDes) f = (q / den) * (fim - somD + 1);
              else f = (q / den) * (eomD - somD + 1);
              total = equipes * f;
            } else total = equipes * Math.ceil(q - 1e-12);
            var reaj = E.reajuste(project, C.k, mi);
            var pro = function (custo) { // pró-rata de dias (mês comercial de 30 dias)
              if (eMob) return (custo / 30) * ((fim < eomD ? domFim : 30) - domIni + 1);
              if (eDes) return (custo / 30) * (fimEhEom ? 30 : fim - somD + 1);
              return meio ? custo : 0;
            };
            var el = {}, put = function (k, val) { val = reaj * val; if (val) el[k] = val; };
            var row = {
              ativ: a.id, linha: l.id, g: g.i, atividade: g.nome, item2: x.item, equipe: a.nome, c: l.c, conceito: C.nome,
              d: l.d, d2: l.c === 4 ? '(*) ' + l.d : l.d, u: unidade, rel: relacao, ini: ini, fim: fim, mi: mi, seq: s, meses: meses, mob: mob, des: des,
              trecho: subs[a.trecho] ? a.trecho : (a.trecho || 'N/A'), cc: a.cc || '', grupoDb: grupoDb, total: total, reaj: reaj, el: el,
              hh: cal.uteis(eMob ? ini : somD, eDes ? fim : eomD) * horasDia, gheTipo: '', gheAdp: '', epiTipo: '', epiAd: ''
            };
            if (M) {
              row.gheTipo = M.r.ghe || '';
              if (row.gheTipo) row.gheAdp = eMob ? 'ADM' : eDes ? 'DEM' : periodico(M.r.exm, mi) ? 'PER' : '';
              row.epiTipo = M.epiGrupo && M.epiGrupo !== '-' ? M.epiGrupo : '';
              if (row.epiTipo) row.epiAd = eMob ? 'ADM' : (mi < des && periodico(M.r.epm, mi)) ? 'PER' : '';
              put('A1', pro(M.sal * total)); put('A2', pro(M.insal * total)); put('A3', pro(M.peric * total));
              put('A4', pro((M.he1 + M.he2) * total)); put('A5', pro(M.adNot * total)); put('A6', pro(M.dsr * total));
              put('A7', pro(M.inssEmp * total)); put('A8', pro(M.fgts * total)); put('A9', pro(M.seguro * total));
              put('A10', pro(M.p13 * total)); put('A11', pro(M.ferias * total)); put('A12', pro(M.multaFgts * total));
              put('A13', pro(M.aviso * total)); put('A14', pro(M.ajuda * total)); put('A15', pro(M.transp * total));
              put('A16', pro(M.odonto * total));
              put('A17', pro((relacao === 'LOCAL' ? ctx.alimLoc : ctx.alimPro) * total));
              put('A18', pro(M.cesta * total)); put('A19', pro(M.plano * total));
              var ida = M.viagIda * total, volta = M.viagVolta * total;
              put('A20', (eMob && eDes) ? ida + volta : eMob ? ida : eDes ? volta : periodico(M.r.vm, mi) ? ida + volta : 0);
              put('A21', (row.gheAdp === 'ADM' ? M.exAdm : row.gheAdp === 'DEM' ? M.exDem : row.gheAdp === 'PER' ? M.exPer : 0) * total);
              put('A22', (row.epiAd === 'ADM' ? M.epiAdm : row.epiAd === 'PER' ? M.epiPer : 0) * total);
              put('A23', pro(M.plr * total));
            } else if (V) {
              var r = V.r, proprio = relacao === 'PROPRIO';
              put('B1', pro((proprio ? num(r.dep) : num(r.loc)) * total));
              put('B2', pro(V.comb * total)); put('B3', pro(num(r.lav) * total)); put('B4', pro(num(r.ofi) * total));
              put('B5', pro(num(r.ped) * total)); put('B6', pro(num(r.ras) * total));
              put('B7', (mi < des && periodico(r.mm, mi)) ? num(r.mv) * total : 0);
              put('B8', (mi < des && periodico(r.lm, mi)) ? num(r.lv) * total : 0);
              put('B9', (eMob ? V.mob : eDes ? V.desmob : 0) * total);
              put('B10', (proprio && mi % 12 === 0) ? num(r.imp) * total : 0);
              put('B11', proprio ? num(r.seg) * total : 0);
            } else if (l.c === 3 && R) {
              put('C1', pro((relacao === 'LOCADO' ? num(R.loc) + num(R.dep) + num(R.out) : num(R.dep) + num(R.out)) * total));
              put('C2', (eMob ? num(R.mob) + num(R.inst) : eDes ? num(R.des) : 0) * total);
              put('C3', (mi < des && periodico(R.mm, mi)) ? num(R.mv) * total : 0);
            } else if (l.c === 4 && R) {
              put('D1', eMob ? num(R.vu) * total : 0);
            } else if (l.c === 5 && R) {
              var ci = num(R.vu) * total;
              put('E1', relacao === E.REL_RATEIO ? ci : pro(ci));
              put('E2', (eMob ? num(R.mob) : eDes ? num(R.des) : 0) * total);
              put('E3', (mi < des && periodico(R.pm, mi)) ? num(ctx.indPerSoma[l.d]) * total : 0);
            } else if (l.c === 6 && R) {
              put('F1', pro(num(R.men) * total));
              put('F2', (eMob ? num(R.mob) : eDes ? num(R.des) : 0) * total);
              put('F3', (mi < des && periodico(R.pm, mi)) ? num(R.pv) * total : 0);
            }
            var geral = 0, k;
            for (k in el) geral += el[k];
            row.geral = geral;
            out.push(row);
          }
        });
      });
    });
    var mis = out.map(function (r) { return r.mi; });
    var db = E.day(project.database), m0 = mis.length ? Math.min.apply(null, mis) : (db != null ? E.mi(db) : E.mi(Math.floor(Date.now() / DAY)));
    var m1 = mis.length ? Math.max.apply(null, mis) : m0 + 11, months = [];
    if (m1 - m0 > 239) m1 = m0 + 239;
    for (var m = m0; m <= m1; m++) months.push(m);
    return { rows: out, erros: erros, months: months, cal: cal };
  };

  /* ---------- agregações ---------- */
  E.sum = function (rows, f) { var s = 0, i; for (i = 0; i < rows.length; i++) s += f ? f(rows[i]) : rows[i].geral; return s; };
  E.porMes = function (rows, months, f) {
    var m0 = months[0], a = months.map(function () { return 0; }), i, r;
    for (i = 0; i < rows.length; i++) { r = rows[i]; if (r.mi - m0 >= 0 && r.mi - m0 < a.length) a[r.mi - m0] += f ? f(r) : r.geral; }
    return a;
  };
  E.grupo = function (rows, keyFn) {
    var m = new Map(), i, k, a;
    for (i = 0; i < rows.length; i++) { k = keyFn(rows[i]); a = m.get(k); if (!a) m.set(k, a = []); a.push(rows[i]); }
    return m;
  };

  function prazoTxt(ini, fim) {
    if (ini == null || fim == null) return '-';
    var a = E.ymd(ini), b = E.ymd(fim), final = E.eom(E.mi(fim)) === fim ? 1 : 0;
    var m = (b[0] - a[0]) * 12 + (b[1] - a[1]) - (b[2] < a[2] ? 1 : 0);
    var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
    return p2(m + final) + ' M' + (final ? '' : ' / ' + p2(b[2]) + ' D');
  }
  E.prazoTxt = prazoTxt;

  function resumo(rows, months, cal, extra, ehTotal) {
    var o = extra || {}, i, r, ini = null, fim = null, pc = [0, 0, 0, 0, 0, 0], hh = 0, hm = 0;
    for (i = 0; i < rows.length; i++) {
      r = rows[i];
      if (r.rel !== E.REL_AQUISICAO) { if (ini == null || r.ini < ini) ini = r.ini; }
      if (!ehTotal || r.rel !== E.REL_AQUISICAO) { if (fim == null || r.fim > fim) fim = r.fim; }
      pc[r.c - 1] += r.geral;
      if (r.c === 1) hh += r.hh; else if (r.c === 2) hm += r.hh;
    }
    o.ini = ini; o.fim = fim; o.prazo = prazoTxt(ini, fim);
    o.dias = ini != null && fim != null && fim >= ini ? fim - ini + 1 : 0;
    o.uteis = o.dias ? cal.uteis(ini, fim) : 0;
    o.pc = pc; o.total = pc.reduce(function (a, b) { return a + b; }, 0);
    o.mes = E.porMes(rows, months);
    var set = Object.create(null), n = 0;
    for (i = 0; i < rows.length; i++) if (!set[rows[i].mi]) { set[rows[i].mi] = 1; n++; }
    o.mensal = n ? o.total / n : 0;
    o.diario = ehTotal ? (o.uteis ? o.total / o.uteis : 0) : (o.dias ? o.total / o.dias : 0);
    o.hh = hh; o.hm = hm;
    return o;
  }

  /* cronograma financeiro (FIN) */
  E.fin = function (project, ctx, res) {
    var porG = E.grupo(res.rows, function (r) { return r.g; }), porA = E.grupo(res.rows, function (r) { return r.ativ; });
    var total = resumo(res.rows, res.months, res.cal, {}, true), linhas = [];
    E.estrutura(project, ctx).forEach(function (g) {
      var G = resumo(porG.get(g.i) || [], res.months, res.cal, { tipo: 'g', item: String(g.i), nome: g.nome, g: g.i });
      G.pct = total.total ? G.total / total.total : 0;
      linhas.push(G);
      g.ativs.forEach(function (x) {
        var a = x.a, A = resumo(porA.get(a.id) || [], res.months, res.cal, { tipo: 'a', item: x.item, nome: a.nome, id: a.id, g: g.i, uni: a.uni, qtd: num(a.qtd), equipes: num(a.equipes), trecho: a.trecho, cc: a.cc });
        A.pct = total.total ? A.total / total.total : 0;
        A.porEquipe = A.equipes ? A.mensal / A.equipes : 0;
        A.porUnidade = A.qtd ? A.total / A.qtd : 0;
        // rendimentos de produtividade
        var taxa = (A.qtd && A.uteis && A.equipes) ? (A.qtd / A.uteis) / A.equipes : 0;
        A.rendDia = taxa;
        if (taxa && A.ini != null) {
          var sem = 0, mes = 0, sAc = 0, mAc = 0, ns = 0, nm = 0, d, dm, first = true;
          for (d = A.ini; d <= A.fim; d++) {
            dm = E.dom(d);
            if (!first && (dm === 1 || dm === 8 || dm === 16 || dm === 23)) { sem += sAc; ns++; sAc = 0; }
            if (!first && dm === 1) { mes += mAc; nm++; mAc = 0; }
            first = false;
            var u = res.cal.util(d) * taxa; sAc += u; mAc += u;
          }
          sem += sAc; ns++; mes += mAc; nm++;
          A.rendSem = sem / ns; A.rendMes = mes / nm;
        } else { A.rendSem = 0; A.rendMes = 0; }
        linhas.push(A);
      });
    });
    var ac = 0;
    total.acum = total.mes.map(function (vl) { ac += vl; return total.total ? ac / total.total : 0; });
    return { total: total, linhas: linhas };
  };

  /* filtro usado em histograma e custo detalhado */
  E.filtrar = function (rows, f) {
    if (!f || !f.tipo || f.tipo === 'projeto') return rows;
    var k = { atividade: 'atividade', equipe: 'equipe', trecho: 'trecho', cc: 'cc' }[f.tipo];
    return rows.filter(function (r) { return r[k] === f.valor; });
  };

  /* relatórios de segurança */
  E.epiRel = function (ctx, res) {
    var g = ctx.base.ghe || {}, months = res.months, m0 = months[0];
    var qtdGrupoMes = Object.create(null); // grupo EPI -> [qtd por mês]
    res.rows.forEach(function (r) {
      if (!r.epiTipo || !r.epiAd) return;
      var a = qtdGrupoMes[r.epiTipo] || (qtdGrupoMes[r.epiTipo] = months.map(function () { return 0; }));
      if (r.mi - m0 < a.length) a[r.mi - m0] += r.total;
    });
    var totalMes = E.porMes(res.rows, months, function (r) { return r.el.A22 || 0; });
    var totalVal = totalMes.reduce(function (a, b) { return a + b; }, 0);
    var itens = (g.epi || []).map(function (e) {
      var mes = months.map(function () { return 0; });
      (g.epicomp || []).forEach(function (c) {
        if (c.epi !== e.d) return;
        var a = qtdGrupoMes[c.g]; if (a) a.forEach(function (q, i) { mes[i] += q; });
      });
      return { d: e.d, u: e.u, v: num(e.v), mes: mes, qtd: mes.reduce(function (a, b) { return a + b; }, 0) };
    });
    var base = itens.reduce(function (a, i) { return a + i.v * i.qtd; }, 0);
    itens.forEach(function (i) { i.valor = base ? (i.v * i.qtd / base) * totalVal : 0; });
    return { itens: itens, totalMes: totalMes, total: totalVal };
  };
  E.pcmsoRel = function (project, ctx, res) {
    var g = ctx.base.ghe || {}, months = res.months, m0 = months[0], q = Object.create(null);
    res.rows.forEach(function (r) {
      if (!r.gheTipo || !r.gheAdp) return;
      var k = r.gheTipo + '|' + r.gheAdp, a = q[k] || (q[k] = months.map(function () { return 0; }));
      if (r.mi - m0 < a.length) a[r.mi - m0] += r.total;
    });
    var totalMes = E.porMes(res.rows, months, function (r) { return r.el.A21 || 0; });
    var itens = (g.pcmso || []).map(function (e) {
      var mes = months.map(function () { return 0; });
      (g.comp || []).forEach(function (c) {
        if (c.ex !== e.d) return;
        [['ADM', c.qa], ['DEM', c.qd], ['PER', c.qp]].forEach(function (p) {
          var a = q[c.g + '|' + p[0]]; if (a) a.forEach(function (n, i) { mes[i] += n * num(p[1]) * num(e.v) * E.reajuste(project, 'MAO', months[i]); });
        });
      });
      return { d: e.d, v: num(e.v), mes: mes, valor: mes.reduce(function (a, b) { return a + b; }, 0) };
    });
    return { itens: itens, totalMes: totalMes, total: totalMes.reduce(function (a, b) { return a + b; }, 0) };
  };
  E.sesmtRel = function (project, ctx, res) {
    var s = ctx.t.sesmt || { faixas: [], rows: [] }, months = res.months;
    var efetivo = E.porMes(res.rows.filter(function (r) { return r.c === 1; }), months, function (r) { return r.total; });
    var pico = Math.max.apply(null, efetivo.concat([0]));
    var faixaDe = function (n) { var k = -1; s.faixas.forEach(function (f, i) { if (n >= f) k = i; }); return k; };
    var exig = s.rows.filter(function (r) { return r.gr === (project.grauRisco || 4); }).map(function (r) {
      return { p: r.p, mes: efetivo.map(function (n) { var k = faixaDe(Math.round(n)); return k < 0 ? '' : (r.v[k] || ''); }) };
    });
    var prev = [], porD = E.grupo(res.rows.filter(function (r) { return r.grupoDb === 'SESMT'; }), function (r) { return r.d; });
    Array.from(porD.keys()).sort().forEach(function (d) { prev.push({ d: d, mes: E.porMes(porD.get(d), months, function (r) { return r.total; }) }); });
    return { efetivo: efetivo, pico: pico, exig: exig, prev: prev };
  };

  root.CustoEngine = E;
  if (typeof module !== 'undefined' && module.exports) module.exports = E;
})(typeof window !== 'undefined' ? window : globalThis);
