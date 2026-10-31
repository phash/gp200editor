import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/withAdminAuth';
import { prisma } from '@/lib/prisma';
import { feedbackStatusSchema } from '@/lib/feedbackValidators';

export const PATCH = withAdminAuth<{ id: string }>(async (request, { params }) => {
  const { id } = await params;
  const parsed = feedbackStatusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const existing = await prisma.feedback.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const feedback = await prisma.feedback.update({
    where: { id },
    data: { status: parsed.data.status },
    select: { id: true, status: true },
  });
  return NextResponse.json({ feedback });
});
