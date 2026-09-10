# Child Data Protection — Design Considerations

**Status:** Considerations only. Nothing here is implemented. To be incorporated into a
future plan.
**Date:** 2026-08-03
**Applies to:** FO's Dream Stories

---

## Why this is foundational, not polish

The product brief files COPPA/GDPR-K under "Plan 6 — Polish + Launch." That is the wrong
place for it. This app collects **voice recordings, drawings and free-text disclosures
from children aged roughly 4–9**, sends them to third-party AI processors, and offers to
publish some of it. Retrofitting compliance onto that after the fact means schema
migrations, deleted data you can't recover, and consent you have to re-ask for.

The decisions below are cheap if made now and expensive if made later.

---

## 1. Which regimes apply

| Regime | Trigger | Consequence |
|---|---|---|
| **GDPR + GDPR-K** | Any EU user. Belgium sets the digital consent age at **13**. | Under-13s require verifiable parental consent for processing. |
| **COPPA** | US launch, users under 13. | Verifiable parental consent, strict disclosure limits, deletion rights. |
| **UK Children's Code** | UK users. | Age-appropriate design duties: privacy by default, no dark patterns. |

Assume all three if launching publicly beyond Belgium. Beta with 100 known families is a
much smaller exposure — a good window to get this right before it scales.

**A DPIA (Data Protection Impact Assessment, GDPR Art. 35) is very likely mandatory
here** — large-scale processing of children's data combined with AI-generated profiling
sits squarely in the "high risk" category. This is a legal obligation, not a nice-to-have.

---

## 2. What personal data this app actually holds

Worth listing explicitly, because it's more sensitive than it first appears:

- Parent: email, password hash, payment data (at subscription stage)
- Child: first name, date of birth / age
- **Child's voice recordings** — a direct identifier, biometric-adjacent
- **Child's drawings, and uploaded photos** — may capture faces, home interiors, EXIF GPS
- **Free-text dream descriptions written or spoken by a child** — children disclose
  anything: their school, street, sibling names, fears
- AI-generated images derived from all of the above
- **Behavioural/session data** — timestamps reveal a household's bedtime routine and
  when a child is alone with a device. Genuinely sensitive; easy to overlook.

---

## 3. Third-party processors

Each needs a Data Processing Agreement in place before real child data flows.

| Processor | Receives | Notes |
|---|---|---|
| OpenAI (Whisper) | Child's raw voice | Pursue **Zero Data Retention** so audio isn't held 30 days |
| OpenAI (GPT-4o Vision) | Child's drawings/photos | Same |
| OpenAI (DALL·E) | Dream description text | Same |
| OpenAI (Moderation) | Dream text before sharing | See §6 — does not detect PII |
| ElevenLabs | Owner's voice only, not the child's | Lower risk |
| Supabase | Everything at rest | DPA + confirm data region |
| Vercel | Request logs — ensure no child content in logs | Scrub logging deliberately |

EU→US transfers need an appropriate mechanism (Data Privacy Framework or SCCs). Worth
checking whether the Supabase project region should be EU rather than `us-west-2`, which
is where it currently sits — moving region later means a full migration.

---

## 4. Data minimisation — concrete decisions to make

These are the highest-leverage choices, and each removes a whole category of risk:

- **Delete raw voice after transcription.** The audio has no further purpose once text
  exists. Transcribe → store text → destroy the recording. Removes the most sensitive
  artefact from the estate permanently.
- **Reconsider photo upload.** In-app finger drawing is safe; camera upload can capture
  faces, siblings, home interiors and GPS EXIF. Strongest option is to drop photo upload
  for child accounts entirely. If kept: strip EXIF on ingest, without exception.
- **Store age band or birth year, not full date of birth.** The app only ever displays
  "age 7". A full DOB is a strong identifier you don't need.
- **Don't log child content.** Dream text and transcripts must never reach application
  logs, error trackers or analytics.

---

## 5. Consent

- Verifiable **parental** consent before any child data is processed — not a checkbox on
  a signup form the child could tick.
- **Granular and separable:** (a) create profile, (b) process voice/drawings through AI,
  (c) publish a dream to the shared gallery. Bundling these is not valid consent.
- **Recorded as data:** who consented, when, to which scope, against which version of the
  policy. Needed to demonstrate compliance later.
- **Withdrawable** at any time, as easily as it was given — withdrawal must trigger the
  deletion path in §7.

Note the flow implication: because the dream is recounted **the next morning**, the
speaker may be the parent recounting on the child's behalf rather than the child. Consent
language and voice handling should cover both cases.

---

## 6. The sharing layer — the highest-risk surface

Publishing a child's first name, age, dream text and image is where real harm could occur.

- **The OpenAI Moderation API does not detect personal-information disclosure.** It flags
  unsafe content, not a child writing "I live in Leuven and go to Sint-Jan school." A
  separate PII scan is required, and it should be treated as advisory rather than
  authoritative.
- **Human approval before anything goes public.** At beta scale (100 families) reviewing
  every shared dream is entirely tractable, and it is the only genuinely reliable control.
- **Consider dropping the real first name.** A chosen dreamer nickname ("Moonfox, age 7")
  keeps the social warmth while removing a direct identifier. This is a small product
  change now and a painful migration later.
- Withdrawal of a shared dream must remove it everywhere, including from any cached or
  CDN-served snapshot.

---

## 7. Retention, deletion and export

- Every child-originated artefact keyed to a profile ID, so "delete this child" is one
  cascade rather than an archaeology project.
- Deletion must reach **Storage objects, not just database rows** — orphaned files in
  buckets are the classic failure here.
- Deletion must reach shared/published copies and any static snapshot.
- Define an inactivity retention policy (e.g. what happens after two dormant years).
- **Export matters emotionally, not just legally.** The map is a diary of a childhood.
  Parents will want it, and GDPR data portability requires it. Building this well is a
  feature, not a burden.

---

## 8. Security

- RLS enforced per family — already in place; it is the core tenant boundary and must
  stay that way through any infrastructure change.
- Raw child inputs in a **private** bucket (`dream-inputs` already is), served only via
  short-lived signed URLs — never public URLs.
- Admin access to child content should be audited: who viewed what, and when.

---

## 9. Age-appropriate design

- Privacy settings default to the most protective option; sharing is opt-in (the brief
  already gets this right).
- **No behavioural advertising, ever.** No third-party ad or analytics SDKs in child-facing
  routes.
- **The "coin mechanic" mentioned in the brief needs care.** Streaks, rewards and
  compulsion loops aimed at under-13s are exactly what the UK Children's Code targets.
- Worth stating positively: the app deliberately ends in darkness and sleep, with no
  engagement hook pulling the child back to the screen. That is a genuinely strong
  age-appropriate design stance and should be documented as an intentional principle —
  see the sleep-flow rule in the project notes.

---

## 10. Artefacts needed before public launch

- [ ] DPIA completed and documented
- [ ] Privacy policy in plain language, plus a child-facing version
- [ ] Terms of service
- [ ] DPAs signed with every processor in §3
- [ ] Record of processing activities (GDPR Art. 30)
- [ ] Parental consent flow implemented and its records queryable
- [ ] Deletion and export paths implemented and tested end to end
- [ ] Data region decision confirmed (currently `us-west-2`)

---

## Open questions for Kobe

1. Launch scope — Belgium/EU only at first, or US too? This decides whether COPPA applies.
2. Keep photo upload, or in-app drawing only?
3. Real first name in the shared gallery, or a dreamer nickname?
4. Is a formal DPIA something you want to run yourself, or with legal help?
