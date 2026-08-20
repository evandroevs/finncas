/* ══════════════════════════════════════════════════════════════════════
   contas.js — aba "Contas": checklist de contas por mês
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";
  const { $, uid, ler, gravar, toast, CHAVES } = window.App;

  const KEY = CHAVES.contas;
  const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const BRL = new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" });
  const MAX_PARCELAS = 36;

  function chaveMes(d){ return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
  function rotuloMes(k){ const [a, m] = k.split("-"); return MESES[+m - 1] + " " + a; }
  function deslocaMes(k, delta){
    const [a, m] = k.split("-").map(Number);
    return chaveMes(new Date(a, m - 1 + delta, 1));
  }

  // db = { fixas:[{id,nome,desc,valor,dia}], meses:{ "2026-08": {itens:[...]} } }
  // item = { id, nome, desc, valor, dia, pago, fixaId|null, serie:{id,n,total}|null }
  let db = normaliza(ler(KEY, null));
  let mesAtual = chaveMes(new Date());
  let editando = null;

  function normaliza(d){ return { fixas: (d && d.fixas) || [], meses: (d && d.meses) || {} }; }
  function salvar(){ gravar(KEY, db); }

  function mes(k){
    if (!db.meses[k]) {
      db.meses[k] = { itens: db.fixas.map(f => novoItem(f.nome, f.desc, f.valor, f.dia, f.id, null)) };
      salvar();
    }
    return db.meses[k];
  }
  function novoItem(nome, desc, valor, dia, fixaId, serie){
    return { id: uid(), nome, desc: desc || "", valor, dia, pago: false, fixaId: fixaId || null, serie: serie || null };
  }
  function ehFixa(it){ return !!it.fixaId && db.fixas.some(f => f.id === it.fixaId); }
  function mesesFuturos(){ return Object.keys(db.meses).filter(k => k > mesAtual); }

  function parseValor(txt){
    if (typeof txt === "number") return txt;
    let s = String(txt || "").replace(/[^\d,.-]/g, "").trim();
    if (!s) return 0;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");  // "1.234,56" → "1234.56"
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  const fmt = (n) => BRL.format(n || 0);

  const hojeK = chaveMes(new Date());
  const diaHoje = new Date().getDate();
  function estaVencida(item, k){
    if (item.pago) return false;
    if (k < hojeK) return true;
    if (k > hojeK) return false;
    return item.dia ? item.dia < diaHoje : false;
  }

  // ── Seletor de repetição ────────────────────────────────────────────
  const selRep = $("#fRepete");
  (function montaOpcoes(){
    const opts = ['<option value="1">Só este mês</option>', '<option value="fixa">Todo mês (sempre)</option>'];
    for (let n = 2; n <= MAX_PARCELAS; n++) opts.push('<option value="' + n + '">' + n + " meses (" + n + "x)</option>");
    selRep.innerHTML = opts.join("");
  })();

  const lista = $("#lista");

  function render(){
    $("#mesLabel").textContent = rotuloMes(mesAtual);
    $("#mesPicker").value = mesAtual;

    const itens = mes(mesAtual).itens.slice().sort((a, b) => (a.dia || 99) - (b.dia || 99));
    const total = itens.reduce((s, i) => s + (i.valor || 0), 0);
    const pago  = itens.filter(i => i.pago).reduce((s, i) => s + (i.valor || 0), 0);
    $("#stTotal").textContent = fmt(total);
    $("#stPago").textContent  = fmt(pago);
    $("#stFalta").textContent = fmt(total - pago);
    const nPagas = itens.filter(i => i.pago).length;
    const pct = itens.length ? Math.round((nPagas / itens.length) * 100) : 0;
    $("#barFill").style.width = pct + "%";
    $("#barTxt").textContent = nPagas + " de " + itens.length + (itens.length === 1 ? " conta paga" : " contas pagas");
    $("#barPct").textContent = pct + "%";

    lista.innerHTML = "";
    if (!itens.length) {
      lista.innerHTML = '<li class="vazio"><b>Nenhuma conta neste mês</b>Adicione acima ou copie as do mês anterior.</li>';
      return;
    }
    for (const it of itens) lista.appendChild(it.id === editando ? linhaEdicao(it) : linha(it));
  }

  function linha(it){
    const li = document.createElement("li");
    li.className = "item" + (it.pago ? " paga" : "") + (estaVencida(it, mesAtual) ? " vencida" : "");
    li.dataset.id = it.id;

    const meta = [];
    if (it.dia) meta.push("<span>vence dia " + it.dia + "</span>");
    if (ehFixa(it)) meta.push('<span class="tag">fixa</span>');
    if (it.serie) meta.push('<span class="tag">' + it.serie.n + "/" + it.serie.total + "</span>");
    if (estaVencida(it, mesAtual)) meta.push('<span class="atrasada">atrasada</span>');

    li.innerHTML =
      '<button class="check" data-act="toggle" aria-label="Marcar como paga" aria-pressed="' + !!it.pago + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' +
      "</button>" +
      '<div class="info"><span class="nome"></span>' + (it.desc ? '<span class="desc"></span>' : "") +
        (meta.length ? '<span class="meta">' + meta.join("") + "</span>" : "") + "</div>" +
      '<span class="valor">' + fmt(it.valor) + "</span>" +
      '<div class="acoes">' +
        '<button class="icon" data-act="editar" title="Editar" aria-label="Editar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg></button>' +
        '<button class="icon del" data-act="excluir" title="Excluir" aria-label="Excluir"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg></button>' +
      "</div>";
    li.querySelector(".nome").textContent = it.nome;
    if (it.desc) { const d = li.querySelector(".desc"); d.textContent = it.desc; d.title = it.desc; }
    return li;
  }

  function linhaEdicao(it){
    const li = document.createElement("li");
    li.className = "item editando";
    li.dataset.id = it.id;
    li.innerHTML =
      '<div class="g-nome"><input type="text" class="e-nome" placeholder="Nome da conta" /></div>' +
      '<div class="g-valor"><input type="text" class="e-valor" inputmode="decimal" placeholder="R$ 0,00" /></div>' +
      '<div class="g-dia"><input type="number" class="e-dia" min="1" max="31" placeholder="Dia" /></div>' +
      '<div class="g-desc"><input type="text" class="e-desc" placeholder="Descrição (opcional)" /></div>' +
      '<div class="g-rep" style="font-size:12px;color:var(--txt-3);align-self:center">' + textoEscopoEdicao(it) + "</div>" +
      '<div class="g-btn" style="gap:6px">' +
        '<button class="btn" data-act="salvar">Salvar</button>' +
        '<button class="btn ghost" data-act="cancelar">Cancelar</button>' +
      "</div>";
    li.querySelector(".e-nome").value  = it.nome;
    li.querySelector(".e-valor").value = it.valor ? it.valor.toFixed(2).replace(".", ",") : "";
    li.querySelector(".e-dia").value   = it.dia || "";
    li.querySelector(".e-desc").value  = it.desc || "";
    setTimeout(() => li.querySelector(".e-nome").focus(), 0);
    return li;
  }
  function textoEscopoEdicao(it){
    if (ehFixa(it)) return "Conta fixa: vale também para os próximos meses.";
    if (it.serie)  return "Parcela " + it.serie.n + "/" + it.serie.total + ": vale também para as parcelas seguintes.";
    return "";
  }

  // ── Ações da lista ──────────────────────────────────────────────────
  lista.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    const li = e.target.closest("li[data-id]");
    if (!btn || !li) return;
    const m = mes(mesAtual);
    const it = m.itens.find(x => x.id === li.dataset.id);
    if (!it) return;

    switch (btn.dataset.act) {
      case "toggle": it.pago = !it.pago; salvar(); render(); break;
      case "editar": editando = it.id; render(); break;
      case "cancelar": editando = null; render(); break;
      case "salvar": {
        const nome = li.querySelector(".e-nome").value.trim();
        if (!nome) { li.querySelector(".e-nome").focus(); return; }
        it.nome  = nome;
        it.desc  = li.querySelector(".e-desc").value.trim();
        it.valor = parseValor(li.querySelector(".e-valor").value);
        it.dia   = parseInt(li.querySelector(".e-dia").value, 10) || null;
        const campos = { nome: it.nome, desc: it.desc, valor: it.valor, dia: it.dia };

        if (ehFixa(it)) {                                  // fixa: modelo + meses futuros
          const f = db.fixas.find(x => x.id === it.fixaId);
          if (f) Object.assign(f, campos);
          for (const k of mesesFuturos())
            for (const outro of db.meses[k].itens)
              if (outro.fixaId === it.fixaId) Object.assign(outro, campos);
        }
        if (it.serie) {                                    // parcela: as seguintes
          for (const k of mesesFuturos())
            for (const outro of db.meses[k].itens)
              if (outro.serie && outro.serie.id === it.serie.id) Object.assign(outro, campos);
        }
        editando = null; salvar(); render(); break;
      }
      case "excluir": {
        if (ehFixa(it)) {
          const tudo = confirm('"' + it.nome + '" é uma conta fixa.\n\nOK = parar de repetir nos próximos meses\nCancelar = remover só deste mês');
          if (tudo) {
            db.fixas = db.fixas.filter(f => f.id !== it.fixaId);
            for (const k of mesesFuturos()) db.meses[k].itens = db.meses[k].itens.filter(o => o.fixaId !== it.fixaId);
          }
        } else if (it.serie) {
          const tudo = confirm('"' + it.nome + '" é a parcela ' + it.serie.n + "/" + it.serie.total + ".\n\nOK = apagar também as parcelas seguintes\nCancelar = apagar só esta parcela");
          if (tudo) for (const k of mesesFuturos())
            db.meses[k].itens = db.meses[k].itens.filter(o => !(o.serie && o.serie.id === it.serie.id));
        }
        m.itens = m.itens.filter(x => x.id !== it.id);
        salvar(); render(); break;
      }
    }
  });

  lista.addEventListener("keydown", (e) => {
    if (!editando) return;
    if (e.key === "Enter") { e.preventDefault(); e.target.closest("li").querySelector('[data-act="salvar"]').click(); }
    if (e.key === "Escape") { editando = null; render(); }
  });

  // ── Adicionar ───────────────────────────────────────────────────────
  $("#formAdd").addEventListener("submit", (e) => {
    e.preventDefault();
    const nome = $("#fNome").value.trim();
    if (!nome) return;
    const desc  = $("#fDesc").value.trim();
    const valor = parseValor($("#fValor").value);
    const dia   = parseInt($("#fDia").value, 10) || null;
    const rep   = selRep.value;

    if (rep === "fixa") {
      const fixaId = uid();
      db.fixas.push({ id: fixaId, nome, desc, valor, dia });
      mes(mesAtual).itens.push(novoItem(nome, desc, valor, dia, fixaId, null));
      for (const k of mesesFuturos()) db.meses[k].itens.push(novoItem(nome, desc, valor, dia, fixaId, null));
      toast("Adicionada em todos os meses.");
    } else {
      const total = Math.max(1, Math.min(MAX_PARCELAS, parseInt(rep, 10) || 1));
      const serieId = total > 1 ? uid() : null;
      for (let i = 0; i < total; i++) {
        const k = deslocaMes(mesAtual, i);
        mes(k).itens.push(novoItem(nome, desc, valor, dia, null, serieId ? { id: serieId, n: i + 1, total } : null));
      }
      if (total > 1) toast("Lançada em " + total + " meses (" + total + "x).");
    }
    salvar();
    $("#fNome").value = ""; $("#fValor").value = ""; $("#fDia").value = ""; $("#fDesc").value = "";
    selRep.value = "1";
    $("#fNome").focus();
    render();
  });

  // ── Navegação de mês ────────────────────────────────────────────────
  function irPara(k){ mesAtual = k; editando = null; render(); }
  $("#prev").addEventListener("click", () => irPara(deslocaMes(mesAtual, -1)));
  $("#next").addEventListener("click", () => irPara(deslocaMes(mesAtual, +1)));
  $("#mesLabel").addEventListener("click", () => {
    const p = $("#mesPicker");
    if (p.showPicker) { try { p.showPicker(); return; } catch {} }
    p.style.pointerEvents = "auto"; p.style.opacity = "0.01"; p.focus(); p.click();
  });
  $("#mesPicker").addEventListener("change", (e) => { if (e.target.value) irPara(e.target.value); });

  // ── Copiar mês anterior ─────────────────────────────────────────────
  $("#btnCopiar").addEventListener("click", () => {
    const ant = db.meses[deslocaMes(mesAtual, -1)];
    if (!ant || !ant.itens.length) { toast("O mês anterior não tem contas."); return; }
    const m = mes(mesAtual);
    const jaTem = new Set(m.itens.map(i => i.nome.toLowerCase()));
    let n = 0;
    for (const it of ant.itens) {
      if (jaTem.has(it.nome.toLowerCase())) continue;
      m.itens.push(novoItem(it.nome, it.desc, it.valor, it.dia, it.fixaId, null));
      n++;
    }
    salvar(); render();
    toast(n ? n + (n === 1 ? " conta copiada" : " contas copiadas") : "Nada novo para copiar.");
  });

  document.addEventListener("dados:importados", () => { db = normaliza(ler(KEY, null)); editando = null; render(); });

  render();
})();
