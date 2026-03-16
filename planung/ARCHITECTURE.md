# Systemarchitektur (arc42 light)

## 1. Kontext & Abgrenzung
Das System kommuniziert nicht mit dem Pedal direkt, sondern manipuliert `.prst` Dateien lokal im Browser.

## 2. Bausteinsicht
- **/src/core**: Die "Engine". Reines TypeScript. Beinhaltet den `BinaryParser` und `BufferGenerator`.
- **/src/components**: UI-Komponenten (Radix UI / Headless). Alle Komponenten müssen `Aria-Labels` besitzen.
- **/src/hooks**: State Management für das aktuelle Preset-Modell.
- **/src/i18n**: Konfiguration für Deutsch/Englisch.

## 3. Datenstrukturen (Spec-Driven)
Ein Preset wird intern als JSON-Objekt repräsentiert:
```typescript
interface GP200Preset {
  version: string;
  patchName: string; // Max 12 chars
  effects: EffectSlot[];
  checksum: number;
}
```
