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
  FONTS_DELETE: 'fonts:delete',

  // Collections
  COLLECTIONS_GET_ALL: 'collections:get-all',
  COLLECTIONS_CREATE: 'collections:create',
  COLLECTIONS_RENAME: 'collections:rename',
  COLLECTIONS_DELETE: 'collections:delete',
  COLLECTIONS_ADD_FONT: 'collections:add-font',
  COLLECTIONS_REMOVE_FONT: 'collections:remove-font',

  // Tags
  TAGS_GET_ALL: 'tags:get-all',
  TAGS_CREATE: 'tags:create',
  TAGS_ADD_TO_FONT: 'tags:add-to-font',
  TAGS_REMOVE_FROM_FONT: 'tags:remove-from-font',

  // Installation
  INSTALL_FONTS: 'install:fonts',
  UNINSTALL_FONTS: 'install:uninstall-fonts',
  INSTALL_TASK_PROGRESS: 'install:task-progress',
  INSTALL_CANCEL_TASK: 'install:cancel-task',

  // Backup & Restore
  BACKUP_CREATE: 'backup:create',
  BACKUP_VERIFY: 'backup:verify',
  BACKUP_RESTORE: 'backup:restore',
  BACKUP_PROGRESS: 'backup:progress',
  BACKUP_CANCEL: 'backup:cancel',

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

