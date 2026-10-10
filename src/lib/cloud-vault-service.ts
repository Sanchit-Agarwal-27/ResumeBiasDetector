import { supabase, isSupabaseConfigured } from "./supabase-client";
import type { CanvasTextBlock, CanvasPage } from "./pdf-cluster-engine";
import type { ResumeBiasReport } from "./resume-contract";

export interface CloudResumeRecord {
  id: string;
  user_id: string;
  title: string;
  file_name: string;
  raw_text: string;
  neutrality_score: number;
  active_version: number;
  target_job?: ResumeBiasReport["target_job"];
  ats_match?: ResumeBiasReport["ats_match"];
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CloudResumeBundle {
  resume: CloudResumeRecord;
  pages: CanvasPage[];
  blocks: CanvasTextBlock[];
  report: ResumeBiasReport;
}

export interface CloudResumeVersionRecord {
  id: string;
  resume_id: string;
  version_number: number;
  version_name: string;
  neutrality_score: number;
  ats_score?: number | null;
  snapshot: {
    blocks: CanvasTextBlock[];
    pages: CanvasPage[];
    report: ResumeBiasReport;
  };
  created_at: string;
}

const STORAGE_GUEST_RESUMES = "biaslens_guest_resumes_catalog_v1";
const STORAGE_GUEST_VERSIONS = "biaslens_guest_versions_catalog_v1";

function getLocalGuestResumes(): CloudResumeRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_GUEST_RESUMES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalGuestResumes(records: CloudResumeRecord[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_GUEST_RESUMES, JSON.stringify(records));
  } catch {
    // Quota safety
  }
}

function getLocalGuestVersions(): Record<string, CloudResumeVersionRecord[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_GUEST_VERSIONS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalGuestVersions(catalog: Record<string, CloudResumeVersionRecord[]>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_GUEST_VERSIONS, JSON.stringify(catalog));
  } catch {
    // Quota safety
  }
}

/**
 * Fetch all cloud or local guest resumes
 */
export async function listUserResumes(): Promise<CloudResumeRecord[]> {
  if (!isSupabaseConfigured) {
    return getLocalGuestResumes().filter((r) => !r.is_archived);
  }

  const { data, error } = await supabase
    .from("resumes")
    .select("*")
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });

  if (error) {
    console.warn(
      "[CloudVault] Failed to fetch resumes from cloud, falling back to local:",
      error.message,
    );
    return getLocalGuestResumes().filter((r) => !r.is_archived);
  }

  return data || [];
}

/**
 * Load a single full resume bundle (document + pages + vector blocks + audit report)
 */
export async function loadResumeBundle(resumeId: string): Promise<CloudResumeBundle | null> {
  if (!isSupabaseConfigured) {
    const localList = getLocalGuestResumes();
    const found = localList.find((r) => r.id === resumeId);
    if (!found) return null;

    // Load latest version snapshot if exists
    const versionsCatalog = getLocalGuestVersions();
    const resumeVersions = versionsCatalog[resumeId] || [];
    const latestVersion = resumeVersions[0];

    if (latestVersion) {
      return {
        resume: found,
        pages: latestVersion.snapshot.pages,
        blocks: latestVersion.snapshot.blocks,
        report: latestVersion.snapshot.report,
      };
    }

    return null;
  }

  // 1. Fetch master resume from Supabase
  const { data: resume, error: resumeErr } = await supabase
    .from("resumes")
    .select("*")
    .eq("id", resumeId)
    .single();

  if (resumeErr || !resume) {
    console.error("[CloudVault] Failed to load resume document:", resumeErr?.message);
    return null;
  }

  // 2. Fetch pages
  const { data: pagesData } = await supabase
    .from("resume_pages")
    .select("*")
    .eq("resume_id", resumeId)
    .order("page_number", { ascending: true });

  const pages: CanvasPage[] = (pagesData || []).map((p) => ({
    id: p.id,
    pageNumber: p.page_number,
    width: Number(p.width),
    height: Number(p.height),
  }));

  // 3. Fetch canvas blocks
  const { data: blocksData } = await supabase
    .from("canvas_blocks")
    .select("*")
    .eq("resume_id", resumeId)
    .order("page_index", { ascending: true });

  const blocks: CanvasTextBlock[] = (blocksData || []).map((b) => ({
    id: b.id,
    pageIndex: b.page_index,
    text: b.text,
    x: Number(b.x),
    y: Number(b.y),
    width: Number(b.width),
    height: Number(b.height),
    fontSize: Number(b.font_size),
    fontFamily: b.font_family,
    bold: b.bold,
    italic: b.italic,
    underline: b.underline,
    color: b.color,
    align: (b.align as CanvasTextBlock["align"]) || "left",
    lineHeight: Number(b.line_height),
    isTitle: b.is_title,
  }));

  // 4. Fetch latest bias audit
  const { data: auditData } = await supabase
    .from("bias_audits")
    .select("*")
    .eq("resume_id", resumeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const report: ResumeBiasReport = {
    document_id: resume.id,
    file_name: resume.file_name,
    raw_text: resume.raw_text,
    neutrality_score: resume.neutrality_score,
    summary: auditData?.summary || {
      total_flags: 0,
      by_category: {
        gender_coded: 0,
        age_indicative: 0,
        prestige_proxy: 0,
        gap_framing: 0,
        disability_coded: 0,
      },
      by_severity: { low: 0, medium: 0, high: 0 },
    },
    spans: auditData?.spans || [],
    suggestions: auditData?.suggestions || {},
    fairness_audit: auditData?.fairness_metrics || undefined,
    target_job: resume.target_job || undefined,
    ats_match: resume.ats_match || undefined,
  };

  return {
    resume,
    pages: pages.length > 0 ? pages : [{ id: "page-1", pageNumber: 1, width: 595, height: 842 }],
    blocks,
    report,
  };
}

/**
 * Upsert active resume bundle into PostgreSQL or LocalStorage
 */
export async function saveResumeBundleToCloud(params: {
  userId: string;
  resumeId?: string;
  title: string;
  fileName: string;
  rawText: string;
  neutralityScore: number;
  pages: CanvasPage[];
  blocks: CanvasTextBlock[];
  report: ResumeBiasReport;
}): Promise<string> {
  const { userId, resumeId, title, fileName, rawText, neutralityScore, pages, blocks, report } =
    params;

  // Local Guest Fallback
  if (!isSupabaseConfigured) {
    const localList = getLocalGuestResumes();
    const existingIdx = resumeId ? localList.findIndex((r) => r.id === resumeId) : -1;
    const finalId = existingIdx >= 0 ? resumeId! : `local-${Date.now()}`;
    const now = new Date().toISOString();

    const record: CloudResumeRecord = {
      id: finalId,
      user_id: userId || "guest-user",
      title: title || "Untitled Resume",
      file_name: fileName || "Resume.pdf",
      raw_text: rawText,
      neutrality_score: neutralityScore,
      active_version: existingIdx >= 0 ? localList[existingIdx].active_version : 1,
      target_job: report.target_job,
      ats_match: report.ats_match,
      is_archived: false,
      created_at: existingIdx >= 0 ? localList[existingIdx].created_at : now,
      updated_at: now,
    };

    if (existingIdx >= 0) {
      localList[existingIdx] = record;
    } else {
      localList.unshift(record);
    }
    saveLocalGuestResumes(localList);

    // Save baseline snapshot if none exists
    const versionsCatalog = getLocalGuestVersions();
    if (!versionsCatalog[finalId] || versionsCatalog[finalId].length === 0) {
      const initialVersion: CloudResumeVersionRecord = {
        id: `ver-local-${Date.now()}`,
        resume_id: finalId,
        version_number: 1,
        version_name: "Initial Baseline v1",
        neutrality_score: neutralityScore,
        ats_score: report.ats_match?.overall_match_score || null,
        snapshot: { blocks, pages, report },
        created_at: now,
      };
      versionsCatalog[finalId] = [initialVersion];
      saveLocalGuestVersions(versionsCatalog);
    }

    return finalId;
  }

  // 1. Upsert Resume Master Record in Supabase
  let finalResumeId = resumeId;

  if (resumeId) {
    const { error: updateErr } = await supabase
      .from("resumes")
      .update({
        title,
        file_name: fileName,
        raw_text: rawText,
        neutrality_score: neutralityScore,
        target_job: report.target_job || null,
        ats_match: report.ats_match || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", resumeId);

    if (updateErr) throw updateErr;
  } else {
    const { data: newResume, error: insertErr } = await supabase
      .from("resumes")
      .insert({
        user_id: userId,
        title,
        file_name: fileName,
        raw_text: rawText,
        neutrality_score: neutralityScore,
        target_job: report.target_job || null,
        ats_match: report.ats_match || null,
      })
      .select("id")
      .single();

    if (insertErr || !newResume) throw insertErr;
    finalResumeId = newResume.id;
  }

  // 2. Sync Resume Pages
  await supabase.from("resume_pages").delete().eq("resume_id", finalResumeId);

  if (pages.length > 0) {
    const pagesPayload = pages.map((p, idx) => ({
      resume_id: finalResumeId,
      page_number: p.pageNumber || idx + 1,
      width: Math.round(p.width),
      height: Math.round(p.height),
    }));

    const { error: pageErr } = await supabase.from("resume_pages").insert(pagesPayload);
    if (pageErr) console.warn("[CloudVault] Failed to sync pages:", pageErr.message);
  }

  // 3. Sync Canvas Blocks
  await supabase.from("canvas_blocks").delete().eq("resume_id", finalResumeId);

  if (blocks.length > 0) {
    const blocksPayload = blocks.map((b) => ({
      id: b.id,
      resume_id: finalResumeId,
      page_index: b.pageIndex,
      text: b.text,
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      font_size: b.fontSize,
      font_family: b.fontFamily,
      bold: !!b.bold,
      italic: !!b.italic,
      underline: !!b.underline,
      color: b.color || "#111827",
      align: b.align || "left",
      line_height: b.lineHeight || 1.3,
      is_title: !!b.isTitle,
    }));

    const { error: blockErr } = await supabase.from("canvas_blocks").insert(blocksPayload);
    if (blockErr) console.warn("[CloudVault] Failed to sync canvas blocks:", blockErr.message);
  }

  // 4. Save Bias Audit Record
  const { error: auditErr } = await supabase.from("bias_audits").insert({
    resume_id: finalResumeId,
    spans: report.spans || [],
    suggestions: report.suggestions || {},
    summary: report.summary || {},
    fairness_metrics: report.fairness_audit || null,
  });
  if (auditErr) console.warn("[CloudVault] Failed to save bias audit:", auditErr.message);

  return finalResumeId!;
}

/**
 * Create an immutable snapshot in resume_versions
 */
export async function createResumeVersionSnapshot(params: {
  resumeId: string;
  versionName: string;
  neutralityScore: number;
  blocks: CanvasTextBlock[];
  pages: CanvasPage[];
  report: ResumeBiasReport;
}): Promise<CloudResumeVersionRecord> {
  const now = new Date().toISOString();

  // Local Guest Fallback
  if (!isSupabaseConfigured) {
    const versionsCatalog = getLocalGuestVersions();
    const existing = versionsCatalog[params.resumeId] || [];
    const nextVer =
      existing.length > 0 ? Math.max(...existing.map((v) => v.version_number)) + 1 : 1;

    const record: CloudResumeVersionRecord = {
      id: `ver-local-${Date.now()}`,
      resume_id: params.resumeId,
      version_number: nextVer,
      version_name: params.versionName || `Version ${nextVer}`,
      neutrality_score: params.neutralityScore,
      ats_score: params.report?.ats_match?.overall_match_score || null,
      snapshot: {
        blocks: params.blocks,
        pages: params.pages,
        report: params.report,
      },
      created_at: now,
    };

    versionsCatalog[params.resumeId] = [record, ...existing];
    saveLocalGuestVersions(versionsCatalog);

    // Update active version in resume record
    const localResumes = getLocalGuestResumes();
    const targetIdx = localResumes.findIndex((r) => r.id === params.resumeId);
    if (targetIdx >= 0) {
      localResumes[targetIdx].active_version = nextVer;
      saveLocalGuestResumes(localResumes);
    }

    return record;
  }

  // Get current max version number from Supabase
  const { data: versions } = await supabase
    .from("resume_versions")
    .select("version_number")
    .eq("resume_id", params.resumeId)
    .order("version_number", { ascending: false })
    .limit(1);

  const nextVer = (versions?.[0]?.version_number || 0) + 1;

  const { data, error } = await supabase
    .from("resume_versions")
    .insert({
      resume_id: params.resumeId,
      version_number: nextVer,
      version_name: params.versionName || `Version ${nextVer}`,
      neutrality_score: params.neutralityScore,
      ats_score: params.report?.ats_match?.overall_match_score || null,
      snapshot: {
        blocks: params.blocks,
        pages: params.pages,
        report: params.report,
      },
    })
    .select()
    .single();

  if (error || !data) throw error;

  // Also update active_version in master resume
  await supabase.from("resumes").update({ active_version: nextVer }).eq("id", params.resumeId);

  return data;
}

/**
 * List all versions for a given resume
 */
export async function listResumeVersions(resumeId: string): Promise<CloudResumeVersionRecord[]> {
  if (!isSupabaseConfigured) {
    const versionsCatalog = getLocalGuestVersions();
    return versionsCatalog[resumeId] || [];
  }

  const { data, error } = await supabase
    .from("resume_versions")
    .select("*")
    .eq("resume_id", resumeId)
    .order("version_number", { ascending: false });

  if (error) {
    console.warn(
      "[CloudVault] Failed to fetch versions from Supabase, checking local:",
      error.message,
    );
    const versionsCatalog = getLocalGuestVersions();
    return versionsCatalog[resumeId] || [];
  }

  return data || [];
}

/**
 * Duplicate a resume into a new branch
 */
export async function duplicateResume(sourceResumeId: string, newTitle?: string): Promise<string> {
  const bundle = await loadResumeBundle(sourceResumeId);
  if (!bundle) throw new Error("Source resume not found.");

  const branchedTitle = newTitle || `${bundle.resume.title} (Copy)`;

  const newResumeId = await saveResumeBundleToCloud({
    userId: bundle.resume.user_id,
    title: branchedTitle,
    fileName: bundle.resume.file_name,
    rawText: bundle.resume.raw_text,
    neutralityScore: bundle.resume.neutrality_score,
    pages: bundle.pages,
    blocks: bundle.blocks,
    report: bundle.report,
  });

  // Create initial version for the branched copy
  await createResumeVersionSnapshot({
    resumeId: newResumeId,
    versionName: "Branched Baseline v1",
    neutralityScore: bundle.resume.neutrality_score,
    pages: bundle.pages,
    blocks: bundle.blocks,
    report: bundle.report,
  });

  return newResumeId;
}

/**
 * Rename a resume document
 */
export async function renameResume(resumeId: string, newTitle: string): Promise<boolean> {
  if (!isSupabaseConfigured) {
    const localList = getLocalGuestResumes();
    const targetIdx = localList.findIndex((r) => r.id === resumeId);
    if (targetIdx >= 0) {
      localList[targetIdx].title = newTitle;
      saveLocalGuestResumes(localList);
      return true;
    }
    return false;
  }

  const { error } = await supabase
    .from("resumes")
    .update({ title: newTitle, updated_at: new Date().toISOString() })
    .eq("id", resumeId);

  return !error;
}

/**
 * Soft delete / archive a resume
 */
export async function archiveResume(resumeId: string): Promise<boolean> {
  if (!isSupabaseConfigured) {
    const localList = getLocalGuestResumes();
    const updated = localList.filter((r) => r.id !== resumeId);
    saveLocalGuestResumes(updated);
    return true;
  }

  const { error } = await supabase.from("resumes").update({ is_archived: true }).eq("id", resumeId);

  return !error;
}
