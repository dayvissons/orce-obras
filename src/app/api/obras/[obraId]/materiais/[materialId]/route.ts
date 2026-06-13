import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function checkAccess(obraId: string, userId: string) {
  return prisma.obraMember.findUnique({ where: { obraId_userId: { obraId, userId } } });
}

const materialSchema = z.object({
  item: z.string().min(1),
  categoria: z.string(),
  valorTotal: z.number().finite().positive(),
  formasPagamento: z.array(z.object({
    metodo: z.string(),
    valor: z.number().positive(),
  })).default([]),
});

export async function PUT(req: Request, { params }: { params: { obraId: string; materialId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await checkAccess(params.obraId, session.user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsed = materialSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Dados inválidos", details: parsed.error.issues }, { status: 400 });

    const existing = await prisma.material.findFirst({
      where: { id: params.materialId, obraId: params.obraId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    const { item, categoria, valorTotal, formasPagamento } = parsed.data;
    await prisma.formaPagamento.deleteMany({ where: { materialId: params.materialId } });
    const material = await prisma.material.update({
      where: { id: params.materialId },
      data: {
        item, categoria, valorTotal,
        formasPagamento: {
          create: formasPagamento.map((f) => ({ metodo: f.metodo, valor: f.valor })),
        },
      },
      include: { formasPagamento: true },
    });
    return NextResponse.json(material);
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { obraId: string; materialId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await checkAccess(params.obraId, session.user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const result = await prisma.material.deleteMany({ where: { id: params.materialId, obraId: params.obraId } });
    if (result.count === 0) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
