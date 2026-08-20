# Painel — Contas e Atividades

Duas abas, sem build e sem dependências: **Contas** (checklist de contas por mês) e
**Atividades** (quadros estilo Trello, um por empresa).

## Como usar

```bash
python3 -m http.server 4321 --directory financas
```

Depois abrir http://localhost:4321. Também funciona abrindo o `index.html` direto, mas
com servidor o salvamento é mais confiável.

## Arquivos

```
index.html        estrutura das duas abas
assets/app.css    paleta e estilos
assets/base.js    utilidades: abas, backup, motor de arrastar
assets/contas.js  aba Contas
assets/quadros.js aba Atividades (kanban)
```

## Aba Contas

- **Navegação por mês** — setas ‹ › ou clique no nome do mês para escolher qualquer mês/ano.
- **Checklist** — clique no quadrado para marcar como paga. Riscado + barra de progresso.
- **Descrição** — campo opcional em cada conta (onde pagar, número do contrato, observação).
- **Repetição** — no seletor ao adicionar:
  - `Só este mês` — lançamento avulso;
  - `Todo mês (sempre)` — conta fixa, aparece sozinha em todos os meses seguintes;
  - `N meses (Nx)` — parcelado: cria a conta de uma vez nos N meses, numerada `1/N`, `2/N`…
- **Editar** uma conta fixa ou uma parcela vale também para os meses seguintes; os meses já passados
  ficam como estão. **Excluir** pergunta se é só naquele mês ou dali em diante.
- **Copiar contas do mês anterior** — traz as contas do mês passado (sem duplicar o que já existe), todas desmarcadas.
- **Atrasadas** — contas não pagas com vencimento já passado ficam com borda vermelha.
- **Valores** — aceita `1.234,56`, `1234,56` ou `1234.56`.

## Aba Atividades

- **Quadros** — um por empresa. Criar, renomear e excluir na barra de cima; troca pelo seletor.
  Todo quadro novo já nasce com as colunas `A fazer`, `Fazendo` e `Feito`.
- **Colunas** — adicionar no fim do quadro, renomear clicando no nome, excluir no ícone de lixeira
  (avisa quantos cards vão junto). Reordenar arrastando pela alça ⠿ do cabeçalho.
- **Cards** — adicionar no fim da coluna. Clicar abre o detalhe com:
  - descrição,
  - **dia, hora e duração** (sem hora = compromisso de dia inteiro),
  - lembrete (10 min a 1 dia antes),
  - checklist com barra de progresso,
  - troca de coluna,
  - excluir.
  O quadradinho no card marca como concluída sem abrir nada. O card mostra `25 ago · 14:30`,
  amarelo no dia e vermelho quando passa da hora.
- **Google Agenda** — o botão no detalhe do card abre o Google Agenda já preenchido
  (título, dia, hora, duração e a descrição com o checklist). Funciona sem login e sem API.
- **Arrastar** — com mouse, arraste o card direto. No celular, **segure** o card por um instante
  e arraste; rolar a tela normalmente não dispara o arrasto. A tela rola sozinha ao chegar na borda.
- **Buscar** — filtra os cards do quadro por título, descrição ou item de checklist.

## Agenda do card e o Google Agenda

O card guarda a agenda no formato que a API do Google Calendar espera, para a sincronização
automática ser só o último passo:

```js
card.agenda = {
  data: "2026-08-25",        // null = sem data
  hora: "14:30",             // null = dia inteiro
  duracaoMin: 90,
  fuso: "America/Sao_Paulo", // pego do próprio aparelho
  lembreteMin: 30            // null = sem lembrete
}
card.google = {
  eventId: null,             // id do evento lá no Google
  calendarId: null,
  sincronizadoEm: null,
  hash: "…"                  // assinatura do que virou evento
}
```

`App.eventoGoogle(card)` devolve o corpo pronto de um `events.insert`, incluindo
`extendedProperties.private.painelCardId` — é por esse campo que a sincronização reencontra
qual card corresponde a qual evento. O `hash` é a assinatura dos campos que viram evento
(título, descrição, agenda, checklist): se ele diferir do atual, o evento no Google está velho
e precisa de `events.patch`.

Para ligar de verdade, o que falta é: um projeto no Google Cloud com a Calendar API ativada,
OAuth com o escopo `https://www.googleapis.com/auth/calendar.events`, e guardar o refresh token
fora do navegador (uma edge function do Supabase, como já é feito com o Google Ads).

## Onde ficam os dados

No `localStorage` do navegador — `financas.v1` (contas) e `quadros.v1` (atividades) — neste
computador/navegador. Não sincroniza entre dispositivos: use **Exportar backup** / **Importar backup**,
que geram um `.json` único com as duas abas. Backups antigos, só de contas, continuam sendo aceitos.

Para acessar do celular e do computador com os mesmos dados, seria preciso ligar num banco (ex: Supabase).
