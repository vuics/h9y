# Procurement deterministic UI milestones

The chat agent remains available for flexible orchestration. The web workspace
adds deterministic actions in vertical slices, always reusing backend domain
services and permissions.

1. **Card intake and normalization — complete.** Create and edit a procurement
   card, see RFQ invalidation effects, normalize CAS/name through PubChem, and
   inspect the traceable result.
2. **RFQ lifecycle.** Configure supplier-facing requirements, prepare the exact
   bilingual RFQ, preview both languages, regenerate after edits, and explicitly
   approve it. No send action is implied by approval.
3. **Supplier directory and sourcing.** Register suppliers, add capabilities
   and contacts, verify/correct contacts, and select suppliers for one card.
4. **Negotiation activation.** Create assignments from an approved RFQ, choose
   a verified contact and authority, queue outreach, and schedule follow-ups.
5. **Supplier-response operations.** Ingest manual responses/attachments,
   inspect grounded extraction, request clarification, and compare/export
   backend-normalized offers.
6. **Human review and resolution.** Claim/recommend/resolve escalation cases with
   decision authority, audit history, and safe workflow resumption.
7. **Echemi assisted workflow.** Search candidates, prepare an inquiry, preview
   the exact browser payload, approve it, and submit only where deployment policy
   explicitly enables submission.
8. **Bulk card intake.** Upload a substance list in Excel, CSV, Word, PDF or an
   image, review the detected column mapping and the per-row classification,
   correct the mapping, then confirm creation with live progress. Rows missing
   required fields become drafts that cannot produce an RFQ until completed, and
   PubChem resolution runs as a separate cancellable pass.
8. **Communication playbook — complete.** Edit the library of directives, company
   answers and mandatory sentences that shape supplier messages, dry-run what
   would apply, review held drafts, and read the attribution of any message the
   negotiator produced.
9. **Negotiator visibility — complete.** See what the background worker is doing,
   scheduled and stuck, resolve unidentified inbound messages, and read one
   merged conversation timeline of sent messages, unsent drafts and status
   changes.
10. **Learning from edits — complete.** A human rewrite of a draft can be kept as
   a scoped library rule, carrying the composition it was learned from as its
   evidence.
11. **Document import — complete.** Read an RFQ template, commercial letter or
   standard-answer document into grounded proposals, review each against its
   quote from the source, and create only the entries a specialist ticked.
