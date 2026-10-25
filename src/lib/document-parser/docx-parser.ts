/**
 * @file docx-parser.ts
 * Robust DOCX resume extractor.
 * Extracts text from paragraphs, tables, nested structures, text boxes (<w:txbxContent>),
 * drawings, shapes, headers, and footers.
 * Uses JSZip to unpack Word XML without losing text box content or table column information.
 */

import JSZip from "jszip";
import type { CanvasTextBlock, CanvasPage, ParsedResumeDocument, ParserOptions } from "./types";
import { normalizeResumeText } from "./normalizer";
import { validateExtraction } from "./validator";
import { isSectionHeader, isContactLine, isDateOrMetadata } from "./layout-analyzer";

/**
 * Decodes common XML entities
 */
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Extracts plain text from a Word paragraph XML snippet
 */
function extractParagraphText(pXml: string): { text: string; isBullet: boolean } {
  const isBullet = /<w:numPr[ >]/.test(pXml) || /<w:ilvl[ >]/.test(pXml);

  // Extract all <w:t>, <w:tab/>, and <w:br/> in order
  const tokenRegex = /<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g;
  let text = "";
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(pXml)) !== null) {
    if (match[1] !== undefined) {
      text += decodeXmlEntities(match[1]);
    } else if (match[0].includes("w:tab")) {
      text += "   ";
    } else if (match[0].includes("w:br")) {
      text += "\n";
    }
  }

  const trimmed = text.trim();
  if (isBullet && trimmed && !trimmed.startsWith("•") && !trimmed.startsWith("-")) {
    return { text: `• ${trimmed}`, isBullet: true };
  }

  return { text: trimmed, isBullet };
}

/**
 * Parses table XML into structured text blocks or rows.
 * Preserves entry associations: dates/locations in adjacent cells stay aligned with their jobs/degrees.
 */
function extractTableText(tblXml: string): string[] {
  const rowMatches = tblXml.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || [];
  if (rowMatches.length === 0) return [];

  // Inspect first row to see if this is a 2-column layout table (often used for sidebar resumes)
  const firstRowCells = rowMatches[0]!.match(/<w:tc[ >][\s\S]*?<\/w:tc>/g) || [];

  // Check if this table is being used as a true 2-column full-page layout container.
  // To qualify, it MUST meet ALL criteria:
  // 1. Exactly 2 cells per row, and at most 2 rows.
  // 2. Both columns contain >= 5 paragraphs.
  // 3. Both columns contain distinct recognized section headers (e.g. SKILLS on left, EXPERIENCE on right).
  // 4. Neither column is purely dates/metadata.
  if (rowMatches.length <= 2 && firstRowCells.length === 2) {
    const col1Paragraphs: string[] = [];
    const col2Paragraphs: string[] = [];

    for (const row of rowMatches) {
      const cells = row.match(/<w:tc[ >][\s\S]*?<\/w:tc>/g) || [];
      if (cells[0]) {
        const p1 = cells[0].match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
        for (const p of p1) {
          const { text } = extractParagraphText(p);
          if (text) col1Paragraphs.push(text);
        }
      }
      if (cells[1]) {
        const p2 = cells[1].match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
        for (const p of p2) {
          const { text } = extractParagraphText(p);
          if (text) col2Paragraphs.push(text);
        }
      }
    }

    const col1HasHeader = col1Paragraphs.some((p) => isSectionHeader(p));
    const col2HasHeader = col2Paragraphs.some((p) => isSectionHeader(p));
    const col2IsDateList =
      col2Paragraphs.length > 0 &&
      col2Paragraphs.every((p) => isDateOrMetadata(p));

    if (
      col1Paragraphs.length >= 5 &&
      col2Paragraphs.length >= 5 &&
      col1HasHeader &&
      col2HasHeader &&
      !col2IsDateList
    ) {
      // True 2-column layout container: return Column 1 text, followed by Column 2 text
      return [...col1Paragraphs, "", ...col2Paragraphs];
    }
  }

  // Otherwise, this is a tabular row (e.g. Title | Date, Skills grid, or Metrics table)
  // Format ROW BY ROW to keep dates and entries aligned!
  const formattedRows: string[] = [];
  for (const row of rowMatches) {
    const cells = row.match(/<w:tc[ >][\s\S]*?<\/w:tc>/g) || [];
    if (cells.length === 0) continue;

    // Extract all paragraphs per cell
    const cellParagraphLists: string[][] = [];
    for (const cell of cells) {
      const pMatches = cell.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
      const cellLines = pMatches
        .map((p) => extractParagraphText(p).text)
        .filter(Boolean);
      cellParagraphLists.push(cellLines);
    }

    // Determine max lines in this row
    const maxLines = Math.max(...cellParagraphLists.map((l) => l.length), 0);
    if (maxLines === 0) continue;

    if (maxLines === 1) {
      // Single line per cell (e.g. Title in cell 1, Date in cell 2)
      const combined = cellParagraphLists
        .map((l) => l[0] || "")
        .filter(Boolean)
        .join("  |  ");
      if (combined) formattedRows.push(combined);
    } else {
      // Multiple lines per cell: pair up line by line where possible
      for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
        const lineParts: string[] = [];
        for (const lines of cellParagraphLists) {
          if (lines[lineIdx]) {
            lineParts.push(lines[lineIdx]!);
          }
        }
        if (lineParts.length > 0) {
          formattedRows.push(lineParts.join("  |  "));
        }
      }
    }
  }

  return formattedRows;
}

/**
 * Extracts text boxes from drawing or textbox containers
 */
function extractTextBoxes(xml: string): string[] {
  const textBoxMatches =
    xml.match(/<w:txbxContent[ >][\s\S]*?<\/w:txbxContent>|<v:textbox[ >][\s\S]*?<\/v:textbox>/g) ||
    [];

  const extracted: string[] = [];
  for (const tb of textBoxMatches) {
    const pMatches = tb.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
    for (const p of pMatches) {
      const { text } = extractParagraphText(p);
      if (text) extracted.push(text);
    }
  }

  return extracted;
}

/**
 * Converts lines of text to styled CanvasTextBlocks
 */
export function convertLinesToCanvasBlocks(
  lines: string[],
  pageWidth = 612,
  pageHeight = 792,
): { blocks: CanvasTextBlock[]; pages: CanvasPage[] } {
  const blocks: CanvasTextBlock[] = [];
  const marginX = 40;
  const contentWidth = pageWidth - marginX * 2;
  let currentY = 40;
  let pageIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;

    const isTitle = i === 0 && line.length < 50;
    const isContact = (i === 1 || i === 2) && isContactLine(line);
    const isHeader = isSectionHeader(line);
    const isBullet = line.startsWith("•") || /^[•\-*]|\d+\.\s/.test(line);

    let fontSize = 9.5;
    let bold = false;
    let color = "#111827";
    let spaceBefore = 2;
    let spaceAfter = 2;
    let indent = 0;

    if (isTitle) {
      fontSize = 20;
      bold = true;
      color = "#0f172a";
      spaceBefore = 4;
      spaceAfter = 4;
    } else if (isContact) {
      fontSize = 9;
      color = "#475569";
      spaceBefore = 0;
      spaceAfter = 6;
    } else if (isHeader) {
      fontSize = 12;
      bold = true;
      color = "#1e3a8a";
      spaceBefore = 8;
      spaceAfter = 3;
    } else if (isBullet) {
      fontSize = 9.5;
      indent = 14;
      spaceBefore = 2;
      spaceAfter = 2;
    }

    const estimatedHeight = Math.max(16, Math.round(fontSize * 1.3));

    if (currentY + estimatedHeight > pageHeight - 40) {
      pageIdx++;
      currentY = 40;
    }

    blocks.push({
      id: `docx-block-${blocks.length + 1}`,
      pageIndex: pageIdx,
      text: line,
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
      align: "left",
      lineHeight: 1.25,
      letterSpacing: 0,
      spaceBefore,
      spaceAfter,
      indent,
      isTitle,
      isHeading: isHeader,
      isBullet,
    });

    currentY += estimatedHeight + spaceBefore + spaceAfter;
  }

  const totalPages = Math.max(1, pageIdx + 1);
  const pages: CanvasPage[] = Array.from({ length: totalPages }, (_, idx) => ({
    id: `page-${idx + 1}`,
    pageNumber: idx + 1,
    width: pageWidth,
    height: pageHeight,
  }));

  return { blocks, pages };
}

/**
 * Primary DOCX Resume Parser
 */
export async function parseDocxResume(
  data: ArrayBuffer | Uint8Array,
  fileName: string,
  options: ParserOptions = {},
): Promise<ParsedResumeDocument> {
  const startTime = Date.now();
  const zip = await JSZip.loadAsync(data);

  // 1. Extract Headers (where contact details often reside)
  const headerTexts: string[] = [];
  const headerFiles = Object.keys(zip.files).filter((name) =>
    /^word\/header\d+\.xml$/i.test(name),
  );

  for (const hFile of headerFiles) {
    const file = zip.file(hFile);
    if (file) {
      const xml = await file.async("text");
      const pMatches = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
      for (const p of pMatches) {
        const { text } = extractParagraphText(p);
        if (text) headerTexts.push(text);
      }
    }
  }

  // 2. Extract Document Body
  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    throw new Error("Invalid DOCX file: word/document.xml missing.");
  }

  const docXml = await docFile.async("text");

  // Extract text boxes first to know what callouts or sidebars exist
  const textBoxTexts = extractTextBoxes(docXml);

  // Traverse body children (paragraphs and tables)
  // Match top-level <w:p> and <w:tbl>
  const bodyRegex = /<w:p[ >][\s\S]*?<\/w:p>|<w:tbl[ >][\s\S]*?<\/w:tbl>/g;
  const rawLines: string[] = [];

  // If header has contact details and document doesn't start with them, prepend
  if (headerTexts.length > 0) {
    for (const hText of headerTexts) {
      if (isContactLine(hText)) {
        rawLines.push(hText);
      }
    }
  }

  let match: RegExpExecArray | null;
  while ((match = bodyRegex.exec(docXml)) !== null) {
    const block = match[0];
    if (block.startsWith("<w:tbl")) {
      const tableLines = extractTableText(block);
      rawLines.push(...tableLines);
    } else {
      const { text } = extractParagraphText(block);
      if (text) rawLines.push(text);
    }
  }

  // If text boxes contained text that was outside the standard flow, append them
  if (textBoxTexts.length > 0) {
    for (const tbText of textBoxTexts) {
      if (!rawLines.some((l) => l.includes(tbText) || tbText.includes(l))) {
        rawLines.push(tbText);
      }
    }
  }

  const rawText = rawLines.join("\n\n").trim();
  const cleanedText = normalizeResumeText(rawText);

  const { blocks, pages } = convertLinesToCanvasBlocks(
    cleanedText.split("\n").filter(Boolean),
    options.targetWidth ?? 612,
    options.targetHeight ?? 792,
  );

  const validation = validateExtraction(cleanedText, {
    pageCount: pages.length,
    expectedMinCharsPerPage: 120,
  });

  const diagnostics = {
    fileName,
    fileType: "docx" as const,
    pageCount: pages.length,
    characterCount: cleanedText.length,
    wordCount: cleanedText.split(/\s+/).filter(Boolean).length,
    method: "docx-xml-structured" as const,
    ocrTriggered: false,
    columnLayout: "single" as const,
    validationScore: validation.qualityScore,
    validationIssues: validation.issues.map((i) => i.message),
    warnings: [],
    processingTimeMs: Date.now() - startTime,
  };

  return {
    rawText,
    cleanedText,
    canvasBlocks: blocks,
    canvasPages: pages,
    diagnostics,
    validation,
  };
}

