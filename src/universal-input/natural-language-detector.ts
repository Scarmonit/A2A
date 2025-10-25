/**
 * Natural Language Detector - Local NL detection
 * Provides local natural language intent detection for the Universal Input system
 */

import { InputModeType } from './input-modes';

export interface DetectionResult {
  intent: InputModeType;
  confidence: number;
  reasoning?: string;
}

export interface DetectionConfig {
  threshold?: number;
  enableLogging?: boolean;
}

export class NaturalLanguageDetector {
  private config: Required<DetectionConfig>;
  private commandPatterns: RegExp[];
  private questionPatterns: RegExp[];
  private instructionPatterns: RegExp[];

  constructor(config: DetectionConfig = {}) {
    this.config = {
      threshold: config.threshold ?? 0.6,
      enableLogging: config.enableLogging ?? false,
    };

    // Initialize patterns
    this.commandPatterns = [
      // Shell commands
      /^(ls|cd|pwd|mkdir|rm|cp|mv|cat|echo|grep|find|chmod|chown)\b/i,
      /^(git|npm|yarn|pnpm|node|python|pip|cargo|rustc|go)\b/i,
      /^(docker|kubectl|helm|terraform|ansible)\b/i,
      /^(curl|wget|ssh|scp|rsync)\b/i,
      
      // Path patterns
      /^[\.\~]?\//,
      
      // Shell operators
      /\|\|?|&&|;|>>?|<<|\$\(/,
    ];

    this.questionPatterns = [
      /^(what|why|how|when|where|who|which|whose)\b/i,
      /^(can you|could you|would you|will you|should|is it|are there)\b/i,
      /^(tell me|show me|explain|describe)\b/i,
      /\?$/,
    ];

    this.instructionPatterns = [
      /^(please|help|create|generate|write|build|make|design)\b/i,
      /^(implement|develop|add|update|modify|change|fix)\b/i,
      /^(analyze|review|check|verify|test|debug|refactor)\b/i,
      /^(optimize|improve|enhance|simplify)\b/i,
      /^(find|search|list|show|display)\b/i,
      /^(delete|remove|clean|clear)\b/i,
    ];
  }

  /**
   * Detect the intent of the input
   */
  public async detectIntent(input: string): Promise<InputModeType> {
    const result = this.analyzeInput(input);
    
    if (this.config.enableLogging) {
      console.log('[NLDetector] Detection result:', result);
    }

    return result.intent;
  }

  /**
   * Analyze input and return detailed detection result
   */
  public analyzeInput(input: string): DetectionResult {
    const trimmed = input.trim();
    
    if (!trimmed) {
      return {
        intent: 'agent',
        confidence: 0,
        reasoning: 'Empty input',
      };
    }

    // Check for explicit command patterns
    const commandScore = this.scoreCommandLikelihood(trimmed);
    const questionScore = this.scoreQuestionLikelihood(trimmed);
    const instructionScore = this.scoreInstructionLikelihood(trimmed);

    // Additional heuristics
    const hasAtMention = trimmed.includes('@');
    const hasSlashCommand = trimmed.startsWith('/');
    const hasCodeBlock = trimmed.includes('```');
    
    // Calculate final scores
    let terminalScore = commandScore;
    let agentScore = Math.max(questionScore, instructionScore);

    // Adjust based on heuristics
    if (hasAtMention || hasSlashCommand) {
      agentScore += 0.3;
    }

    if (hasCodeBlock) {
      agentScore += 0.2;
    }

    // Check for natural language length and structure
    const words = trimmed.split(/\s+/);
    if (words.length > 5) {
      agentScore += 0.1;
    }

    // Normalize scores
    const totalScore = terminalScore + agentScore;
    if (totalScore > 0) {
      terminalScore /= totalScore;
      agentScore /= totalScore;
    }

    // Determine intent
    let intent: InputModeType;
    let confidence: number;
    let reasoning: string;

    if (terminalScore > agentScore && terminalScore >= this.config.threshold) {
      intent = 'terminal';
      confidence = terminalScore;
      reasoning = 'Input matches terminal command patterns';
    } else if (agentScore >= this.config.threshold) {
      intent = 'agent';
      confidence = agentScore;
      reasoning = 'Input matches natural language patterns';
    } else {
      // Default to agent for ambiguous cases
      intent = 'agent';
      confidence = 0.5;
      reasoning = 'Ambiguous input, defaulting to agent';
    }

    return { intent, confidence, reasoning };
  }

  private scoreCommandLikelihood(input: string): number {
    let score = 0;
    let matches = 0;

    for (const pattern of this.commandPatterns) {
      if (pattern.test(input)) {
        matches++;
        score += 0.3;
      }
    }

    // Bonus for multiple command indicators
    if (matches > 1) {
      score += 0.2;
    }

    return Math.min(score, 1.0);
  }

  private scoreQuestionLikelihood(input: string): number {
    let score = 0;

    for (const pattern of this.questionPatterns) {
      if (pattern.test(input)) {
        score += 0.3;
      }
    }

    return Math.min(score, 1.0);
  }

  private scoreInstructionLikelihood(input: string): number {
    let score = 0;

    for (const pattern of this.instructionPatterns) {
      if (pattern.test(input)) {
        score += 0.25;
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * Check if input is a question
   */
  public isQuestion(input: string): boolean {
    return this.questionPatterns.some(pattern => pattern.test(input.trim()));
  }

  /**
   * Check if input is a command
   */
  public isCommand(input: string): boolean {
    return this.commandPatterns.some(pattern => pattern.test(input.trim()));
  }

  /**
   * Check if input is an instruction
   */
  public isInstruction(input: string): boolean {
    return this.instructionPatterns.some(pattern => pattern.test(input.trim()));
  }

  /**
   * Get suggested mode based on input
   */
  public getSuggestedMode(input: string): InputModeType {
    const result = this.analyzeInput(input);
    return result.intent;
  }

  /**
   * Update detection threshold
   */
  public setThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 1) {
      throw new Error('Threshold must be between 0 and 1');
    }
    this.config.threshold = threshold;
  }

  /**
   * Get current threshold
   */
  public getThreshold(): number {
    return this.config.threshold;
  }

  /**
   * Enable or disable logging
   */
  public setLogging(enabled: boolean): void {
    this.config.enableLogging = enabled;
  }
}

export default NaturalLanguageDetector;
