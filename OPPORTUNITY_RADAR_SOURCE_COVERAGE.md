# Opportunity Radar — Source Coverage

**Verification date:** 2026-11-07
**Method:** real HTTPS fetches through the production collector settings (`redirect: "error"`, bounded body, 8-second timeout, three bounded retries), followed by the real cue filter, classifier and conservative extractor.
**Persistence:** **none.** This run was read-only; Firestore still has zero opportunities and zero source rows.

## Category matrix

| Category | Sources configured | Official | Third-party | Live fetch | Entries seen | Normalized candidates | Persisted | Verdict |
|---|---:|---:|---:|---|---:|---:|---:|---|
| Hackathons | 0 | 0 | 0 | — | 0 | 0 | 0 | **NO SOURCE** |
| Ideathons | 0 | 0 | 0 | — | 0 | 0 | 0 | **NO SOURCE** |
| Innovation challenges | 0 | 0 | 0 | — | 0 | 0 | 0 | **NO SOURCE** |
| Technical competitions | 0 | 0 | 0 | — | 0 | 0 | 0 | **NO SOURCE** |
| Technical events | 0 | 0 | 0 | — | 0 | 0 | 0 | **NO SOURCE** |
| Internships | 0 | 0 | 0 | — | 0 | 0 | 0 | **NO SOURCE** |
| Jobs & recruitment | 2 | 0 | 2 | PASS | 38 | 34 | 0 | **LIVE-VERIFIED ADAPTER, NOT PERSISTED** |
| Research opportunities | 2 | 2 | 0 | PASS | 30 | 9 | 0 | **LIVE-VERIFIED ADAPTER, NOT PERSISTED** |
| Startup & entrepreneurship | 0 | 0 | 0 | — | 0 | 0 | 0 | **NO SOURCE** |

**Coverage: 2 of 9 categories have a configured, reachable source. 0 of 9 have persisted data. Seven categories have no approved source.**

## Configured sources

| Source | Category | Type | URL | Live result | Notes |
|---|---|---|---|---|---|
| NASA Learning Resources | Research | Official | `https://www.nasa.gov/learning-resources/feed/` | HTTP 200; 10 entries; 3 candidates | Official feed; facts remain unverified |
| Innovate UK Activity | Research | Official | `https://www.gov.uk/government/organisations/innovate-uk.atom` | HTTP 200; 20 entries; 6 candidates | Official GOV.UK Atom; geography never inferred |
| We Work Remotely — Programming Jobs | Employment | Third-party | `https://weworkremotely.com/categories/remote-programming-jobs.rss` | HTTP 200; 25 entries; 24 candidates | Job board; employer/role not officially verified |
| Remotive Remote Jobs | Employment | Third-party | `https://remotive.com/remote-jobs/feed` | HTTP 200; 13 entries; 10 candidates | Job board; not treated as official verification |

Totals: **68 entries, 43 normalized candidates, 0 persisted.**

## Rejected or unavailable candidates

These were checked and not added because they were unavailable, redirected, blocked, non-feed HTML, or had no confirmed relevant free feed:

- Devpost software/hackathon RSS: 404/406.
- MLH events RSS: 404.
- F6S RSS: 405.
- HeroX feeds: 404.
- Internshala RSS: 404.
- Eventbrite RSS: 404.
- Meetup feed: returns HTML, not a feed.
- Startup India RSS: 404.
- AICTE RSS: no valid response.
- We Work Remotely internships/junior feeds: 301 without a usable feed response.

## Limitations

- The employment feeds contain general remote jobs, not only entry-level/fresher roles. Eligibility must remain unknown until reviewed.
- Job-board entries are third-party reported; the employer page must be reviewed before official verification.
- The extractor only records explicitly stated format, team size, participation and fee; dates, prizes, eligibility and application URLs remain manual.
- No category-specific HTML scraping or API adapter was added. Adding unapproved scraping would violate the access/terms constraint.
- Candidate counts are pre-deduplication and pre-persistence; they are not opportunity counts.

## Required next source work

1. Approve official hackathon feeds or organizer pages with permitted collection (corporate, university, national, international).
2. Approve ideathon and innovation-challenge organizers.
3. Approve cybersecurity/CTF, robotics, electronics, VLSI and embedded competition sources.
4. Approve conference/workshop/developer-event feeds.
5. Approve internship and fellowship sources, preferably official company/university pages.
6. Approve incubator/accelerator and startup-challenge sources.
7. Add each only after a live fetch, relevance review and terms check; never add guessed URLs to inflate coverage.
