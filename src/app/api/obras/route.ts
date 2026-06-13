import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const obraSchema = z.object({
  nome: z.string().min(1).max(200),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const obras = await prisma.obra.findMany({
      where: { members: { some: { userId: session.user.id } } },
      include: {
        members: { include: { user: { select: { name: true, email: true, image: true } } } },
        _count: { select: { servicos: true, materiais: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(obras);
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parsed = obraSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Dados inválidos", details: parsed.error.issues }, { status: 400 });

    const obra = await prisma.obra.create({
      data: { nome: parsed.data.nome, members: { create: { userId: session.user.id, role: "owner" } } },
    });
    return NextResponse.json(obra, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
