/**
 * Site copy sourced from Honest Fit Assessment `candidateProfile.local.ts`.
 * Sync when the canonical profile changes.
 */

export const siteHeadline =
  'Senior Frontend Engineer | Design Systems | React, TypeScript, Accessibility, UI Architecture'

export const siteSubHeadline =
  'Senior frontend engineer who owns architecture, builds production design systems, and ships AI-enabled interfaces. I step into complex codebases, define patterns, and make teams faster.'

export const coreStrengths = [
  'React and TypeScript single-page applications',
  'Design systems and component libraries used across teams',
  'B2B SaaS workflows and internal tools',
  'Data-heavy, operational UIs (dashboards, queues, review flows)',
  'AI-assisted development (Cursor, ChatGPT/Claude) for speed and exploration',
  'End-to-end ownership of features and systems',
  'Strong collaboration with Product, Design, and Operations',
  'Early-career infrastructure, networking, and hardware experience',
] as const

export type ProfileExperience = {
  company: string
  role: string
  location: string
  start: string
  end: string | null
  domain: string
  stack: readonly string[]
  highlights: readonly string[]
  links?: readonly { label: string; url: string }[]
}

export const experience: readonly ProfileExperience[] = [
  {
    company: 'City of Portland – Bureau of Technology Services',
    role: 'Senior Frontend Engineer (Contract)',
    location: 'Remote, USA',
    start: '2025-02',
    end: '2025-09',
    domain:
      'Public Sector, Internal Tools, Design System, Accessibility, Component Libraries, screen readers, WCAG, Section 508, USWDS',
    stack: [
      'Figma',
      'Zeroheight',
      'GitHub Actions',
      'GitHub Workflows',
      'React',
      'TypeScript',
      'Design System',
      'Design Tokens',
      'Storybook',
      'Jest',
      'React Testing Library',
    ],
    highlights: [
      'Led the creation and rollout of a React/TypeScript component library and design system used across multiple internal and public-facing city applications.',
      'Defined reusable patterns for page shells, navigation, forms, and data views to speed up new feature delivery and improve consistency.',
      'Implemented accessible, semantic, and performant components.',
      'Used Cursor AI to scaffold components, tests, and documentation while reviewing and refining the output manually.',
      'Owned frontend testing strategy for the component library, writing unit tests with Jest and React Testing Library.',
      'Implemented visual snapshot and accessibility testing to guard regressions before rollout.',
      'Worked closely with designers to keep UI on-brand while improving performance and UX for a high-traffic government website.',
      'Drove adoption of the component library and design system across multiple teams, providing training and documentation.',
      'Developed design token pipeline and tooling (including Zeroheight, GitHub Actions) to manage and version design tokens across the component library and design system.',
      'Created and published the component library and design tokens to NPM as a package to be used by other teams.',
    ],
    links: [
      {
        label: 'Design tokens – GitHub',
        url: 'https://github.com/eGovPDX/design-tokens',
      },
      {
        label: 'Component library – GitHub',
        url: 'https://github.com/eGovPDX/portland-component-library',
      },
      {
        label: 'Component library – Storybook docs',
        url: 'https://egovpdx.github.io/portland-component-library',
      },
      {
        label: 'Component library – npm',
        url: 'https://www.npmjs.com/package/@cityofportland/component-library',
      },
      {
        label: 'Design tokens – npm',
        url: 'https://www.npmjs.com/package/@cityofportland/design-tokens',
      },
    ],
  },
  {
    company: 'ICF – Child Welfare Information Gateway (childwelfare.gov)',
    role: 'Senior Frontend Engineer (Contract)',
    location: 'Remote, USA',
    start: '2023-05',
    end: '2024-06',
    domain:
      'Federal Programs, Government Contracting, Content-Rich Web Apps, Drupal, GraphQL, Accessibility, Static Site Generation',
    stack: ['Drupal', 'GraphQL', 'React', 'Gatsby', 'TypeScript', 'Storybook'],
    highlights: [
      'Built and maintained React/Gatsby frontends for federal programs serving as information hubs and workflow tools.',
      'Owned features like faceted search, filtered lists, and multi-step publishing flows from requirements through implementation.',
      'Integrated with REST APIs under strict accessibility and content standards (WCAG, Section 508).',
      'Focused on clear loading, error, and empty states to support non-technical users.',
      'Wrote unit tests for components and integration tests for key workflows using Jest, React Testing Library, and Cypress.',
      'Implemented end-to-end tests for key workflows using Cypress and accessibility checks using axe and screen readers.',
      'Collaborated closely with backend and product managers to keep UI on-brand while improving performance and UX for a high-traffic government website.',
      'Ensured public-facing federal pages were performant, accessible, and search-friendly within React/Gatsby constraints.',
      'Collaberated with backend to design and implement API contracts and data shapes from Drupal via GraphQL.',
    ],
  },
  {
    company: 'American Express – One DLS Design System',
    role: 'Senior Frontend Engineer (Contract)',
    location: 'Remote, USA',
    start: '2022-11',
    end: '2023-04',
    domain: 'Design System, Financial Services',
    stack: ['React', 'TypeScript', 'Design System', 'Storybook'],
    highlights: [
      'Contributed to One DLS, a React/TypeScript design system underpinning multiple American Express web applications.',
      'Implemented complex cross-product components with clean, composable APIs.',
      'Collaborated with designers and product teams to evolve shared patterns while managing breaking changes responsibly.',
      'Helped teams adopt the system by clarifying usage guidelines, props, and migration paths.',
    ],
  },
  {
    company: 'Intel Corporation – Spark Island / OnePDM',
    role: 'Senior Frontend Engineer (Contract)',
    location: 'Remote, USA',
    start: '2022-05',
    end: '2022-10',
    domain: 'Internal Tools, Engineering Workflows',
    stack: ['React', 'TypeScript', 'REST APIs'],
    highlights: [
      'Built React-based UIs for internal tools that exposed complex manufacturing and product lifecycle data to engineering users.',
      'Implemented table-heavy dashboards and drill-down flows to help engineers make sense of dense datasets quickly.',
      'Worked with backend teams on API contracts and data shapes to keep the frontend performant and maintainable.',
    ],
  },
  {
    company: 'Comoto (RevZilla / Cycle Gear / J&P Cycles)',
    role: 'Senior React Engineer (Contract)',
    location: 'Remote, USA',
    start: '2021-08',
    end: '2021-10',
    domain: 'Ecommerce SPA',
    stack: ['React', 'TypeScript'],
    highlights: [
      'Contributed to a React single-page application serving multiple ecommerce brands.',
      'Implemented and refined product listing, product detail, search, and parts of checkout.',
      'Focused on frontend performance and perceived speed across desktop and mobile.',
    ],
  },
  {
    company: 'Clear Capital',
    role: 'Senior Frontend Engineer',
    location: 'Reno, NV / Remote',
    start: '2019-02',
    end: '2021-02',
    domain:
      'Real Estate Appraisal Management, High-traffic B2B SaaS, Real Estate Valuation',
    stack: ['React', 'Redux', 'TypeScript', 'REST APIs'],
    highlights: [
      'Built and maintained React/Redux SPAs used by lenders and investors to evaluate real-estate risk.',
      'Owned dashboards, queues, filters, and review/approval flows on top of complex model outputs and business rules.',
      'Collaborated with product and backend engineers to design APIs that kept the UI straightforward and responsive.',
      'Wrote unit tests for components and integration tests for key workflows using Jest and React Testing Library.',
    ],
  },
  {
    company: 'Talage Insurance',
    role: 'Senior Software Engineer (Contract)',
    location: 'Remote, USA',
    start: '2018-08',
    end: '2019-01',
    domain: 'B2B SaaS, Insurance',
    stack: ['React', 'Node.js', 'REST APIs'],
    highlights: [
      'Developed React SPAs and Node.js APIs for commercial insurance quoting and policy management.',
      'Acted as a fullstack product engineer for key workflows, owning UI, endpoints, and data model changes.',
      'Designed quoting and policy flows that replaced manual, multi-portal processes with a single opinionated workflow.',
    ],
  },
  {
    company: "Headlands Ventures dba Mike's Bikes",
    role: 'Sole Developer and IT Manager',
    location: 'California, USA',
    start: '2000-01',
    end: '2007-01',
    domain: 'Retail, Multi-Location, Infrastructure and Internal Apps',
    stack: [
      'Linux/Unix',
      'VMware',
      'Rack-mount servers',
      'POS integration',
      'PHP',
      'Web applications',
      'Networking',
      'Phone systems',
    ],
    highlights: [
      'Served as the single point of responsibility for all digital systems across a 12-store regional bicycle retailer.',
      'Built in-house web applications around a legacy POS to handle inventory, inter-store transfers, and service workflows.',
      'Designed and implemented a small data center in the warehouse using VMware and rack servers; standardized networks, WiFi, and hardware across locations.',
      'Owned phone systems, websites, backups, and business continuity planning—ensuring stores could keep operating even during outages.',
      "Helped shift the company from a 'bike shop' mentality to a more sophisticated, tech-enabled operation.",
    ],
  },
  {
    company: 'Broadband Installation Company (Name Redacted)',
    role: 'Team Lead, Broadband Installations',
    location: 'USA (travel-heavy)',
    start: '1990-01',
    end: '2000-01',
    domain: 'Telecom, Broadband Infrastructure',
    stack: ['Networking hardware', 'Broadband equipment', 'On-site integration'],
    highlights: [
      'Flew to client sites as the lead engineer to scope broadband installation projects.',
      'Determined technology choices, integration hurdles, and required team size for successful deployments.',
      'Returned with a team to execute installs, integrating new equipment into existing environments.',
      'Demonstrated end-to-end ownership from discovery through delivery in infrastructure-heavy contexts.',
    ],
  },
] as const

const testingSkills = [
  'Jest',
  'React Testing Library',
  'Cypress',
  'unit tests',
  'integration tests',
  'end-to-end tests',
  'Visual snapshot testing',
  'Accessibility testing',
  'axe (accessibility testing)',
  'Screen reader testing',
  'Section 508 compliance',
  'PHPUnit',
] as const

/** Profile does not define a separate key; these are the a11y-focused items from frontend + testing. */
export const accessibilitySkills = [
  'Semantic HTML',
  'ARIA',
  'WCAG-aware implementation',
  'Accessibility testing',
  'axe (accessibility testing)',
  'Screen reader testing',
  'Section 508 compliance',
] as const

export const resumeSkillGroups = {
  frontend: [
    'React',
    'React Hooks',
    'React Context',
    'React Router',
    'React Redux',
    'TypeScript',
    'JavaScript (ES6+)',
    'HTML5',
    'CSS3/SCSS',
    'CSS-in-JS (MUI, styled-components)',
    'SPA architecture',
    'SSR / Next.js',
    'Gatsby',
    'Routing',
    'State management (Redux)',
    'Responsive design',
    'Dashboards and data-heavy UIs',
    'TailwindCSS',
    'TanStack Start',
    'TanStack Query',
    'SaaS applications',
    'Animation libraries (GSAP / GreenSock)',
    'Semantic HTML',
    'ARIA',
    'WCAG-aware implementation',
    'Accessibility testing',
  ],
  designSystems: [
    'Design systems and component libraries',
    'Design tokens (color, typography, spacing, motion)',
    'Storybook',
    'Figma handoff and design-to-code alignment',
    'USWDS/PGOV',
    'Design system governance and contribution guidelines',
    'Versioning and deprecation strategies (semantic versioning, deprecation paths)',
    'Documentation and adoption support',
    'Monorepos (multi-package design systems)',
    'NPM package publishing',
    'GitHub Actions',
    'GitHub Workflows',
  ],
  accessibility: accessibilitySkills,
  backendAndApis: [
    'Node.js',
    'Express.js',
    'REST API design and integration',
    'REST APIs',
    'GraphQL',
    'Twilio API',
    'Working with SQL-backed systems via API layers',
    'MySQL',
    'PostgreSQL',
    'SQLite',
    'Microsoft SQL Server',
    'MongoDB',
  ],
  aiTools: [
    'Cursor AI',
    'ChatGPT/Claude-style LLMs for coding assistance',
    'AI-assisted test and documentation generation',
    'Prompting and supervising AI output (not blind trust)',
    'Agentic workflows',
    'Prompt engineering',
    'Retrieval-Augmented Generation',
    'MCP (Model Context Protocol)',
  ],
  testing: [...testingSkills],
  infrastructureAndOps: [
    'Linux/Unix (since ~1993)',
    'VMware (virtualization)',
    'Rack-mount servers',
    'On-prem data center setup',
    'LAN/WAN networking',
    'WiFi and router/switch configuration',
    'Phone systems and VoIP',
    'Backups and business continuity planning',
    'CI/CD pipelines',
    'Docker',
    'Vagrant',
    'Ansible',
    'AWS',
  ],
} as const

export const portlandCaseStudyExperience = experience[0]
export const clearCapitalExperience = experience[5]
export const talageExperience = experience[6]

const amex = experience[2]
const intel = experience[3]

/** Contract engagements at Intel and American Express (frog). */
export const frogCombinedCaseStudy = {
  company: 'frog',
  role: 'Senior Frontend Engineer (Contract)',
  clientLine: 'Intel Corporation & American Express',
  start: intel.start,
  end: amex.end,
  domain: `${intel.domain} · ${amex.domain}`,
  stack: Array.from(new Set([...intel.stack, ...amex.stack])),
  highlights: [...intel.highlights, ...amex.highlights] as readonly string[],
} as const

export const stories = {
  portland_design_system: {
    id: 'portland_design_system',
    title: 'React/TypeScript Design System for City of Portland',
    summary:
      'Led a city-wide React/TypeScript design system and component library used in multiple internal and public applications for the City of Portland.',
    takeaways: [
      'Deep experience in design systems and shared UI platforms in a government context.',
      'Understands versioning, deprecation, and migration from a platform perspective.',
      'Uses AI tools to accelerate implementation but maintains human oversight for architecture and UX.',
    ],
  },
  clear_capital_b2b_saas: {
    id: 'clear_capital_b2b_saas',
    title: 'Real Estate Valuation Platform for Lenders and Investors',
    summary:
      'Built and owned core frontend workflows in a B2B SaaS platform for real-estate risk evaluation at Clear Capital.',
    takeaways: [
      'Strong experience in data-heavy, high-stakes UIs (dashboards, queues, review flows).',
      'Used to partnering with product, data, and backend teams on API and UX design.',
      'Understands how UI and models interact in decision-making tools.',
    ],
  },
  ai_output_governance: {
    id: 'ai_output_governance',
    title: 'AI Output Governance and Design System Alignment',
    summary:
      'Explored how design systems can act as a contract/validation layer for AI-generated UI and content, including prototype work and a YouTube series on AI output governance.',
    takeaways: [
      'Thinks deeply about how AI systems integrate with existing product and design constraints.',
      'Understands the need for guardrails, validation, and safe adoption patterns around AI-generated UI.',
      'Comfortable experimenting with agentic workflows while keeping humans in the loop.',
    ],
  },
} as const
