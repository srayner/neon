import { connection } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function listContainers(serverId: number) {
  await connection();
  return prisma.container.findMany({
    where: {
      serverId,
    },
    orderBy: {
      name: 'asc',
    },
  });
}
