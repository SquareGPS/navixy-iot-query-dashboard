/**
 * Variable Resolver
 * Resolves Grafana-style variables to typed SQL parameters
 */

import type { Variable, VariableValue } from './grafana-dashboard';
import type { ResolvedVariable, ValidationError } from './runtime-types';

export class VariableResolver {
  /**
   * Resolve Grafana variables to typed bindings
   */
  static resolve(
    variables: Variable[],
    timeRange: { from: Date; to: Date },
    urlParams: Record<string, string> = {},
    userContext: Record<string, unknown> = {}
  ): Record<string, unknown> {
    const bindings: Record<string, unknown> = {};
    const errors: ValidationError[] = [];

    // Add time range variables
    bindings['__from'] = timeRange.from.getTime();
    bindings['__to'] = timeRange.to.getTime();
    bindings['__from_iso'] = timeRange.from.toISOString();
    bindings['__to_iso'] = timeRange.to.toISOString();

    // Add URL parameters
    Object.entries(urlParams).forEach(([key, value]) => {
      bindings[key] = value;
    });

    // Add user context
    Object.entries(userContext).forEach(([key, value]) => {
      bindings[key] = value;
    });

    // Resolve Grafana variables
    variables.forEach(variable => {
      try {
        const resolved = this.resolveVariable(variable, bindings);
        if (resolved.error) {
          errors.push({
            code: 'VARIABLE_RESOLUTION_ERROR',
            message: `Failed to resolve variable ${variable.name}: ${resolved.error}`,
            details: { variable: variable.name }
          });
        } else {
          bindings[variable.name] = resolved.value;
        }
      } catch (error) {
        errors.push({
          code: 'VARIABLE_RESOLUTION_ERROR',
          message: `Error resolving variable ${variable.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: { variable: variable.name }
        });
      }
    });

    if (errors.length > 0) {
      throw new Error(`Variable resolution failed: ${errors.map(e => e.message).join(', ')}`);
    }

    return bindings;
  }

  /**
   * Resolve a single variable
   */
  private static resolveVariable(variable: Variable, context: Record<string, unknown>): ResolvedVariable {
    switch (variable.type) {
      case 'query':
        return this.resolveQueryVariable(variable);
      case 'interval':
        return this.resolveIntervalVariable(variable);
      case 'datasource':
        return this.resolveDatasourceVariable(variable);
      case 'custom':
        return this.resolveCustomVariable(variable);
      case 'textbox':
        return this.resolveTextboxVariable(variable);
      case 'constant':
        return this.resolveConstantVariable(variable);
      default:
        return {
          name: variable.name,
          value: variable.current.value,
          type: variable.type,
          error: `Unsupported variable type: ${variable.type}`
        };
    }
  }

  /**
   * Resolve query variable
   */
  private static resolveQueryVariable(variable: Variable): ResolvedVariable {
    // For now, return the current value
    // In a full implementation, this would execute the query
    return {
      name: variable.name,
      value: variable.current.value,
      type: 'query'
    };
  }

  /**
   * Resolve interval variable
   */
  private static resolveIntervalVariable(variable: Variable): ResolvedVariable {
    return {
      name: variable.name,
      value: variable.current.value,
      type: 'interval'
    };
  }

  /**
   * Resolve datasource variable
   */
  private static resolveDatasourceVariable(variable: Variable): ResolvedVariable {
    return {
      name: variable.name,
      value: variable.current.value,
      type: 'datasource'
    };
  }

  /**
   * Resolve custom variable
   */
  private static resolveCustomVariable(variable: Variable): ResolvedVariable {
    return {
      name: variable.name,
      value: variable.current.value,
      type: 'custom'
    };
  }

  /**
   * Resolve textbox variable
   */
  private static resolveTextboxVariable(variable: Variable): ResolvedVariable {
    return {
      name: variable.name,
      value: variable.current.value,
      type: 'textbox'
    };
  }

  /**
   * Resolve constant variable
   */
  private static resolveConstantVariable(variable: Variable): ResolvedVariable {
    return {
      name: variable.name,
      value: variable.current.value,
      type: 'constant'
    };
  }

  /**
   * Coerce value to specified parameter type
   */
  static coerceToParamType(value: unknown, paramType: string): unknown {
    try {
      switch (paramType) {
        case 'uuid':
          return this.coerceToUuid(value);
        case 'int':
          return this.coerceToInt(value);
        case 'numeric':
          return this.coerceToNumeric(value);
        case 'text':
          return this.coerceToText(value);
        case 'timestamptz':
          return this.coerceToTimestamp(value);
        case 'bool':
          return this.coerceToBool(value);
        case 'json':
          return this.coerceToJson(value);
        case 'text[]':
          return this.coerceToTextArray(value);
        case 'uuid[]':
          return this.coerceToUuidArray(value);
        default:
          throw new Error(`Unknown parameter type: ${paramType}`);
      }
    } catch (error) {
      throw new Error(`Failed to coerce value to ${paramType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static coerceToUuid(value: unknown): string {
    if (typeof value === 'string' && this.isValidUuid(value)) {
      return value;
    }
    throw new Error(`Invalid UUID: ${value}`);
  }

  private static coerceToInt(value: unknown): number {
    const num = Number(value);
    if (Number.isInteger(num)) {
      return num;
    }
    throw new Error(`Invalid integer: ${value}`);
  }

  private static coerceToNumeric(value: unknown): number {
    const num = Number(value);
    if (!Number.isNaN(num)) {
      return num;
    }
    throw new Error(`Invalid number: ${value}`);
  }

  private static coerceToText(value: unknown): string {
    return String(value);
  }

  private static coerceToTimestamp(value: unknown): string {
    if (typeof value === 'number') {
      return new Date(value).toISOString();
    }
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
    throw new Error(`Invalid timestamp: ${value}`);
  }

  private static coerceToBool(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === '1') return true;
      if (lower === 'false' || lower === '0') return false;
    }
    throw new Error(`Invalid boolean: ${value}`);
  }

  private static coerceToJson(value: unknown): string {
    return JSON.stringify(value);
  }

  private static coerceToTextArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map(v => String(v));
    }
    if (typeof value === 'string') {
      return value.split(',').map(v => v.trim());
    }
    throw new Error(`Invalid text array: ${value}`);
  }

  private static coerceToUuidArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map(v => this.coerceToUuid(v));
    }
    if (typeof value === 'string') {
      return value.split(',').map(v => this.coerceToUuid(v.trim()));
    }
    throw new Error(`Invalid UUID array: ${value}`);
  }

  private static isValidUuid(value: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }
}
