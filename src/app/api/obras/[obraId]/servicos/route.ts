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
    obs: z.string().nullish(),
  })).default([]),
});

export async function GET(_: Request, { params }: { params: { obraId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await checkAccess(params.obraId, session.user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const servicos = await prisma.servico.findMany({
      where: { obraId: params.obraId },
      include: { pagamentos: { orderBy: { data: "asc" } } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(servicos);
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { obraId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await checkAccess(params.obraId, session.user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsed = servicoSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Dados inválidos", details: parsed.error.issues }, { status: 400 });

    const { prestador, categoria, valorTotal, pagamentos } = parsed.data;
    const servico = await prisma.servico.create({
      data: {
        obraId: params.obraId, prestador, categoria, valorTotal,
        pagamentos: {
          create: pagamentos.map((p) => ({
            valor: p.valor, data: new Date(p.data), obs: p.obs || null,
          })),
        },
      },
      include: { pagamentos: true },
    });
    return NextResponse.json(servico, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
