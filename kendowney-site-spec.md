# kendowney.com — Site Spec

## Overview
Personal site for Ken Downey. Not a generic dev portfolio — this is a personal 
site with adventure personality, work showcase, and the Honest Fit Assessment tool.

## Stack
- TanStack Start (React, TypeScript)
- Tailwind CSS
- Deployed as Docker container on the VPS at kendowney.com
- Nginx reverse proxy (already configured for the domain)

## Visual Direction: Desert Noir + Cobalt Blue

### Color Palette
- **Background:** Dark warm tones (#1a1814, #0f0d0b for deeper sections)
- **Surface:** Slightly lighter warm dark (#2a2520, #1e1b17)
- **Primary text:** Warm off-white (#f0e8d8, #e8e0d0)
- **Secondary text:** Muted warm gray (#a09882)
- **Accent:** Cobalt blue (#0047AB) — used for links, hover states, 
  active nav items, CTA buttons, and interactive highlights
- **Accent light:** Lighter cobalt (#2563eb) for hover states on dark backgrounds
- **Accent subtle:** Very subtle cobalt (#0047AB at 10-15% opacity) for 
  background highlights and card hovers
- **Border:** Warm dark borders (#3a3530)
- **Gradient accent:** Subtle cobalt blue gradient on hero accent line 
  (linear-gradient from #0047AB to transparent)

### Typography
- Headings: Inter or system sans-serif, -0.5px letter-spacing, weight 500
- Body: 16px, weight 400, line-height 1.7
- Nav: 12px uppercase, 0.05em letter-spacing
- Code/mono elements: JetBrains Mono or system monospace

### Design Rules
- No gradients on backgrounds (flat surfaces only)
- Cobalt blue as accent only — never as a background fill for large areas
- Tags/pills: 0.5px cobalt border, transparent bg, cobalt text
- Hover states: subtle cobalt glow or border-color transition
- Hero section: full-width, adventure photo background with dark overlay, 
  name and tagline overlaid
- Cards: dark surface (#2a2520), 0.5px border (#3a3530), border-radius 8px
- Active nav item: cobalt blue text, all others warm gray

## Pages

### 1. Home (/)
Hero section with:
- Ken's name (large, warm white)
- Tagline: "Staff frontend engineer building AI-enabled interfaces and 
  autonomous systems. Races motorcycles in Baja. Prospects for gold."
- Tech tags: React, TypeScript, Design Systems, AI Agents
- Background: adventure photo with dark gradient overlay (or solid dark 
  if no photo available initially — can swap in later)
- CTA: "See my work" (cobalt blue button) + "Get in touch" (outline button)

Below the hero:
- 3-4 featured project cards (Second Brain, Design Systems, Tournament, 
  Honest Fit Assessment)
- Brief about section with a personal photo placeholder

### 2. Work (/work)
Project showcase page. Each project gets a card with:
- Project name
- One-line description
- Tech stack tags
- Link to details or external resource

Projects to feature:
- **Second Brain** — Personal OS with autonomous AI agents, tournament system,
  Mission Control dashboard. Stack: TypeScript, Python, FastAPI, Postgres, 
  OpenClaw, TanStack Start
- **Design System Contract Layer** — AI-generated UI validation against 
  design system constraints. Stack: React, TypeScript
- **City of Portland Component Library** — Published production design system 
  packages (@cityofportland/component-library, @cityofportland/design-tokens). 
  Stack: React, TypeScript, Storybook
- **Honest Fit Assessment** — AI-powered job fit analysis tool (link to /honest-fit)
- **Trading Tournament** — Genetic algorithm crypto strategy evolution with 
  Claude-powered bots. Stack: TypeScript, Claude API, Postgres
- **Ken's AI Experiments** — YouTube channel covering AI engineering and 
  design system governance

### 3. Adventures (/adventures)
Photo gallery / highlights page. Instagram-style grid of adventure photos.
Categories: Baja racing, gravel cycling, prospecting, overlanding.
- Photo grid with lightbox on click
- Brief captions
- Can link to Instagram for more
- Placeholder layout if no photos uploaded yet — show the grid structure 
  with placeholder cards that say "Coming soon"

### 4. Honest Fit (/honest-fit)
The Honest Fit Assessment tool. This will be a standalone interactive page.
For now, create the route with a placeholder that describes what it is:
- "AI-powered job fit assessment using hybrid deterministic + LLM reasoning"
- "Coming soon" state with a brief description
- Email capture for "Notify me when it launches"

### 5. Contact (/contact)
Simple contact page:
- Email (mailto link)
- GitHub (https://github.com/mtb24)
- YouTube (Ken's AI Experiments channel)
- LinkedIn (placeholder URL)
- Instagram (placeholder URL)
- Simple contact form (name, email, message) — can be non-functional 
  initially, just the UI

### 6. Resume (/resume)
Experience and skills page:
- Current target: Staff/Senior Frontend Engineer
- Key skills section (React, TypeScript, Next.js, design systems, 
  AI-enabled interfaces, design tokens, Storybook)
- Experience timeline (frog, Clear Capital, Talage, Headlands Ventures, 
  ICF/City of Portland)
- Published packages section
- Download resume link (placeholder)

## Navigation
Top nav bar, fixed, dark background matching the site:
- Logo/name on left: "KD" or "Ken Downey" 
- Nav links right-aligned: Work · Adventures · Honest Fit · Resume · Contact
- Active state: cobalt blue text
- Mobile: hamburger menu

## Deployment
- Dockerfile: Node 22 Alpine, build + serve
- Docker Compose service entry added to ~/brain/docker-compose.yml as 
  "personal-site" (or use existing kendowney.com nginx config)
- Served at kendowney.com (already has Nginx + SSL configured)
- Port: 4174 (next available after mission-control on 4173)

## File Structure
```
/Users/kendowney/Sites/SecondBrain/personal-site/
├── app/
│   ├── routes/
│   │   ├── index.tsx          (home)
│   │   ├── work.tsx           (projects)
│   │   ├── adventures.tsx     (photo gallery)
│   │   ├── honest-fit.tsx     (HFA placeholder)
│   │   ├── resume.tsx         (experience)
│   │   ├── contact.tsx        (contact form)
│   │   └── __root.tsx         (layout + nav)
│   └── styles/
│       └── globals.css        (Tailwind + custom properties)
├── public/
│   └── images/                (photos, placeholder)
├── Dockerfile
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── app.config.ts
```

## Important
- This is a SEPARATE project from mission-control. It gets its own 
  directory under SecondBrain/personal-site/
- Do NOT use SvelteKit. React + TanStack Start only.
- Cobalt blue (#0047AB) is the accent — not the primary. The site 
  should feel dark and warm first, with cobalt as the pop of color.
- Adventure personality should come through — this isn't a sterile 
  corporate portfolio.
