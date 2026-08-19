# Contas do Mês

App simples de contas mensais. Um arquivo só (`index.html`), sem build e sem dependências.

## Como usar

Abrir direto:

```bash
open financas/index.html
```

Ou rodar um servidor local (recomendado, garante o salvamento):

```bash
python3 -m http.server 4321 --directory financas
```

## O que faz

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

## Onde ficam os dados

No `localStorage` do navegador (chave `financas.v1`), neste computador/navegador.
Não sincroniza entre dispositivos — use **Exportar backup** / **Importar backup** (arquivo `.json`) para mover ou guardar.

Para acessar do celular e do computador com os mesmos dados, seria preciso ligar num banco (ex: Supabase).
