# Máscara de Moeda e Formato de Data — Implementation Plan

**Goal:** Aplicar máscara de moeda BR (R$) em tempo real nos inputs de valor dos modais Serviço/Material, e exibir datas em `dd/mm/yyyy` nas listas de pagamentos (sem instalar pacotes novos).

**Architecture:** Helpers puros (`maskCurrency`, `parseMasked`, `fmtDate`) inlined no topo de `page.tsx`. Inputs monetários migram de `type="number"` (string numérica) para `type="text" inputMode="numeric"` com estado-string formatado ("R$ 1.500,00"). Parse para `number` no momento do envio à API. Inputs de data continuam `type="date"` (yyyy-mm-dd nativo); apenas as exibições de leitura formatam para `dd/mm/yyyy`.

**Tech Stack:** Next.js 14 App Router · TypeScript · Tailwind CSS · React (client component)

---

## Context

### What We're Building
Melhoria de UX em formulários de cadastro de Serviços e Materiais dentro da página de obra. Hoje o usuário digita "1500" e vê "1500" — queremos que veja "R$ 15,00" enquanto digita (modelo "centavos crescendo da direita"), exibindo "R$ 1.500,00" ao chegar em `150000`. Em paralelo, datas em listas de pagamentos hoje aparecem como `2026-06-19` e devem aparecer como `19/06/2026`.

### Requirements
- [ ] REQ-1: Helpers `maskCurrency(raw: string): string`, `parseMasked(masked: string): number` e `fmtDate(iso: string): string` definidos uma única vez no topo de `src/app/obras/[obraId]/page.tsx`.
- [ ] REQ-2: Invariante de round-trip — `parseMasked(maskCurrency(String(Math.round(v*100)))) === v` para `v` com até 2 casas decimais.
- [ ] REQ-3: `ModalServico` — input `valorTotal` (linha 92) e input `nVal` (linha 107) usam a máscara; payload enviado à API continua `valorTotal: number` em reais (ex: `1500`) e `pagamentos[].valor: number`.
- [ ] REQ-4: `ModalMaterial` — input `valorTotal` (linha 176) e input `fVal` (linha 198) usam a máscara; payload continua `valorTotal: number` e `formasPagamento[].valor: number`. Cálculo de `falta` (linha 137) derivado do estado-string via `parseMasked`.
- [ ] REQ-5: Modo edição — ao abrir modal com `initial`, o estado-string inicial é a versão mascarada do `initial.valorTotal` (sem drift de float, usando `Math.round(v*100)`).
- [ ] REQ-6: Lista de pagamentos dentro do `ModalServico` (linha 99, `{p.data}`) exibe `dd/mm/yyyy`.
- [ ] REQ-7: Lista de pagamentos no card expandido (linha 426, `{p.data.slice(0,10)}`) exibe `dd/mm/yyyy`.
- [ ] REQ-8: Inputs `type="date"` (linhas 51, 108) permanecem como estão (nativos, yyyy-mm-dd no value, exibição localizada pelo browser).
- [ ] REQ-9: API continua recebendo `valorTotal: number` (reais como float, ex `1500.5`) e `data: string` em `yyyy-mm-dd`. Nenhuma rota em `src/app/api/` é alterada.

### Out of Scope
- Instalação de bibliotecas externas (react-number-format, imask, etc.).
- Testes automatizados — projeto não tem infra de testes (ver `CLAUDE.md`: "No lint or test scripts are configured").
- Refactor dos modais em componentes separados.
- Mudança em outros formulários fora dos dois modais alvo.
- Alteração na função `fmt(v)` existente (linha 17) — continua sendo usada para exibição.
- Internacionalização (i18n).

### Key Decisions

**1. Modelo de estado: string-state (formatada).**
Estado interno `valorTotal: string` armazena a forma já mascarada (`"R$ 1.500,00"`). No `save()` aplicamos `parseMasked` para obter o `number`. Razão: idiomático para inputs controlados, sem flicker de cursor, sem float-math em edição.

**2. Tipo de input: `type="text"` + `inputMode="numeric"`.**
`type="number"` rejeita os caracteres `R$`, `.` e `,` — o mask não renderiza. Trocamos para `text` com `inputMode="numeric"` que preserva o teclado numérico no mobile.

**3. Algoritmo da máscara: "centavos crescendo da direita".**
A função `maskCurrency` extrai apenas dígitos, normaliza como inteiro de centavos e formata via `toLocaleString("pt-BR", {minimumFractionDigits:2})` com prefixo `R$`. Usuário digita `150000` → vê `R$ 1.500,00`. Apaga 1 char no fim → vira `R$ 150,00`. Sem necessidade de gerenciar posição do cursor (o cursor naturalmente fica no final, comportamento esperado em mask de moeda).

**4. Cap de centavos.**
Limitar a 13 dígitos (até R$ 99.999.999.999,99). Evita overflow visual em obras hipotéticas e bug de `Number` em valores absurdos. Implementação: `digits.slice(0, 13)` dentro de `maskCurrency`.

**5. Helpers inline em `page.tsx`.**
Constraint do usuário: mudanças apenas em `src/app/obras/[obraId]/page.tsx`. Adicionamos as 3 funções helper logo após o `fmt(v)` existente (linha 19).

**6. Data: helper puro `fmtDate(iso: string): string`.**
Recebe string `yyyy-mm-dd` (ou ISO completo) e retorna `dd/mm/yyyy`. Implementação por split manual (não `new Date()`, que sofre de bug de timezone em datas puras). Se input inválido, retorna o input cru (degradação silenciosa).

**7. Classificação: scaffold.**
Sem infra de testes no projeto. Tarefas são alterações de UI deterministas com helpers puros. TDD formal seria scope creep. Usamos checklist manual de verificação ao final.

**8. Wave única.**
Mudança pequena, mesmo arquivo, sem fronteiras independentes de deploy. Uma wave, duas tasks (helpers + ModalServico no mesmo bloco lógico; ModalMaterial + exibições de data em outro) para manter atomicidade revisável.

---

## File Structure
- Modify: `/Users/dayvissonsoares/Documents/Projects/orce-obras/src/app/obras/[obraId]/page.tsx` — adicionar helpers, atualizar inputs dos 2 modais, atualizar 2 exibições de data.

Nenhum arquivo criado. Nenhuma rota de API alterada. Nenhum pacote npm adicionado.

---

## Wave 1: Máscara de moeda + formato de data

### Task 1: Helpers + ModalServico [type: scaffold]

**Files:** `/Users/dayvissonsoares/Documents/Projects/orce-obras/src/app/obras/[obraId]/page.tsx`
**Reqs:** REQ-1, REQ-2, REQ-3, REQ-5, REQ-6, REQ-8

#### Passos

- [x] **1.1** Adicionar 3 helpers logo após `fmt(v)` (após a linha 19), antes de `totalPagoS`:

```ts
// raw can be any string containing digits; treats as integer cents and formats as BRL.
function maskCurrency(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "").slice(0, 13);
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  const reais = cents / 100;
  return "R$ " + reais.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Inverse of maskCurrency. "R$ 1.500,00" -> 1500. Empty / invalid -> 0.
function parseMasked(masked: string): number {
  const digits = (masked || "").replace(/\D/g, "");
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}

// Seed for edit mode: number -> masked string without float drift.
function maskFromNumber(v: number | undefined | null): string {
  if (v === undefined || v === null || isNaN(v as number)) return "";
  const cents = Math.round((v as number) * 100);
  return maskCurrency(String(cents));
}

// "2026-06-19" or full ISO -> "19/06/2026". Pure string split; no Date() to avoid TZ bugs.
function fmtDate(iso: string): string {
  if (!iso) return "";
  const ymd = iso.slice(0, 10);
  const parts = ymd.split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
```

- [x] **1.2** Em `ModalServico` — substituir a inicialização de `valorTotal` (linha 47):

De:
```ts
const [valorTotal, setValorTotal] = useState(initial?.valorTotal?.toString() || "");
```

Para:
```ts
const [valorTotal, setValorTotal] = useState(maskFromNumber(initial?.valorTotal));
```

- [x] **1.3** Em `ModalServico` — input `valorTotal` (linha 92). Substituir o JSX inteiro do input:

De:
```tsx
<input type="number" value={valorTotal} onChange={e=>setValorTotal(e.target.value)} placeholder="0,00"
  className="w-full mt-1 mb-4 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm outline-none" />
```

Para:
```tsx
<input
  type="text"
  inputMode="numeric"
  value={valorTotal}
  onChange={e => setValorTotal(maskCurrency(e.target.value))}
  placeholder="R$ 0,00"
  className="w-full mt-1 mb-4 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm outline-none"
/>
```

- [x] **1.4** Em `ModalServico` — input `nVal` (linha 107). Substituir:

De:
```tsx
<input type="number" value={nVal} onChange={e=>setNVal(e.target.value)} placeholder="Valor" className="flex-1 bg-white border border-gray-100 rounded-lg px-2 py-1.5 text-xs outline-none" />
```

Para:
```tsx
<input
  type="text"
  inputMode="numeric"
  value={nVal}
  onChange={e => setNVal(maskCurrency(e.target.value))}
  placeholder="R$ 0,00"
  className="flex-1 bg-white border border-gray-100 rounded-lg px-2 py-1.5 text-xs outline-none"
/>
```

- [x] **1.5** Em `ModalServico` — `addPag` (linha 55-59). Substituir uso de `Number(nVal)`:

De:
```ts
function addPag() {
  if (!nVal) return;
  setPagamentos(p => [...p, {id: String(Date.now()), valor: Number(nVal), data: nData, obs: nObs}]);
  setNVal(""); setNObs("");
}
```

Para:
```ts
function addPag() {
  const valor = parseMasked(nVal);
  if (!valor) return;
  setPagamentos(p => [...p, {id: String(Date.now()), valor, data: nData, obs: nObs}]);
  setNVal(""); setNObs("");
}
```

- [x] **1.6** Em `ModalServico` — `save` (linha 66). Substituir `valorTotal:Number(valorTotal)` no body:

De:
```ts
body: JSON.stringify({prestador,categoria,valorTotal:Number(valorTotal),pagamentos})
```

Para:
```ts
body: JSON.stringify({prestador, categoria, valorTotal: parseMasked(valorTotal), pagamentos})
```

- [x] **1.7** Em `ModalServico` — lista de pagamentos dentro do modal (linha 99). Substituir `{p.data}`:

De:
```tsx
<span className="text-gray-400">{p.data}</span>
```

Para:
```tsx
<span className="text-gray-400">{fmtDate(p.data)}</span>
```

- [x] **1.8** Em `ObraPage` (escopo externo) — exibição no card expandido do serviço (linha 426). Substituir `{p.data.slice(0,10)}`:

De:
```tsx
<span className="text-gray-400">{p.data.slice(0,10)}</span>
```

Para:
```tsx
<span className="text-gray-400">{fmtDate(p.data)}</span>
```

- [x] **1.9** Type check: `npm run build` (Next.js compila TS no build; não há `tsc --noEmit` configurado). Validar zero erros.

#### Verificação manual (Task 1)

- [ ] Abrir um novo serviço: digitar `150000` no campo valor → ver `R$ 1.500,00`.
- [ ] Apagar caracteres → máscara recua suavemente (`R$ 1.500,00` → `R$ 150,00` → `R$ 15,00` → `R$ 1,50` → `R$ 0,15` → vazio).
- [ ] Salvar serviço com valor `R$ 1.500,00` → checar no Prisma Studio (`npm run db:studio`) ou DevTools Network → payload contém `"valorTotal":1500`.
- [ ] Adicionar um pagamento com data hoje, valor `R$ 500,00`, obs "entrada" → ver na lista do modal: `19/06/2026  R$ 500,00  entrada`.
- [ ] Salvar → reabrir modal em modo edição (botão Editar) → campo `valorTotal` aparece como `R$ 1.500,00` (sem perda de centavos).
- [ ] No card expandido fora do modal → data do pagamento aparece como `19/06/2026`.

---

### Task 2: ModalMaterial + exibições restantes [type: scaffold]

**Files:** `/Users/dayvissonsoares/Documents/Projects/orce-obras/src/app/obras/[obraId]/page.tsx`
**Reqs:** REQ-4, REQ-5

#### Passos

- [x] **2.1** Em `ModalMaterial` — substituir inicialização de `valorTotal` (linha 130):

De:
```ts
const [valorTotal, setValorTotal] = useState(initial?.valorTotal?.toString() || "");
```

Para:
```ts
const [valorTotal, setValorTotal] = useState(maskFromNumber(initial?.valorTotal));
```

- [x] **2.2** Em `ModalMaterial` — atualizar cálculo de `falta` (linha 137):

De:
```ts
const falta = Number(valorTotal||0) - somaFormas;
```

Para:
```ts
const falta = parseMasked(valorTotal) - somaFormas;
```

- [x] **2.3** Em `ModalMaterial` — `addForma` (linha 139-143):

De:
```ts
function addForma() {
  if (!fVal) return;
  setFormas(f=>[...f,{id:String(Date.now()),metodo:fMetodo,valor:Number(fVal)}]);
  setFVal("");
}
```

Para:
```ts
function addForma() {
  const valor = parseMasked(fVal);
  if (!valor) return;
  setFormas(f => [...f, {id: String(Date.now()), metodo: fMetodo, valor}]);
  setFVal("");
}
```

- [x] **2.4** Em `ModalMaterial` — `save` body (linha 150):

De:
```ts
body: JSON.stringify({item,categoria,valorTotal:Number(valorTotal),formasPagamento:formas})
```

Para:
```ts
body: JSON.stringify({item, categoria, valorTotal: parseMasked(valorTotal), formasPagamento: formas})
```

- [x] **2.5** Em `ModalMaterial` — input `valorTotal` (linha 176). Substituir:

De:
```tsx
<input type="number" value={valorTotal} onChange={e=>setValorTotal(e.target.value)} placeholder="0,00"
  className="w-full mt-1 mb-4 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm outline-none" />
```

Para:
```tsx
<input
  type="text"
  inputMode="numeric"
  value={valorTotal}
  onChange={e => setValorTotal(maskCurrency(e.target.value))}
  placeholder="R$ 0,00"
  className="w-full mt-1 mb-4 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm outline-none"
/>
```

- [x] **2.6** Em `ModalMaterial` — input `fVal` (linha 198). Substituir:

De:
```tsx
<input type="number" value={fVal} onChange={e=>setFVal(e.target.value)} placeholder="Valor" className="flex-1 bg-white border border-gray-100 rounded-lg px-2 py-1.5 text-xs outline-none" />
```

Para:
```tsx
<input
  type="text"
  inputMode="numeric"
  value={fVal}
  onChange={e => setFVal(maskCurrency(e.target.value))}
  placeholder="R$ 0,00"
  className="flex-1 bg-white border border-gray-100 rounded-lg px-2 py-1.5 text-xs outline-none"
/>
```

- [x] **2.7** Build + smoke test final: `npm run build` → zero erros TS / Next.

#### Verificação manual (Task 2)

- [ ] Criar material novo: digitar valor total `200000` → `R$ 2.000,00`.
- [ ] Adicionar forma "PIX" com valor `150000` → aparece como `R$ 1.500,00` na lista; indicador `falta` mostra `Falta R$ 500,00`.
- [ ] Completar com forma "Cartão de crédito" `50000` → indicador vira `Bate` (verde).
- [ ] Salvar → reabrir em modo edição → valores preservados como `R$ 2.000,00`, `R$ 1.500,00`, `R$ 500,00`.
- [ ] Confirmar no payload da rede que `valorTotal: 2000` e `formasPagamento[].valor: 1500 / 500`.
- [ ] Nenhuma regressão visual nos `fmt(v)` existentes (exibições no card de resumo, listas, tooltip "Falta/Excede").
- [ ] Datas de pagamentos de serviços já cadastrados pré-mudança continuam exibindo no formato novo (`dd/mm/yyyy`) sem quebrar.

---

## Self-review

- [x] REQ-1 → Task 1.1.
- [x] REQ-2 → invariante explícito; helpers usam mesma base (inteiro de centavos), round-trip garantido.
- [x] REQ-3 → Tasks 1.2 a 1.6.
- [x] REQ-4 → Tasks 2.1 a 2.6.
- [x] REQ-5 → `maskFromNumber` (Task 1.1) + seeding em 1.2 e 2.1.
- [x] REQ-6 → Task 1.7.
- [x] REQ-7 → Task 1.8.
- [x] REQ-8 → nenhuma mudança nos inputs `type="date"` (linhas 51, 108) — explicitamente preservados.
- [x] REQ-9 → payloads (Tasks 1.6, 2.4) usam `parseMasked` que retorna `number` em reais; rotas API não tocadas.
- [x] Caminhos de arquivo são absolutos e exatos.
- [x] Código completo (sem placeholders).
- [x] Tarefas em ordem de dependência (helpers antes do uso).
- [x] Wave única — mudança pequena, mesmo arquivo, indivisível para deploy.
- [x] Tipo `scaffold` correto — projeto sem infra de testes; helpers puros mas adicionar Jest/Vitest é scope creep.
