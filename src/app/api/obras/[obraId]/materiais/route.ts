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

export async function GET(_: Request, { params }: { params: { obraId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await checkAccess(params.obraId, session.user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const materiais = await prisma.material.findMany({
      where: { obraId: params.obraId },
      include: { formasPagamento: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(materiais);
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { obraId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await checkAccess(params.obraId, session.user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsed = materialSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Dados inválidos", details: parsed.error.issues }, { status: 400 });

    const { item, categoria, valorTotal, formasPagamento } = parsed.data;
    const material = await prisma.material.create({
      data: {
        obraId: params.obraId, item, categoria, valorTotal,
        formasPagamento: {
          create: formasPagamento.map((f) => ({ metodo: f.metodo, valor: f.valor })),
        },
      },
      include: { formasPagamento: true },
    });
    return NextResponse.json(material, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
