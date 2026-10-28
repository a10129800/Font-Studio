import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseService } from '../src/main/services/databaseService';
import { FontRecord } from '../src/shared/types';

describe('Milestone M2-A: Collections, Tags, and Favorites Suite', () => {
  let dbService: DatabaseService;
  let tempDbPath: string;

  const mockFont1: FontRecord = {
    id: 'font-1',
    family_name: 'Noto Sans TC',
    localized_name: '思源黑體 臺灣',
    style_name: 'Regular',
    file_path: 'C:\\Fonts\\NotoSansTC-Regular.otf',
    format: 'otf',
    file_size: 1000000,
    sha256: 'sha256-noto-regular',
    source_type: 'imported',
    install_scope: 'uninstalled',
    scan_status: 'valid',
    face_index: 0,
    face_count: 1,
    is_missing: false,
    last_scanned_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  const mockFont2: FontRecord = {
    id: 'font-2',
    family_name: 'Noto Serif TC',
    localized_name: '思源宋體 臺灣',
    style_name: 'Bold',
    file_path: 'C:\\Fonts\\NotoSerifTC-Bold.otf',
    format: 'otf',
    file_size: 1200000,
    sha256: 'sha256-noto-serif-bold',
    source_type: 'imported',
    install_scope: 'uninstalled',
    scan_status: 'valid',
    face_index: 0,
    face_count: 1,
    is_missing: false,
    last_scanned_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  const mockFont3: FontRecord = {
    id: 'font-3',
    family_name: 'Roboto',
    style_name: 'Light',
    file_path: 'C:\\Fonts\\Roboto-Light.ttf',
    format: 'ttf',
    file_size: 300000,
    sha256: 'sha256-roboto-light',
    source_type: 'imported',
    install_scope: 'uninstalled',
    scan_status: 'valid',
    face_index: 0,
    face_count: 1,
    is_missing: false,
    last_scanned_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    tempDbPath = path.join(
      os.tmpdir(),
      `font_studio_m2a_${Date.now()}_${Math.random().toString(36).slice(2)}.db`
    );
    dbService = new DatabaseService(tempDbPath);
    dbService.upsertFontsBatch([mockFont1, mockFont2, mockFont3]);
  });

  afterEach(() => {
    dbService.close();
    if (fs.existsSync(tempDbPath)) {
      try {
        fs.unlinkSync(tempDbPath);
      } catch {}
    }
  });

  // ==================== Collections ====================
  it('creates, renames, and retrieves custom collections with font counts', () => {
    const col = dbService.createCollection('col-1', '2026 品牌識別', '品牌主體字體');
    expect(col.id).toBe('col-1');
    expect(col.name).toBe('2026 品牌識別');
    expect(col.font_count).toBe(0);

    // Rename collection
    dbService.renameCollection('col-1', '2026 全球視覺識別');
    const updated = dbService.getCollection('col-1');
    expect(updated?.name).toBe('2026 全球視覺識別');

    const all = dbService.getAllCollections();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('2026 全球視覺識別');
  });

  it('adds and removes single & batch fonts in collections with cascade on delete', () => {
    dbService.createCollection('col-web', 'Web Fonts');

    // Batch add font-1 and font-2
    dbService.addFontsToCollection(['font-1', 'font-2'], 'col-web');

    let col = dbService.getCollection('col-web');
    expect(col?.font_count).toBe(2);

    let f1Cols = dbService.getFontCollectionIds('font-1');
    expect(f1Cols).toContain('col-web');

    // Batch remove font-1
    dbService.removeFontsFromCollection(['font-1'], 'col-web');
    col = dbService.getCollection('col-web');
    expect(col?.font_count).toBe(1);

    // Deleting collection cascades and leaves no orphaned mappings
    dbService.deleteCollection('col-web');
    expect(dbService.getCollection('col-web')).toBeUndefined();
    f1Cols = dbService.getFontCollectionIds('font-2');
    expect(f1Cols).not.toContain('col-web');
  });

  // ==================== Tags ====================
  it('manages tags idempotently, supports rename, delete and batch assignments', () => {
    const tag1 = dbService.getOrCreateTag('tag-sans', '黑體風格');
    const tag1Duplicate = dbService.getOrCreateTag('tag-sans-2', '黑體風格');
    expect(tag1Duplicate.id).toBe(tag1.id); // Idempotent

    const tag2 = dbService.getOrCreateTag('tag-modern', '現代感');

    // Batch add tags to fonts
    dbService.addTagToFonts(['font-1', 'font-3'], tag1.id);
    dbService.addTagToFonts(['font-1'], tag2.id);

    const f1Tags = dbService.getFontTagNames('font-1');
    expect(f1Tags).toEqual(expect.arrayContaining(['黑體風格', '現代感']));

    const f3Tags = dbService.getFontTagNames('font-3');
    expect(f3Tags).toEqual(['黑體風格']);

    // Rename tag
    dbService.renameTag(tag1.id, '無襯線黑體');
    const updatedTags = dbService.getFontTagNames('font-1');
    expect(updatedTags).toContain('無襯線黑體');

    // Batch remove tags
    dbService.removeTagFromFonts(['font-1'], tag1.id);
    const afterRemoveTags = dbService.getFontTagNames('font-1');
    expect(afterRemoveTags).not.toContain('無襯線黑體');

    // Deleting tag cascades properly
    dbService.deleteTag(tag2.id);
    const finalTags = dbService.getFontTagNames('font-1');
    expect(finalTags).toHaveLength(0);
  });

  // ==================== Favorites ====================
  it('toggles and batch updates favorites', () => {
    expect(dbService.isFavorite('font-1')).toBe(false);

    // Toggle on
    const status1 = dbService.toggleFavorite('font-1');
    expect(status1).toBe(true);
    expect(dbService.isFavorite('font-1')).toBe(true);

    // Toggle off
    const status2 = dbService.toggleFavorite('font-1');
    expect(status2).toBe(false);
    expect(dbService.isFavorite('font-1')).toBe(false);

    // Batch favorite
    dbService.setFavoritesBatch(['font-1', 'font-2', 'font-3'], true);
    expect(dbService.isFavorite('font-1')).toBe(true);
    expect(dbService.isFavorite('font-2')).toBe(true);
    expect(dbService.isFavorite('font-3')).toBe(true);

    // Batch unfavorite
    dbService.setFavoritesBatch(['font-2'], false);
    expect(dbService.isFavorite('font-2')).toBe(false);
    expect(dbService.isFavorite('font-1')).toBe(true);
  });

  // ==================== Search & Filter Combinations ====================
  it('combines collection, tag, and search query filters seamlessly', () => {
    dbService.createCollection('col-editorial', '社論專用');
    dbService.addFontsToCollection(['font-1', 'font-2'], 'col-editorial');

    const tagSerif = dbService.getOrCreateTag('t-serif', '襯線');
    dbService.addTagToFont('font-2', tagSerif.id);

    // Filter by collection only -> font-1, font-2
    const inCol = dbService.getFonts({ collectionId: 'col-editorial' });
    expect(inCol.total).toBe(2);

    // Combine collection + search query "宋體" -> only font-2
    const colPlusSearch = dbService.getFonts({
      collectionId: 'col-editorial',
      searchQuery: '宋體',
    });
    expect(colPlusSearch.total).toBe(1);
    expect(colPlusSearch.fonts[0].id).toBe('font-2');

    // Combine tag + format
    const tagPlusFormat = dbService.getFonts({
      tagId: tagSerif.id,
      format: 'otf',
    });
    expect(tagPlusFormat.total).toBe(1);
    expect(tagPlusFormat.fonts[0].id).toBe('font-2');
  });
});
