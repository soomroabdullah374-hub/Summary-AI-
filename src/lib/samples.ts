// One-click sample documents (PRD FR-1.3). All organisations, products and figures are fictional.
export const SAMPLES = [
  {
    label: "Q3 Cloud Infrastructure Report",
    text: `Q3 FY2026 Cloud Infrastructure Report — Platform Engineering

Executive overview. The third quarter closed with the platform serving 1.84 billion API requests, up 27% from Q2, while total cloud spend rose only 9% to $412,600. The headline result is latency: after session storage moved to regional edge caches in ap-south-1 (Mumbai), p99 response time for checkout fell from 820 ms to 476 ms, a 42% reduction. Database round-trips per checkout dropped from 18 to 7.

Cost and efficiency. Migrating the order and catalog services to serverless connection pooling retired 14 always-on database proxy instances and saved $14,200 per month. Reserved-instance coverage increased from 61% to 78%, cutting compute cost per million requests from $41.30 to $33.90. Storage remains the fastest-growing line item: object storage grew 34% quarter over quarter, driven by product imagery and audit logs that are currently retained indefinitely.

Reliability. Availability for customer-facing services was 99.96% against a 99.95% target. There were two Sev-2 incidents and no Sev-1 incidents. Both Sev-2 events were caused by expired TLS certificates on internal service meshes: one interrupted payment webhooks for 23 minutes on 14 August, and the second degraded search for 41 minutes on 9 September. Mean time to recovery improved to 32 minutes from 58 minutes in Q2, largely because the new runbooks were used in both incidents.

Security and compliance. All production workloads now run on images rebuilt within 30 days. Critical vulnerabilities older than 14 days fell from 37 to 4. The SOC 2 Type II audit window opened on 1 September, and evidence collection is 70% automated.

Risks. Three risks need leadership attention. First, certificate management is still partly manual and caused every Sev-2 this quarter. Second, the Singapore region receives 22% of traffic but has no edge cache, so users there see p99 latency of 910 ms. Third, unbounded log retention will add an estimated $6,800 per month by Q2 FY2027 if nothing changes.

Recommendations for Q4. (1) Automate certificate issuance and renewal for all internal meshes by 15 November, owned by the SRE team. (2) Extend edge caching to ap-southeast-1 (Singapore) by mid-December, with a target p99 under 500 ms. (3) Introduce a 90-day retention policy for debug logs and move audit logs older than one year to archival storage, projected to save $5,100 per month. (4) Raise reserved-instance coverage to 85% before the January price change.`,
  },
  {
    label: "AI Governance Whitepaper",
    text: `Responsible AI Governance Framework — Whitepaper v2.1

1. Purpose
This whitepaper sets out how the organization governs the design, procurement, deployment and retirement of artificial intelligence systems. It replaces the 2024 interim policy and applies to every business unit, to vendors who supply AI-enabled products, and to internal teams building on foundation models. The framework is designed to let teams ship useful AI quickly while keeping legal, ethical and reputational risk within a level the board has approved.

2. Guiding principles
Five principles anchor every decision: accountability, transparency, fairness, safety and privacy. Accountability means every AI system has a named business owner and a named technical owner who sign off on its risk assessment. Transparency means users are told when they are interacting with an AI system and can request a human review of consequential decisions. Fairness requires measurable checks for disparate impact before launch and quarterly afterwards. Safety covers robustness, security testing and the ability to switch a system off within one hour. Privacy requires that personal data used for training or prompting has a documented lawful basis and is minimized.

3. Risk tiers
Systems are classified into three tiers. Tier 1 (minimal risk) includes internal productivity tools such as meeting summarizers and code assistants; they need a lightweight registration and an annual review. Tier 2 (elevated risk) covers customer-facing assistants and systems that influence pricing, marketing or service prioritization; they require a full impact assessment, red-team testing and a monitoring plan. Tier 3 (high risk) covers systems that affect access to credit, employment, insurance or healthcare; they require board-level approval, an independent audit before launch and human review of every adverse decision. Today the inventory contains 142 systems: 96 in Tier 1, 39 in Tier 2 and 7 in Tier 3.

4. Lifecycle controls
Every system moves through four gates. At intake, the owner registers the use case and the governance office assigns a tier within five working days. At design review, teams document training data sources, intended users, known limitations and fallback behaviour. At pre-launch, Tier 2 and Tier 3 systems must pass evaluation thresholds agreed in advance, including accuracy on a held-out test set, toxicity and jailbreak resistance, and fairness metrics across protected groups; a disparity of more than 20% in error rates blocks launch. In operation, systems are monitored for drift, incidents and user complaints, and Tier 3 systems are re-certified every six months.

5. Vendor and model procurement
Third-party AI products must meet the same tier requirements as internal systems. Contracts must give the organization the right to audit, prohibit vendors from training on our data without written consent, and require notification of material model changes at least 30 days in advance. In the last year, 11 of 34 vendor proposals were rejected or sent back because they could not meet these terms.

6. Incident management
An AI incident is any event in which a system causes, or nearly causes, harm to people, legal exposure or a significant business loss. Incidents are reported within 24 hours to the governance office, triaged by severity, and reviewed in a blameless post-mortem within ten working days. Twenty-three incidents were logged in the past twelve months; most involved hallucinated content in customer communications, and none reached the highest severity level.

7. Roles and accountability
The AI Governance Council, chaired by the Chief Risk Officer, meets monthly and owns this framework. A central governance office of six people runs intake, maintains the inventory and coordinates audits. Each business unit appoints an AI risk champion. Internal audit reviews compliance annually and reports directly to the board's risk committee.

8. Roadmap
Over the next 12 months the organization will complete impact assessments for all 39 Tier 2 systems by the end of Q2; automate the model inventory so that new deployments are detected from cloud billing and API logs; publish plain-language model cards for every customer-facing system; and train 2,500 employees on responsible AI basics, with mandatory advanced training for the 400 staff who build or buy AI systems. Progress will be reported to the board each quarter against these four commitments.`,
  },
  {
    label: "Clinical Trial Protocol",
    text: `Protocol Synopsis — Study AR-512-201 (fictional example)

Title: A Phase II, randomized, double-blind, placebo-controlled study of AR-512 in adults with moderate-to-severe plaque psoriasis.

Background: AR-512 is an oral, selective TYK2 inhibitor. In the Phase I program, 64 healthy volunteers received single and multiple doses up to 30 mg; the drug was well tolerated, with mild headache (9%) and nausea (6%) as the most common adverse events and no clinically significant laboratory changes.

Objectives: The primary objective is to compare the proportion of participants achieving at least a 75% improvement in Psoriasis Area and Severity Index (PASI 75) at Week 16 for AR-512 versus placebo. Secondary objectives include PASI 90 response, a static Physician's Global Assessment of clear or almost clear, change in itch score, and safety and tolerability over 24 weeks.

Design: Approximately 240 participants will be randomized 1:1:1 to AR-512 10 mg, AR-512 20 mg, or placebo once daily for 16 weeks, across 35 sites in North America and Europe. After Week 16, placebo participants switch to AR-512 20 mg, and all participants continue treatment to Week 24, followed by a 4-week safety follow-up.

Key eligibility: Adults aged 18 to 70 with a diagnosis of plaque psoriasis for at least 6 months, a PASI of 12 or more, and body surface area involvement of at least 10%. Key exclusions include prior exposure to a TYK2 or JAK inhibitor, active or latent tuberculosis, and any malignancy within the past 5 years.

Statistics: With 80 participants per arm, the study has 90% power to detect a difference of 35 percentage points in PASI 75 response between the 20 mg arm and placebo, assuming a placebo response of 10% and a two-sided alpha of 0.05. Missing data will be handled as non-response.

Safety monitoring: An independent Data Monitoring Committee will review unblinded safety data every 8 weeks. Stopping rules include two or more cases of serious infection considered related to the study drug, or any confirmed case of drug-induced liver injury. Laboratory monitoring includes liver enzymes, lipids and blood counts at every visit.

Timeline: First participant in is planned for March 2027, last participant out for April 2028, and the topline report for July 2028.`,
  },
];
