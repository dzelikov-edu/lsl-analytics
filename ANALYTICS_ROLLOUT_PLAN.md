# Analytics Rollout Plan (Draft)

Purpose:
- Defines how to handle the new analytics routes when the season begins.
- Keeps rollout expectations clear before all metrics are fully matured.

---

## Early-Season Operating Plan

### Phase 1: Route is live, but lightly trusted
As soon as games begin, `/analytics/resume` can be live and useful, but it should be treated as:

**“working early signal, still under observation.”**

Goals:
- let it run
- inspect outputs weekly
- do smell tests
- compare rankings against known intuition
- do not overreact to one weird early ordering

---

### Phase 2: Stabilize the core behavior
For the first few weeks, confirm:

- quads are assigned correctly
- tracked vs outside-69 logic is correct
- bad losses hurt enough
- quality wins help enough
- no obviously nonsensical ordering appears

At this stage, the question is not:
- “Is this the perfect final formula?”

The real question is:
- “Is this behaving like the system we intended?”

---

### Phase 3: Add SOS weighting once the core is trustworthy
Once the core Resume route is:

- technically working
- returning correct row structure
- ranking teams in a believable way
- passing smell tests

then add SOS weighting.

Implementation meaning:
- Day 1 / first results: core Resume only is acceptable
- after some real data exists and the route looks sane: add SOS weighting
- continue tuning from there

---

## Weekly Check-In Process

After each new week of results:

1. Open `/analytics/resume?week=<current_week>`
2. Inspect the top 10–15
3. Inspect a few teams you know well
4. Check quad counts and bad-loss counts
5. Note anything that feels off

Questions to ask:
- Did any team beat a Q1 opponent? Did that show correctly?
- Did a team lose to an outside-69 opponent? Did that hurt hard enough?
- Did a soft-schedule undefeated team jump too high?
- Did a strong-schedule team with a respectable record get enough credit?
- Are home / neutral / away classifications acting correctly?

---

## Metric Behavior Expectations

### Power
- more stable early
- priors help reduce noise

### Resume
- more volatile early
- earned-only
- should move with results
- volatility is acceptable if it remains logical

---

## Rule of Thumb

Treat early Resume as:

**live, useful, and under observation**

not as:

**final, fully tuned truth**

---

## Trigger for Adding SOS Weighting

Add SOS weighting once:

- the route works reliably
- the no-games and real-games states both behave correctly
- quad classification is confirmed
- rankings pass repeated smell tests
- output shape is stable

At that point, SOS weighting becomes a refinement layer rather than a rescue mission.