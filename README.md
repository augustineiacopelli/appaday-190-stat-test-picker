# Stat Test Picker | AppADay 190

Stat Test Picker walks you through five plain language questions about your study, covering your goal, outcome type, group count, design, and assumptions, then names the right statistical test with an assumptions checklist, a nonparametric fallback, and a why not note. Claude adds a short student friendly rationale.

Live: https://augustineiacopelli.github.io/appaday-190-stat-test-picker/
Portfolio: https://augustineiacopelli.github.io/appaday/

## How it works

One question card shows at a time, with progress dots that count only the questions that apply to your answers. You choose a goal (compare groups, find a relationship, or compare to a known value), the kind of data in your outcome, and, when comparing groups, how many groups and whether they are independent or paired. The last step checks assumptions. Continuous data asks whether you have at least 30 per group, whether the data look normal, and whether there are extreme outliers. Categorical data asks whether any expected count falls under 5. Ordinal outcomes and paired categorical designs skip that step because the answer does not change the test.

The result card names the test on a teal band, gives a one line rationale, lists its assumptions as a checklist, names the fallback test and when to switch to it, explains why a nearby test is not the right one, and shows your answers as chips. Tapping a chip jumps back to that question. Changing an answer clears every later answer that depended on it, and Back rewinds one step the same way. Copy Result puts a plain text summary on the clipboard, Start Over resets, and an optional toggle remembers your last path on this device.

## Decision rules

`decide(answers)` is a pure function that returns `{ primary, alternative, path, note }`. The rank based test becomes primary when n is under 30 and normality is no or not sure, or whenever there are extreme outliers. Ordinal outcomes always route to the rank based test. When the rank based test wins, `alternative` names the parametric test you would use if the assumptions held.

| Situation | Primary | Alternative or fallback |
| --- | --- | --- |
| Known value, continuous | One-sample t | Wilcoxon signed-rank |
| Known value, ordinal | Wilcoxon signed-rank | |
| Known value, categorical | Chi-square goodness of fit | exact test note when counts are small |
| Two independent, continuous | Welch t | Student t (alt), Mann-Whitney (fallback) |
| Two paired, continuous | Paired t | Wilcoxon signed-rank |
| Three or more independent, continuous | One-way ANOVA | Welch ANOVA (alt), Kruskal-Wallis (fallback) |
| Three or more paired, continuous | Repeated measures ANOVA | Friedman |
| Ordinal comparison | The rank based test for that cell | |
| Independent categorical | Chi-square of independence | Fisher exact for two groups with small counts |
| Two paired categorical | McNemar | |
| Three or more paired categorical | Cochran Q | |
| Relationship, both continuous | Pearson / linear regression | Spearman |
| Relationship, ordinal involved | Spearman | |
| Relationship, both categorical | Chi-square of independence | Fisher exact with small counts |

The 18 tests live in a frozen `TESTS` object. Each carries a name, rationale, assumptions, fallback id, and why not note.

## Claude rationale

The canned rationale renders immediately. If a Claude key is stored in the shared AppADay key ring, the app asks the haiku tier model for a two or three sentence explanation aimed at an intro stats student, with the test fixed as already chosen, and swaps it in with an AI badge. With no key, or on any failure, the card shows the muted line Offline explanation and keeps the canned text. The app never opens the key sheet on its own.

The model comes from the portal's models.js by tier through `getModel('haiku')`, so no model ID lives in this file. `callClaude()` follows the Procedure Scribe reference: it tries `thinking: {type: 'between_tools'}`, falls back to `disabled` and then no thinking field only when a 400 mentions thinking, remembers what worked per model, sends `max_tokens: 1000` with the `anthropic-dangerous-direct-browser-access` header, and reads only text blocks.

## Settings

The gear opens a modal with the AppADay key manager (`AppKeys.mountSettings`) and a session name that is added to copied results. No key ever appears on the main screen. Settings and the remembered path are stored in localStorage inside try/catch.

## Tests

```
node tests/decide.test.js
```

The harness extracts the inline script, runs it without a DOM, walks every reachable answer path through `QUESTIONS` while honoring each `showIf`, and checks `decide()` against an expected map written independently from the planning table. It also validates the data layer and confirms every test is reachable. Current result: 88 reachable paths, 514 checks, all passing.

## Stack

A single self-contained `index.html` with inline CSS and vanilla JavaScript. IBM Plex Sans, Sans Condensed, and Mono load from Google Fonts. The head carries the AppADay home screen icon tags, the Save to Phone manifest and save.js, models.js, and keys.js with data-app 190. Accent #1F7A8C (Educational) with #6FC3D3 for accent text on the dark background.

This is a teaching aid for choosing a test, not a substitute for a statistician or for looking at your data.

Part of AppADay, one complete app shipped every day: https://augustineiacopelli.github.io/appaday/
