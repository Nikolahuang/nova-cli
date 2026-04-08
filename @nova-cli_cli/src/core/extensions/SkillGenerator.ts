// ============================================================================
// SkillGenerator - Auto-generate skills from code patterns and workflows
// Reference: WorkBuddy skill auto-generation with AI-assisted prompt crafting
// ============================================================================

import { createSessionId } from '../types/session.js';
import type { ModelClient } from '../model/ModelClient.js';
import type { SkillRegistry, SkillDefinition, SkillMetadata } from './SkillRegistry.js';
import type { Message } from '../types/session.js';
import { readFile } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { readdir } from 'node:fs/promises';

export interface GenerationOptions {
  /** Skill name (auto-generated if not provided) */
  name?: string;
  /** Description of what the skill should do */
  description: string;
  /** Source files to learn patterns from */
  sourceFiles?: string[];
  /** Source directory to scan for patterns */
  sourceDir?: string;
  /** Additional context about the skill */
  context?: string;
  /** Tags for categorization */
  tags?: string[];
  /** Whether to auto-register after generation */
  autoRegister?: boolean;
  /** Maximum source files to analyze (default: 10) */
  maxSourceFiles?: number;
}

export interface GenerationResult {
  success: boolean;
  skill?: SkillDefinition;
  error?: string;
  sourceFilesAnalyzed: number;
  generationTime: number;
}

// --- SkillGenerator ---

export class SkillGenerator {
  private modelClient: ModelClient;
  private registry: SkillRegistry;

  constructor(modelClient: ModelClient, registry: SkillRegistry) {
    this.modelClient = modelClient;
    this.registry = registry;
  }

  /**
   * Auto-generate a skill from source files and a description.
   */
  async generate(options: GenerationOptions): Promise<GenerationResult> {
    const startTime = Date.now();

    try {
      // Step 1: Collect source files
      const sourceFiles = await this.collectSourceFiles(options);
      if (sourceFiles.length === 0) {
        return {
          success: false,
          error: 'No source files found to analyze',
          sourceFilesAnalyzed: 0,
          generationTime: Date.now() - startTime,
        };
      }

      // Step 2: Read source file contents
      const sourceContents = await this.readSourceFiles(sourceFiles, options.maxSourceFiles || 10);

      // Step 3: Generate skill using AI
      const result = await this.generateSkillWithAI(options, sourceContents);
      if (!result) {
        return {
          success: false,
          error: 'AI model failed to generate skill content',
          sourceFilesAnalyzed: sourceContents.length,
          generationTime: Date.now() - startTime,
        };
      }

      // Step 4: Create the skill definition
      const skill = this.createSkillDefinition(result, options);

      // Step 5: Optionally register
      if (options.autoRegister !== false) {
        await this.registry.register(skill);
      }

      return {
        success: true,
        skill,
        sourceFilesAnalyzed: sourceContents.length,
        generationTime: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
        sourceFilesAnalyzed: 0,
        generationTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Generate a skill from a recorded workflow/session history.
   */
  async generateFromWorkflow(
    workflowDescription: string,
    steps: string[],
    tags?: string[]
  ): Promise<GenerationResult> {
    return this.generate({
      description: workflowDescription,
      tags: tags || ['workflow', 'auto-generated'],
      context: `Workflow steps:\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`,
      autoRegister: false,
    });
  }

  /**
   * Batch generate skills from multiple patterns.
   */
  async batchGenerate(patterns: GenerationOptions[]): Promise<GenerationResult[]> {
    const results: GenerationResult[] = [];

    for (const pattern of patterns) {
      const result = await this.generate(pattern);
      results.push(result);
    }

    return results;
  }

  /**
   * Collect source files from options.
   */
  private async collectSourceFiles(options: GenerationOptions): Promise<string[]> {
    const files: string[] = [];

    // Explicit source files
    if (options.sourceFiles) {
      files.push(...options.sourceFiles);
    }

    // Source directory scan
    if (options.sourceDir) {
      const dirFiles = await this.scanDirectory(options.sourceDir, [
        '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs',
      ]);
      files.push(...dirFiles);
    }

    return [...new Set(files)]; // Deduplicate
  }

  /**
   * Recursively scan a directory for source files.
   */
  private async scanDirectory(dir: string, extensions: string[]): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        // Skip common non-source directories
        if (
          entry.name === 'node_modules' ||
          entry.name === '.git' ||
          entry.name === 'dist' ||
          entry.name === 'build' ||
          entry.name === '.next' ||
          entry.name === 'coverage'
        ) {
          continue;
        }

        if (entry.isDirectory()) {
          const subFiles = await this.scanDirectory(fullPath, extensions);
          files.push(...subFiles);
        } else if (extensions.includes(extname(entry.name))) {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory may not be accessible
    }

    return files;
  }

  /**
   * Read source file contents with size limiting.
   */
  private async readSourceFiles(
    files: string[],
    maxFiles: number
  ): Promise<Array<{ path: string; content: string; language: string }>> {
    const results: Array<{ path: string; content: string; language: string }> = [];

    for (const file of files.slice(0, maxFiles)) {
      try {
        const content = await readFile(file, 'utf-8');

        // Skip very large files
        if (content.length > 50000) continue;

        const ext = extname(file);
        const languageMap: Record<string, string> = {
          '.ts': 'typescript',
          '.tsx': 'typescript',
          '.js': 'javascript',
          '.jsx': 'javascript',
          '.py': 'python',
          '.go': 'go',
          '.rs': 'rust',
        };

        results.push({
          path: file,
          content,
          language: languageMap[ext] || 'text',
        });
      } catch {
        // Skip unreadable files
      }
    }

    return results;
  }

  /**
   * Use AI to generate skill content from source analysis.
   */
  private async generateSkillWithAI(
    options: GenerationOptions,
    sources: Array<{ path: string; content: string; language: string }>
  ): Promise<{ metadata: Partial<SkillMetadata>; content: string } | null> {
    const prompt = this.buildGenerationPrompt(options, sources);

    try {
      const messages: Message[] = [
        {
          id: 'skill-gen' as any,
          role: 'user',
          content: [{ type: 'text', text: prompt }],
          timestamp: Date.now(),
          createdAt: new Date(),
        },
      ];

      const response = await this.modelClient.complete(
        messages,
        [],
        createSessionId(`skill-gen-${Date.now()}`),
        { systemPrompt: SKILL_GENERATION_SYSTEM_PROMPT }
      );

      const text = response.content
        ?.filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n');

      if (!text) return null;

      return this.parseGenerationResponse(text, options);
    } catch {
      return null;
    }
  }

  /**
   * Build the prompt for skill generation.
   */
  private buildGenerationPrompt(
    options: GenerationOptions,
    sources: Array<{ path: string; content: string; language: string }>
  ): string {
    let prompt = `## Skill Generation Request\n\n`;
    prompt += `**Description**: ${options.description}\n\n`;

    if (options.context) {
      prompt += `**Additional Context**:\n${options.context}\n\n`;
    }

    if (options.tags) {
      prompt += `**Suggested Tags**: ${options.tags.join(', ')}\n\n`;
    }

    prompt += `## Source Files Analyzed\n\n`;
    for (const source of sources.slice(0, 5)) {
      prompt += `### ${source.path} (${source.language})\n`;
      prompt += `\`\`\`${source.language}\n${source.content.substring(0, 3000)}`;
      if (source.content.length > 3000) {
        prompt += '\n... (truncated)';
      }
      prompt += `\n\`\`\`\n\n`;
    }

    if (sources.length > 5) {
      prompt += `*... and ${sources.length - 5} more files were analyzed.*\n\n`;
    }

    prompt += `## Required Output Format\n\n`;
    prompt += `Respond with a JSON object containing:\n`;
    prompt += `\`\`\`json\n`;
    prompt += `{\n`;
    prompt += `  "name": "skill-name-in-kebab-case",\n`;
    prompt += `  "description": "One-line description",\n`;
    prompt += `  "tags": ["tag1", "tag2"],\n`;
    prompt += `  "content": "The full SKILL.md body content with instructions..."\n`;
    prompt += `}\n`;
    prompt += `\`\`\`\n`;

    return prompt;
  }

  /**
   * Parse the AI response into a skill structure.
   */
  private parseGenerationResponse(
    response: string,
    options: GenerationOptions
  ): { metadata: Partial<SkillMetadata>; content: string } | null {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : response;

    try {
      const parsed = JSON.parse(jsonStr.trim());

      return {
        metadata: {
          name: options.name || parsed.name || this.generateSkillName(options.description),
          description: parsed.description || options.description,
          version: '0.1.0',
          tags: parsed.tags || options.tags || [],
          autoGenerated: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        content: parsed.content || '',
      };
    } catch {
      // If JSON parsing fails, try to use the raw text as content
      return {
        metadata: {
          name: options.name || this.generateSkillName(options.description),
          description: options.description,
          version: '0.1.0',
          tags: options.tags || [],
          autoGenerated: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        content: response,
      };
    }
  }

  /**
   * Generate a skill name from a description.
   */
  private generateSkillName(description: string): string {
    const words = description
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 4);

    return words.join('-') || 'auto-skill';
  }

  /**
   * Create a complete SkillDefinition.
   */
  private createSkillDefinition(
    result: { metadata: Partial<SkillMetadata>; content: string },
    options: GenerationOptions
  ): SkillDefinition {
    return {
      metadata: {
        name: result.metadata.name || 'unknown-skill',
        description: result.metadata.description || options.description,
        version: result.metadata.version || '0.1.0',
        author: 'nova-cli',
        tags: result.metadata.tags || options.tags || ['auto-generated'],
        autoGenerated: true,
        createdAt: result.metadata.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      content: result.content,
    };
  }
}

// --- System prompt for skill generation ---

const SKILL_GENERATION_SYSTEM_PROMPT = `You are an expert at creating reusable skill definitions for AI coding assistants.

A skill is a set of instructions, patterns, and best practices that an AI agent can follow to accomplish a specific task. Good skills are:
1. Clear and actionable - the agent knows exactly what to do
2. Comprehensive - they cover common edge cases and pitfalls
3. Pattern-based - they teach the agent to recognize when to apply the skill
4. Self-contained - they don't require external context to be useful

When generating a skill:
- Start with a clear statement of when to use this skill
- Provide step-by-step instructions the agent should follow
- Include common patterns and code examples
- List tools or approaches the agent should use
- Describe the expected output format
- Include error handling guidance

The "content" field should be the full body of the SKILL.md file - everything the AI agent needs to know to execute this skill effectively. Be thorough but concise.`;
