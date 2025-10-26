/**
 * Panel Registry
 * Manages panel handlers and their registration
 */

import type { PanelHandler, DataRows } from './runtime-types';

export class PanelRegistry {
  private static handlers = new Map<string, PanelHandler>();

  /**
   * Register a panel handler
   */
  static register(type: string, handler: PanelHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Get a panel handler by type
   */
  static get(type: string): PanelHandler | undefined {
    return this.handlers.get(type);
  }

  /**
   * Check if a panel type is registered
   */
  static has(type: string): boolean {
    return this.handlers.has(type);
  }

  /**
   * Get all registered panel types
   */
  static getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Render a panel using its registered handler
   */
  static render(
    type: string,
    mount: HTMLElement | null,
    data: DataRows,
    props: Record<string, any> = {}
  ): (() => void) | void {
    const handler = this.get(type);
    if (!handler) {
      console.warn(`No handler registered for panel type: ${type}`);
      return;
    }

    try {
      return handler.render(mount, data, props);
    } catch (error) {
      console.error(`Error rendering panel type ${type}:`, error);
      throw error;
    }
  }

  /**
   * Prepare panel data using its handler
   */
  static prepare(
    type: string,
    data: DataRows,
    props: Record<string, any> = {}
  ): unknown {
    const handler = this.get(type);
    if (!handler?.prepare) {
      return undefined;
    }

    try {
      return handler.prepare(data, props);
    } catch (error) {
      console.error(`Error preparing panel type ${type}:`, error);
      return undefined;
    }
  }

  /**
   * Measure panel dimensions using its handler
   */
  static measure(
    type: string,
    containerWidth: number
  ): { minHeight: number } | undefined {
    const handler = this.get(type);
    if (!handler?.measure) {
      return undefined;
    }

    try {
      return handler.measure(containerWidth);
    } catch (error) {
      console.error(`Error measuring panel type ${type}:`, error);
      return undefined;
    }
  }

  /**
   * Clear all registered handlers
   */
  static clear(): void {
    this.handlers.clear();
  }
}
