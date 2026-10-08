# Translations

Screens write their English text inline and wrap it in `tr()`:

```tsx
import { tr } from "@/utils/tr";
<Text>{tr("Top up")}</Text>
<Text>{tr("Hello, {{name}}", { name })}</Text>
```

`tr()` looks the text up in the person's language and falls back to the English text,
so a missing translation never shows a raw key. Translations live on the server, in
`backend/src/translations/<lang>.json` under `"ui"`, keyed by a value derived from the
English text (`utils/tr.js` ⇄ `scripts/i18nkeys.py` — these two must stay identical;
`utils/tr.test.ts` guards it).

## Adding or changing a string
1. Wrap it in `tr("…")` in the screen. Text passed through a variable
   (`tr(item.label)`) can't be found automatically — add that English text to
   `scripts/i18n_extra.json`.
2. `python3 scripts/i18n_extract.py` lists every string the app uses.
3. Add the translation to each language file under `"ui"`, using
   `scripts/i18nkeys.py → key_for("English text")` (minus the `ui.` prefix) as the key.
   Any language left without it simply shows English.
4. Redeploy the backend. Phones fetch updated files in the background.

Changing an English string changes its key, so its translations need redoing.

## Needs a native-speaker review
Hausa (`ha`), Yoruba (`yo`), Igbo (`ig`) and Swahili (`sw`) were written without a
native review. Delete any line you're unsure about and that string shows English.

## Not translated yet
Sign-in / sign-up / verification / password screens, the first-launch screen, the
terms and privacy text, the no-network popup, Airbundle plan names and descriptions,
country names, and error messages that come from the server.
