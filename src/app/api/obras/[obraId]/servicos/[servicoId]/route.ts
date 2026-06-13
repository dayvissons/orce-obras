import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function checkAccess(obraId: string, userId: string) {
  return prisma.obraMember.findUnique({ where: { obraId_userId: { obraId, userId } } });
}

const servicoSchema = z.object({
  prestador: z.string().min(1),
  categoria: z.string(),
  valorTotal: z.number().finite().positive(),
  pagamentos: z.array(z.object({
    valor: z.number().positive(),
    data: z.string().min(1),
    obs: z.string().optional(),
  })).default([]),
});

export async function PUT(req: Request, { params }: { params: { obraId: string; servicoId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await checkAccess(params.obraId, session.user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsed = servicoSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Dados inválidos", details: parsed.error.issues }, { status: 400 });

    const existing = await prisma.servico.findFirst({
      where: { id: params.servicoId, obraId: params.obraId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    const { prestador, categoria, valorTotal, pagamentos } = parsed.data;
    await prisma.pagamento.deleteMany({ where: { servicoId: params.servicoId } });
    const servico = await prisma.servico.update({
      where: { id: params.servicoId },
      data: {
        prestador, categoria, valorTotal,
        pagamentos: {
          create: pagamentos.map((p) => ({
            valor: p.valor, data: new Date(p.data), obs: p.obs || null,
          })),
        },
      },
      include: { pagamentos: true },
    });
    return NextResponse.json(servico);
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { obraId: string; servicoId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await checkAccess(params.obraId, session.user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const result = await prisma.servico.deleteMany({ where: { id: params.servicoId, obraId: params.obraId } });
    if (result.count === 0) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
