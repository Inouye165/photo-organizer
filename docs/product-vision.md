# Product Vision & Engineering Mandate

## Core Focus
Photo Organizer is a production-grade photo management platform. Today, it scans real local directories, indexes actual files, generates browse-ready variants, and provides a timeline-based review system. The immediate priority is bulletproof file ingestion, transparent scan outcomes, and a highly responsive UI. 

**The "Real Data" Rule:** No mock data, ever. No fake counts, placeholder scans, or invented error states. Everything rendered in the client must be backed by real database and API states.

## Engineering Standards (The "Cloud-Ready" Mandate)
We are building this for the long haul. While the app runs locally today, the architecture must be designed to seamlessly migrate to a public-facing cloud environment (e.g., Google Cloud production standards) without major refactoring.

* **Strict Stack:** 100% strict TypeScript. Type safety is non-negotiable.
* **Modularity:** Decoupled architecture. Frontend, backend, and background workers must have clear boundaries so they can be distributed in the future.
* **Scalability & Performance:** Design APIs and database schemas assuming millions of rows. Build for high concurrency.
* **Testing & Resilience:** Comprehensive testing strategy from day one. Do not fail silently—log and track errors at the file level.
* **Security:** Default to secure practices. Sanitize all inputs, handle file paths safely, and build with future authentication layers in mind.

## Phase 1 Deliverables
* Direct filesystem scanning against configured root directories.
* Durable database indexing for accepted photos and generated variants.
* Resilient, per-file scan error tracking and reporting.
* A gallery view with date filtering and focused inspection overlays.
* Rock-solid UI states (empty, loading, success, error) driven strictly by the backend.

## Future Roadmap
* Cloud migration (storage and compute).
* Metadata-driven and semantic search capabilities.
* User labeling and model training workflows.
* Automated person and animal recognition.