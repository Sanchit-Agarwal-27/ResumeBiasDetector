/**
 * @file pdf-parser.ts
 * High-fidelity layout-aware PDF resume parser.
 * Features:
 * - Multi-column detection (asymmetric sidebars 30/70, 70/30, 50/50, and 1-column)
 * - Suppression of repeated page headers, footers, and page numbers
 * - Deduplication of overlapping text layers (shadow text, vector outlines)
 * - Preservation of section headings, bullet lists, dates, and contact info
 * - Integrated OCR fallback for scanned or image-based PDFs
 */

import type {
  CanvasTextBlock,
  CanvasPage,
  ParsedResumeDocument,
  ParserOptions,
  ColumnLayoutPreset,
} from "./types";
import { normalizeResumeText } from "./normalizer";
import { validateExtraction, deduplicateOverlappingFragments } from "./validator";
import {
  detectPageColumns,
  mergeSameBaselineRuns,
  orderRunsByLayout,
  reconstructCanvasBlocks,
  isSectionHeader,
  isContactLine,
  isDateOrMetadata,
  type LineRun,
  type RawLayoutFragment,
} from "./layout-analyzer";
import { shouldTriggerOcrFallback, runOcrOnImage } from "./ocr-service";

/**
 * Checks if a text line is a repeated page header or footer
 */
function isRepeatedHeaderOrFooter(
  text: string,
  y: number,
  pageHeight: number,
  pageIndex: number,
  candidateName?: string,
): boolean {
  const trimmed = text.trim();

  // Bottom footer page numbers and confidentiality markers are suppressed on ALL pages
  if (y > pageHeight - 55) {
    if (/^(page\s+\d+(\s+of\s+\d+)?|\d+\s*\/\s*\d+|\d+)$/i.test(trimmed)) {
      return true;
    }
    if (/^(confidential|all rights reserved|resume\s+-\s+page\s+\d+)/i.test(trimmed)) {
      return true;
    }
  }

  // Top header check on subsequent pages (page 2+)
  if (pageIndex > 0 && y < 60) {
    if (/^(page\s+\d+(\s+of\s+\d+)?|\d+\s*\/\s*\d+|\d+)$/i.test(trimmed)) {
      return true;
    }
    if (candidateName && trimmed.toLowerCase().includes(candidateName.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * High-fidelity PDF Parser
 */
export async function parsePdfResume(
  data: ArrayBuffer | Uint8Array,
  fileName: string,
  options: ParserOptions = {},
): Promise<ParsedResumeDocument> {
  const startTime = Date.now();
  const pdfjs = await import("pdfjs-dist");

  if (options.pdfWorkerUrl) {
    pdfjs.GlobalWorkerOptions.workerSrc = options.pdfWorkerUrl;
  }

  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(data),
    useSystemFonts: true,
  }).promise;

  const numPages = pdf.numPages;
  const allCanvasBlocks: CanvasTextBlock[] = [];
  const allCanvasPages: CanvasPage[] = [];
  const pageTexts: string[] = [];

  let candidateName: string | undefined;
  let primaryColumnLayout: ColumnLayoutPreset = "single";
  let ocrUsed = false;

  for (let pageIdx = 0; pageIdx < numPages; pageIdx++) {
    const page = await pdf.getPage(pageIdx + 1);
    const viewport = page.getViewport({ scale: 1.0 });

    const normWidth = viewport.width <= 600 ? 595 : 612;
    const normHeight = viewport.height >= 820 ? 842 : 792;

    allCanvasPages.push({
      id: `page-${pageIdx + 1}`,
      pageNumber: pageIdx + 1,
      width: normWidth,
      height: normHeight,
    });

    const textContent = await page.getTextContent();
    const rawFragments: RawLayoutFragment[] = [];

    // Extract raw text fragments with spatial coordinates
    for (const item of textContent.items) {
      if (!("str" in item) || !item.str || !item.str.trim()) continue;

      const str = item.str;
      const transform = item.transform || [12, 0, 0, 12, 0, 0];
      const scaleX = transform[0] ?? 12;
      const posX = transform[4] ?? 0;
      const posY = transform[5] ?? 0;
      const fontSize = Math.max(7, Math.round(Math.abs(scaleX) * 10) / 10);

      const baselineY = viewport.height - posY;
      const y = Math.round((baselineY - fontSize * 0.8) * 10) / 10;
      const width = typeof item.width === "number" ? item.width : fontSize * 0.55 * str.length;
      const height = Math.round(fontSize * 1.25 * 10) / 10;

      const fontName = item.fontName || "";
      const bold = Boolean(/bold|black|heavy|medium|semibold|bld/i.test(fontName));
      const italic = Boolean(/italic|oblique|ital/i.test(fontName));

      rawFragments.push({
        text: str,
        x: Math.round(posX * 10) / 10,
        y,
        width: Math.round(width * 10) / 10,
        height,
        fontSize,
        fontFamily: "Calibri, sans-serif",
        bold,
        italic,
        color: "#111827",
        baselineY,
      });
    }

    // Deduplicate overlapping shadow layers
    const deduplicated = deduplicateOverlappingFragments(rawFragments);

    // Group into horizontal lines
    deduplicated.sort((a, b) =>
      Math.abs(a.baselineY - b.baselineY) > 2.5 ? a.baselineY - b.baselineY : a.x - b.x,
    );

    const lines: { baselineY: number; y: number; fragments: RawLayoutFragment[] }[] = [];
    for (const frag of deduplicated) {
      const matchLine = lines.find((l) => Math.abs(l.baselineY - frag.baselineY) <= 3.0);
      if (matchLine) {
        matchLine.fragments.push(frag);
      } else {
        lines.push({ baselineY: frag.baselineY, y: frag.y, fragments: [frag] });
      }
    }

    // Merge fragments on each line into word runs
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
          Math.abs(cur.fontSize - frag.fontSize) <= 1.2 &&
          cur.bold === frag.bold &&
          cur.italic === frag.italic;

        // Inline continuation within words (small natural gap)
        const isWordContinuation = gap >= -3 && gap <= Math.max(14, cur.fontSize * 1.25);

        if (sameStyle && isWordContinuation) {
          const needsSpace =
            gap > cur.fontSize * 0.16 && !cur.text.endsWith(" ") && !frag.text.startsWith(" ");
          cur.text += (needsSpace ? " " : "") + frag.text;
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

    // Check candidate name on page 1
    if (pageIdx === 0 && lineRuns.length > 0) {
      const topRun = lineRuns[0]!;
      if (!isSectionHeader(topRun.text) && !isContactLine(topRun.text)) {
        candidateName = topRun.text.trim();
      }
    }

    // Filter repeated headers and footers on multi-page resumes
    const filteredRuns = lineRuns.filter(
      (r) => !isRepeatedHeaderOrFooter(r.text, r.y, viewport.height, pageIdx, candidateName),
    );

    // Layout detection (single vs multi-column)
    const columns = detectPageColumns(filteredRuns, viewport.width, viewport.height);
    if (columns.layout !== "single") {
      primaryColumnLayout = columns.layout;
    }

    // Merge same baseline runs (connect right-aligned dates/metadata within same column)
    const mergedRuns = mergeSameBaselineRuns(filteredRuns, columns);

    // Order runs according to layout columns
    const orderedRuns = orderRunsByLayout(mergedRuns, columns, viewport.width);

    // Reconstruct blocks
    const pageBlocks = reconstructCanvasBlocks(
      orderedRuns,
      pageIdx,
      viewport.width,
      viewport.height,
    );

    allCanvasBlocks.push(...pageBlocks);
    pageTexts.push(
      pageBlocks
        .filter((b) => !b.isDivider && b.text.trim())
        .map((b) => b.text)
        .join("\n"),
    );
  }

  let rawText = pageTexts.join("\n\n").trim();
  let cleanedText = normalizeResumeText(rawText);

  // Check if OCR fallback is required (e.g. scanned image PDF or zero readable text)
  if (
    options.allowOcr &&
    shouldTriggerOcrFallback(cleanedText.length, numPages) &&
    typeof document !== "undefined"
  ) {
    try {
      const ocrTexts: string[] = [];
      for (let pageIdx = 0; pageIdx < numPages; pageIdx++) {
        const page = await pdf.getPage(pageIdx + 1);
        const viewport = page.getViewport({ scale: 2.0 });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
          const ocrResult = await runOcrOnImage(canvas);
          if (ocrResult.text.trim()) {
            ocrTexts.push(ocrResult.text.trim());
          }
        }
      }

      if (ocrTexts.length > 0) {
        rawText = ocrTexts.join("\n\n");
        cleanedText = normalizeResumeText(rawText);
        ocrUsed = true;
      }
    } catch {
      // Fallback silently if OCR execution encounters issues; validation will record status
    }
  }

  const validation = validateExtraction(cleanedText, {
    pageCount: numPages,
    expectedMinCharsPerPage: 100,
  });

  const diagnostics = {
    fileName,
    fileType: "pdf" as const,
    pageCount: numPages,
    characterCount: cleanedText.length,
    wordCount: cleanedText.split(/\s+/).filter(Boolean).length,
    method: (ocrUsed ? "pdf-ocr" : "pdf-native-layout") as "pdf-native-layout" | "pdf-ocr",
    ocrTriggered: ocrUsed,
    columnLayout: primaryColumnLayout,
    validationScore: validation.qualityScore,
    validationIssues: validation.issues.map((i) => i.message),
    warnings: [],
    processingTimeMs: Date.now() - startTime,
  };

  return {
    rawText,
    cleanedText,
    canvasBlocks: allCanvasBlocks,
    canvasPages: allCanvasPages,
    diagnostics,
    validation,
  };
}
