# Opportunity Radar — product scope alignment

**Status date:** 2026-11-07
**Scope:** Technology Opportunity Discovery, Intelligence and Participation Platform.

This document compares the corrected product scope with the implementation and records what was extended in this pass. It is not a claim that every category has live source coverage.

## 1. What already met the corrected scope

- The opportunity model was already broader than hackathons: category, organizer, description, domains, geography, location, participation format, fee, eligibility, registration/event dates, career pathways, benefits, verification status, lifecycle status, source provenance, evidence, and tracking.
- Discovery, deduplication, lifecycle refresh, profile-based eligibility, explainable scoring, manual field-level verification, and daily digest inclusion were already implemented.
- Official and third-party provenance were already stored separately in `opportunity_source_records` and displayed per source.

## 2. Gaps found

| Area | Gap |
|---|---|
| Taxonomy | `category`, `subcategory` (absent), and domains were free text. No canonical 9-category taxonomy or subcategory model. |
| Classification | Category/domain came only from a source that declared exactly one value; most leads were left unclassified. No keyword-based classification, no multi-domain extraction. |
| Schema | No `subcategory`, `company`, or `institution` fields. |
| Filters | Only search, category, verification, tracking, and sort. Missing domain, format, geography, fee, deadline window, eligibility, and company/institution filtering. |
| Views | No All / Recommended / Closing Soon / Upcoming / Verified / Saved / Applied / Expired-Cancelled views, and no category-level discovery views. |
| Dashboard | Only digest status. No Opportunity Radar summary or category navigation. |
| Source registry | Only three feeds existed in an unapplied Supabase SQL seed. Firestore had no sources, so discovery would run with zero sources. The ESA feed in the old seed now returns HTTP 404. |
| Source coverage | Research/funding only. No approved feeds for hackathons, ideathons, competitions, events, internships, jobs, or startup programmes. |

## 3. Implemented in this pass

### Taxonomy and classification

Added `src/lib/opportunities/taxonomy.ts`:

- Nine canonical categories: hackathons, ideathons, innovation challenges, technical competitions, technical events, internships, jobs & recruitment, research, and startup & entrepreneurship.
- Subcategories for each category (corporate/university/national/international/online/offline/hybrid hackathons; coding/CTF/robotics/VLSI/embedded competitions; conferences/workshops/bootcamps; internships/fellowships; fresher/graduate/campus/off-campus jobs; research grants/competitions; incubators/accelerators/startup challenges; and more).
- Nine technical-domain groups covering AI/ML/GenAI, software, cybersecurity, ECE/VLSI, embedded/IoT/robotics, cloud/DevOps, blockchain, hardware/communications, and interdisciplinary engineering.
- Deterministic keyword classification with source hints as a fallback. Unknown remains `null` rather than being invented.
- Alias normalization so legacy values such as `education`, `funding`, `jobs`, and `computer science` map to canonical values.

### Discovery and persistence

- `entryToCandidate` now classifies each lead's category, subcategory, primary domain, and additional domains.
- Discovery persists `subcategory`, `company`, and `institution`.
- Added `src/lib/opportunities/sources.ts` with a reviewed default registry and idempotent seeding when Firestore has no sources.
- Seeded feeds: NASA Learning Resources (HTTP 200, RSS) and Innovate UK Activity (HTTP 200, Atom). The 404 ESA feed was removed from the defaults.
- No guessed or placeholder feed was added.

### Discovery UI

- Category tabs for all nine categories with counts, plus All.
- Unified views: All Opportunities, Recommended for Me, Closing Soon, Upcoming, Verified, Saved, Applied, Expired / Cancelled.
- Filters for technical domain, format, geography, entry fee, deadline window, eligibility, verification, tracking, and free-text search across title, organizer, company, institution, and domains.
- Cards now show category label, subcategory, company/institution, geography, and canonical domain labels.
- A note surfaces leads that have no category signal instead of forcing them into a category.

### Dashboard

- Added an Opportunity Radar section with counts for all nine categories and quick links to Closing Soon, Upcoming, Verified, Saved, Applied, and Expired / Cancelled views.
- Counts come from the same records as the discovery UI; no sample data is shown.

### Tests

Added `test/opportunity-taxonomy.test.ts` for classification, alias normalization, view derivation, filters, sorting, and category counts. Total suite: 10 suites, 50 tests.

## 4. Remaining gaps and risks

1. **Source coverage is the main limitation.** Only research/funding feeds are approved. Categories such as hackathons, ideathons, competitions, events, internships, jobs, and startup programmes need official (or clearly labelled third-party) feeds before they can populate. Adding a guessed feed would violate the no-fabrication rule.
2. **No live opportunity records yet.** Firestore contains no opportunities, so the new views and filters render empty until discovery runs or records are verified in. No sample records were inserted into production.
3. **Classification is a lead, not a fact.** Category and domain are derived from announcement text and remain pending verification. The UI labels unclassified leads and does not mark classification as verified.
4. **Manual verification is still required** for eligibility, deadlines, fees, and benefits. Automated web verification remains intentionally out of scope.
5. **No operator UI to add or edit a source.** Sources are seeded from reviewed code or managed directly in Firestore.
6. **RSS-only collection.** Sources without RSS/Atom need an approved API or manual entry path.
7. **No saved-search or per-category alert controls** yet; digest inclusion still uses the global opportunity-digest preference and score threshold.
8. **User isolation and live Telegram flows** remain unverified; see the Firebase validation report.

## 5. Validation

- `npm run lint` — pass.
- `npm run typecheck` — pass.
- `npx jest --runInBand` — 10 suites, 50 tests, pass.
- `npm run build` — pass.
- Preview deployment: authenticated `/opportunities` and `/dashboard` returned `200`; category tabs, unified views, extended filters, and dashboard counts rendered.
- Production deployment: alias updated; `/opportunities`, `/dashboard`, and `/settings/opportunities` returned `200` with the new views visible.

## 6. Next increments, in order

1. Approve and add official feeds for the missing categories, verifying each returns a live RSS/Atom document.
2. Run discovery in a controlled environment, review the first records, and verify classification quality.
3. Add an operator source-management view (enable/disable, category hints, health).
4. Add saved-search and per-category notification preferences.
5. Exercise save/apply and two-user isolation against real records.
