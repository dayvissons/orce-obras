"use client";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";

// ─── Tipos ────────────────────────────────────────────────────────
type Pagamento = { id: string; valor: number; data: string; obs?: string };
type Servico = { id: string; prestador: string; categoria: string; valorTotal: number; pagamentos: Pagamento[] };
type FormaPag = { id: string; metodo: string; valor: number };
type Material = { id: string; item: string; categoria: string; valorTotal: number; formasPagamento: FormaPag[] };

const CATS_S = ["Drywall","Elétrica","Hidráulica","Marcenaria","Pintura","Gesso","Piso","Arquiteto","Outros"];
const CATS_M = ["Iluminação","Hidráulica","Elétrica","Revestimento","Tintas","Ferragens","Louças","Móveis","Outros"];
const METODOS = ["PIX","Cartão de crédito","Cartão de débito","Dinheiro","Boleto","Transferência",];

// ─── Helpers ──────────────────────────────────────────────────────
function fmt(v: number) {
  return "R$ " + Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
}

function maskCurrency(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "").slice(0, 13);
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  const reais = cents / 100;
  return "R$ " + reais.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseMasked(masked: string): number {
  const digits = (masked || "").replace(/\D/g, "");
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}

function maskFromNumber(v: number | undefined | null): string {
  if (v === undefined || v === null || isNaN(v as number)) return "";
  const cents = Math.round((v as number) * 100);
  return maskCurrency(String(cents));
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  const ymd = iso.slice(0, 10);
  const parts = ymd.split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function totalPagoS(s: Servico) { return s.pagamentos.reduce((a,p)=>a+p.valor,0); }
function totalPagoM(m: Material) { return m.formasPagamento.reduce((a,f)=>a+f.valor,0); }
function saldoS(s: Servico) { return s.valorTotal - totalPagoS(s); }
function saldoM(m: Material) { return m.valorTotal - totalPagoM(m); }
function pct(p: number, t: number) { return t ? Math.min(100,Math.round(p/t*100)) : 0; }

function Badge({ paid, total }: { paid: number; total: number }) {
  const s = total > 0 && paid >= total ? "Pago" : paid > 0 ? "Parcial" : "Pendente";
  const cls = s === "Pago" ? "bg-green-50 text-green-700" : s === "Parcial" ? "bg-yellow-50 text-yellow-700" : "bg-red-50 text-red-600";
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{s}</span>;
}

function ProgressBar({ paid, total }: { paid: number; total: number }) {
  const p = pct(paid, total);
  return (
    <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
      <div className={`h-1.5 rounded-full transition-all ${p>=100?"bg-green-500":"bg-orange-400"}`} style={{width:`${p}%`}} />
    </div>
  );
}

// ─── Modal Serviço ────────────────────────────────────────────────
function ModalServico({ initial, obraId, onClose, onSaved }: {
  initial?: Servico; obraId: string; onClose: () => void; onSaved: () => void;
}) {
  const [prestador, setPrestador] = useState(initial?.prestador || "");
  const [categoria, setCategoria] = useState(initial?.categoria || CATS_S[0]);
  const [valorTotal, setValorTotal] = useState(maskFromNumber(initial?.valorTotal));
  const [pagamentos, setPagamentos] = useState<Pagamento[]>(
    initial?.pagamentos.map(p => ({...p, data: p.data.slice(0,10)})) || []
  );
  const [nVal, setNVal] = useState(""); const [nData, setNData] = useState(new Date().toISOString().slice(0,10)); const [nObs, setNObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addPag() {
    const valor = parseMasked(nVal);
    if (!valor) return;
    setPagamentos(p => [...p, {id: String(Date.now()), valor, data: nData, obs: nObs}]);
    setNVal(""); setNObs("");
  }

  async function save() {
    setSaving(true);
    setError("");
    const url = initial ? `/api/obras/${obraId}/servicos/${initial.id}` : `/api/obras/${obraId}/servicos`;
    const method = initial ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: {"Content-Type":"application/json"}, body: JSON.stringify({prestador, categoria, valorTotal: parseMasked(valorTotal), pagamentos}) });
    setSaving(false);
    if (!res.ok) {
      setError("Erro ao salvar. Verifique os dados e tente novamente.");
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="bg-white rounded-t-2xl w-full p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <span className="font-semibold text-gray-900">{initial?"Editar":"Novo"} serviço</span>
          <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
        </div>
        <label className="text-xs font-medium text-gray-500">PRESTADOR</label>
        <input value={prestador} onChange={e=>setPrestador(e.target.value)} placeholder="Ex: Eletricista – João"
          className="w-full mt-1 mb-3 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm outline-none" />
        <label className="text-xs font-medium text-gray-500">CATEGORIA</label>
        <select value={categoria} onChange={e=>setCategoria(e.target.value)}
          className="w-full mt-1 mb-3 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm outline-none">
          {CATS_S.map(c=><option key={c}>{c}</option>)}
        </select>
        <label className="text-xs font-medium text-gray-500">VALOR TOTAL (R$)</label>
        <input
          type="text"
          inputMode="numeric"
          value={valorTotal}
          onChange={e => setValorTotal(maskCurrency(e.target.value))}
          placeholder="R$ 0,00"
          className="w-full mt-1 mb-4 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm outline-none"
        />

        <div className="bg-gray-50 rounded-xl p-3 mb-4">
          <p className="text-xs font-medium text-gray-500 mb-2">PAGAMENTOS</p>
          {pagamentos.map(p=>(
            <div key={p.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-gray-100 last:border-0">
              <span className="text-gray-400">{fmtDate(p.data)}</span>
              <span className="font-semibold text-green-600">{fmt(p.valor)}</span>
              <span className="text-gray-400 flex-1 truncate">{p.obs}</span>
              <button onClick={()=>setPagamentos(ps=>ps.filter(x=>x.id!==p.id))} className="text-red-400 ml-auto">✕</button>
            </div>
          ))}
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                inputMode="numeric"
                value={nVal}
                onChange={e => setNVal(maskCurrency(e.target.value))}
                placeholder="R$ 0,00"
                className="flex-1 bg-white border border-gray-100 rounded-lg px-2 py-1.5 text-xs outline-none"
              />
              <input type="date" value={nData} onChange={e=>setNData(e.target.value)} className="flex-1 bg-white border border-gray-100 rounded-lg px-2 py-1.5 text-xs outline-none" />
            </div>
            <input value={nObs} onChange={e=>setNObs(e.target.value)} placeholder="Observação (ex: entrada)" className="w-full bg-white border border-gray-100 rounded-lg px-2 py-1.5 text-xs outline-none mb-2" />
            <button onClick={addPag} className="w-full py-2 bg-orange-50 text-orange-600 text-xs font-medium rounded-lg">+ Adicionar pagamento</button>
          </div>
        </div>

        {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
        <button onClick={save} disabled={saving} className="w-full py-3 bg-gray-900 text-white font-semibold rounded-xl text-sm disabled:opacity-50">
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}

// ─── Modal Material ───────────────────────────────────────────────
function ModalMaterial({ initial, obraId, onClose, onSaved }: {
  initial?: Material; obraId: string; onClose: () => void; onSaved: () => void;
}) {
  const [item, setItem] = useState(initial?.item || "");
  const [categoria, setCategoria] = useState(initial?.categoria || CATS_M[0]);
  const [valorTotal, setValorTotal] = useState(maskFromNumber(initial?.valorTotal));
  const [formas, setFormas] = useState<FormaPag[]>(initial?.formasPagamento || []);
  const [fMetodo, setFMetodo] = useState(METODOS[0]); const [fVal, setFVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const somaFormas = formas.reduce((a,f)=>a+f.valor,0);
  const falta = parseMasked(valorTotal) - somaFormas;

  function addForma() {
    const valor = parseMasked(fVal);
    if (!valor) return;
    setFormas(f => [...f, {id: String(Date.now()), metodo: fMetodo, valor}]);
    setFVal("");
  }

  async function save() {
    setSaving(true);
    setError("");
    const url = initial ? `/api/obras/${obraId}/materiais/${initial.id}` : `/api/obras/${obraId}/materiais`;
    const method = initial ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: {"Content-Type":"application/json"}, body: JSON.stringify({item, categoria, valorTotal: parseMasked(valorTotal), formasPagamento: formas}) });
    setSaving(false);
    if (!res.ok) {
      setError("Erro ao salvar. Verifique os dados e tente novamente.");
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="bg-white rounded-t-2xl w-full p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <span className="font-semibold text-gray-900">{initial?"Editar":"Novo"} material</span>
          <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
        </div>
        <label className="text-xs font-medium text-gray-500">ITEM / DESCRIÇÃO</label>
        <input value={item} onChange={e=>setItem(e.target.value)} placeholder="Ex: Kit iluminação sala"
          className="w-full mt-1 mb-3 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm outline-none" />
        <label className="text-xs font-medium text-gray-500">CATEGORIA</label>
        <select value={categoria} onChange={e=>setCategoria(e.target.value)}
          className="w-full mt-1 mb-3 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm outline-none">
          {CATS_M.map(c=><option key={c}>{c}</option>)}
        </select>
        <label className="text-xs font-medium text-gray-500">VALOR TOTAL (R$)</label>
        <input
          type="text"
          inputMode="numeric"
          value={valorTotal}
          onChange={e => setValorTotal(maskCurrency(e.target.value))}
          placeholder="R$ 0,00"
          className="w-full mt-1 mb-4 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm outline-none"
        />

        <div className="bg-gray-50 rounded-xl p-3 mb-4">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs font-medium text-gray-500">FORMAS DE PAGAMENTO</p>
            <span className={`text-xs font-semibold ${Math.abs(falta)<0.01?"text-green-600":falta>0?"text-yellow-600":"text-red-500"}`}>
              {Math.abs(falta)<0.01?"Bate":falta>0?`Falta ${fmt(falta)}`:`Excede ${fmt(-falta)}`}
            </span>
          </div>
          {formas.map(f=>(
            <div key={f.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-gray-100 last:border-0">
              <span className="text-gray-700 flex-1">{f.metodo}</span>
              <span className="font-semibold text-green-600">{fmt(f.valor)}</span>
              <button onClick={()=>setFormas(fs=>fs.filter(x=>x.id!==f.id))} className="text-red-400">✕</button>
            </div>
          ))}
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="flex gap-2 mb-2">
              <select value={fMetodo} onChange={e=>setFMetodo(e.target.value)} className="flex-1 bg-white border border-gray-100 rounded-lg px-2 py-1.5 text-xs outline-none">
                {METODOS.map(m=><option key={m}>{m}</option>)}
              </select>
              <input
                type="text"
                inputMode="numeric"
                value={fVal}
                onChange={e => setFVal(maskCurrency(e.target.value))}
                placeholder="R$ 0,00"
                className="flex-1 bg-white border border-gray-100 rounded-lg px-2 py-1.5 text-xs outline-none"
              />
            </div>
            <button onClick={addForma} className="w-full py-2 bg-orange-50 text-orange-600 text-xs font-medium rounded-lg">+ Adicionar forma</button>
          </div>
        </div>

        {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
        <button onClick={save} disabled={saving} className="w-full py-3 bg-gray-900 text-white font-semibold rounded-xl text-sm disabled:opacity-50">
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}

// ─── Modal Compartilhar ───────────────────────────────────────────
function ModalCompartilhar({ servicos, materiais, onClose }: { servicos: Servico[]; materiais: Material[]; onClose: () => void }) {
  function pad(s: string, n: number) { return s.length >= n ? s : s + " ".repeat(n - s.length); }
  function padL(s: string, n: number) { return s.length >= n ? s : " ".repeat(n - s.length) + s; }
  function fmtN(v: number) { return Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2}); }
  function trunc(s: string, n: number) { return s.length > n ? s.slice(0,n-1)+"…" : s; }

  const tG = servicos.reduce((s,i)=>s+i.valorTotal,0) + materiais.reduce((s,i)=>s+i.valorTotal,0);
  const pG = servicos.reduce((s,i)=>s+totalPagoS(i),0) + materiais.reduce((s,i)=>s+totalPagoM(i),0);

  let txt = `CONTROLE DE OBRA\n${new Date().toLocaleDateString("pt-BR")}\n\n`;
  txt += `Total: R$ ${fmtN(tG)}\nPago: R$ ${fmtN(pG)}\nAberto: R$ ${fmtN(tG-pG)}\n${pct(pG,tG)}% concluído\n\n`;
  if (servicos.length) {
    txt += `SERVIÇOS\n`;
    txt += pad("PRESTADOR",18) + padL("TOTAL",10) + padL("PAGO",10) + padL("SALDO",10) + "\n";
    txt += "─".repeat(48) + "\n";
    servicos.forEach(s => { txt += pad(trunc(s.prestador,17),18) + padL(fmtN(s.valorTotal),10) + padL(fmtN(totalPagoS(s)),10) + padL(fmtN(saldoS(s)),10) + "\n"; });
    txt += "\n";
  }
  if (materiais.length) {
    txt += `MATERIAIS\n`;
    materiais.forEach(m => {
      txt += `- ${m.item} — R$ ${fmtN(m.valorTotal)}\n`;
      m.formasPagamento.forEach(f => { txt += `   ${f.metodo}: R$ ${fmtN(f.valor)}\n`; });
      if (saldoM(m) > 0.01) txt += `   Falta: R$ ${fmtN(saldoM(m))}\n`;
    });
  }

  function copy() { navigator.clipboard.writeText(txt); }
  function share() { if (navigator.share) navigator.share({text:txt}); else copy(); }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="bg-white rounded-t-2xl w-full p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <span className="font-semibold text-gray-900">Compartilhar dados</span>
          <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
        </div>
        <p className="text-xs text-gray-400 mb-3">Tabela pronta para enviar como mensagem:</p>
        <pre className="text-[11px] leading-relaxed whitespace-pre-wrap break-words bg-gray-50 rounded-xl p-3 max-h-64 overflow-y-auto border border-gray-100 mb-4 font-mono">{txt}</pre>
        <button onClick={share} className="w-full py-3 bg-green-50 text-green-700 font-semibold rounded-xl text-sm mb-2">Enviar / compartilhar</button>
        <button onClick={copy} className="w-full py-3 bg-blue-50 text-blue-700 font-semibold rounded-xl text-sm">Copiar texto</button>
      </div>
    </div>
  );
}

// ─── Modal Convidar ───────────────────────────────────────────────
function ModalConvidar({ obraId, onClose }: { obraId: string; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function convidar() {
    setLoading(true); setMsg("");
    const res = await fetch(`/api/obras/${obraId}/convidar`, {
      method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({email}),
    });
    const data = await res.json();
    setMsg(res.ok ? "Acesso concedido!" : `Erro: ${data.error}`);
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="bg-white rounded-t-2xl w-full p-5">
        <div className="flex justify-between items-center mb-4">
          <span className="font-semibold text-gray-900">Convidar pessoa</span>
          <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
        </div>
        <p className="text-xs text-gray-400 mb-3">A pessoa precisa ter feito login ao menos uma vez com o e-mail Google dela.</p>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@gmail.com" type="email"
          className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm outline-none mb-3" />
        {msg && <p className="text-sm mb-3">{msg}</p>}
        <button onClick={convidar} disabled={loading} className="w-full py-3 bg-gray-900 text-white font-semibold rounded-xl text-sm disabled:opacity-50">
          {loading ? "Adicionando..." : "Dar acesso"}
        </button>
      </div>
    </div>
  );
}

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

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────
export default function ObraPage() {
  const { status } = useSession();
  const router = useRouter();
  const { obraId } = useParams() as { obraId: string };
  const [tab, setTab] = useState<"resumo"|"servicos"|"materiais">("resumo");
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [openCards, setOpenCards] = useState<Record<string,boolean>>({});
  const [modal, setModal] = useState<null|"servico"|"material"|"compartilhar"|"convidar"|"confirmar">(null);
  const [pendingDelete, setPendingDelete] = useState<null|{ nome: string; onConfirm: () => Promise<boolean> }>(null);
  const [editServico, setEditServico] = useState<Servico|undefined>();
  const [editMaterial, setEditMaterial] = useState<Material|undefined>();
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);
  useEffect(() => { if (status === "authenticated") { fetchServicos(); fetchMateriais(); } }, [status, obraId]);

  async function fetchServicos() { const r = await fetch(`/api/obras/${obraId}/servicos`); if(r.ok) setServicos(await r.json()); }
  async function fetchMateriais() { const r = await fetch(`/api/obras/${obraId}/materiais`); if(r.ok) setMateriais(await r.json()); }

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

  const totalS = servicos.reduce((s,i)=>s+i.valorTotal,0);
  const totalM = materiais.reduce((s,i)=>s+i.valorTotal,0);
  const pagoS = servicos.reduce((s,i)=>s+totalPagoS(i),0);
  const pagoM = materiais.reduce((s,i)=>s+totalPagoM(i),0);
  const tG = totalS+totalM, pG = pagoS+pagoM, ab = tG-pG, perc = pct(pG,tG);

  if (status === "loading") return <div className="min-h-screen flex items-center justify-center text-gray-400">Carregando...</div>;

  return (
    <div className="min-h-screen bg-[#F7F5F2] max-w-lg mx-auto pb-10">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-5 pb-3 sticky top-0 z-10">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => router.push("/")} className="text-gray-400 text-sm">←</button>
          <h1 className="font-semibold text-gray-900 flex-1">Minha Obra</h1>
          <button onClick={() => setModal("convidar")} className="text-xs text-gray-400 border border-gray-200 rounded-lg px-2 py-1">+ Convidar</button>
        </div>
        <div className="flex gap-2">
          {(["resumo","servicos","materiais"] as const).map(t => (
            <button key={t} onClick={()=>setTab(t)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${tab===t?"bg-blue-50 text-blue-600":"text-gray-400"}`}>
              {t==="resumo"?"Resumo":t==="servicos"?"Servicos":"Materiais"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {deleteError && <p className="text-red-500 text-xs mb-3">{deleteError}</p>}

        {/* RESUMO */}
        {tab === "resumo" && (
          <>
            <div className="bg-white rounded-xl border border-gray-100 p-4 mb-3">
              <p className="text-xs font-medium text-gray-400 mb-3">PROGRESSO GERAL</p>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Total contratado</span>
                <span className="font-semibold">{fmt(tG)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-2 rounded-full transition-all ${perc>=100?"bg-green-500":"bg-orange-400"}`} style={{width:`${perc}%`}} />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{fmt(pG)} pago</span><span>{perc}%</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[["Pago",pG,"text-green-600"],["Em aberto",ab,ab>0?"text-red-500":"text-green-600"],["Serviços",totalS,"text-gray-900"],["Materiais",totalM,"text-gray-900"]].map(([l,v,c])=>(
                <div key={l as string} className="bg-white rounded-xl border border-gray-100 p-3">
                  <p className="text-xs text-gray-400">{l as string}</p>
                  <p className={`text-base font-semibold mt-0.5 ${c as string}`}>{fmt(v as number)}</p>
                </div>
              ))}
            </div>
            <button onClick={()=>setModal("compartilhar")} className="w-full py-3 bg-green-50 text-green-700 font-semibold rounded-xl text-sm mb-2">
              Compartilhar (tabela)
            </button>
          </>
        )}

        {/* SERVIÇOS */}
        {tab === "servicos" && (
          <>
            <button onClick={()=>{setEditServico(undefined);setModal("servico");}} className="w-full py-3 border border-dashed border-gray-200 rounded-xl text-sm text-gray-400 mb-3">
              + Novo serviço
            </button>
            {servicos.length === 0 && <p className="text-center text-gray-400 text-sm py-8">Nenhum serviço cadastrado.</p>}
            {servicos.map(s => {
              const p = totalPagoS(s), sl = saldoS(s), open = openCards[s.id];
              return (
                <div key={s.id} className="bg-white rounded-xl border border-gray-100 mb-2 overflow-hidden">
                  <div className="p-3 cursor-pointer" onClick={()=>setOpenCards(o=>({...o,[s.id]:!o[s.id]}))}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 text-sm truncate">{s.prestador}</p>
                        <p className="text-xs text-gray-400">{s.categoria}</p>
                      </div>
                      <Badge paid={p} total={s.valorTotal} />
                    </div>
                    <ProgressBar paid={p} total={s.valorTotal} />
                    <div className="flex justify-between text-xs mt-2">
                      <span className="text-gray-400">Total: <b className="text-gray-700">{fmt(s.valorTotal)}</b></span>
                      <span className="text-green-600">Pago: <b>{fmt(p)}</b></span>
                      <span className={sl>0.01?"text-red-500":"text-green-600"}>Saldo: <b>{fmt(sl)}</b></span>
                    </div>
                  </div>
                  {open && (
                    <div className="border-t border-gray-50 px-3 py-2 bg-gray-50">
                      <p className="text-xs font-medium text-gray-400 mb-1">PAGAMENTOS</p>
                      {s.pagamentos.length === 0 && <p className="text-xs text-gray-400">Nenhum.</p>}
                      {s.pagamentos.map(p=>(
                        <div key={p.id} className="flex gap-2 text-xs py-1 border-b border-gray-100 last:border-0">
                          <span className="text-gray-400">{fmtDate(p.data)}</span>
                          <span className="font-semibold text-green-600">{fmt(p.valor)}</span>
                          <span className="text-gray-400 truncate">{p.obs}</span>
                        </div>
                      ))}
                      <div className="flex gap-2 mt-2">
                        <button onClick={()=>{setEditServico(s);setModal("servico");}} className="flex-1 py-1.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-lg">Editar</button>
                        <button
                          onClick={()=>{
                            setPendingDelete({ nome: s.prestador, onConfirm: () => deleteServico(s.id) });
                            setModal("confirmar");
                          }}
                          className="flex-1 py-1.5 bg-red-50 text-red-500 text-xs font-medium rounded-lg"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* MATERIAIS */}
        {tab === "materiais" && (
          <>
            <button onClick={()=>{setEditMaterial(undefined);setModal("material");}} className="w-full py-3 border border-dashed border-gray-200 rounded-xl text-sm text-gray-400 mb-3">
              + Novo material
            </button>
            {materiais.length === 0 && <p className="text-center text-gray-400 text-sm py-8">Nenhum material cadastrado.</p>}
            {materiais.map(m => {
              const p = totalPagoM(m), sl = saldoM(m), open = openCards[m.id];
              return (
                <div key={m.id} className="bg-white rounded-xl border border-gray-100 mb-2 overflow-hidden">
                  <div className="p-3 cursor-pointer" onClick={()=>setOpenCards(o=>({...o,[m.id]:!o[m.id]}))}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 text-sm truncate">{m.item}</p>
                        <p className="text-xs text-gray-400">{m.categoria}</p>
                      </div>
                      <Badge paid={p} total={m.valorTotal} />
                    </div>
                    <ProgressBar paid={p} total={m.valorTotal} />
                    <div className="flex justify-between text-xs mt-2">
                      <span className="text-gray-400">Total: <b className="text-gray-700">{fmt(m.valorTotal)}</b></span>
                      <span className="text-green-600">Pago: <b>{fmt(p)}</b></span>
                      <span className={sl>0.01?"text-red-500":"text-green-600"}>Falta: <b>{fmt(sl)}</b></span>
                    </div>
                  </div>
                  {open && (
                    <div className="border-t border-gray-50 px-3 py-2 bg-gray-50">
                      <p className="text-xs font-medium text-gray-400 mb-1">FORMAS DE PAGAMENTO</p>
                      {m.formasPagamento.length === 0 && <p className="text-xs text-gray-400">Nenhuma.</p>}
                      {m.formasPagamento.map(f=>(
                        <div key={f.id} className="flex gap-2 text-xs py-1 border-b border-gray-100 last:border-0">
                          <span className="text-gray-700 flex-1">{f.metodo}</span>
                          <span className="font-semibold text-green-600">{fmt(f.valor)}</span>
                        </div>
                      ))}
                      <div className="flex gap-2 mt-2">
                        <button onClick={()=>{setEditMaterial(m);setModal("material");}} className="flex-1 py-1.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-lg">Editar</button>
                        <button
                          onClick={()=>{
                            setPendingDelete({ nome: m.item, onConfirm: () => deleteMaterial(m.id) });
                            setModal("confirmar");
                          }}
                          className="flex-1 py-1.5 bg-red-50 text-red-500 text-xs font-medium rounded-lg"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

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
    </div>
  );
}
