# Projekt-Charter: Valeton GP-200 Web-Editor (Inoffiziell)

## 🎯 Vision
Eine hochperformante, barrierefreie Web-Applikation zum Dekodieren, Bearbeiten und Teilen von Valeton GP-200 Presets (`.prst`).

## 🛠 Tech Stack (Festgelegt)
- **Framework:** Next.js 14+ (App Router), TypeScript (Strict)
- **Internationalisierung:** `next-intl` (Standard: DE, EN)
- **Styling:** Tailwind CSS (Focus on High Contrast & A11y)
- **Testing:** Vitest (Unit/Logic), Playwright (E2E & A11y Testing)
- **Architektur:** arc42-orientiert, Domain-Driven Design Ansätze

## 🧩 Kern-Anforderungen
1. **Binary Engine:** Portierung des PRSTDecoders nach TypeScript.
2. **Spec-Driven:** Datenmodelle für Effekte müssen validierbar sein (Zod).
3. **Barrierefreiheit (A11y):** WCAG 2.1 AA Konformität. Screenreader-Support für Parameteränderungen.
4. **i18n:** Alle UI-Strings in `messages/de.json` und `messages/en.json`.
5. **Testability:** Jede interaktive Komponente benötigt `data-testid` für Playwright.

## 📜 Arbeitsanweisung für die KI
- Arbeite nach dem **TDD-Prinzip** (Test-Driven Development).
- Erstelle für neue Features erst die **Spezifikation**, dann die **Tests**, dann den **Code**.
- Dokumentiere Architekturentscheidungen sofort in der `ARCHITECTURE.md`.
