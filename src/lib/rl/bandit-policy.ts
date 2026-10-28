/**
 * @file bandit-policy.ts
 * Disjoint Linear Upper Confidence Bound (LinUCB) contextual bandit algorithm.
 * Selects and prioritizes bias mitigation recommendations under contextual uncertainty,
 * balancing exploitation of known effective recommendations with principled exploration.
 */

import {
  RL_ACTION_IDS,
  STATE_DIMENSION,
  type RecommendationActionId,
  type SerializedBanditPolicy,
  type StateVector,
} from "./types";

const POLICY_VERSION = "v1.0.0";
const DEFAULT_ALPHA = 0.25; // Exploration trade-off coefficient

// 8x8 Identity matrix for L2 regularization
function createIdentityMatrix(dim: number): number[][] {
  const m: number[][] = [];
  for (let i = 0; i < dim; i++) {
    m[i] = new Array(dim).fill(0);
    m[i][i] = 1.0;
  }
  return m;
}

// Invert small positive-definite matrix via Gauss-Jordan elimination with partial pivoting
export function invertMatrix(matrix: number[][]): number[][] {
  const n = matrix.length;
  // Deep clone and augment with identity
  const aug: number[][] = [];
  for (let i = 0; i < n; i++) {
    aug[i] = new Array(2 * n).fill(0);
    for (let j = 0; j < n; j++) aug[i][j] = matrix[i][j];
    aug[i][n + i] = 1.0;
  }

  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) {
        maxRow = k;
      }
    }

    if (Math.abs(aug[maxRow][i]) < 1e-12) {
      // Degenerate matrix: fallback to regularized pseudo-identity
      return createIdentityMatrix(n);
    }

    // Swap rows
    const temp = aug[i];
    aug[i] = aug[maxRow];
    aug[maxRow] = temp;

    // Scale pivot row
    const pivot = aug[i][i];
    for (let j = 0; j < 2 * n; j++) {
      aug[i][j] /= pivot;
    }

    // Eliminate other rows
    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = aug[k][i];
        for (let j = 0; j < 2 * n; j++) {
          aug[k][j] -= factor * aug[i][j];
        }
      }
    }
  }

  // Extract inverted matrix from augmented right half
  const inv: number[][] = [];
  for (let i = 0; i < n; i++) {
    inv[i] = aug[i].slice(n, 2 * n);
  }
  return inv;
}

function matrixVectorMultiply(mat: number[][], vec: number[]): number[] {
  const n = mat.length;
  const result: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      sum += mat[i][j] * vec[j];
    }
    result[i] = sum;
  }
  return result;
}

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

interface ArmData {
  A: number[][]; // Covariance matrix (d x d)
  b: number[]; // Bias vector (d)
  theta: number[]; // Learned regression weights (d)
  pullCount: number;
}

export class LinUCBBanditPolicy {
  private version: string;
  private alpha: number;
  private dimension: number;
  private arms: Map<RecommendationActionId, ArmData>;
  private totalUpdates: number;
  private historySnapshot: string | null = null;

  constructor(alpha: number = DEFAULT_ALPHA, dimension: number = STATE_DIMENSION) {
    this.version = POLICY_VERSION;
    this.alpha = alpha;
    this.dimension = dimension;
    this.arms = new Map();
    this.totalUpdates = 0;
    this.initializeDefaultArms();
  }

  /**
   * Initializes action arms with research-grounded default prior weights.
   * This provides a safe, principled initial policy before any user feedback is collected.
   */
  private initializeDefaultArms() {
    const allActions: RecommendationActionId[] = [
      RL_ACTION_IDS.NEUTRAL_REPHRASE,
      RL_ACTION_IDS.REDACT_PERSONAL_INFO,
      RL_ACTION_IDS.CONTEXTUAL_FRAMING,
      RL_ACTION_IDS.COMPETENCY_SUBSTITUTION,
      RL_ACTION_IDS.HUMAN_REVIEW_FLAG,
    ];

    for (const action of allActions) {
      const A = createIdentityMatrix(this.dimension);
      const b = new Array(this.dimension).fill(0);

      // Prior calibration based on established bias-mitigation research
      switch (action) {
        case RL_ACTION_IDS.NEUTRAL_REPHRASE:
          // Strong affinity for gender-coded descriptors and moderate severity
          b[0] = 0.4; // Category affinity
          b[1] = 0.5; // Severity
          b[2] = 0.6; // High confidence
          b[7] = 0.5; // Baseline prior
          break;
        case RL_ACTION_IDS.REDACT_PERSONAL_INFO:
          // Strong affinity for age-indicative graduation years & pedigree filters
          b[0] = 0.6;
          b[2] = 0.7;
          b[7] = 0.6;
          break;
        case RL_ACTION_IDS.CONTEXTUAL_FRAMING:
          // Strong affinity for career breaks / gaps
          b[0] = 0.7;
          b[3] = 0.6; // Gap context
          b[7] = 0.5;
          break;
        case RL_ACTION_IDS.COMPETENCY_SUBSTITUTION:
          // Strong affinity for tech bro culture jargon ('rockstar', 'ninja')
          b[1] = 0.6;
          b[3] = 0.7;
          b[7] = 0.5;
          break;
        case RL_ACTION_IDS.HUMAN_REVIEW_FLAG:
          // Moderate baseline for borderline or ambiguous cases
          b[1] = 0.3;
          b[2] = -0.2; // Favored when detector confidence is lower
          b[7] = 0.2;
          break;
      }

      const invA = invertMatrix(A);
      const theta = matrixVectorMultiply(invA, b);

      this.arms.set(action, {
        A,
        b,
        theta,
        pullCount: 0,
      });
    }
  }

  /**
   * Scores an arm for a given state context vector x.
   * Returns: { expectedReward, explorationBonus, ucb }
   */
  public evaluateArm(
    actionId: RecommendationActionId,
    state: StateVector,
  ): { expectedReward: number; explorationBonus: number; ucb: number } {
    const arm = this.arms.get(actionId);
    if (!arm) {
      return { expectedReward: 0, explorationBonus: 0, ucb: 0 };
    }

    const x = state.features;
    // Expected reward = theta_a^T * x
    const expectedReward = dotProduct(arm.theta, x);

    // Exploration bonus = alpha * sqrt(x^T * A_a^-1 * x)
    const invA = invertMatrix(arm.A);
    const invA_x = matrixVectorMultiply(invA, x);
    const variance = Math.max(0, dotProduct(x, invA_x));
    const explorationBonus = this.alpha * Math.sqrt(variance);

    const ucb = expectedReward + explorationBonus;

    return {
      expectedReward: Number(expectedReward.toFixed(4)),
      explorationBonus: Number(explorationBonus.toFixed(4)),
      ucb: Number(ucb.toFixed(4)),
    };
  }

  /**
   * Selects the optimal action from an eligible candidate subset using LinUCB.
   */
  public selectAction(
    state: StateVector,
    eligibleActions: RecommendationActionId[],
  ): {
    selectedAction: RecommendationActionId;
    expectedReward: number;
    explorationBonus: number;
    ucb: number;
  } {
    if (!eligibleActions || eligibleActions.length === 0) {
      eligibleActions = [RL_ACTION_IDS.NEUTRAL_REPHRASE];
    }

    let bestAction = eligibleActions[0];
    let bestUCB = -Infinity;
    let bestExpected = 0;
    let bestBonus = 0;

    for (const actionId of eligibleActions) {
      const evaluation = this.evaluateArm(actionId, state);
      if (evaluation.ucb > bestUCB) {
        bestUCB = evaluation.ucb;
        bestAction = actionId;
        bestExpected = evaluation.expectedReward;
        bestBonus = evaluation.explorationBonus;
      }
    }

    return {
      selectedAction: bestAction,
      expectedReward: bestExpected,
      explorationBonus: bestBonus,
      ucb: bestUCB,
    };
  }

  /**
   * Online/Batch Policy Update:
   * A_a <- A_a + x * x^T
   * b_a <- b_a + r * x
   * theta_a <- A_a^-1 * b_a
   */
  public updateArm(
    actionId: RecommendationActionId,
    stateFeatures: number[],
    reward: number,
  ): boolean {
    const arm = this.arms.get(actionId);
    if (!arm || stateFeatures.length !== this.dimension) {
      return false;
    }

    // Save snapshot before first update for safe rollback
    if (!this.historySnapshot) {
      this.historySnapshot = JSON.stringify(this.serialize());
    }

    const x = stateFeatures;
    const n = this.dimension;

    // 1. Update covariance matrix A_a += x * x^T
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        arm.A[i][j] += x[i] * x[j];
      }
    }

    // 2. Update bias vector b_a += r * x
    for (let i = 0; i < n; i++) {
      arm.b[i] += reward * x[i];
    }

    // 3. Recompute ridge regression weights theta_a = A_a^-1 * b_a
    const invA = invertMatrix(arm.A);
    arm.theta = matrixVectorMultiply(invA, arm.b);
    arm.pullCount += 1;

    this.totalUpdates += 1;
    return true;
  }

  /**
   * Serializes policy state for persistence, versioning, and inspection.
   */
  public serialize(): SerializedBanditPolicy {
    const actionsObj: SerializedBanditPolicy["actions"] = {} as SerializedBanditPolicy["actions"];

    for (const [actionId, arm] of this.arms.entries()) {
      actionsObj[actionId] = {
        A: arm.A.flat(),
        b: [...arm.b],
        theta: [...arm.theta],
        pullCount: arm.pullCount,
      };
    }

    return {
      version: this.version,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dimension: this.dimension,
      alpha: this.alpha,
      totalUpdatesCount: this.totalUpdates,
      actions: actionsObj,
    };
  }

  /**
   * Restores policy state from serialized payload.
   */
  public deserialize(serialized: SerializedBanditPolicy): boolean {
    if (serialized.dimension !== this.dimension) {
      return false;
    }

    this.version = serialized.version;
    this.alpha = serialized.alpha ?? this.alpha;
    this.totalUpdates = serialized.totalUpdatesCount || 0;

    for (const [actionKey, data] of Object.entries(serialized.actions)) {
      const actionId = actionKey as RecommendationActionId;
      const dim = this.dimension;
      const A: number[][] = [];
      for (let i = 0; i < dim; i++) {
        A.push(data.A.slice(i * dim, (i + 1) * dim));
      }

      this.arms.set(actionId, {
        A,
        b: [...data.b],
        theta: [...data.theta],
        pullCount: data.pullCount || 0,
      });
    }

    return true;
  }

  /**
   * Resets policy to clean default prior.
   */
  public resetToDefault(): void {
    this.arms.clear();
    this.totalUpdates = 0;
    this.historySnapshot = null;
    this.initializeDefaultArms();
  }

  /**
   * Rolls back policy to the state before recent updates.
   */
  public rollback(): boolean {
    if (!this.historySnapshot) return false;
    try {
      const parsed = JSON.parse(this.historySnapshot) as SerializedBanditPolicy;
      return this.deserialize(parsed);
    } catch {
      return false;
    }
  }

  public getVersion(): string {
    return this.version;
  }

  public getTotalUpdates(): number {
    return this.totalUpdates;
  }

  public getArmData(actionId: RecommendationActionId): ArmData | undefined {
    return this.arms.get(actionId);
  }
}

// Global singleton instance for application runtime
export const globalBanditPolicy = new LinUCBBanditPolicy();
