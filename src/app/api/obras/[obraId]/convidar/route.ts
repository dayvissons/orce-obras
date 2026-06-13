import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const convidarSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request, { params }: { params: { obraId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const member = await prisma.obraMember.findUnique({
      where: { obraId_userId: { obraId: params.obraId, userId: session.user.id } },
    });
    if (!member || member.role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsed = convidarSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Dados inválidos", details: parsed.error.issues }, { status: 400 });

    const { email } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: "Usuário não encontrado. Peça para a pessoa fazer login primeiro." }, { status: 404 });

    const existing = await prisma.obraMember.findUnique({
      where: { obraId_userId: { obraId: params.obraId, userId: user.id } },
    });
    if (existing) return NextResponse.json({ error: "Pessoa já tem acesso." }, { status: 409 });

    await prisma.obraMember.create({ data: { obraId: params.obraId, userId: user.id, role: "editor" } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
