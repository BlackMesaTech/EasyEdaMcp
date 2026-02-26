export type CommandHandler = (params: Record<string, unknown>) => Promise<unknown>;

export class HandlerRegistry {
  private handlers: Map<string, CommandHandler> = new Map();

  register(command: string, handler: CommandHandler): void {
    this.handlers.set(command, handler);
  }

  getHandler(command: string): CommandHandler | undefined {
    return this.handlers.get(command);
  }

  /** Register all handlers from a module (object mapping command names to handler functions). */
  registerModule(module: Record<string, CommandHandler>): void {
    for (const [command, handler] of Object.entries(module)) {
      this.register(command, handler);
    }
  }

  get size(): number {
    return this.handlers.size;
  }

  listCommands(): string[] {
    return Array.from(this.handlers.keys()).sort();
  }
}
