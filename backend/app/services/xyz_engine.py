"""
Google XYZ Formula Engine
"Accomplished [X], as measured by [Y], by doing [Z]"

Converts unquantified achievement bullets into recruiter-grade accomplishments
with realistic, domain-grounded metrics.
"""

from typing import Dict, Any
import re


def generate_google_xyz_rewrite(sentence: str) -> Dict[str, Any]:
    trimmed = sentence.strip()
    bullet_match = re.match(r"^([•\-*]\s*|\d+\.\s*)", trimmed)
    prefix = bullet_match.group(0) if bullet_match else "• "
    body = trimmed[len(bullet_match.group(0)):].strip() if bullet_match else trimmed
    lower = body.lower()

    # 1. UI / UX / Product Design
    if any(k in lower for k in ["figma", "design system", "component library", "prototype", "prototyping", "wireframe", "user research", "usability", "ux research", "interaction design", "ui", "ux"]):
        if any(k in lower for k in ["component", "library", "figma", "design system"]):
            return {
                "accomplished_x": "Accelerated cross-platform UI delivery velocity",
                "measured_by_y": "by 35% across 4 production web and mobile apps",
                "by_doing_z": "by architecting a standardized Figma component library and scalable design token architecture",
                "full_rewrite": f"{prefix}Accelerated cross-platform UI delivery velocity by 35% across 4 production web and mobile apps by architecting a standardized Figma component library and scalable design token architecture.",
                "domain": "Design & UX"
            }
        if any(k in lower for k in ["research", "usability", "interview", "testing"]):
            return {
                "accomplished_x": "Improved user onboarding task completion rate",
                "measured_by_y": "from 64% to 92% (reducing user drop-offs by 40%)",
                "by_doing_z": "by conducting 25+ moderated user research sessions and validating interactive design iterations",
                "full_rewrite": f"{prefix}Improved user onboarding task completion rate from 64% to 92% (reducing user drop-offs by 40%) by conducting 25+ moderated user research sessions and validating interactive design iterations.",
                "domain": "User Research & Usability"
            }
        return {
            "accomplished_x": "Boosted product user retention and feature engagement",
            "measured_by_y": "by 28% over 6 months",
            "by_doing_z": "by designing responsive interactive user flows, wireframes, and design systems in Figma",
            "full_rewrite": f"{prefix}Boosted product user retention and feature engagement by 28% over 6 months by designing responsive interactive user flows, wireframes, and design systems in Figma.",
            "domain": "Product Design"
        }

    # 2. Backend / Cloud / API Systems
    if any(k in lower for k in ["api", "apis", "rest", "microservice", "microservices", "backend", "database", "postgresql", "postgres", "redis", "caching", "sql", "node", "python", "golang", "fastapi"]):
        if any(k in lower for k in ["caching", "redis", "latency", "query", "performance"]):
            return {
                "accomplished_x": "Reduced p99 database query response latency",
                "measured_by_y": "by 58% (from 290ms down to 42ms) under peak loads",
                "by_doing_z": "by implementing multi-tiered Redis caching and partitioned query index architecture",
                "full_rewrite": f"{prefix}Reduced p99 database query response latency by 58% (from 290ms down to 42ms) under peak loads by implementing multi-tiered Redis caching and partitioned query index architecture.",
                "domain": "Database & Performance"
            }
        return {
            "accomplished_x": "Elevated distributed system throughput and fault tolerance",
            "measured_by_y": "by 45% while sustaining 99.99% service SLA",
            "by_doing_z": "by designing modular RESTful microservices, connection pooling, and automated schema migrations",
            "full_rewrite": f"{prefix}Elevated distributed system throughput and fault tolerance by 45% while sustaining 99.99% service SLA by designing modular RESTful microservices, connection pooling, and automated schema migrations.",
            "domain": "Backend Systems"
        }

    # 3. DevOps / Cloud Infrastructure
    if any(k in lower for k in ["docker", "kubernetes", "k8s", "ci/cd", "pipeline", "deploy", "aws", "gcp", "terraform", "cloud"]):
        return {
            "accomplished_x": "Accelerated production release velocity and eliminated deployment failures",
            "measured_by_y": "by 62% across 12 microservice clusters with zero downtime",
            "by_doing_z": "by automating end-to-end containerized CI/CD pipelines using Kubernetes, Docker, and GitHub Actions",
            "full_rewrite": f"{prefix}Accelerated production release velocity and eliminated deployment failures by 62% across 12 microservice clusters with zero downtime by automating end-to-end containerized CI/CD pipelines using Kubernetes, Docker, and GitHub Actions.",
            "domain": "DevOps & Cloud"
        }

    # 4. Frontend / Web Engineering
    if any(k in lower for k in ["react", "typescript", "javascript", "next", "vue", "frontend", "web", "css", "tailwind"]):
        return {
            "accomplished_x": "Decreased initial page load latency and Time to Interactive (TTI)",
            "measured_by_y": "by 44% (elevating Core Web Vitals Lighthouse score from 68 to 97)",
            "by_doing_z": "by re-architecting client-side components with TypeScript, code-splitting, and memoized rendering",
            "full_rewrite": f"{prefix}Decreased initial page load latency and Time to Interactive (TTI) by 44% (elevating Core Web Vitals Lighthouse score from 68 to 97) by re-architecting client-side components with TypeScript, code-splitting, and memoized rendering.",
            "domain": "Frontend Engineering"
        }

    # 5. Marketing / Digital Campaigns
    if any(k in lower for k in ["campaign", "campaigns", "marketing", "seo", "content", "social media", "email", "conversion", "growth", "analytics"]):
        return {
            "accomplished_x": "Drove high-intent user acquisition and inbound pipeline growth",
            "measured_by_y": "generating a 32% increase in MQL conversions and $65K in campaign pipeline revenue",
            "by_doing_z": "by launching data-driven multi-channel digital campaigns and conversion-rate optimization (CRO)",
            "full_rewrite": f"{prefix}Drove high-intent user acquisition and inbound pipeline growth, generating a 32% increase in MQL conversions and $65K in campaign pipeline revenue by launching data-driven multi-channel digital campaigns and conversion-rate optimization (CRO).",
            "domain": "Digital Marketing"
        }

    # 6. Fallback General Operational Excellence
    return {
        "accomplished_x": "Elevated project execution velocity and deliverable quality",
        "measured_by_y": "by 30% while saving 12 hours of weekly operational overhead",
        "by_doing_z": f"by standardizing best practices, automated workflows, and execution rigor for {body}",
        "full_rewrite": f"{prefix}Elevated project execution velocity and deliverable quality by 30% while saving 12 hours of weekly operational overhead by standardizing best practices, automated workflows, and execution rigor for {body}.",
        "domain": "Operational Excellence"
    }
