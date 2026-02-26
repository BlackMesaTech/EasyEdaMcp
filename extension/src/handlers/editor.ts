import type { CommandHandler } from '../handler-registry';

/** Editor control handlers are already in dmt.ts (editorControl namespace).
 *  This file is reserved for any editor-specific helpers that don't map
 *  directly to a single EDA API call. */

const handlers: Record<string, CommandHandler> = {
  // Placeholder — editor control commands are registered via dmt.ts
};

export default handlers;
