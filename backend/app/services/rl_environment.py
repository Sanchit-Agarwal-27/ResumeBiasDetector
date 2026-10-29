"""
rl_environment.py
Gymnasium-style Markov Decision Process (MDP) environment for sequential resume optimization.
Defines the State Space S, Action Space A, Transition Dynamics P, and Reward Function R.
Designed to be clean, modular, and easy to explain during academic evaluation.
"""

import math
from typing import Any, Dict, List, Tuple

# Discrete Macro Action Space A
ACTIONS = [
    "MITIGATE_GENDER_BIAS",      # Action 0: Resolve gender-coded wording
    "MITIGATE_AGE_INDICATIVE",   # Action 1: Redact age-indicative graduation years/markers
    "MITIGATE_CAREER_GAP",       # Action 2: Reframe career breaks and sabbaticals
    "MITIGATE_BUZZWORDS",        # Action 3: Substitute bro-culture buzzwords with technical competencies
    "BOOST_ATS_ALIGNMENT",       # Action 4: Inject high-priority domain skills
    "TERMINATE_OPTIMIZATION",    # Action 5: Finish editing episode
]

ACTION_LABELS = {
    0: "Mitigate Gender-Coded Phrasing",
    1: "Redact Age Proxies / Graduation Years",
    2: "Constructive Career Gap Framing",
    3: "Competency Substitution for Buzzwords",
    4: "Boost ATS Keyword Density",
    5: "Terminate Episode (Optimal Reached)",
}


class ResumeOptimizationEnv:
    """
    Episodic MDP Environment for automated resume optimization.
    
    State Tuple: (neutrality_bin, ats_bin, flags_bin)
    Total discrete state space: 3 * 3 * 3 = 27 discrete states.
    - neutrality_bin: 0 (Low <60%), 1 (Medium 60-84%), 2 (High >=85%)
    - ats_bin: 0 (Low <60%), 1 (Medium 60-79%), 2 (High >=80%)
    - flags_bin: 0 (Zero flags), 1 (Few flags 1-3), 2 (Many flags >3)
    """

    def __init__(self, max_steps: int = 10):
        self.max_steps = max_steps
        self.current_step = 0
        self.neutrality_score = 45.0
        self.ats_score = 60.0
        self.flag_count = 6
        self.active_categories: List[str] = []
        self.history: List[Dict[str, Any]] = []

    def reset(
        self,
        initial_neutrality: float = 45.0,
        initial_ats: float = 60.0,
        initial_flags: int = 6,
        detected_categories: List[str] = None,
    ) -> int:
        """Resets the environment for a new optimization episode with custom resume metrics."""
        self.current_step = 0
        self.neutrality_score = float(initial_neutrality)
        self.ats_score = float(initial_ats)
        self.history = []

        if detected_categories is not None:
            self.active_categories = list(detected_categories)
            self.flag_count = len(self.active_categories)
        else:
            self.flag_count = int(initial_flags)
            # Synthesize representative categories based on flag count
            cats = []
            pool = ["gender_coded", "age_indicative", "gap_framing", "personality_behavioral", "prestige_proxy"]
            for i in range(self.flag_count):
                cats.append(pool[i % len(pool)])
            self.active_categories = cats

        return self._get_discrete_state()

    def _get_discrete_state(self) -> int:
        """
        Discretizes continuous metrics into a single state index [0, 26].
        Formula: n_bin * 9 + ats_bin * 3 + flags_bin
        """
        # Neutrality bin
        if self.neutrality_score < 60.0:
            n_bin = 0
        elif self.neutrality_score < 85.0:
            n_bin = 1
        else:
            n_bin = 2

        # ATS bin
        if self.ats_score < 60.0:
            ats_bin = 0
        elif self.ats_score < 80.0:
            ats_bin = 1
        else:
            ats_bin = 2

        # Flags bin
        if self.flag_count == 0:
            f_bin = 0
        elif self.flag_count <= 3:
            f_bin = 1
        else:
            f_bin = 2

        return n_bin * 9 + ats_bin * 3 + f_bin

    def get_state_metrics(self) -> Dict[str, float]:
        """Returns the continuous state vector for explainability."""
        return {
            "neutrality_score": round(self.neutrality_score, 1),
            "ats_score": round(self.ats_score, 1),
            "flag_count": float(self.flag_count),
            "step": float(self.current_step),
            "max_steps": float(self.max_steps),
        }

    def step(self, action: int) -> Tuple[int, float, bool, Dict[str, Any]]:
        """
        Executes a transition P(s_{t+1} | s_t, action) and returns:
        (next_state, reward, terminated, info)
        """
        self.current_step += 1
        prev_neutrality = self.neutrality_score
        prev_ats = self.ats_score
        terminated = False
        action_name = ACTIONS[action] if 0 <= action < len(ACTIONS) else "UNKNOWN"

        # Action 5: Terminate Episode
        if action == 5:
            terminated = True
            # Reward bonus if reached safe threshold, penalty if terminated prematurely
            if self.neutrality_score >= 85.0 and self.ats_score >= 80.0 and self.flag_count == 0:
                reward = 5.0  # Terminal success bonus
            elif self.flag_count > 3:
                reward = -3.0  # Premature termination penalty
            else:
                reward = 1.0

            info = {
                "action": action_name,
                "label": ACTION_LABELS.get(action, "Terminate"),
                "delta_neutrality": 0.0,
                "delta_ats": 0.0,
                "step": self.current_step,
                "neutrality": self.neutrality_score,
                "ats": self.ats_score,
                "flags": self.flag_count,
            }
            return self._get_discrete_state(), reward, terminated, info

        # Execute editing transitions based on custom resume categories
        delta_n = 0.0
        delta_ats = 0.0

        if action == 0:  # Mitigate gender bias
            has_gender = "gender_coded" in self.active_categories
            if has_gender:
                self.active_categories.remove("gender_coded")
                delta_n = 14.0
                delta_ats = 2.0
            elif self.flag_count > 0:
                # Fallback if no specific category mapped
                if self.active_categories:
                    self.active_categories.pop(0)
                delta_n = 10.0
                delta_ats = 1.0
            else:
                delta_n = 0.0
                delta_ats = -1.0  # Action taken with no gender issues remaining

        elif action == 1:  # Redact age proxies
            has_age = "age_indicative" in self.active_categories
            if has_age:
                self.active_categories.remove("age_indicative")
                delta_n = 16.0
                delta_ats = -0.5  # Slight token removal cost
            elif self.flag_count > 0:
                if self.active_categories:
                    self.active_categories.pop(0)
                delta_n = 12.0
                delta_ats = -0.5
            else:
                delta_n = 0.0
                delta_ats = -1.0

        elif action == 2:  # Reframe career gap
            has_gap = "gap_framing" in self.active_categories
            if has_gap:
                self.active_categories.remove("gap_framing")
                delta_n = 13.0
                delta_ats = 3.0
            elif self.flag_count > 0:
                if self.active_categories:
                    self.active_categories.pop(0)
                delta_n = 9.0
                delta_ats = 2.0
            else:
                delta_n = 0.0
                delta_ats = -1.0

        elif action == 3:  # Competency substitution for buzzwords
            has_buzz = any(c in self.active_categories for c in ["personality_behavioral", "prestige_proxy", "disability_coded"])
            if has_buzz:
                for c in ["personality_behavioral", "prestige_proxy", "disability_coded"]:
                    if c in self.active_categories:
                        self.active_categories.remove(c)
                        break
                delta_n = 11.0
                delta_ats = 5.0
            elif self.flag_count > 0:
                if self.active_categories:
                    self.active_categories.pop(0)
                delta_n = 8.0
                delta_ats = 3.0
            else:
                delta_n = 0.0
                delta_ats = -1.0

        elif action == 4:  # Boost ATS alignment
            if self.ats_score < 85.0:
                delta_n = -0.5  # Minor phrasing adjustment cost
                delta_ats = 10.0
            else:
                delta_n = 0.0
                delta_ats = 1.0  # Diminishing returns if ATS already high

        self.flag_count = len(self.active_categories)

        # Update continuous metrics
        self.neutrality_score = min(100.0, max(0.0, self.neutrality_score + delta_n))
        self.ats_score = min(100.0, max(0.0, self.ats_score + delta_ats))

        # Reward Function:
        # R = 0.1 * Delta_Neutrality + 0.1 * Delta_ATS - 0.05 * StepPenalty
        reward = (
            0.1 * (self.neutrality_score - prev_neutrality)
            + 0.08 * (self.ats_score - prev_ats)
            - 0.05
        )

        # Check natural termination conditions
        if self.current_step >= self.max_steps:
            terminated = True
        elif self.neutrality_score >= 95.0 and self.ats_score >= 88.0 and self.flag_count == 0:
            terminated = True
            reward += 3.0  # Early convergence bonus

        info = {
            "action": action_name,
            "label": ACTION_LABELS.get(action, "Unknown"),
            "delta_neutrality": round(self.neutrality_score - prev_neutrality, 1),
            "delta_ats": round(self.ats_score - prev_ats, 1),
            "step": self.current_step,
            "neutrality": round(self.neutrality_score, 1),
            "ats": round(self.ats_score, 1),
            "flags": self.flag_count,
        }

        self.history.append(info)
        return self._get_discrete_state(), round(reward, 4), terminated, info
