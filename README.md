# 🔍 BiasLens — Resume Intelligence & Fairness Studio

<div align="center">

![BiasLens Banner](https://img.shields.io/badge/BiasLens-Resume%20Intelligence-0f172a?style=for-the-badge&logo=shield)
[![React 19](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.1-646cff?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-emerald?style=flat-square)](LICENSE)

**An AI-driven resume bias detection, fairness auditing, and layout-preserving Canva/Figma canvas editor.**

[Key Features](#-key-features) • [Architecture](#-architecture) • [Getting Started](#-getting-started) • [Shortcuts](#-canvas-shortcuts) • [Research & Methodology](#-research--methodology)

</div>

---

## 💡 Overview

Modern recruitment algorithms and automated Applicant Tracking Systems (ATS) frequently replicate unconscious human biases. Minor linguistic cues, institutional prestige markers, and graduation dates can trigger systematic demographic penalties.

**BiasLens** provides applicants and hiring teams with:
1. **Linguistic & Structural Bias Auditing:** Identifies gender-coded language, age indicators, prestige proxies, disability framing, and career gap markers grounded in academic psycholinguistic literature.
2. **Counterfactual Fairness Simulation:** Computes demographic parity and disparate impact ratios ($80\%$ rule) across counterfactual candidate cohorts.
3. **Interactive Design Editor:** Converts imported PDFs and DOCX files into full-fidelity Canva/Figma-style vector textboxes with auto-docking, alignment guidelines, rich typography, and layout preservation.
4. **Zero-Retention Client-Side Processing:** All text clustering, NLP heuristics, and edits run in-memory within the browser with persistent local storage.

---

## ✨ Key Features

### 🎨 Canva / Figma Style Resume Canvas
- **High-Fidelity PDF Clustering:** Automatically detects two-column splits, extracts exact $(x, y)$ coordinates, preserves font baselines, and recovers true RGB text colors from the PDF operator stream.
- **Auto-Docking & Magnetic Snapping:** Text frames snap to page margins, horizontal/vertical page centers, and sibling blocks with pink alignment guidelines.
- **Marquee & Multi-Select:** Left-click and drag on the canvas sheet to marquee-select multiple frames. Move, style, or delete them collectively with a unified bounding box.
- **Typography & Font Choices:** Supports `Poppins`, `Inter`, `Montserrat`, `Roboto`, `Lato`, `EB Garamond`, `Merriweather`, and formal corporate typefaces with direct point-size typing.
- **History Stack & Navigation:** Complete Undo/Redo (`Ctrl+Z`, `Ctrl+Y`), Arrow key nudging, and Spacebar pan navigation.

### ⚖️ BiasLens Intelligence Engine
- **5 Core Bias Dimensions:**
  - ♀️ / ♂️ **Gender-Coded Phrasing** (Gaucher et al. Agentic vs. Communal taxonomy)
  - ⏳ **Age Proxies** (Graduation dates, outdated software stacks, tenure framing)
  - 🏛️ **Prestige Indicators** (Elite university bias, non-predictive pedigree filters)
  - ⏱️ **Career Gap Framing** (Vulnerability signals vs. neutral professional phrasing)
  - ♿ **Disability & Health Proxies**
- **Actionable Neutral Rewrites:** Single-click application of calibrated rewrites directly onto the canvas text frames without layout distortion.
- **Live Neutrality Index:** Real-time $0 - 100$ score counter reflecting the cumulative bias exposure of the current draft.
- **Dual Engine Architecture:** Instant client-side NLP with a header dropdown switch ready to connect to a remote FastAPI Python backend.

---

## ⌨️ Canvas Shortcuts

| Shortcut | Action |
|:---|:---|
| `Ctrl + B` / `⌘ + B` | Toggle **Bold** |
| `Ctrl + I` / `⌘ + I` | Toggle *Italic* |
| `Ctrl + U` / `⌘ + U` | Toggle <u>Underline</u> |
| `Ctrl + Shift + L` | Align **Left** |
| `Ctrl + Shift + E` | Align **Center** |
| `Ctrl + Shift + R` | Align **Right** |
| `Ctrl + Shift + J` | Align **Justify** |
| `Ctrl + Z` / `⌘ + Z` | **Undo** |
| `Ctrl + Y` / `Ctrl+Shift+Z` | **Redo** |
| `Ctrl + D` / `⌘ + D` | **Duplicate** Selected Block(s) |
| `Delete` / `Backspace` | **Delete** Selected Block(s) |
| `Arrow Keys` | Nudge $1\text{pt}$ ($10\text{pt}$ with `Shift`) |
| `Spacebar + Drag` | Pan / Hand Tool |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- npm or bun

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/biaslens.git

# Navigate into the project
cd biaslens

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:8080/` in your browser.

### Production Build

```bash
# Compile client and server bundles
npm run build

# Preview production build locally
npm run preview
```

---

## 🔬 Research & Methodology

- **Gaucher, Friesen, & Kay (2011):** *Evidence That Gendered Wording in Job Advertisements Exists and Sustains Gender Inequality.* Journal of Personality and Social Psychology.
- **EEOC Uniform Guidelines (29 C.F.R. § 1607.4D):** *The Four-Fifths / 80% Rule for Disparate Impact Detection in Hiring Processes.*
- **Bertrand & Mullainathan (2004):** *Are Emily and Greg More Employable Than Lakisha and Jamal? A Field Experiment on Labor Market Discrimination.* American Economic Review.

---

## 🔒 Privacy & Data Ethics

- **Zero Data Retention:** No resume text, contact details, or PDF bytes are transmitted to third-party tracking services or stored on external databases.
- **Local Persistence:** Resumes and work-in-progress drafts are saved locally in the user's browser `localStorage` for uninterrupted productivity across sessions.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
