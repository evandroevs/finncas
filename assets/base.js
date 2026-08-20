/* ══════════════════════════════════════════════════════════════════════
   base.js — utilidades compartilhadas pelas duas abas
   Expõe window.App. Script clássico (funciona até abrindo o arquivo direto).
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";

  const $  = (s, raiz) => (raiz || document).querySelector(s);
  const $$ = (s, raiz) => [...(raiz || document).querySelectorAll(s)];

  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function ler(chave, padrao){
    try {
      const raw = localStorage.getItem(chave);
      return raw ? JSON.parse(raw) : padrao;
    } catch { return padrao; }
  }
  function gravar(chave, valor){ localStorage.setItem(chave, JSON.stringify(valor)); }

  function toast(msg){
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("on"), 2400);
  }

  // Cria elementos sem colar HTML de texto do usuário (evita quebrar layout/injeção).
  function el(tag, props, filhos){
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (k === "class") n.className = v;
      else if (k === "texto") n.textContent = v;
      else if (k === "html") n.innerHTML = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v);
    }
    for (const f of [].concat(filhos || [])) if (f) n.appendChild(f);
    return n;
  }
  const svg = (d, tam) =>
    '<svg width="' + (tam || 14) + '" height="' + (tam || 14) + '" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + "</svg>";

  // ── Tema (claro / escuro) ───────────────────────────────────────────
  const TEMA_KEY = "painel.tema";
  const SOL = svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', 16);
  const LUA = svg('<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>', 16);

  function aplicaTema(){
    const salvo = localStorage.getItem(TEMA_KEY);
    const escuro = salvo ? salvo === "escuro" : matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.tema = escuro ? "escuro" : "claro";
    const b = $("#btnTema");
    b.innerHTML = escuro ? SOL : LUA;
    b.title = escuro ? "Mudar para o tema claro" : "Mudar para o tema escuro";
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", escuro ? "#1a1b21" : "#f3f4f8");
  }
  $("#btnTema").addEventListener("click", () => {
    localStorage.setItem(TEMA_KEY, document.documentElement.dataset.tema === "escuro" ? "claro" : "escuro");
    aplicaTema();
  });
  // enquanto o usuário não escolher, acompanha o sistema em tempo real
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (!localStorage.getItem(TEMA_KEY)) aplicaTema();
  });
  aplicaTema();

  // ── Abas ────────────────────────────────────────────────────────────
  const ABA_KEY = "painel.aba";
  function abrirAba(nome){
    $$("#tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === nome)));
    $("#tab-contas").classList.toggle("oculto", nome !== "contas");
    $("#tab-quadros").classList.toggle("oculto", nome !== "quadros");
    localStorage.setItem(ABA_KEY, nome);
    document.dispatchEvent(new CustomEvent("aba:mudou", { detail: nome }));
  }
  $("#tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-tab]");
    if (b) abrirAba(b.dataset.tab);
  });

  // ── Backup (contas + quadros no mesmo arquivo) ──────────────────────
  const CHAVES = { contas: "financas.v1", quadros: "quadros.v1" };

  function exportar(){
    const dados = { versao: 2, contas: ler(CHAVES.contas, null), quadros: ler(CHAVES.quadros, null) };
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    const d = new Date();
    a.href = URL.createObjectURL(blob);
    a.download = "painel-backup-" + d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function importar(texto){
    let d;
    try { d = JSON.parse(texto); } catch { toast("Arquivo inválido."); return; }
    if (!d || typeof d !== "object") { toast("Arquivo inválido."); return; }

    // Formato antigo (só contas): { fixas, meses }
    const ehAntigo = d.meses && !d.contas && !d.quadros;
    const contas  = ehAntigo ? d : d.contas;
    const quadros = ehAntigo ? null : d.quadros;
    if (!contas && !quadros) { toast("Arquivo inválido."); return; }

    const oque = [contas && "contas", quadros && "quadros"].filter(Boolean).join(" e ");
    if (!confirm("Isso substitui " + oque + " deste navegador. Continuar?")) return;

    if (contas)  gravar(CHAVES.contas, contas);
    if (quadros) gravar(CHAVES.quadros, quadros);
    document.dispatchEvent(new CustomEvent("dados:importados"));
    toast("Backup importado.");
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-backup]");
    if (!b) return;
    if (b.dataset.backup === "exportar") exportar();
    else $("#fileImport").click();
  });
  $("#fileImport").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => importar(r.result);
    r.readAsText(file);
    e.target.value = "";
  });

  // ── Arrastar (mouse + toque) ────────────────────────────────────────
  // Move o elemento real no DOM enquanto arrasta; ao soltar, a ordem é lida
  // de volta do DOM. Evita conta de índices e mantém o visual sempre correto.
  function arrastavel(opts){
    // opts: { alca, elemento, container, alvo(x,y), posicionar(el,x,y,alvo), soltou() }
    let ativo = false, timer = null, ghost = null, el0 = null, dx = 0, dy = 0, x0 = 0, y0 = 0, toque = false;

    function bloqueiaScroll(ev){ ev.preventDefault(); }

    function comecar(ev){
      ativo = true;
      toque = ev.pointerType === "touch";
      const r = el0.getBoundingClientRect();
      dx = ev.clientX - r.left; dy = ev.clientY - r.top;
      ghost = el0.cloneNode(true);
      ghost.classList.add("fantasma");
      ghost.style.width = r.width + "px";
      ghost.style.height = r.height + "px";
      document.body.appendChild(ghost);
      el0.classList.add("arrastando");
      document.body.classList.add("arrastando");
      document.addEventListener("touchmove", bloqueiaScroll, { passive: false });
      mover(ev);
    }

    function mover(ev){
      ghost.style.left = (ev.clientX - dx) + "px";
      ghost.style.top  = (ev.clientY - dy) + "px";
      opts.posicionar(el0, ev.clientX, ev.clientY);
      autoScroll(ev.clientX);
    }

    // rola o board quando o dedo/mouse chega perto da borda
    function autoScroll(x){
      const c = opts.container();
      if (!c) return;
      const r = c.getBoundingClientRect();
      const margem = 70;
      if (x < r.left + margem) c.scrollLeft -= 14;
      else if (x > r.right - margem) c.scrollLeft += 14;
    }

    function terminar(){
      clearTimeout(timer);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", terminar);
      document.removeEventListener("pointercancel", terminar);
      document.removeEventListener("touchmove", bloqueiaScroll);
      if (ativo) {
        ghost.remove();
        el0.classList.remove("arrastando");
        document.body.classList.remove("arrastando");
        opts.soltou();
      }
      ativo = false; ghost = null; el0 = null;
    }

    function onMove(ev){
      if (ativo) { ev.preventDefault(); mover(ev); return; }
      const dist = Math.hypot(ev.clientX - x0, ev.clientY - y0);
      if (toque) { if (dist > 10) terminar(); }   // rolou antes do long-press: cancela
      else if (dist > 4) comecar(ev);
    }

    return function onPointerDown(ev, elemento){
      if (ev.button != null && ev.button !== 0) return;
      el0 = elemento; x0 = ev.clientX; y0 = ev.clientY;
      toque = ev.pointerType === "touch";
      document.addEventListener("pointermove", onMove, { passive: false });
      document.addEventListener("pointerup", terminar);
      document.addEventListener("pointercancel", terminar);
      if (toque) timer = setTimeout(() => { if (el0) comecar(ev); }, 230); // long-press
    };
  }

  window.App = { $, $$, uid, ler, gravar, toast, el, svg, abrirAba, arrastavel, CHAVES };

  document.addEventListener("DOMContentLoaded", () => {
    abrirAba(localStorage.getItem(ABA_KEY) === "quadros" ? "quadros" : "contas");
  });
})();
