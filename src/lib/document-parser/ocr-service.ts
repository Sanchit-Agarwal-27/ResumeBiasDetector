/**
 * @file ocr-service.ts
 * On-demand OCR fallback service for scanned and image-based resumes.
 * Uses Tesseract.js dynamically imported only when text extraction is insufficient.
 */

export interface OcrProgress {
  status: string;
  progress: number;
}

export interface OcrResult {
  text: string;
  confidence: number;
}

/**
 * Runs OCR on an image source (Canvas, Blob, Buffer, or ImageData)
 */
export async function runOcrOnImage(
  imageSource: unknown,
  onProgress?: (progress: OcrProgress) => void,
): Promise<OcrResult> {
  const tesseract = await import("tesseract.js");

  // Create worker or call recognize
  const result = await tesseract.recognize(
    imageSource as Parameters<typeof tesseract.recognize>[0],
    "eng",
    {
      logger: (m: { status?: string; progress?: number }) => {
        if (onProgress && m.status && typeof m.progress === "number") {
          onProgress({ status: m.status, progress: m.progress });
        }
      },
    },
  );

  return {
    text: result.data.text || "",
    confidence: result.data.confidence ?? 0,
  };
}

/**
 * Checks whether an extraction result is candidate for OCR fallback:
 * - Empty text
 * - Very short text (< 60 chars) on a document claiming multiple pages
 * - High garbled char ratio (> 15%)
 */
export function shouldTriggerOcrFallback(
  extractedCharCount: number,
  pageCount: number,
  garbledCharRatio = 0,
): boolean {
  if (extractedCharCount === 0) return true;
  if (extractedCharCount < 60 && pageCount >= 1) return true;
  if (garbledCharRatio > 0.20 && extractedCharCount < 200) return true;
  return false;
}
