# Testing & Quality Assurance

## Unit Testing (Vitest)
- Jede mathematische Operation (z.B. Parameter-Mapping) muss getestet werden.

## E2E Testing (Playwright)
- Test-Skripte müssen in `/tests` liegen.
- **A11y Check:** Nutze `@axe-core/playwright` in jedem Test-Run.

## Programmierrichtlinien
- **Kein `any` Typ.**
- **Zustandsänderungen:** Nur über definierte Actions.
