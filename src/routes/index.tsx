import { createFileRoute } from "@tanstack/react-router";
import { ResumeWorkspace } from "@/components/resume-workspace";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BiasLens — AI Resume Bias Detector" },
      {
        name: "description",
        content:
          "Review, rewrite, and export resumes with live bias analysis and fairness auditing.",
      },
      { property: "og:title", content: "BiasLens — AI Resume Bias Detector" },
      {
        property: "og:description",
        content:
          "A private workspace for live resume bias analysis, neutral rewrites, and fairness auditing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <ResumeWorkspace />;
}
