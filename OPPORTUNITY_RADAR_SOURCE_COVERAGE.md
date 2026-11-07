# Opportunity Radar — Source Coverage

**Verification date:** 2026-11-07
**Method:** real HTTPS fetches through the production collector settings (`redirect: "error"`, bounded body, 8-second timeout, three bounded retries), followed by the real cue filter, classifier and conservative extractor.
**Persistence:** emulator-verified. Five source collections replayed against an isolated Firestore emulator; the final record set is 56 unique opportunities from 58 source rows across 2 collection runs, with idempotent replay adding 0.

## Category matrix

| Category | Sources configured | Official | Third-party | Live fetch | Entries seen | Normalized candidates | Persisted | Verdict |
|---|---:|---:|---:|---|---:|---:|---:|---|
| Hackathons | 1 | 0 | 1 | PASS | 9 | 9 | 9 | **SOURCE PRESENT, VERIFICATION PENDING** |
| Ideathons | 0 | 0 | 0 | — | 0 | 0 | 0 | **NO SOURCE** |
| Innovation challenges | 0 | 0 | 0 | — | 0 | 0 | 0 | **NO SOURCE** |
| Technical competitions | 1 | 1 | 0 | PASS | 6 | 6 | 6 | **SOURCE PRESENT, VERIFICATION PENDING** |
| Technical events | 0 | 0 | 0 | — | 0 | 0 | 0 | **NO SOURCE** |
| Internships | 0 | 0 | 0 | — | 0 | 0 | 0 | **NO SOURCE** |
| Jobs & recruitment | 2 | 0 | 2 | PASS | 38 | 34 | 32 | **SOURCE PRESENT, VERIFICATION PENDING** |
| Research opportunities | 2 | 2 | 0 | PASS | 30 | 9 | 8 | **SOURCE PRESENT, VERIFICATION PENDING** |
| Startup & entrepreneurship | 0 | 0 | 0 | — | 0 | 0 | 0 | **NO SOURCE** |

**Coverage: 4 of 9 categories have a live, configured source. 5 of 9 have no approved source.**

## Configured sources

| Source | Category | Type | URL | Live result | Normalized | Persisted |
|---|---|---|---|---|---|---|
| NASA Learning Resources | Research | Official | `https://www.nasa.gov/learning-resources/feed/` | HTTP 200; 10 entries; 3 candidates | 3 | 3 |
| Innovate UK Activity | Research | Official | `https://www.gov.uk/government/organisations/innovate-uk.atom` | HTTP 200; 20 entries; 6 candidates | 6 | 6 |
| We Work Remotely — Programming Jobs | Employment | Third-party | `https://weworkremotely.com/categories/remote-programming-jobs.rss` | HTTP 200; 25 entries; 24 candidates | 24 | 22 |
| Remotive Remote Jobs | Employment | Third-party | `https://remotive.com/remote-jobs/feed` | HTTP 200; 13 entries; 10 candidates | 10 | 10 |
| Codeforces API | Technical competitions | Official | `https://codeforces.com/api/contest.list?gym=false` | HTTP 200; 6 upcoming BEFORE contests | 6 | 6 |
| Devpost API | Hackathons | Third-party | `https://devpost.com/api/hackathons?status%5B%5D=open` | HTTP 200; 9 open hackathons | 9 | 9 |

**Totals: 83 entries, 58 normalized candidates, 56 persisted.**

## Rejected or unavailable sources

These were checked and not added because they were unavailable, redirected, blocked, rate-limited, non-feed HTML, or had no confirmed relevant free feed:

- Devpost software/hackathon RSS: 404/406.
- MLH events RSS: 401.
- F6S RSS: 405.
- HeroX feeds: 404.
- Internshala RSS: 404.
- Eventbrite RSS: 404.
- Meetup feed: returns HTML, not a feed.
- Startup India RSS: 404.
- AICTE RSS: no valid response.
- We Work Remotely internships/junior feeds: 301 without a usable feed response.
- CTFtime: 403; confs.tech: 530; Devfolio endpoint: 404.

## Limitations

- The employment feeds contain general remote jobs, not only entry-level/fresher roles. Eligibility must remain unknown until reviewed.
- Job-board and hackathon entries are third-party reported; the employer/organizer page must be reviewed before official verification.
- The extractor only records explicitly stated format, team size, participation and fee; dates, prizes, eligibility and application URLs remain manual.
- No category-specific HTML scraping or API adapter was added for ideathons, innovation challenges, technical events, internships, or startups. Adding unapproved scraping would violate the access/terms constraint.
- Candidate counts are pre-deduplication and pre-persistence; they are not opportunity counts.
- Devpost periods are date-only in the public schema, so `registrationClosesOn` is set from the parsed date; the exact submission time is not evidenced and is not invented.

## Required next source work

1. Approve official hackathon feeds or organizer pages with permitted collection (corporate, university, national, international).
2. Approve ideathon and innovation-challenge organizers.
3. Approve cybersecurity/CTF, robotics, electronics, VLSI and embedded competition sources.
4. Approve conference/workshop/developer-event feeds.
5. Approve internship and fellowship sources, preferably official company/university pages.
6. Approve incubator/accelerator and startup-challenge sources.
7. Add each only after a live fetch, relevance review and terms check; never add guessed URLs to inflate coverage.
