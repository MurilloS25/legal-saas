# UI Guidelines

## Design Direction

Style name:

Professional Soft SaaS

The product should feel:

- professional
- soft
- clean
- trustworthy
- calm
- modern
- easy to use for lawyers

The product should not feel:

- flashy
- experimental
- over-designed
- like an old government system
- like a Word clone
- like a marketing landing page inside the app

## Color Palette

Primary / Brand:

- Primary 950: `#0F172A`
- Primary 900: `#111827`
- Primary 800: `#1E293B`
- Primary 700: `#334155`

Accent:

- Accent 700: `#0F766E`
- Accent 600: `#0D9488`
- Accent 100: `#CCFBF1`
- Accent 50: `#F0FDFA`

Background / Surface:

- App background: `#F8FAFC`
- Surface / Card: `#FFFFFF`
- Muted surface: `#F1F5F9`
- Border: `#E2E8F0`

Text:

- Main text: `#0F172A`
- Secondary text: `#475569`
- Muted text: `#64748B`
- Disabled text: `#94A3B8`

States:

- Success: `#15803D`
- Success soft: `#DCFCE7`
- Warning: `#B45309`
- Warning soft: `#FEF3C7`
- Error: `#B91C1C`
- Error soft: `#FEE2E2`
- Info: `#2563EB`
- Info soft: `#DBEAFE`

Focus:

- Focus ring: `#0D9488`

## Component Rules

Cards:

- Use white surfaces.
- Use subtle borders.
- Use soft radius, preferably `rounded-xl`.
- Avoid heavy shadows.
- Use generous spacing.

Buttons:

- Primary buttons use `#0F172A` with white text.
- Primary hover uses `#1E293B`.
- Secondary buttons use white background with `#E2E8F0` border.
- Accent buttons can use `#0F766E` for important positive actions.
- Buttons must support loading/pending states.

Inputs:

- Labels must always be visible.
- Inputs use white background.
- Borders use `#CBD5E1` or `#E2E8F0`.
- Focus state uses `#0D9488`.
- Error text uses `#B91C1C`.
- Error messages must be understandable and not overly technical.

Layout:

- Main app background uses `#F8FAFC`.
- Main content uses white cards.
- Future app layout should use left sidebar + top header + central content.
- Keep screens calm and spacious.
- Do not add fake metrics just to fill space.

Tables:

- Use clean, readable rows.
- Header background can use `#F8FAFC`.
- Borders should be subtle.
- Actions should be clearly placed.
- Avoid dense tables in MVP.

Login/Auth Screens:

- Centered layout.
- White card.
- Clear title and subtitle.
- Minimal distractions.
- Good labels and error states.
- No large illustration required for MVP.

Dashboard:

- Start simple.
- Show only useful actions.
- Prefer cards for quick actions.
- Avoid unnecessary charts in MVP.

Accessibility:

- Maintain readable contrast.
- Normal text should target WCAG AA contrast.
- Interactive states must be visible.
- Inputs must have associated labels.
- Do not rely only on color to communicate errors or status.
- Keyboard navigation should remain usable.

Responsive:

- Mobile-first.
- Forms should work well on small screens.
- Sidebar can become collapsed or hidden on mobile later.
- Cards and tables should avoid horizontal overflow where possible.

Component Usage:

- Use Tailwind CSS.
- Prefer shadcn/ui style components when useful.
- Do not introduce a large component library without approval.
- Keep components simple and reusable.

Things to Avoid:

- Too many colors.
- Heavy shadows.
- Overly rounded playful UI.
- Unnecessary animations.
- Dark luxury legal theme.
- Landing-page style sections inside the app.
- Complex dashboards before real data exists.

## Design References

Visual screen references and the Sober Juris design system specification are in `docs/design/`.

- `docs/design/DESIGN.md` — color tokens, typography scale, spacing, component styles.
- `docs/design/reference/` — PNG mockups for login, register, dashboard, and settings screens.
- `docs/design/README.md` — how to use these references and what constraints apply.

Use these as visual direction, not pixel-perfect specs. MVP scope and accessibility requirements take precedence.

## Inspiration Sources

Use as broad inspiration, not strict copy:

- shadcn/ui Blocks for login, dashboard, sidebar, forms and app structure.
- Tailwind color system for consistent tokens.
- Clean SaaS dashboards for layout inspiration.
- WCAG contrast guidance for readability and accessibility.
