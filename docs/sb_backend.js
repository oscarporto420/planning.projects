/* Planning Projects — versão independente (Supabase).
   Implementa window.claude.use('db' | 'user' | 'downloads') com a mesma interface do artefato,
   sobre a tabela public.docs (path, col, id, data). Login por e-mail e senha (Supabase Auth). */
(function () {
  var CFG = window.PP_CONFIG || {};
  var sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true } });
  var ADM = (CFG.admins || []).map(function (e) { return String(e).toLowerCase(); });
  var pronto, resolver; pronto = new Promise(function (r) { resolver = r; });
  var sessao = null;

  function partes(path) { var i = path.lastIndexOf('/'); return { col: i < 0 ? '' : path.slice(0, i), id: i < 0 ? path : path.slice(i + 1) }; }
  function snap(row) { return { id: row.id, exists: true, data: function () { return row.data; } }; }
  function erro(e) { var x = new Error((e && e.message) || 'erro no banco'); x.code = (e && e.code) || 'db_error'; return x; }

  var db = {
    collection: function (col) {
      return {
        get: function () {
          var out = [], pg = 25;
          function lote(de) {
            return sb.from('docs').select('id,data').eq('col', col).order('id').range(de, de + pg - 1).then(function (r) {
              if (r.error) throw erro(r.error);
              r.data.forEach(function (x) { out.push(snap(x)); });
              if (r.data.length === pg) return lote(de + pg);
              return { docs: out, size: out.length, empty: !out.length };
            });
          }
          return lote(0);
        },
        doc: function (id) { return db.doc(col + '/' + id); }
      };
    },
    doc: function (path) {
      return {
        get: function () {
          return sb.from('docs').select('id,data').eq('path', path).maybeSingle().then(function (r) { if (r.error) throw erro(r.error); return r.data ? snap(r.data) : null; });
        },
        set: function (data) {
          var p = partes(path);
          return sb.from('docs').upsert({ path: path, col: p.col, id: p.id, data: data }).then(function (r) { if (r.error) throw erro(r.error); });
        },
        update: function (data) {
          return this.get().then(function (s) { return db.doc(path).set(Object.assign({}, s ? s.data() : {}, data)); });
        },
        delete: function () {
          return sb.from('docs').delete().eq('path', path).then(function (r) { if (r.error) throw erro(r.error); });
        }
      };
    }
  };

  function eu() {
    var u = sessao && sessao.user, em = u ? String(u.email || '').toLowerCase() : '';
    var nome = (u && u.user_metadata && (u.user_metadata.nome || u.user_metadata.full_name)) || (em ? em.split('@')[0] : '');
    var dono = ADM.indexOf(em) >= 0;
    return { id: u ? u.id : null, name: nome, email: em || null, avatarUrl: null, isOwner: dono, canEdit: dono, guest: false };
  }
  var user = {
    me: function () { return Promise.resolve(eu()); },
    id: function () { return Promise.resolve(eu().id); },
    name: function () { return Promise.resolve(eu().name); },
    isOwner: function () { return Promise.resolve(eu().isOwner); },
    canEdit: function () { return Promise.resolve(eu().canEdit); },
    can: function () { return Promise.resolve(null); },
    profiles: function (ids) {
      ids = [].concat(ids || []); var out = {}; if (!ids.length) return Promise.resolve(out);
      return sb.rpc('perfis_emails', { ids: ids }).then(function (r) {
        ids.forEach(function (i) { out[i] = { id: i, name: '', email: null, isMe: sessao && sessao.user && sessao.user.id === i }; });
        (r.data || []).forEach(function (x) { out[x.id].email = x.email; out[x.id].name = String(x.email || '').split('@')[0]; });
        return out;
      }, function () { return out; });
    },
    search: function () { return Promise.resolve([]); }
  };
  var downloads = {
    save: function (o) {
      try {
        var d = o.data, b = d instanceof Blob ? d : new Blob([d], { type: o.mimeType || 'application/octet-stream' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = o.filename || 'arquivo';
        document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
        return Promise.resolve({ status: 'saved' });
      } catch (e) { return Promise.reject(erro(e)); }
    }
  };
  window.claude = { use: function (n) { return pronto.then(function () { return n === 'db' ? db : n === 'user' ? user : n === 'downloads' ? downloads : null; }); } };
  window.PP_SB = sb;

  /* ---------- tela de entrada ---------- */
  var css = '#pp-login{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:var(--fundo,#f3f5f9);padding:16px}' +
    '#pp-login form{width:min(380px,100%);background:var(--card,#fff);color:var(--tinta,#1b2333);border-radius:18px;box-shadow:0 10px 40px rgba(0,30,80,.12);padding:28px;display:flex;flex-direction:column;gap:12px;font:500 14px var(--ui,system-ui,sans-serif)}' +
    '#pp-login h1{margin:0;font:700 22px var(--disp,system-ui)}#pp-login p{margin:0;color:var(--cinza,#667)}#pp-login input{padding:10px 12px;border:1px solid var(--borda,#d6dbe5);border-radius:10px;font:inherit;background:var(--card,#fff);color:inherit}' +
    '#pp-login button{padding:11px;border:0;border-radius:10px;background:var(--azul,#1769e8);color:#fff;font:600 14px inherit;cursor:pointer}#pp-login .lk2{background:none;color:var(--azul,#1769e8);padding:2px;font-weight:600}' +
    '#pp-login .msg{min-height:18px;font-size:13px;color:var(--rosa-fg,#c8322b)}#pp-login .msg.ok{color:var(--verde-fg,#1b7f4c)}#pp-login .row{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}' +
    '#pp-bar{position:fixed;right:16px;bottom:16px;z-index:50;display:flex;gap:6px}#pp-bar button,#pp-bar label{padding:5px 10px;border-radius:8px;border:1px solid var(--borda,#d6dbe5);background:var(--card,#fff);color:var(--tinta,#1b2333);font:600 11.5px var(--ui,system-ui);cursor:pointer}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function tela(modo) {
    var el = document.getElementById('pp-login'); if (!el) { el = document.createElement('div'); el.id = 'pp-login'; document.body.appendChild(el); }
    var t = { entrar: ['Entrar', 'Use seu e-mail e senha.'], criar: ['Criar conta', 'Depois de criar, confirme pelo link enviado ao seu e-mail. O administrador libera as seções e os projetos.'], senha: ['Recuperar senha', 'Enviaremos um link para definir uma nova senha.'], nova: ['Nova senha', 'Digite a nova senha.'] }[modo];
    el.innerHTML = '<form novalidate><h1>Planning Projects</h1><p><b>' + t[0] + '</b> · ' + t[1] + '</p>' +
      (modo === 'nova' ? '' : '<input type="email" name="em" placeholder="E-mail" autocomplete="username" required>') +
      (modo === 'senha' ? '' : '<input type="password" name="pw" placeholder="Senha (mínimo 8 caracteres)" autocomplete="' + (modo === 'entrar' ? 'current-password' : 'new-password') + '" required>') +
      '<div class="msg"></div><button type="submit">' + t[0] + '</button>' +
      (modo === 'nova' ? '' : '<div class="row">' + (modo !== 'entrar' ? '<button type="button" class="lk2" data-m="entrar">Já tenho conta</button>' : '<button type="button" class="lk2" data-m="criar">Criar conta</button><button type="button" class="lk2" data-m="senha">Esqueci a senha</button>') + '</div>') + '</form>';
    var f = el.querySelector('form'), msg = el.querySelector('.msg');
    el.querySelectorAll('[data-m]').forEach(function (b) { b.onclick = function () { tela(b.getAttribute('data-m')); }; });
    f.onsubmit = function (e) {
      e.preventDefault(); msg.className = 'msg'; msg.textContent = 'Aguarde…';
      var em = f.em ? f.em.value.trim() : '', pw = f.pw ? f.pw.value : '', red = location.origin + location.pathname, p;
      if (modo === 'entrar') p = sb.auth.signInWithPassword({ email: em, password: pw });
      else if (modo === 'criar') p = pw.length < 8 ? Promise.resolve({ error: { message: 'A senha precisa ter pelo menos 8 caracteres.' } }) : sb.auth.signUp({ email: em, password: pw, options: { emailRedirectTo: red } });
      else if (modo === 'senha') p = sb.auth.resetPasswordForEmail(em, { redirectTo: red });
      else p = sb.auth.updateUser({ password: pw });
      p.then(function (r) {
        if (r.error) { msg.textContent = traduz(r.error.message); return; }
        if (modo === 'criar' && !(r.data && r.data.session)) { msg.className = 'msg ok'; msg.textContent = 'Conta criada. Confirme pelo link enviado ao seu e-mail e depois entre.'; }
        else if (modo === 'senha') { msg.className = 'msg ok'; msg.textContent = 'Se o e-mail estiver cadastrado, o link foi enviado.'; }
        else if (modo === 'nova') { el.remove(); iniciar(); }
      });
    };
  }
  function traduz(m) {
    if (/Invalid login/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/Email not confirmed/i.test(m)) return 'Confirme o e-mail pelo link enviado antes de entrar.';
    if (/already registered/i.test(m)) return 'Este e-mail já tem conta. Use Entrar.';
    if (/rate limit/i.test(m)) return 'Muitas tentativas. Aguarde alguns minutos.';
    return m;
  }
  var iniciado = false;
  function iniciar() {
    if (iniciado) return; iniciado = true;
    var l = document.getElementById('pp-login'); if (l) l.remove();
    var bar = document.createElement('div'); bar.id = 'pp-bar';
    bar.innerHTML = '<button type="button" data-a="sair" title="' + (eu().email || '') + '">Sair</button>' + (eu().isOwner ? '<label title="Carrega o arquivo de dados exportado da página do Claude">Importar dados<input type="file" accept=".json" hidden></label>' : '');
    document.body.appendChild(bar);
    bar.querySelector('[data-a=sair]').onclick = function () { sb.auth.signOut().then(function () { location.reload(); }); };
    var inp = bar.querySelector('input'); if (inp) inp.onchange = function () { importar(inp.files[0]); inp.value = ''; };
    resolver();
  }
  /* importação do arquivo { formato: 'planning-projects/docs', docs: { path: data } } */
  function importar(f) {
    if (!f) return; var rd = new FileReader();
    rd.onload = function () {
      var j; try { j = JSON.parse(rd.result); } catch (e) { return alerta('Arquivo inválido.'); }
      var docs = j && j.docs; if (!docs) return alerta('O arquivo não tem a seção "docs".');
      var ks = Object.keys(docs), i = 0, falhas = 0;
      aviso('Importando ' + ks.length + ' documentos…');
      (function prox() {
        if (i >= ks.length) { aviso(''); alerta('Importação concluída: ' + (ks.length - falhas) + ' documentos' + (falhas ? ', ' + falhas + ' com erro (veja o console)' : '') + '. A página será recarregada.'); setTimeout(function () { location.reload(); }, 2500); return; }
        var lote = [], tam = 0;
        while (i < ks.length && (lote.length === 0 || tam < 1500000) && lote.length < 50) { var k = ks[i++], p = partes(k), s = JSON.stringify(docs[k]).length; lote.push({ path: k, col: p.col, id: p.id, data: docs[k] }); tam += s; }
        aviso('Importando… ' + i + ' de ' + ks.length);
        sb.from('docs').upsert(lote).then(function (r) { if (r.error) { falhas += lote.length; console.error(r.error, lote.map(function (x) { return x.path; })); } prox(); });
      })();
    };
    rd.readAsText(f);
  }
  function aviso(t) { var a = document.getElementById('pp-av'); if (!t) { if (a) a.remove(); return; } if (!a) { a = document.createElement('div'); a.id = 'pp-av'; a.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:9999;padding:10px 14px;border-radius:10px;background:#1769e8;color:#fff;font:600 13px system-ui'; document.body.appendChild(a); } a.textContent = t; }
  function alerta(t) { aviso(''); var a = document.createElement('div'); a.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:9999;max-width:360px;padding:12px 14px;border-radius:10px;background:#1b2333;color:#fff;font:500 13px system-ui'; a.textContent = t; document.body.appendChild(a); setTimeout(function () { a.remove(); }, 8000); }

  sb.auth.onAuthStateChange(function (ev, s) {
    sessao = s;
    if (ev === 'PASSWORD_RECOVERY') return tela('nova');
    if (s && !iniciado && !/type=recovery/.test(location.hash)) iniciar();
  });
  sb.auth.getSession().then(function (r) {
    sessao = r.data && r.data.session;
    if (/type=recovery/.test(location.hash)) return;
    if (sessao) iniciar(); else tela('entrar');
  });
})();
