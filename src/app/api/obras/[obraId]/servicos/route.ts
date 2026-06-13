import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function checkAccess(obraId: string, userId: string) {
  return prisma.obraMember.findUnique({ where: { obraId_userId: { obraId, userId } } });
}

export async function GET(_: Request, { params }: { params: { obraId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await checkAccess(params.obraId, session.user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const servicos = await prisma.servico.findMany({
    where: { obraId: params.obraId },
    include: { pagamentos: { orderBy: { data: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(servicos);
}

export async function POST(req: Request, { params }: { params: { obraId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await checkAccess(params.obraId, session.user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { prestador, categoria, valorTotal, pagamentos } = await req.json();
  const servico = await prisma.servico.create({
    data: {
      obraId: params.obraId, prestador, categoria, valorTotal: Number(valorTotal),
      pagamentos: {
        create: (pagamentos || []).map((p: any) => ({
          valor: Number(p.valor), data: new Date(p.data), obs: p.obs || null,
        })),
      },
    },
    include: { pagamentos: true },
  });
  return NextResponse.json(servico, { status: 201 });
}
