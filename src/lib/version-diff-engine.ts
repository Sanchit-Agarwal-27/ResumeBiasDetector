import type { CanvasTextBlock, CanvasPage } from "./pdf-cluster-engine";
import type { ResumeBiasReport } from "./resume-contract";

export type DiffChangeType = "added" | "removed" | "unchanged";

export interface DiffWordChunk {
  type: DiffChangeType;
  text: string;
}

export type BlockDiffStatus = "added" | "removed" | "modified" | "unchanged";

export interface BlockDiffEntry {
  id: string;
  status: BlockDiffStatus;
  originalText?: string;
  newText?: string;
  chunks: DiffWordChunk[];
  pageIndex: number;
  y: number;
}

export interface VersionMeta {
  id: string;
  name: string;
  versionNumber: number;
  neutralityScore: number;
  atsScore?: number;
  totalFlags: number;
  createdAt: string;
}

export interface VersionComparisonResult {
  versionA: VersionMeta;
  versionB: VersionMeta;
  neutralityDelta: number; // versionB - versionA
  atsDelta: number; // versionB - versionA
  flagsDelta: number; // versionB - versionA (negative is better)
  blockDiffs: BlockDiffEntry[];
  summary: {
    addedCount: number;
    removedCount: number;
    modifiedCount: number;
    unchangedCount: number;
  };
}

/**
 * Tokenize string into words and whitespace/punctuation tokens
 */
function tokenizeWords(text: string): string[] {
  return text.match(/\S+|\s+/g) || [];
}

/**
 * Compute Longest Common Subsequence (LCS) matrix
 */
function computeLcsMatrix(tokensA: string[], tokensB: string[]): number[][] {
  const m = tokensA.length;
  const n = tokensB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i < m; i++) {
    const rowCurr = dp[i + 1];
    const rowPrev = dp[i];
    if (!rowCurr || !rowPrev) continue;

    const tokenA = tokensA[i] ?? "";
    for (let j = 0; j < n; j++) {
      const tokenB = tokensB[j] ?? "";
      if (tokenA.toLowerCase() === tokenB.toLowerCase()) {
        rowCurr[j + 1] = (rowPrev[j] ?? 0) + 1;
      } else {
        rowCurr[j + 1] = Math.max(rowCurr[j] ?? 0, rowPrev[j + 1] ?? 0);
      }
    }
  }

  return dp;
}

/**
 * Word-level diff using Longest Common Subsequence (LCS)
 */
export function computeWordLevelDiff(textA: string, textB: string): DiffWordChunk[] {
  if (textA === textB) {
    return [{ type: "unchanged", text: textA }];
  }
  if (!textA) {
    return [{ type: "added", text: textB }];
  }
  if (!textB) {
    return [{ type: "removed", text: textA }];
  }

  const tokensA = tokenizeWords(textA);
  const tokensB = tokenizeWords(textB);
  const dp = computeLcsMatrix(tokensA, tokensB);

  const chunks: DiffWordChunk[] = [];
  let i = tokensA.length;
  let j = tokensB.length;

  const backtrack: DiffWordChunk[] = [];

  while (i > 0 || j > 0) {
    const prevA = i > 0 ? (tokensA[i - 1] ?? "") : "";
    const prevB = j > 0 ? (tokensB[j - 1] ?? "") : "";
    const dpCurrent = dp[i]?.[j - 1] ?? 0;
    const dpPrev = dp[i - 1]?.[j] ?? 0;

    if (i > 0 && j > 0 && prevA.toLowerCase() === prevB.toLowerCase()) {
      backtrack.push({ type: "unchanged", text: prevB });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dpCurrent >= dpPrev)) {
      backtrack.push({ type: "added", text: prevB });
      j--;
    } else if (i > 0 && (j === 0 || dpCurrent < dpPrev)) {
      backtrack.push({ type: "removed", text: prevA });
      i--;
    }
  }

  backtrack.reverse();

  // Merge consecutive chunks with the same change type
  for (const chunk of backtrack) {
    const last = chunks[chunks.length - 1];
    if (last && last.type === chunk.type) {
      last.text += chunk.text;
    } else {
      chunks.push({ ...chunk });
    }
  }

  return chunks;
}

/**
 * Compare two resume snapshot structures (Blocks & Metrics)
 */
export function compareVersionSnapshots(
  snapshotA: { blocks: CanvasTextBlock[]; pages: CanvasPage[]; report: ResumeBiasReport },
  snapshotB: { blocks: CanvasTextBlock[]; pages: CanvasPage[]; report: ResumeBiasReport },
  metaA: VersionMeta,
  metaB: VersionMeta,
): VersionComparisonResult {
  const blocksA = snapshotA.blocks || [];
  const blocksB = snapshotB.blocks || [];

  const mapA = new Map<string, CanvasTextBlock>();
  blocksA.forEach((b) => mapA.set(b.id, b));

  const mapB = new Map<string, CanvasTextBlock>();
  blocksB.forEach((b) => mapB.set(b.id, b));

  const blockDiffs: BlockDiffEntry[] = [];
  let addedCount = 0;
  let removedCount = 0;
  let modifiedCount = 0;
  let unchangedCount = 0;

  // Track matched blocks in B
  const matchedInB = new Set<string>();

  // Check blocks from Version A
  for (const blockA of blocksA) {
    const blockB = mapB.get(blockA.id);

    if (blockB) {
      matchedInB.add(blockB.id);
      if (blockA.text.trim() === blockB.text.trim()) {
        unchangedCount++;
        blockDiffs.push({
          id: blockA.id,
          status: "unchanged",
          originalText: blockA.text,
          newText: blockB.text,
          chunks: [{ type: "unchanged", text: blockB.text }],
          pageIndex: blockB.pageIndex,
          y: blockB.y,
        });
      } else {
        modifiedCount++;
        const chunks = computeWordLevelDiff(blockA.text, blockB.text);
        blockDiffs.push({
          id: blockA.id,
          status: "modified",
          originalText: blockA.text,
          newText: blockB.text,
          chunks,
          pageIndex: blockB.pageIndex,
          y: blockB.y,
        });
      }
    } else {
      // Look for fuzzy positional / text match if ID was regenerated
      const candidateB = blocksB.find(
        (b) =>
          !matchedInB.has(b.id) &&
          Math.abs(b.y - blockA.y) < 25 &&
          b.pageIndex === blockA.pageIndex,
      );

      if (candidateB) {
        matchedInB.add(candidateB.id);
        if (candidateB.text.trim() === blockA.text.trim()) {
          unchangedCount++;
          blockDiffs.push({
            id: blockA.id,
            status: "unchanged",
            originalText: blockA.text,
            newText: candidateB.text,
            chunks: [{ type: "unchanged", text: candidateB.text }],
            pageIndex: candidateB.pageIndex,
            y: candidateB.y,
          });
        } else {
          modifiedCount++;
          const chunks = computeWordLevelDiff(blockA.text, candidateB.text);
          blockDiffs.push({
            id: blockA.id,
            status: "modified",
            originalText: blockA.text,
            newText: candidateB.text,
            chunks,
            pageIndex: candidateB.pageIndex,
            y: candidateB.y,
          });
        }
      } else {
        // Block was removed in Version B
        removedCount++;
        blockDiffs.push({
          id: blockA.id,
          status: "removed",
          originalText: blockA.text,
          chunks: [{ type: "removed", text: blockA.text }],
          pageIndex: blockA.pageIndex,
          y: blockA.y,
        });
      }
    }
  }

  // Check remaining unmatched blocks in Version B (brand new additions)
  for (const blockB of blocksB) {
    if (!matchedInB.has(blockB.id)) {
      addedCount++;
      blockDiffs.push({
        id: blockB.id,
        status: "added",
        newText: blockB.text,
        chunks: [{ type: "added", text: blockB.text }],
        pageIndex: blockB.pageIndex,
        y: blockB.y,
      });
    }
  }

  // Sort diffs by page and Y position
  blockDiffs.sort((a, b) => a.pageIndex - b.pageIndex || a.y - b.y);

  const atsA = metaA.atsScore ?? snapshotA.report?.ats_match?.overall_match_score ?? 0;
  const atsB = metaB.atsScore ?? snapshotB.report?.ats_match?.overall_match_score ?? 0;

  return {
    versionA: metaA,
    versionB: metaB,
    neutralityDelta: metaB.neutralityScore - metaA.neutralityScore,
    atsDelta: atsB - atsA,
    flagsDelta: metaB.totalFlags - metaA.totalFlags,
    blockDiffs,
    summary: {
      addedCount,
      removedCount,
      modifiedCount,
      unchangedCount,
    },
  };
}
