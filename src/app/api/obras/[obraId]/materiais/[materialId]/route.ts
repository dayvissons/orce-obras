import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function checkAccess(obraId: string, userId: string) {
  return prisma.obraMember.findUnique({ where: { obraId_userId: { obraId, userId } } });
}

export async function PUT(req: Request, { params }: { params: { obraId: string; materialId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await checkAccess(params.obraId, session.user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { item, categoria, valorTotal, formasPagamento } = await req.json();
  await prisma.formaPagamento.deleteMany({ where: { materialId: params.materialId } });
  const material = await prisma.material.update({
    where: { id: params.materialId },
    data: {
      item, categoria, valorTotal: Number(valorTotal),
      formasPagamento: {
        create: (formasPagamento || []).map((f: any) => ({ metodo: f.metodo, valor: Number(f.valor) })),
      },
    },
    include: { formasPagamento: true },
  });
  return NextResponse.json(material);
}

export async function DELETE(_: Request, { params }: { params: { obraId: string; materialId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await checkAccess(params.obraId, session.user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.material.delete({ where: { id: params.materialId } });
  return NextResponse.json({ ok: true });
}
