"use client";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Obra = { id: string; nome: string; _count: { servicos: number; materiais: number } };

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [obras, setObras] = useState<Obra[]>([]);
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated") fetchObras();
  }, [status]);

  async function fetchObras() {
    const res = await fetch("/api/obras");
    if (res.ok) setObras(await res.json());
  }

  async function criarObra() {
    if (!nome.trim()) return;
    setLoading(true);
    const res = await fetch("/api/obras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome }),
    });
    if (res.ok) { setNome(""); await fetchObras(); }
    setLoading(false);
  }

  if (status === "loading") return <div className="min-h-screen flex items-center justify-center text-gray-400">Carregando...</div>;

  return (
    <div className="min-h-screen bg-[#F7F5F2] px-4 py-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">🏗️ Minhas Obras</h1>
          <p className="text-xs text-gray-400 mt-0.5">{session?.user?.name}</p>
        </div>
        <button onClick={() => signOut()} className="text-xs text-gray-400 hover:text-gray-600">Sair</button>
      </div>

      {/* Nova obra */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6">
        <p className="text-xs font-medium text-gray-500 mb-2">NOVA OBRA</p>
        <div className="flex gap-2">
          <input
            value={nome}
            onChange={e => setNome(e.target.value)}
            onKeyDown={e => e.key === "Enter" && criarObra()}
            placeholder="Ex: Apartamento Centro"
            className="flex-1 bg-gray-50 rounded-lg px-3 py-2 text-sm border border-gray-100 outline-none focus:ring-2 focus:ring-orange-200"
          />
          <button
            onClick={criarObra}
            disabled={loading}
            className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            Criar
          </button>
        </div>
      </div>

      {/* Lista de obras */}
      {obras.length === 0 && (
        <div className="text-center text-gray-400 text-sm py-12">Nenhuma obra cadastrada ainda.</div>
      )}
      <div className="space-y-3">
        {obras.map(o => (
          <button
            key={o.id}
            onClick={() => router.push(`/obras/${o.id}`)}
            className="w-full bg-white rounded-xl border border-gray-100 p-4 text-left hover:border-orange-200 transition"
          >
            <div className="font-medium text-gray-900">{o.nome}</div>
            <div className="text-xs text-gray-400 mt-1">
              {o._count.servicos} serviço(s) · {o._count.materiais} material(is)
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
