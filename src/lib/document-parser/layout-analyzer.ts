/**
 * @file layout-analyzer.ts
 * Spatial and layout-aware analysis for resume pages.
 * Accurately detects multi-column layouts (asymmetric sidebars, 2-column, 3-column),
 * reconstructs natural reading order without interleaving columns,
 * detects section headers, contact lines, job titles, and bullet lists.
 */

import type { CanvasTextBlock, ColumnLayoutPreset, ColumnSlot } from "./types";
import { normalizeLineBullet, isDecorativeLine } from "./normalizer";

export interface RawLayoutFragment {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  color: string;
  baselineY: number;
}

export interface LineRun {
  x: number;
  y: number;
  maxX: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  color: string;
  baselineY: number;
  isCenter?: boolean;
  isRightAligned?: boolean;
  columnSlot?: ColumnSlot;
}

export interface DetectedColumns {
  layout: ColumnLayoutPreset;
  gutters: number[]; // X coordinates separating columns
  startY: number;    // Where the multi-column section begins
  endY: number;      // Where the multi-column section ends
}

/**
 * Standard known resume section titles
 */
const SECTION_HEADER_REGEX =
  /^(PROFESSIONAL SUMMARY|EXECUTIVE SUMMARY|SUMMARY|WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|EXPERIENCE|EMPLOYMENT HISTORY|EMPLOYMENT|EDUCATION|ACADEMIC BACKGROUND|TECHNICAL SKILLS|CORE COMPETENCIES|SKILLS|PROJECTS|SELECTED PROJECTS|KEY PROJECTS|CERTIFICATIONS|LICENSES & CERTIFICATIONS|AWARDS & HONORS|HONORS & AWARDS|PUBLICATIONS|LEADERSHIP|VOLUNTEER EXPERIENCE|VOLUNTEERING|ACTIVITIES|LANGUAGES|ADDITIONAL INFORMATION|REFERENCES)\b/i;

/**
 * Check if a string is a standard section header
 */
export function isSectionHeader(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 55) return false;
  if (trimmed.startsWith("•") || trimmed.startsWith("-")) return false;

  // Direct keyword match
  if (SECTION_HEADER_REGEX.test(trimmed)) return true;

  // All-caps short line check (e.g. "AREAS OF EXPERTISE")
  const isAllCaps =
    trimmed === trimmed.toUpperCase() &&
    /[A-Z]/.test(trimmed) &&
    trimmed.length >= 4 &&
    trimmed.length <= 40 &&
    !trimmed.includes("@") &&
    !trimmed.includes("HTTP");

  return isAllCaps;
}

/**
 * Detects whether line contains contact information
 */
export function isContactLine(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const hasEmail = /[\w.-]+@[\w.-]+\.\w+/.test(trimmed);
  const hasPhone = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(trimmed);
  const hasUrl = /(linkedin\.com|github\.com|http:\/\/|https:\/\/|www\.)/i.test(trimmed);
  const hasPipes = (trimmed.match(/\|/g) || []).length >= 2;

  return hasEmail || hasPhone || hasUrl || (hasPipes && trimmed.length < 120);
}

/**
 * Detects columns and gutters across the page using a spatial projection histogram
 */
export function detectPageColumns(
  lineRuns: LineRun[],
  pageWidth: number,
  pageHeight: number,
): DetectedColumns {
  if (lineRuns.length < 8) {
    return { layout: "single", gutters: [], startY: 0, endY: pageHeight };
  }

  // Filter out full-width lines (> 60% of page width)
  const nonFullWidth = lineRuns.filter(
    (r) => r.width <= pageWidth * 0.58 && r.y > 60 && r.y < pageHeight - 60,
  );

  if (nonFullWidth.length < 6) {
    return { layout: "single", gutters: [], startY: 0, endY: pageHeight };
  }

  // Find candidate vertical gutters in the range [0.22 * pageWidth, 0.78 * pageWidth]
  const minGutterX = pageWidth * 0.22;
  const maxGutterX = pageWidth * 0.78;
  const step = 8;
  const gutterCandidates: { x: number; score: number }[] = [];

  for (let testX = minGutterX; testX <= maxGutterX; testX += step) {
    let leftCount = 0;
    let rightCount = 0;
    let crossCount = 0;

    for (const r of nonFullWidth) {
      if (r.maxX < testX - 4) {
        leftCount++;
      } else if (r.x > testX + 4) {
        rightCount++;
      } else {
        crossCount++;
      }
    }

    // A valid gutter has plenty of text on both sides and very few/zero crossing items
    if (leftCount >= 4 && rightCount >= 4 && crossCount <= 1) {
      const balance = Math.min(leftCount, rightCount) / Math.max(leftCount, rightCount);
      const score = (leftCount + rightCount) * (1 - crossCount * 0.4) * (0.5 + balance * 0.5);
      gutterCandidates.push({ x: testX, score });
    }
  }

  if (gutterCandidates.length === 0) {
    return { layout: "single", gutters: [], startY: 0, endY: pageHeight };
  }

  // Pick the strongest gutter
  gutterCandidates.sort((a, b) => b.score - a.score);
  const bestGutterX = Math.round(gutterCandidates[0]!.x);

  // Determine startY and endY of the multi-column section
  const multiColRuns = nonFullWidth.filter(
    (r) => r.maxX < bestGutterX - 4 || r.x > bestGutterX + 4,
  );

  const startY = Math.min(...multiColRuns.map((r) => r.y));
  const endY = Math.max(...multiColRuns.map((r) => r.y + r.height));

  const gutterRatio = bestGutterX / pageWidth;
  let layout: ColumnLayoutPreset = "two-column-equal";

  if (gutterRatio < 0.40) {
    layout = "two-column-left"; // Narrow left sidebar (~30%)
  } else if (gutterRatio > 0.60) {
    layout = "two-column-right"; // Narrow right sidebar (~30%)
  } else {
    layout = "two-column-equal"; // Split in middle (~50/50)
  }

  return {
    layout,
    gutters: [bestGutterX],
    startY: Math.max(0, startY - 10),
    endY: Math.min(pageHeight, endY + 10),
  };
}

/**
 * Orders runs logically based on page layout:
 * - Top full-width header
 * - Left column from top to bottom
 * - Right column from top to bottom
 * - Bottom full-width footer (if any)
 */
export function orderRunsByLayout(
  lineRuns: LineRun[],
  columns: DetectedColumns,
  pageWidth: number,
): LineRun[] {
  if (columns.layout === "single" || columns.gutters.length === 0) {
    return [...lineRuns].sort((a, b) => {
      const diffY = a.baselineY - b.baselineY;
      if (Math.abs(diffY) > 3) return diffY;
      return a.x - b.x;
    });
  }

  const gutterX = columns.gutters[0]!;
  const topHeaderRuns: LineRun[] = [];
  const col1Runs: LineRun[] = [];
  const col2Runs: LineRun[] = [];
  const bottomFooterRuns: LineRun[] = [];

  for (const run of lineRuns) {
    // 1. Spanning line or above multi-column start
    if (run.y < columns.startY || (run.width > pageWidth * 0.65 && run.y < columns.startY + 60)) {
      run.columnSlot = "full";
      topHeaderRuns.push(run);
    } else if (run.y > columns.endY && run.width > pageWidth * 0.65) {
      run.columnSlot = "full";
      bottomFooterRuns.push(run);
    } else if (run.maxX <= gutterX + 6) {
      run.columnSlot = "left";
      col1Runs.push(run);
    } else if (run.x >= gutterX - 6) {
      run.columnSlot = "right";
      col2Runs.push(run);
    } else {
      // Crosses gutter - if primarily in column 1 or column 2
      const center = run.x + run.width / 2;
      if (center < gutterX) {
        run.columnSlot = "left";
        col1Runs.push(run);
      } else {
        run.columnSlot = "right";
        col2Runs.push(run);
      }
    }
  }

  const sortByY = (a: LineRun, b: LineRun) => {
    const diffY = a.baselineY - b.baselineY;
    if (Math.abs(diffY) > 3) return diffY;
    return a.x - b.x;
  };

  topHeaderRuns.sort(sortByY);
  col1Runs.sort(sortByY);
  col2Runs.sort(sortByY);
  bottomFooterRuns.sort(sortByY);

  return [...topHeaderRuns, ...col1Runs, ...col2Runs, ...bottomFooterRuns];
}

/**
 * Reconstructs CanvasTextBlocks from ordered line runs
 */
export function reconstructCanvasBlocks(
  orderedRuns: LineRun[],
  pageIndex: number,
  pageWidth: number,
  pageHeight: number,
): CanvasTextBlock[] {
  if (orderedRuns.length === 0) return [];

  // Determine baseline left margin
  const bodyRuns = orderedRuns.filter(
    (r) => !r.text.startsWith("•") && r.width > 60 && !r.isCenter,
  );
  const minBodyX = bodyRuns.length > 0 ? Math.min(...bodyRuns.map((r) => r.x)) : 40;
  const baseMargin = Math.max(28, Math.min(54, Math.round(minBodyX)));

  const blocks: CanvasTextBlock[] = [];
  let i = 0;

  while (i < orderedRuns.length) {
    const cur = orderedRuns[i]!;
    let rawText = cur.text.trim();
    let width = cur.width;
    let height = cur.height;

    // Check if line is purely a decorative divider
    if (isDecorativeLine(rawText)) {
      blocks.push({
        id: `p${pageIndex + 1}-div-${blocks.length + 1}`,
        pageIndex,
        text: "",
        x: cur.x,
        y: Math.round(cur.y),
        width: Math.max(cur.width, 200),
        height: 2,
        fontSize: 1,
        fontFamily: "Calibri, sans-serif",
        isDivider: true,
        dividerStyle: "solid",
        dividerColor: "#cbd5e1",
      });
      i++;
      continue;
    }

    const { text: normalizedBulletText, isBullet } = normalizeLineBullet(rawText);
    rawText = normalizedBulletText;

    const isHeader = isSectionHeader(rawText);
    const isCandidateName =
      i === 0 && pageIndex === 0 && (cur.fontSize >= 13.5 || cur.bold) && !isHeader;
    const isContact = (i === 1 || i === 2) && pageIndex === 0 && isContactLine(rawText);

    // Job title line heuristic (e.g. "Senior Engineer — Stripe | 2021-Present")
    const isJobTitleLine =
      !isHeader &&
      !isCandidateName &&
      !isContact &&
      !isBullet &&
      (rawText.includes(" — ") ||
        rawText.includes(" | ") ||
        /^(Senior|Lead|Staff|Principal|Software|Frontend|Backend|Fullstack|Data|ML|Product|Engineering|Director|Manager|Consultant)\b/i.test(
          rawText,
        )) &&
      rawText.length < 90;

    let nextIdx = i + 1;

    // Merge multi-line wrapping paragraphs within the SAME column slot
    if (!isHeader && !isCandidateName && !isJobTitleLine) {
      while (nextIdx < orderedRuns.length) {
        const next = orderedRuns[nextIdx]!;

        // NEVER merge across different column slots!
        if (next.columnSlot !== cur.columnSlot) {
          break;
        }

        const gapY = next.y - (cur.y + height);
        const sameStyle =
          cur.fontFamily === next.fontFamily &&
          Math.abs(cur.fontSize - next.fontSize) <= 1 &&
          cur.bold === next.bold &&
          cur.italic === next.italic;

        const isNaturalLineSpacing = gapY >= -2 && gapY <= Math.max(8, cur.fontSize * 0.95);
        const sameMargin = Math.abs(cur.x - next.x) <= 14;

        const { isBullet: nextIsBullet } = normalizeLineBullet(next.text);
        const nextIsHeader = isSectionHeader(next.text);
        const curEndsTerminal = /[.!?:]$/.test(rawText);

        if (
          sameStyle &&
          isNaturalLineSpacing &&
          sameMargin &&
          !nextIsBullet &&
          !nextIsHeader &&
          (!curEndsTerminal || /^[a-z]/.test(next.text.trim()))
        ) {
          rawText += " " + next.text.trim();
          width = Math.max(width, next.width);
          height = Math.round(next.y + next.height - cur.y);
          nextIdx++;
        } else {
          break;
        }
      }
    }

    // Typography styling
    let fontSize = cur.fontSize ? Math.round(cur.fontSize * 10) / 10 : 9.5;
    let bold = cur.bold;
    let color = cur.color && cur.color !== "#000000" ? cur.color : "#111827";
    let align: CanvasTextBlock["align"] = "left";
    let spaceBefore = 2;
    let spaceAfter = 2;
    let indent = 0;

    const isCentered = Math.abs(cur.x + cur.width / 2 - pageWidth / 2) < 45;
    const isRightAligned = cur.x + cur.width > pageWidth - 60 && cur.width < pageWidth * 0.45;

    if (isCandidateName) {
      fontSize = Math.max(16, Math.min(26, fontSize));
      bold = true;
      color = "#0f172a";
      align = isCentered ? "center" : "left";
      spaceBefore = 4;
      spaceAfter = 4;
    } else if (isContact) {
      fontSize = Math.max(8, Math.min(10.5, fontSize));
      color = "#475569";
      align = isCentered ? "center" : "left";
      spaceBefore = 0;
      spaceAfter = 6;
    } else if (isHeader) {
      fontSize = Math.max(11, Math.min(14, fontSize));
      bold = true;
      color = "#1e3a8a";
      align = "left";
      spaceBefore = 8;
      spaceAfter = 3;
    } else if (isJobTitleLine) {
      fontSize = Math.max(9.5, Math.min(12, fontSize));
      bold = true;
      align = "left";
      spaceBefore = 5;
      spaceAfter = 2;
    } else if (isBullet) {
      fontSize = Math.max(8.5, Math.min(11, fontSize));
      align = "left";
      indent = 14;
      spaceBefore = 2;
      spaceAfter = 2;
    } else {
      align = isCentered ? "center" : isRightAligned ? "right" : "left";
    }

    blocks.push({
      id: `frame-${pageIndex + 1}-block-${blocks.length + 1}`,
      pageIndex,
      text: rawText,
      x: cur.columnSlot === "full" ? baseMargin : cur.x,
      y: Math.round(cur.y * 10) / 10,
      width: Math.round(width * 10) / 10,
      height: Math.max(Math.round(height), 16),
      fontSize,
      fontFamily: cur.fontFamily,
      bold,
      italic: cur.italic,
      underline: false,
      color,
      align,
      lineHeight: 1.25,
      letterSpacing: 0,
      spaceBefore,
      spaceAfter,
      indent,
      isTitle: isCandidateName,
      isHeading: isHeader || isJobTitleLine,
      isBullet,
      columnSlot: cur.columnSlot,
    });

    i = nextIdx;
  }

  return blocks;
}
