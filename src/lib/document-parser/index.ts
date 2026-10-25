/**
 * @file index.ts
 * Main entry point for the BiasLens Robust Document Extraction Pipeline.
 * Handles PDF, DOCX, and plain text resumes with layout-awareness,
 * multi-column reconstruction, artifact filtering, validation, and OCR fallback.
 */

import type {
  ParsedResumeDocument,
  ParserOptions,
  DocumentType,
  CanvasTextBlock,
  CanvasPage,
} from "./types";
import { parsePdfResume } from "./pdf-parser";
import { parseDocxResume, convertLinesToCanvasBlocks } from "./docx-parser";
import { normalizeResumeText } from "./normalizer";
import { validateExtraction } from "./validator";

export * from "./types";
export * from "./normalizer";
export * from "./validator";
export * from "./layout-analyzer";
export * from "./docx-parser";
export * from "./pdf-parser";
export * from "./ocr-service";

/**
 * Detects document type from file name
 */
export function detectDocumentType(fileName: string): DocumentType {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx") || lower.endsWith(".doc")) return "docx";
  if (lower.endsWith(".txt") || lower.endsWith(".text")) return "txt";
  return "unknown";
}

/**
 * Primary universal document extraction function
 */
export async function extractResumeDocument(
  input: File | Blob | ArrayBuffer | Uint8Array,
  fileName: string,
  options: ParserOptions = {},
): Promise<ParsedResumeDocument> {
  const fileType = detectDocumentType(fileName);

  // Convert input to ArrayBuffer if needed
  let data: ArrayBuffer | Uint8Array;
  if (input instanceof ArrayBuffer || input instanceof Uint8Array) {
    data = input;
  } else if (typeof (input as Blob).arrayBuffer === "function") {
    data = await (input as Blob).arrayBuffer();
  } else {
    throw new Error("Unsupported input format for document extraction.");
  }

  try {
    if (fileType === "docx") {
      return await parseDocxResume(data, fileName, options);
    }

    if (fileType === "pdf") {
      return await parsePdfResume(data, fileName, options);
    }

    // Fallback: Plain text extraction
    let text = "";
    if (typeof TextDecoder !== "undefined") {
      const uint8 = data instanceof Uint8Array ? data : new Uint8Array(data);
      text = new TextDecoder("utf-8").decode(uint8);
    } else {
      text = (data as unknown as Buffer).toString("utf-8");
    }

    const cleanedText = normalizeResumeText(text);
    const { blocks, pages } = convertLinesToCanvasBlocks(
      cleanedText.split("\n").filter(Boolean),
      options.targetWidth ?? 612,
      options.targetHeight ?? 792,
    );

    const validation = validateExtraction(cleanedText, { pageCount: pages.length });

    return {
      rawText: text,
      cleanedText,
      canvasBlocks: blocks,
      canvasPages: pages,
      diagnostics: {
        fileName,
        fileType: "txt",
        pageCount: pages.length,
        characterCount: cleanedText.length,
        wordCount: cleanedText.split(/\s+/).filter(Boolean).length,
        method: "raw-text",
        ocrTriggered: false,
        columnLayout: "single",
        validationScore: validation.qualityScore,
        validationIssues: validation.issues.map((i) => i.message),
        warnings: [],
        processingTimeMs: 0,
      },
      validation,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Failed to parse document";
    throw new Error(`Resume parsing failed for ${fileName}: ${errorMsg}`);
  }
}

