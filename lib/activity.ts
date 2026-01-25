import { prisma } from '@/lib/prisma';
import type { ActivityType, EntityType, EventType, Prisma } from '@prisma/client';

interface CreateActivityParams {
  type: ActivityType;
  entityType: EntityType;
  eventType: EventType;
  message: string;
  serverId: number;
  containerId?: number;
  serviceId?: number;
  metadata?: Prisma.InputJsonValue;
}

export async function createActivity(params: CreateActivityParams) {
  return prisma.activity.create({
    data: {
      type: params.type,
      entityType: params.entityType,
      eventType: params.eventType,
      message: params.message,
      serverId: params.serverId,
      containerId: params.containerId,
      serviceId: params.serviceId,
      metadata: params.metadata ?? {},
    },
  });
}
