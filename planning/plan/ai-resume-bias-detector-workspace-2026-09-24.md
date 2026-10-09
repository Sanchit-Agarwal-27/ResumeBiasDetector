# AI Resume Bias Detector Workspace

## Goal

Build the finished single-page resume review workspace against the exact uploaded TypeScript contract and mock fixture. The experience will feel like a polished analytical tool: dense but calm, high-contrast, and immediately usable without a multi-step onboarding flow.

## Experience

Create a compact top control bar with product identity, ephemeral-processing status, a prominent 0–100 Neutrality Index, category filter chips, sample loader, and export menu.

- Use a persistent 60/40 split workspace on desktop: a document canvas on the left and an issue inspection/rewrite panel on the right.
- Adapt the workspace for small screens without losing actions or context, stacking the document and issue panel cleanly.
- Add an initial drop zone for PDF/DOCX plus a one-click “Try Sample Resume” option; uploaded supported files will load the contract-shaped mock analysis so the interface remains backend-ready.

## Interactive document review

- Define the supplied `BiasCategory`, `SeverityLevel`, `BiasSpan`, `RewriteSuggestion`, `FairnessMetric`, `EvaluationBenchmark`, and `ResumeBiasReport` interfaces exactly as provided.
- Load the complete supplied fixture, preserve character-offset based highlighting, and visually distinguish category and severity.
- Make highlighted spans clickable and keyboard accessible; selecting one updates the right panel and brings the corresponding issue into focus.
- Make category chips filter visible highlights while preserving the underlying report.
- Include a compact issue navigator so every active flag can be selected from the right panel.

## Rewrite workflow

- Show the active issue’s category, severity, confidence, explanation, citation, original phrase, suggested phrase, and rationale.
- “Accept Rewrite” will patch the displayed text, shift later span offsets, remove the resolved flag, update summary counts, and recalculate the Neutrality Index.
- “Dismiss” will retain the original phrase while removing that flag from active review and recalculating the score.
- Provide clear completed/empty states when all visible issues are resolved.

## Reports and export

- Add an accessible fairness audit modal containing the 80% rule/disparate-impact result, demographic-parity variance, counterfactual test count, and evaluation benchmark comparison.
- Add working browser downloads for the rewritten resume as text and the complete bias report as JSON.
- Keep the privacy/ethical framing visible: processing is ephemeral and results identify bias proxies, not proof of discrimination.

## Visual system

- Use a restrained graphite and warm-paper workspace with coral action accents plus distinct violet, amber, blue, and teal bias-category colors.
- Use crisp sans-serif typography, thin dividers, subtle texture, compact controls, restrained motion, and no decorative marketing layout.
- Add semantic theme tokens for every color and state, including dark-mode-safe values, and use existing shared controls for all actions.

## Validation

- Verify the sample loader, filtering, span selection, accept/dismiss updates, score recalculation, fairness modal, exports, and file-input state.
- Check the live workspace at desktop and mobile widths for clipping, overlap, focus behavior, and readable document text.
- Add route-specific title, description, Open Graph metadata, and Twitter card metadata for the workspace.

### Additional Features to Improve

- We need to keep the resume completely editable and designable in the main workspace itself, so that people dont have to upload the resume again and again, they can add it once and then the whole resume becomes editable in the main workspace itself so then they can edit it then and there and get the bias ratings and other reviews on the spot with live updates and suggestions given by our AI bias detector.
- In the end the user can then export their resume in the desired format, mainly as PNG,JPEG and most importantly PDF.
- Keep all the other features as mentioned above
