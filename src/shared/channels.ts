/**
 * IPC Channel Definitions for secure renderer-main communication
 */
export const IPC_CHANNELS = {
  // Fonts
  FONTS_GET_ALL: 'fonts:get-all',
  FONTS_GET_BY_ID: 'fonts:get-by-id',
  FONTS_START_SCAN: 'fonts:start-scan',
  FONTS_CANCEL_SCAN: 'fonts:cancel-scan',
  FONTS_SCAN_PROGRESS: 'fonts:scan-progress',
  FONTS_TOGGLE_FAVORITE: 'fonts:toggle-favorite',
  FONTS_SET_FAVORITES_BATCH: 'fonts:set-favorites-batch',
  FONTS_DELETE: 'fonts:delete',

  // Collections
  COLLECTIONS_GET_ALL: 'collections:get-all',
  COLLECTIONS_CREATE: 'collections:create',
  COLLECTIONS_RENAME: 'collections:rename',
  COLLECTIONS_DELETE: 'collections:delete',
  COLLECTIONS_ADD_FONT: 'collections:add-font',
  COLLECTIONS_REMOVE_FONT: 'collections:remove-font',
  COLLECTIONS_ADD_FONTS_BATCH: 'collections:add-fonts-batch',
  COLLECTIONS_REMOVE_FONTS_BATCH: 'collections:remove-fonts-batch',

  // Tags
  TAGS_GET_ALL: 'tags:get-all',
  TAGS_CREATE: 'tags:create',
  TAGS_RENAME: 'tags:rename',
  TAGS_DELETE: 'tags:delete',
  TAGS_ADD_TO_FONT: 'tags:add-to-font',
  TAGS_REMOVE_FROM_FONT: 'tags:remove-from-font',
  TAGS_ADD_BATCH: 'tags:add-batch',
  TAGS_REMOVE_BATCH: 'tags:remove-batch',

  // Installation
  INSTALL_FONTS: 'install:fonts',
  UNINSTALL_FONTS: 'install:uninstall-fonts',
  INSTALL_TASK_PROGRESS: 'install:task-progress',
  INSTALL_CANCEL_TASK: 'install:cancel-task',
  INSTALL_GET_SCOPE_STATUS: 'install:get-scope-status',

  // Backup & Restore
  BACKUP_CREATE: 'backup:create',
  BACKUP_VERIFY: 'backup:verify',
  BACKUP_RESTORE: 'backup:restore',
  BACKUP_PROGRESS: 'backup:progress',
  BACKUP_CANCEL: 'backup:cancel',
  BACKUP_IMPORT_METADATA: 'backup:import-metadata',

  // Storage Analysis
  STORAGE_GET_ANALYSIS: 'storage:get-analysis',

  // Dialogs
  DIALOG_SELECT_FOLDER: 'dialog:select-folder',
  DIALOG_SELECT_FILE: 'dialog:select-file',
  DIALOG_SAVE_FILE: 'dialog:save-file',

  // System
  APP_GET_SYSTEM_INFO: 'app:get-system-info',
  APP_OPEN_PATH: 'app:open-path',
} as const;

