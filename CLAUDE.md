@AGENTS.md

## Git
- Never push (or commit) with an AI co-author. No `Co-Authored-By` trailers or "Generated with" lines, commits are attributed only to the logged-in account.

## Writing
- Hard rule: absolutely no em dashes (U+2014) anywhere: UI copy, code comments, docs, commit messages, emails. Use commas, colons, periods or parentheses instead.

## Design
- Never use lucide-react or any stock icon library. Icons come only from `src/components/icons.tsx` (bespoke 24px set, 1.4 stroke, dashed "stitch" signature). Add new icons there in the same style.
- Fonts: Libre Caslon Display (`font-display`), Libre Caslon Text (italics, `eyebrow`), Schibsted Grotesk (UI). Don't hardcode families.
- Avoid generic "AI template" tells: no glassmorphism/backdrop-blur, no gradient text, no tracked uppercase eyebrow labels, no pill notification badges, no icon-in-tinted-circle stat cards, no emoji. Prefer editorial layout: hairline rules, strong type hierarchy, ledger-like tables, numbered sections.
- Always custom UI, never native browser controls: dropdowns (`Dropdown`), date pickers (`DatePicker`), checkboxes/radios, colour pickers, file inputs, number spinners and scrollbars are all custom-built in `src/components/ui/`. Never use a bare `<select>`, `type="date"`, native checkbox look or default scrollbar.
- React Bits components live in `src/components/reactbits/` (restyle to our tokens before use).
