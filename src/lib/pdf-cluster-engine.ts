import {
  deduplicateOverlappingFragments,
  detectPageColumns,
  mergeSameBaselineRuns,
  orderRunsByLayout,
  isDateOrMetadata,
  isAcademicInstitutionLine,
  isAcademicDegreeLine,
  isProfessionalRoleLine,
} from "./document-parser";

export interface CanvasTextBlock {
  id: string;
  pageIndex: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  backgroundColor?: string;
  align?: "left" | "center" | "right" | "justify";
  lineHeight?: number;
  letterSpacing?: number;
  spaceBefore?: number;
  spaceAfter?: number;
  indent?: number;
  isTitle?: boolean;
  isHeading?: boolean;
  isBullet?: boolean;
  isNumbered?: boolean;
  listNumber?: number;
  columnSlot?: "full" | "left" | "right";
  isDivider?: boolean;
  dividerStyle?: "solid" | "dashed" | "dotted" | "double" | "thick";
  dividerColor?: string;
  isTable?: boolean;
  tableData?: {
    rows: number;
    cols: number;
    cells: string[][];
    headers?: boolean;
  };
}

export type ColumnSlot = "full" | "left" | "right";
export type DividerStyle = "solid" | "dashed" | "dotted" | "double" | "thick";
export type ColumnLayoutPreset =
  "single" | "two-column-left" | "two-column-right" | "two-column-equal";

export interface CanvasPage {
  id: string;
  pageNumber: number;
  width: number;
  height: number;
  preview?: string;
}

interface RawFragment {
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
  ascent: number;
  baselineY: number;
}

interface TextLine {
  baselineY: number;
  y: number;
  fragments: RawFragment[];
}

export interface PdfCommonObjs {
  has?: (id: string) => boolean;
  get?: (id: string) => {
    name?: string;
    loadedName?: string;
    bold?: boolean;
    italic?: boolean;
    ascent?: number;
  } | null;
}

export interface PdfOpList {
  fnArray?: number[];
  argsArray?: unknown[][];
}

export interface PdfTextItem {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
  fontName?: string;
  dir?: string;
}

export interface PdfStyleItem {
  fontFamily?: string;
  ascent?: number;
}

export const STANDARD_PAGE_SIZES = {
  letter: { width: 612, height: 792, label: "US Letter (8.5 × 11 in)" },
  a4: { width: 595.28, height: 841.89, label: "A4 (210 × 297 mm)" },
};

/**
 * Normalizes bullet characters from arbitrary PDF encodings (Wingdings, symbols, hyphens)
 */
function normalizeBulletText(raw: string): { text: string; isBullet: boolean } {
  const trimmed = raw.trim();
  // Match standard bullets, Wingdings \uf0b7, middle dots, dashes, stars, geometric shapes
  const bulletRegex = /^[\u2022\u25cf\u25cb\u25aa\u25b8\uf0b7\u00b7\u2013\u2014■●○►*•]\s*|^-\s+/;
  if (bulletRegex.test(trimmed)) {
    const cleaned = trimmed.replace(bulletRegex, "").trim();
    return { text: "• " + cleaned, isBullet: true };
  }
  return { text: raw, isBullet: false };
}

/**
 * High-fidelity PDF layout extraction engine.
 * Accurately extracts reading order, aligns margins, preserves font styles,
 * and handles multi-column and two-item line structures (e.g. title + right date).
 */
export function clusterPdfTextContent(
  textContentItems: Array<PdfTextItem>,
  styles: Record<string, PdfStyleItem>,
  viewportWidth: number,
  viewportHeight: number,
  pageIndex: number,
  commonObjs?: PdfCommonObjs,
  opList?: PdfOpList,
): CanvasTextBlock[] {
  // 1. Extract color stream from PDF operators
  let curColor = "#111827";
  const opRecords: Array<{ color: string; text: string }> = [];

  if (opList && opList.fnArray && opList.argsArray) {
    const OPS_SET_RGB = 59;
    const OPS_SET_GRAY = 57;
    const OPS_SHOW_TEXT = 44;
    const OPS_SHOW_SPACED = 45;

    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i];

      if (fn === OPS_SET_RGB && args) {
        const r = Math.round(Number(args[0] ?? 0));
        const g = Math.round(Number(args[1] ?? 0));
        const b = Math.round(Number(args[2] ?? 0));
        curColor = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
      } else if (fn === OPS_SET_GRAY && args) {
        const g = Math.round(Number(args[0] ?? 0) * 255);
        curColor = `#${g.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}`;
      } else if ((fn === OPS_SHOW_TEXT || fn === OPS_SHOW_SPACED) && args) {
        let str = "";
        if (Array.isArray(args[0])) {
          for (const item of args[0]) {
            if (typeof item === "string") str += item;
            else if (
              item &&
              typeof item === "object" &&
              "unicode" in item &&
              typeof (item as { unicode: string }).unicode === "string"
            ) {
              str += (item as { unicode: string }).unicode;
            }
          }
        } else if (typeof args[0] === "string") {
          str = args[0];
        }
        if (str.trim()) {
          opRecords.push({ color: curColor, text: str.trim() });
        }
      }
    }
  }

  // 2. Extract font metadata
  const fontMap: Record<
    string,
    { name: string; family: string; bold: boolean; italic: boolean; ascent: number }
  > = {};

  for (const fontId of Object.keys(styles || {})) {
    const fontObj = commonObjs?.has?.(fontId) && commonObjs.get ? commonObjs.get(fontId) : null;
    const fontName =
      fontObj?.name || fontObj?.loadedName || styles[fontId]?.fontFamily || "Calibri, sans-serif";
    const isBold = Boolean(fontObj?.bold || /bold|black|heavy|medium|semibold|bld/i.test(fontName));
    const isItalic = Boolean(fontObj?.italic || /italic|oblique|ital/i.test(fontName));

    let family = "Calibri, sans-serif";
    if (/montserrat/i.test(fontName)) family = "'Montserrat', sans-serif";
    else if (/poppins/i.test(fontName)) family = "'Poppins', sans-serif";
    else if (/lato/i.test(fontName)) family = "'Lato', sans-serif";
    else if (/georgia/i.test(fontName)) family = "Georgia, serif";
    else if (/garamond/i.test(fontName)) family = "'EB Garamond', Georgia, serif";
    else if (/merriweather/i.test(fontName)) family = "Merriweather, serif";
    else if (/times|cambria/i.test(fontName)) family = "'Times New Roman', Times, serif";
    else if (/courier|mono|consolas/i.test(fontName)) family = "'Courier New', monospace";
    else if (/roboto/i.test(fontName)) family = "Roboto, sans-serif";
    else if (/inter/i.test(fontName)) family = "Inter, sans-serif";
    else if (/arial|helvetica/i.test(fontName)) family = "Arial, sans-serif";
    else if (/serif/i.test(fontName)) family = "'Times New Roman', Times, serif";
    else if (/calibri/i.test(fontName)) family = "Calibri, sans-serif";

    fontMap[fontId] = {
      name: fontName,
      family,
      bold: isBold,
      italic: isItalic,
      ascent: fontObj?.ascent ?? styles[fontId]?.ascent ?? 0.78,
    };
  }

  // 3. Process raw text items into RawFragments
  const rawFragments: RawFragment[] = [];
  let opCursor = 0;

  for (let i = 0; i < textContentItems.length; i++) {
    const it = textContentItems[i];
    if (!it || typeof it.str !== "string" || !it.str.trim()) continue;

    const trimmedStr = it.str.trim();

    let assignedColor = "#111827";
    if (opCursor < opRecords.length && opRecords[opCursor]?.text === trimmedStr) {
      assignedColor = opRecords[opCursor]!.color;
      opCursor++;
    } else if (opRecords.length > 0) {
      const matchIdx = opRecords
        .slice(opCursor, opCursor + 8)
        .findIndex(
          (r) =>
            r.text === trimmedStr || r.text.includes(trimmedStr) || trimmedStr.includes(r.text),
        );
      if (matchIdx !== -1) {
        assignedColor = opRecords[opCursor + matchIdx]!.color;
        opCursor = opCursor + matchIdx + 1;
      } else if (opCursor < opRecords.length) {
        assignedColor = opRecords[opCursor]?.color || "#111827";
      }
    }

    const transform = it.transform || [12, 0, 0, 12, 0, 0];
    const scaleX = transform[0] ?? 12;
    const posX = transform[4] ?? 0;
    const posY = transform[5] ?? 0;
    const fontSize = Math.max(7, Math.round(Math.abs(scaleX) * 10) / 10);
    const fontInfo =
      it.fontName && fontMap[it.fontName]
        ? fontMap[it.fontName]!
        : {
            family: "Calibri, sans-serif",
            bold: false,
            italic: false,
            ascent: 0.78,
          };

    let text = it.str;
    if (scaleX < 0 || it.dir === "rtl") {
      if (/^[a-z].*[A-Z]$/.test(text.trim())) {
        text = text.split("").reverse().join("");
      }
    }

    const itemWidth = typeof it.width === "number" ? it.width : fontSize * 0.55 * text.length;
    const x =
      Math.round((scaleX < 0 ? posX - Math.max(itemWidth, fontSize * 0.8) : posX) * 10) / 10;

    const baselineY = viewportHeight - posY;
    const y = Math.round((baselineY - fontSize * 0.8) * 10) / 10;
    const width = Math.round(Math.max(itemWidth, fontSize * 0.4) * 10) / 10;
    const height = Math.round(fontSize * 1.25 * 10) / 10;

    rawFragments.push({
      text,
      x,
      y,
      width,
      height,
      fontSize,
      fontFamily: fontInfo.family,
      bold: fontInfo.bold,
      italic: fontInfo.italic,
      color: assignedColor,
      ascent: fontInfo.ascent,
      baselineY,
    });
  }

  if (rawFragments.length === 0) {
    return [];
  }

  // Deduplicate overlapping shadow text and vector outline duplicates
  const cleanedFragments = deduplicateOverlappingFragments(rawFragments);

  // 4. Baseline clustering into horizontal lines (3.0pt tolerance)
  cleanedFragments.sort((a, b) =>
    Math.abs(a.baselineY - b.baselineY) > 2.5 ? a.baselineY - b.baselineY : a.x - b.x,
  );

  const lines: TextLine[] = [];
  for (const frag of cleanedFragments) {
    const matchingLine = lines.find((l) => Math.abs(l.baselineY - frag.baselineY) <= 3.0);
    if (matchingLine) {
      matchingLine.fragments.push(frag);
    } else {
      lines.push({
        baselineY: frag.baselineY,
        y: frag.y,
        fragments: [frag],
      });
    }
  }

  lines.sort((a, b) => a.baselineY - b.baselineY);

  // 5. On each line, merge words and handle left-title + right-date combinations
  interface LineRun {
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
  }

  const lineRuns: LineRun[] = [];

  for (const line of lines) {
    line.fragments.sort((a, b) => a.x - b.x);
    let cur: LineRun | null = null;

    for (const frag of line.fragments) {
      if (!cur) {
        cur = {
          x: frag.x,
          y: frag.y,
          maxX: frag.x + frag.width,
          width: frag.width,
          height: frag.height,
          text: frag.text,
          fontSize: frag.fontSize,
          fontFamily: frag.fontFamily,
          bold: frag.bold,
          italic: frag.italic,
          color: frag.color,
          baselineY: line.baselineY,
        };
        continue;
      }

      const gap = frag.x - cur.maxX;
      const sameStyle =
        cur.fontFamily === frag.fontFamily &&
        Math.abs(cur.fontSize - frag.fontSize) <= 1.2 &&
        cur.bold === frag.bold &&
        cur.italic === frag.italic &&
        cur.color === frag.color;

      // Small inline continuation: within word spacing
      const isWordContinuation = gap >= -3 && gap <= Math.max(14, cur.fontSize * 1.2);

      // Large gap on the same line (e.g. Job Title on left, Date / Location on right)
      const isSameLineTabGap = gap > Math.max(14, cur.fontSize * 1.2) && gap < viewportWidth * 0.75;

      if (sameStyle && isWordContinuation) {
        const needsSpace =
          gap > cur.fontSize * 0.16 && !cur.text.endsWith(" ") && !frag.text.startsWith(" ");
        cur.text += (needsSpace ? " " : "") + frag.text;
        cur.maxX = Math.max(cur.maxX, frag.x + frag.width);
        cur.width = Math.round((cur.maxX - cur.x) * 10) / 10;
        cur.height = Math.max(cur.height, frag.height);
      } else if (
        isSameLineTabGap &&
        isDateOrMetadata(frag.text) &&
        Math.abs(cur.fontSize - frag.fontSize) <= 2.5
      ) {
        // Neatly connect Title + Date with a professional separator instead of ragged clumping
        const sep = cur.text.endsWith("|") || cur.text.endsWith("—") ? " " : "  |  ";
        cur.text += sep + frag.text;
        cur.maxX = Math.max(cur.maxX, frag.x + frag.width);
        cur.width = Math.round((cur.maxX - cur.x) * 10) / 10;
        cur.height = Math.max(cur.height, frag.height);
      } else {
        lineRuns.push({ ...cur });
        cur = {
          x: frag.x,
          y: frag.y,
          maxX: frag.x + frag.width,
          width: frag.width,
          height: frag.height,
          text: frag.text,
          fontSize: frag.fontSize,
          fontFamily: frag.fontFamily,
          bold: frag.bold,
          italic: frag.italic,
          color: frag.color,
          baselineY: line.baselineY,
        };
      }
    }

    if (cur) lineRuns.push({ ...cur });
  }

  // 6. Layout-aware Column & Gutter Detection (supports asymmetric sidebars & equal 2-col)
  const columns = detectPageColumns(lineRuns, viewportWidth, viewportHeight);

  // Merge same baseline runs within the same column slot
  const mergedRuns = mergeSameBaselineRuns(lineRuns, columns);

  // 7. Reconstruct natural reading order without interleaving columns
  const orderedRuns = orderRunsByLayout(mergedRuns, columns, viewportWidth);

  // 8. Natural Paragraph Clustering & Alignment Normalization
  // Detect dominant document body baseline margin
  const bodyRuns = orderedRuns.filter((r) => !r.text.startsWith("•") && r.width > 80);
  const minBodyX = bodyRuns.length > 0 ? Math.min(...bodyRuns.map((r) => r.x)) : 40;
  const baseMargin = Math.max(28, Math.min(54, Math.round(minBodyX)));
  const mergedBlocks: CanvasTextBlock[] = [];
  let i = 0;

  while (i < orderedRuns.length) {
    const cur = orderedRuns[i]!;
    let rawText = cur.text.trim();
    let width = cur.width;
    let height = cur.height;

    // Bullet normalization
    const { text: normalizedText, isBullet } = normalizeBulletText(rawText);
    rawText = normalizedText;

    const isSectionHeader =
      !isBullet &&
      rawText.length < 50 &&
      (/^(PROFESSIONAL SUMMARY|SUMMARY|EXPERIENCE|WORK EXPERIENCE|EMPLOYMENT|EDUCATION|SKILLS|TECHNICAL SKILLS|PROJECTS|CERTIFICATIONS|AWARDS|PUBLICATIONS|LEADERSHIP|ACTIVITIES)/i.test(
        rawText,
      ) ||
        (rawText === rawText.toUpperCase() && rawText.length >= 4 && !rawText.includes("•")));

    const isCandidateName = i === 0 && pageIndex === 0 && (cur.fontSize >= 14 || cur.bold);

    const isContactLine =
      (i === 1 || i === 2) &&
      pageIndex === 0 &&
      (rawText.includes("@") ||
        rawText.includes("|") ||
        rawText.includes("linkedin") ||
        rawText.includes("github"));

    const isInstitution = isAcademicInstitutionLine(rawText);
    const isDegree = isAcademicDegreeLine(rawText);
    const isRole = isProfessionalRoleLine(rawText);

    const isJobTitleLine =
      !isSectionHeader &&
      !isCandidateName &&
      !isContactLine &&
      !isBullet &&
      (rawText.includes(" — ") || rawText.includes(" | ") || isInstitution || isDegree || isRole) &&
      rawText.length < 115;

    let nextIdx = i + 1;

    // Merge multi-line wrapping paragraphs
    if (!isSectionHeader && !isCandidateName && !isJobTitleLine) {
      while (nextIdx < orderedRuns.length) {
        const next = orderedRuns[nextIdx]!;

        const nextIsEntry =
          isAcademicInstitutionLine(next.text) ||
          isAcademicDegreeLine(next.text) ||
          isProfessionalRoleLine(next.text) ||
          next.text.includes(" | ") ||
          next.text.includes(" — ");

        if (nextIsEntry) {
          break;
        }

        const gapY = next.y - (cur.y + height);

        const sameStyle =
          cur.fontFamily === next.fontFamily &&
          Math.abs(cur.fontSize - next.fontSize) <= 1 &&
          cur.bold === next.bold &&
          cur.italic === next.italic &&
          cur.color === next.color;

        const isNaturalLineSpacing = gapY >= -2 && gapY <= Math.max(8, cur.fontSize * 0.9);
        const sameMargin = Math.abs(cur.x - next.x) <= 12;

        const { isBullet: nextIsBullet } = normalizeBulletText(next.text);
        const nextIsHeader = next.bold || next.fontSize >= 12;
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

    // Determine clean styling with fidelity to source PDF
    let fontSize = cur.fontSize ? Math.round(cur.fontSize * 10) / 10 : 9.5;
    let bold = cur.bold;
    let color =
      cur.color && cur.color !== "#000000" && cur.color !== "#ffffff"
        ? cur.color
        : cur.color || "#111827";
    let align: CanvasTextBlock["align"] = "left";
    let spaceBefore = 2;
    let spaceAfter = 2;
    let indent = 0;

    // Check alignment
    const isCentered = Math.abs(cur.x + cur.width / 2 - viewportWidth / 2) < 45;
    const isRightAligned =
      cur.x + cur.width > viewportWidth - 60 && cur.width < viewportWidth * 0.45;

    // Indentation calculation relative to detected document baseline margin
    const naturalIndent = Math.max(0, Math.min(72, Math.round(cur.x - baseMargin)));

    if (isCandidateName) {
      fontSize = Math.max(16, Math.min(26, fontSize));
      bold = true;
      if (!cur.color || cur.color === "#111827") color = "#0f172a";
      align = isCentered ? "center" : "left";
      spaceBefore = 4;
      spaceAfter = 4;
    } else if (isContactLine) {
      fontSize = Math.max(8, Math.min(10.5, fontSize));
      if (!cur.color || cur.color === "#111827") color = "#475569";
      align = isCentered ? "center" : "left";
      spaceBefore = 0;
      spaceAfter = 6;
    } else if (isSectionHeader) {
      fontSize = Math.max(11, Math.min(14, fontSize));
      bold = true;
      if (!cur.color || cur.color === "#111827") color = "#1e3a8a";
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
      indent = Math.max(14, naturalIndent);
      spaceBefore = 2;
      spaceAfter = 2;
    } else {
      fontSize = Math.max(8, Math.min(13, fontSize));
      align = isCentered ? "center" : isRightAligned ? "right" : "left";
      indent = naturalIndent >= 12 && !isCentered ? naturalIndent : 0;
      spaceBefore = 2;
      spaceAfter = 2;
    }

    mergedBlocks.push({
      id: `frame-${pageIndex + 1}-block-${mergedBlocks.length + 1}`,
      pageIndex,
      text: rawText,
      x: baseMargin,
      y: Math.round(cur.y * 10) / 10,
      width: Math.max(Math.round(width * 10) / 10, viewportWidth - baseMargin * 2),
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
      isHeading: isSectionHeader || isJobTitleLine,
      isBullet,
    });

    i = nextIdx;
  }

  return mergedBlocks;
}

/**
 * Converts raw text into structured document blocks
 */
export function parseRawTextToCanvasBlocks(
  rawText: string,
  pageWidth = 612,
  pageHeight = 792,
): CanvasTextBlock[] {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const blocks: CanvasTextBlock[] = [];
  const marginX = 40;
  const contentWidth = pageWidth - marginX * 2;
  let currentY = 40;
  let pageIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    const isTitleLine = i === 0 && line.length < 40;
    const isContactLine =
      (i === 1 || i === 2) &&
      (line.includes("@") ||
        line.includes("|") ||
        line.includes("linkedin") ||
        line.includes("http"));

    const isSectionHeader =
      !isTitleLine &&
      !isContactLine &&
      line.length < 50 &&
      (/^(PROFESSIONAL SUMMARY|SUMMARY|EXPERIENCE|WORK EXPERIENCE|EMPLOYMENT|EDUCATION|SKILLS|TECHNICAL SKILLS|PROJECTS|CERTIFICATIONS|AWARDS|PUBLICATIONS|LEADERSHIP|ACTIVITIES)/i.test(
        line,
      ) ||
        (line === line.toUpperCase() && line.length >= 4 && !line.includes("•")));

    const isJobTitleLine =
      !isSectionHeader &&
      !isTitleLine &&
      !isContactLine &&
      (line.includes(" | ") ||
        line.includes(" — ") ||
        line.includes(" - ") ||
        /^(Senior|Lead|Junior|Staff|Principal|Software|Product|Engineering|Director|Manager|VP|Analyst|Consultant)/i.test(
          line,
        )) &&
      line.length < 90 &&
      !line.startsWith("•");

    const isBulletLine = /^[•\-*]|\d+\.\s/.test(line);

    let fontSize = 9.5;
    let bold = false;
    let color = "#111827";
    let align: CanvasTextBlock["align"] = "left";
    let spaceBefore = 2;
    let spaceAfter = 2;
    let indent = 0;

    if (isTitleLine) {
      fontSize = 20;
      bold = true;
      color = "#0f172a";
      align = "left";
      spaceBefore = 4;
      spaceAfter = 4;
    } else if (isContactLine) {
      fontSize = 9;
      bold = false;
      color = "#475569";
      align = "left";
      spaceBefore = 0;
      spaceAfter = 6;
    } else if (isSectionHeader) {
      fontSize = 11.5;
      bold = true;
      color = "#1e3a8a";
      align = "left";
      spaceBefore = 8;
      spaceAfter = 3;
    } else if (isJobTitleLine) {
      fontSize = 10;
      bold = true;
      color = "#0f172a";
      align = "left";
      spaceBefore = 5;
      spaceAfter = 2;
    } else if (isBulletLine) {
      fontSize = 9.5;
      bold = false;
      color = "#1f2937";
      indent = 14;
      spaceBefore = 2;
      spaceAfter = 2;
    }

    const charsPerLine = isBulletLine ? 75 : 85;
    const lineCount = Math.max(1, Math.ceil(line.length / charsPerLine));
    const estimatedHeight = Math.max(16, Math.round(lineCount * fontSize * 1.25));

    // Auto page overflow
    if (currentY + estimatedHeight > pageHeight - 40) {
      pageIdx++;
      currentY = 40;
    }

    let formattedText = line;
    if (isBulletLine && !line.startsWith("•") && (line.startsWith("-") || line.startsWith("*"))) {
      formattedText = "• " + line.slice(1).trim();
    }

    blocks.push({
      id: `text-block-${blocks.length + 1}`,
      pageIndex: pageIdx,
      text: formattedText,
      x: marginX,
      y: currentY,
      width: contentWidth,
      height: estimatedHeight,
      fontSize,
      fontFamily: "Calibri, sans-serif",
      bold,
      italic: false,
      underline: false,
      color,
      align,
      lineHeight: 1.25,
      letterSpacing: 0,
      spaceBefore,
      spaceAfter,
      indent,
      isTitle: isTitleLine,
      isHeading: isSectionHeader || isJobTitleLine,
      isBullet: isBulletLine,
    });

    currentY += estimatedHeight + spaceBefore + spaceAfter;
  }

  return blocks;
}
