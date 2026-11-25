import { RETRIEVAL_CONFIG } from '../config';
import { NormalizedRecord, TextChunk } from '../types';

/**
 * Extracts pure body text from chunk text by stripping the metadata header.
 */
export function extractBodyText(chunkText: string): string {
  const doubleNewline = chunkText.indexOf('\n\n');
  if (doubleNewline !== -1) {
    const candidateHeader = chunkText.slice(0, doubleNewline);
    if (candidateHeader.startsWith('[') && candidateHeader.includes('URL:')) {
      return chunkText.slice(doubleNewline + 2).trim();
    }
  }
  return chunkText.trim();
}

/**
 * Splits text into chunks respecting word boundaries, with configurable maximum size and overlap.
 */
export function splitTextIntoChunks(
  text: string,
  maxChars = RETRIEVAL_CONFIG.CHUNK_MAX_CHARS,
  overlapChars = RETRIEVAL_CONFIG.CHUNK_OVERLAP_CHARS
): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) {
    return [trimmed];
  }

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < trimmed.length) {
    let endIndex = startIndex + maxChars;

    if (endIndex >= trimmed.length) {
      chunks.push(trimmed.slice(startIndex).trim());
      break;
    }

    // Attempt to break at the last newline or space before endIndex
    const lastNewline = trimmed.lastIndexOf('\n', endIndex);
    const lastSpace = trimmed.lastIndexOf(' ', endIndex);
    const breakPoint = Math.max(lastNewline, lastSpace);

    // If a suitable word boundary exists after startIndex, break there
    if (breakPoint > startIndex + Math.floor(maxChars / 2)) {
      endIndex = breakPoint;
    }

    const chunk = trimmed.slice(startIndex, endIndex).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // Advance startIndex by chunk length minus overlap
    startIndex = Math.max(startIndex + 1, endIndex - overlapChars);
  }

  return chunks;
}

/**
 * Converts normalized GitHub records into search chunks, preserving URL and source metadata.
 */
export function chunkRecord(record: NormalizedRecord): TextChunk[] {
  const header = `[${record.type.toUpperCase()}] ${record.title}\nURL: ${record.url}\nAuthor: ${record.author || 'unknown'}\nDate: ${record.createdAt}\n\n`;
  const body = record.body.trim();

  // If no body, use header only
  if (!body) {
    return [
      {
        id: `chunk-${record.id}-0`,
        recordId: record.id,
        repoOwner: record.repoOwner,
        repoName: record.repoName,
        chunkIndex: 0,
        text: header.trim(),
        sourceType: record.type,
        sourceTitle: record.title,
        sourceUrl: record.url,
        timestamp: record.createdAt,
      },
    ];
  }

  const bodyChunks = splitTextIntoChunks(body);

  return bodyChunks.map((segment, index) => ({
    id: `chunk-${record.id}-${index}`,
    recordId: record.id,
    repoOwner: record.repoOwner,
    repoName: record.repoName,
    chunkIndex: index,
    text: `${header}${segment}`.trim(),
    sourceType: record.type,
    sourceTitle: record.title,
    sourceUrl: record.url,
    timestamp: record.createdAt,
  }));
}

/**
 * Converts a list of normalized records into a flat list of text chunks.
 */
export function chunkRecords(records: NormalizedRecord[]): TextChunk[] {
  const allChunks: TextChunk[] = [];
  for (const record of records) {
    allChunks.push(...chunkRecord(record));
  }
  return allChunks;
}
