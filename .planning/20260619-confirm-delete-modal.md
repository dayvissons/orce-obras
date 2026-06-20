# Modal de Confirmação de Remoção — Implementation Plan

**Goal:** Substituir o DELETE imediato dos botões "Remover" de serviços e materiais por um bottom-sheet modal de confirmação reutilizável.

**Architecture:** Adicionar um componente `ModalConfirmar` no estilo dos modais existentes (bottom-sheet, `rounded-t-2xl`, fundo `bg-black/40`). Estado da página passa a guardar um `pendingDelete` (carrier com `nome` + closure `onConfirm`) que é setado quando o usuário clica "Remover" e consumido pelo modal. Funções `deleteServico`/`deleteMaterial` passam a retornar `boolean` para que o modal possa aguardar e tratar erro/loading.

**Tech Stack:** Next.js 14 App Router · TypeScript · Tailwind CSS · React (client components).

---

## Context

### What We're Building

Hoje, ao clicar em "Remover" dentro do card expandido de um serviço ou material (`src/app/obras/[obraId]/page.tsx`, linhas 492 e 540), a função correspondente (`deleteServico` / `deleteMaterial`, linhas 374–391) dispara um `fetch DELETE` sem nenhuma confirmação. O usuário pode apagar dados acidentalmente em mobile.

A solução é adicionar um modal de confirmação no padrão visual dos demais modais do app (`ModalServico`, `ModalMaterial`, `ModalCompartilhar`, `ModalConvidar`):

- Bottom-sheet (`fixed inset-0 bg-black/40 flex items-end` + `bg-white rounded-t-2xl w-full p-5`).
- Mostra o **nome do item** (prestador para serviço, item para material).
- Dois botões: **Cancelar** (cinza) e **Remover** (vermelho).
- Mesmo componente atende tanto serviço quanto material (carrier-driven).

### Requirements

- [x] REQ-1: Existir um componente `ModalConfirmar` no mesmo arquivo `page.tsx`, no padrão visual dos demais modais (bottom-sheet, fundo escurecido, `rounded-t-2xl`, fechamento ao clicar fora e no "✕").
- [x] REQ-2: O modal exibe o nome do item a ser removido em destaque e uma mensagem de confirmação.
- [x] REQ-3: O modal expõe botões "Cancelar" (fecha sem ação) e "Remover" (executa a ação destrutiva).
- [x] REQ-4: Clicar "Remover" no card expandido de um **serviço** abre o modal e, ao confirmar, chama `DELETE /api/obras/[obraId]/servicos/[id]` e atualiza a lista.
- [x] REQ-5: Clicar "Remover" no card expandido de um **material** abre o modal e, ao confirmar, chama `DELETE /api/obras/[obraId]/materiais/[id]` e atualiza a lista.
- [x] REQ-6: O modal mostra estado de loading ("Removendo...") enquanto o DELETE está em andamento e desabilita os botões.
- [x] REQ-7: Em caso de erro de rede/API, o modal fecha e o erro continua sendo exibido na barra `deleteError` no topo da página (linha 421), preservando o comportamento atual.
- [x] REQ-8: Reusabilidade: um único componente `ModalConfirmar` atende ambos os casos via props (`nome`, `onClose`, `onConfirm`).
- [x] REQ-9: Não instalar novos pacotes; não criar novos arquivos.

### Out of Scope

- Confirmação para remoção de pagamentos individuais dentro do `ModalServico` / `ModalMaterial` (são edições em memória, não DELETE direto).
- Confirmação para abandono de edição não salva nos modais existentes.
- Animação de entrada/saída do modal (os demais modais não têm; manter consistência).
- Toast/snackbar de sucesso.

### Key Decisions

- **Carrier com closure (Option A do advisor):** o estado `pendingDelete` armazena `{ nome, onConfirm }`. O `onConfirm` é uma closure decidida no momento do clique no botão "Remover", deixando o `ModalConfirmar` totalmente agnóstico (não sabe se está apagando serviço ou material). Isso atende REQ-8 da forma mais limpa.
- **`deleteServico` / `deleteMaterial` passam a retornar `Promise<boolean>`:** o modal pode aguardar e só fechar em caso de sucesso. Sem isso, o modal teria que duplicar a lógica de fetch.
- **União de modais ganha `"confirmar"`:** o tipo `modal` em `ObraPage` (linha 363) é estendido para `"servico"|"material"|"compartilhar"|"convidar"|"confirmar"`.
- **`onClose` do `ModalConfirmar` limpa ambos os estados:** `setModal(null)` e `setPendingDelete(null)` — evita dados stale numa reabertura.
- **Sem `stopPropagation` nos botões dentro do card expandido:** o `onClick` que faz toggle do card está em uma `<div>` irmã (linha 464), não engloba o painel expandido (linha 480). Já validado lendo o JSX. Executor não deve adicionar defensivamente.
- **`deleteError` (linha 421) mantém-se inalterado:** continua exibindo erros vindos de falha de DELETE. O modal fecha em caso de erro e o erro aparece na faixa superior.

---

## File Structure

- Modify: `/Users/dayvissonsoares/Documents/Projects/orce-obras/src/app/obras/[obraId]/page.tsx`
  - Adicionar componente `ModalConfirmar` (após `ModalConvidar`, antes de `ObraPage`).
  - Adicionar estado `pendingDelete` em `ObraPage`.
  - Estender união do estado `modal`.
  - Alterar `deleteServico` e `deleteMaterial` para retornar `Promise<boolean>`.
  - Trocar `onClick` dos dois botões "Remover" (linhas 492 e 540) para abrir o modal.
  - Renderizar `<ModalConfirmar>` no bloco de modais (após linha 555).

Nenhum outro arquivo é tocado.

---

## Wave 1: Modal de confirmação de remoção

Single wave — mudanças coesas e curtas, todas no mesmo arquivo, shippable atomicamente.

### Task 1: Adicionar componente `ModalConfirmar` [type: scaffold]

**Files:** `/Users/dayvissonsoares/Documents/Projects/orce-obras/src/app/obras/[obraId]/page.tsx`
**Reqs:** REQ-1, REQ-2, REQ-3, REQ-6, REQ-8

- [x] Inserir o componente abaixo logo após o final de `ModalConvidar` (linha 352) e antes do comentário `// ─── PÁGINA PRINCIPAL ─────` (linha 354).
- [x] Type check: `npm run build` deve compilar sem erros de TS (não há `npm run lint`/`test` configurados — ver `CLAUDE.md`).

Código completo a inserir (linha 353, entre `ModalConvidar` e `ObraPage`):

```tsx
// ─── Modal Confirmar ──────────────────────────────────────────────
function ModalConfirmar({ nome, onClose, onConfirm }: {
  nome: string;
  onClose: () => void;
  onConfirm: () => Promise<boolean>;
}) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    const ok = await onConfirm();
    setLoading(false);
    if (ok) onClose();
    // Em caso de erro, o modal também fecha — o erro aparece na faixa
    // superior da página via state `deleteError`. Mantemos o modal
    // fechando para não prender o usuário.
    else onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="bg-white rounded-t-2xl w-full p-5">
        <div className="flex justify-between items-center mb-4">
          <span className="font-semibold text-gray-900">Remover item</span>
          <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
        </div>
        <p className="text-sm text-gray-600 mb-1">Tem certeza que deseja remover:</p>
        <p className="text-base font-semibold text-gray-900 mb-4 break-words">{nome}</p>
        <p className="text-xs text-gray-400 mb-5">Esta ação não pode ser desfeita.</p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl text-sm disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 py-3 bg-red-500 text-white font-semibold rounded-xl text-sm disabled:opacity-50"
          >
            {loading ? "Removendo..." : "Remover"}
          </button>
        </div>
      </div>
    </div>
  );
}

```

---

### Task 2: Ajustar `deleteServico` / `deleteMaterial` para retornar boolean [type: scaffold]

**Files:** `/Users/dayvissonsoares/Documents/Projects/orce-obras/src/app/obras/[obraId]/page.tsx`
**Reqs:** REQ-4, REQ-5, REQ-6, REQ-7

- [x] Substituir as duas funções nas linhas 374–391 pelos blocos abaixo. A mudança é apenas adicionar `: Promise<boolean>` no tipo de retorno e `return true/false` nos pontos certos. O comportamento de `setDeleteError` é preservado.
- [x] Type check: `npm run build`.

Bloco antigo (linhas 374–391) — substituir:

```tsx
  async function deleteServico(id: string) {
    setDeleteError("");
    const res = await fetch(`/api/obras/${obraId}/servicos/${id}`, {method:"DELETE"});
    if (!res.ok) {
      setDeleteError("Erro ao remover serviço. Tente novamente.");
      return;
    }
    fetchServicos();
  }
  async function deleteMaterial(id: string) {
    setDeleteError("");
    const res = await fetch(`/api/obras/${obraId}/materiais/${id}`, {method:"DELETE"});
    if (!res.ok) {
      setDeleteError("Erro ao remover material. Tente novamente.");
      return;
    }
    fetchMateriais();
  }
```

Bloco novo:

```tsx
  async function deleteServico(id: string): Promise<boolean> {
    setDeleteError("");
    const res = await fetch(`/api/obras/${obraId}/servicos/${id}`, {method:"DELETE"});
    if (!res.ok) {
      setDeleteError("Erro ao remover serviço. Tente novamente.");
      return false;
    }
    await fetchServicos();
    return true;
  }
  async function deleteMaterial(id: string): Promise<boolean> {
    setDeleteError("");
    const res = await fetch(`/api/obras/${obraId}/materiais/${id}`, {method:"DELETE"});
    if (!res.ok) {
      setDeleteError("Erro ao remover material. Tente novamente.");
      return false;
    }
    await fetchMateriais();
    return true;
  }
```

---

### Task 3: Adicionar estado `pendingDelete` e estender união `modal` [type: scaffold]

**Files:** `/Users/dayvissonsoares/Documents/Projects/orce-obras/src/app/obras/[obraId]/page.tsx`
**Reqs:** REQ-4, REQ-5, REQ-8

- [x] Localizar a linha 363:

  ```tsx
  const [modal, setModal] = useState<null|"servico"|"material"|"compartilhar"|"convidar">(null);
  ```

  Substituir por:

  ```tsx
  const [modal, setModal] = useState<null|"servico"|"material"|"compartilhar"|"convidar"|"confirmar">(null);
  ```

- [x] Imediatamente após a linha alterada acima (e antes de `const [editServico, ...]`), inserir:

  ```tsx
  const [pendingDelete, setPendingDelete] = useState<null|{ nome: string; onConfirm: () => Promise<boolean> }>(null);
  ```

- [x] Type check: `npm run build`.

Resultado esperado do bloco entre linha 363 e linha 366 (após mudanças):

```tsx
  const [modal, setModal] = useState<null|"servico"|"material"|"compartilhar"|"convidar"|"confirmar">(null);
  const [pendingDelete, setPendingDelete] = useState<null|{ nome: string; onConfirm: () => Promise<boolean> }>(null);
  const [editServico, setEditServico] = useState<Servico|undefined>();
  const [editMaterial, setEditMaterial] = useState<Material|undefined>();
  const [deleteError, setDeleteError] = useState("");
```

---

### Task 4: Religar os botões "Remover" para abrir o modal [type: scaffold]

**Files:** `/Users/dayvissonsoares/Documents/Projects/orce-obras/src/app/obras/[obraId]/page.tsx`
**Reqs:** REQ-4, REQ-5

- [x] Localizar o botão "Remover" do serviço (linha 492):

  ```tsx
  <button onClick={()=>deleteServico(s.id)} className="flex-1 py-1.5 bg-red-50 text-red-500 text-xs font-medium rounded-lg">Remover</button>
  ```

  Substituir por:

  ```tsx
  <button
    onClick={()=>{
      setPendingDelete({ nome: s.prestador, onConfirm: () => deleteServico(s.id) });
      setModal("confirmar");
    }}
    className="flex-1 py-1.5 bg-red-50 text-red-500 text-xs font-medium rounded-lg"
  >
    Remover
  </button>
  ```

- [x] Localizar o botão "Remover" do material (linha 540):

  ```tsx
  <button onClick={()=>deleteMaterial(m.id)} className="flex-1 py-1.5 bg-red-50 text-red-500 text-xs font-medium rounded-lg">Remover</button>
  ```

  Substituir por:

  ```tsx
  <button
    onClick={()=>{
      setPendingDelete({ nome: m.item, onConfirm: () => deleteMaterial(m.id) });
      setModal("confirmar");
    }}
    className="flex-1 py-1.5 bg-red-50 text-red-500 text-xs font-medium rounded-lg"
  >
    Remover
  </button>
  ```

- [x] Não adicionar `e.stopPropagation()` — o `onClick` de toggle do card (linha 464) está em uma `<div>` irmã (`p-3 cursor-pointer`) e não engloba o painel expandido (linha 480). Já verificado.

---

### Task 5: Renderizar `<ModalConfirmar>` no bloco de modais [type: scaffold]

**Files:** `/Users/dayvissonsoares/Documents/Projects/orce-obras/src/app/obras/[obraId]/page.tsx`
**Reqs:** REQ-1, REQ-6, REQ-7, REQ-8

- [x] Localizar o bloco de modais (linhas 551–555):

  ```tsx
      {/* Modais */}
      {modal === "servico" && <ModalServico initial={editServico} obraId={obraId} onClose={()=>setModal(null)} onSaved={fetchServicos} />}
      {modal === "material" && <ModalMaterial initial={editMaterial} obraId={obraId} onClose={()=>setModal(null)} onSaved={fetchMateriais} />}
      {modal === "compartilhar" && <ModalCompartilhar servicos={servicos} materiais={materiais} onClose={()=>setModal(null)} />}
      {modal === "convidar" && <ModalConvidar obraId={obraId} onClose={()=>setModal(null)} />}
  ```

  Adicionar **logo após** a linha do `ModalConvidar`:

  ```tsx
      {modal === "confirmar" && pendingDelete && (
        <ModalConfirmar
          nome={pendingDelete.nome}
          onClose={()=>{ setModal(null); setPendingDelete(null); }}
          onConfirm={pendingDelete.onConfirm}
        />
      )}
  ```

- [ ] Bloco resultante:

  ```tsx
      {/* Modais */}
      {modal === "servico" && <ModalServico initial={editServico} obraId={obraId} onClose={()=>setModal(null)} onSaved={fetchServicos} />}
      {modal === "material" && <ModalMaterial initial={editMaterial} obraId={obraId} onClose={()=>setModal(null)} onSaved={fetchMateriais} />}
      {modal === "compartilhar" && <ModalCompartilhar servicos={servicos} materiais={materiais} onClose={()=>setModal(null)} />}
      {modal === "convidar" && <ModalConvidar obraId={obraId} onClose={()=>setModal(null)} />}
      {modal === "confirmar" && pendingDelete && (
        <ModalConfirmar
          nome={pendingDelete.nome}
          onClose={()=>{ setModal(null); setPendingDelete(null); }}
          onConfirm={pendingDelete.onConfirm}
        />
      )}
  ```

- [x] Build final: `npm run build` — limpo, sem erros TS.
- [ ] Smoke test manual (`npm run dev`):
  - Clicar "Remover" num serviço → modal abre mostrando o nome do prestador → "Cancelar" fecha sem ação → "Remover" remove e atualiza lista.
  - Repetir para um material.
  - Verificar que clicar fora do modal o fecha (mesmo padrão dos outros modais).

---

## Self-review

- [x] Cada REQ-1..REQ-9 tem ao menos uma task referenciando.
- [x] Paths absolutos exatos (`/Users/dayvissonsoares/Documents/Projects/orce-obras/src/app/obras/[obraId]/page.tsx`).
- [x] Todo código está completo no plano — sem `<implementar aqui>`.
- [x] Ordem de dependência: T1 cria componente → T2 ajusta funções de delete → T3 estende estado → T4 religa botões (depende de T3) → T5 renderiza modal (depende de T1, T3).
- [x] Não há múltiplos módulos — tudo no mesmo arquivo, single track.
- [x] Single wave: mudança coesa, shippable como um único commit.
- [x] Sem novos pacotes, sem novos arquivos (conforme restrição do usuário).
