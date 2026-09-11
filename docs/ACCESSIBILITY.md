# Accessibility

## Goal

Accessibility is a core product requirement.

This application will include form-heavy workflows for lawyers who need to create templates, fill document data, manage clients, prepare notarial index metadata, and review accounts receivable. These flows must be comfortable, clear, and usable with keyboard and assistive technologies.

The MVP should follow practical WCAG principles from the beginning.

## Accessibility Principles

The application must prioritize:

- Semantic HTML.
- Keyboard navigation.
- Visible focus states.
- Clear labels.
- Clear validation messages.
- Sufficient color contrast.
- Predictable interactions.
- Logical tab order.
- Accessible dialogs, menus, and form controls.
- No reliance on color alone to communicate meaning.

## Forms

Forms are one of the most important accessibility areas in this product.

Every form field must have:

- A visible label.
- A clear purpose.
- A useful placeholder only when helpful.
- A validation message when invalid.
- A clear required/optional state.
- A keyboard-accessible interaction model.

Do not rely only on placeholders as labels.

Required fields should be communicated clearly.

Example:

```txt
Client name *
Identification number *
Email optional
```

## Validation Messages

Validation messages must be:

- Clear.
- Human-readable.
- Located near the field.
- Available to assistive technologies when possible.
- Specific enough to help the user fix the problem.

Bad:

```txt
Invalid value.
```

Good:

```txt
The identification number is required.
```

## Keyboard Navigation

Users must be able to use important flows with the keyboard.

Required behavior:

- Tab moves through fields in a logical order.
- Shift + Tab moves backward.
- Enter submits only when appropriate.
- Escape closes dialogs when appropriate.
- Focus returns to a logical place after closing a modal.
- Custom controls must be keyboard accessible.

Important flows:

- Login.
- Client form.
- Template editor.
- Document generation form.
- Notarial index metadata form.
- Receivable form.

## Focus Management

Focus states must be visible.

Do not remove outlines unless replacing them with an equally visible focus indicator.

Focus must be managed carefully in:

- Modals.
- Dropdowns.
- Popovers.
- Multi-step forms.
- Template variable insertion.
- Document generation flows.

After an action:

- If a modal opens, focus should move into the modal.
- If a modal closes, focus should return to the trigger.
- If a form submission fails, focus should move to the first invalid field or error summary.
- If a page changes, the heading or main content should be reachable predictably.

## Color And Contrast

Text must have enough contrast against its background.

Do not communicate state only with color.

Bad:

```txt
Paid = green
Pending = red
```

Good:

```txt
Paid
Pending
Overdue
```

With visual color as additional support.

## Error Summary

Long forms should consider an error summary at the top.

Example:

```txt
Please fix the following fields:
- Client name is required.
- Identification number is required.
- Amount must be greater than zero.
```

Each error should ideally link or move focus to the related field.

## Dialogs And Modals

Dialogs must:

- Have a clear title.
- Trap focus while open.
- Close with Escape when safe.
- Return focus to the trigger when closed.
- Avoid hiding important content from screen readers incorrectly.
- Avoid opening unexpectedly.

Use accessible primitives when possible.

## Tables

Tables must be used for tabular data.

Tables should have:

- Clear headers.
- Meaningful column names.
- Empty state messages.
- Loading state messages.
- Keyboard-friendly actions.
- Accessible action labels.

Example action labels:

```txt
Edit client Juan Pérez
Delete template Sale Agreement
Mark receivable as paid
```

Avoid action buttons with only icons and no accessible label.

## Template Editor Accessibility

The template editor must be designed carefully.

Requirements:

- Variables must be inserted through keyboard-accessible controls.
- Variable chips/tokens must have readable labels.
- Formatting controls must have accessible labels.
- Required fields must be clear.
- The editor must not trap keyboard users.
- The user must understand whether they are editing text, inserting a variable, or configuring a field.

The template editor should be simpler than Microsoft Word. It should focus on clarity and controlled document generation.

## Document Generation Form

The document generation form should support fast data entry.

Important requirements:

- Logical field order.
- Clear section headings.
- Ability to move through fields with Tab.
- Clear required fields.
- Clear missing-field validation.
- No confusing focus jumps.
- A clearly reachable saved-document review/preview before download; this may
  live in the main completion step rather than a separate step.

## Empty States

Empty states should explain what the user can do next.

Examples:

```txt
No clients yet. Create your first client to reuse their data in documents.
```

```txt
No templates yet. Create a machote to start generating documents.
```

## Loading States

Loading states should communicate progress without blocking unnecessarily.

Avoid infinite spinners without text.

Better:

```txt
Generating Word document...
```

```txt
Saving client...
```

## Content Guidelines

Use clear language.

Avoid overly technical terms in the UI unless the user expects them.

Prefer:

```txt
Create template
Generate document
Prepare index metadata
Mark as paid
```

Avoid:

```txt
Instantiate document schema
Execute metadata generation
```

## Accessibility Checklist For New UI

Before merging new UI, verify:

1. Are all inputs labeled?
2. Can the flow be completed with keyboard only?
3. Is focus visible?
4. Are error messages clear?
5. Is color not the only way to communicate state?
6. Are buttons and icon actions accessible?
7. Are dialogs accessible?
8. Is tab order logical?
9. Are empty/loading states understandable?
10. Does the page use semantic headings?

## TODO

- Choose the accessible component primitives for dialogs, menus, and popovers.
- Define a standard form error component.
- Define a standard empty state component.
- Add accessibility checks to E2E tests after UI exists.
- Decide whether to include automated accessibility testing later.
