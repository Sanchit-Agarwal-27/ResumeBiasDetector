import { supabase, isSupabaseConfigured } from "./supabase-client";

export interface CustomFontRecord {
  id: string;
  name: string;
  family: string;
  format: "woff2" | "woff" | "ttf" | "otf";
  dataUrl: string; // Base64 data URL
  fileSize?: number;
  createdAt: string;
}

const STORAGE_CUSTOM_FONTS = "biaslens_custom_fonts_v1";

/**
 * Get all saved custom fonts from LocalStorage
 */
export function getLocalCustomFonts(): CustomFontRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_FONTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Persist custom fonts to LocalStorage
 */
export function saveLocalCustomFonts(fonts: CustomFontRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_CUSTOM_FONTS, JSON.stringify(fonts));
  } catch (err) {
    console.warn("[CustomFonts] Failed to save font to localStorage (quota?):", err);
  }
}

/**
 * Injects a CustomFontRecord into document.fonts using the browser FontFace API
 */
export async function registerFontFace(font: CustomFontRecord): Promise<boolean> {
  if (typeof window === "undefined" || !("FontFace" in window)) return false;

  try {
    // Check if already registered
    const fontNameClean = font.name.trim();
    for (const f of document.fonts) {
      if (f.family === fontNameClean || f.family === `"${fontNameClean}"`) {
        return true;
      }
    }

    // Convert Base64 dataUrl back to binary arrayBuffer or use URL string
    const fontFace = new FontFace(fontNameClean, `url(${font.dataUrl})`, {
      style: "normal",
      weight: "normal",
    });

    const loadedFace = await fontFace.load();
    document.fonts.add(loadedFace);
    return true;
  } catch (err) {
    console.error(`[CustomFonts] Failed to register font ${font.name}:`, err);
    return false;
  }
}

/**
 * Initialize and load all saved custom fonts on app boot
 */
export async function initializeCustomFonts(): Promise<CustomFontRecord[]> {
  const localFonts = getLocalCustomFonts();
  const mergedFonts: CustomFontRecord[] = [...localFonts];

  // If user is authenticated with Supabase, sync cloud fonts
  if (isSupabaseConfigured && typeof window !== "undefined") {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: cloudFonts, error } = await supabase
          .from("user_fonts")
          .select("id, name, family, format, data_url, file_size, created_at")
          .eq("user_id", session.user.id);

        if (!error && Array.isArray(cloudFonts)) {
          const cloudRecords: CustomFontRecord[] = cloudFonts.map((row) => ({
            id: row.id,
            name: row.name,
            family: row.family,
            format: row.format as CustomFontRecord["format"],
            dataUrl: row.data_url,
            fileSize: row.file_size || undefined,
            createdAt: row.created_at,
          }));

          // Merge cloud records without duplicating existing ids or names
          const existingIds = new Set(mergedFonts.map((f) => f.id));
          const existingNames = new Set(mergedFonts.map((f) => f.name.toLowerCase()));

          for (const cf of cloudRecords) {
            if (!existingIds.has(cf.id) && !existingNames.has(cf.name.toLowerCase())) {
              mergedFonts.push(cf);
            }
          }
          saveLocalCustomFonts(mergedFonts);
        }
      }
    } catch (err) {
      console.warn("[CustomFonts] Cloud fonts sync skipped:", err);
    }
  }

  for (const font of mergedFonts) {
    await registerFontFace(font);
  }

  return mergedFonts;
}

/**
 * Read and validate a user-uploaded font File (.woff2, .woff, .ttf, .otf)
 */
export async function uploadCustomFontFile(
  file: File,
  customName?: string,
): Promise<CustomFontRecord> {
  const lowerName = file.name.toLowerCase();
  let format: CustomFontRecord["format"] = "woff2";

  if (lowerName.endsWith(".woff2")) format = "woff2";
  else if (lowerName.endsWith(".woff")) format = "woff";
  else if (lowerName.endsWith(".ttf")) format = "ttf";
  else if (lowerName.endsWith(".otf")) format = "otf";
  else {
    throw new Error("Unsupported font format. Please upload .woff2, .woff, .ttf, or .otf.");
  }

  // Max 5MB safety limit
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Font file exceeds the 5MB size limit.");
  }

  // Clean font display name
  const rawBaseName = file.name.replace(/\.[^/.]+$/, "");
  const fontName = (customName || rawBaseName)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

  // Convert to Base64 Data URL
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });

  const record: CustomFontRecord = {
    id: `font_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: fontName,
    family: `"${fontName}", sans-serif`,
    format,
    dataUrl,
    fileSize: file.size,
    createdAt: new Date().toISOString(),
  };

  // Register in browser document.fonts immediately
  await registerFontFace(record);

  // Save to LocalStorage
  const current = getLocalCustomFonts();
  // Filter out duplicate names if any
  const updated = [
    ...current.filter((f) => f.name.toLowerCase() !== fontName.toLowerCase()),
    record,
  ];
  saveLocalCustomFonts(updated);

  // Persist to Supabase if authenticated
  if (isSupabaseConfigured && typeof window !== "undefined") {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from("user_fonts").insert({
          id: record.id,
          user_id: session.user.id,
          name: record.name,
          family: record.family,
          format: record.format,
          data_url: record.dataUrl,
          file_size: record.fileSize || 0,
        });
      }
    } catch (err) {
      console.warn("[CustomFonts] Could not persist font to Supabase:", err);
    }
  }

  return record;
}

/**
 * Delete a custom font by ID
 */
export async function deleteCustomFont(fontId: string): Promise<void> {
  const current = getLocalCustomFonts();
  const target = current.find((f) => f.id === fontId);
  if (!target) return;

  const updated = current.filter((f) => f.id !== fontId);
  saveLocalCustomFonts(updated);

  // Delete from Supabase if authenticated
  if (isSupabaseConfigured && typeof window !== "undefined") {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from("user_fonts").delete().eq("id", fontId).eq("user_id", session.user.id);
      }
    } catch (err) {
      console.warn("[CustomFonts] Could not delete font from Supabase:", err);
    }
  }
}
