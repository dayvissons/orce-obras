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
  const materiais = await prisma.material.findMany({
    where: { obraId: params.obraId },
    include: { formasPagamento: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(materiais);
}

export async function POST(req: Request, { params }: { params: { obraId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await checkAccess(params.obraId, session.user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { item, categoria, valorTotal, formasPagamento } = await req.json();
  const material = await prisma.material.create({
    data: {
      obraId: params.obraId, item, categoria, valorTotal: Number(valorTotal),
      formasPagamento: {
        create: (formasPagamento || []).map((f: any) => ({ metodo: f.metodo, valor: Number(f.valor) })),
      },
    },
    include: { formasPagamento: true },
  });
  return NextResponse.json(material, { status: 201 });
}
