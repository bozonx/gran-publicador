import { jest } from '@jest/globals';

export const createPrismaMock = () => ({
  publication: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    findFirst: jest.fn(),
  },
  post: {
    create: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
    count: jest.fn(),
  },
  project: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  channel: {
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  projectTemplate: {
    findFirst: jest.fn(),
  },
  tag: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  // Add other models as needed
});

export type PrismaMock = ReturnType<typeof createPrismaMock>;
