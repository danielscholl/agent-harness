#!/usr/bin/env bun
/**
 * CLI entry point for the agent framework.
 * Parses command-line arguments with meow and renders the appropriate mode.
 * Handles subcommands (config, skill) before rendering React.
 */

import React from 'react';
import { render } from 'ink';
import meow from 'meow';
import { CLI } from './cli.js';
import type { CLIFlags } from './cli/types.js';
import { createCliContext } from './cli/cli-context.js';
import { configHandler } from './cli/commands/config.js';
import { skillHandler } from './cli/commands/skills.js';
import { updateHandler } from './cli/commands/update.js';

const cli = meow(
  `
  Usage
    $ agent [options]
    $ agent <command> [options]

  Commands
    config        Manage agent configuration
    skill         Manage agent skills
    update        Check for and install updates

  Options
    -p, --prompt  Execute single prompt and exit
    --check       Show configuration and connectivity
    --tools       Show tool configuration
    --version     Show version
    --provider    Override provider
    --model       Override model name
    --continue    Resume last session
    --verbose     Show detailed execution

  Run 'agent <command> --help' for command details.
`,
  {
    importMeta: import.meta,
    flags: {
      prompt: { type: 'string', shortFlag: 'p' },
      check: { type: 'boolean', default: false },
      tools: { type: 'boolean', default: false },
      version: { type: 'boolean', default: false },
      provider: { type: 'string' },
      model: { type: 'string' },
      continue: { type: 'boolean', default: false },
      verbose: { type: 'boolean', default: false },
    },
  }
);

// Handle subcommands before rendering React
const [command, ...restArgs] = cli.input;

if (command === 'config') {
  const context = await createCliContext();
  // Check if --help or -h was passed (meow may have consumed it, check original args)
  const wantsHelp = process.argv.includes('--help') || process.argv.includes('-h');
  const hasSubcommand = restArgs.length > 0;
  let subArgs = restArgs.join(' ');
  if (wantsHelp) {
    subArgs = hasSubcommand ? subArgs + ' --help' : '--help';
  }
  const result = await configHandler(subArgs, context);
  process.exit(result.success ? 0 : 1);
}

if (command === 'skill') {
  const context = await createCliContext();
  const wantsHelp = process.argv.includes('--help') || process.argv.includes('-h');
  const hasSubcommand = restArgs.length > 0;
  let subArgs = restArgs.join(' ');
  if (wantsHelp) {
    subArgs = hasSubcommand ? subArgs + ' --help' : '--help';
  }
  const result = await skillHandler(subArgs, context);
  process.exit(result.success ? 0 : 1);
}

if (command === 'update') {
  const context = await createCliContext();
  const wantsHelp = process.argv.includes('--help') || process.argv.includes('-h');
  let subArgs = restArgs.join(' ');
  if (wantsHelp) {
    subArgs = subArgs ? subArgs + ' --help' : '--help';
  }
  const result = await updateHandler(subArgs, context);
  process.exit(result.success ? 0 : 1);
}

// Apply overrides to environment before rendering
if (cli.flags.provider !== undefined && cli.flags.provider !== '') {
  process.env.LLM_PROVIDER = cli.flags.provider;
}
if (cli.flags.model !== undefined && cli.flags.model !== '') {
  process.env.AGENT_MODEL = cli.flags.model;
}

// Cast meow flags to our CLIFlags type
const flags: CLIFlags = {
  prompt: cli.flags.prompt,
  check: cli.flags.check,
  tools: cli.flags.tools,
  version: cli.flags.version,
  provider: cli.flags.provider,
  model: cli.flags.model,
  continue: cli.flags.continue,
  verbose: cli.flags.verbose,
};

const { waitUntilExit } = render(<CLI flags={flags} />);
await waitUntilExit();
