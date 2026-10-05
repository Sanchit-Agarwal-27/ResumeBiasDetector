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
  color?: string;
  align?: "left" | "center" | "right" | "justify";
  lineHeight?: number;
  isTitle?: boolean;
}

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

/**
 * High-fidelity PDF layout extraction engine.
 * Preserves exact (x, y) coordinates, font size, bold/italic, font family,
 * and extracts true RGB color from the PDF operator stream.
 * Fully column-aware to prevent multi-column resumes from interleaving.
 */
export function clusterPdfTextContent(
  textContentItems: Array<any>,
  styles: Record<string, any>,
  viewportWidth: number,
  viewportHeight: number,
  pageIndex: number,
  commonObjs?: any,
  opList?: any,
): CanvasTextBlock[] {
  // 1. Extract exact color stream from PDF operators if available
  let curColor = "#111827";
  const opRecords: Array<{ color: string; text: string }> = [];

  if (opList && opList.fnArray && opList.argsArray) {
    const OPS_SET_RGB = 59; // ops.setFillRGBColor
    const OPS_SET_GRAY = 57; // ops.setFillGray
    const OPS_SHOW_TEXT = 44; // ops.showText
    const OPS_SHOW_SPACED = 45; // ops.showSpacedText

    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i];

      if (fn === OPS_SET_RGB && args) {
        const r = Math.round(args[0] ?? 0);
        const g = Math.round(args[1] ?? 0);
        const b = Math.round(args[2] ?? 0);
        curColor = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
      } else if (fn === OPS_SET_GRAY && args) {
        const g = Math.round((args[0] ?? 0) * 255);
        curColor = `#${g.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}`;
      } else if ((fn === OPS_SHOW_TEXT || fn === OPS_SHOW_SPACED) && args) {
        let str = "";
        if (Array.isArray(args[0])) {
          for (const item of args[0]) {
            if (typeof item === "string") str += item;
            else if (item && typeof item === "object" && item.unicode !== undefined) {
              str += item.unicode;
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

  // 2. Extract font metadata from commonObjs & styles dictionary
  const fontMap: Record<
    string,
    { name: string; family: string; bold: boolean; italic: boolean; ascent: number }
  > = {};

  for (const fontId of Object.keys(styles || {})) {
    const fontObj = commonObjs?.has?.(fontId) ? commonObjs.get(fontId) : null;
    const fontName =
      fontObj?.name || fontObj?.loadedName || styles[fontId]?.fontFamily || "sans-serif";
    const isBold = Boolean(
      fontObj?.bold || /bold|black|heavy|medium|semibold/i.test(fontName),
    );
    const isItalic = Boolean(fontObj?.italic || /italic|oblique/i.test(fontName));

    let family = "Arial, sans-serif";
    if (/montserrat/i.test(fontName)) family = "'Montserrat', sans-serif";
    else if (/calibri/i.test(fontName)) family = "Calibri, sans-serif";
    else if (/poppins/i.test(fontName)) family = "'Poppins', sans-serif";
    else if (/lato/i.test(fontName)) family = "'Lato', sans-serif";
    else if (/open\s*sans/i.test(fontName)) family = "'Open Sans', sans-serif";
    else if (/times|georgia|serif|cambria/i.test(fontName)) family = "Georgia, serif";
    else if (/courier|mono|consolas/i.test(fontName)) family = "'Courier New', monospace";
    else if (/helvetica/i.test(fontName)) family = "Helvetica, Arial, sans-serif";
    else if (/roboto/i.test(fontName)) family = "Roboto, sans-serif";
    else if (/inter/i.test(fontName)) family = "Inter, sans-serif";

    fontMap[fontId] = {
      name: fontName,
      family,
      bold: isBold,
      italic: isItalic,
      ascent: fontObj?.ascent ?? styles[fontId]?.ascent ?? 0.78,
    };
  }

  // 3. Process raw text items and associate precise coordinates and colors
  const rawFragments: RawFragment[] = [];
  let opCursor = 0;

  for (let i = 0; i < textContentItems.length; i++) {
    const it = textContentItems[i];
    if (!it || typeof it.str !== "string" || !it.str.trim()) continue;

    const trimmedStr = it.str.trim();

    // Match color from opRecords
    let assignedColor = "#111827";
    if (opCursor < opRecords.length && opRecords[opCursor]?.text === trimmedStr) {
      assignedColor = opRecords[opCursor]!.color;
      opCursor++;
    } else if (opRecords.length > 0) {
      const matchIdx = opRecords
        .slice(opCursor, opCursor + 6)
        .findIndex(
          (r) =>
            r.text === trimmedStr ||
            r.text.includes(trimmedStr) ||
            trimmedStr.includes(r.text),
        );
      if (matchIdx !== -1) {
        assignedColor = opRecords[opCursor + matchIdx]!.color;
        opCursor = opCursor + matchIdx + 1;
      } else if (opCursor < opRecords.length) {
        assignedColor = opRecords[opCursor]?.color || "#111827";
      }
    }

    const transform = it.transform || [12, 0, 0, 12, 0, 0];
    const fontSize = Math.max(7, Math.round(Math.abs(transform[0]) * 10) / 10);
    const fontInfo = fontMap[it.fontName] || {
      family: "Arial, sans-serif",
      bold: false,
      italic: false,
      ascent: 0.78,
    };

    let text = it.str;
    if (transform[0] < 0 || it.dir === "rtl") {
      if (/^[a-z].*[A-Z]$/.test(text.trim())) {
        text = text.split("").reverse().join("");
      }
    }

    const x =
      Math.round(
        (transform[0] < 0
          ? transform[4] - Math.max(it.width, fontSize * 0.8)
          : transform[4]) * 10,
      ) / 10;

    // Use consistent baseline-to-top metric (0.80) to ensure lines on the same baseline align
    const baselineY = viewportHeight - transform[5];
    const y = Math.round((baselineY - fontSize * 0.8) * 10) / 10;
    const width = Math.round(Math.max(it.width, fontSize * 0.4) * 10) / 10;
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

  // 4. Sort fragments by baseline then X
  rawFragments.sort((a, b) =>
    Math.abs(a.baselineY - b.baselineY) > 2 ? a.baselineY - b.baselineY : a.x - b.x,
  );

  // 5. Group into horizontal lines (within 2.5pt baseline tolerance)
  const lines: TextLine[] = [];
  for (const frag of rawFragments) {
    const existingLine = lines.find((l) => Math.abs(l.baselineY - frag.baselineY) <= 2.5);
    if (existingLine) {
      existingLine.fragments.push(frag);
    } else {
      lines.push({
        baselineY: frag.baselineY,
        y: frag.y,
        fragments: [frag],
      });
    }
  }
  lines.sort((a, b) => a.y - b.y);

  // 6. On each line, merge adjacent words that belong to the same text run
  interface LineFrame {
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
  }

  const lineFrames: LineFrame[] = [];

  for (const line of lines) {
    line.fragments.sort((a, b) => a.x - b.x);
    let cur: LineFrame | null = null;

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
        };
        continue;
      }

      const gap = frag.x - cur.maxX;
      const sameStyle =
        cur.fontFamily === frag.fontFamily &&
        Math.abs(cur.fontSize - frag.fontSize) <= 1 &&
        cur.bold === frag.bold &&
        cur.italic === frag.italic &&
        cur.color === frag.color;

      const isInlineContinuation = gap >= -2 && gap <= Math.max(16, cur.fontSize * 1.5);

      if (sameStyle && isInlineContinuation) {
        let sep = "";
        if (
          gap > cur.fontSize * 0.18 &&
          !cur.text.endsWith(" ") &&
          !frag.text.startsWith(" ")
        ) {
          sep = " ";
        }
        cur.text += sep + frag.text;
        cur.maxX = Math.max(cur.maxX, frag.x + frag.width);
        cur.width = Math.round((cur.maxX - cur.x) * 10) / 10;
        cur.height = Math.max(cur.height, frag.height);
      } else {
        lineFrames.push({ ...cur });
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
        };
      }
    }

    if (cur) lineFrames.push({ ...cur });
  }

  // 7. Multi-column detection to avoid interleaving left & right columns
  const hasTwoColumns =
    lineFrames.some((r) => r.x > viewportWidth * 0.55 && r.width < viewportWidth * 0.45) &&
    lineFrames.some((r) => r.x < viewportWidth * 0.45 && r.width < viewportWidth * 0.55);

  let columnSplitX = viewportWidth * 0.52;
  if (hasTwoColumns) {
    const leftRightSplit = lineFrames
      .filter((r) => r.x > viewportWidth * 0.4 && r.x < viewportWidth * 0.7)
      .map((r) => r.x);
    if (leftRightSplit.length > 0) {
      columnSplitX = Math.min(...leftRightSplit) - 8;
    }
  }

  const headerRuns: LineFrame[] = [];
  const leftRuns: LineFrame[] = [];
  const rightRuns: LineFrame[] = [];

  for (const run of lineFrames) {
    if (!hasTwoColumns) {
      leftRuns.push(run);
    } else if (
      run.y < 120 &&
      (run.fontSize >= 14 || run.x + run.width > columnSplitX + 30)
    ) {
      headerRuns.push(run);
    } else if (run.x >= columnSplitX - 10) {
      rightRuns.push(run);
    } else {
      leftRuns.push(run);
    }
  }

  // Helper to merge wrapped sentences within the same column group
  const mergeRunsInColumn = (runs: LineFrame[]): LineFrame[] => {
    runs.sort((a, b) => a.y - b.y);
    const result: LineFrame[] = [];
    let i = 0;

    while (i < runs.length) {
      const frame = { ...runs[i]! };
      let nextIdx = i + 1;

      while (nextIdx < runs.length) {
        const next = runs[nextIdx]!;
        const gapY = next.y - (frame.y + frame.height);

        const sameStyle =
          frame.fontFamily === next.fontFamily &&
          Math.abs(frame.fontSize - next.fontSize) <= 1 &&
          frame.bold === next.bold &&
          frame.italic === next.italic &&
          frame.color === next.color;

        const isNaturalLineSpacing =
          gapY >= -2 && gapY <= Math.max(9, frame.fontSize * 0.95);
        const sameMargin = Math.abs(frame.x - next.x) <= 8; // exact same left margin
        const isBulletStart = /^[•\-\*]|\d+\./.test(next.text.trim());
        const isHeader = next.bold || next.fontSize >= 12;
        const prevEndsTerminal = /[\.\!\?]$/.test(frame.text.trim());
        const isWrappedLine =
          frame.width > 140 && !isBulletStart && !isHeader && !frame.text.includes("|");

        // Merge if this is an authentic multi-line sentence continuation
        if (
          sameStyle &&
          isNaturalLineSpacing &&
          sameMargin &&
          isWrappedLine &&
          (!prevEndsTerminal || /^[a-z]/.test(next.text.trim()))
        ) {
          frame.text += " " + next.text.trim();
          frame.width = Math.max(frame.width, next.width);
          frame.height = Math.round(next.y + next.height - frame.y);
          nextIdx++;
        } else {
          break;
        }
      }

      result.push(frame);
      i = nextIdx;
    }
    return result;
  };

  const finalMerged: LineFrame[] = [
    ...mergeRunsInColumn(headerRuns),
    ...mergeRunsInColumn(leftRuns),
    ...mergeRunsInColumn(rightRuns),
  ];

  return finalMerged.map((b, idx) => ({
    id: `frame-${pageIndex + 1}-block-${idx + 1}`,
    pageIndex,
    text: b.text,
    x: Math.round(b.x * 10) / 10,
    y: Math.round(b.y * 10) / 10,
    width: Math.max(Math.round(b.width * 10) / 10 + 6, 24),
    height: Math.round(b.height),
    fontSize: b.fontSize,
    fontFamily: b.fontFamily,
    bold: b.bold,
    italic: b.italic,
    color: b.color,
    align: "left",
    lineHeight: 1.25,
    isTitle: b.fontSize >= 13 || (b.bold && b.fontSize >= 10.5),
  }));
}

/**
 * Converts raw text (from DOCX or text paste) into structured Canva/Figma blocks
 * with realistic typography and positioning.
 */
export function parseRawTextToCanvasBlocks(
  rawText: string,
  pageWidth = 595,
  pageHeight = 842,
): CanvasTextBlock[] {
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  const blocks: CanvasTextBlock[] = [];

  let currentY = 36;
  const marginX = 36;
  const contentWidth = pageWidth - marginX * 2;
  let pageIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    const isHeaderLine =
      line.length < 45 &&
      (i === 0 ||
        /^(EDUCATION|EXPERIENCE|PROJECTS|SKILLS|TECHNICAL SKILLS|PUBLICATIONS|AWARDS|CERTIFICATIONS|COURSEWORK|ACHIEVEMENTS|ADDITIONAL)/i.test(
          line,
        ) ||
        (line === line.toUpperCase() && line.length > 3));

    const isTitleLine = i === 0 && line.length < 35;
    const isBulletLine = /^[•\-\*]/.test(line);

    let fontSize = 9;
    let bold = false;
    let color = "#222222";
    let align: CanvasTextBlock["align"] = "left";

    if (isTitleLine) {
      fontSize = 20;
      bold = true;
      color = "#000000";
    } else if (isHeaderLine) {
      fontSize = 11;
      bold = true;
      color = "#17365d";
    } else if (isBulletLine) {
      fontSize = 8.7;
      bold = false;
      color = "#222222";
    } else if (line.includes(" | ") || line.includes("@") || line.includes("linkedin")) {
      fontSize = 8.8;
      bold = false;
      color = "#444444";
    }

    const estimatedHeight = Math.max(14, Math.round(fontSize * 1.35));

    // Auto page overflow
    if (currentY + estimatedHeight > pageHeight - 36) {
      pageIdx++;
      currentY = 36;
    }

    blocks.push({
      id: `text-block-${blocks.length + 1}`,
      pageIndex: pageIdx,
      text: line,
      x: isBulletLine ? marginX + 4 : marginX,
      y: currentY,
      width: contentWidth,
      height: estimatedHeight,
      fontSize,
      fontFamily: "Inter, sans-serif",
      bold,
      color,
      align,
      lineHeight: 1.25,
      isTitle: isHeaderLine || isTitleLine,
    });

    currentY += estimatedHeight + (isHeaderLine ? 8 : isTitleLine ? 10 : 4);
  }

  return blocks;
}
