/* ══════════════════════════════════════════════════════════════════════
   metas.js — aba "Metas": o mapa do projeto de vida

   Ideia: metas de horizonte longo (10 anos) no topo, curtas (o mês) embaixo.
   Cada meta curta PUXA de uma meta maior — é essa ligação que transforma
   sete listas soltas num mapa. Uma vez por mês, a revisão passa meta a meta,
   atualiza os números e fica guardada como histórico.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";
  const { $, $$, uid, ler, gravar, toast, el, svg, CHAVES } = window.App;

  const KEY = CHAVES.metas;

  // Do mais longo ao mais curto: é assim que o mapa é lido, de cima para baixo.
  const HORIZONTES = [
    { id: "10anos",    nome: "10 anos",   sub: "o destino — quem você quer ser" },
    { id: "5anos",     nome: "5 anos",    sub: "a virada — o que precisa estar de pé" },
    { id: "3anos",     nome: "3 anos",    sub: "a construção" },
    { id: "ano",       nome: "1 ano",     sub: "o ano em curso" },
    { id: "semestre",  nome: "Semestre",  sub: "os próximos 6 meses" },
    { id: "trimestre", nome: "Trimestre", sub: "os próximos 90 dias" },
    { id: "mes",       nome: "Mês",       sub: "o que sai do papel agora" }
  ];
  const horizonte = (id) => HORIZONTES.find(h => h.id === id) || HORIZONTES[6];
  const nivel = (id) => HORIZONTES.findIndex(h => h.id === id);   // 0 = mais longo
  const CURTOS = ["mes", "trimestre", "semestre"];                // usam mês/ano; os outros só o ano

  const AREAS = [
    { id: "financeiro",  nome: "Financeiro",  cor: "#5a49e8" },
    { id: "negocio",     nome: "Negócio",     cor: "#0ea5e9" },
    { id: "saude",       nome: "Saúde",       cor: "#16a34a" },
    { id: "familia",     nome: "Família",     cor: "#e11d48" },
    { id: "aprendizado", nome: "Aprendizado", cor: "#d97706" },
    { id: "pessoal",     nome: "Pessoal",     cor: "#8b5cf6" }
  ];
  const area = (id) => AREAS.find(a => a.id === id) || AREAS[0];

  const STATUS = [
    { id: "no_rumo",   nome: "No rumo" },
    { id: "atencao",   nome: "Atenção" },
    { id: "travada",   nome: "Travada" },
    { id: "concluida", nome: "Concluída" }
  ];
  const nomeStatus = (id) => (STATUS.find(s => s.id === id) || STATUS[0]).nome;

  const MES_NOME = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const MES_CURTO = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

  // db = { metas:[meta], revisoes:[revisao] }
  // meta    = { id, titulo, detalhe, horizonte, areaId, paiId, prazo, status,
  //             medida:{tipo:"numero"|"marcos"|"simples", inicio, alvo, atual, unidade},
  //             marcos:[{id,txt,ok}], criadaEm, concluidaEm }
  // revisao = { id, mes:"YYYY-MM", criadaEm, atualizadaEm,
  //             itens:{ metaId:{valor,status,nota} }, funcionou, travou, foco }
  let db = normaliza(ler(KEY, null));
  let filtroArea = "todas";
  let cadeiaAtiva = null;      // ids destacados ao passar o mouse

  function normaliza(d){
    return { metas: (d && d.metas) || [], revisoes: (d && d.revisoes) || [] };
  }
  function salvar(){ gravar(KEY, db); }
  const meta = (id) => db.metas.find(m => m.id === id);
  const filhos = (id) => db.metas.filter(m => m.paiId === id);

  function mesAtual(){
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }
  function rotuloMes(mes){
    const [a, m] = mes.split("-");
    return MES_NOME[+m - 1] + " de " + a;
  }
  function rotuloMesCurto(mes){
    const [a, m] = mes.split("-");
    return MES_CURTO[+m - 1] + "/" + a.slice(2);
  }
  function rotuloPrazo(m){
    if (!m.prazo) return null;
    return CURTOS.includes(m.horizonte) ? rotuloMesCurto(m.prazo) : m.prazo;
  }
  function prazoVencido(m){
    if (!m.prazo || m.status === "concluida") return false;
    return CURTOS.includes(m.horizonte) ? m.prazo < mesAtual() : m.prazo < String(new Date().getFullYear());
  }

  // ── Números ─────────────────────────────────────────────────────────
  function parseNum(txt){
    if (typeof txt === "number") return txt;
    let s = String(txt == null ? "" : txt).replace(/[^\d,.-]/g, "").trim();
    if (!s) return null;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }
  function fmtNum(n, unidade){
    if (n == null) return "—";
    const txt = Math.abs(n) >= 1000
      ? n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })
      : n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
    if (!unidade) return txt;
    return /^R\$/i.test(unidade.trim()) ? "R$ " + txt : txt + " " + unidade;
  }

  // Devolve 0..100 ou null quando a meta não tem como ser medida em número.
  function progresso(m){
    if (m.status === "concluida") return 100;
    if (m.medida.tipo === "numero") {
      const ini = m.medida.inicio == null ? 0 : m.medida.inicio;
      const alvo = m.medida.alvo, atual = m.medida.atual == null ? ini : m.medida.atual;
      if (alvo == null || alvo === ini) return null;
      return Math.max(0, Math.min(100, Math.round((atual - ini) / (alvo - ini) * 100)));
    }
    if (m.medida.tipo === "marcos") {
      if (!m.marcos.length) return null;
      return Math.round(m.marcos.filter(x => x.ok).length / m.marcos.length * 100);
    }
    return null;
  }

  // ── Mapa ────────────────────────────────────────────────────────────
  function visiveis(){
    return db.metas.filter(m => filtroArea === "todas" || m.areaId === filtroArea);
  }

  function render(){
    // filtro de área
    const sel = $("#selArea");
    if (!sel.options.length) {
      sel.appendChild(el("option", { value: "todas", texto: "Todas as áreas" }));
      for (const a of AREAS) sel.appendChild(el("option", { value: a.id, texto: a.nome }));
    }
    sel.value = filtroArea;

    renderAvisoRevisao();
    renderResumo();

    const mapa = $("#mapa");
    mapa.innerHTML = "";
    const lista = visiveis();
    for (const h of HORIZONTES) {
      const desteNivel = lista.filter(m => m.horizonte === h.id);
      mapa.appendChild(faixaEl(h, desteNivel));
    }
  }

  function faixaEl(h, metas){
    const topo = el("div", { class: "faixa-topo" }, [
      el("span", { class: "faixa-titulo", texto: h.nome }),
      el("span", { class: "faixa-sub", texto: h.sub }),
      el("span", { class: "conta", texto: String(metas.length) }),
      el("button", { class: "add", texto: "+ Meta", onclick: () => abrirMeta(null, h.id) })
    ]);
    const corpo = metas.length
      ? el("div", { class: "faixa-corpo" }, metas.map(cardEl))
      : el("div", { class: "faixa-vazia", texto: h.id === "10anos"
          ? "Comece por aqui: o que você quer que seja verdade daqui a 10 anos?"
          : "Nenhuma meta neste horizonte." });
    return el("div", { class: "faixa" }, [topo, corpo]);
  }

  function cardEl(m){
    const a = area(m.areaId);
    const pct = progresso(m);
    const filhos_ = [];

    filhos_.push(el("div", { class: "meta-titulo", texto: m.titulo }));

    if (m.paiId && meta(m.paiId)) {
      filhos_.push(el("div", {
        class: "meta-pai",
        html: svg('<path d="M4 4v10a4 4 0 004 4h12"/><path d="M16 14l4 4-4 4"/>', 11) +
              "<span>" + escapa(meta(m.paiId).titulo) + "</span>"
      }));
    }

    if (pct != null) {
      filhos_.push(el("div", { class: "meta-barra", html: '<i style="width:' + pct + '%"></i>' }));
      const esq = m.medida.tipo === "numero"
        ? fmtNum(m.medida.atual == null ? m.medida.inicio : m.medida.atual, m.medida.unidade) + " de " + fmtNum(m.medida.alvo, m.medida.unidade)
        : m.marcos.filter(x => x.ok).length + " de " + m.marcos.length + " marcos";
      filhos_.push(el("div", { class: "meta-numeros" }, [
        el("span", { texto: esq }), el("span", { texto: pct + "%" })
      ]));
    }

    const pe = [
      el("span", { class: "pilula", html: '<span class="bolinha"></span>' + escapa(a.nome) }),
      el("span", { class: "pilula st-" + m.status, texto: nomeStatus(m.status) })
    ];
    const prazo = rotuloPrazo(m);
    if (prazo) pe.push(el("span", { class: "pilula" + (prazoVencido(m) ? " atrasada" : ""), texto: prazo }));
    filhos_.push(el("div", { class: "meta-pe" }, pe));

    const cls = ["meta-card"];
    if (m.status === "concluida") cls.push("concluida");
    if (cadeiaAtiva) cls.push(cadeiaAtiva.has(m.id) ? "na-cadeia" : "apagada");

    const node = el("button", { class: cls.join(" "), type: "button", style: "--cor-area:" + a.cor,
      onclick: () => abrirMeta(m.id) });
    for (const f of filhos_) node.appendChild(f);
    // passar o mouse acende a linhagem inteira: de onde vem e o que puxa dela
    node.addEventListener("mouseenter", () => { cadeiaAtiva = linhagem(m.id); pintaCadeia(); });
    node.addEventListener("mouseleave", () => { cadeiaAtiva = null; pintaCadeia(); });
    node.dataset.id = m.id;
    return node;
  }

  function escapa(t){ return String(t).replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c])); }

  // Sobe até a raiz e desce por todos os descendentes.
  function linhagem(id){
    const set = new Set([id]);
    let m = meta(id);
    while (m && m.paiId && !set.has(m.paiId)) { set.add(m.paiId); m = meta(m.paiId); }
    const desce = (pai) => { for (const f of filhos(pai)) if (!set.has(f.id)) { set.add(f.id); desce(f.id); } };
    desce(id);
    return set;
  }
  function pintaCadeia(){
    for (const node of $$("#mapa .meta-card")) {
      node.classList.toggle("na-cadeia", !!cadeiaAtiva && cadeiaAtiva.has(node.dataset.id));
      node.classList.toggle("apagada", !!cadeiaAtiva && !cadeiaAtiva.has(node.dataset.id));
    }
  }

  function renderResumo(){
    const lista = visiveis();
    const conta = (st) => lista.filter(m => m.status === st).length;
    const cels = [
      { cls: "", r: lista.length === 1 ? "Meta" : "Metas", n: lista.length },
      { cls: "no_rumo", r: "No rumo", n: conta("no_rumo") },
      { cls: "atencao", r: "Atenção", n: conta("atencao") + conta("travada") },
      { cls: "", r: "Concluídas", n: conta("concluida") }
    ];
    const box = $("#metasResumo");
    box.innerHTML = "";
    for (const c of cels) {
      box.appendChild(el("div", { class: "resumo-cel " + c.cls }, [
        el("div", { class: "n", texto: String(c.n) }),
        el("div", { class: "r", texto: c.r })
      ]));
    }
  }

  function renderAvisoRevisao(){
    const mes = mesAtual();
    const feita = db.revisoes.find(r => r.mes === mes);
    const box = $("#revisaoAviso");
    box.className = "revisao-aviso" + (feita ? "" : " pendente");
    box.innerHTML = "";

    const texto = el("div", { class: "txt" }, [
      el("b", { texto: feita ? "Revisão de " + rotuloMes(mes) + " feita" : "Revisão de " + rotuloMes(mes) + " pendente" }),
      el("span", { texto: feita
        ? "Você pode reabrir e ajustar quando quiser."
        : "Uma vez por mês: olhar meta a meta, atualizar os números e decidir o foco." })
    ]);
    box.appendChild(texto);

    const passadas = db.revisoes.filter(r => r.mes !== mes).sort((a, b) => b.mes.localeCompare(a.mes)).slice(0, 6);
    if (passadas.length) {
      const hist = el("div", { class: "historico" }, [el("span", { texto: "Antes:" })]);
      for (const r of passadas) hist.appendChild(el("button", { texto: rotuloMesCurto(r.mes), onclick: () => abrirRevisao(r.mes) }));
      box.appendChild(hist);
    }
    box.appendChild(el("button", {
      class: "btn sm", texto: feita ? "Abrir revisão" : "Fazer a revisão",
      onclick: () => abrirRevisao(mes)
    }));
  }

  // ── Modal da meta ───────────────────────────────────────────────────
  const modal = $("#modalMeta");
  let editandoId = null, rascunho = null;

  function metaNova(horizonteId){
    return {
      id: uid(), titulo: "", detalhe: "", horizonte: horizonteId || "mes",
      areaId: AREAS[0].id, paiId: null, prazo: "", status: "no_rumo",
      medida: { tipo: "simples", inicio: null, alvo: null, atual: null, unidade: "" },
      marcos: [], criadaEm: new Date().toISOString(), concluidaEm: null
    };
  }

  function abrirMeta(id, horizonteId){
    const original = id ? meta(id) : null;
    editandoId = id;
    rascunho = original ? JSON.parse(JSON.stringify(original)) : metaNova(horizonteId);

    $("#gTitulo").value = rascunho.titulo;
    $("#gDetalhe").value = rascunho.detalhe || "";
    opcoes($("#gHorizonte"), HORIZONTES.map(h => [h.id, h.nome]), rascunho.horizonte);
    opcoes($("#gArea"), AREAS.map(a => [a.id, a.nome]), rascunho.areaId);
    $("#gTipoMedida").value = rascunho.medida.tipo;
    $("#gInicio").value = rascunho.medida.inicio == null ? "" : rascunho.medida.inicio;
    $("#gAlvo").value = rascunho.medida.alvo == null ? "" : rascunho.medida.alvo;
    $("#gUnidade").value = rascunho.medida.unidade || "";
    ajustaPrazo();
    $("#gPrazo").value = rascunho.prazo || "";
    montaPais();
    renderStatus();
    renderMarcos();
    ajustaMedida();
    renderFilhos();
    renderHistorico();
    $("#gExcluir").classList.toggle("oculto", !id);
    modal.showModal();
    setTimeout(() => $("#gTitulo").focus(), 0);
  }

  function opcoes(sel, pares, valor){
    sel.innerHTML = "";
    for (const [v, rotulo] of pares) sel.appendChild(el("option", { value: v, texto: rotulo }));
    sel.value = String(valor == null ? "" : valor);
  }

  // Horizontes curtos marcam mês; de 1 ano para cima, só o ano.
  function ajustaPrazo(){
    const curto = CURTOS.includes($("#gHorizonte").value);
    const inp = $("#gPrazo");
    const valor = inp.value;
    if (curto && inp.type !== "month") { inp.type = "month"; inp.placeholder = ""; inp.value = /^\d{4}-\d{2}$/.test(valor) ? valor : ""; }
    if (!curto && inp.type !== "number") {
      inp.type = "number"; inp.min = "2020"; inp.max = "2100"; inp.placeholder = "2030";
      inp.value = /^\d{4}$/.test(valor) ? valor : (valor ? valor.slice(0, 4) : "");
    }
  }

  // Só metas de horizonte MAIOR podem ser pai — é o que mantém o mapa de pé.
  function montaPais(){
    const meu = nivel($("#gHorizonte").value);
    const candidatas = db.metas
      .filter(m => m.id !== rascunho.id && nivel(m.horizonte) < meu)
      .sort((a, b) => nivel(a.horizonte) - nivel(b.horizonte));
    const sel = $("#gPai");
    sel.innerHTML = "";
    sel.appendChild(el("option", { value: "", texto: candidatas.length ? "— nenhuma (é uma meta raiz) —" : "— nenhuma meta maior cadastrada —" }));
    for (const m of candidatas) sel.appendChild(el("option", { value: m.id, texto: horizonte(m.horizonte).nome + " · " + m.titulo }));
    sel.value = rascunho.paiId && candidatas.some(c => c.id === rascunho.paiId) ? rascunho.paiId : "";
  }

  function ajustaMedida(){
    const tipo = $("#gTipoMedida").value;
    $("#blocoNumero").classList.toggle("oculto", tipo !== "numero");
    $("#blocoMarcos").classList.toggle("oculto", tipo !== "marcos");
  }

  function renderStatus(){
    const box = $("#gStatus");
    box.innerHTML = "";
    for (const st of STATUS) {
      box.appendChild(el("button", {
        type: "button", texto: st.nome, "aria-pressed": String(rascunho.status === st.id),
        onclick: () => { rascunho.status = st.id; renderStatus(); }
      }));
    }
  }

  function renderMarcos(){
    const ul = $("#gMarcosLista");
    ul.innerHTML = "";
    const feitos = rascunho.marcos.filter(x => x.ok).length;
    $("#gMarcosResumo").textContent = rascunho.marcos.length ? "— " + feitos + "/" + rascunho.marcos.length : "";
    $("#gMarcosBarra").firstElementChild.style.width = (rascunho.marcos.length ? Math.round(feitos / rascunho.marcos.length * 100) : 0) + "%";
    for (const item of rascunho.marcos) {
      const box = el("button", {
        type: "button", class: "kcheck" + (item.ok ? " marcado" : ""), "aria-label": "Concluir marco",
        html: '<svg viewBox="0 0 24 24" fill="none" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
        onclick: () => { item.ok = !item.ok; renderMarcos(); }
      });
      const del = el("button", {
        type: "button", class: "icon del", "aria-label": "Remover marco",
        html: svg('<path d="M18 6L6 18M6 6l12 12"/>', 14),
        onclick: () => { rascunho.marcos = rascunho.marcos.filter(x => x.id !== item.id); renderMarcos(); }
      });
      ul.appendChild(el("li", { class: "chk-item" + (item.ok ? " ok" : "") }, [box, el("span", { texto: item.txt }), del]));
    }
  }

  function renderFilhos(){
    const box = $("#gFilhos");
    box.innerHTML = "";
    const lista = editandoId ? filhos(editandoId) : [];
    $("#blocoFilhos").classList.toggle("oculto", !lista.length);
    for (const f of lista) {
      box.appendChild(el("button", {
        type: "button", class: "filho-item",
        onclick: () => { modal.close(); abrirMeta(f.id); }
      }, [
        el("span", { class: "h", texto: horizonte(f.horizonte).nome }),
        el("span", { class: "t", texto: f.titulo }),
        el("span", { class: "pilula st-" + f.status, texto: nomeStatus(f.status) })
      ]));
    }
  }

  function renderHistorico(){
    const box = $("#gHistorico");
    box.innerHTML = "";
    const linhas = db.revisoes
      .filter(r => r.itens && r.itens[editandoId])
      .sort((a, b) => b.mes.localeCompare(a.mes));
    $("#blocoHistorico").classList.toggle("oculto", !linhas.length);
    for (const r of linhas) {
      const it = r.itens[editandoId];
      const corpo = el("div", { class: "lt-corpo" }, [
        el("div", { texto: nomeStatus(it.status) + (it.valor != null ? " · " + fmtNum(it.valor, rascunho.medida.unidade) : "") })
      ]);
      if (it.nota) corpo.appendChild(el("div", { class: "nota", texto: it.nota }));
      box.appendChild(el("div", { class: "lt-item" }, [
        el("div", { class: "lt-mes", texto: rotuloMesCurto(r.mes) }), corpo
      ]));
    }
  }

  $("#gHorizonte").addEventListener("change", () => { ajustaPrazo(); montaPais(); });
  $("#gTipoMedida").addEventListener("change", ajustaMedida);
  $("#gMarcoAdd").addEventListener("click", addMarco);
  $("#gMarcoNovo").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addMarco(); } });
  function addMarco(){
    const inp = $("#gMarcoNovo");
    const v = inp.value.trim();
    if (!v) return;
    rascunho.marcos.push({ id: uid(), txt: v, ok: false });
    inp.value = ""; renderMarcos(); inp.focus();
  }

  $("#gFechar").addEventListener("click", () => modal.close());
  $("#gCancelar").addEventListener("click", () => modal.close());
  $("#gSalvar").addEventListener("click", salvarMeta);
  $("#gExcluir").addEventListener("click", () => {
    const m = meta(editandoId);
    if (!m) return modal.close();
    const n = filhos(m.id).length;
    if (!confirm('Excluir a meta "' + m.titulo + '"?' + (n ? "\n\nAs " + n + " metas que puxam dela ficam sem ligação." : ""))) return;
    db.metas = db.metas.filter(x => x.id !== m.id);
    for (const f of db.metas) if (f.paiId === m.id) f.paiId = null;
    salvar(); modal.close(); render();
  });

  function salvarMeta(){
    const titulo = $("#gTitulo").value.trim();
    if (!titulo) { $("#gTitulo").focus(); return; }
    const tipo = $("#gTipoMedida").value;
    const antes = meta(editandoId);

    const nova = Object.assign({}, rascunho, {
      titulo,
      detalhe: $("#gDetalhe").value.trim(),
      horizonte: $("#gHorizonte").value,
      areaId: $("#gArea").value,
      paiId: $("#gPai").value || null,
      prazo: $("#gPrazo").value || "",
      status: rascunho.status,
      medida: {
        tipo,
        inicio: tipo === "numero" ? parseNum($("#gInicio").value) : null,
        alvo:   tipo === "numero" ? parseNum($("#gAlvo").value) : null,
        atual:  tipo === "numero" ? (rascunho.medida.atual != null ? rascunho.medida.atual : parseNum($("#gInicio").value)) : null,
        unidade: tipo === "numero" ? $("#gUnidade").value.trim() : ""
      }
    });
    if (nova.status === "concluida" && (!antes || antes.status !== "concluida")) nova.concluidaEm = new Date().toISOString();
    if (nova.status !== "concluida") nova.concluidaEm = null;

    if (antes) Object.assign(antes, nova);
    else db.metas.push(nova);
    salvar(); modal.close(); render();
  }

  // ── Revisão mensal ──────────────────────────────────────────────────
  const modalRev = $("#modalRevisao");
  let revAberta = null;      // { mes, itens:{}, funcionou, travou, foco, novo:bool }

  function revisaoDe(mes){ return db.revisoes.find(r => r.mes === mes) || null; }
  // Reabrir uma revisão antiga é para consultar e corrigir o registro daquele mês —
  // ela não pode puxar os números das metas de volta para trás.
  function comandaAsMetas(mes){ return !db.revisoes.some(r => r.mes > mes); }

  function abrirRevisao(mes){
    const existente = revisaoDe(mes);
    const ehMesCorrente = mes === mesAtual();
    revAberta = existente
      ? JSON.parse(JSON.stringify(existente))
      : { id: uid(), mes, criadaEm: new Date().toISOString(), atualizadaEm: null, itens: {}, funcionou: "", travou: "", foco: "" };
    revAberta.novo = !existente;

    $("#rTitulo").textContent = "Revisão de " + rotuloMes(mes);
    const manda = comandaAsMetas(mes);
    const quando = existente ? "Salva em " + new Date(existente.atualizadaEm || existente.criadaEm).toLocaleDateString("pt-BR") + ". " : "";
    $("#rSub").textContent = manda
      ? quando + (ehMesCorrente ? "Meta a meta: atualize o número, diga como está e siga." : "Salvar aqui atualiza os números das metas.")
      : quando + "Mês já revisado depois — salvar aqui corrige só o registro, não mexe nos números atuais.";
    $("#rExcluir").classList.toggle("oculto", !existente);

    montaCorpoRevisao();
    modalRev.showModal();
  }

  function montaCorpoRevisao(){
    const corpo = $("#rCorpo");
    corpo.innerHTML = "";

    // do curto para o longo: o mês é o que mais muda, o 10 anos quase não muda
    const ordem = [...HORIZONTES].reverse();
    const ativas = db.metas.filter(m => m.status !== "concluida" || (revAberta.itens[m.id]));
    if (!ativas.length) {
      corpo.appendChild(el("div", { class: "vazio", html: "<b>Nenhuma meta cadastrada</b>Crie as metas no mapa para poder revisá-las." }));
      return;
    }

    for (const h of ordem) {
      const doNivel = ativas.filter(m => m.horizonte === h.id);
      if (!doNivel.length) continue;
      const grupo = el("div", { class: "rev-grupo" }, [el("h4", { texto: h.nome })]);
      for (const m of doNivel) grupo.appendChild(blocoRevisao(m));
      corpo.appendChild(grupo);
    }

    const fecho = el("div", { class: "rev-fecho" });
    fecho.appendChild(campoTexto("O que funcionou neste mês", "rFuncionou", revAberta.funcionou, "O que andou, o que deu certo, o que repetir."));
    fecho.appendChild(campoTexto("O que travou", "rTravou", revAberta.travou, "Onde você empacou e por quê."));
    fecho.appendChild(campoTexto("Foco do mês que vem", "rFoco", revAberta.foco, "Se só uma coisa andar no mês que vem, que seja o quê?"));
    corpo.appendChild(fecho);
  }

  function campoTexto(rotulo, id, valor, dica){
    const ta = el("textarea", { id, placeholder: dica });
    ta.value = valor || "";
    return el("div", { class: "campo" }, [el("label", { for: id, texto: rotulo }), ta]);
  }

  function blocoRevisao(m){
    const a = area(m.areaId);
    const item = revAberta.itens[m.id] || {};
    const ultima = ultimoValor(m.id, revAberta.mes);

    const cab = el("div", { class: "cab" }, [el("span", { class: "t", texto: m.titulo })]);
    if (m.medida.tipo === "numero" && m.medida.alvo != null) {
      cab.appendChild(el("span", { class: "alvo", texto: "alvo: " + fmtNum(m.medida.alvo, m.medida.unidade) }));
    }
    if (m.medida.tipo === "marcos" && m.marcos.length) {
      cab.appendChild(el("span", { class: "alvo", texto: m.marcos.filter(x => x.ok).length + "/" + m.marcos.length + " marcos" }));
    }

    const bloco = el("div", { class: "rev-meta", style: "--cor-area:" + a.cor }, [cab]);
    bloco.dataset.id = m.id;

    const campos = el("div", { class: "rev-campos" + (m.medida.tipo === "numero" ? "" : " sem-numero") });
    if (m.medida.tipo === "numero") {
      const inp = el("input", { type: "text", inputmode: "decimal", class: "rev-valor",
        placeholder: m.medida.unidade || "valor" });
      // Num mês antigo, só mostra o que foi registrado naquele mês: puxar o número
      // de hoje para um mês passado inventaria histórico.
      const padrao = comandaAsMetas(revAberta.mes) && m.medida.atual != null ? m.medida.atual : "";
      inp.value = item.valor != null ? item.valor : padrao;
      campos.appendChild(inp);
    }
    const nota = el("input", { type: "text", class: "rev-nota", placeholder: "O que aconteceu com essa meta no mês…" });
    nota.value = item.nota || "";
    campos.appendChild(nota);
    bloco.appendChild(campos);

    if (ultima != null && m.medida.tipo === "numero") {
      bloco.appendChild(el("div", { class: "meta-numeros" }, [
        el("span", { texto: "na revisão anterior: " + fmtNum(ultima.valor, m.medida.unidade) + " (" + rotuloMesCurto(ultima.mes) + ")" })
      ]));
    }

    const stBox = el("div", { class: "rev-status" });
    const atual = item.status || m.status;
    for (const st of STATUS) {
      stBox.appendChild(el("button", {
        type: "button", texto: st.nome, class: "st-op", "aria-pressed": String(atual === st.id),
        onclick: (e) => {
          for (const b of stBox.children) b.setAttribute("aria-pressed", "false");
          e.currentTarget.setAttribute("aria-pressed", "true");
        }
      }));
    }
    bloco.appendChild(stBox);
    return bloco;
  }

  function ultimoValor(metaId, mes){
    const antes = db.revisoes
      .filter(r => r.mes < mes && r.itens[metaId] && r.itens[metaId].valor != null)
      .sort((a, b) => b.mes.localeCompare(a.mes))[0];
    return antes ? { valor: antes.itens[metaId].valor, mes: antes.mes } : null;
  }

  $("#rFechar").addEventListener("click", () => modalRev.close());
  $("#rCancelar").addEventListener("click", () => modalRev.close());
  $("#rExcluir").addEventListener("click", () => {
    if (!confirm("Excluir a revisão de " + rotuloMes(revAberta.mes) + "? O histórico dela some.")) return;
    db.revisoes = db.revisoes.filter(r => r.mes !== revAberta.mes);
    salvar(); modalRev.close(); render();
  });

  // Salvar a revisão faz duas coisas: guarda o registro do mês E move as metas.
  $("#rSalvar").addEventListener("click", () => {
    const itens = {};
    const manda = comandaAsMetas(revAberta.mes);
    for (const bloco of $$("#rCorpo .rev-meta")) {
      const m = meta(bloco.dataset.id);
      if (!m) continue;
      const inpValor = bloco.querySelector(".rev-valor");
      const valor = inpValor ? parseNum(inpValor.value) : null;
      const marcado = [...bloco.querySelectorAll(".rev-status button")].find(b => b.getAttribute("aria-pressed") === "true");
      const status = marcado ? STATUS[[...bloco.querySelectorAll(".rev-status button")].indexOf(marcado)].id : m.status;
      const nota = bloco.querySelector(".rev-nota").value.trim();
      itens[m.id] = { valor, status, nota };

      if (manda) {
        if (valor != null) m.medida.atual = valor;
        if (status !== m.status) {
          m.status = status;
          m.concluidaEm = status === "concluida" ? new Date().toISOString() : null;
        }
      }
    }
    const rev = {
      id: revAberta.id, mes: revAberta.mes,
      criadaEm: revAberta.criadaEm, atualizadaEm: new Date().toISOString(),
      itens,
      funcionou: $("#rFuncionou").value.trim(),
      travou: $("#rTravou").value.trim(),
      foco: $("#rFoco").value.trim()
    };
    db.revisoes = db.revisoes.filter(r => r.mes !== rev.mes).concat(rev).sort((a, b) => a.mes.localeCompare(b.mes));
    salvar(); modalRev.close(); render();
    toast("Revisão de " + rotuloMes(rev.mes) + " salva.");
  });

  // ── Barra ───────────────────────────────────────────────────────────
  $("#selArea").addEventListener("change", (e) => { filtroArea = e.target.value; render(); });
  $("#btnNovaMeta").addEventListener("click", () => abrirMeta(null, "mes"));

  document.addEventListener("dados:importados", () => { db = normaliza(ler(KEY, null)); render(); });

  render();
})();
