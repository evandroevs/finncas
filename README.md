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
  - prazo (fica amarelo no dia e vermelho quando atrasa),
  - checklist com barra de progresso,
  - troca de coluna,
  - excluir.
  O quadradinho no card marca como concluída sem abrir nada.
- **Arrastar** — com mouse, arraste o card direto. No celular, **segure** o card por um instante
  e arraste; rolar a tela normalmente não dispara o arrasto. A tela rola sozinha ao chegar na borda.
- **Buscar** — filtra os cards do quadro por título, descrição ou item de checklist.

## Onde ficam os dados

No `localStorage` do navegador — `financas.v1` (contas) e `quadros.v1` (atividades) — neste
computador/navegador. Não sincroniza entre dispositivos: use **Exportar backup** / **Importar backup**,
que geram um `.json` único com as duas abas. Backups antigos, só de contas, continuam sendo aceitos.

Para acessar do celular e do computador com os mesmos dados, seria preciso ligar num banco (ex: Supabase).
