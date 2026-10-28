import { ipcMain } from 'electron';
import * as crypto from 'crypto';
import { IPC_CHANNELS } from '../../shared/channels';
import { DatabaseService } from '../services/databaseService';

export function registerCollectionIpc(db: DatabaseService): void {
  // Collections
  ipcMain.handle(IPC_CHANNELS.COLLECTIONS_GET_ALL, async () => {
    return db.getAllCollections();
  });

  ipcMain.handle(IPC_CHANNELS.COLLECTIONS_CREATE, async (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') throw new Error('Invalid collection payload');
    const { name, description } = payload as { name: string; description?: string };
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new Error('Collection name is required');
    }
    const id = crypto.randomUUID();
    return db.createCollection(id, name.trim(), typeof description === 'string' ? description.trim() : '');
  });

  ipcMain.handle(IPC_CHANNELS.COLLECTIONS_RENAME, async (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') throw new Error('Invalid rename payload');
    const { id, newName } = payload as { id: string; newName: string };
    if (!id || typeof id !== 'string' || !newName || typeof newName !== 'string' || !newName.trim()) {
      throw new Error('Valid id and newName are required');
    }
    db.renameCollection(id.trim(), newName.trim());
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.COLLECTIONS_DELETE, async (_event, id: unknown) => {
    if (typeof id !== 'string' || !id.trim()) throw new Error('Invalid collection id');
    db.deleteCollection(id.trim());
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.COLLECTIONS_ADD_FONT, async (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') throw new Error('Invalid payload');
    const { fontId, collectionId } = payload as { fontId: string; collectionId: string };
    if (!fontId || !collectionId) throw new Error('fontId and collectionId are required');
    db.addFontToCollection(fontId.trim(), collectionId.trim());
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.COLLECTIONS_REMOVE_FONT, async (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') throw new Error('Invalid payload');
    const { fontId, collectionId } = payload as { fontId: string; collectionId: string };
    if (!fontId || !collectionId) throw new Error('fontId and collectionId are required');
    db.removeFontFromCollection(fontId.trim(), collectionId.trim());
    return { success: true };
  });

  // Tags
  ipcMain.handle(IPC_CHANNELS.TAGS_GET_ALL, async () => {
    return db.getAllTags();
  });

  ipcMain.handle(IPC_CHANNELS.TAGS_CREATE, async (_event, name: unknown) => {
    if (typeof name !== 'string' || !name.trim()) throw new Error('Tag name is required');
    const id = crypto.randomUUID();
    return db.getOrCreateTag(id, name.trim());
  });

  ipcMain.handle(IPC_CHANNELS.TAGS_ADD_TO_FONT, async (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') throw new Error('Invalid payload');
    const { fontId, tagId } = payload as { fontId: string; tagId: string };
    if (!fontId || !tagId) throw new Error('fontId and tagId are required');
    db.addTagToFont(fontId.trim(), tagId.trim());
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.TAGS_REMOVE_FROM_FONT, async (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') throw new Error('Invalid payload');
    const { fontId, tagId } = payload as { fontId: string; tagId: string };
    if (!fontId || !tagId) throw new Error('fontId and tagId are required');
    db.removeTagFromFont(fontId.trim(), tagId.trim());
    return { success: true };
  });
}

