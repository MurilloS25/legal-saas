> **Superado.** Este documento describe el moodboard inicial ("Sober
> Juris") generado antes de tener una interfaz implementada. La
> especificación autoritativa actual — la que refleja el Panel principal
> aprobado y sus tokens reales (`ink-*`, `accent-*`) — es
> [`DESIGN.md`](../../DESIGN.md) en la raíz del repositorio. Se conserva
> este archivo solo como referencia histórica del moodboard original; no
> usarlo para tomar decisiones visuales nuevas.

---
name: Sober Juris
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#006a61'
  on-secondary: '#ffffff'
  secondary-container: '#86f2e4'
  on-secondary-container: '#006f66'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#00174b'
  on-tertiary-container: '#497cff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#89f5e7'
  secondary-fixed-dim: '#6bd8cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#005049'
  tertiary-fixed: '#dbe1ff'
  tertiary-fixed-dim: '#b4c5ff'
  on-tertiary-fixed: '#00174b'
  on-tertiary-fixed-variant: '#003ea8'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 24px
  margin: 32px
---

## Brand & Style

The design system is anchored in the principles of **Professional Soft SaaS**, prioritizing clarity, legal precision, and a sense of calm authority. It is designed for legal professionals who require a high-focus environment that reduces cognitive load during intensive document review and case management.

The aesthetic blends **Corporate Modernism** with **Minimalist** sensibilities. It avoids the aggressive tropes of traditional "luxury" legal branding (gold foils, heavy serif fonts) in favor of a clean, breathable interface that communicates trustworthiness through meticulous alignment and systematic consistency. The emotional response should be one of stability and efficiency, ensuring the user feels in control of complex information.

## Colors

The palette is dominated by deep Slate tones for structural elements and typography, providing a grounded, sober foundation. A sophisticated Teal is utilized as the primary accent color to draw attention to key actions and active states without introducing visual fatigue.

- **Primary (Slate):** Used for navigation, headers, and primary text to establish authority.
- **Accent (Teal):** Used for primary buttons, selection indicators, and brand-specific highlights.
- **Backgrounds:** A soft off-white (`#F8FAFC`) reduces screen glare, while pure white surfaces indicate interactive or content-heavy containers.
- **Semantic Colors:** Muted but distinct tones for success, warning, and error states, ensuring WCAG AA compliance for contrast and readability.

## Typography

The design system utilizes **Inter** exclusively to ensure maximum legibility across all digital interfaces. The typographic hierarchy is designed with generous line heights (1.5x - 1.6x) to facilitate the reading of dense legal texts.

Headlines use a tighter letter-spacing and heavier weights to create a strong visual anchor, while body text remains neutral and open. Label styles are used for metadata, form headers, and navigation elements, employing a medium or semi-bold weight to distinguish them from editorial content. All scales are tuned to ensure that the transition from desktop to mobile maintains a professional, organized density.

## Layout & Spacing

This design system follows an **8px linear scale** for all spacing and layout decisions. The layout model is a **12-column fluid grid** for desktop environments, transitioning to a 4-column layout for mobile devices.

- **Desktop (1440px+):** 32px side margins with 24px gutters. Content is often contained within card-based layouts to separate distinct workstreams.
- **Tablet (768px - 1024px):** 24px margins, adaptive column widths.
- **Mobile (<768px):** 16px margins. Vertical stacking is mandatory for all complex data components.

Whitespace is treated as a functional tool to group related legal concepts and reduce the perceived complexity of forms and data tables.

## Elevation & Depth

Visual hierarchy is established through **Tonal Layering** supplemented by **Ambient Shadows**. The design system avoids high-contrast shadows to maintain a "soft" SaaS feel.

- **Level 0 (Background):** `#F8FAFC` - The base canvas.
- **Level 1 (Cards/Surface):** White background with a subtle 1px border (`#E2E8F0`). 
- **Level 2 (Floating/Active):** White background with a soft, diffused shadow: `0px 4px 12px rgba(15, 23, 42, 0.05)`. Used for dropdowns, tooltips, and active card states.
- **Level 3 (Modals):** White background with a more pronounced shadow: `0px 12px 32px rgba(15, 23, 42, 0.1)`.

Backdrop blurs (12px) are used behind modals to maintain context while focusing the user's attention on the primary task.

## Shapes

The shape language is consistently **Rounded**, reflecting the "soft" SaaS approach. The base radius of **8px (0.5rem)** is applied to standard components like buttons, input fields, and small cards. 

- **Standard (8px):** Buttons, Inputs, Chips.
- **Large (16px):** Main content cards, Modals, Containers.
- **Full (Pill):** Used exclusively for status badges and tags to distinguish them from interactive buttons.

This moderate roundedness balances the "serious" nature of legal work with a modern, approachable software feel.

## Components

### Buttons
Primary buttons use the Teal accent (`#0D9488`) with white text. Secondary buttons use a Slate border (`#E2E8F0`) with Slate text (`#0F172A`). All buttons feature an 8px radius and a subtle hover transition that deepens the background color by 10%.

### Input Fields
Inputs are defined by a 1px border (`#E2E8F0`). On focus, the border transitions to Teal (`#0D9488`) with a soft teal outer glow. Error states use a red border (`#B91C1C`) with associated helper text below the field.

### Cards
Cards are the primary container for information. They feature a white background, an 8px or 16px radius, and a 1px border. No shadows are used for static cards; shadows are reserved for interactive or elevated elements.

### Chips & Badges
Chips use the "Pill" shape. Status badges (e.g., "Pending," "Signed") use low-saturation background tints from the state colors (e.g., Success background: `#DCFCE7`, text: `#15803D`) to ensure they are visible but not distracting.

### Lists & Data Tables
Tables are high-density but legible. Rows are separated by 1px horizontal lines (`#E2E8F0`). Header rows use a light Slate background (`#F1F5F9`) with semi-bold labels to anchor the data.

### Progress Indicators
Steppers and progress bars use the Teal accent color to indicate completion. Steppers should be used extensively in the design system to break down complex legal filing processes into manageable phases.