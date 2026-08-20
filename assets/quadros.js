/* ══════════════════════════════════════════════════════════════════════
   quadros.js — aba "Atividades": quadros estilo Trello
   Um quadro por empresa · colunas · cards com descrição, prazo e checklist.
   Arrastar funciona com mouse (arrastar direto) e no toque (segurar e arrastar).
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";
  const { $, $$, uid, ler, gravar, toast, el, svg, arrastavel, CHAVES } = window.App;

  const KEY = CHAVES.quadros;

  // Fuso do próprio aparelho — vai junto no evento do Google Agenda.
  const FUSO = (Intl.DateTimeFormat().resolvedOptions().timeZone) || "America/Sao_Paulo";
  const DURACOES = [[15,"15 min"],[30,"30 min"],[45,"45 min"],[60,"1 h"],[90,"1h30"],[120,"2 h"],[180,"3 h"],[240,"4 h"],[480,"8 h"]];
  const LEMBRETES = [["","Sem lembrete"],[10,"10 min antes"],[30,"30 min antes"],[60,"1 h antes"],[120,"2 h antes"],[1440,"1 dia antes"]];

  // db   = { quadros:[{id,nome,colunas:[{id,nome,cards:[card]}]}], atual:id }
  // card = { id, titulo, desc, feito, checklist:[{id,txt,ok}], agenda, google }
  // agenda = { data:"YYYY-MM-DD"|null, hora:"HH:MM"|null, duracaoMin, fuso, lembreteMin:null|min }
  //   → hora vazia significa "dia inteiro" (no Google, evento de dia inteiro)
  // google = { eventId, calendarId, sincronizadoEm, hash }
  //   → reservado para a sincronização com o Google Agenda; `hash` é a assinatura
  //     dos campos que viram evento, para saber se o evento ficou desatualizado.
  let db = normaliza(ler(KEY, null));
  let composer = null;        // {tipo:"card", colId} | {tipo:"coluna"} | null
  let busca = "";
  let ultimoArrasto = 0;      // evita abrir o card no clique que fecha um arrasto

  function normaliza(d){
    if (!d || !Array.isArray(d.quadros) || !d.quadros.length) {
      const q = quadroPadrao("Minha empresa");
      return { quadros: [q], atual: q.id };
    }
    if (!d.quadros.some(q => q.id === d.atual)) d.atual = d.quadros[0].id;
    for (const q of d.quadros) for (const c of q.colunas || []) c.cards = (c.cards || []).map(migraCard);
    return d;
  }

  function agendaPadrao(){ return { data: null, hora: null, duracaoMin: 60, fuso: FUSO, lembreteMin: null }; }
  function googlePadrao(){ return { eventId: null, calendarId: null, sincronizadoEm: null, hash: null }; }

  // Cards antigos tinham só `prazo` (uma data). Vira agenda.data.
  function migraCard(k){
    if (!k.agenda) { k.agenda = agendaPadrao(); k.agenda.data = k.prazo || null; }
    if (!k.agenda.fuso) k.agenda.fuso = FUSO;
    if (k.agenda.duracaoMin == null) k.agenda.duracaoMin = 60;
    delete k.prazo;
    if (!k.google) k.google = googlePadrao();
    if (!Array.isArray(k.checklist)) k.checklist = [];
    return k;
  }
  function quadroPadrao(nome){
    return {
      id: uid(), nome,
      colunas: ["A fazer", "Fazendo", "Feito"].map(n => ({ id: uid(), nome: n, cards: [] }))
    };
  }
  function salvar(){ gravar(KEY, db); }
  const quadro = () => db.quadros.find(q => q.id === db.atual) || db.quadros[0];
  const coluna = (id) => quadro().colunas.find(c => c.id === id);
  function acharCard(id){
    for (const c of quadro().colunas) { const k = c.cards.find(x => x.id === id); if (k) return { card: k, col: c }; }
    return null;
  }

  // ── Datas ───────────────────────────────────────────────────────────
  const MES_CURTO = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  function hojeISO(){
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function agoraHM(){
    const d = new Date();
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  function rotuloPrazo(iso){
    const [, m, dia] = iso.split("-");
    return dia.replace(/^0/, "") + " " + MES_CURTO[+m - 1];
  }
  // "" · " prazo-hoje" · " prazo-tarde"
  function situacaoPrazo(card){
    const a = card.agenda;
    if (!a || !a.data || card.feito) return "";
    const hoje = hojeISO();
    if (a.data < hoje) return " prazo-tarde";
    if (a.data > hoje) return "";
    if (a.hora && a.hora < agoraHM()) return " prazo-tarde";
    return " prazo-hoje";
  }
  function proximoDia(data){
    const [a, m, d] = data.split("-").map(Number);
    const dt = new Date(a, m - 1, d + 1);
    const p = (n) => String(n).padStart(2, "0");
    return dt.getFullYear() + "-" + p(dt.getMonth() + 1) + "-" + p(dt.getDate());
  }
  function somaMinutos(data, hora, min){
    const [a, m, d] = data.split("-").map(Number);
    const [h, mi] = hora.split(":").map(Number);
    const dt = new Date(a, m - 1, d, h, mi + (min || 60));
    const p = (n) => String(n).padStart(2, "0");
    return dt.getFullYear() + "-" + p(dt.getMonth() + 1) + "-" + p(dt.getDate()) +
           "T" + p(dt.getHours()) + ":" + p(dt.getMinutes()) + ":00";
  }

  // ── Render ──────────────────────────────────────────────────────────
  const board = $("#board");

  function render(){
    const q = quadro();

    // seletor de quadros
    const sel = $("#selQuadro");
    sel.innerHTML = "";
    for (const item of db.quadros) sel.appendChild(el("option", { value: item.id, texto: item.nome }));
    sel.value = q.id;

    // progresso do quadro
    const todos = q.colunas.flatMap(c => c.cards);
    const feitos = todos.filter(c => c.feito).length;
    $("#quadroProg").textContent = todos.length ? feitos + " de " + todos.length + " concluídas" : "";

    board.innerHTML = "";
    for (const col of q.colunas) board.appendChild(colunaEl(col));

    // botão / composer de nova coluna
    const wrap = el("div", { class: "add-col", id: "addColWrap" });
    if (composer && composer.tipo === "coluna") {
      const inp = el("input", { type: "text", placeholder: "Nome da coluna" });
      const ok = el("button", { class: "btn sm", texto: "Adicionar", onclick: () => criarColuna(inp.value) });
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); criarColuna(inp.value); }
        if (e.key === "Escape") { composer = null; render(); }
      });
      wrap.appendChild(el("div", { class: "composer", style: "background:var(--card);border:1px solid var(--border);border-radius:14px" }, [
        inp,
        el("div", { class: "linha" }, [ok, el("button", { class: "btn ghost sm", texto: "Cancelar", onclick: () => { composer = null; render(); } })])
      ]));
      setTimeout(() => inp.focus(), 0);
    } else {
      wrap.appendChild(el("button", { texto: "+ Adicionar coluna", onclick: () => { composer = { tipo: "coluna" }; render(); } }));
    }
    board.appendChild(wrap);
  }

  function colunaEl(col){
    const visiveis = col.cards.filter(bate);
    const nome = el("input", { class: "col-nome", type: "text", value: col.nome, "aria-label": "Nome da coluna" });
    nome.addEventListener("change", () => {
      const v = nome.value.trim();
      if (v) { col.nome = v; salvar(); } else nome.value = col.nome;
    });
    nome.addEventListener("keydown", (e) => { if (e.key === "Enter") nome.blur(); });

    const menu = el("button", {
      class: "icon", title: "Excluir coluna", "aria-label": "Excluir coluna",
      html: svg('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>', 16),
      onclick: () => excluirColuna(col)
    });

    const alca = el("span", {
      class: "col-alca", title: "Arrastar coluna",
      html: svg('<circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/>', 14)
    });
    const cabeca = el("div", { class: "col-head" }, [
      alca,
      nome,
      el("span", { class: "col-count", texto: String(col.cards.length) }),
      menu
    ]);

    const cont = el("div", { class: "col-cards" });
    for (const card of visiveis) cont.appendChild(cardEl(card));

    const rodape = el("div", { class: "col-add" });
    if (composer && composer.tipo === "card" && composer.colId === col.id) {
      const ta = el("textarea", { placeholder: "Título da atividade…" });
      const add = () => criarCard(col, ta.value, ta);
      ta.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); add(); }
        if (e.key === "Escape") { composer = null; render(); }
      });
      rodape.appendChild(el("div", { class: "composer", style: "padding:0" }, [
        ta,
        el("div", { class: "linha" }, [
          el("button", { class: "btn sm", texto: "Adicionar", onclick: add }),
          el("button", { class: "btn ghost sm", texto: "Cancelar", onclick: () => { composer = null; render(); } })
        ])
      ]));
      setTimeout(() => ta.focus(), 0);
    } else {
      rodape.appendChild(el("button", {
        texto: "+ Adicionar card",
        onclick: () => { composer = { tipo: "card", colId: col.id }; render(); }
      }));
    }

    const colEl = el("div", { class: "col" }, [cabeca, cont, rodape]);
    colEl.dataset.id = col.id;
    cabeca.addEventListener("pointerdown", (e) => {
      // a alça sempre arrasta; o resto do cabeçalho também, menos os controles
      if (!e.target.closest(".col-alca") && e.target.closest("button, input")) return;
      arrastaColuna(e, colEl);
    });
    return colEl;
  }

  function cardEl(card){
    const check = el("button", {
      class: "kcheck", title: "Concluída", "aria-label": "Marcar como concluída",
      html: '<svg viewBox="0 0 24 24" fill="none" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
      onclick: (e) => { e.stopPropagation(); card.feito = !card.feito; salvar(); render(); }
    });
    const topo = el("div", { class: "kcard-topo" }, [check, el("div", { class: "ktitulo", texto: card.titulo })]);

    const badges = [];
    const ag = card.agenda || {};
    if (ag.data) {
      const rot = rotuloPrazo(ag.data) + (ag.hora ? " · " + ag.hora : "");
      badges.push(el("span", {
        class: "kbadge" + situacaoPrazo(card),
        html: svg('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>', 11) + "<span>" + rot + "</span>"
      }));
    }
    const chk = card.checklist || [];
    if (chk.length) {
      const ok = chk.filter(i => i.ok).length;
      badges.push(el("span", {
        class: "kbadge" + (ok === chk.length ? " chk-ok" : ""),
        html: svg('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>', 11) + "<span>" + ok + "/" + chk.length + "</span>"
      }));
    }
    if (card.desc) badges.push(el("span", { class: "kbadge", html: svg('<path d="M4 6h16M4 12h16M4 18h10"/>', 11) }));

    const filhos = [topo];
    if (badges.length) filhos.push(el("div", { class: "kbadges" }, badges));

    const node = el("div", { class: "kcard" + (card.feito ? " feito" : "") }, filhos);
    node.dataset.id = card.id;
    node.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      arrastaCard(e, node);
    });
    node.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      if (Date.now() - ultimoArrasto < 250) return;   // acabou de arrastar
      abrirModal(card.id);
    });
    return node;
  }

  // ── Busca ───────────────────────────────────────────────────────────
  function bate(card){
    if (!busca) return true;
    const t = busca.toLowerCase();
    return (card.titulo || "").toLowerCase().includes(t)
        || (card.desc || "").toLowerCase().includes(t)
        || (card.checklist || []).some(i => i.txt.toLowerCase().includes(t));
  }

  // ── CRUD ────────────────────────────────────────────────────────────
  function criarColuna(nome){
    const v = (nome || "").trim();
    if (!v) return;
    quadro().colunas.push({ id: uid(), nome: v, cards: [] });
    composer = { tipo: "coluna" };   // segue aberto para criar a próxima
    salvar(); render();
  }
  function excluirColuna(col){
    const n = col.cards.length;
    if (n && !confirm('Excluir a coluna "' + col.nome + '" e os ' + n + (n === 1 ? " card dela?" : " cards dela?"))) return;
    const q = quadro();
    q.colunas = q.colunas.filter(c => c.id !== col.id);
    salvar(); render();
  }
  function criarCard(col, titulo, campo){
    const v = (titulo || "").trim();
    if (!v) return;
    col.cards.push({ id: uid(), titulo: v, desc: "", feito: false, checklist: [], agenda: agendaPadrao(), google: googlePadrao() });
    salvar();
    if (campo) campo.value = "";
    render();                        // composer segue aberto na mesma coluna
  }

  // ── Arrastar ────────────────────────────────────────────────────────
  function colunaEm(x){
    const cols = $$("#board .col");
    let melhor = null, dist = Infinity;
    for (const c of cols) {
      const r = c.getBoundingClientRect();
      if (x >= r.left && x <= r.right) return c;
      const d = Math.abs((r.left + r.right) / 2 - x);
      if (d < dist) { dist = d; melhor = c; }
    }
    return melhor;
  }

  const arrastaCard = arrastavel({
    container: () => board,
    posicionar: (node, x, y) => {
      const colEl = colunaEm(x);
      if (!colEl) return;
      const cont = colEl.querySelector(".col-cards");
      const irmaos = [...cont.querySelectorAll(".kcard:not(.arrastando)")];
      const ref = irmaos.find(c => { const r = c.getBoundingClientRect(); return y < r.top + r.height / 2; });
      cont.insertBefore(node, ref || null);
    },
    soltou: () => { ultimoArrasto = Date.now(); gravarOrdem(); }
  });

  const arrastaColuna = arrastavel({
    container: () => board,
    posicionar: (node, x) => {
      const irmas = $$("#board .col:not(.arrastando)");
      const ref = irmas.find(c => { const r = c.getBoundingClientRect(); return x < r.left + r.width / 2; });
      board.insertBefore(node, ref || $("#addColWrap"));
    },
    soltou: () => { ultimoArrasto = Date.now(); gravarOrdem(); }
  });

  // Lê a ordem de volta do DOM: sem contas de índice, o que está na tela é a verdade.
  function gravarOrdem(){
    const q = quadro();
    const mapaCards = new Map();
    q.colunas.forEach(c => c.cards.forEach(k => mapaCards.set(k.id, k)));
    const mapaCols = new Map(q.colunas.map(c => [c.id, c]));

    const novas = [];
    for (const colEl of $$("#board .col")) {
      const col = mapaCols.get(colEl.dataset.id);
      if (!col) continue;
      const ids = [...colEl.querySelectorAll(".kcard")].map(e => e.dataset.id);
      // cards escondidos pela busca não aparecem no DOM: preserva os que sobraram
      const visiveisNoDom = new Set(ids);
      const escondidos = col.cards.filter(k => !visiveisNoDom.has(k.id) && !bate(k));
      col.cards = ids.map(id => mapaCards.get(id)).filter(Boolean).concat(escondidos);
      novas.push(col);
    }
    q.colunas = novas;
    salvar(); render();
  }

  // ── Modal do card ───────────────────────────────────────────────────
  const modal = $("#modalCard");
  let rascunho = null, cardIdAberto = null;

  function abrirModal(id){
    const achado = acharCard(id);
    if (!achado) return;
    cardIdAberto = id;
    rascunho = JSON.parse(JSON.stringify(achado.card));
    rascunho.checklist = rascunho.checklist || [];

    $("#mTitulo").value = rascunho.titulo;
    $("#mDesc").value = rascunho.desc || "";

    const ag = rascunho.agenda;
    $("#mData").value = ag.data || "";
    $("#mHora").value = ag.hora || "";
    opcoes($("#mDuracao"), DURACOES, ag.duracaoMin);
    opcoes($("#mLembrete"), LEMBRETES, ag.lembreteMin == null ? "" : ag.lembreteMin);
    ajustaCamposHora();

    const selCol = $("#mColuna");
    selCol.innerHTML = "";
    for (const c of quadro().colunas) selCol.appendChild(el("option", { value: c.id, texto: c.nome }));
    selCol.value = achado.col.id;
    pintaFeito();
    renderChecklist();
    modal.showModal();
    setTimeout(() => $("#mTitulo").focus(), 0);
  }

  function pintaFeito(){ $("#mFeito").classList.toggle("marcado", !!rascunho.feito); }

  function renderChecklist(){
    const ul = $("#mChkLista");
    ul.innerHTML = "";
    const itens = rascunho.checklist;
    const ok = itens.filter(i => i.ok).length;
    $("#mChkResumo").textContent = itens.length ? "— " + ok + "/" + itens.length : "";
    $("#mChkBarra").firstElementChild.style.width = (itens.length ? Math.round(ok / itens.length * 100) : 0) + "%";

    for (const item of itens) {
      const box = el("button", {
        type: "button", class: "kcheck", "aria-label": "Concluir item",
        html: '<svg viewBox="0 0 24 24" fill="none" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
        onclick: () => { item.ok = !item.ok; renderChecklist(); }
      });
      const txt = el("span", { texto: item.txt });
      const del = el("button", {
        type: "button", class: "icon del", "aria-label": "Remover item",
        html: svg('<path d="M18 6L6 18M6 6l12 12"/>', 14),
        onclick: () => { rascunho.checklist = rascunho.checklist.filter(i => i.id !== item.id); renderChecklist(); }
      });
      if (item.ok) box.classList.add("marcado");
      ul.appendChild(el("li", { class: "chk-item" + (item.ok ? " ok" : "") }, [box, txt, del]));
    }
  }

  function addItemChecklist(){
    const inp = $("#mChkNovo");
    const v = inp.value.trim();
    if (!v) return;
    rascunho.checklist.push({ id: uid(), txt: v, ok: false });
    inp.value = "";
    renderChecklist();
    inp.focus();
  }

  $("#mChkAdd").addEventListener("click", addItemChecklist);
  $("#mChkNovo").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addItemChecklist(); } });
  $("#mFeito").addEventListener("click", () => { rascunho.feito = !rascunho.feito; pintaFeito(); });
  $("#mFechar").addEventListener("click", () => modal.close());
  $("#mCancelar").addEventListener("click", () => modal.close());
  $("#mSalvar").addEventListener("click", salvarModal);
  $("#mExcluir").addEventListener("click", () => {
    const achado = acharCard(cardIdAberto);
    if (!achado) return modal.close();
    if (!confirm('Excluir o card "' + achado.card.titulo + '"?')) return;
    achado.col.cards = achado.col.cards.filter(k => k.id !== cardIdAberto);
    salvar(); modal.close(); render();
  });

  function salvarModal(){
    const achado = acharCard(cardIdAberto);
    if (!achado) return modal.close();
    const titulo = $("#mTitulo").value.trim();
    if (!titulo) { $("#mTitulo").focus(); return; }

    Object.assign(achado.card, {
      titulo,
      desc: $("#mDesc").value.trim(),
      feito: rascunho.feito,
      checklist: rascunho.checklist,
      agenda: leAgenda()
    });
    // guarda a assinatura do que vira evento; a sincronização futura compara com esta
    achado.card.google = achado.card.google || googlePadrao();
    achado.card.google.hash = assinatura(achado.card);

    const destinoId = $("#mColuna").value;
    if (destinoId !== achado.col.id) {
      achado.col.cards = achado.col.cards.filter(k => k.id !== achado.card.id);
      const destino = coluna(destinoId);
      if (destino) destino.cards.push(achado.card);
    }
    salvar(); modal.close(); render();
  }

  // ── Agenda do card ──────────────────────────────────────────────────
  function opcoes(sel, pares, valor){
    sel.innerHTML = "";
    for (const [v, rotulo] of pares) sel.appendChild(el("option", { value: v, texto: rotulo }));
    sel.value = String(valor == null ? "" : valor);
  }
  function leAgenda(){
    const hora = $("#mHora").value || null;
    const lembrete = $("#mLembrete").value;
    return {
      data: $("#mData").value || null,
      hora,
      duracaoMin: parseInt($("#mDuracao").value, 10) || 60,
      fuso: FUSO,
      lembreteMin: lembrete === "" ? null : parseInt(lembrete, 10)
    };
  }
  // Sem hora o compromisso é de dia inteiro: duração não se aplica.
  function ajustaCamposHora(){
    const temHora = !!$("#mHora").value;
    const temData = !!$("#mData").value;
    $("#mDuracao").disabled = !temHora;
    $("#mHora").disabled = !temData;
    $("#mLembrete").disabled = !temData;
    $("#mGoogle").disabled = !temData;
    $("#mGoogle").title = temData ? "Abrir no Google Agenda" : "Defina um dia para agendar";
  }
  $("#mData").addEventListener("change", ajustaCamposHora);
  $("#mHora").addEventListener("change", ajustaCamposHora);

  // Assinatura dos campos que viram evento — se mudar, o evento está velho.
  function assinatura(card){
    const a = card.agenda || {};
    return [card.titulo, card.desc, a.data, a.hora, a.duracaoMin, a.fuso, a.lembreteMin,
            (card.checklist || []).map(i => (i.ok ? "1" : "0") + i.txt).join("|")].join("§");
  }

  // Monta o corpo do evento no formato da API do Google Calendar (events.insert).
  // Hoje só alimenta o link de "adicionar ao Google Agenda"; com OAuth, é o mesmo objeto.
  function eventoGoogle(card){
    const a = card.agenda;
    if (!a || !a.data) return null;
    const linhas = [];
    if (card.desc) linhas.push(card.desc);
    if (card.checklist.length) {
      linhas.push("");
      for (const i of card.checklist) linhas.push((i.ok ? "[x] " : "[ ] ") + i.txt);
    }
    const ev = { summary: card.titulo, description: linhas.join("\n") };
    if (a.hora) {
      ev.start = { dateTime: a.data + "T" + a.hora + ":00", timeZone: a.fuso };
      ev.end   = { dateTime: somaMinutos(a.data, a.hora, a.duracaoMin), timeZone: a.fuso };
    } else {
      ev.start = { date: a.data };
      ev.end   = { date: proximoDia(a.data) };   // no Google, dia inteiro tem fim exclusivo
    }
    if (a.lembreteMin != null) ev.reminders = { useDefault: false, overrides: [{ method: "popup", minutes: a.lembreteMin }] };
    // amarra o evento ao card, para a sincronização futura reencontrar os dois lados
    ev.extendedProperties = { private: { painelCardId: card.id, painelQuadroId: db.atual } };
    return ev;
  }

  // Link que abre o Google Agenda já preenchido — funciona sem API e sem login.
  function linkGoogle(card){
    const ev = eventoGoogle(card);
    if (!ev) return null;
    const limpa = (x) => x.replace(/[-:]/g, "");
    const datas = ev.start.dateTime
      ? limpa(ev.start.dateTime) + "/" + limpa(ev.end.dateTime)
      : limpa(ev.start.date) + "/" + limpa(ev.end.date);
    const p = new URLSearchParams({ action: "TEMPLATE", text: ev.summary, dates: datas, details: ev.description || "" });
    if (ev.start.dateTime) p.set("ctz", card.agenda.fuso);
    return "https://calendar.google.com/calendar/render?" + p.toString();
  }

  $("#mGoogle").addEventListener("click", () => {
    const previa = Object.assign({}, rascunho, {
      titulo: $("#mTitulo").value.trim() || rascunho.titulo,
      desc: $("#mDesc").value.trim(),
      agenda: leAgenda()
    });
    const url = linkGoogle(previa);
    if (!url) { toast("Defina um dia para agendar."); return; }
    window.open(url, "_blank", "noopener");
  });

  window.App.eventoGoogle = eventoGoogle;   // ponto de entrada da sincronização futura

  // ── Barra do quadro ─────────────────────────────────────────────────
  $("#selQuadro").addEventListener("change", (e) => { db.atual = e.target.value; salvar(); busca = ""; $("#buscaCard").value = ""; render(); });
  $("#btnNovoQuadro").addEventListener("click", () => {
    const nome = prompt("Nome do novo quadro (ex: nome da empresa):");
    if (!nome || !nome.trim()) return;
    const q = quadroPadrao(nome.trim());
    db.quadros.push(q); db.atual = q.id;
    salvar(); render();
    toast('Quadro "' + q.nome + '" criado.');
  });
  $("#btnRenomearQuadro").addEventListener("click", () => {
    const q = quadro();
    const nome = prompt("Novo nome do quadro:", q.nome);
    if (!nome || !nome.trim()) return;
    q.nome = nome.trim(); salvar(); render();
  });
  $("#btnExcluirQuadro").addEventListener("click", () => {
    const q = quadro();
    if (db.quadros.length === 1) { toast("É o único quadro — crie outro antes de excluir este."); return; }
    const n = q.colunas.flatMap(c => c.cards).length;
    if (!confirm('Excluir o quadro "' + q.nome + '"' + (n ? " e os " + n + " cards dele?" : "?"))) return;
    db.quadros = db.quadros.filter(x => x.id !== q.id);
    db.atual = db.quadros[0].id;
    salvar(); render();
  });
  $("#buscaCard").addEventListener("input", (e) => { busca = e.target.value.trim(); render(); });

  document.addEventListener("dados:importados", () => { db = normaliza(ler(KEY, null)); salvar(); render(); });

  salvar();   // grava já no formato novo (migra cards antigos de vez)
  render();
})();
