# Painel — Contas, Atividades e Metas

Três abas, sem build e sem dependências: **Contas** (checklist de contas por mês),
**Atividades** (quadros estilo Trello, um por empresa) e **Metas** (o mapa do projeto de vida,
com revisão mensal).

## Como usar

```bash
python3 -m http.server 4321 --directory financas
```

Depois abrir http://localhost:4321. Também funciona abrindo o `index.html` direto, mas
com servidor o salvamento é mais confiável.

## Tema

Botão de sol/lua no cabeçalho alterna entre **claro** e **escuro**. Enquanto você não escolher,
o app segue o tema do sistema; depois do primeiro clique, a escolha fica salva (`painel.tema`).
O tema é aplicado por um script no `<head>`, antes da primeira pintura, então não pisca ao abrir.

A cor de destaque é índigo/roxo (`#7c6cff` no escuro, `#5a49e8` no claro) — funciona bem sobre
fundo escuro e sobre branco. O verde ficou reservado só para o que está concluído: conta paga,
card feito e item de checklist.

## Arquivos

```
index.html        estrutura das duas abas
assets/app.css    paleta e estilos
assets/base.js    utilidades: abas, backup, motor de arrastar
assets/contas.js  aba Contas
assets/quadros.js aba Atividades (kanban)
assets/metas.js   aba Metas (mapa de horizontes + revisão)
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

## Aba Metas

O mapa vai do horizonte mais longo ao mais curto: **10 anos · 5 anos · 3 anos · 1 ano ·
semestre · trimestre · mês**. Cada faixa é um horizonte, e cada meta mora em uma faixa.

O que amarra tudo é o campo **"puxa de qual meta maior"**: a meta do mês puxa da trimestral,
que puxa da anual, que puxa da de 3 anos, e assim por diante. Passar o mouse em qualquer meta
acende a linhagem inteira — de onde ela veio e o que depende dela — e apaga o resto. É isso que
faz o conjunto ser um mapa e não sete listas soltas.

Cada meta tem:

- **área da vida** (financeiro, negócio, saúde, família, aprendizado, pessoal) — a cor da borda;
- **por que essa meta importa** — o texto que segura o plano nos meses difíceis;
- **prazo** — mês/ano nos horizontes curtos, só o ano nos longos; fica vermelho se passar;
- **como medir**: número (de X até Y, com unidade), marcos (lista de etapas) ou só acompanhar;
- **status**: no rumo, atenção, travada ou concluída.

### A revisão mensal

O aviso no topo da aba diz se a revisão do mês está pendente. A revisão passa **meta a meta,
do mês para o 10 anos** — a ordem importa: o curto prazo é o que muda toda hora. Em cada meta
você atualiza o número, escreve o que aconteceu e escolhe o status; quando existe registro
anterior, ela mostra `na revisão anterior: R$ 640.000 (jul/26)` para você ver o movimento.
No fim, três perguntas: o que funcionou, o que travou e qual o foco do mês que vem.

Salvar faz duas coisas: guarda o registro daquele mês e **move as metas** (o número vira o
atual, o status vira o status). Toda revisão fica no histórico — na barra do topo e dentro de
cada meta, em ordem de tempo.

Duas regras para o histórico não virar ficção: reabrir um mês que já foi revisado depois
corrige só o registro daquele mês, sem puxar os números atuais para trás; e num mês antigo os
campos vêm em branco, mostrando só o que foi de fato registrado na época.

## Onde ficam os dados

No `localStorage` do navegador — `financas.v1` (contas), `quadros.v1` (atividades) e `metas.v1`
(metas e revisões) — neste computador/navegador. Não sincroniza entre dispositivos: use
**Exportar backup** / **Importar backup**, que geram um `.json` único com as três abas.
Backups antigos, de versões com menos abas, continuam sendo aceitos.

Para acessar do celular e do computador com os mesmos dados, seria preciso ligar num banco (ex: Supabase).
