# Naming review follow-up

Reviewed workflow ownership, preview state, running drafts, generation, solver decoding and transport names using the naming-analyzer criteria. This pass makes local names descriptive without changing request fields, persisted keys, exported interfaces or deployed SQL identifiers.

| Previous name | Revised name | Reason |
| --- | --- | --- |
| handles | previewHandles | Identifies the opaque preview metadata map |
| previews | inFlightPreviewsByContext | Explains contents, lifetime and lookup key |
| generation | latestPreviewGeneration | Distinguishes response ordering from match generation |
| pendingCommit | pendingCommitRequest | Holds a frozen request, not a result or boolean |
| commitInFlight | inFlightCommit | Identifies the outstanding operation |
| keyFor | serializeContext | Names the actual transformation |
| pause | waitForRetry | Explains the bounded delay's purpose |
| frozenCopy | createFrozenCopy | Makes allocation explicit |
| latest / owner | latestContextRef / workflowOwnerRef | Identifies reference contents |
| getModule | getOrCreateAssignmentWorkflow | Makes lazy creation visible |
| messages | ASSIGNMENT_ISSUE_MESSAGES | Identifies a constant issue-message lookup |
| inFlight / request | isLegacySaveInFlightRef / legacySaveRequestRef | Distinguishes legacy save state from v2 replay ownership |
| targets | targetsByParticipantId | Describes identity-indexed counts |
| validAssignments | isAssignmentDraftValid | Boolean includes automatic mode, where manual completeness is unnecessary |
| byId | matchesById | Names the map's values |
| cursor / block | poolCursor / pairSharedMatchIds | Identifies allocation positions and pair blocks |
| poolSet | eligibleMatchIds | Identifies membership being validated |
| fail / emptyAssignments | throwAssignmentError / createEmptyAssignments | Names the action and factory behavior |
| retainIfBetter | retainBetterAssignments | Makes the state being retained explicit |
| model / column / value | linearProgram / membershipColumn / membershipValue | Distinguishes model text from decoded solver membership |
| membershipVariable | getMembershipVariableName | Returns a name, not a variable's numeric value |
| args | commitArguments | Identifies RPC commit parameters |

Short callback names were expanded where they obscured participant, assignment or match identity. Existing domain names such as commonMatchId, assignmentPolicyVersion, matchesPerPlayer and targetsByParticipantId remain consistent across contracts. SQL parameter prefixes and mathematical loop indices are conventional in their local context; deployed migration files remain immutable. No database renaming migration is warranted for these local readability changes.
`nValidation: 32 client suites / 275 tests passed; client and Edge typechecks, ESLint and Knip passed. The Deno runtime probe validated the renamed solver/generation code. E2E and Android remain excluded by the user request.
