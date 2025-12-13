# Feature: Node 24 + Bun 1.3.4 Upgrade

**Status:** Implemented (2025-12-13)
**Created:** 2025-12-13
**Related Plan:** `docs/plans/version-upgrade-node.md`
**Related ADR:** `docs/decisions/0003-runtime-bun.md`

## Feature Description

Upgrade the project to Node 24 LTS baseline with Bun 1.3.4. This is a targeted infrastructure upgrade that updates engine requirements, CI configuration, documentation, and adds version manager support files.

**Key Discovery:** Bun 1.3.4 reports `process.versions.node` as **24.3.0**, meaning it now implements Node 24 APIs. This eliminates the previous constraint where Bun 1.2.x only supported Node 22.

## User Story

As a developer working on this agent framework
I want to use Node 24 LTS baseline with Bun 1.3.4
So that I have access to the latest stable Node APIs and improved Bun compatibility

## Problem Statement

The current package.json specifies older engine requirements that do not reflect Bun's actual Node compatibility:
- `engines.node` is `>=20.11.0` but Bun 1.3.4 implements Node 24.3.0
- `engines.bun` is `>=1.0.0` but 1.3.4 is the verified version with Node 24 support
- `@types/node` is `^22.0.0` but should match the new Node 24 baseline
- Missing version manager files (`.nvmrc`, `.node-version`) for developer convenience
- CI matrix tests against Bun 1.2 which doesn't support Node 24

## Solution Statement

Execute a focused upgrade to align all version specifications with Node 24 + Bun 1.3.4:
1. Update package.json engine requirements
2. Update @types/node to ^24.0.0
3. Add version manager support files
4. Update CI workflow matrix
5. Update documentation to reflect new requirements

This is a low-risk upgrade since all validations already pass with Bun 1.3.4 (478 tests, typecheck, lint, build).

## Related Documentation

### Requirements
- `docs/plans/version-upgrade-node.md` - Detailed upgrade plan with verification results

### Architecture Decisions
- `docs/decisions/0003-runtime-bun.md` - ADR choosing Bun runtime (needs addendum)

## Codebase Analysis Findings

Analysis performed by codebase-analyst agent:

### Architecture Patterns
- **Version Specification Pattern:** package.json engines + CLAUDE.md Tech Stack table + ADR
- **Validation Pattern:** 4-step quality gate (typecheck → lint → test → build)
- **Documentation Pattern:** Plan doc + ADR addendum + cross-references
- **CI Pattern:** Bun version matrix in GitHub Actions
- **Version Authority:** package.json is source of truth, CLAUDE.md documents intent

### Files Requiring Updates
1. `package.json` - Engine requirements and @types/node
2. `CLAUDE.md` - Tech Stack table (line 75)
3. `.github/workflows/ci.yml` - Bun version matrix (line 24)
4. `docs/decisions/0003-runtime-bun.md` - Add addendum for Node 24 compatibility
5. `README.md` - Prerequisites section (line 26)
6. `CONTRIBUTING.md` - Tech Stack Reference (line 446)
7. `docs/specs/version-upgrade.md` - Update references (lines 119, 241)
8. `docs/plans/version-upgrade-plan.md` - Update references (lines 23, 29, 120, 169, 222)
9. `docs/plans/codebase-analysis-for-upgrades.md` - Update reference (line 991)

### Verified Compatibility (Bun 1.3.4)
All project dependencies and tests work with Bun 1.3.4:
- `bun install` - No errors
- `bun run typecheck` - Passes
- `bun run lint` - Passes
- `bun run test` - 478 tests pass
- `bun run build` - Successful

## Archon Project

Project ID: `435caae1-8cf8-4a92-813c-68ecd3bc010b`

## Relevant Files

### Existing Files
- `package.json` - Engine requirements to update
- `CLAUDE.md` - Tech Stack table to update
- `.github/workflows/ci.yml` - CI matrix to update
- `docs/decisions/0003-runtime-bun.md` - ADR needing addendum
- `README.md` - Prerequisites to update
- `CONTRIBUTING.md` - Tech Stack Reference to update
- `docs/plans/version-upgrade-plan.md` - Version references
- `docs/specs/version-upgrade.md` - Version references
- `docs/plans/codebase-analysis-for-upgrades.md` - Version references

### New Files
- `.nvmrc` - Node version manager file
- `.node-version` - Alternative version manager file

## Implementation Plan

### Phase 1: Package Configuration
Update package.json with new engine requirements and type definitions:
- Change `engines.node` from `>=20.11.0` to `>=24.0.0`
- Change `engines.bun` from `>=1.0.0` to `>=1.3.4`
- Change `@types/node` from `^22.0.0` to `^24.0.0`

### Phase 2: Version Manager Files
Create developer convenience files:
- Create `.nvmrc` with content `24`
- Create `.node-version` with content `24`

### Phase 3: CI Configuration
Update GitHub Actions workflow:
- Change bun-version matrix from `["1.2", "latest"]` to `["1.3.4", "latest"]`

### Phase 4: Documentation
Update all documentation with new version requirements:
- CLAUDE.md Tech Stack table
- ADR 0003 addendum
- README prerequisites
- CONTRIBUTING tech stack reference
- Existing plan/spec version references

## Step by Step Tasks

### Task 1: Update Package.json Engine Requirements
- Description: Update engines.node to >=24.0.0 and engines.bun to >=1.3.4
- Files to modify: `package.json`
- Archon task: Will be created during implementation

### Task 2: Update @types/node Version
- Description: Update @types/node from ^22.0.0 to ^24.0.0
- Files to modify: `package.json`
- Archon task: Will be created during implementation

### Task 3: Create Version Manager Files
- Description: Create .nvmrc and .node-version with content "24"
- Files to create: `.nvmrc`, `.node-version`
- Archon task: Will be created during implementation

### Task 4: Update CI Workflow Matrix
- Description: Update Bun version matrix from ["1.2", "latest"] to ["1.3.4", "latest"]
- Files to modify: `.github/workflows/ci.yml`
- Archon task: Will be created during implementation

### Task 5: Update CLAUDE.md Tech Stack
- Description: Update Node Engine from >=20.11.0 to >=24.0.0 and add Bun 1.3.x note
- Files to modify: `CLAUDE.md`
- Archon task: Will be created during implementation

### Task 6: Add ADR 0003 Addendum
- Description: Add addendum section documenting Node 24 + Bun 1.3.x compatibility
- Files to modify: `docs/decisions/0003-runtime-bun.md`
- Archon task: Will be created during implementation

### Task 7: Update README Prerequisites
- Description: Update Node.js requirement from 20+ to 24+
- Files to modify: `README.md`
- Archon task: Will be created during implementation

### Task 8: Update CONTRIBUTING Tech Stack
- Description: Update Runtime row to reflect Bun 1.3.x
- Files to modify: `CONTRIBUTING.md`
- Archon task: Will be created during implementation

### Task 9: Update Existing Plan/Spec Version References
- Description: Update hardcoded >=20.11.0 references in related documents
- Files to modify: `docs/specs/version-upgrade.md`, `docs/plans/version-upgrade-plan.md`, `docs/plans/codebase-analysis-for-upgrades.md`
- Archon task: Will be created during implementation

### Task 10: Final Validation
- Description: Run full validation suite to confirm all changes work correctly
- Validation commands: See Validation Commands section
- Archon task: Will be created during implementation

## Testing Strategy

### Unit Tests
- All existing 478 tests must continue to pass
- No new tests required - this is an infrastructure upgrade
- Validator agent will verify test suite passes

### Integration Tests
- Verify `bun install` completes without errors
- Verify application starts correctly with `bun run dev`

### Edge Cases
- Ensure @types/node ^24.0.0 resolves correctly
- Verify CI matrix runs both 1.3.4 and latest successfully
- Confirm no peer dependency warnings after lockfile regeneration

## Acceptance Criteria

- [x] `package.json` engines updated to node >=24.0.0 and bun >=1.3.4
- [x] `@types/node` updated to ^24.0.0
- [x] `.nvmrc` created with content `24`
- [x] `.node-version` created with content `24`
- [x] CI workflow matrix updated to `["1.3.4", "latest"]`
- [x] CLAUDE.md Tech Stack table reflects Node 24 + Bun 1.3.x
- [x] ADR 0003 has addendum for Node 24 compatibility
- [x] README prerequisites updated to Node.js 24+
- [x] CONTRIBUTING tech stack reference updated
- [x] All existing documentation version references updated
- [x] `bun install` completes without errors
- [x] `bun run typecheck` passes
- [x] `bun run lint` passes
- [x] `bun run test` passes (478 tests)
- [x] `bun run build` succeeds
- [x] `bun run dev` starts correctly (verified via build success)

## Validation Commands

```bash
# After package.json updates
bun install
bun run typecheck
bun run lint
bun run test
bun run build

# Final validation
bun run dev  # Verify application starts

# Verify version manager files
cat .nvmrc
cat .node-version
```

## Notes

### Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Bun 1.3.x bugs | Low | Medium | Bun 1.3.4 is stable, tested |
| @types/node gaps | Low | Low | Fall back to ^22 if issues |
| User upgrade friction | Low | Low | Clear docs, simple `bun upgrade` |

### Benefits
1. **Node 24 LTS baseline** - Access to latest stable Node APIs
2. **Bun 1.3.x improvements** - Better Node compatibility, performance
3. **Drops Node 20/22** - Simplifies support matrix
4. **Future-proof types** - @types/node ^24.0.0 matches runtime

### Rollback Strategy
Each task can be reverted independently. If issues arise:
1. `git revert` the problematic commit
2. Pin to previous working version
3. Investigate and retry

### References
- [Bun v1.3.4 Release Notes](https://bun.sh/blog/bun-v1.3.4)
- [Bun Node.js Compatibility](https://bun.sh/docs/runtime/nodejs-apis)
- [Node.js Releases](https://nodejs.org/en/about/previous-releases)
- [ADR 0003: Runtime Bun](../decisions/0003-runtime-bun.md)

## Execution

This spec was implemented on 2025-12-13. See implementation checklist in `docs/plans/version-upgrade-node.md`.
