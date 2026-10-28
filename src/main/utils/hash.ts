import * as crypto from 'crypto';
import * as fs from 'fs';

/**
 * Calculates SHA-256 hash of a file using streams for high performance and low memory footprint.
 */
export async function calculateFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

/**
 * Calculates SHA-256 hash of a buffer or string.
 */
export function calculateSha256(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

