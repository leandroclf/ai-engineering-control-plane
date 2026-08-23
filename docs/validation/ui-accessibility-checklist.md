# UI Accessibility Checklist
Automated checks run axe through Storybook and Playwright where the host runtime supports the configured toolchain.
Manual review is required for WCAG 2.2 AA: keyboard-only completion of core journeys, visible focus, heading order, accessible names, status text independent of colour, reduced motion, screen-reader reading order, zoom/reflow at 200%, contrast and long-content/error/empty states.
The release gate must keep manual review open when automation cannot prove a criterion.
