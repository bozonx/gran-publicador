import { ConflictException, Injectable } from '@nestjs/common';

export interface PrismaDelegate {
  findUnique(args: Record<string, unknown>): Promise<unknown>;
  update(args: Record<string, unknown>): Promise<unknown>;
  updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
}

/**
 * Base abstract service providing common CRUD operations
 * to reduce boilerplate, including optimistic locking and soft deletes.
 */
@Injectable()
export abstract class BaseCrudService<T> {
  protected abstract get modelDelegate(): PrismaDelegate;

  /**
   * Updates a record using optimistic locking (versioning) if version is provided,
   * otherwise performs a standard update.
   */
  protected async updateWithVersion(
    id: string,
    version: number | undefined,
    data: Record<string, unknown>,
  ): Promise<T> {
    const updateData = { ...data };

    if (version !== undefined) {
      updateData.version = { increment: 1 };
      const result = await this.modelDelegate.updateMany({
        where: { id, version },
        data: updateData,
      });

      if (result.count === 0) {
        throw new ConflictException('Data was modified in another tab. Please refresh the page.');
      }

      const found = await this.modelDelegate.findUnique({ where: { id } });
      return found as T;
    }

    const updated = await this.modelDelegate.update({
      where: { id },
      data: updateData,
    });
    return updated as T;
  }

  /**
   * Soft deletes a record by setting archivedAt.
   */
  protected async archiveRecord(id: string, userId: string): Promise<T> {
    const updated = await this.modelDelegate.update({
      where: { id },
      data: { archivedAt: new Date(), archivedBy: userId },
    });
    return updated as T;
  }

  /**
   * Restores a soft-deleted record by clearing archivedAt.
   */
  protected async unarchiveRecord(id: string, _userId?: string): Promise<T> {
    const updated = await this.modelDelegate.update({
      where: { id },
      data: { archivedAt: null, archivedBy: null },
    });
    return updated as T;
  }
}
