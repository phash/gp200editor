import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/session';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { ratePresetSchema } from '@/lib/validators';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyCsrf(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { user } = await validateSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = ratePresetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const preset = await prisma.preset.findUnique({
    where: { id },
    select: { userId: true, public: true },
  });
  if (!preset || !preset.public) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (preset.userId === user.id) {
    return NextResponse.json({ error: 'Cannot rate your own preset' }, { status: 403 });
  }

  const { score } = parsed.data;

  // Upsert rating + update denormalized avg/count in a transaction
  await prisma.$transaction(async (tx) => {
    await tx.presetRating.upsert({
      where: { presetId_userId: { presetId: id, userId: user.id } },
      create: { presetId: id, userId: user.id, score },
      update: { score },
    });

    const agg = await tx.presetRating.aggregate({
      where: { presetId: id },
      _avg: { score: true },
      _count: { score: true },
    });

    await tx.preset.update({
      where: { id },
      data: {
        ratingAverage: agg._avg.score ?? 0,
        ratingCount: agg._count.score,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
