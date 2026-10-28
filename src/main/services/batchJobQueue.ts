import * as crypto from 'crypto';
import {
  FontRecord,
  BatchTaskProgressUpdate,
  OperationType,
  OperationRecord,
} from '../../shared/types';
import { DatabaseService } from './databaseService';
import { FontInstallService } from './fontInstallService';

export type TaskProgressCallback = (update: BatchTaskProgressUpdate) => void;

export class BatchJobQueue {
  private db: DatabaseService;
  private installService: FontInstallService;
  private activeCancellations: Set<string> = new Set();

  constructor(db: DatabaseService, installService: FontInstallService) {
    this.db = db;
    this.installService = installService;
  }

  /**
   * Cancels a running batch task by ID.
   */
  public cancelTask(taskId: string): boolean {
    this.activeCancellations.add(taskId);
    return true;
  }

  /**
   * Executes a batch installation task.
   */
  public async executeInstallBatch(
    fonts: FontRecord[],
    onProgress?: TaskProgressCallback
  ): Promise<BatchTaskProgressUpdate> {
    const taskId = crypto.randomUUID();
    const total = fonts.length;

    // 1. Initialize operation in database
    const opRecord: OperationRecord = {
      id: taskId,
      operation_type: 'install',
      status: 'running',
      total_count: total,
      success_count: 0,
      failed_count: 0,
      skipped_count: 0,
      started_at: new Date().toISOString(),
    };
    this.db.createOperation(opRecord);

    const state: BatchTaskProgressUpdate = {
      taskId,
      type: 'install',
      phase: 'preparing',
      total,
      current: 0,
      currentItem: '',
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      errors: [],
    };

    onProgress?.({ ...state });

    state.phase = 'processing';

    // 2. Process each font sequentially with cancellation checkpoints
    for (let i = 0; i < total; i++) {
      if (this.activeCancellations.has(taskId)) {
        this.activeCancellations.delete(taskId);
        state.phase = 'cancelled';
        this.db.updateOperation(taskId, {
          status: 'cancelled',
          success_count: state.successCount,
          failed_count: state.failedCount,
          skipped_count: state.skippedCount,
          completed_at: new Date().toISOString(),
          error_summary: 'Task was cancelled by user',
        });
        onProgress?.({ ...state });
        return state;
      }

      const font = fonts[i];
      const fontLabel = font.localized_name || font.family_name || font.file_path;
      state.current = i + 1;
      state.currentItem = fontLabel;
      onProgress?.({ ...state });

      try {
        const result = await this.installService.installFontUserScope(font);
        if (result.success) {
          if (result.alreadyInstalled) {
            state.skippedCount++;
            this.db.addOperationLog({
              id: crypto.randomUUID(),
              operation_id: taskId,
              item_target: fontLabel,
              status: 'skipped',
              message: '字體已安裝於使用者字體庫',
              created_at: new Date().toISOString(),
            });
          } else {
            state.successCount++;
            this.db.addOperationLog({
              id: crypto.randomUUID(),
              operation_id: taskId,
              item_target: fontLabel,
              status: 'success',
              message: `已成功安裝至: ${result.installedPath}`,
              created_at: new Date().toISOString(),
            });
          }
        } else {
          state.failedCount++;
          const errorMsg = result.error || '安裝失敗';
          state.errors.push({ item: fontLabel, error: errorMsg });
          this.db.addOperationLog({
            id: crypto.randomUUID(),
            operation_id: taskId,
            item_target: fontLabel,
            status: 'failed',
            message: errorMsg,
            created_at: new Date().toISOString(),
          });
        }
      } catch (itemErr: any) {
        state.failedCount++;
        const errorMsg = itemErr?.message || String(itemErr);
        state.errors.push({ item: fontLabel, error: errorMsg });
        this.db.addOperationLog({
          id: crypto.randomUUID(),
          operation_id: taskId,
          item_target: fontLabel,
          status: 'failed',
          message: errorMsg,
          created_at: new Date().toISOString(),
        });
      }
    }

    // 3. Mark completed
    this.activeCancellations.delete(taskId);
    state.phase = state.failedCount > 0 && state.successCount === 0 ? 'error' : 'completed';

    this.db.updateOperation(taskId, {
      status: state.phase === 'error' ? 'failed' : 'completed',
      success_count: state.successCount,
      failed_count: state.failedCount,
      skipped_count: state.skippedCount,
      completed_at: new Date().toISOString(),
      error_summary:
        state.errors.length > 0 ? `${state.errors.length} 個字體安裝失敗` : undefined,
    });

    onProgress?.({ ...state });
    return state;
  }

  /**
   * Executes a batch uninstallation task.
   */
  public async executeUninstallBatch(
    fonts: FontRecord[],
    onProgress?: TaskProgressCallback
  ): Promise<BatchTaskProgressUpdate> {
    const taskId = crypto.randomUUID();
    const total = fonts.length;

    // 1. Initialize operation in database
    const opRecord: OperationRecord = {
      id: taskId,
      operation_type: 'uninstall',
      status: 'running',
      total_count: total,
      success_count: 0,
      failed_count: 0,
      skipped_count: 0,
      started_at: new Date().toISOString(),
    };
    this.db.createOperation(opRecord);

    const state: BatchTaskProgressUpdate = {
      taskId,
      type: 'uninstall',
      phase: 'preparing',
      total,
      current: 0,
      currentItem: '',
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      errors: [],
    };

    onProgress?.({ ...state });

    state.phase = 'processing';

    // 2. Process each font sequentially with cancellation checkpoints
    for (let i = 0; i < total; i++) {
      if (this.activeCancellations.has(taskId)) {
        this.activeCancellations.delete(taskId);
        state.phase = 'cancelled';
        this.db.updateOperation(taskId, {
          status: 'cancelled',
          success_count: state.successCount,
          failed_count: state.failedCount,
          skipped_count: state.skippedCount,
          completed_at: new Date().toISOString(),
          error_summary: 'Task was cancelled by user',
        });
        onProgress?.({ ...state });
        return state;
      }

      const font = fonts[i];
      const fontLabel = font.localized_name || font.family_name || font.file_path;
      state.current = i + 1;
      state.currentItem = fontLabel;
      onProgress?.({ ...state });

      try {
        const result = await this.installService.uninstallFontUserScope(font);
        if (result.success) {
          state.successCount++;
          this.db.addOperationLog({
            id: crypto.randomUUID(),
            operation_id: taskId,
            item_target: fontLabel,
            status: 'success',
            message: result.requiresReboot
              ? '已移除登錄項目（檔案將於系統重啟後刪除）'
              : '已成功卸載',
            created_at: new Date().toISOString(),
          });
        } else {
          state.failedCount++;
          const errorMsg = result.error || '卸載失敗';
          state.errors.push({ item: fontLabel, error: errorMsg });
          this.db.addOperationLog({
            id: crypto.randomUUID(),
            operation_id: taskId,
            item_target: fontLabel,
            status: 'failed',
            message: errorMsg,
            created_at: new Date().toISOString(),
          });
        }
      } catch (itemErr: any) {
        state.failedCount++;
        const errorMsg = itemErr?.message || String(itemErr);
        state.errors.push({ item: fontLabel, error: errorMsg });
        this.db.addOperationLog({
          id: crypto.randomUUID(),
          operation_id: taskId,
          item_target: fontLabel,
          status: 'failed',
          message: errorMsg,
          created_at: new Date().toISOString(),
        });
      }
    }

    // 3. Mark completed
    this.activeCancellations.delete(taskId);
    state.phase = state.failedCount > 0 && state.successCount === 0 ? 'error' : 'completed';

    this.db.updateOperation(taskId, {
      status: state.phase === 'error' ? 'failed' : 'completed',
      success_count: state.successCount,
      failed_count: state.failedCount,
      skipped_count: state.skippedCount,
      completed_at: new Date().toISOString(),
      error_summary:
        state.errors.length > 0 ? `${state.errors.length} 個字體卸載失敗` : undefined,
    });

    onProgress?.({ ...state });
    return state;
  }
}
