import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
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
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { nome } = await req.json();
  const obra = await prisma.obra.create({
    data: { nome, members: { create: { userId: session.user.id, role: "owner" } } },
  });
  return NextResponse.json(obra, { status: 201 });
}
