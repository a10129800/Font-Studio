import Database, { Database as DatabaseType } from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import {
  FontRecord,
  FontQueryResult,
  CollectionRecord,
  TagRecord,
  OperationRecord,
  OperationLogEntry,
  FontFilterOptions,
  FontSourceType,
  InstallScope,
  BackupManifest,
} from '../../shared/types';

export class DatabaseService {
  private db: DatabaseType;
  private dbPath: string;

  constructor(customPath?: string) {
    if (customPath) {
      this.dbPath = customPath;
    } else {
      const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : '/var/local');
      const dir = path.join(appData, 'FontStudio');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.dbPath = path.join(dir, 'font_studio.db');
    }

    this.db = new Database(this.dbPath);
    this.initPragmas();
    this.runMigrations();
  }

  private initPragmas(): void {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('synchronous = NORMAL');
  }

  private runMigrations(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const currentVersionRow = this.db.prepare(
      'SELECT MAX(version) as version FROM schema_migrations'
    ).get() as { version: number | null };

    const currentVersion = currentVersionRow?.version ?? 0;

    if (currentVersion < 1) {
      this.applyMigration1();
    }
    if (currentVersion < 2) {
      this.applyMigration2();
    }
  }

  private applyMigration1(): void {
    const migration = this.db.transaction(() => {
      this.db.exec(`
        -- Fonts table
        CREATE TABLE IF NOT EXISTS fonts (
          id TEXT PRIMARY KEY,
          family_name TEXT NOT NULL,
          style_name TEXT NOT NULL,
          postscript_name TEXT,
          file_path TEXT NOT NULL,
          format TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          sha256 TEXT NOT NULL,
          source_type TEXT NOT NULL,
          install_scope TEXT NOT NULL,
          scan_status TEXT NOT NULL,
          version TEXT,
          designer TEXT,
          copyright TEXT,
          glyph_count INTEGER,
          character_count INTEGER,
          unicode_ranges TEXT,
          last_scanned_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_fonts_sha256 ON fonts(sha256);
        CREATE INDEX IF NOT EXISTS idx_fonts_family ON fonts(family_name);
        CREATE INDEX IF NOT EXISTS idx_fonts_path ON fonts(file_path);
        CREATE INDEX IF NOT EXISTS idx_fonts_scope ON fonts(install_scope);
        CREATE INDEX IF NOT EXISTS idx_fonts_source ON fonts(source_type);

        -- Collections table
        CREATE TABLE IF NOT EXISTS collections (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT DEFAULT '',
          created_at TEXT NOT NULL
        );

        -- Font collections mapping table
        CREATE TABLE IF NOT EXISTS font_collections (
          font_id TEXT NOT NULL,
          collection_id TEXT NOT NULL,
          PRIMARY KEY (font_id, collection_id),
          FOREIGN KEY (font_id) REFERENCES fonts(id) ON DELETE CASCADE,
          FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
        );

        -- Tags table
        CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE
        );

        -- Font tags mapping table
        CREATE TABLE IF NOT EXISTS font_tags (
          font_id TEXT NOT NULL,
          tag_id TEXT NOT NULL,
          PRIMARY KEY (font_id, tag_id),
          FOREIGN KEY (font_id) REFERENCES fonts(id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        );

        -- Favorites table
        CREATE TABLE IF NOT EXISTS favorites (
          font_id TEXT PRIMARY KEY,
          created_at TEXT NOT NULL,
          FOREIGN KEY (font_id) REFERENCES fonts(id) ON DELETE CASCADE
        );

        -- Operations tracking table
        CREATE TABLE IF NOT EXISTS operations (
          id TEXT PRIMARY KEY,
          operation_type TEXT NOT NULL,
          status TEXT NOT NULL,
          total_count INTEGER NOT NULL DEFAULT 0,
          success_count INTEGER NOT NULL DEFAULT 0,
          failed_count INTEGER NOT NULL DEFAULT 0,
          skipped_count INTEGER NOT NULL DEFAULT 0,
          started_at TEXT NOT NULL,
          completed_at TEXT,
          error_summary TEXT
        );

        -- Operation log entries
        CREATE TABLE IF NOT EXISTS operation_logs (
          id TEXT PRIMARY KEY,
          operation_id TEXT NOT NULL,
          item_target TEXT NOT NULL,
          status TEXT NOT NULL,
          message TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (operation_id) REFERENCES operations(id) ON DELETE CASCADE
        );

        -- Backup jobs table
        CREATE TABLE IF NOT EXISTS backup_jobs (
          id TEXT PRIMARY KEY,
          destination_path TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          verified_at TEXT,
          manifest_path TEXT
        );

        -- User settings key-value table
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        INSERT INTO schema_migrations (version, applied_at)
        VALUES (1, datetime('now'));
      `);
    });

    migration();
  }

  private applyMigration2(): void {
    const migration = this.db.transaction(() => {
      const tableInfo = this.db.prepare('PRAGMA table_info(fonts)').all() as { name: string }[];
      const colNames = new Set(tableInfo.map((c) => c.name));

      if (!colNames.has('localized_name')) {
        this.db.exec('ALTER TABLE fonts ADD COLUMN localized_name TEXT;');
      }
      if (!colNames.has('full_name')) {
        this.db.exec('ALTER TABLE fonts ADD COLUMN full_name TEXT;');
      }
      if (!colNames.has('face_index')) {
        this.db.exec('ALTER TABLE fonts ADD COLUMN face_index INTEGER DEFAULT 0;');
      }
      if (!colNames.has('face_count')) {
        this.db.exec('ALTER TABLE fonts ADD COLUMN face_count INTEGER DEFAULT 1;');
      }
      if (!colNames.has('is_missing')) {
        this.db.exec('ALTER TABLE fonts ADD COLUMN is_missing INTEGER DEFAULT 0;');
      }

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_fonts_localized ON fonts(localized_name);
        CREATE INDEX IF NOT EXISTS idx_fonts_format ON fonts(format);
        CREATE INDEX IF NOT EXISTS idx_fonts_missing ON fonts(is_missing);
        INSERT INTO schema_migrations (version, applied_at) VALUES (2, datetime('now'));
      `);
    });

    migration();
  }

  // ==================== Font Operations ====================

  /**
   * Finds an existing font by path and face index, or by path and style.
   */
  public findFontByPathAndFace(filePath: string, faceIndex: number): FontRecord | undefined {
    const stmt = this.db.prepare(
      'SELECT * FROM fonts WHERE file_path = ? AND face_index = ?'
    );
    const row = stmt.get(filePath, faceIndex) as any;
    return row ? this.mapFontRow(row) : undefined;
  }

  public findFontByPathAndStyle(filePath: string, styleName: string): FontRecord | undefined {
    const stmt = this.db.prepare(
      'SELECT * FROM fonts WHERE file_path = ? AND style_name = ?'
    );
    const row = stmt.get(filePath, styleName) as any;
    return row ? this.mapFontRow(row) : undefined;
  }

  public upsertFont(font: FontRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO fonts (
        id, family_name, localized_name, full_name, style_name, postscript_name, file_path, format,
        file_size, sha256, source_type, install_scope, scan_status, face_index, face_count, is_missing,
        version, designer, copyright, glyph_count, character_count,
        unicode_ranges, last_scanned_at, created_at
      ) VALUES (
        @id, @family_name, @localized_name, @full_name, @style_name, @postscript_name, @file_path, @format,
        @file_size, @sha256, @source_type, @install_scope, @scan_status, @face_index, @face_count, @is_missing,
        @version, @designer, @copyright, @glyph_count, @character_count,
        @unicode_ranges, @last_scanned_at, @created_at
      )
      ON CONFLICT(id) DO UPDATE SET
        family_name = excluded.family_name,
        localized_name = excluded.localized_name,
        full_name = excluded.full_name,
        style_name = excluded.style_name,
        postscript_name = excluded.postscript_name,
        file_path = excluded.file_path,
        format = excluded.format,
        file_size = excluded.file_size,
        sha256 = excluded.sha256,
        source_type = excluded.source_type,
        install_scope = excluded.install_scope,
        scan_status = excluded.scan_status,
        face_index = excluded.face_index,
        face_count = excluded.face_count,
        is_missing = excluded.is_missing,
        version = excluded.version,
        designer = excluded.designer,
        copyright = excluded.copyright,
        glyph_count = excluded.glyph_count,
        character_count = excluded.character_count,
        unicode_ranges = excluded.unicode_ranges,
        last_scanned_at = excluded.last_scanned_at
    `);

    stmt.run({
      ...font,
      localized_name: font.localized_name ?? null,
      full_name: font.full_name ?? null,
      face_index: font.face_index ?? 0,
      face_count: font.face_count ?? 1,
      is_missing: font.is_missing ? 1 : 0,
      unicode_ranges: font.unicode_ranges ? JSON.stringify(font.unicode_ranges) : null,
      glyph_count: font.glyph_count ?? null,
      character_count: font.character_count ?? null,
      version: font.version ?? null,
      designer: font.designer ?? null,
      copyright: font.copyright ?? null,
      postscript_name: font.postscript_name ?? null,
    });
  }

  public upsertFontsBatch(fonts: FontRecord[]): void {
    const insertMany = this.db.transaction((items: FontRecord[]) => {
      for (const font of items) {
        this.upsertFont(font);
      }
    });
    insertMany(fonts);
  }

  public getFontById(id: string): FontRecord | undefined {
    const stmt = this.db.prepare(`
      SELECT f.*,
        CASE WHEN fav.font_id IS NOT NULL THEN 1 ELSE 0 END AS is_favorite
      FROM fonts f
      LEFT JOIN favorites fav ON f.id = fav.font_id
      WHERE f.id = ?
    `);
    const row = stmt.get(id) as any;
    if (!row) return undefined;

    const font = this.mapFontRow(row);
    font.collection_ids = this.getFontCollectionIds(font.id);
    font.tags = this.getFontTagNames(font.id);
    return font;
  }

  /**
   * Queries fonts with pagination, filtering, search, and sorting.
   */
  public getFonts(options: FontFilterOptions = {}): FontQueryResult {
    let whereSql = ' WHERE 1=1';
    const params: any[] = [];

    // Search query: checks English family name, localized name, full name, style, and PS name
    if (options.searchQuery && options.searchQuery.trim()) {
      whereSql += ` AND (
        f.family_name LIKE ? OR
        (f.localized_name IS NOT NULL AND f.localized_name LIKE ?) OR
        (f.full_name IS NOT NULL AND f.full_name LIKE ?) OR
        f.style_name LIKE ? OR
        (f.postscript_name IS NOT NULL AND f.postscript_name LIKE ?)
      )`;
      const term = `%${options.searchQuery.trim()}%`;
      params.push(term, term, term, term, term);
    }

    if (options.format && options.format !== 'all') {
      whereSql += ' AND f.format = ?';
      params.push(options.format);
    }

    if (options.sourceType && options.sourceType !== 'all') {
      whereSql += ' AND f.source_type = ?';
      params.push(options.sourceType);
    }

    if (options.installScope && options.installScope !== 'all') {
      if (options.installScope === 'installed') {
        whereSql += " AND f.install_scope IN ('system', 'user')";
      } else {
        whereSql += ' AND f.install_scope = ?';
        params.push(options.installScope);
      }
    }

    if (options.scanStatus && options.scanStatus !== 'all') {
      whereSql += ' AND f.scan_status = ?';
      params.push(options.scanStatus);
    }

    if (options.isFavorite === true) {
      whereSql += ' AND fav.font_id IS NOT NULL';
    }

    if (options.collectionId) {
      whereSql += ' AND fc.collection_id = ?';
      params.push(options.collectionId);
    }

    if (options.tagId) {
      whereSql += ' AND ft.tag_id = ?';
      params.push(options.tagId);
    }

    // 1. Get total count
    const countSql = `
      SELECT COUNT(DISTINCT f.id) AS total_count
      FROM fonts f
      LEFT JOIN favorites fav ON f.id = fav.font_id
      LEFT JOIN font_collections fc ON f.id = fc.font_id
      LEFT JOIN font_tags ft ON f.id = ft.font_id
      ${whereSql}
    `;
    const countRow = this.db.prepare(countSql).get(...params) as { total_count: number };
    const total = countRow?.total_count || 0;

    // 2. Sorting
    const allowedSort = ['family_name', 'localized_name', 'file_size', 'last_scanned_at', 'created_at', 'format'];
    const sortCol = allowedSort.includes(options.sortBy || '') ? options.sortBy! : 'family_name';
    const sortDir = (options.sortOrder || 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // 3. Pagination
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.max(1, Math.min(500, options.pageSize || 36));
    const offset = (page - 1) * pageSize;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const querySql = `
      SELECT DISTINCT f.*,
        CASE WHEN fav.font_id IS NOT NULL THEN 1 ELSE 0 END AS is_favorite
      FROM fonts f
      LEFT JOIN favorites fav ON f.id = fav.font_id
      LEFT JOIN font_collections fc ON f.id = fc.font_id
      LEFT JOIN font_tags ft ON f.id = ft.font_id
      ${whereSql}
      ORDER BY f.${sortCol} ${sortDir}, f.style_name ASC, f.face_index ASC
      LIMIT ? OFFSET ?
    `;

    const rows = this.db.prepare(querySql).all(...params, pageSize, offset) as any[];
    const fontRecords = rows.map((r) => this.mapFontRow(r));

    return {
      fonts: fontRecords,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Returns all matching fonts as a flat array without pagination limits.
   */
  public getAllFonts(options: FontFilterOptions = {}): FontRecord[] {
    const res = this.getFonts({ ...options, page: 1, pageSize: 100000 });
    return res.fonts;
  }

  /**
   * Marks fonts whose files no longer exist on disk as missing.
   */
  public markMissingFonts(validPaths: Set<string>, sourceType?: FontSourceType): number {
    let sql = 'SELECT id, file_path FROM fonts WHERE is_missing = 0';
    const params: any[] = [];
    if (sourceType) {
      sql += ' AND source_type = ?';
      params.push(sourceType);
    }
    const rows = this.db.prepare(sql).all(...params) as { id: string; file_path: string }[];
    let markedCount = 0;
    const updateStmt = this.db.prepare("UPDATE fonts SET is_missing = 1, scan_status = 'unreadable' WHERE id = ?");

    const tx = this.db.transaction(() => {
      for (const row of rows) {
        if (!validPaths.has(row.file_path) && !fs.existsSync(row.file_path)) {
          updateStmt.run(row.id);
          markedCount++;
        }
      }
    });
    tx();
    return markedCount;
  }

  public deleteFont(id: string): void {
    this.db.prepare('DELETE FROM fonts WHERE id = ?').run(id);
  }

  public updateFontInstallScope(fontId: string, scope: InstallScope, newFilePath?: string): void {
    if (newFilePath) {
      this.db.prepare(`
        UPDATE fonts
        SET install_scope = ?, file_path = ?, last_scanned_at = datetime('now')
        WHERE id = ?
      `).run(scope, newFilePath, fontId);
    } else {
      this.db.prepare(`
        UPDATE fonts
        SET install_scope = ?, last_scanned_at = datetime('now')
        WHERE id = ?
      `).run(scope, fontId);
    }
  }

  // ==================== Collections ====================

  public createCollection(id: string, name: string, description: string = ''): CollectionRecord {
    const stmt = this.db.prepare(`
      INSERT INTO collections (id, name, description, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `);
    stmt.run(id, name, description);
    return this.getCollection(id)!;
  }

  public renameCollection(id: string, newName: string): void {
    this.db.prepare('UPDATE collections SET name = ? WHERE id = ?').run(newName, id);
  }

  public deleteCollection(id: string): void {
    this.db.prepare('DELETE FROM collections WHERE id = ?').run(id);
  }

  public getCollection(id: string): CollectionRecord | undefined {
    const row = this.db.prepare(`
      SELECT c.*, COUNT(fc.font_id) AS font_count
      FROM collections c
      LEFT JOIN font_collections fc ON c.id = fc.collection_id
      WHERE c.id = ?
      GROUP BY c.id
    `).get(id) as any;
    return row ? {
      id: row.id,
      name: row.name,
      description: row.description,
      created_at: row.created_at,
      font_count: row.font_count || 0,
    } : undefined;
  }

  public getAllCollections(): CollectionRecord[] {
    const rows = this.db.prepare(`
      SELECT c.*, COUNT(fc.font_id) AS font_count
      FROM collections c
      LEFT JOIN font_collections fc ON c.id = fc.collection_id
      GROUP BY c.id
      ORDER BY c.name ASC
    `).all() as any[];

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      created_at: r.created_at,
      font_count: r.font_count || 0,
    }));
  }

  public addFontToCollection(fontId: string, collectionId: string): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO font_collections (font_id, collection_id)
      VALUES (?, ?)
    `).run(fontId, collectionId);
  }

  public addFontsToCollection(fontIds: string[], collectionId: string): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO font_collections (font_id, collection_id)
      VALUES (?, ?)
    `);
    const tx = this.db.transaction((ids: string[]) => {
      for (const id of ids) {
        stmt.run(id, collectionId);
      }
    });
    tx(fontIds);
  }

  public removeFontFromCollection(fontId: string, collectionId: string): void {
    this.db.prepare(`
      DELETE FROM font_collections WHERE font_id = ? AND collection_id = ?
    `).run(fontId, collectionId);
  }

  public removeFontsFromCollection(fontIds: string[], collectionId: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM font_collections WHERE font_id = ? AND collection_id = ?
    `);
    const tx = this.db.transaction((ids: string[]) => {
      for (const id of ids) {
        stmt.run(id, collectionId);
      }
    });
    tx(fontIds);
  }

  public getFontCollectionIds(fontId: string): string[] {
    const rows = this.db.prepare(
      'SELECT collection_id FROM font_collections WHERE font_id = ?'
    ).all(fontId) as { collection_id: string }[];
    return rows.map((r) => r.collection_id);
  }

  // ==================== Tags ====================

  public getOrCreateTag(id: string, name: string): TagRecord {
    const trimmed = name.trim();
    const existing = this.db.prepare('SELECT * FROM tags WHERE name = ?').get(trimmed) as any;
    if (existing) {
      return { id: existing.id, name: existing.name };
    }
    this.db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)').run(id, trimmed);
    return { id, name: trimmed };
  }

  public renameTag(id: string, newName: string): void {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error('Tag name cannot be empty');
    this.db.prepare('UPDATE tags SET name = ? WHERE id = ?').run(trimmed, id);
  }

  public deleteTag(id: string): void {
    this.db.prepare('DELETE FROM tags WHERE id = ?').run(id);
  }

  public getAllTags(): TagRecord[] {
    const rows = this.db.prepare(`
      SELECT t.*, COUNT(ft.font_id) AS font_count
      FROM tags t
      LEFT JOIN font_tags ft ON t.id = ft.tag_id
      GROUP BY t.id
      ORDER BY t.name ASC
    `).all() as any[];

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      font_count: r.font_count || 0,
    }));
  }

  public addTagToFont(fontId: string, tagId: string): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO font_tags (font_id, tag_id)
      VALUES (?, ?)
    `).run(fontId, tagId);
  }

  public addTagToFonts(fontIds: string[], tagId: string): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO font_tags (font_id, tag_id)
      VALUES (?, ?)
    `);
    const tx = this.db.transaction((ids: string[]) => {
      for (const id of ids) {
        stmt.run(id, tagId);
      }
    });
    tx(fontIds);
  }

  public removeTagFromFont(fontId: string, tagId: string): void {
    this.db.prepare('DELETE FROM font_tags WHERE font_id = ? AND tag_id = ?').run(fontId, tagId);
  }

  public removeTagFromFonts(fontIds: string[], tagId: string): void {
    const stmt = this.db.prepare('DELETE FROM font_tags WHERE font_id = ? AND tag_id = ?');
    const tx = this.db.transaction((ids: string[]) => {
      for (const id of ids) {
        stmt.run(id, tagId);
      }
    });
    tx(fontIds);
  }

  public getFontTagNames(fontId: string): string[] {
    const rows = this.db.prepare(`
      SELECT t.name FROM tags t
      JOIN font_tags ft ON t.id = ft.tag_id
      WHERE ft.font_id = ?
    `).all(fontId) as { name: string }[];
    return rows.map((r) => r.name);
  }

  public getFontTags(fontId: string): TagRecord[] {
    const rows = this.db.prepare(`
      SELECT t.id, t.name FROM tags t
      JOIN font_tags ft ON t.id = ft.tag_id
      WHERE ft.font_id = ?
      ORDER BY t.name ASC
    `).all(fontId) as { id: string; name: string }[];
    return rows;
  }

  // ==================== Favorites ====================

  public toggleFavorite(fontId: string): boolean {
    const existing = this.db.prepare('SELECT 1 FROM favorites WHERE font_id = ?').get(fontId);
    if (existing) {
      this.db.prepare('DELETE FROM favorites WHERE font_id = ?').run(fontId);
      return false;
    } else {
      this.db.prepare("INSERT INTO favorites (font_id, created_at) VALUES (?, datetime('now'))").run(fontId);
      return true;
    }
  }

  public setFavoritesBatch(fontIds: string[], favorite: boolean): void {
    if (favorite) {
      const stmt = this.db.prepare("INSERT OR IGNORE INTO favorites (font_id, created_at) VALUES (?, datetime('now'))");
      const tx = this.db.transaction((ids: string[]) => {
        for (const id of ids) stmt.run(id);
      });
      tx(fontIds);
    } else {
      const stmt = this.db.prepare('DELETE FROM favorites WHERE font_id = ?');
      const tx = this.db.transaction((ids: string[]) => {
        for (const id of ids) stmt.run(id);
      });
      tx(fontIds);
    }
  }

  public isFavorite(fontId: string): boolean {
    const row = this.db.prepare('SELECT 1 FROM favorites WHERE font_id = ?').get(fontId);
    return !!row;
  }

  // ==================== Metadata Export & Import (M3) ====================

  public getAllFontCollections(): { font_id: string; collection_id: string }[] {
    return this.db.prepare('SELECT font_id, collection_id FROM font_collections').all() as any[];
  }

  public getAllFontTags(): { font_id: string; tag_id: string }[] {
    return this.db.prepare('SELECT font_id, tag_id FROM font_tags').all() as any[];
  }

  public getAllFavorites(): { font_id: string; created_at: string }[] {
    return this.db.prepare('SELECT font_id, created_at FROM favorites').all() as any[];
  }

  public getFontBySha256(sha256: string): FontRecord | undefined {
    const row = this.db.prepare('SELECT * FROM fonts WHERE sha256 = ? LIMIT 1').get(sha256) as any;
    return row ? this.mapFontRow(row) : undefined;
  }

  public importBackupMetadata(
    manifest: BackupManifest,
    options: { importCollections?: boolean; importTags?: boolean; importFavorites?: boolean } = {}
  ): { collections: number; tags: number; favorites: number } {
    let collectionsCount = 0;
    let tagsCount = 0;
    let favoritesCount = 0;

    const tx = this.db.transaction(() => {
      // Build lookup map for matching restored fonts
      const fontIdMap = new Map<string, string>();
      const allLocalFonts = this.getAllFonts();
      const localShaMap = new Map<string, string>();
      const localIdSet = new Set<string>();

      for (const lf of allLocalFonts) {
        localShaMap.set(lf.sha256, lf.id);
        localIdSet.add(lf.id);
      }

      if (manifest.files) {
        for (const item of manifest.files) {
          if (localShaMap.has(item.sha256)) {
            fontIdMap.set(item.font_id, localShaMap.get(item.sha256)!);
          } else if (localIdSet.has(item.font_id)) {
            fontIdMap.set(item.font_id, item.font_id);
          }
        }
      }

      // 1. Collections
      if (options.importCollections !== false && manifest.collections) {
        const collectionIdMap = new Map<string, string>();
        const checkColByName = this.db.prepare('SELECT id FROM collections WHERE name = ?');
        const checkColById = this.db.prepare('SELECT id FROM collections WHERE id = ?');
        const insertCol = this.db.prepare(`
          INSERT INTO collections (id, name, description, created_at)
          VALUES (?, ?, ?, ?)
        `);

        for (const col of manifest.collections) {
          const trimmedName = (col.name || '').trim();
          if (!trimmedName) continue;

          const existingByName = checkColByName.get(trimmedName) as { id: string } | undefined;
          if (existingByName) {
            collectionIdMap.set(col.id, existingByName.id);
          } else {
            const existingById = checkColById.get(col.id);
            const actualId = existingById ? crypto.randomUUID() : col.id;
            const res = insertCol.run(
              actualId,
              trimmedName,
              col.description || '',
              col.created_at || new Date().toISOString()
            );
            collectionIdMap.set(col.id, actualId);
            if (res.changes > 0) collectionsCount++;
          }
        }

        if (manifest.font_collections) {
          const insertFc = this.db.prepare(`
            INSERT OR IGNORE INTO font_collections (font_id, collection_id)
            VALUES (?, ?)
          `);
          for (const fc of manifest.font_collections) {
            const targetFontId = fontIdMap.get(fc.font_id) || (localIdSet.has(fc.font_id) ? fc.font_id : null);
            const targetColId = collectionIdMap.get(fc.collection_id);
            if (targetFontId && targetColId) {
              insertFc.run(targetFontId, targetColId);
            }
          }
        }
      }

      // 2. Tags
      if (options.importTags !== false && manifest.tags) {
        const beforeTags = this.getAllTags().length;
        const tagIdMap = new Map<string, string>();

        for (const t of manifest.tags) {
          const trimmedTagName = (t.name || '').trim();
          if (!trimmedTagName) continue;
          const tagRecord = this.getOrCreateTag(t.id, trimmedTagName);
          tagIdMap.set(t.id, tagRecord.id);
        }
        const afterTags = this.getAllTags().length;
        tagsCount = Math.max(0, afterTags - beforeTags);

        if (manifest.font_tags) {
          const insertFt = this.db.prepare(`
            INSERT OR IGNORE INTO font_tags (font_id, tag_id)
            VALUES (?, ?)
          `);
          for (const ft of manifest.font_tags) {
            const targetFontId = fontIdMap.get(ft.font_id) || (localIdSet.has(ft.font_id) ? ft.font_id : null);
            const targetTagId = tagIdMap.get(ft.tag_id);
            if (targetFontId && targetTagId) {
              insertFt.run(targetFontId, targetTagId);
            }
          }
        }
      }

      // 3. Favorites
      if (options.importFavorites !== false && manifest.favorites) {
        const insertFav = this.db.prepare(`
          INSERT OR IGNORE INTO favorites (font_id, created_at)
          VALUES (?, ?)
        `);
        for (const fav of manifest.favorites) {
          const targetFontId = fontIdMap.get(fav.font_id) || (localIdSet.has(fav.font_id) ? fav.font_id : null);
          if (targetFontId) {
            const res = insertFav.run(targetFontId, fav.created_at || new Date().toISOString());
            if (res.changes > 0) favoritesCount++;
          }
        }
      }
    });

    tx();
    return { collections: collectionsCount, tags: tagsCount, favorites: favoritesCount };
  }

  // ==================== Operations & Logs ====================

  public createOperation(op: OperationRecord): void {
    this.db.prepare(`
      INSERT INTO operations (
        id, operation_type, status, total_count, success_count,
        failed_count, skipped_count, started_at
      ) VALUES (
        @id, @operation_type, @status, @total_count, @success_count,
        @failed_count, @skipped_count, @started_at
      )
    `).run(op);
  }

  public updateOperation(
    id: string,
    updates: Partial<Pick<OperationRecord, 'status' | 'success_count' | 'failed_count' | 'skipped_count' | 'completed_at' | 'error_summary'>>
  ): void {
    const fields: string[] = [];
    const params: any = { id };

    if (updates.status !== undefined) {
      fields.push('status = @status');
      params.status = updates.status;
    }
    if (updates.success_count !== undefined) {
      fields.push('success_count = @success_count');
      params.success_count = updates.success_count;
    }
    if (updates.failed_count !== undefined) {
      fields.push('failed_count = @failed_count');
      params.failed_count = updates.failed_count;
    }
    if (updates.skipped_count !== undefined) {
      fields.push('skipped_count = @skipped_count');
      params.skipped_count = updates.skipped_count;
    }
    if (updates.completed_at !== undefined) {
      fields.push('completed_at = @completed_at');
      params.completed_at = updates.completed_at;
    }
    if (updates.error_summary !== undefined) {
      fields.push('error_summary = @error_summary');
      params.error_summary = updates.error_summary;
    }

    if (fields.length > 0) {
      this.db.prepare(`UPDATE operations SET ${fields.join(', ')} WHERE id = @id`).run(params);
    }
  }

  public addOperationLog(log: OperationLogEntry): void {
    this.db.prepare(`
      INSERT INTO operation_logs (id, operation_id, item_target, status, message, created_at)
      VALUES (@id, @operation_id, @item_target, @status, @message, @created_at)
    `).run(log);
  }

  public getRecentOperations(limit = 20): OperationRecord[] {
    return this.db.prepare(`
      SELECT * FROM operations ORDER BY started_at DESC LIMIT ?
    `).all(limit) as OperationRecord[];
  }

  public getOperationLogs(operationId: string): OperationLogEntry[] {
    return this.db.prepare(`
      SELECT * FROM operation_logs WHERE operation_id = ? ORDER BY created_at ASC
    `).all(operationId) as OperationLogEntry[];
  }

  // ==================== Settings ====================

  public getSetting(key: string, defaultValue = ''): string {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? row.value : defaultValue;
  }

  public setSetting(key: string, value: string): void {
    this.db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
  }

  public getAllSettings(): Record<string, string> {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  // ==================== Storage Analysis & Diagnostics ====================

  public getExactDuplicates(): { sha256: string; count: number; sizeBytes: number; wastedBytes: number; fonts: FontRecord[] }[] {
    const dupes = this.db.prepare(`
      SELECT sha256, COUNT(*) as count, file_size
      FROM fonts
      WHERE is_missing = 0
      GROUP BY sha256
      HAVING count > 1
    `).all() as { sha256: string; count: number; file_size: number }[];

    return dupes.map((d) => {
      const fonts = this.db.prepare('SELECT * FROM fonts WHERE sha256 = ? AND is_missing = 0').all(d.sha256) as any[];
      return {
        sha256: d.sha256,
        count: d.count,
        sizeBytes: d.file_size,
        wastedBytes: (d.count - 1) * d.file_size,
        fonts: fonts.map((r) => this.mapFontRow(r)),
      };
    });
  }

  public getPotentialFamilyDuplicates(): { family_name: string; fonts: FontRecord[] }[] {
    const families = this.db.prepare(`
      SELECT family_name, COUNT(DISTINCT file_path) as path_count
      FROM fonts
      WHERE is_missing = 0
      GROUP BY family_name
      HAVING path_count > 1
    `).all() as { family_name: string; path_count: number }[];

    return families.map((f) => {
      const fonts = this.db.prepare('SELECT * FROM fonts WHERE family_name = ? AND is_missing = 0').all(f.family_name) as any[];
      return {
        family_name: f.family_name,
        fonts: fonts.map((r) => this.mapFontRow(r)),
      };
    });
  }

  // ==================== Backup / Restore Data Export ====================

  public exportBackupData() {
    return {
      collections: this.getAllCollections(),
      font_collections: this.db.prepare('SELECT * FROM font_collections').all() as { font_id: string; collection_id: string }[],
      tags: this.getAllTags(),
      font_tags: this.db.prepare('SELECT * FROM font_tags').all() as { font_id: string; tag_id: string }[],
      favorites: this.db.prepare('SELECT * FROM favorites').all() as { font_id: string; created_at: string }[],
      settings: this.getAllSettings(),
    };
  }

  public close(): void {
    this.db.close();
  }

  private mapFontRow(row: any): FontRecord {
    let unicode_ranges: string[] | undefined;
    if (row.unicode_ranges) {
      try {
        unicode_ranges = JSON.parse(row.unicode_ranges);
      } catch {
        unicode_ranges = undefined;
      }
    }

    return {
      id: row.id,
      family_name: row.family_name,
      localized_name: row.localized_name || undefined,
      full_name: row.full_name || undefined,
      style_name: row.style_name,
      postscript_name: row.postscript_name || undefined,
      file_path: row.file_path,
      format: row.format,
      file_size: row.file_size,
      sha256: row.sha256,
      source_type: row.source_type,
      install_scope: row.install_scope,
      scan_status: row.scan_status,
      face_index: row.face_index || 0,
      face_count: row.face_count || 1,
      is_missing: Boolean(row.is_missing),
      version: row.version || undefined,
      designer: row.designer || undefined,
      copyright: row.copyright || undefined,
      glyph_count: row.glyph_count ?? undefined,
      character_count: row.character_count ?? undefined,
      unicode_ranges,
      last_scanned_at: row.last_scanned_at,
      created_at: row.created_at,
      is_favorite: Boolean(row.is_favorite),
    };
  }
}
