"""
rl_bandit_engine.py
Disjoint Linear Upper Confidence Bound (LinUCB) contextual bandit service in Python.
Prioritizes and ranks bias mitigation recommendations based on contextual features and user feedback.
Features full mathematical explainability, online learning, persistent state, and audit logging.
"""

import json
import math
import os
import time
from typing import Any, Dict, List, Optional, Tuple

STATE_DIMENSION = 8
DEFAULT_ALPHA = 0.25
POLICY_VERSION = "v1.0.0-python"

RL_ACTION_IDS = [
    "neutral_rephrase",
    "redact_personal_info",
    "contextual_framing",
    "competency_substitution",
    "human_review_flag",
]

ACTION_METADATA = {
    "neutral_rephrase": {
        "label": "Neutral Rephrase",
        "description": "Replaces gender-coded, aggressive, or culturally skewed adjectives with outcome-oriented wording.",
        "strategy": "Minimizes implicit gendered or exclusionary linguistic associations while preserving accomplishment.",
    },
    "redact_personal_info": {
        "label": "Omit / Redact Detail",
        "description": "Recommends omitting unnecessary demographic or pedigree markers (e.g., graduation year > 10 yrs).",
        "strategy": "Prevents algorithmic and human age/pedigree bias by removing non-predictive personal markers.",
    },
    "contextual_framing": {
        "label": "Constructive Context Framing",
        "description": "Frames career breaks or non-linear trajectories with professional upskilling or sabbatical terms.",
        "strategy": "Presents continuous learning, caregiving, or intentional career pauses affirmatively.",
    },
    "competency_substitution": {
        "label": "Competency Substitution",
        "description": "Replaces informal tech-culture jargon ('rockstar', 'ninja') with verifiable domain skills.",
        "strategy": "Aligns terminology directly with measurable technical competencies and standard job rubrics.",
    },
    "human_review_flag": {
        "label": "Human Review Flag",
        "description": "Requests manual human reviewer inspection when phrasing is borderline or polysemous.",
        "strategy": "Protects candidates from automated false alarms by escalating ambiguous signals to humans.",
    },
}

REWARD_SCALE = {
    "helpful": 1.0,
    "accepted": 1.0,
    "partially_helpful": 0.5,
    "dismissed": -0.2,
    "not_helpful": -0.5,
    "incorrect": -1.0,
}

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "data")
POLICY_FILE_PATH = os.path.join(DATA_DIR, "rl_policy_weights.json")
FEEDBACK_LOG_PATH = os.path.join(DATA_DIR, "rl_feedback_history.jsonl")


def create_identity_matrix(dim: int) -> List[List[float]]:
    return [[1.0 if i == j else 0.0 for j in range(dim)] for i in range(dim)]


def invert_matrix(matrix: List[List[float]]) -> List[List[float]]:
    """Invert positive-definite matrix via Gauss-Jordan elimination with partial pivoting."""
    n = len(matrix)
    aug = []
    for i in range(n):
        row = [float(matrix[i][j]) for j in range(n)] + [1.0 if i == j else 0.0 for j in range(n)]
        aug.append(row)

    for i in range(n):
        max_row = i
        for k in range(i + 1, n):
            if abs(aug[k][i]) > abs(aug[max_row][i]):
                max_row = k

        if abs(aug[max_row][i]) < 1e-12:
            return create_identity_matrix(n)

        # Swap rows
        aug[i], aug[max_row] = aug[max_row], aug[i]

        pivot = aug[i][i]
        for j in range(2 * n):
            aug[i][j] /= pivot

        for k in range(n):
            if k != i:
                factor = aug[k][i]
                for j in range(2 * n):
                    aug[k][j] -= factor * aug[i][j]

    inv = []
    for i in range(n):
        inv.append(aug[i][n : 2 * n])
    return inv


def matrix_vector_multiply(mat: List[List[float]], vec: List[float]) -> List[float]:
    n = len(mat)
    result = [0.0] * n
    for i in range(n):
        total = 0.0
        for j in range(n):
            total += mat[i][j] * vec[j]
        result[i] = total
    return result


def dot_product(a: List[float], b: List[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


class LinUCBArm:
    def __init__(self, action_id: str, dimension: int = STATE_DIMENSION):
        self.action_id = action_id
        self.dimension = dimension
        self.A = create_identity_matrix(dimension)
        self.b = [0.0] * dimension
        self.pull_count = 0
        self.initialize_priors()
        self.theta = self.compute_theta()

    def initialize_priors(self):
        """Set research-calibrated baseline priors for cold start."""
        if self.action_id == "neutral_rephrase":
            self.b[0] = 0.4  # Category affinity
            self.b[1] = 0.5  # Severity
            self.b[2] = 0.6  # High confidence
            self.b[7] = 0.5  # Intercept
        elif self.action_id == "redact_personal_info":
            self.b[0] = 0.6  # Age affinity
            self.b[2] = 0.7
            self.b[7] = 0.6
        elif self.action_id == "contextual_framing":
            self.b[0] = 0.7
            self.b[3] = 0.6  # Gap context
            self.b[7] = 0.5
        elif self.action_id == "competency_substitution":
            self.b[1] = 0.6
            self.b[3] = 0.7  # Tech buzzwords
            self.b[7] = 0.5
        elif self.action_id == "human_review_flag":
            self.b[1] = 0.3
            self.b[2] = -0.2  # Favored when confidence is low/ambiguous
            self.b[7] = 0.2

    def compute_theta(self) -> List[float]:
        inv_a = invert_matrix(self.A)
        return matrix_vector_multiply(inv_a, self.b)


class LinUCBBanditEngine:
    def __init__(self, alpha: float = DEFAULT_ALPHA, dimension: int = STATE_DIMENSION):
        self.alpha = alpha
        self.dimension = dimension
        self.version = POLICY_VERSION
        self.total_updates = 0
        self.arms: Dict[str, LinUCBArm] = {}
        for action_id in RL_ACTION_IDS:
            self.arms[action_id] = LinUCBArm(action_id, dimension)

        self.load_policy()

    def evaluate_arm(
        self, action_id: str, state_features: List[float]
    ) -> Dict[str, float]:
        arm = self.arms.get(action_id)
        if not arm:
            return {"expected_reward": 0.0, "exploration_bonus": 0.0, "ucb": 0.0}

        x = state_features
        # Expected reward: theta_a^T * x
        expected_reward = dot_product(arm.theta, x)

        # Exploration bonus: alpha * sqrt(x^T * A_a^-1 * x)
        inv_a = invert_matrix(arm.A)
        inv_a_x = matrix_vector_multiply(inv_a, x)
        variance = max(0.0, dot_product(x, inv_a_x))
        exploration_bonus = self.alpha * math.sqrt(variance)

        ucb = expected_reward + exploration_bonus

        return {
            "expected_reward": round(expected_reward, 4),
            "exploration_bonus": round(exploration_bonus, 4),
            "ucb": round(ucb, 4),
        }

    def select_action(
        self, state_features: List[float], eligible_actions: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        if not eligible_actions:
            eligible_actions = ["neutral_rephrase"]

        best_action = eligible_actions[0]
        best_ucb = -float("inf")
        best_expected = 0.0
        best_bonus = 0.0
        scores: Dict[str, Dict[str, float]] = {}

        for action_id in eligible_actions:
            eval_res = self.evaluate_arm(action_id, state_features)
            scores[action_id] = eval_res
            if eval_res["ucb"] > best_ucb:
                best_ucb = eval_res["ucb"]
                best_action = action_id
                best_expected = eval_res["expected_reward"]
                best_bonus = eval_res["exploration_bonus"]

        return {
            "selected_action": best_action,
            "expected_reward": best_expected,
            "exploration_bonus": best_bonus,
            "ucb": best_ucb,
            "all_scores": scores,
        }

    def update_arm(
        self, action_id: str, state_features: List[float], reward: float
    ) -> bool:
        arm = self.arms.get(action_id)
        if not arm or len(state_features) != self.dimension:
            return False

        x = state_features
        n = self.dimension

        # 1. Update covariance matrix A_a += x * x^T
        for i in range(n):
            for j in range(n):
                arm.A[i][j] += x[i] * x[j]

        # 2. Update bias vector b_a += r * x
        for i in range(n):
            arm.b[i] += reward * x[i]

        # 3. Recompute ridge regression weights theta_a = A_a^-1 * b_a
        arm.theta = arm.compute_theta()
        arm.pull_count += 1
        self.total_updates += 1

        self.save_policy()
        return True

    def save_policy(self) -> bool:
        try:
            os.makedirs(DATA_DIR, exist_ok=True)
            actions_dict = {}
            for action_id, arm in self.arms.items():
                flat_a = [val for row in arm.A for val in row]
                actions_dict[action_id] = {
                    "A": flat_a,
                    "b": arm.b,
                    "theta": arm.theta,
                    "pull_count": arm.pull_count,
                }

            payload = {
                "version": self.version,
                "dimension": self.dimension,
                "alpha": self.alpha,
                "total_updates": self.total_updates,
                "saved_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "actions": actions_dict,
            }

            with open(POLICY_FILE_PATH, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
            return True
        except Exception:
            return False

    def load_policy(self) -> bool:
        if not os.path.exists(POLICY_FILE_PATH):
            return False

        try:
            with open(POLICY_FILE_PATH, "r", encoding="utf-8") as f:
                payload = json.load(f)

            if payload.get("dimension") != self.dimension:
                return False

            self.alpha = payload.get("alpha", self.alpha)
            self.total_updates = payload.get("total_updates", 0)
            actions_data = payload.get("actions", {})

            for action_id, data in actions_data.items():
                if action_id in self.arms:
                    arm = self.arms[action_id]
                    dim = self.dimension
                    flat_a = data.get("A", [])
                    if len(flat_a) == dim * dim:
                        arm.A = [flat_a[i * dim : (i + 1) * dim] for i in range(dim)]
                    arm.b = data.get("b", arm.b)
                    arm.theta = data.get("theta", arm.compute_theta())
                    arm.pull_count = data.get("pull_count", 0)
            return True
        except Exception:
            return False

    def reset_policy(self):
        """Reset policy to cold-start initial priors."""
        self.total_updates = 0
        for action_id in RL_ACTION_IDS:
            self.arms[action_id] = LinUCBArm(action_id, self.dimension)
        if os.path.exists(POLICY_FILE_PATH):
            try:
                os.remove(POLICY_FILE_PATH)
            except OSError:
                pass
        self.save_policy()

    def log_feedback_record(self, record: Dict[str, Any]):
        try:
            os.makedirs(DATA_DIR, exist_ok=True)
            with open(FEEDBACK_LOG_PATH, "a", encoding="utf-8") as f:
                f.write(json.dumps(record) + "\n")
        except Exception:
            pass

    def get_telemetry(self) -> Dict[str, Any]:
        arm_stats = {}
        for action_id, arm in self.arms.items():
            arm_stats[action_id] = {
                "pull_count": arm.pull_count,
                "theta_norm": round(math.sqrt(sum(x * x for x in arm.theta)), 4),
                "label": ACTION_METADATA.get(action_id, {}).get("label", action_id),
            }

        return {
            "version": self.version,
            "dimension": self.dimension,
            "alpha": self.alpha,
            "total_updates": self.total_updates,
            "arms": arm_stats,
        }


def encode_state_vector(
    category: str,
    severity: str = "medium",
    confidence: float = 0.9,
    context_type: str = "general",
    sentence: str = "",
    section: str = "experience",
    historical_satisfaction: float = 0.85,
) -> List[float]:
    """Encodes context into 8-dimensional non-sensitive feature vector."""
    category_map = {
        "gender_coded": 0.2,
        "age_indicative": 0.4,
        "gap_framing": 0.6,
        "personality_behavioral": 0.5,
        "prestige_proxy": 0.7,
        "disability_coded": 0.8,
    }
    cat_enc = category_map.get(category, 0.3)

    sev_map = {"low": 0.25, "medium": 0.58, "high": 1.0}
    sev_enc = sev_map.get(severity.lower(), 0.58)

    conf_enc = max(0.0, min(1.0, float(confidence)))

    context_map = {
        "leadership": 0.85,
        "technical": 0.30,
        "pedigree": 0.50,
        "gap": 0.70,
        "conduct": 0.65,
    }
    ctx_enc = context_map.get(context_type.lower(), 0.45)

    words = len(sentence.split()) if sentence else 15
    norm_len = max(0.0, min(1.0, (words - 5) / 55.0))

    section_map = {
        "summary": 0.9,
        "experience": 0.7,
        "education": 0.5,
        "skills": 0.3,
    }
    sec_enc = section_map.get(section.lower(), 0.6)

    hist_enc = max(0.0, min(1.0, float(historical_satisfaction)))
    intercept = 1.0

    return [
        round(cat_enc, 4),
        round(sev_enc, 4),
        round(conf_enc, 4),
        round(ctx_enc, 4),
        round(norm_len, 4),
        round(sec_enc, 4),
        round(hist_enc, 4),
        intercept,
    ]


def is_action_evidence_supported(
    action_id: str,
    category: str,
    subcategory: str = "",
    matched_text: str = "",
    confidence: float = 0.9,
) -> bool:
    text = matched_text.lower()
    sub = subcategory.lower()

    if action_id == "redact_personal_info":
        sub_tokens = set(sub.replace("-", "_").split("_"))
        return (
            category == "age_indicative"
            or "graduation" in sub
            or "age" in sub_tokens
            or "age_proxy" in sub
            or "pedigree" in sub
            or any(text.startswith(str(yr)) for yr in range(1970, 2015))
        )
    elif action_id == "contextual_framing":
        return (
            category == "gap_framing"
            or "gap" in sub
            or "career_break" in sub
            or "gap" in text
            or "sabbatical" in text
        )
    elif action_id == "competency_substitution":
        return (
            "ninja" in sub
            or "rockstar" in sub
            or "jargon" in sub
            or "rockstar" in text
            or "ninja" in text
            or "guru" in text
            or "wizard" in text
        )
    elif action_id == "human_review_flag":
        return confidence <= 0.9 or category == "prestige_proxy"
    elif action_id == "neutral_rephrase":
        return True
    return False


# Global singleton engine instance for Python FastAPI
global_bandit_engine = LinUCBBanditEngine()
