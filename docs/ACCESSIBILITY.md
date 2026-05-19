# Accessibility

## Standard

Build toward WCAG 2.2 AA-aligned behavior for core workflows. Accessibility is part of feature acceptance, not a later polish pass.

## Forms

- Every input needs a persistent, programmatic label.
- Required fields must be indicated in text, not color alone.
- Validation messages must identify the field and the fix.
- Errors should be announced to assistive technology where practical.
- Use appropriate input types, autocomplete attributes, and descriptions.

## Keyboard Navigation

- All interactive controls must be reachable by keyboard.
- Focus order must match the visual workflow.
- Focus must be visible.
- Dialogs and menus must manage focus intentionally.

## Visual Design

- Maintain sufficient color contrast.
- Do not rely on color alone to communicate state.
- Keep text readable at common browser zoom levels.
- Avoid text overlap and layout shifts in form-heavy screens.

## TODO

- Add component-level accessibility checks when UI primitives are introduced.
- Add Playwright accessibility smoke checks for critical flows.
- Define Spanish-language error message conventions.
