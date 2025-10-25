declare module '@prisma/client' {
  export interface PrismaModelDelegate<T = unknown> {
    findMany(args?: any): Promise<T[]>;
    upsert(args: any): Promise<T>;
    delete(args: any): Promise<T>;
    count(args?: any): Promise<number>;
  }

  export class PrismaClient {
    constructor(options?: any);
    $disconnect(): Promise<void>;
    $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: any[]): Promise<T>;
    $transaction<T>(promises: Promise<T>[]): Promise<T[]>;
    agent: PrismaModelDelegate<any>;
    memory: PrismaModelDelegate<any>;
    workflow: PrismaModelDelegate<any>;
    toolUsage: PrismaModelDelegate<any>;
  }
}

declare module '@langchain/core/prompts' {
  export class PromptTemplate {
    static fromTemplate(template: string): PromptTemplate;
    format(variables: Record<string, unknown>): Promise<string>;
  }
}

declare module 'execa' {
  export interface ExecaReturnValue {
    stdout: string;
    stderr: string;
    exitCode: number;
  }

  export interface ExecaOptions {
    cwd?: string;
    env?: Record<string, string>;
    shell?: boolean;
    reject?: boolean;
  }

  export function execa(
    file: string,
    args?: readonly string[],
    options?: ExecaOptions
  ): Promise<ExecaReturnValue>;
}
