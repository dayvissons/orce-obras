import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function checkAccess(obraId: string, userId: string) {
  return prisma.obraMember.findUnique({ where: { obraId_userId: { obraId, userId } } });
}

export async function PUT(req: Request, { params }: { params: { obraId: string; servicoId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await checkAccess(params.obraId, session.user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { prestador, categoria, valorTotal, pagamentos } = await req.json();
  await prisma.pagamento.deleteMany({ where: { servicoId: params.servicoId } });
  const servico = await prisma.servico.update({
    where: { id: params.servicoId },
    data: {
      prestador, categoria, valorTotal: Number(valorTotal),
      pagamentos: {
        create: (pagamentos || []).map((p: any) => ({
          valor: Number(p.valor), data: new Date(p.data), obs: p.obs || null,
        })),
      },
    },
    include: { pagamentos: true },
  });
  return NextResponse.json(servico);
}

export async function DELETE(_: Request, { params }: { params: { obraId: string; servicoId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await checkAccess(params.obraId, session.user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.servico.delete({ where: { id: params.servicoId } });
  return NextResponse.json({ ok: true });
}
