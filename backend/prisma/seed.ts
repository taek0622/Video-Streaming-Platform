import { PrismaClient, VideoStatus, VideoVisibility } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const seedUserId = 'seed-user-1';
  const seedVideoId = 'seed-video-1';

  const user = await prisma.user.upsert({
    where: { id: seedUserId },
    update: {
      nickname: 'seed_user',
    },
    create: {
      id: seedUserId,
      nickname: 'seed_user',
    },
  });

  await prisma.video.upsert({
    where: { id: seedVideoId },
    update: {
      uploaderId: user.id,
      title: 'Seed Video',
      description: 'Seeded example video row',
      thumbnailUrl: 'https://example.com/thumbnail.jpg',
      status: VideoStatus.READY,
      visibility: VideoVisibility.PUBLIC,
    },
    create: {
      id: seedVideoId,
      uploaderId: user.id,
      title: 'Seed Video',
      description: 'Seeded example video row',
      thumbnailUrl: 'https://example.com/thumbnail.jpg',
      status: VideoStatus.READY,
      visibility: VideoVisibility.PUBLIC,
    },
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
