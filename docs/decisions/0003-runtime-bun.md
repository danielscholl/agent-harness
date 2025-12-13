---
status: accepted
contact: Project Team
date: 2025-01-15
deciders: Project Team
consulted: Claude Code architecture review
---

# Runtime: Bun

## Context and Problem Statement

The agent framework needs a JavaScript/TypeScript runtime for development and execution. The choice affects:
- Development experience (startup time, hot reload)
- TypeScript execution (native vs transpilation)
- Package management
- Bundling and distribution
- Compatibility with dependencies (LangChain, Ink, etc.)

## Decision Drivers

- **TypeScript execution**: Native TS execution without build step preferred
- **Startup time**: CLI tools should start quickly (< 500ms target)
- **Developer experience**: Fast iteration during development
- **Dependency compatibility**: Must work with React 19, Ink 6, LangChain.js
- **Production stability**: Runtime must be reliable for end users
- **Distribution**: Users must be able to install and run the agent

## Considered Options

### Option 1: Bun

Bun is an all-in-one JavaScript runtime with native TypeScript support.

**Pros:**
- Native TypeScript execution (no transpilation step)
- Extremely fast startup (~4x faster than Node.js)
- Built-in bundler, test runner, package manager
- Growing ecosystem and active development
- Single tool for dev and runtime
- Claude Code uses this stack successfully

**Cons:**
- Younger ecosystem, potential compatibility gaps
- Some Node.js APIs not fully implemented
- Smaller community than Node.js
- Users must install Bun (not pre-installed on systems)

### Option 2: Node.js + TypeScript Compiler

Traditional Node.js with tsc or ts-node for TypeScript.

**Pros:**
- Maximum compatibility (de facto standard)
- Largest ecosystem and community
- Pre-installed on many systems
- Most dependencies tested against Node.js

**Cons:**
- Requires transpilation step or ts-node overhead
- Slower startup than Bun
- Need separate tools (npm/yarn/pnpm, tsc, bundler)
- More complex toolchain

### Option 3: Node.js + SWC/esbuild

Node.js with fast TypeScript transpiler.

**Pros:**
- Node.js compatibility
- Fast transpilation with SWC or esbuild
- Can achieve good startup times

**Cons:**
- Still requires build step
- More complex toolchain
- Not as fast as Bun for development

### Option 4: Deno

Deno is a secure TypeScript runtime by Node.js creator.

**Pros:**
- Native TypeScript support
- Security-first design
- Modern APIs

**Cons:**
- Different module system (URL imports)
- npm compatibility layer still maturing
- Smallest ecosystem of the options
- Would require significant dependency adjustments

## Decision Outcome

Chosen option: **"Bun"**, because:

1. **Native TypeScript**: No build step needed during development
2. **Startup performance**: Meets < 500ms target easily
3. **Developer experience**: Single tool for run, test, bundle
4. **Proven stack**: Claude Code demonstrates viability of Bun + React + Ink
5. **Simplicity**: `bun run src/index.tsx` just works

The trade-off of requiring users to install Bun is acceptable because:
- Installation is simple (`curl -fsSL https://bun.sh/install | bash`)
- The DX benefits outweigh the installation friction
- We can provide clear installation instructions

### Consequences

**Good:**
- Excellent development experience
- Fast startup times
- Simplified toolchain
- Native TypeScript without configuration

**Bad:**
- Users must install Bun
- Potential compatibility issues with some npm packages
- Less documentation/Stack Overflow coverage than Node.js

**Mitigations:**
- Document Bun installation in README
- Test dependencies thoroughly for Bun compatibility
- Have fallback plan if critical incompatibility discovered

### Compatibility Verification

Before Phase 1 implementation, verify these work with Bun:
- [ ] React 19
- [ ] Ink 6
- [ ] LangChain.js packages
- [ ] OpenTelemetry SDK
- [ ] Jest (via `bun run test`)

### Version Requirements

- **Minimum Bun version**: 1.0.0
- **Recommended**: Latest stable (1.x)

### Runtime Commands

```bash
# Development
bun run src/index.tsx

# Testing (Jest via bun)
bun run test

# Building
bun build src/index.tsx --outdir dist

# Package management
bun install
bun add <package>
```

---

## Addendum: Node 24 + Bun 1.3.x (2025-12-13)

### Background

Bun 1.3.4 reports `process.versions.node` as **24.3.0**, indicating full Node 24 API compatibility. This enables upgrading the project to Node 24 LTS baseline.

### Updated Version Requirements

- **Minimum Bun version**: 1.3.4 (implements Node 24.3.0)
- **Minimum Node version**: 24.0.0 (for compatibility documentation)
- **@types/node**: ^24.0.0

### Verification

All project validations pass with Bun 1.3.4:
- `bun install` - No errors
- `bun run typecheck` - Passes
- `bun run lint` - Passes
- `bun run test` - 478 tests pass
- `bun run build` - Successful

### Developer Convenience

Version manager files added:
- `.nvmrc` - Contains `24` for nvm users
- `.node-version` - Contains `24` for other version managers

### References

- [Bun v1.3.4 Release Notes](https://bun.sh/blog/bun-v1.3.4)
- Feature spec: `docs/specs/version-upgrade-node-bun.md`
