# Design References

This folder contains design references generated with [Stitch](https://stitch.withgoogle.com/) for the original Sober Juris moodboard. It predates the implemented app; the actual design system now lives in [`DESIGN.md`](../../DESIGN.md) at the repo root, documenting the approved Panel/navbar/mobile-drawer shell.

## Files

| File | Description |
|---|---|
| `DESIGN.md` | Sober Juris moodboard specification (superseded — see the root `DESIGN.md`). |
| `reference/login.png` | Login screen reference. |
| `reference/register.png` | Sign-up / registration screen reference. |
| `reference/dashboard.png` | Main dashboard reference. |
| `reference/settings.png` | Lawyer profile and document settings screen reference. |

## How to Use These References

These images are **visual references only**. They represent the intended look and feel of the application, not a pixel-perfect specification.

Use them to:

- Understand the overall layout and spacing intent for each screen.
- Align component choices (cards, inputs, buttons) with the Sober Juris style.
- Verify that new screens feel consistent with existing ones.

Do **not** use them to:

- Copy exact pixel values — use the token system in the root `DESIGN.md` and `docs/UI_GUIDELINES.md` instead.
- Implement features or UI elements that are not in the current MVP scope (`docs/MVP_SCOPE.md`).
- Override accessibility or contrast requirements in `docs/ACCESSIBILITY.md`.

## Design System

The authoritative design system is documented in the root [`DESIGN.md`](../../DESIGN.md) — it reflects the approved Panel/navbar/mobile-drawer shell, not this folder's original moodboard.

For implementation rules (Tailwind tokens, component guidelines, things to avoid), read `docs/UI_GUIDELINES.md`.
