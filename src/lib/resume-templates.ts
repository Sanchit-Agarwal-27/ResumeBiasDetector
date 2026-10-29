/**
 * @file resume-templates.ts
 * Curated, ATS-compliant, bias-shielded resume layout templates and Google XYZ impact phrasing.
 * Designed to provide candidates with structured, high-scoring resume starting points.
 */

export interface ImpactPhraseTemplate {
  category: string;
  formula: string;
  example: string;
  measuredBy: string;
  actionDone: string;
}

export interface ResumeTemplateSection {
  title: string;
  bullets: string[];
}

export interface ResumeTemplate {
  id: string;
  title: string;
  subtitle: string;
  category: "all" | "tech" | "executive" | "academic" | "hybrid" | "creative";
  categoryLabel: string;
  targetIndustry: string;
  description: string;
  atsScore: number;
  fontFamily: string;
  columnLayout: "single" | "two_column";
  badges: string[];
  biasShieldHighlights: string[];
  sections: ResumeTemplateSection[];
  rawText: string;
}

export const GOOGLE_XYZ_TEMPLATES: ImpactPhraseTemplate[] = [
  {
    category: "Technical Architecture & Latency",
    formula: "Engineered [X] as measured by [Y] by implementing [Z]",
    example:
      "Engineered distributed microservice caching layer, reducing p99 API latency from 450ms to 42ms (90.6% improvement) by implementing Redis read-replicas with consistent hashing.",
    measuredBy: "Latency reduction (ms / %)",
    actionDone: "Architecture & Infrastructure Refactor",
  },
  {
    category: "Revenue & Commercial Growth",
    formula: "Spearheaded [X] generating [Y] through [Z]",
    example:
      "Spearheaded multi-tenant SaaS billing redesign, generating $2.4M in annualized expansion revenue across 45 enterprise accounts through automated usage metering.",
    measuredBy: "Revenue generated / Account expansion",
    actionDone: "Product Delivery & Monetization",
  },
  {
    category: "Operational Efficiency & CI/CD",
    formula: "Automated [X] saving [Y] engineering hours by deploying [Z]",
    example:
      "Automated end-to-end integration and security test pipelines, saving 350+ engineering hours quarterly by deploying GitHub Actions matrix runners with Docker layer caching.",
    measuredBy: "Hours saved / Cycle time",
    actionDone: "DevOps & Pipeline Automation",
  },
  {
    category: "Cross-Functional Leadership & Mentorship",
    formula: "Championed [X] resulting in [Y] across [Z]",
    example:
      "Championed company-wide accessibility (WCAG 2.1 AA) compliance audit, resulting in 0 critical compliance defects and a 24% uplift in screen-reader user task completion across 6 product suites.",
    measuredBy: "Defect reduction & User completion uplift",
    actionDone: "Quality, Standards & Inclusivity",
  },
  {
    category: "Data & ML Model Accuracy",
    formula: "Trained and deployed [X] achieving [Y] by executing [Z]",
    example:
      "Trained and deployed fraud-detection ensemble model, achieving 99.4% precision and reducing false-positive merchant holds by 38% through XGBoost hyperparameter tuning.",
    measuredBy: "Model precision & False positive reduction",
    actionDone: "Machine Learning & Statistical Modeling",
  },
];

export const RESUME_TEMPLATES: ResumeTemplate[] = [
  {
    id: "modern-tech-minimalist",
    title: "Modern Tech Minimalist",
    subtitle: "Software Engineering, Cloud Architecture & DevOps",
    category: "tech",
    categoryLabel: "Technology",
    targetIndustry: "Cloud Computing, Distributed Systems, Full-Stack",
    description:
      "High-density single-column engineering layout optimized for automated ATS parsers (Workday, Greenhouse, Lever). Emphasizes quantifiable system impact and verifiable tech stacks.",
    atsScore: 98,
    fontFamily: "Inter",
    columnLayout: "single",
    badges: ["98% ATS Safe", "Quantified Impact", "Single Column", "Zero Clutter"],
    biasShieldHighlights: [
      "ADEA-Protected: Omits graduation dates older than 10 years to prevent age screening penalties.",
      "Gender-Neutral: Replaces masculine agentic idioms with outcome-driven systems verbs.",
      "Pedigree-Shielded: Emphasizes open-source repositories and demonstrated competencies over university pedigree.",
    ],
    sections: [
      {
        title: "PROFESSIONAL SUMMARY",
        bullets: [
          "Staff Software Engineer with 8+ years architecting high-throughput distributed backend services and fault-tolerant cloud platforms handling 50k+ requests/sec.",
        ],
      },
      {
        title: "CORE TECHNICAL COMPETENCIES",
        bullets: [
          "Languages: TypeScript, Go, Python, SQL, Rust",
          "Cloud & Infrastructure: AWS (ECS, Lambda, S3, RDS), Kubernetes, Docker, Terraform",
          "Databases & Streaming: PostgreSQL, Redis, Apache Kafka, Elasticsearch",
        ],
      },
      {
        title: "PROFESSIONAL EXPERIENCE",
        bullets: [
          "Staff Software Engineer | NexaCloud Systems (2022 - Present)",
          "• Architected distributed telemetry ingestion engine processing 1.2B events daily, reducing downstream processing lag by 73%.",
          "• Mentored 12 mid-level engineers, establishing engineering design review standards adopted by 4 platform squads.",
          "Senior Software Engineer | FinTech Protocol Labs (2019 - 2022)",
          "• Re-engineered core payment settlement queue using Go and Kafka, achieving 99.999% transaction reliability with zero financial discrepancy.",
          "• Cut annual cloud infrastructure spend by $340k by migrating unreserved EC2 instances to auto-scaling ARM Graviton workloads.",
        ],
      },
      {
        title: "EDUCATION & CERTIFICATIONS",
        bullets: [
          "Bachelor of Science in Computer Science",
          "AWS Certified Solutions Architect – Professional",
        ],
      },
    ],
    rawText: `Jordan Parker
jordan.parker@cloudtech.dev | (555) 234-8901 | Seattle, WA | github.com/jparker-dev | linkedin.com/in/jordanparker

PROFESSIONAL SUMMARY
Staff Software Engineer with 8+ years architecting high-throughput distributed backend services and fault-tolerant cloud platforms handling 50k+ requests/sec. Proven track record driving system observability, reducing multi-million dollar cloud expenses, and leading technical design for cross-functional product squads.

CORE TECHNICAL COMPETENCIES
• Languages: TypeScript, Go, Python, SQL, Rust
• Cloud & Infrastructure: AWS (ECS, Lambda, S3, RDS), Kubernetes, Docker, Terraform, Prometheus
• Databases & Storage: PostgreSQL, Redis, Apache Kafka, Elasticsearch, DynamoDB
• Protocols & Methodologies: gRPC, REST, Microservices, CI/CD, Distributed Caching, Event-Driven

PROFESSIONAL EXPERIENCE
Staff Software Engineer | NexaCloud Systems | Seattle, WA
January 2022 – Present
• Architected distributed telemetry ingestion engine processing 1.2B events daily, reducing downstream processing lag from 4.5 minutes to 45 seconds (73% improvement).
• Designed resilient multi-region database failover strategy using Aurora Global Databases, ensuring 99.995% uptime during regional outage drills.
• Championed engineering design reviews across 4 platform squads, reducing post-deployment incident frequency by 41% year-over-year.
• Automated infrastructure provisioning with Terraform modules, shrinking developer environment spin-up time from 3 hours to 8 minutes.

Senior Software Engineer | FinTech Protocol Labs | San Francisco, CA
March 2019 – December 2021
• Re-engineered core payment settlement engine using Go and Apache Kafka, processing $45M+ daily volume with zero audit discrepancy.
• Optimized PostgreSQL query execution plans and index partitioning, reducing average database CPU load by 54% during peak market opening hours.
• Cut annual cloud infrastructure expenditure by $340,000 by migrating unreserved EC2 workloads to auto-scaling AWS Graviton instances.
• Spearheaded compliance audit alignment for PCI-DSS Level 1 certification, resolving all 28 high-severity architectural vulnerabilities ahead of deadline.

Software Engineer | Apex Analytics Inc. | Austin, TX
July 2017 – February 2019
• Developed customer analytics dashboard in React and Node.js serving 120,000 monthly active enterprise users.
• Implemented Redis caching tier for user session management, reducing p95 API response times by 180ms.
• Built automated end-to-end testing suite in Jest and Cypress, increasing test coverage from 42% to 88%.

EDUCATION & CREDENTIALS
Bachelor of Science in Computer Science | Western Institute of Technology
AWS Certified Solutions Architect – Professional (Active)`,
  },
  {
    id: "executive-leadership",
    title: "Executive Leadership & Strategy",
    subtitle: "Vice President, Director & General Management",
    category: "executive",
    categoryLabel: "Executive",
    targetIndustry: "Enterprise Software, Finance, Operations, Corporate",
    description:
      "Distinguished executive format utilizing elegant serif typography (EB Garamond). Highlights P&L ownership, multi-million dollar revenue growth, organizational transformation, and corporate governance.",
    atsScore: 96,
    fontFamily: "EB Garamond",
    columnLayout: "single",
    badges: ["96% ATS Safe", "P&L Ownership", "Serif Typography", "Corporate Governance"],
    biasShieldHighlights: [
      "Balanced Leadership Lexicon: Combines decisive vision with collaborative organizational enablement.",
      "Age-Neutral Career Summary: Centers on the past 10-15 years of high-impact strategic leadership.",
      "Merit-First Framing: Focuses on measurable operating margins and EBITDA expansion.",
    ],
    sections: [
      {
        title: "EXECUTIVE PROFILE",
        bullets: [
          "Senior technology executive with 15+ years leading global engineering and product operations. Proven record scaling organizations from $20M to $120M ARR with strong fiscal discipline.",
        ],
      },
      {
        title: "EXECUTIVE COMPETENCIES",
        bullets: [
          "Strategic Planning & Execution, P&L Management ($50M+), M&A Technical Due Diligence, Global Team Leadership (150+ staff), Enterprise Transformation",
        ],
      },
    ],
    rawText: `Morgan Vance, MBA
morgan.vance@enterprisestrategies.io | (555) 789-4321 | New York, NY | linkedin.com/in/morganvance-exec

EXECUTIVE PROFILE
Growth-focused Vice President of Technology & Operations with 14+ years spearheading digital transformation, enterprise software delivery, and international team scaling. Track record managing $45M+ operational budgets, driving EBITDA expansion, and leading 160+ multidisciplinary personnel across North America and Europe. Adept at translating boardroom strategy into high-velocity operational execution.

EXECUTIVE CORE COMPETENCIES
• Strategic Planning & P&L Accountability ($50M+)
• Enterprise Digital & Cloud Transformation
• Mergers & Acquisitions Technical Due Diligence
• Global Engineering Organization Scaling (160+ FTEs)
• Corporate Governance, SOC2 & Regulatory Compliance
• Customer Retention & Net Expansion (118% NRR)

EXECUTIVE CAREER HISTORY
Vice President of Engineering & Operations | Apex Horizon Group | New York, NY
June 2021 – Present
• Oversee global technology division spanning 165 software engineers, product managers, and cloud architects with an annual operating budget of $48M.
• Accelerated annual recurring revenue (ARR) from $52M to $118M through disciplined product portfolio modernization and international enterprise market expansion.
• Improved gross operating margin by 620 basis points by consolidating legacy vendor contracts and automating multi-cloud cost allocation.
• Spearheaded technical integration for two strategic acquisitions ($35M combined enterprise value), successfully migrating core assets 4 months ahead of forecast.

Director of Technology | Global Enterprise Solutions | Boston, MA
October 2016 – May 2021
• Managed 75-person engineering department across 5 core enterprise product lines delivering $34M in annual software license revenue.
• Restructured product engineering lifecycle to Agile Scaled Framework (SAFe), increasing on-time release predictability from 61% to 94%.
• Reduced employee voluntary turnover from 22% to 6.5% through comprehensive career progression frameworks and inclusive mentorship programs.
• Partnered with Chief Information Security Officer (CISO) to achieve enterprise-wide SOC2 Type II and ISO 27001 certifications with zero non-conformances.

Senior Engineering Manager | Vanguard Software Systems | Boston, MA
January 2013 – September 2016
• Led 28-engineer cloud infrastructure division delivering mission-critical analytics to Fortune 500 financial institutions.
• Delivered $4.2M cloud migration project on-time and 8% under budget, reducing annual on-premises data center overhead by $1.8M.

EDUCATION & CREDENTIALS
Master of Business Administration (MBA) | Technology & Strategy Focus
Bachelor of Science in Industrial Engineering
Executive Leadership Certificate | Corporate Governance & Strategy`,
  },
  {
    id: "harvard-ivy-standard",
    title: "Harvard & Ivy Academic Standard",
    subtitle: "Management Consulting, Private Equity, Law & Research",
    category: "academic",
    categoryLabel: "Traditional",
    targetIndustry: "Strategy Consulting, Investment Banking, Public Policy",
    description:
      "Strict single-column layout conforming to Ivy League career center formatting standards. Delivers immaculate date alignment, conservative typography, and rigorous bullet density.",
    atsScore: 99,
    fontFamily: "Merriweather",
    columnLayout: "single",
    badges: ["99% ATS Safe", "Ivy Standard", "High Density", "Audit Verified"],
    biasShieldHighlights: [
      "Demographic Obfuscation: Restricts personal markers to professional email, phone, and standard location.",
      "Strict Chronological Parity: Clean, neutral date ranges avoiding gaps and ambiguity.",
      "Universal ATS Parsing: Uses standardized semantic headings universally indexed by all commercial ATS software.",
    ],
    sections: [
      {
        title: "EDUCATION",
        bullets: [
          "Master of Science in Quantitative Economics | High Honors",
          "Bachelor of Arts in Economics & Mathematics | Magna Cum Laude",
        ],
      },
      {
        title: "PROFESSIONAL EXPERIENCE",
        bullets: [
          "Senior Engagement Manager | Bainbridge Strategy Partners (2021 - Present)",
          "• Advised Fortune 100 industrial client on $1.4B supply chain reorganization, identifying $120M in recurring cost efficiencies.",
        ],
      },
    ],
    rawText: `Taylor Sterling
taylor.sterling@consultingpartners.org | (555) 456-7890 | Chicago, IL | linkedin.com/in/taylorsterling

EDUCATION
Master of Science in Quantitative Economics | Graduate School of Business | Chicago, IL
• Focus: Industrial Organization, Econometrics, and Corporate Finance; GPA: 3.92 / 4.0
Bachelor of Arts in Economics and Applied Mathematics | State University Honors College
• Honors: Magna Cum Laude, Phi Beta Kappa, Dean’s Distinguished Scholar

PROFESSIONAL EXPERIENCE
Senior Engagement Manager | Bainbridge Strategy Partners | Chicago, IL
September 2021 – Present
• Direct engagement workstreams for Fortune 100 enterprise clients on commercial growth, pricing strategy, and operational restructuring.
• Led cross-functional team of 6 consultants analyzing pricing elasticity for $3.2B consumer goods manufacturer, unlocking $42M in annualized net margin.
• Advised executive committee of multinational energy conglomerate on decarbonization roadmap, modeling capital allocation across $850M in asset retirements.
• Designed proprietary market benchmarking model adopted by firm's global strategy practice across 14 international offices.

Strategy Consultant | Apex Advisory Group | New York, NY
August 2018 – August 2021
• Conducted comprehensive commercial due diligence for 18 private equity transactions ranging from $150M to $1.2B in target enterprise value.
• Developed detailed 5-year financial models forecasting revenue synergies, operating cost reductions, and working capital requirements.
• Synthesized 140+ expert interviews and quantitative market surveys to evaluate customer retention dynamics in competitive SaaS market.
• Co-authored published white paper on algorithmic fairness and regulatory risk in automated credit underwriting models.

Senior Financial Analyst | Global Financial Markets | New York, NY
June 2016 – July 2018
• Modeled structured debt transactions and evaluated credit covenants for $650M in syndicated corporate debt issuances.
• Automated weekly market volatility variance reports using Python and SQL, saving 6 hours of repetitive analyst effort each trading cycle.

SKILLS & INTERESTS
• Analytical Skills: Financial Modeling (LBO, DCF, M&A), Econometric Regression, Monte Carlo Simulation, Pricing Optimization
• Technical Tools: Python, R, Advanced Excel (VBA), SQL, Tableau, FactSet, Bloomberg Terminal
• Languages: English (Native), Spanish (Professional Working Proficiency)`,
  },
  {
    id: "skills-first-hybrid",
    title: "Skills-First Hybrid (Career Transition)",
    subtitle: "Career Changers, Returning Professionals & Bootcamps",
    category: "hybrid",
    categoryLabel: "Transition",
    targetIndustry: "Data Analytics, AI Engineering, Product, Technology",
    description:
      "A functional-hybrid structure that groups core technical accomplishments and transferable proficiencies at the top, shielding intentional career sabbaticals, parental leave, or career pivots from chronological screening filters.",
    atsScore: 97,
    fontFamily: "Roboto",
    columnLayout: "single",
    badges: ["97% ATS Safe", "Gap Protected", "Competency Grouped", "Upskill Highlight"],
    biasShieldHighlights: [
      "Career Break Neutralization: Replaces gap vulnerability signals with structured professional sabbatical and upskilling framing.",
      "Competency Centric: Ensures ATS bots match key hard competencies in the first 250 words.",
      "Demographic Shielding: Strips dates from early education to preserve recent skill relevance.",
    ],
    sections: [
      {
        title: "PROFESSIONAL PROFILE",
        bullets: [
          "Data Analyst & Analytics Engineer with strong foundations in SQL, Python, and business intelligence. Combines 6+ years domain experience with recent immersion in machine learning workflows.",
        ],
      },
      {
        title: "CORE TECHNICAL PROJECTS & SPECIALIZATIONS",
        bullets: [
          "• Real-Time Revenue Intelligence Pipeline: Built automated ingestion pipeline using dbt, Snowflake, and Airflow.",
          "• Customer Churn Early Warning System: Trained Random Forest classifier identifying at-risk accounts with 87% accuracy.",
        ],
      },
    ],
    rawText: `Cameron Reed
cameron.reed@analyticsnetwork.org | (555) 678-1234 | Denver, CO | github.com/cameronreed-analytics | linkedin.com/in/cameronreed

PROFESSIONAL PROFILE
Analytics Engineer and Data Specialist combining analytical acumen with hands-on expertise building scalable dbt data pipelines, SQL transformation models, and predictive dashboards. Passionate about translating complex behavioral and financial metrics into clear commercial decisions. Experienced leading collaborative cross-functional initiatives and presenting findings to executive stakeholders.

CORE TECHNICAL SKILLS & METHODOLOGIES
• Data Engineering & Warehousing: Snowflake, BigQuery, dbt (Data Build Tool), PostgreSQL, Apache Airflow
• Analytics & Programming: Python (pandas, numpy, scikit-learn), Advanced SQL, R, Git
• Visualization & BI: Tableau, Power BI, Looker, Metabase, Metric Trees
• Statistical Foundations: Hypothesis Testing (A/B Testing), Regression Modeling, Cohort Analysis, CLV Modeling

FEATURED DATA & ANALYTICS PROJECTS
Real-Time Customer Lifetime Value & Churn Predictor | GitHub: github.com/cameronreed-analytics/clv-model
• Developed machine learning pipeline in Python and Snowflake predicting 90-day subscription churn across 85,000 active customer records.
• Implemented feature engineering pipeline capturing user login velocity and support ticket escalation, achieving 0.89 ROC-AUC score.
• Packaged model into automated daily batch inference job using Airflow, generating actionable alert triggers for Customer Success teams.

Enterprise Revenue Analytics Pipeline | GitHub: github.com/cameronreed-analytics/rev-dbt-pipeline
• Engineered dimensional modeling layer in dbt spanning 14 source tables, reducing daily metric discrepancy between finance and sales to 0%.
• Automated automated data quality tests in dbt, catching 38 upstream schema drift bugs before downstream dashboards were affected.

PROFESSIONAL EXPERIENCE
Senior Data & Operations Analyst | Horizon Digital Platforms | Denver, CO
January 2023 – Present
• Manage data modeling and reporting infrastructure supporting $18M e-commerce and retail subscription operation.
• Designed unified executive KPI dashboard in Tableau, providing weekly visibility into CAC, LTV, and cohort payback periods.
• Partnered with engineering to audit tracking taxonomy, improving Google Analytics 4 event reliability by 34%.

Professional Upskilling Sabbatical & Technical Specialization
March 2022 – December 2022
• Completed intensive 800+ hour advanced analytics engineering curriculum focusing on distributed SQL, dbt, and modern data stack tooling.
• Earned dbt Certified Developer and Snowflake SnowPro Core credentials through rigorous practical examination.

Operations & Business Analyst | Summit Logistics Solutions | Boulder, CO
June 2018 – February 2022
• Analyzed regional freight dispatch routes, optimizing fleet fuel utilization by 11.4% through predictive scheduling models.
• Automated monthly financial close reporting in SQL and Excel, reducing reporting turnaround from 5 business days to 4 hours.

EDUCATION & INDUSTRY CREDENTIALS
Bachelor of Science in Business Analytics | University of Colorado
dbt Certified Developer | dbt Labs
SnowPro Core Certified | Snowflake`,
  },
  {
    id: "product-creative-modern",
    title: "Product & Design Innovator",
    subtitle: "Product Management, UX Architecture & Growth",
    category: "creative",
    categoryLabel: "Creative / Product",
    targetIndustry: "Consumer Tech, B2B SaaS, Design Systems, Mobile Apps",
    description:
      "Modern sans-serif typography (Poppins) balancing clean ATS structure with contemporary layout spacing. Highlights user experience metrics, A/B testing velocity, customer empathy, and cross-functional design sprints.",
    atsScore: 97,
    fontFamily: "Poppins",
    columnLayout: "single",
    badges: ["97% ATS Safe", "Product Metrics", "Modern Sans", "User Empathy"],
    biasShieldHighlights: [
      "Outcome-Centric Vocabulary: Focuses on customer value delivery and team enablement rather than aggressive dominance framing.",
      "Disability/Accessibility Championed: Documents WCAG compliance and inclusive design leadership affirmatively.",
      "Clear Functional Hierarchy: High readability for both algorithmic screeners and design directors.",
    ],
    sections: [
      {
        title: "PRODUCT PHILOSOPHY & SUMMARY",
        bullets: [
          "Staff Product Manager with 7+ years driving consumer and SaaS product experiences from discovery to 10M+ MAUs. Expert in experimentation frameworks and user-centered design.",
        ],
      },
    ],
    rawText: `Alex Chen
alex.chen@productcreators.io | (555) 901-2345 | Austin, TX | alexchen.design | linkedin.com/in/alexchen-product

PRODUCT PHILOSOPHY & SUMMARY
Staff Product Manager and UX Architect with 7+ years leading user-centered software products from initial discovery through scaling to 12M+ monthly active users. Specialized in experimentation velocity, collaborative design thinking, and data-informed roadmap execution. Proven ability aligning engineering, design, and commercial teams around measurable user value.

PRODUCT & UX CAPABILITIES
• Product Strategy: Opportunity Solution Trees, Dual-Track Agile, Product Roadmapping, OKR Definition
• Discovery & Research: User Interviews, Usability Testing, Contextual Inquiry, Personas, Customer Journey Mapping
• Experimentation & Analytics: A/B Testing, Amplitude, Mixpanel, FullStory, SQL, Cohort Retention
• Design & Prototyping: Figma, Design Systems, Interactive Wireframing, WCAG 2.1 AA Accessibility

PROFESSIONAL EXPERIENCE
Staff Product Manager | Lumina Digital Products | Austin, TX
April 2021 – Present
• Lead product vision and cross-functional team of 14 (engineers, product designers, data scientists) across core self-serve onboarding flow.
• Increased 14-day user activation rate from 23% to 41% by launching interactive product tour and eliminating 4 redundant signup friction steps.
• Spearheaded company-wide accessibility redesign ensuring 100% WCAG 2.1 AA compliance across mobile and web platforms, reducing user support tickets by 28%.
• Established continuous experimentation cadence running 35+ controlled A/B experiments annually with a 42% win-rate.

Senior Product Manager | Pulse Media & Messaging | San Francisco, CA
September 2018 – March 2021
• Owned growth product initiatives for mobile consumer app with 8M+ downloads, managing backlog prioritization and sprint planning.
• Launched referral sharing flywheel that decreased blended customer acquisition cost (CAC) by 31% while driving 1.4M organic installs.
• Partnered with design team to launch refreshed design system, reducing design-to-development handoff cycle time by 45%.
• Conducted 80+ customer discovery interviews to identify unmet user workflows, translating insights into 3 new subscription tiers generating $1.6M ARR.

Product Designer & UX Researcher | Studio Interface | Austin, TX
July 2016 – August 2018
• Designed interactive wireframes, high-fidelity prototypes, and component libraries for 6 client web applications.
• Moderated in-person and remote usability testing sessions, synthesizing findings into clear executive design recommendations.

EDUCATION & CREDENTIALS
Bachelor of Science in Human-Computer Interaction | School of Information
Certified Scrum Product Owner (CSPO)
Pragmatic Institute Certified (PMC-III)`,
  },
];
