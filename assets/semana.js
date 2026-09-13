/* ══════════════════════════════════════════════════════════════════════
   semana.js — aba "Semana": o calendário hora a hora + o planejador

   O planejador NÃO é um modelo de linguagem: é um algoritmo que roda aqui
   no navegador. Ele lê os cards de todos os quadros (prioridade, duração,
   recorrência, prazo), olha o que já está marcado na semana e encaixa cada
   tarefa no primeiro buraco livre da janela de trabalho — vermelho primeiro,
   depois amarelo, depois verde. É determinístico e explica o que fez: ao
   final mostra o que entrou, onde, e o que não coube.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";
  const { $, $$, uid, ler, gravar, toast, el, svg, CHAVES } = window.App;

  const KEY = CHAVES.agenda;
  const DIAS = window.App.DIAS_CURTOS || ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const PRIOS = window.App.PRIORIDADES || [
    { id: "alta", nome: "Máxima", cor: "var(--prio-alta)" },
    { id: "media", nome: "Importante", cor: "var(--prio-media)" },
    { id: "baixa", nome: "Necessária", cor: "var(--prio-baixa)" }
  ];
  const PESO = { alta: 0, media: 1, baixa: 2 };
  const prio = (id) => PRIOS.find(p => p.id === id) || PRIOS[1];
  const DURACOES = [[15,"15 min"],[30,"30 min"],[45,"45 min"],[60,"1 h"],[90,"1h30"],[120,"2 h"],[180,"3 h"],[240,"4 h"]];
  const RESPIROS = [[0,"Sem respiro"],[10,"10 min"],[15,"15 min"],[30,"30 min"]];
  const PASSO = 30;          // altura de uma linha da grade, em minutos
  const ALTURA_PASSO = 28;   // px por linha

  // db = { prefs, blocos }
  // bloco = { id, titulo, data, hora, duracaoMin, prioridade, cardId, quadroId, nota, feito, auto }
  let db = normaliza(ler(KEY, null));
  let segunda = inicioSemana(hoje());
  let filtroQuadro = "todos";
  let ultimoPlano = [];      // ids criados na última montagem, para o "Desfazer"

  function prefsPadrao(){
    return { inicio: "08:00", fim: "18:00", dias: [1, 2, 3, 4, 5], duracaoPadrao: 60, respiroMin: 0 };
  }
  function normaliza(d){
    const p = Object.assign(prefsPadrao(), (d && d.prefs) || {});
    if (!Array.isArray(p.dias) || !p.dias.length) p.dias = [1, 2, 3, 4, 5];
    return { prefs: p, blocos: (d && d.blocos) || [] };
  }
  function salvar(){ gravar(KEY, db); }

  // ── Datas e minutos ─────────────────────────────────────────────────
  function hoje(){ const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function iso(d){ return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function daIso(t){ const [a, m, d] = t.split("-").map(Number); return new Date(a, m - 1, d); }
  function inicioSemana(d){ const x = new Date(d); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); x.setHours(0,0,0,0); return x; }  // segunda
  function addDias(d, n){ const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function min(hhmm){ const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; }
  function hhmm(mins){ return String(Math.floor(mins / 60)).padStart(2, "0") + ":" + String(mins % 60).padStart(2, "0"); }
  function agoraMin(){ const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  const MES_CURTO = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

  function diasDaSemana(){ return [0,1,2,3,4,5,6].map(i => addDias(segunda, i)); }
  function rotuloSemana(){
    const a = segunda, b = addDias(segunda, 6);
    const mesmoMes = a.getMonth() === b.getMonth();
    return a.getDate() + (mesmoMes ? "" : " de " + MES_CURTO[a.getMonth()]) + " a " +
           b.getDate() + " de " + MES_CURTO[b.getMonth()] + " de " + b.getFullYear();
  }

  // ── O que aparece na grade ──────────────────────────────────────────
  // Duas fontes: blocos guardados aqui e cards com dia+hora marcados nos
  // quadros (âncoras). A âncora continua morando no card — mexer nela mexe no card.
  // `todos` ignora o filtro de quadro: para checar choque de horário e para o
  // planejador, o que vale é a agenda inteira, não só o quadro que está na tela.
  function itensDoDia(dataIso, todos){
    const out = db.blocos
      .filter(b => b.data === dataIso)
      .filter(b => todos || filtroQuadro === "todos" || !b.cardId || b.quadroId === filtroQuadro)
      .map(b => ({
        id: b.id, tipo: "bloco", titulo: b.titulo, hora: b.hora, duracaoMin: b.duracaoMin,
        prioridade: b.prioridade, feito: b.feito, cardId: b.cardId, nota: b.nota, ref: b
      }));

    for (const { card, quadroId } of (todos ? todosOsCards() : cardsVisiveis())) {
      const ag = card.agenda || {};
      if (ag.data !== dataIso || !ag.hora) continue;
      if (out.some(x => x.cardId === card.id)) continue;   // já tem bloco próprio nesse dia
      out.push({
        id: "card:" + card.id, tipo: "ancora", titulo: card.titulo, hora: ag.hora,
        duracaoMin: ag.duracaoMin || 60, prioridade: card.prioridade || "media",
        feito: card.feito, cardId: card.id, quadroId, nota: metaDoCard(card), ref: card
      });
    }
    return out.sort((a, b) => min(a.hora) - min(b.hora));
  }

  function cardsVisiveis(){
    const api = window.App.quadros;
    return api ? api.cards(filtroQuadro) : [];
  }
  function todosOsCards(){
    const api = window.App.quadros;
    return api ? api.cards("todos") : [];
  }
  function metaDoCard(card){
    if (!card.meta || card.meta.alvo == null) return "";
    const per = { sessao: "vez", dia: "dia", semana: "semana", mes: "mês" }[card.meta.periodo] || "vez";
    return card.meta.alvo + (card.meta.unidade ? " " + card.meta.unidade : "") + " por " + per;
  }

  // ── Render ──────────────────────────────────────────────────────────
  function render(){
    $("#semanaLabel").textContent = rotuloSemana();

    const sel = $("#semQuadro");
    const api = window.App.quadros;
    sel.innerHTML = "";
    sel.appendChild(el("option", { value: "todos", texto: "Todos os quadros" }));
    if (api) for (const q of api.lista()) sel.appendChild(el("option", { value: q.id, texto: q.nome }));
    sel.value = [...sel.options].some(o => o.value === filtroQuadro) ? filtroQuadro : "todos";

    const ini = min(db.prefs.inicio), fim = min(db.prefs.fim);
    const totalLinhas = Math.max(1, Math.ceil((fim - ini) / PASSO));
    const alturaCol = totalLinhas * ALTURA_PASSO;
    const hojeIso = iso(hoje());

    const grade = $("#grade");
    grade.innerHTML = "";

    // cabeçalho
    const cab = el("div", { class: "grade-cab" }, [el("div")]);
    for (const d of diasDaSemana()) {
      const dIso = iso(d);
      const fora = !db.prefs.dias.includes(d.getDay());
      const carga = itensDoDia(dIso).reduce((s, i) => s + i.duracaoMin, 0);
      cab.appendChild(el("div", { class: "dia-cab" + (dIso === hojeIso ? " hoje" : "") + (fora ? " fora" : "") }, [
        el("div", { class: "dsem", texto: DIAS[d.getDay()] }),
        el("div", { class: "dnum", texto: String(d.getDate()) }),
        el("div", { class: "carga", texto: carga ? (carga / 60).toFixed(carga % 60 ? 1 : 0).replace(".", ",") + "h" : "—" })
      ]));
    }
    grade.appendChild(cab);

    // corpo
    const corpo = el("div", { class: "grade-corpo" });
    const colHoras = el("div", { class: "col-horas", style: "height:" + alturaCol + "px" });
    for (let i = 0; i < totalLinhas; i++) {
      const m = ini + i * PASSO;
      colHoras.appendChild(el("div", {
        class: "marca", style: "height:" + ALTURA_PASSO + "px",
        texto: m % 60 === 0 ? hhmm(m) : ""
      }));
    }
    corpo.appendChild(colHoras);

    for (const d of diasDaSemana()) {
      const dIso = iso(d);
      const fora = !db.prefs.dias.includes(d.getDay());
      const col = el("div", { class: "col-dia" + (fora ? " fora" : ""), style: "height:" + alturaCol + "px" });
      col.dataset.data = dIso;

      for (let i = 0; i < totalLinhas; i++) {
        const m = ini + i * PASSO;
        col.appendChild(el("div", { class: "linha" + (m % 60 ? " meia" : ""), style: "height:" + ALTURA_PASSO + "px" }));
      }
      if (dIso === hojeIso && agoraMin() >= ini && agoraMin() <= fim) {
        col.appendChild(el("div", { class: "linha agora", style: "position:absolute;left:0;right:0;height:0;top:" + ((agoraMin() - ini) / PASSO * ALTURA_PASSO) + "px" }));
      }

      for (const it of comFaixas(itensDoDia(dIso))) col.appendChild(blocoEl(it, ini, fim));

      col.addEventListener("pointerdown", (e) => {
        if (e.target.closest(".bloco")) return;
        cliqueVazio(e, col, dIso, ini);
      });
      corpo.appendChild(col);
    }
    grade.appendChild(corpo);
  }

  // Sobreposição: quem começa antes fica na primeira faixa; o resto divide a largura.
  function comFaixas(itens){
    const lista = itens.map(i => Object.assign({}, i, { ini: min(i.hora), fim: min(i.hora) + i.duracaoMin }));
    const fimDaFaixa = [];
    for (const it of lista) {
      let f = fimDaFaixa.findIndex(fim => fim <= it.ini);
      if (f < 0) { fimDaFaixa.push(it.fim); f = fimDaFaixa.length - 1; } else fimDaFaixa[f] = it.fim;
      it.faixa = f;
    }
    const total = Math.max(1, fimDaFaixa.length);
    for (const it of lista) it.totalFaixas = total;
    return lista;
  }

  function blocoEl(it, iniJanela, fimJanela){
    const topo = (it.ini - iniJanela) / PASSO * ALTURA_PASSO;
    const altura = Math.max(20, it.duracaoMin / PASSO * ALTURA_PASSO - 2);
    const larg = 100 / it.totalFaixas;
    const p = prio(it.prioridade);

    const filhos = [el("div", { class: "bt", texto: it.titulo })];
    if (altura > 34) filhos.push(el("div", { class: "bh", texto: it.hora + "–" + hhmm(it.ini + it.duracaoMin) }));
    if (altura > 52 && it.nota) filhos.push(el("div", { class: "bm", texto: it.nota }));

    const node = el("div", {
      class: "bloco" + (it.feito ? " feito" : "") + (it.tipo === "ancora" ? " fixo" : ""),
      style: "--c:" + p.cor + ";top:" + topo + "px;height:" + altura + "px;left:" + (it.faixa * larg) + "%;width:calc(" + larg + "% - 3px)",
      title: it.titulo + " · " + it.hora + " · " + (it.tipo === "ancora" ? "marcado no card" : "planejado")
    }, filhos);
    node.dataset.id = it.id;
    node.addEventListener("pointerdown", (e) => arrastaBloco(e, node, it, iniJanela, fimJanela));
    node.addEventListener("click", () => { if (Date.now() - ultimoArrasto > 250) abrirBloco(it); });
    return node;
  }

  // ── Arrastar blocos ─────────────────────────────────────────────────
  let ultimoArrasto = 0;
  function arrastaBloco(ev, node, it, iniJanela, fimJanela){
    if (ev.button != null && ev.button !== 0) return;
    let ativo = false, fantasma = null, timer = null;
    const toque = ev.pointerType === "touch";
    const x0 = ev.clientX, y0 = ev.clientY;
    const r = node.getBoundingClientRect();
    const dy = ev.clientY - r.top;
    let destino = null;

    function bloqueia(e){ e.preventDefault(); }
    function comeca(){
      ativo = true;
      fantasma = node.cloneNode(true);
      fantasma.classList.add("bloco-fantasma");
      fantasma.style.width = r.width + "px";
      fantasma.style.height = r.height + "px";
      fantasma.style.left = r.left + "px";
      document.body.appendChild(fantasma);
      node.classList.add("arrastando");
      document.body.classList.add("arrastando");
      document.addEventListener("touchmove", bloqueia, { passive: false });
    }
    function move(e){
      fantasma.style.top = (e.clientY - dy) + "px";
      const col = document.elementFromPoint(e.clientX, e.clientY)?.closest(".col-dia");
      if (col) {
        const rc = col.getBoundingClientRect();
        fantasma.style.left = rc.left + 2 + "px";
        fantasma.style.width = rc.width - 6 + "px";
        const y = e.clientY - dy - rc.top;
        let m = iniJanela + Math.round(y / ALTURA_PASSO) * PASSO;
        m = Math.max(iniJanela, Math.min(fimJanela - it.duracaoMin, m));
        destino = { data: col.dataset.data, hora: hhmm(m) };
        fantasma.style.top = rc.top + (m - iniJanela) / PASSO * ALTURA_PASSO + "px";
      }
    }
    function fim(){
      clearTimeout(timer);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", fim);
      document.removeEventListener("pointercancel", fim);
      document.removeEventListener("touchmove", bloqueia);
      if (!ativo) return;
      fantasma.remove();
      node.classList.remove("arrastando");
      document.body.classList.remove("arrastando");
      ultimoArrasto = Date.now();
      if (destino) mover(it, destino.data, destino.hora);
    }
    function onMove(e){
      if (ativo) { e.preventDefault(); move(e); return; }
      const dist = Math.hypot(e.clientX - x0, e.clientY - y0);
      if (toque) { if (dist > 10) fim(); }
      else if (dist > 4) { comeca(); move(e); }
    }
    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", fim);
    document.addEventListener("pointercancel", fim);
    if (toque) timer = setTimeout(() => { comeca(); }, 230);
  }

  // Mover uma âncora mexe no card; mover um bloco mexe no bloco.
  function mover(it, data, hora){
    const c = conflito(data, hora, it.duracaoMin, {
      ignoraCardId: it.cardId,
      ignoraBlocoId: it.tipo === "bloco" ? it.id : null
    });
    if (c) { avisaConflito(c); render(); return; }   // volta para onde estava

    if (it.tipo === "ancora") {
      const api = window.App.quadros, achado = api && api.achar(it.cardId);
      if (achado) {
        const ag = Object.assign({}, achado.card.agenda, { data, hora });
        api.atualizar(it.cardId, { agenda: ag });
      }
    } else {
      const b = db.blocos.find(x => x.id === it.id);
      if (b) { b.data = data; b.hora = hora; b.auto = false; }
      salvar();
    }
    render();
  }

  // ── Clicar num espaço vazio cria um bloco ali ───────────────────────
  function cliqueVazio(ev, col, dataIso, iniJanela){
    const rc = col.getBoundingClientRect();
    const y = ev.clientY - rc.top;
    const m = iniJanela + Math.floor(y / ALTURA_PASSO) * PASSO;
    abrirBloco(null, { data: dataIso, hora: hhmm(m) });
  }

  // ── Modal do bloco ──────────────────────────────────────────────────
  const modal = $("#modalBloco");
  let emEdicao = null;   // { tipo, id, cardId } | null (novo)
  let novoPadrao = null;
  let prioEdicao = "media", feitoEdicao = false;

  function abrirBloco(it, padrao){
    emEdicao = it || null;
    novoPadrao = padrao || null;

    let dur = it ? it.duracaoMin : db.prefs.duracaoPadrao;
    if (!it) {
      // não adianta oferecer 2h se só há 30 min até o próximo compromisso
      const livre = espacoLivre(padrao.data, padrao.hora);
      const cabem = DURACOES.map(d => d[0]).filter(m => m <= Math.min(db.prefs.duracaoPadrao, livre));
      dur = cabem.length ? cabem[cabem.length - 1] : DURACOES[0][0];
    }
    $("#bTitulo").value = it ? it.titulo : "";
    $("#bData").value = it ? dataDoItem(it) : padrao.data;
    $("#bHora").value = it ? it.hora : padrao.hora;
    opcoes($("#bDuracao"), DURACOES, dur);
    $("#bNota").value = it && it.tipo === "bloco" ? (it.nota || "") : "";
    prioEdicao = it ? it.prioridade : "media";
    feitoEdicao = it ? !!it.feito : false;
    renderPrio($("#bPrioridade"), () => prioEdicao, (v) => { prioEdicao = v; });
    $("#bFeito").classList.toggle("marcado", feitoEdicao);

    const daAncora = it && it.tipo === "ancora";
    $("#bOrigem").textContent = daAncora
      ? "Este horário está marcado no próprio card — mudanças aqui vão para o card."
      : (it && it.cardId ? "Bloco planejado a partir de um card." : "");
    $("#bOrigem").classList.toggle("oculto", !it || !it.cardId);
    $("#bNota").disabled = !!daAncora;
    $("#bAbrirCard").classList.toggle("oculto", !(it && it.cardId));
    $("#bExcluir").classList.toggle("oculto", !it);
    $("#bExcluir").textContent = daAncora ? "Tirar o horário do card" : "Tirar da semana";

    modal.showModal();
    setTimeout(() => $("#bTitulo").focus(), 0);
  }

  function dataDoItem(it){
    if (it.tipo === "bloco") return it.ref.data;
    return it.ref.agenda.data;
  }
  function opcoes(sel, pares, valor){
    sel.innerHTML = "";
    for (const [v, r] of pares) sel.appendChild(el("option", { value: v, texto: r }));
    sel.value = String(valor);
  }
  function renderPrio(box, ler_, gravar_){
    box.innerHTML = "";
    for (const p of PRIOS) {
      box.appendChild(el("button", {
        type: "button", style: "--c:" + p.cor, "aria-pressed": String(ler_() === p.id),
        html: '<span class="bolinha"></span>' + p.nome,
        onclick: () => { gravar_(p.id); renderPrio(box, ler_, gravar_); }
      }));
    }
  }

  $("#bFeito").addEventListener("click", () => { feitoEdicao = !feitoEdicao; $("#bFeito").classList.toggle("marcado", feitoEdicao); });
  $("#bFechar").addEventListener("click", () => modal.close());
  $("#bCancelar").addEventListener("click", () => modal.close());
  $("#bAbrirCard").addEventListener("click", () => {
    const id = emEdicao && emEdicao.cardId;
    modal.close();
    if (id && window.App.quadros && !window.App.quadros.abrir(id)) toast("Esse card não existe mais.");
  });
  $("#bExcluir").addEventListener("click", () => {
    if (!emEdicao) return modal.close();
    if (emEdicao.tipo === "ancora") {
      const api = window.App.quadros, achado = api.achar(emEdicao.cardId);
      if (achado) api.atualizar(emEdicao.cardId, { agenda: Object.assign({}, achado.card.agenda, { hora: null }) });
    } else {
      db.blocos = db.blocos.filter(b => b.id !== emEdicao.id);
      salvar();
    }
    modal.close(); render();
  });
  $("#bSalvar").addEventListener("click", () => {
    const titulo = $("#bTitulo").value.trim();
    if (!titulo) { $("#bTitulo").focus(); return; }
    const data = $("#bData").value, hora = $("#bHora").value;
    if (!data || !hora) { toast("Dia e hora são obrigatórios."); return; }
    const duracaoMin = parseInt($("#bDuracao").value, 10) || 60;

    const c = conflito(data, hora, duracaoMin, {
      ignoraCardId: emEdicao ? emEdicao.cardId : null,
      ignoraBlocoId: emEdicao && emEdicao.tipo === "bloco" ? emEdicao.id : null
    });
    if (c) { avisaConflito(c); return; }

    if (emEdicao && emEdicao.tipo === "ancora") {
      const api = window.App.quadros, achado = api.achar(emEdicao.cardId);
      if (achado) {
        api.atualizar(emEdicao.cardId, {
          titulo,
          prioridade: prioEdicao,
          feito: feitoEdicao,
          agenda: Object.assign({}, achado.card.agenda, { data, hora, duracaoMin })
        });
      }
    } else if (emEdicao) {
      const b = db.blocos.find(x => x.id === emEdicao.id);
      if (b) Object.assign(b, { titulo, data, hora, duracaoMin, prioridade: prioEdicao, feito: feitoEdicao, nota: $("#bNota").value.trim(), auto: false });
      salvar();
    } else {
      db.blocos.push({
        id: uid(), titulo, data, hora, duracaoMin, prioridade: prioEdicao,
        cardId: null, quadroId: null, nota: $("#bNota").value.trim(), feito: feitoEdicao, auto: false
      });
      salvar();
    }
    modal.close(); render();
  });

  // ── Preferências ────────────────────────────────────────────────────
  const modalPrefs = $("#modalPrefs");
  let diasEdicao = [];
  $("#btnPrefs").addEventListener("click", () => {
    $("#pInicio").value = db.prefs.inicio;
    $("#pFim").value = db.prefs.fim;
    diasEdicao = db.prefs.dias.slice();
    renderDiasPrefs();
    opcoes($("#pDuracao"), DURACOES, db.prefs.duracaoPadrao);
    opcoes($("#pIntervalo"), RESPIROS, db.prefs.respiroMin);
    modalPrefs.showModal();
  });
  function renderDiasPrefs(){
    const box = $("#pDias");
    box.innerHTML = "";
    for (let d = 0; d < 7; d++) {
      box.appendChild(el("button", {
        type: "button", texto: DIAS[d], "aria-pressed": String(diasEdicao.includes(d)),
        onclick: () => {
          const i = diasEdicao.indexOf(d);
          if (i >= 0) diasEdicao.splice(i, 1); else diasEdicao.push(d);
          renderDiasPrefs();
        }
      }));
    }
  }
  $("#pFechar").addEventListener("click", () => modalPrefs.close());
  $("#pCancelar").addEventListener("click", () => modalPrefs.close());
  $("#pSalvar").addEventListener("click", () => {
    const ini = $("#pInicio").value || "08:00", fim = $("#pFim").value || "18:00";
    if (min(fim) - min(ini) < 60) { toast("O dia precisa ter pelo menos uma hora."); return; }
    if (!diasEdicao.length) { toast("Escolha ao menos um dia."); return; }
    db.prefs = {
      inicio: ini, fim,
      dias: diasEdicao.slice().sort(),
      duracaoPadrao: parseInt($("#pDuracao").value, 10) || 60,
      respiroMin: parseInt($("#pIntervalo").value, 10) || 0
    };
    salvar(); modalPrefs.close(); render();
  });
  $("#pLimpar").addEventListener("click", () => {
    const alvo = diasDaSemana().map(iso);
    const quantos = db.blocos.filter(b => b.auto && alvo.includes(b.data)).length;
    if (!quantos) { toast("Nada montado automaticamente nesta semana."); return; }
    if (!confirm("Tirar os " + quantos + " blocos que o planejador montou nesta semana?\n\nO que você marcou na mão fica.")) return;
    db.blocos = db.blocos.filter(b => !(b.auto && alvo.includes(b.data)));
    salvar(); modalPrefs.close(); render();
  });

  // ══ CHOQUE DE HORÁRIO ═════════════════════════════════════════════
  // Nada entra em cima de nada: o mesmo teste vale para o arrasto, para o
  // que você marca na mão, para o horário posto no card e para o planejador.
  function ocupacaoDoDia(dataIso, ignoraCardId, ignoraBlocoId){
    return itensDoDia(dataIso, true)
      .filter(i => !i.feito)                                   // o que já foi feito libera o horário
      .filter(i => !(ignoraCardId && i.cardId === ignoraCardId))
      .filter(i => !(ignoraBlocoId && i.id === ignoraBlocoId))
      .map(i => ({ ini: min(i.hora), fim: min(i.hora) + i.duracaoMin, titulo: i.titulo }));
  }

  function conflito(dataIso, hora, dur, ops){
    const ini = min(hora), fim = ini + dur;
    const o = ops || {};
    return ocupacaoDoDia(dataIso, o.ignoraCardId, o.ignoraBlocoId)
      .find(x => ini < x.fim && fim > x.ini) || null;
  }
  function avisaConflito(c){
    toast("Já tem “" + c.titulo + "” das " + hhmm(c.ini) + " às " + hhmm(c.fim) + ".");
  }

  // Quantos minutos livres existem a partir daquele ponto do dia.
  function espacoLivre(dataIso, hora, ignoraCardId){
    const t = min(hora);
    let limite = min(db.prefs.fim);
    for (const o of ocupacaoDoDia(dataIso, ignoraCardId)) if (o.ini >= t) limite = Math.min(limite, o.ini);
    return Math.max(0, limite - t);
  }

  // ══ O CARD ENTRA NA AGENDA SOZINHO ════════════════════════════════
  function novoBlocoDeCard(card, quadroId, dataIso, hora, dur){
    const b = {
      id: uid(), titulo: card.titulo, data: dataIso, hora, duracaoMin: dur,
      prioridade: card.prioridade || "media", cardId: card.id, quadroId,
      nota: metaDoCard(card), feito: false, auto: true
    };
    db.blocos.push(b);
    return b;
  }

  // Primeiro buraco livre a partir de hoje, olhando até duas semanas à frente.
  function proximoEspaco(dur, ignoraCardId){
    const ini = min(db.prefs.inicio), fim = min(db.prefs.fim), hojeIso = iso(hoje());
    for (let i = 0; i < 14; i++) {
      const d = addDias(hoje(), i);
      if (!db.prefs.dias.includes(d.getDay())) continue;
      const dIso = iso(d);
      const t = encaixe(ocupacaoDoDia(dIso, ignoraCardId), ini, fim, dur, pisoDoDia(dIso, ini, hojeIso));
      if (t != null) return { data: dIso, hora: hhmm(t) };
    }
    return null;
  }

  function agendarCard(card, quadroId){
    if (card.feito) return [];
    const ag = card.agenda || {};
    if (ag.data && ag.hora) return [];            // já tem hora marcada no card: aparece como âncora
    const dur = ag.duracaoMin || db.prefs.duracaoPadrao;
    const rep = card.repete || { modo: "nao" };
    const ini = min(db.prefs.inicio), fim = min(db.prefs.fim), hojeIso = iso(hoje());
    const criados = [];

    if (rep.modo !== "nao") {
      const proximos = [];
      for (let i = 0; i < 7; i++) proximos.push(addDias(hoje(), i));
      for (const dIso of diasAlvo(rep, proximos)) {
        if (dIso < hojeIso) continue;
        if (db.blocos.some(b => b.cardId === card.id && b.data === dIso)) continue;
        const t = encaixe(ocupacaoDoDia(dIso, card.id), ini, fim, dur, pisoDoDia(dIso, ini, hojeIso));
        if (t != null) criados.push(novoBlocoDeCard(card, quadroId, dIso, hhmm(t), dur));
      }
      return criados;
    }

    // uma vez só: se já tem bloco daqui para a frente, não cria outro
    if (db.blocos.some(b => b.cardId === card.id && b.data >= hojeIso)) return [];

    if (ag.data && ag.data >= hojeIso) {
      const t = encaixe(ocupacaoDoDia(ag.data, card.id), ini, fim, dur, pisoDoDia(ag.data, ini, hojeIso));
      if (t != null) criados.push(novoBlocoDeCard(card, quadroId, ag.data, hhmm(t), dur));
      return criados;
    }
    const espaco = proximoEspaco(dur, card.id);
    if (espaco) criados.push(novoBlocoDeCard(card, quadroId, espaco.data, espaco.hora, dur));
    return criados;
  }

  // Se o card caiu em outra semana (típico no fim de semana: tudo vai para
  // segunda, que já é a semana seguinte), a grade vai junto — senão parece
  // que não aconteceu nada.
  function focaSemanaDe(dataIso){
    const alvo = inicioSemana(daIso(dataIso));
    if (iso(alvo) === iso(segunda)) return false;
    segunda = alvo;
    return true;
  }

  function avisaAgendado(criados){
    if (!criados.length) return;
    const cedo = criados.slice().sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora))[0];
    const mudou = focaSemanaDe(cedo.data);
    const d = daIso(cedo.data);
    const quando = DIAS[d.getDay()].toLowerCase() + " " + d.getDate() + "/" + String(d.getMonth() + 1).padStart(2, "0");
    if (criados.length > 1) toast("Entrou na agenda em " + criados.length + " dias, a partir de " + quando + ".");
    else toast("Entrou na agenda: " + quando + " às " + cedo.hora + (mudou ? " — outra semana, já mudei a grade." : "."));
  }

  // Chamados pela aba Atividades sempre que um card nasce, muda ou some.
  window.App.semana = {
    conflito,
    aoCriarCard(card, quadroId){
      const criados = agendarCard(card, quadroId);
      if (criados.length) { salvar(); avisaAgendado(criados); render(); }
      else if (!card.feito) toast("Sem espaço livre na agenda — ajuste os horários ou a semana.");
    },
    aoSalvarCard(card, quadroId){
      const hojeIso = iso(hoje());
      const ag = card.agenda || {};

      // ganhou hora marcada no card: os blocos automáticos saem para não duplicar
      if (ag.data && ag.hora) {
        db.blocos = db.blocos.filter(b => !(b.cardId === card.id && b.data >= hojeIso && b.auto));
        salvar(); render(); return;
      }

      let duracaoPresa = false;
      for (const b of db.blocos.filter(x => x.cardId === card.id && x.data >= hojeIso)) {
        b.titulo = card.titulo;
        b.prioridade = card.prioridade || "media";
        b.feito = !!card.feito;
        b.nota = metaDoCard(card);
        const nova = ag.duracaoMin || b.duracaoMin;
        if (nova !== b.duracaoMin) {
          const cabe = nova < b.duracaoMin || !conflito(b.data, b.hora, nova, { ignoraBlocoId: b.id, ignoraCardId: card.id });
          if (cabe) b.duracaoMin = nova; else duracaoPresa = true;
        }
      }
      const novos = agendarCard(card, quadroId);
      salvar();
      if (duracaoPresa) toast("A duração maior não coube: o bloco ficou com o horário antigo.");
      else avisaAgendado(novos);
      render();
    },
    aoExcluirCard(cardId){
      const hojeIso = iso(hoje());
      db.blocos = db.blocos.filter(b => !(b.cardId === cardId && b.data >= hojeIso));
      salvar(); render();
    }
  };

  // ══ O PLANEJADOR ══════════════════════════════════════════════════
  // 1. levanta a demanda (cada card vira uma ou várias sessões na semana)
  // 2. ordena por prioridade e por prazo
  // 3. encaixa cada sessão no primeiro buraco livre do dia
  function montarSemana(){
    const ini = min(db.prefs.inicio), fim = min(db.prefs.fim);
    const dias = diasDaSemana();
    const hojeIso = iso(hoje());
    const ocupacao = {};
    for (const d of dias) {
      const dIso = iso(d);
      ocupacao[dIso] = ocupacaoDoDia(dIso);
    }

    const demandas = [];
    for (const { card, quadroId } of cardsVisiveis()) {
      if (card.feito) continue;
      const dur = (card.agenda && card.agenda.duracaoMin) || db.prefs.duracaoPadrao;
      const p = card.prioridade || "media";
      const rep = card.repete || { modo: "nao" };
      const base = { card, quadroId, dur, prioridade: p, recorrente: rep.modo !== "nao" };

      if (rep.modo !== "nao") {
        for (const dIso of diasAlvo(rep, dias)) demandas.push(Object.assign({ dia: dIso }, base));
      } else if (card.agenda && card.agenda.data) {
        if (card.agenda.hora) continue;                       // já é âncora, está na grade
        const dIso = card.agenda.data;
        if (dias.some(d => iso(d) === dIso)) demandas.push(Object.assign({ dia: dIso }, base));
      } else {
        demandas.push(Object.assign({ dia: null }, base));    // livre: o planejador escolhe o dia
      }
    }

    // vermelho antes de amarelo antes de verde; dentro da cor, prazo mais perto primeiro;
    // quem já tem dia definido entra antes de quem está solto
    demandas.sort((a, b) =>
      PESO[a.prioridade] - PESO[b.prioridade] ||
      (a.dia ? 0 : 1) - (b.dia ? 0 : 1) ||
      (prazoDe(a.card) || "9999").localeCompare(prazoDe(b.card) || "9999")
    );

    const criados = [], sobraram = [];
    const diasIso = dias.map(iso);
    // Recorrente pode repetir na semana, mas uma vez por dia. Tarefa de uma vez só
    // já agendada em qualquer dia da semana não ganha um segundo bloco.
    const jaNaSemana = (cardId) => db.blocos.some(b => b.cardId === cardId && diasIso.includes(b.data));

    for (const dem of demandas) {
      const jaTem = (dIso) => db.blocos.some(b => b.cardId === dem.card.id && b.data === dIso);
      if (!dem.recorrente && jaNaSemana(dem.card.id)) continue;

      let dIso = dem.dia;
      if (dIso && jaTem(dIso)) continue;

      if (!dIso) {
        // livre: prioridade máxima vai para o dia mais próximo com espaço;
        // as outras vão para o dia mais vazio, para não entupir a segunda-feira
        const candidatos = dias
          .filter(d => db.prefs.dias.includes(d.getDay()) && iso(d) >= hojeIso)
          .map(d => ({ dIso: iso(d), livre: livreNoDia(ocupacao[iso(d)], ini, fim) }))
          .filter(c => !jaTem(c.dIso) && encaixe(ocupacao[c.dIso], ini, fim, dem.dur, pisoDoDia(c.dIso, ini, hojeIso)) != null);
        if (!candidatos.length) { sobraram.push({ dem, motivo: "não sobrou espaço em nenhum dia da semana" }); continue; }
        dIso = dem.prioridade === "alta"
          ? candidatos[0].dIso
          : candidatos.sort((a, b) => b.livre - a.livre)[0].dIso;
      }

      if (!ocupacao[dIso]) { sobraram.push({ dem, motivo: "o dia está fora desta semana" }); continue; }
      if (dIso < hojeIso) { sobraram.push({ dem, motivo: "esse dia já passou" }); continue; }

      const piso = pisoDoDia(dIso, ini, hojeIso);
      const inicio = encaixe(ocupacao[dIso], ini, fim, dem.dur, piso);
      if (inicio == null) {
        const acabou = piso + dem.dur > fim;
        sobraram.push({ dem, dia: dIso, motivo: acabou && dIso === hojeIso ? "o horário de hoje já passou" : "o dia já está cheio" });
        continue;
      }

      const bloco = {
        id: uid(), titulo: dem.card.titulo, data: dIso, hora: hhmm(inicio),
        duracaoMin: dem.dur, prioridade: dem.prioridade,
        cardId: dem.card.id, quadroId: dem.quadroId, nota: metaDoCard(dem.card),
        feito: false, auto: true
      };
      db.blocos.push(bloco);
      ocupacao[dIso].push({ ini: inicio, fim: inicio + dem.dur });
      criados.push(bloco);
    }

    salvar();
    ultimoPlano = criados.map(b => b.id);
    render();
    mostraPlano(criados, sobraram);
  }

  function prazoDe(card){ return (card.agenda && card.agenda.data) || null; }
  // Hoje não adianta agendar para trás: o piso é a hora atual arredondada.
  function pisoDoDia(dIso, ini, hojeIso){
    if (dIso !== hojeIso) return ini;
    return Math.max(ini, Math.ceil(agoraMin() / PASSO) * PASSO);
  }

  function diasAlvo(rep, dias){
    const isos = dias.map(iso);
    if (rep.modo === "todos") return isos;
    if (rep.modo === "dias") return dias.filter(d => (rep.dias || []).includes(d.getDay())).map(iso);
    if (rep.modo === "vezes") {
      const uteis = dias.filter(d => db.prefs.dias.includes(d.getDay()));
      const n = Math.min(rep.vezes || 1, uteis.length);
      if (!n) return [];
      // espalha as N sessões pelos dias úteis: 3x na semana vira seg/qua/sex,
      // não seg/ter/qua empilhadas no começo
      if (n === 1) return [iso(uteis[0])];
      const saida = [];
      for (let i = 0; i < n; i++) saida.push(iso(uteis[Math.round(i * (uteis.length - 1) / (n - 1))]));
      return saida;
    }
    return [];
  }

  // Primeiro minuto livre que comporta `dur`, respeitando o respiro entre blocos.
  function encaixe(ocupado, iniJanela, fimJanela, dur, piso){
    const resp = db.prefs.respiroMin || 0;
    const busy = ocupado
      .map(o => ({ ini: o.ini - resp, fim: o.fim + resp }))
      .sort((a, b) => a.ini - b.ini);
    let t = Math.max(iniJanela, piso == null ? iniJanela : piso);
    for (const o of busy) {
      if (o.fim <= t) continue;
      if (o.ini - t >= dur) return t;
      t = Math.max(t, o.fim);
    }
    return fimJanela - t >= dur ? t : null;
  }

  function livreNoDia(ocupado, ini, fim){
    const usado = ocupado.reduce((s, o) => s + (Math.min(o.fim, fim) - Math.max(o.ini, ini)), 0);
    return Math.max(0, (fim - ini) - usado);
  }

  // ── Resultado ───────────────────────────────────────────────────────
  const modalPlano = $("#modalPlano");
  function mostraPlano(criados, sobraram){
    $("#plTitulo").textContent = criados.length ? "Semana montada" : "Nada a montar";
    $("#plSub").textContent = criados.length
      ? criados.length + (criados.length === 1 ? " bloco novo" : " blocos novos") +
        (sobraram.length ? " · " + sobraram.length + " não coube" : "")
      : (sobraram.length
          ? "Nada coube nesta semana — veja os motivos abaixo."
          : "Tudo o que dava para encaixar já estava na grade.");

    const corpo = $("#plCorpo");
    corpo.innerHTML = "";

    if (criados.length) {
      const box = el("div", { class: "campo" }, [el("label", { texto: "Entrou na semana" })]);
      for (const b of criados.slice().sort((x, y) => (x.data + x.hora).localeCompare(y.data + y.hora))) {
        const d = daIso(b.data);
        box.appendChild(el("div", { class: "plano-linha" }, [
          el("span", { class: "qd", style: "--c:" + prio(b.prioridade).cor }),
          el("div", { class: "info" }, [
            el("div", { texto: b.titulo }),
            el("div", { class: "quando", texto: DIAS[d.getDay()] + " " + d.getDate() + " · " + b.hora + "–" + hhmm(min(b.hora) + b.duracaoMin) })
          ])
        ]));
      }
      corpo.appendChild(box);
    }

    if (sobraram.length) {
      const box = el("div", { class: "campo" }, [el("label", { texto: "Não coube" })]);
      for (const s of sobraram) {
        box.appendChild(el("div", { class: "plano-linha" }, [
          el("span", { class: "qd", style: "--c:" + prio(s.dem.prioridade).cor }),
          el("div", { class: "info" }, [
            el("div", { texto: s.dem.card.titulo }),
            el("div", { class: "motivo", texto: s.motivo })
          ])
        ]));
      }
      box.appendChild(el("div", { class: "vazio-inline", texto: "Dá para abrir mais espaço aumentando a janela do dia em “Horários”, encurtando a duração das tarefas ou tirando algo da semana." }));
      corpo.appendChild(box);
    }

    $("#plDesfazer").classList.toggle("oculto", !criados.length);
    modalPlano.showModal();
  }
  $("#plFechar").addEventListener("click", () => modalPlano.close());
  $("#plOk").addEventListener("click", () => modalPlano.close());
  $("#plDesfazer").addEventListener("click", () => {
    db.blocos = db.blocos.filter(b => !ultimoPlano.includes(b.id));
    ultimoPlano = [];
    salvar(); modalPlano.close(); render();
    toast("Planejamento desfeito.");
  });

  // ── Barra ───────────────────────────────────────────────────────────
  $("#semPrev").addEventListener("click", () => { segunda = addDias(segunda, -7); render(); });
  $("#semNext").addEventListener("click", () => { segunda = addDias(segunda, 7); render(); });
  $("#semHoje").addEventListener("click", () => { segunda = inicioSemana(hoje()); render(); });
  $("#semQuadro").addEventListener("change", (e) => { filtroQuadro = e.target.value; render(); });
  $("#btnMontar").addEventListener("click", montarSemana);

  // No domingo à noite, a semana corrente já acabou: se ela está vazia e a
  // próxima tem compromissos, é nela que faz sentido abrir.
  function abreOndeTemCoisa(){
    const temAlgo = (ini) => [0,1,2,3,4,5,6].some(i => itensDoDia(iso(addDias(ini, i)), true).length > 0);
    if (temAlgo(segunda)) return;
    const proxima = addDias(segunda, 7);
    if (temAlgo(proxima)) segunda = proxima;
  }

  document.addEventListener("dados:importados", () => { db = normaliza(ler(KEY, null)); render(); });
  document.addEventListener("aba:mudou", (e) => { if (e.detail === "semana") render(); });

  abreOndeTemCoisa();
  render();
})();
