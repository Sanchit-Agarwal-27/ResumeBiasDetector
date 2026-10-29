"""
q_learning_agent.py
Sequential Q-Learning Agent implementing Bellman optimality for episodic document optimization.
Supports epsilon-greedy exploration, persistence, and sequential trajectory execution.
"""

import json
import os
import random
from typing import Any, Dict, List, Optional, Tuple

from .rl_environment import ResumeOptimizationEnv, ACTIONS, ACTION_LABELS

NUM_STATES = 27
NUM_ACTIONS = 6

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "data")
Q_POLICY_FILE = os.path.join(DATA_DIR, "q_learning_policy.json")


class QLearningAgent:
    def __init__(
        self,
        alpha: float = 0.1,        # Learning rate
        gamma: float = 0.95,       # Discount factor (Bellman equation)
        epsilon: float = 1.0,      # Initial exploration rate
        epsilon_min: float = 0.05, # Minimum exploration rate
        epsilon_decay: float = 0.995,
    ):
        self.alpha = alpha
        self.gamma = gamma
        self.epsilon = epsilon
        self.epsilon_min = epsilon_min
        self.epsilon_decay = epsilon_decay
        self.total_episodes_trained = 0

        # Initialize Q-table: 27 states x 6 actions initialized to small optimistic values
        self.q_table: List[List[float]] = [
            [0.1 for _ in range(NUM_ACTIONS)] for _ in range(NUM_STATES)
        ]

        # Prior initialization for sensible cold start
        self._initialize_priors()
        self.load_policy()

    def _initialize_priors(self):
        """Sets intuitive initial state-action values so agent behaves sensibly prior to training."""
        for state in range(NUM_STATES):
            # If in highest neutrality & ATS state (state 26: n_bin=2, ats_bin=2, flags=0), TERMINATE (Action 5) is preferred
            if state == 26:
                self.q_table[state][5] = 5.0
            else:
                # In low neutrality, actions 0, 1, 2, 3 have higher priors
                self.q_table[state][0] = 1.2
                self.q_table[state][1] = 1.4
                self.q_table[state][2] = 1.1
                self.q_table[state][3] = 1.0
                self.q_table[state][4] = 0.8
                self.q_table[state][5] = -0.5

    def select_action(self, state: int, greedy: bool = False) -> int:
        """Selects action via epsilon-greedy policy."""
        if not greedy and random.random() < self.epsilon:
            return random.randint(0, NUM_ACTIONS - 1)

        # Greedy: pick action maximizing Q(s, a) with tie-breaking
        best_q = -float("inf")
        best_actions = []
        for a in range(NUM_ACTIONS):
            q_val = self.q_table[state][a]
            if q_val > best_q:
                best_q = q_val
                best_actions = [a]
            elif abs(q_val - best_q) < 1e-6:
                best_actions.append(a)

        return random.choice(best_actions)

    def update(
        self, state: int, action: int, reward: float, next_state: int, terminated: bool
    ) -> float:
        """
        Bellman Optimality Update:
        Q(s, a) <- Q(s, a) + alpha * [reward + gamma * max_a' Q(s', a') - Q(s, a)]
        """
        current_q = self.q_table[state][action]
        if terminated:
            target = reward
        else:
            max_next_q = max(self.q_table[next_state])
            target = reward + self.gamma * max_next_q

        td_error = target - current_q
        self.q_table[state][action] = round(current_q + self.alpha * td_error, 4)

        return td_error

    def decay_epsilon(self):
        """Decays exploration parameter after each training episode."""
        if self.epsilon > self.epsilon_min:
            self.epsilon = max(self.epsilon_min, self.epsilon * self.epsilon_decay)

    def run_optimization_trajectory(
        self,
        initial_neutrality: float = 44.0,
        initial_ats: float = 62.0,
        initial_flags: int = 6,
        detected_categories: List[str] = None,
        max_steps: int = 10,
    ) -> Dict[str, Any]:
        """
        Executes a deterministic (greedy) trajectory across the document environment.
        Customizes decisions dynamically to the specific resume's starting scores and active bias flags.
        """
        env = ResumeOptimizationEnv(max_steps=max_steps)
        state = env.reset(
            initial_neutrality=initial_neutrality,
            initial_ats=initial_ats,
            initial_flags=initial_flags,
            detected_categories=detected_categories,
        )

        trajectory: List[Dict[str, Any]] = []
        cumulative_reward = 0.0

        for step_idx in range(max_steps):
            # Check if all issues are resolved and scores are high -> naturally terminate
            if env.flag_count == 0 and env.neutrality_score >= 88.0:
                action = 5  # Terminate
            else:
                # Find valid action candidates that target remaining issues
                candidate_actions = []
                if "gender_coded" in env.active_categories:
                    candidate_actions.append(0)
                if "age_indicative" in env.active_categories:
                    candidate_actions.append(1)
                if "gap_framing" in env.active_categories:
                    candidate_actions.append(2)
                if any(c in env.active_categories for c in ["personality_behavioral", "prestige_proxy", "disability_coded"]):
                    candidate_actions.append(3)
                if env.ats_score < 82.0:
                    candidate_actions.append(4)

                if not candidate_actions:
                    action = 5  # No remaining issues or ATS deficit -> terminate
                else:
                    # Pick candidate action with highest Q(s, a)
                    action = max(candidate_actions, key=lambda a: self.q_table[state][a])

            next_state, reward, terminated, info = env.step(action)
            cumulative_reward += reward

            trajectory.append({
                "step": step_idx + 1,
                "state_index": state,
                "action_id": action,
                "action_name": ACTIONS[action],
                "action_label": ACTION_LABELS[action],
                "reward": round(reward, 4),
                "cumulative_reward": round(cumulative_reward, 4),
                "neutrality_score": info["neutrality"],
                "ats_score": info["ats"],
                "flags_remaining": info["flags"],
                "delta_neutrality": info["delta_neutrality"],
                "delta_ats": info["delta_ats"],
                "is_terminal": terminated,
            })

            state = next_state
            if terminated:
                break

        final_metrics = env.get_state_metrics()

        return {
            "initial_neutrality": initial_neutrality,
            "final_neutrality": final_metrics["neutrality_score"],
            "initial_ats": initial_ats,
            "final_ats": final_metrics["ats_score"],
            "initial_flags": initial_flags,
            "final_flags": int(final_metrics["flag_count"]),
            "total_steps": len(trajectory),
            "total_reward": round(cumulative_reward, 4),
            "converged_optimally": final_metrics["neutrality_score"] >= 85.0 and final_metrics["ats_score"] >= 75.0,
            "trajectory": trajectory,
        }

    def save_policy(self) -> bool:
        try:
            os.makedirs(DATA_DIR, exist_ok=True)
            payload = {
                "algorithm": "Tabular Q-Learning (Bellman Optimality)",
                "gamma": self.gamma,
                "alpha": self.alpha,
                "epsilon": self.epsilon,
                "total_episodes_trained": self.total_episodes_trained,
                "num_states": NUM_STATES,
                "num_actions": NUM_ACTIONS,
                "q_table": self.q_table,
            }
            with open(Q_POLICY_FILE, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
            return True
        except Exception:
            return False

    def load_policy(self) -> bool:
        if not os.path.exists(Q_POLICY_FILE):
            return False
        try:
            with open(Q_POLICY_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.q_table = data.get("q_table", self.q_table)
            self.total_episodes_trained = data.get("total_episodes_trained", 0)
            self.gamma = data.get("gamma", self.gamma)
            return True
        except Exception:
            return False


# Global singleton instance for production FastAPI microservice
global_q_agent = QLearningAgent()
