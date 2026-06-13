import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { obraId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verifica se é owner
  const member = await prisma.obraMember.findUnique({
    where: { obraId_userId: { obraId: params.obraId, userId: session.user.id } },
  });
  if (!member || member.role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email } = await req.json();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "Usuário não encontrado. Peça para a pessoa fazer login primeiro." }, { status: 404 });

  const existing = await prisma.obraMember.findUnique({
    where: { obraId_userId: { obraId: params.obraId, userId: user.id } },
  });
  if (existing) return NextResponse.json({ error: "Pessoa já tem acesso." }, { status: 409 });

  await prisma.obraMember.create({ data: { obraId: params.obraId, userId: user.id, role: "editor" } });
  return NextResponse.json({ ok: true });
}
