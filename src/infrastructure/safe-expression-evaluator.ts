/**
 * Safe Expression Evaluator
 *
 * Provides secure expression evaluation without using eval() or new Function().
 * Only allows whitelisted operations to prevent arbitrary code execution.
 */

type Value = string | number | boolean | null | undefined | Value[] | { [key: string]: Value };

/**
 * Safely evaluates a boolean expression using a whitelist approach
 * Supported operations:
 * - Comparisons: ===, !==, <, >, <=, >=
 * - Logical: &&, ||, !
 * - Property access: obj.prop, obj['prop']
 * - Literals: true, false, null, numbers, strings
 */
export class SafeExpressionEvaluator {
  /**
   * Evaluate a simple boolean expression safely
   * @param expression The expression to evaluate (e.g., "status === 'active'")
   * @param context The context object with variables
   * @returns The boolean result, or false if evaluation fails
   */
  static evaluate(expression: string, context: Record<string, unknown>): boolean {
    try {
      // Trim whitespace
      expression = expression.trim();

      // Handle logical operators
      if (expression.includes('&&')) {
        const parts = expression.split('&&').map(p => p.trim());
        return parts.every(part => this.evaluate(part, context));
      }

      if (expression.includes('||')) {
        const parts = expression.split('||').map(p => p.trim());
        return parts.some(part => this.evaluate(part, context));
      }

      // Handle negation
      if (expression.startsWith('!')) {
        return !this.evaluate(expression.substring(1).trim(), context);
      }

      // Handle comparisons
      const comparisonOps = ['===', '!==', '<=', '>=', '<', '>'];
      for (const op of comparisonOps) {
        if (expression.includes(op)) {
          const [left, right] = expression.split(op).map(p => p.trim());
          const leftVal = this.resolveValue(left, context);
          const rightVal = this.resolveValue(right, context);

          switch (op) {
            case '===':
              return leftVal === rightVal;
            case '!==':
              return leftVal !== rightVal;
            case '<':
              return typeof leftVal === 'number' && typeof rightVal === 'number' && leftVal < rightVal;
            case '>':
              return typeof leftVal === 'number' && typeof rightVal === 'number' && leftVal > rightVal;
            case '<=':
              return typeof leftVal === 'number' && typeof rightVal === 'number' && leftVal <= rightVal;
            case '>=':
              return typeof leftVal === 'number' && typeof rightVal === 'number' && leftVal >= rightVal;
          }
        }
      }

      // Handle boolean literals
      if (expression === 'true') return true;
      if (expression === 'false') return false;

      // Handle direct variable access (must be truthy)
      const value = this.resolveValue(expression, context);
      return Boolean(value);

    } catch (error) {
      // On any error, return false (safe default)
      return false;
    }
  }

  /**
   * Resolve a value from the expression or context
   * Supports:
   * - String literals: 'value', "value"
   * - Number literals: 123, 45.67
   * - Boolean literals: true, false
   * - null literal: null
   * - Variable access: variableName
   * - Property access: object.property
   */
  private static resolveValue(expr: string, context: Record<string, unknown>): unknown {
    expr = expr.trim();

    // String literal
    if ((expr.startsWith("'") && expr.endsWith("'")) ||
        (expr.startsWith('"') && expr.endsWith('"'))) {
      return expr.slice(1, -1);
    }

    // Number literal
    if (/^-?\d+(\.\d+)?$/.test(expr)) {
      return Number(expr);
    }

    // Boolean literals
    if (expr === 'true') return true;
    if (expr === 'false') return false;

    // Null literal
    if (expr === 'null') return null;
    if (expr === 'undefined') return undefined;

    // Property access (object.property or object['property'])
    if (expr.includes('.')) {
      const parts = expr.split('.');
      let value: unknown = context[parts[0]];

      for (let i = 1; i < parts.length; i++) {
        if (value === null || value === undefined) {
          return undefined;
        }

        // Safe property access
        if (typeof value === 'object' && value !== null) {
          value = (value as Record<string, unknown>)[parts[i]];
        } else {
          return undefined;
        }
      }

      return value;
    }

    // Direct variable access
    return context[expr];
  }

  /**
   * Validate an expression for safety (returns true if expression is safe)
   * Checks for dangerous patterns that should never appear
   */
  static isSafe(expression: string): boolean {
    // Blacklist dangerous patterns
    const dangerousPatterns = [
      /eval\s*\(/i,
      /Function\s*\(/i,
      /require\s*\(/i,
      /import\s*\(/i,
      /process\./i,
      /global\./i,
      /globalThis\./i,
      /__proto__/i,
      /constructor/i,
      /prototype/i,
    ];

    return !dangerousPatterns.some(pattern => pattern.test(expression));
  }
}

/**
 * Evaluate an expression that returns any value (not just boolean)
 * Used for template variable substitution
 */
export class SafeValueEvaluator {
  /**
   * Safely resolve a value from context
   * Only supports direct property access, no operations
   */
  static resolve(expression: string, context: Record<string, unknown>): unknown {
    try {
      expression = expression.trim();

      // Property access (object.property)
      if (expression.includes('.')) {
        const parts = expression.split('.');
        let value: unknown = context[parts[0]];

        for (let i = 1; i < parts.length; i++) {
          if (value === null || value === undefined) {
            return undefined;
          }

          if (typeof value === 'object' && value !== null) {
            value = (value as Record<string, unknown>)[parts[i]];
          } else {
            return undefined;
          }
        }

        return value;
      }

      // Direct variable access
      return context[expression];

    } catch (error) {
      return undefined;
    }
  }
}
