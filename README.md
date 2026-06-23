# SimplyCollege

Explore real college applicant profiles, acceptance patterns, and school statistics. Built as an honest alternative to "chance me" posts — every number shows its sample size, and unreliable rates are flagged with a confidence interval.

**Live:** [simplycollege.onrender.com](https://simplycollege.onrender.com)

---

## Table of Contents

- [Quick Start](#quick-start)
- [How the App Is Laid Out](#how-the-app-is-laid-out)
- [Features](#features)
  - [Dashboard](#dashboard)
  - [Browser](#browser)
  - [Patterns](#patterns) 
  - [Schools](#schools)
  - [Demographics](#demographics)
  - [Archetypes](#archetypes)
  - [Find Similar](#find-similar)
  - [Saved](#saved)
  - [Filters](#filters)
  - [Themes](#themes)
- [Reading the Numbers Honestly](#reading-the-numbers-honestly)
- [Data Disclaimer](#data-disclaimer)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)

---

## Quick Start

```bash
# 1. Backend dependencies
pip install -r requirements.txt

# 2. Build the frontend
cd collegebase-frontend && npm install && npm run build && cd ..

# 3. Run the server (serves the API and the built frontend together)
uvicorn main:app --reload
```

Then open [http://127.0.0.1:8000](http://127.0.0.1:8000).

For frontend development with hot reload, also run `npm run dev` inside `collegebase-frontend/` and visit the Vite dev server (it proxies API calls to the FastAPI backend). API docs are auto-generated at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

---

## How the App Is Laid Out

Every page is wired to a **global filter sidebar**. Whatever you set there — GPA range, STEM-only, a specific major or school — narrows the pool that *every* page works from. So if the Dashboard, Patterns, Schools, and Archetypes all look different after you change a filter, that's expected: they're all recomputing against your current slice of the data.

A few conventions repeat everywhere:

- **Tier** means selectivity bracket: **T5** (top 5 schools), **T10**, **T20**, **T50**. "T20 acceptance rate" = the share of a group that got into *at least one* top-20 school.
- **n** is the sample size behind any rate. Anything with **n < 15** is flagged as unreliable (⚠, greyed, or hatched) because a percentage from a handful of people is noise.
- **Wilson 95% CI** is the confidence interval shown next to rates — the plausible range the true rate could be in. Wide interval = don't trust the headline number.
- **SAT equivalent** normalizes ACT scores onto the SAT scale so everyone is comparable on one axis.

---

## Features

### Dashboard

The landing page. A high-level summary of every profile in your current filtered slice.

**What's on it:**

- **Key metrics** — total profiles, mean GPA, mean SAT, STEM share, test-optional share.
- **Acceptance rates by tier** — T5 / T10 / T20 / T50, each split three ways (All / STEM / Non-STEM). Every rate is a `SampleBadge`: the percentage, the sample size `n`, and a Wilson 95% confidence interval.
- **STEM vs Non-STEM bar chart** — visual comparison of acceptance rates per tier.
- **GPA vs SAT scatter** — every applicant as a dot, color-coded by STEM/Non-STEM, T20 acceptances highlighted. **Click any dot** to open that applicant's full profile in the slide-out drawer.
- **EC count distribution** — an area chart of how many extracurriculars applicants typically report.
- **Correlation matrix** — a 5×5 Pearson grid (GPA, SAT, APs, ECs, Awards) colored red → yellow → green. Each cell is how strongly two stats move together (+1 = move together, 0 = unrelated, −1 = move opposite).

**How to use it:** Start here to get a feel for the dataset before drilling in. The correlation matrix tells you which stats actually travel together in this population — if GPA and awards are strongly correlated but SAT and ECs aren't, that says something about *who posts*. Toggle **STEM only** in the sidebar and watch the whole page re-compute to see how the STEM picture differs from the non-STEM one.

---

### Browser

A paginated, sortable, searchable table of every applicant matching your filters. This is the raw "show me the actual people" view.

**What's on it:**

- **Columns** — ID, GPA (falls back to *weighted* GPA if unweighted is missing, marked with `*`), SAT equivalent, majors, STEM flag, EC count, award count, acceptances, and T20/T5 badges.
- **Search** — instant client-side filter by major, school, EC category, or applicant ID.
- **Sort** — click any column header to sort ascending/descending.
- **Pagination** — 50 profiles per page with Previous/Next.
- **CSV export** — download the current filtered + sorted view to do your own analysis in a spreadsheet.
- **Profile drawer** — click any row to open the full applicant detail panel.

**How to use it:** Narrow the sidebar to a group you care about (say, STEM with GPA 3.7+), then browse who's actually in that pool. Sort by SAT to see the spread. Search a school name to find everyone who got in there. Most of the other pages give you *aggregate* rates — this is where you go to read the individual stories behind those rates.

---

### Patterns

The analytical core of the app. It breaks acceptance rates down across academics, activities, and "adjusted" impact, organized into three sub-tabs so it doesn't become a wall of charts. A **tier selector (T5 / T10 / T20 / T50)** sits at the top and re-scopes everything below it.

#### Academics tab

- **By GPA range** — acceptance rate per GPA bucket, as a bar chart. Greyed bars are unreliable (n < 15).
- **By SAT range** — the same, by SAT-equivalent bucket.
- **GPA × SAT heatmap** — the marquee feature. See the deep dive below.

#### Activities & Awards tab

- **By EC category** — which *types* of extracurriculars correlate with higher acceptance. Click a row to jump to the Browser filtered to that category.
- **By award category** — same analysis for award types.
- **EC count impact** — acceptance rate by number of ECs (1-3, 4-6, 7-9, 10-12, 13+), with the average GPA and SAT of each bucket so you can see whether "more ECs" people are also just stronger academically. Answers "does more always mean better?"
- **Award count impact** — the same breakdown by number of awards (0-1, 2-3, 4-5, 6-7, 8+).

#### Adjusted Impact tab

- **EC impact, adjusted for GPA + SAT** — the honest version of "do ECs matter." It computes an **adjusted boost** in percentage points: how much more (or less) likely acceptance was *after accounting for academic strength*. A positive boost means that EC category added value beyond what the applicant's stats already predicted; a negative one means people in it underperformed their stats. This strips out the confound that strong-stat applicants also tend to have stronger ECs.
- **Award impact, adjusted for GPA + SAT** — the same adjustment for award categories.

**How to use it:** Pick the tier you actually care about first — the tradeoffs look completely different at T5 vs T50. Use the Academics tab for the stat questions, the Activities tab to see which EC/award *types* show up in accepted profiles, and the Adjusted tab to separate "this EC matters" from "strong applicants happen to do this EC." Any clickable rate drops you into the Browser filtered to that exact group so you can read the real profiles behind the number.

---

#### GPA × SAT Heatmap — Deep Dive

This is the single most useful chart for the question everyone actually has: **does GPA or SAT matter more, and can a high one make up for a low one?**

**How it's built.** It's a 4×4 grid. **GPA increases left → right** across the columns; **SAT increases bottom → top** down the rows (high SAT is at the top). Each of the 16 cells is one GPA/SAT combination, and the number in it is the acceptance rate (for the tier you've selected) of the applicants who fall in that band.

| | GPA &lt; 3.4 | 3.4–3.7 | 3.7–3.9 | 3.9–4.0 |
|---|---|---|---|---|
| **SAT 1550+** | … | … | … | … |
| **SAT 1450–1550** | … | … | … | … |
| **SAT 1300–1450** | … | … | … | … |
| **SAT &lt; 1300** | … | … | … | … |

- **Color/darkness = acceptance rate**, scaled to the strongest *reliable* cell. This is deliberate: because T5 rates are low everywhere and T50 rates are high everywhere, scaling to the max reliable cell keeps the contrast readable at every tier. Darker = higher rate.
- **Cells with n < 15 are hatched** and don't get a color fill — there simply aren't enough people in that corner of the grid to trust the rate. Empty bands show a `—`.
- **Hover any cell** for its exact sample size and Wilson 95% confidence interval.

**How to read it — the three moves:**

1. **Read DOWN a column (GPA fixed, SAT changing).** This isolates the effect of SAT. Pick the column for your GPA, then look at how the rate climbs or stalls as you go from the bottom (low SAT) to the top (high SAT). If the cells get much darker going up, **SAT is doing real work** at your GPA level. If they barely change, your SAT isn't the lever — more points won't move your odds much.

2. **Read ACROSS a row (SAT fixed, GPA changing).** This isolates GPA. Pick the row for your SAT and scan left → right. A steep brightening means **GPA is the binding constraint** at your score; a flat row means GPA isn't what's separating people there.

   > Comparing how steeply the grid changes *vertically* vs *horizontally* is the direct answer to **"which matters more for me?"** Steeper down the column → SAT matters more in your range. Steeper across the row → GPA matters more.

3. **Compare across the DIAGONAL (the compensation question).** This is the "can a high SAT cover a lower GPA?" test. Compare a **lopsided** cell (e.g. lower GPA 3.5 / very high SAT 1580) against a **balanced** cell (e.g. 3.7 GPA / 1500 SAT). If the high-SAT-low-GPA cell is just as dark, the SAT *did* compensate. If it's noticeably lighter, the lower GPA capped the outcome no matter how high the SAT went — i.e. the stat you're weak in is a floor that a strong second stat can't fully lift.

**A worked example of the question you asked:**
- You have a **3.6 GPA and a 1560 SAT** (high SAT, mid GPA). Find the cell at column `3.4–3.7`, row `1550+`.
- Compare it to the **balanced** cell next door: column `3.7–3.9`, row `1450–1550` (a 3.8 / 1500 type).
- If your high-SAT cell is **darker or equal**, then yes — in this dataset, a top SAT compensated for the softer GPA at this tier.
- If it's **lighter**, the lower GPA was the limiting factor and the extra SAT points didn't fully buy it back.
- Then switch the **tier selector** to a different bracket. The compensation story usually changes: a high SAT covers more ground at T50 than at T5, where almost every cell is near-uniformly hard.

**Caveats baked into reading it:** always glance at `n` before trusting a cell — a single dark corner with n = 6 is hatched for a reason. And remember the whole grid only knows GPA and SAT; the applicant in the "should've gotten rejected" cell who got in almost certainly had ECs, essays, or context the grid can't see.

---

### Schools

Every school that appears in the dataset gets its own stats, built from who reported applying to it.

**What's on it:**

- **Bar chart** — the top 20 most-reported schools, stacked accepted (green) / rejected (red).
- **Sortable table** — all schools with acceptance rate, average GPA/SAT/ECs of *accepted* applicants, and STEM share. Schools with n < 15 are dimmed as unreliable.
- **School popup** — click any row to open it:
  - Stats summary with a Wilson 95% CI on the acceptance rate.
  - A scrollable **Accepted** list (green header) and a scrollable **Rejected** list (red header).
  - Click any applicant in either list to open their full profile drawer.
- **Comparison mode** — check up to 4 schools to see them side-by-side; best/worst values per row are highlighted green/red.
- **Search** — filter the school list by name.

**How to use it:** Find a school, open it, and actually look at the accepted vs rejected pools side by side. The most useful insight is often how *similar* the two pools are — when the accepted and rejected stats nearly overlap, it tells you the decision came down to things outside the numbers (essays, fit, context). Use comparison mode on two similar-tier schools to spot whether one leans toward higher GPAs while the other rewards activities. Note: average accepted GPA/SAT for *less* selective schools runs inflated here (see the [Data Disclaimer](#data-disclaimer)).

---

### Demographics

Acceptance-rate breakdowns by demographic category, each with sample size and confidence intervals.

**What's on it:**

- **By race** — shown two ways: **raw** (exactly as reported) and **grouped** (normalized into broader buckets like East Asian, South Asian, White, Black, Hispanic/Latino, Middle Eastern, Native American, Multiracial, Other).
- **By gender** — Male / Female / Non-binary / Unknown rates per tier.
- **By test policy** — test-optional vs submitted-scores comparison.
- Each row shows average GPA, average SAT, sample size, and Wilson 95% CIs, with tier rates drawn as horizontal colored bars for quick scanning.

**How to use it:** Compare *relative* differences between groups rather than reading any single rate as ground truth. The grouped view is more stable than the raw view because it pools tiny categories into reliable ones. Always keep the convenience-sample caveat front of mind here — these reflect who posts on r/collegeresults, not national applicant pools.

---

### Archetypes

Classifies every profile by its strongest trait. Stats are first normalized so the four dimensions are comparable (**10 ECs ≈ 5 awards ≈ 4.0 GPA ≈ 1600 SAT**), then each applicant is labeled by whichever dimension stands out — unless nothing stands out, in which case they're **Well-Balanced**.

**Two views:**

- **By strongest trait** — GPA-Focused, SAT-Focused, EC-Focused, Award-Focused, Well-Balanced.
- **Grouped** — by academic strength (Elite / Strong / Solid / Developing) and by activity level (Highly active / Active / Moderate / Light).

**Each archetype card shows:**

- A **radar chart** of the archetype's shape across GPA, SAT, ECs, and awards.
- Average GPA, SAT, ECs, awards, STEM %, T5 rate, and T20 rate.
- Top EC categories, award categories, and majors for that group.
- A **member browser** — search by ID or major, sort by SAT/GPA/ECs/awards, and click any member to open their profile drawer.

Cards built on small samples (n < 15) are dimmed with dashed borders and brighten on hover. Everything respects the sidebar filters and recalculates when you change one.

**How to use it:** Figure out which "type" you are, then look at how that archetype performs. If EC-Focused applicants post a higher T20 rate than GPA-Focused ones, that's a real signal in the data — with the honest caveat that EC *count* doesn't capture EC *quality*. Use the in-card member browser to find specific people in your archetype and read their full profiles.

---

### Find Similar

The honest replacement for "chance me." Instead of inventing a probability, it finds the real applicants closest to you and shows what actually happened to them. It uses **K-nearest-neighbors** on GPA, SAT, EC count, and award count (standardized so no single feature dominates the distance).

**Two modes:**

- **By applicant ID** — enter an existing applicant's ID to find their nearest neighbors.
- **Custom profile** — enter your own GPA, SAT, EC count, award count, and STEM flag to find similar real applicants.

**Results include:**

- The **top 5 most similar profiles** with full details.
- **"How applicants like this did"** — a cohort-outcomes panel computed over the **25 nearest neighbors**, showing T5/T10/T20/T50 acceptance rates, each with its sample size and Wilson CI.

**How to use it:** Plug in your stats, then resist fixating on the cohort percentage as a prediction. The real value is **clicking through the individual neighbors** — where did people who look like you actually get in, and what did their ECs and majors look like? The app is explicit that numbers can't capture EC quality, essays, or context, so treat the cohort rate as a *floor among similar-looking applicants*, not a ceiling or a verdict.

---

### Saved

Bookmark applicants and compare them side by side.

- **Save** — click the save button in any profile drawer to bookmark it (stored in your browser's localStorage).
- **Compare table** — side-by-side stats for everyone you've saved.
- **Remove** — unsave profiles you no longer need.
- Persists across sessions in the same browser.

**How to use it:** As you browse, save the profiles that feel like useful comparisons or aspirational targets, then open Saved to line them up against each other.

---

### Filters

A persistent sidebar (collapsible on mobile via the filter icon) whose settings apply to **every page** at once.

- **Numeric ranges** — GPA min/max, SAT min/max.
- **Dropdowns** — accepted tier, major, race/ethnicity, gender, school, EC category, award category. Options are loaded dynamically from the database so they always match the available data.
- **Toggles** — STEM only, test-optional only, hide unreliable samples (globally suppresses any rate with n < 15).
- **Filter chips** — active filters appear as removable chips at the top so you always see what's narrowing your view.
- **Saved presets** — save and reload filter combinations.
- **Debounced** — a 300 ms debounce on every input prevents a flurry of API calls while you type or drag.

**How to use it:** Treat the sidebar as the question you're asking. Set it once, then move between Dashboard / Patterns / Schools / Archetypes to see the *same* slice of applicants from different angles. Turn on **Hide unreliable samples** when you want only the rates you can actually trust.

---

### Themes

Click the theme icon in the top nav to choose from 8 themes plus an auto mode.

| Theme | Style |
|-------|-------|
| Dark | Default — dark gray with indigo accents |
| Midnight | Deep navy with cyan accents |
| Forest | Dark green with emerald accents |
| Rose | Warm dark with pink accents |
| Sunset | Warm dark with amber/orange accents |
| Light | Clean white with indigo accents |
| Nord | Muted arctic palette (light) |
| Lavender | Soft purple (light) |

**Auto** mode follows your system's dark/light preference and switches live when the OS does. All themes are driven by CSS custom properties, so every chart and component adapts automatically.

---

## Reading the Numbers Honestly

Sample-size honesty is the core design principle of this app, not a feature. Every acceptance rate anywhere in the app reports:

- **n** — the number of profiles behind it.
- **A reliable/unreliable flag** — anything with **n < 15** is flagged (⚠), greyed, hatched, or dimmed.
- **A Wilson 95% confidence interval** — the plausible range for the true rate. The Wilson interval stays inside [0, 1] and behaves correctly at small sample sizes, unlike the naive `p ± z√(p(1-p)/n)` formula which can spit out impossible negative or >100% bounds.
- **A "Hide small samples" toggle** — flip it on in the sidebar to suppress every unreliable rate at once.

The app never shows you a bare percentage. If a number doesn't show its `n` and its interval somewhere, it's not a rate you should be acting on.

---

## Data Disclaimer

The profiles here are a **convenience sample** scraped from r/collegeresults — they are **not** representative of the overall applicant population. People who post tend to have stronger profiles and skew toward T20 outcomes. So acceptance rates in this app run **higher than reality**, and demographic breakdowns may not match national trends. Read every number as *"among people who posted,"* never *"among all applicants."*

This bias is **strongest for less selective schools**: their average accepted GPA/SAT looks inflated because the people in the dataset are mostly T20 hopefuls who also happened to apply there. Stats for highly selective schools (T20/T5) are closer to accurate, since that's the crowd that actually posts.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Python, FastAPI, SQLite |
| Frontend | React 19, Vite, Recharts, React Router |
| Similarity | scikit-learn (KNN with StandardScaler) |
| Deployment | Render |
| Data | ~716 real applicant profiles from r/collegeresults |

---

## Project Structure

```
main.py                  # FastAPI API — all endpoints, Wilson CI, KNN, archetypes
db.py                    # Data access layer — all SQL
logic.py                 # Data processing / extraction pipeline
migrate.py               # Builds the SQLite DB from profiles.jsonl
schema.sql               # Database schema
profiles.jsonl           # Raw applicant data
collegebase.db           # Pre-built SQLite database
render.yaml              # Render deployment config
collegebase-frontend/
  src/
    api.js               # API client (relative URLs)
    constants.js         # Shared constants, tier colors, Wilson CI
    utils.js             # useDebounce, usePageTitle, rankClass
    App.jsx              # Routing, theme picker, error boundary
    context/
      FilterContext.jsx  # Global filter state + debouncing
      SavedContext.jsx   # Saved-profile state (localStorage)
    components/
      Sidebar            # Global filter sidebar
      ProfileDrawer      # Slide-out profile detail panel
      SampleBadge        # Rate display with n + CI
      CorrelationMatrix  # 5x5 Pearson correlation grid
      ErrorBoundary      # Route-level crash protection
    pages/
      Dashboard          # Overview stats + charts + correlation matrix
      Browser            # Paginated applicant table + CSV export
      Patterns           # Rate breakdowns + GPA x SAT heatmap
      Schools            # Per-school stats + comparison
      Demographics       # Race/gender/test-policy breakdowns
      Archetypes         # Profile classification + member browsing
      Similar            # KNN search + cohort outcomes
      Saved              # Bookmarked profile comparison
```
