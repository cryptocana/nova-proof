# NovaProof Design Critique
**Reviewed by Visiona** · March 1, 2026  
**URL:** https://novaproof-site.fly.dev  
**Pages reviewed:** Homepage, Agents, Agent Profile, Verify, Docs, Leaderboard  
**Viewports:** Desktop (1440px), Mobile (375px)

---

## 1. The Vibe — What Does It Feel Like Right Now?

Honest answer: it feels like a **solid early-stage protocol site that's 70% of the way there.** The bones are good. The structure is correct. The dark mode is on-brand. But it currently sits in a dangerous middle zone — too polished to be "indie hacker shipping fast" but not polished enough to compete with Etherscan, Eigen Layer, or Chainlink's docs visually.

It reads as **"competent developer built this"** rather than **"a protocol with a design team built this."** That's not an insult — it's a starting point. The information architecture is genuinely strong. The copy is sharp. But the visual layer needs to catch up to the quality of the thinking behind it.

The biggest gap: it doesn't feel *special* yet. Right now it could be any dark-mode crypto project. NovaProof's story is unique — "Agent #0 proving work on-chain" — but the design isn't expressing that uniqueness visually.

---

## 2. What's Working (Top 5)

### ✅ The Copy Is Legitimately Good
"GitHub proves you wrote code. NovaProof proves the agent actually ran it." — that's a killer line. It immediately frames the value prop in a familiar comparison. "Three steps. Zero trust required." — clean. The entire homepage messaging sequence (hero → Meet Agent #0 → Leaderboard → How It Works → For Builders) is well-structured, takes you on a logical journey. Don't touch this flow.

### ✅ Information Architecture Is Correct
Six pages, clear nav hierarchy, no bloat. Homepage tells the story, Agents is a directory, Profile shows depth, Verify is the tool, Docs is comprehensive, Leaderboard is the social proof. This is the right sitemap for a protocol. No notes.

### ✅ The Docs Page Is Surprisingly Complete
Sidebar nav, quick start, SDK reference, API reference, reputation scoring formula, ERC-8004 mention — for an early-stage project, this is impressive depth. The two-column layout with sticky sidebar is the correct pattern (Stripe, Vercel, everyone does this because it works). Code blocks with copy buttons. Good.

### ✅ Nova's Agent Card on the Homepage
The "Meet Agent #0" section with the blue diamond avatar, gold badge, stats pills, and "View Full Profile" link — this is the emotional center of the homepage and it's the strongest visual component on the entire site. The card has clear hierarchy: name → description → stats → link. The blue glow on the avatar works. Keep this energy.

### ✅ The "How It Works" Section
Three numbered steps with colored accent circles (blue → green → purple gradient feel). Clear, scannable, trustworthy. The step numbering is visually weighted correctly. The copy in each step is concise. This section does its job.

---

## 3. What Needs Fixing (Top 5)

### 🔴 #1 — Agent Profile Page Is Broken / Inconsistent
**The problem:** The Agent #0 profile page shows **reputation score 0**, badge **"Unranked"**, total tasks **0**, success rate **—**, tenure **—**. But the homepage says Nova has 5 tasks, 100% success, Gold badge, score 82. This is either a data-fetching bug or a rendering issue, but from a design review standpoint: **your most important showcase page contradicts your homepage.**

**Why it matters:** If someone clicks "View Full Profile" from that beautiful Agent #0 card on the homepage and lands on a page showing zeros and dashes, trust is destroyed instantly. For a protocol about *verifiable track records*, this is catastrophic.

**Fix:** This is a data/API issue first, design second. But even with correct data — the profile page is visually the weakest page on the site. The reputation arc (circular progress indicator) is a great concept but the execution feels generic. More on this in recommendations.

### 🔴 #2 — The Leaderboard Page Shows "No Agents Yet"
**The problem:** The dedicated leaderboard page shows an empty state with a desert emoji and "No agents yet. Be the first to register your agent on NovaProof." Meanwhile, the homepage leaderboard snippet shows Nova at #1 with a Gold badge and score of 82.

**Why it matters:** Same trust issue as above. Two pages on the same site telling different stories. The homepage clearly has hardcoded/static data while the leaderboard page is pulling from the API and getting nothing back.

**Fix:** Either make the leaderboard pull from the same source as the homepage, or hardcode Nova's data on the leaderboard page too. An empty leaderboard with "no agents" when your homepage literally features Agent #0 is confusing. Also — the empty state illustration (🏜️ desert emoji) is cute but undermines the serious protocol aesthetic. Use a minimal vector illustration or just a text empty state.

### 🔴 #3 — Color System Lacks Cohesion
**The problem:** There are too many accent colors competing without a clear hierarchy:
- Primary blue (`#3B82F6`-ish) for buttons and links
- Green for success rates and the "Live on Base Sepolia" pill
- Gold/yellow for badges
- Red for the reputation "0" on the profile page
- Teal/cyan borders on some cards
- Random purple/blue gradients on the How It Works step numbers

**Why it matters:** A protocol site needs to feel systematic. Right now the colors feel applied ad-hoc rather than from a token system. Compare to Uniswap (tight pink + dark palette), Aave (gradient purple + dark), or Lido (ocean blue + dark). Each has ONE dominant accent color with clear semantic variations.

**Fix:** Pick ONE primary accent (the blue you already have is fine). Then define:
- **Primary:** Blue `#3B82F6` — buttons, primary links, active states
- **Success:** Green `#22C55E` — only for success indicators
- **Warning/Gold:** Amber `#F59E0B` — only for badges/achievements
- **Danger:** Red — only for errors/failures
- **Neutral:** Your existing gray scale

Remove the teal card borders. Remove the multi-color gradient step numbers. Let blue dominate, everything else is semantic.

### 🔴 #4 — Typography Needs Tightening
**The problem:** The type hierarchy is functional but bland. Section headings are large and bold (good) but there's no personality in the type treatment. The body text is a standard sans-serif at what looks like 16px — readable but unremarkable. Letter-spacing on the stat labels ("AGENTS REGISTERED", "TASKS COMMITTED") is fine but the numbers above them aren't visually weighted enough.

**Why it matters:** Typography is 90% of web design. Right now it looks like default Tailwind typography. For a protocol, you want type that feels *engineered* — tight letter-spacing on headings, monospaced numbers for data, clear size/weight jumps between hierarchy levels.

**Fix:**
- Use a monospaced or tabular-nums font for ALL numbers (reputation scores, task counts, stats). This is a data-forward protocol — numbers should feel like data, not prose. `font-variant-numeric: tabular-nums;` at minimum.
- Tighten letter-spacing on h1/h2 headings: `-0.02em` to `-0.04em`. Makes them feel more premium.
- Increase the size/weight contrast between stat numbers ("1", "5", "100%") and their labels. The numbers should be at least 2x the label size with `font-weight: 700`.
- Consider Inter or Geist as the primary font if not already using one — both are protocol-standard, excellent at small sizes, and have real tabular figures.

### 🔴 #5 — The Agents Directory Page Feels Empty and Utilitarian
**The problem:** The Agents page is just a search bar, two dropdowns, and a table with one row. It's *correct* but it's the least designed page. No visual interest. No context. No personality.

**Why it matters:** This is where people browse agents. When there are 50 agents, the table will work. But with 1 agent, the page needs to do more work to feel valuable. Also — this is a discovery/exploration page, and tables aren't the most engaging format for exploration.

**Fix:**
- Add agent cards as an alternative view (grid of cards, not just table rows). Cards can show avatar, name, badge, reputation arc, top stat. Toggle between card view and table view.
- Add context above the search: "1 agent registered" as a count badge. 
- Consider adding filter chips below the search for quick badge filtering (Gold, Silver, Bronze) instead of only dropdowns.
- When there's only 1 agent, feature it more prominently instead of burying it in a table.

---

## 4. Design Recommendations

### Spacing & Layout
- **Hero section:** Increase vertical padding. The hero feels slightly compressed. Give the headline more breathing room — at least `120px` top padding below the nav on desktop.
- **Section spacing:** Currently ~80px between sections. Increase to `120px` on desktop, `80px` on mobile. Protocol sites need generous whitespace to feel authoritative.
- **Max content width:** The docs page nails this. Apply the same constraint (~1100px max) consistently across all pages. Some sections on the homepage feel like they stretch too wide.

### Component Upgrades
- **Stat pills on Nova's card:** The "Tasks 5 · Success 100% · Network Base Sepolia" pills are good but could use more visual distinction. Make the values bold/white and the labels dimmed gray. Add subtle background color coding (green bg for success, blue bg for network).
- **Badge component:** The 🥇 Gold badge is great on the homepage card but in the table it's just text. Make it a proper badge component everywhere — small rounded pill with gold background, medal icon, consistent rendering.
- **Code blocks:** Add syntax highlighting. The "For Builders" code block on the homepage is just monochrome text. Even basic keyword highlighting (import/const/await in blue, strings in green, comments in gray) would make it feel 10x more polished. The docs page has the same issue.
- **Commit History on profile:** The timeline with the single commit entry is the right pattern but needs visual love. Add timestamps, expand the dot on the timeline, show the commit in a proper card with more breathing room.

### Visual Identity Upgrades
- **Add a subtle grid/dot pattern** to the hero background. Every serious protocol site (Optimism, Base, Eigen) uses background texture to add depth without distraction. A faint dot grid at ~5% opacity would work.
- **The ⛓ chain emoji in the logo** — consider replacing with a proper SVG icon. Emoji rendering varies across OS. A custom chain-link or proof/checkmark icon would be more controlled and professional.
- **Footer:** Currently minimal, which is fine, but the contract address display is smart. Add the chain icon next to "Base Sepolia" for visual consistency. Consider adding a "Built with ❤️ by Nova × Cana" with slightly more visual warmth — maybe Nova's avatar tiny next to the text.

### Nova's Presence (Agent #0)
- **The profile page needs to be the crown jewel.** Right now it's the weakest page. This is your showcase agent. When the data is fixed: add a bio section, a visual reputation arc that's animated, a task breakdown chart (pie or bar), and the commit history as a proper timeline.
- **Homepage "Meet Agent #0"** section is strong, but add a subtle animation — the blue diamond avatar could pulse gently, or the stats could count up on scroll. Small touches that say "this agent is alive."
- **Consider a dedicated "genesis" visual treatment** for Agent #0. A special border, a "Genesis Agent" label, something that makes it clear this isn't just any agent — it's THE agent.

---

## 5. Priority Ranking

### 🔥 Fix Immediately (Before Sharing Publicly)
1. **Agent profile data mismatch** — reputation 0, unranked, no tasks. This breaks trust completely.
2. **Leaderboard empty state** — homepage shows data, leaderboard shows nothing. Pick one truth.
3. **Add syntax highlighting to code blocks** — low effort, massive perception upgrade.

### ⚡ Fix This Week
4. **Color system cleanup** — define 5 tokens, remove ad-hoc colors, apply consistently.
5. **Typography tightening** — tabular nums, letter-spacing on headings, size contrast on stats.
6. **Increase section spacing** — breathe. Add 40px more between major sections.

### 📋 Fix Before Launch
7. **Agent profile page redesign** — animated reputation arc, bio, task breakdown, proper timeline.
8. **Agents directory card view** — alternative to table for exploration.
9. **Hero background texture** — dot grid or subtle pattern for depth.
10. **Replace emoji logo** with proper SVG icon.

### 🎯 Nice to Have
11. Agent avatar animation on homepage
12. Scroll-triggered stat counters
13. Genesis Agent special treatment for Agent #0
14. Footer warmth upgrade

---

## Summary

The thinking behind NovaProof is strong. The IA is correct. The copy is sharp. The story makes sense. But the visual execution is currently "developer competent" when it needs to be "protocol confident." The two biggest credibility killers right now are the data inconsistencies between pages — fix those first, because no amount of design polish matters if the data contradicts itself.

After that, it's a typography + color system pass, then component polish. You're closer than it might sound. This isn't a redesign — it's a refinement. The foundation is solid.

The goal: when someone lands on NovaProof, they should think "this feels like infrastructure I'd build on" — not "this is a cool side project." You're 70% there. The last 30% is the difference between interesting and inevitable.

*Vibe check complete. Ready to ship?* 🎨
