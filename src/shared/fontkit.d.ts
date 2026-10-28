declare module 'fontkit' {
  export interface Font {
    familyName: string;
    subfamilyName: string;
    postscriptName?: string;
    version?: string;
    copyright?: string;
    numGlyphs: number;
    characterSet: number[];
    glyphForCodePoint(codePoint: number): any;
  }

  export interface FontCollection {
    fonts: Font[];
  }

  export function openSync(filePath: string): Font | FontCollection;
  export function open(filePath: string, callback: (err: Error | null, font: Font | FontCollection) => void): void;
  export function create(buffer: Buffer): Font | FontCollection;
}

