#!/usr/bin/env bun
/**
 * Debug script to inspect what terminal input Ink receives.
 * Run with: bun run scripts/debug-input.tsx
 *
 * This helps diagnose keyboard input issues by showing:
 * - The raw input string
 * - Character codes for each character
 * - The key object from Ink's useInput
 *
 * Try pressing various keys including Ctrl+V to see what arrives.
 */

import React, { useState } from 'react';
import { render, useInput, Text, Box } from 'ink';

interface InputEvent {
  input: string;
  charCodes: number[];
  key: {
    upArrow: boolean;
    downArrow: boolean;
    leftArrow: boolean;
    rightArrow: boolean;
    return: boolean;
    escape: boolean;
    ctrl: boolean;
    shift: boolean;
    meta: boolean;
    tab: boolean;
    backspace: boolean;
    delete: boolean;
  };
  timestamp: string;
}

function DebugInput(): React.ReactElement {
  const [events, setEvents] = useState<InputEvent[]>([]);
  const [lastRaw, setLastRaw] = useState<string>('');

  useInput((input, key) => {
    // Exit on Ctrl+C
    if (key.ctrl && input === 'c') {
      process.exit(0);
    }

    const charCodes = [...input].map((c) => c.charCodeAt(0));

    const event: InputEvent = {
      input: input,
      charCodes,
      key: {
        upArrow: key.upArrow,
        downArrow: key.downArrow,
        leftArrow: key.leftArrow,
        rightArrow: key.rightArrow,
        return: key.return,
        escape: key.escape,
        ctrl: key.ctrl,
        shift: key.shift,
        meta: key.meta,
        tab: key.tab,
        backspace: key.backspace,
        delete: key.delete,
      },
      timestamp: new Date().toISOString().slice(11, 23),
    };

    setLastRaw(JSON.stringify(input));
    setEvents((prev) => [...prev.slice(-9), event]); // Keep last 10
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        Terminal Input Debugger
      </Text>
      <Text dimColor>Press any keys to see what Ink receives. Ctrl+C to exit.</Text>
      <Text dimColor>Try: Ctrl+V, Shift+Enter, regular keys, arrow keys</Text>
      <Text> </Text>

      <Text bold>
        Last raw input: <Text color="yellow">{lastRaw}</Text>
      </Text>
      <Text> </Text>

      <Text bold underline>
        Recent Events (newest at bottom):
      </Text>
      {events.length === 0 && <Text dimColor>No events yet - press a key</Text>}
      {events.map((event, i) => (
        <Box key={i} flexDirection="column" marginTop={1}>
          <Text>
            <Text dimColor>[{event.timestamp}]</Text> <Text color="green">input:</Text> "
            {escapeForDisplay(event.input)}" <Text color="blue">codes:</Text> [
            {event.charCodes.join(', ')}]
          </Text>
          <Text>
            {'  '}
            <Text color="magenta">flags:</Text>
            {event.key.ctrl && <Text color="red"> ctrl</Text>}
            {event.key.shift && <Text color="red"> shift</Text>}
            {event.key.meta && <Text color="red"> meta</Text>}
            {event.key.return && <Text color="yellow"> return</Text>}
            {event.key.escape && <Text color="yellow"> escape</Text>}
            {event.key.tab && <Text color="yellow"> tab</Text>}
            {event.key.backspace && <Text color="yellow"> backspace</Text>}
            {event.key.delete && <Text color="yellow"> delete</Text>}
            {event.key.upArrow && <Text color="cyan"> upArrow</Text>}
            {event.key.downArrow && <Text color="cyan"> downArrow</Text>}
            {!Object.values(event.key).some((v) => v) && <Text dimColor> (none)</Text>}
          </Text>
        </Box>
      ))}

      <Text> </Text>
      <Box borderStyle="single" paddingX={1}>
        <Text>
          <Text bold>Expected for Ctrl+V:</Text> codes: [22] (0x16)
          {'\n'}
          <Text bold>Expected for Shift+Enter:</Text> flags: shift return
        </Text>
      </Box>
    </Box>
  );
}

function escapeForDisplay(str: string): string {
  return str
    .replace(/\x00/g, '\\x00')
    .replace(/\x01/g, '\\x01')
    .replace(/\x02/g, '\\x02')
    .replace(/\x03/g, '\\x03')
    .replace(/\x04/g, '\\x04')
    .replace(/\x05/g, '\\x05')
    .replace(/\x06/g, '\\x06')
    .replace(/\x07/g, '\\x07')
    .replace(/\x08/g, '\\x08')
    .replace(/\x09/g, '\\t')
    .replace(/\x0a/g, '\\n')
    .replace(/\x0b/g, '\\x0b')
    .replace(/\x0c/g, '\\x0c')
    .replace(/\x0d/g, '\\r')
    .replace(/\x0e/g, '\\x0e')
    .replace(/\x0f/g, '\\x0f')
    .replace(/\x10/g, '\\x10')
    .replace(/\x11/g, '\\x11')
    .replace(/\x12/g, '\\x12')
    .replace(/\x13/g, '\\x13')
    .replace(/\x14/g, '\\x14')
    .replace(/\x15/g, '\\x15')
    .replace(/\x16/g, '\\x16') // Ctrl+V
    .replace(/\x17/g, '\\x17')
    .replace(/\x18/g, '\\x18')
    .replace(/\x19/g, '\\x19')
    .replace(/\x1a/g, '\\x1a')
    .replace(/\x1b/g, '\\e') // Escape
    .replace(/\x1c/g, '\\x1c')
    .replace(/\x1d/g, '\\x1d')
    .replace(/\x1e/g, '\\x1e')
    .replace(/\x1f/g, '\\x1f')
    .replace(/\x7f/g, '\\x7f'); // Delete
}

render(<DebugInput />);
