/**
 * @file feedback-store.ts
 * Manages user feedback records, reward computation, and offline batch policy retraining.
 * Provides validation, deduplication protection, and category satisfaction statistics.
 */

import type { BiasCategory } from "../resume-contract";
import type { LinUCBBanditPolicy } from "./bandit-policy";
import {
  REWARD_SCALE,
  type FeedbackRating,
  type RecommendationActionId,
  type UserFeedbackRecord,
} from "./types";

const FEEDBACK_STORAGE_KEY = "biaslens_rl_feedback_v1";
const DEDUPLICATION_COOLDOWN_MS = 2000;

export class FeedbackStore {
  private records: UserFeedbackRecord[];
  private lastSubmissionMap: Map<string, number>; // key: spanId-actionId -> timestamp

  constructor() {
    this.records = [];
    this.lastSubmissionMap = new Map();
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(FEEDBACK_STORAGE_KEY);
      if (raw) {
        this.records = JSON.parse(raw);
      }
    } catch (err) {
      console.warn("[FeedbackStore] Failed to parse stored feedback records:", err);
      this.records = [];
    }
  }

  private saveToStorage() {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(this.records));
    } catch (err) {
      console.warn("[FeedbackStore] Storage quota or write error:", err);
    }
  }

  /**
   * Records user feedback with validation and deduplication protection.
   */
  public recordFeedback(params: {
    spanId: string;
    category: BiasCategory;
    actionId: RecommendationActionId;
    rating: FeedbackRating;
    suggestedText: string;
    userEditedText?: string;
    comment?: string;
    policyVersion: string;
    stateVector: number[];
  }): { success: boolean; record?: UserFeedbackRecord; message?: string } {
    const dedupKey = `${params.spanId}-${params.actionId}-${params.rating}`;
    const now = Date.now();
    const lastTime = this.lastSubmissionMap.get(dedupKey) || 0;

    // Reject duplicate clicks within cooldown period
    if (now - lastTime < DEDUPLICATION_COOLDOWN_MS) {
      return {
        success: false,
        message: "Duplicate feedback ignored (cooldown active).",
      };
    }

    const numericReward = REWARD_SCALE[params.rating] ?? 0.0;
    const record: UserFeedbackRecord = {
      feedbackId: `fb_${now}_${Math.random().toString(36).substring(2, 7)}`,
      spanId: params.spanId,
      category: params.category,
      actionId: params.actionId,
      rating: params.rating,
      numericReward,
      suggestedText: params.suggestedText,
      userEditedText: params.userEditedText,
      comment: params.comment,
      policyVersion: params.policyVersion,
      stateVector: params.stateVector,
      timestamp: new Date().toISOString(),
    };

    this.records.push(record);
    this.lastSubmissionMap.set(dedupKey, now);
    this.saveToStorage();

    return {
      success: true,
      record,
    };
  }

  /**
   * Retrieves historical satisfaction statistics for a given bias category.
   * Positive feedback = 'helpful' or 'accepted'.
   */
  public getCategoryStats(category: BiasCategory): {
    total: number;
    positiveCount: number;
    satisfactionRate: number;
  } {
    const catRecords = this.records.filter((r) => r.category === category);
    if (catRecords.length === 0) {
      return { total: 0, positiveCount: 0, satisfactionRate: 0.5 }; // Default prior
    }

    const positiveCount = catRecords.filter(
      (r) => r.rating === "helpful" || r.rating === "accepted",
    ).length;

    const satisfactionRate = Number((positiveCount / catRecords.length).toFixed(3));

    return {
      total: catRecords.length,
      positiveCount,
      satisfactionRate,
    };
  }

  /**
   * Batch update: trains a LinUCB bandit policy using stored validated feedback records.
   * Separates feedback collection from policy update cycles.
   */
  public trainPolicyFromFeedback(policy: LinUCBBanditPolicy): {
    recordsProcessed: number;
    totalUpdates: number;
    priorVersion: string;
  } {
    const priorVersion = policy.getVersion();
    let count = 0;

    for (const record of this.records) {
      if (record.stateVector && record.stateVector.length > 0) {
        const updated = policy.updateArm(
          record.actionId,
          record.stateVector,
          record.numericReward,
        );
        if (updated) count++;
      }
    }

    return {
      recordsProcessed: count,
      totalUpdates: policy.getTotalUpdates(),
      priorVersion,
    };
  }

  public getAllRecords(): UserFeedbackRecord[] {
    return [...this.records];
  }

  public clearFeedback(): void {
    this.records = [];
    this.lastSubmissionMap.clear();
    if (typeof window !== "undefined") {
      localStorage.removeItem(FEEDBACK_STORAGE_KEY);
    }
  }

  public getRecordCount(): number {
    return this.records.length;
  }
}

// Global feedback store instance
export const globalFeedbackStore = new FeedbackStore();
