import type { JobDescriptionProfile } from "./resume-contract";

export const SAMPLE_JOB_BENCHMARKS: JobDescriptionProfile[] = [
  {
    id: "job-swe-fullstack-sr",
    title: "Senior Full-Stack Engineer",
    company: "Stripe / Vercel (Fintech & Cloud)",
    target_seniority: "Senior (5+ YOE)",
    raw_text: `About the Role:
We are looking for a Senior Full-Stack Engineer to architect and build next-generation distributed applications. You will collaborate cross-functionally with product and design teams to deliver high-reliability web experiences.

Key Responsibilities:
- Design, implement, and maintain scalable web applications utilizing React, TypeScript, Node.js, and modern CSS/Tailwind.
- Architect robust REST and GraphQL APIs backed by PostgreSQL and Redis caches.
- Lead system design reviews, mentor junior engineers, and champion automated testing (Jest, Playwright, CI/CD).
- Optimize client-side rendering performance, Core Web Vitals, and accessibility (WCAG 2.1 AA).
- Deploy and monitor microservices across cloud infrastructure (AWS or GCP, Docker, Kubernetes).

Qualifications & Skills:
- 5+ years of full-stack engineering experience in production web environments.
- Strong proficiency with TypeScript, React, Next.js, and Node.js.
- Deep understanding of relational databases (PostgreSQL), data modeling, and query optimization.
- Proven experience with Docker, CI/CD pipelines, and cloud services (AWS/GCP).
- Excellent communication skills and a passion for engineering excellence and clean architecture.`,
  },
  {
    id: "job-ai-ml-engineer",
    title: "Staff Machine Learning Engineer (Generative AI)",
    company: "Anthropic / OpenAI Ecosystem",
    target_seniority: "Staff / Principal (6+ YOE)",
    raw_text: `About the Role:
We are seeking a Staff Machine Learning Engineer to build high-performance LLM pipelines, fine-tuning workflows, and real-time inference systems.

Key Responsibilities:
- Develop production GenAI agents and RAG (Retrieval-Augmented Generation) architectures.
- Train, evaluate, and fine-tune large language models and vision-language transformers using PyTorch and Hugging Face.
- Build high-throughput vector retrieval systems with Pinecone, pgvector, or Milvus.
- Implement robust evaluation frameworks measuring precision, recall, hallucination rates, and algorithmic fairness.
- Scale low-latency model inference across distributed GPU clusters with Triton and vLLM.

Qualifications & Skills:
- M.S. or B.S. in Computer Science, Machine Learning, or related quantitative discipline.
- 5+ years building and deploying machine learning pipelines in production.
- Expert-level Python programming with deep experience in PyTorch, transformers, and NumPy.
- Experience with MLOps tooling (Weights & Biases, MLflow, Docker, Kubernetes).
- Familiarity with AI safety, bias mitigation, and counterfactual fairness auditing.`,
  },
  {
    id: "job-product-manager-lead",
    title: "Lead Technical Product Manager",
    company: "Airbnb / Linear (Product-Led SaaS)",
    target_seniority: "Lead (4+ YOE)",
    raw_text: `About the Role:
We are looking for a Lead Technical Product Manager to define the strategic roadmap and drive high-impact user experiences from zero to one.

Key Responsibilities:
- Define product vision, customer journeys, and release roadmaps for core SaaS features.
- Partner closely with engineering, data science, and design to translate complex technical problems into user-friendly solutions.
- Drive data-driven decision making through A/B testing, cohort retention analysis, and user telemetry (Mixpanel, Amplitude).
- Lead sprint planning, backlog grooming, and agile execution cycles.
- Communicate roadmaps, KPIs, and outcomes to executive stakeholders and customers.

Qualifications & Skills:
- 4+ years of product management experience shipping developer tools or SaaS web applications.
- Demonstrated success leading cross-functional teams in high-growth environments.
- Strong technical fluency: able to read API schemas, SQL queries, and system architectures.
- Proven track record with product analytics, user research, and metric-driven optimization.`,
  },
  {
    id: "job-data-analyst-scientist",
    title: "Senior Data Analyst & BI Architect",
    company: "Snowflake / Databricks Ecosystem",
    target_seniority: "Senior (4+ YOE)",
    raw_text: `About the Role:
We are searching for a Senior Data Analyst to uncover strategic growth insights, build automated ELT/ETL pipelines, and architect executive dashboards.

Key Responsibilities:
- Build, optimize, and maintain complex SQL queries and data models in BigQuery and Snowflake.
- Create interactive dashboards and automated reporting in Tableau, Looker, or Power BI.
- Perform statistical modeling, hypothesis testing, and exploratory data analysis using Python and Pandas.
- Partner with finance, marketing, and engineering to measure company-wide OKRs and revenue attribution.
- Maintain high data quality standards and semantic governance across enterprise data warehouses.

Qualifications & Skills:
- 4+ years of professional experience in business intelligence, data analytics, or data science.
- Advanced SQL mastery (window functions, CTEs, performance tuning, dimensional modeling).
- Proficiency in Python or R for statistical computing and data wrangling.
- Strong background with modern data stack tooling (dbt, Fivetran, Snowflake/BigQuery).
- Exceptional ability to translate complex data findings into actionable executive narratives.`,
  },
  {
    id: "job-devops-cloud-architect",
    title: "Cloud Infrastructure & DevOps Engineer",
    company: "HashiCorp / Cloud Native",
    target_seniority: "Mid-Senior (4+ YOE)",
    raw_text: `About the Role:
Join our platform infrastructure team to build resilient, secure, and auto-scaling cloud environments powering millions of user requests daily.

Key Responsibilities:
- Design and manage Infrastructure as Code (IaC) using Terraform and Kubernetes.
- Implement automated CI/CD pipelines utilizing GitHub Actions, GitLab CI, and ArgoCD.
- Manage multi-region cloud deployments on AWS and Google Cloud Platform.
- Architect observability, logging, and tracing systems with Prometheus, Grafana, and Datadog.
- Enforce Zero Trust security protocols, IAM least-privilege policies, and SOC 2 compliance.

Qualifications & Skills:
- 4+ years managing cloud infrastructure and high-availability distributed systems.
- Deep expertise with Kubernetes, Docker, Helm, and container orchestration.
- Hands-on mastery of Terraform, AWS services (ECS, EKS, RDS, S3), and Linux system administration.
- Proven experience with monitoring, alerting, and incident response management.`,
  },
];
