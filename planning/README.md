# EventFinder Planning Documentation

This directory contains comprehensive planning documentation for the EventFinder project.

## Documents

### 📋 [overview.md](overview.md)
**The Vision** - High-level project overview, problem statement, solution approach, use cases, and success criteria.

**Read this first** to understand what EventFinder is and why it exists.

### 📝 [requirements.md](requirements.md)
**What We're Building** - Detailed functional and non-functional requirements, user stories, and acceptance criteria.

**Use this** as the source of truth for features and capabilities.

### 🏗️ [technical-design.md](technical-design.md)
**How We're Building It** - Architecture diagrams, data models, database schema, tech stack, workflows, and implementation details.

**Use this** as the technical blueprint for development.

### ❓ [questions.md](questions.md)
**Open Questions & Decisions** - Critical decisions needed, technical uncertainties, UX questions, and research topics.

**Use this** to track what needs to be decided and guide design discussions.

### 🗓️ [workplan.md](workplan.md)
**Implementation Roadmap** - Phased development plan, task breakdown, milestones, testing strategy, and progress tracking.

**Use this** to guide day-to-day development work.

## Reading Order

**For new contributors:**
1. Start with `overview.md` to understand the vision
2. Skim `requirements.md` to see what we're building
3. Skim `workplan.md` to understand the phases
4. Reference `technical-design.md` when implementing

**For implementers:**
1. Check `workplan.md` for current phase and tasks
2. Reference `technical-design.md` for implementation details
3. Check `questions.md` for open decisions
4. Update `requirements.md` if scope changes

**For decision-makers:**
1. Review `questions.md` for pending decisions
2. Check `requirements.md` for MVP scope
3. Review `overview.md` for alignment with vision

## Current Status

**Phase**: Phase 0 (Foundation) ✅ Complete

**Next**: Phase 1 (Manual Event Discovery)

**See**: [workplan.md](workplan.md) for detailed next steps

## Key Decisions

### ✅ Confirmed
- SQLite for data storage
- Email digest with iCal attachments
- LLM-assisted event parsing
- Slash commands for configuration
- Phased rollout (manual → automated)

### ⏳ Pending
- Scheduling approach (manual vs automated for V1)
- Scraping vs APIs (start with RSS, add APIs later)
- Timezone handling (store IANA timezone with events)

**See**: [questions.md](questions.md#decisions-log) for full list

## Quick Links

**Implementation Starting Point**: [workplan.md - Phase 1.1: Database Setup](workplan.md#11-database-setup)

**Technical Reference**: [technical-design.md - Database Schema](technical-design.md#database-schema-sqlite)

**Requirements Lookup**: [requirements.md - FR1: Source Management](requirements.md#fr1-source-management)

## Updates

**2025-10-07**: Initial planning documents created
- All 5 planning docs complete
- Phase 0 foundation ready
- Phase 1 ready to start

---

*These documents are living and should be updated as the project evolves.*
