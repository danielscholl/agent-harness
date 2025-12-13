# Node 24 Upgrade Plan

**Created:** 2025-12-13
**Status:** Implemented (2025-12-13)
**Related ADR:** `docs/decisions/0003-runtime-bun.md`

---

## Executive Summary

This plan upgrades the project to Node 24 LTS baseline with Bun 1.3.4.

**Key Discovery:** Bun 1.3.4 reports `process.versions.node` as **24.3.0**, meaning it now implements Node 24 APIs. This eliminates the previous constraint where Bun 1.2.x only supported Node 22.

**Recommended Path:** Upgrade to Bun 1.3.4 and set `engines.node >= 24.0.0`.

---

## Current State

### Engine Requirements (package.json) - Before
```json
{
  "engines": {
    "node": ">=20.11.0",
    "bun": ">=1.0.0"
  }
}
```

### Bun Node Compatibility Evolution
| Bun Version | Node Compat Level | Notes |
|-------------|-------------------|-------|
| 1.0.x | ~20.x | Initial release |
| 1.1.x | ~21.x | Mar 2024 |
| 1.2.x | 22.6.0 | Dec 2024 |
| **1.3.4** | **24.3.0** | **Current - supports Node 24 LTS** |

### Verified Compatibility (Bun 1.3.4)
All project dependencies and tests work with Bun 1.3.4:
- ✅ `bun install` - No errors
- ✅ `bun run typecheck` - Passes
- ✅ `bun run lint` - Passes
- ✅ `bun run test` - 478 tests pass
- ✅ `bun run build` - Successful

---

## Target Version Configuration

### Package.json Engines - After
```json
{
  "engines": {
    "node": ">=24.0.0",
    "bun": ">=1.3.4"
  }
}
```

**Note:** Pin to `>=1.3.4` specifically since that's the verified version reporting Node 24.3.0 compatibility.

### Type Definitions
```json
{
  "devDependencies": {
    "@types/node": "^24.0.0"
  }
}
```

### Developer Environment Files

**`.nvmrc`:**
```
24
```

**`.node-version`:**
```
24
```

---

## Migration Steps

### 1. Update package.json
- Change `engines.node` from `>=20.11.0` to `>=24.0.0`
- Change `engines.bun` from `>=1.0.0` to `>=1.3.4`
- Update `@types/node` from `^22.0.0` to `^24.0.0`

### 2. Add Version Manager Files
- Create `.nvmrc` with `24`
- Create `.node-version` with `24`

### 3. Update Documentation
- Update ADR 0003 with addendum for Node 24 + Bun 1.3.x
- Update CLAUDE.md Tech Stack table
- Update README installation requirements

### 4. Validation
- `bun install` completes without errors
- All quality gates pass
- Application starts correctly

---

## Benefits

1. **Node 24 LTS baseline** - Access to latest stable Node APIs
2. **Bun 1.3.x improvements** - Better Node compatibility, performance
3. **Drops Node 20/22** - Simplifies support matrix
4. **Future-proof types** - @types/node ^24.0.0 matches runtime

---

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Bun 1.3.x bugs | Low | Medium | Bun 1.3.4 is stable, tested |
| @types/node gaps | Low | Low | Fall back to ^22 if issues |
| User upgrade friction | Low | Low | Clear docs, simple `bun upgrade` |

---

## Implementation Checklist

### Package.json Changes
- [x] Update `engines.node` to `>=24.0.0`
- [x] Update `engines.bun` to `>=1.3.4`
- [x] Update `@types/node` to `^24.0.0`

### New Files
- [x] Create `.nvmrc` with content `24`
- [x] Create `.node-version` with content `24`

### CI Updates
- [x] Update `.github/workflows/ci.yml` matrix from `["1.2", "latest"]` to `["1.3.4", "latest"]`

### Documentation Updates
- [x] `CLAUDE.md` - Tech Stack table
- [x] `docs/decisions/0003-runtime-bun.md` - Add addendum for Node 24 + Bun 1.3.x
- [x] `docs/specs/version-upgrade.md` - Update references
- [x] `docs/plans/version-upgrade-plan.md` - Update references
- [x] `docs/plans/version-upgrade-analysis.md` - Update reference

### Validation
- [x] `bun install` succeeds
- [x] `bun run typecheck` passes
- [x] `bun run lint` passes
- [x] `bun run test` passes (478 tests)
- [x] `bun run build` succeeds
- [x] `bun run dev` starts correctly

---

## References

- [Bun v1.3.4 Release Notes](https://bun.sh/blog/bun-v1.3.4)
- [Bun Node.js Compatibility](https://bun.sh/docs/runtime/nodejs-apis)
- [Node.js Releases](https://nodejs.org/en/about/previous-releases)
- [ADR 0003: Runtime Bun](../decisions/0003-runtime-bun.md)
