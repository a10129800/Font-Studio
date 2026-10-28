import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseService } from '../src/main/services/databaseService';
import { FontRecord } from '../src/shared/types';

describe('DatabaseService', () => {
  let dbService: DatabaseService;
  let tempDbPath: string;

  beforeEach(() => {
    tempDbPath = path.join(os.tmpdir(), `font_studio_test_${Date.now()}_${Math.random().toString(36).slice(2)}.db`);
    dbService = new DatabaseService(tempDbPath);
  });

  afterEach(() => {
    dbService.close();
    if (fs.existsSync(tempDbPath)) {
      try {
        fs.unlinkSync(tempDbPath);
      } catch {}
    }
  });

  it('initializes schema and runs migrations properly', () => {
    const fontsResult = dbService.getFonts();
    expect(fontsResult.fonts).toEqual([]);
    expect(fontsResult.total).toBe(0);
    const collections = dbService.getAllCollections();
    expect(collections).toEqual([]);
  });

  it('upserts and retrieves font records without losing fields', () => {
    const font: FontRecord = {
      id: 'f1-test-uuid',
      family_name: 'Test Sans',
      localized_name: '測試黑體',
      full_name: 'Test Sans Bold (測試黑體)',
      style_name: 'Bold',
      postscript_name: 'TestSans-Bold',
      file_path: 'C:\\Fonts\\testsans-bold.ttf',
      format: 'ttf',
      file_size: 102400,
      sha256: 'abc123sha256hash',
      source_type: 'imported',
      install_scope: 'uninstalled',
      scan_status: 'valid',
      face_index: 0,
      face_count: 1,
      is_missing: false,
      version: '1.0.0',
      designer: 'Jane Doe',
      copyright: 'Copyright 2026',
      glyph_count: 500,
      character_count: 450,
      unicode_ranges: ['Basic Latin', 'Latin-1 Supplement'],
      last_scanned_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    dbService.upsertFont(font);
    const retrieved = dbService.getFontById('f1-test-uuid');
    expect(retrieved).toBeDefined();
    expect(retrieved?.family_name).toBe('Test Sans');
    expect(retrieved?.localized_name).toBe('測試黑體');
    expect(retrieved?.style_name).toBe('Bold');
    expect(retrieved?.unicode_ranges).toEqual(['Basic Latin', 'Latin-1 Supplement']);
    expect(retrieved?.is_favorite).toBe(false);
  });

  it('supports collections, tags, and favorites with foreign keys', () => {
    const font: FontRecord = {
      id: 'f2-test-uuid',
      family_name: 'Serif Pro',
      style_name: 'Regular',
      file_path: 'C:\\Fonts\\serif.otf',
      format: 'otf',
      file_size: 204800,
      sha256: 'def456sha256hash',
      source_type: 'user',
      install_scope: 'user',
      scan_status: 'valid',
      face_index: 0,
      face_count: 1,
      is_missing: false,
      last_scanned_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    dbService.upsertFont(font);

    // Favorites
    expect(dbService.isFavorite(font.id)).toBe(false);
    expect(dbService.toggleFavorite(font.id)).toBe(true);
    expect(dbService.isFavorite(font.id)).toBe(true);

    // Collections
    const col = dbService.createCollection('col-1', 'Editorial Favorites', 'For books');
    expect(col.name).toBe('Editorial Favorites');
    dbService.addFontToCollection(font.id, col.id);

    // Tags
    const tag = dbService.getOrCreateTag('tag-1', 'geometric');
    dbService.addTagToFont(font.id, tag.id);

    // Verify relations retrieved with font
    const loaded = dbService.getFontById(font.id);
    expect(loaded?.is_favorite).toBe(true);
    expect(loaded?.collection_ids).toContain('col-1');
    expect(loaded?.tags).toContain('geometric');
  });

  it('maintains stability when re-indexing fonts', () => {
    const font: FontRecord = {
      id: 'stable-id-123',
      family_name: 'Stable Font',
      style_name: 'Regular',
      file_path: 'C:\\Fonts\\stable.ttf',
      format: 'ttf',
      file_size: 50000,
      sha256: 'stablehash',
      source_type: 'user',
      install_scope: 'user',
      scan_status: 'valid',
      face_index: 0,
      face_count: 1,
      is_missing: false,
      last_scanned_at: '2026-01-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
    };
    dbService.upsertFont(font);
    dbService.toggleFavorite(font.id);

    // Re-indexing font updates scan time and file size, but keeps same ID and favorite
    const rescannedFont: FontRecord = {
      ...font,
      file_size: 50100,
      last_scanned_at: '2026-10-28T00:00:00.000Z',
    };
    dbService.upsertFont(rescannedFont);

    const reloaded = dbService.getFontById('stable-id-123');
    expect(reloaded?.file_size).toBe(50100);
    expect(reloaded?.is_favorite).toBe(true);
  });

  it('supports pagination, sorting, and localized Chinese search', () => {
    // Insert 5 fonts
    for (let i = 1; i <= 5; i++) {
      dbService.upsertFont({
        id: `font-${i}`,
        family_name: `Alphabet ${i}`,
        localized_name: i === 3 ? '蘭亭黑體' : undefined,
        style_name: 'Regular',
        file_path: `C:\\Fonts\\font${i}.ttf`,
        format: 'ttf',
        file_size: i * 10000,
        sha256: `hash-${i}`,
        source_type: 'system',
        install_scope: 'system',
        scan_status: 'valid',
        face_index: 0,
        face_count: 1,
        is_missing: false,
        last_scanned_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
    }

    // 1. Pagination: page 1 with pageSize 2
    const page1 = dbService.getFonts({ page: 1, pageSize: 2 });
    expect(page1.total).toBe(5);
    expect(page1.totalPages).toBe(3);
    expect(page1.fonts).toHaveLength(2);
    expect(page1.fonts[0].family_name).toBe('Alphabet 1');

    // 2. Localized Chinese search
    const searchRes = dbService.getFonts({ searchQuery: '蘭亭' });
    expect(searchRes.total).toBe(1);
    expect(searchRes.fonts[0].id).toBe('font-3');

    // 3. Sorting by file_size descending
    const sortedRes = dbService.getFonts({ sortBy: 'file_size', sortOrder: 'desc' });
    expect(sortedRes.fonts[0].file_size).toBe(50000);
  });
});

