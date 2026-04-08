// ============================================================================
// SkillValidator - Validate skill definitions for quality and completeness
// Reference: WorkBuddy skill validation pipeline
// ============================================================================

import type { SkillDefinition, SkillMetadata } from './SkillRegistry.js';
import { readFile, stat, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  suggestion?: string;
  line?: number;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  score: number; // 0-100 quality score
  checkedAt: string;
}

// Validation rule definitions
const REQUIRED_METADATA_FIELDS: (keyof SkillMetadata)[] = ['name', 'description', 'version'];
const RECOMMENDED_METADATA_FIELDS: (keyof SkillMetadata)[] = ['tags', 'author', 'createdAt'];
const MIN_CONTENT_LENGTH = 100;
const RECOMMENDED_CONTENT_LENGTH = 500;
const MAX_CONTENT_LENGTH = 50000;

export class SkillValidator {
  /**
   * Validate a skill definition comprehensively.
   */
  async validate(skill: SkillDefinition): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];

    // Step 1: Metadata validation
    this.validateMetadata(skill.metadata, issues);

    // Step 2: Content validation
    this.validateContent(skill.content, issues);

    // Step 3: Structural validation
    this.validateStructure(skill.content, issues);

    // Step 4: Security validation
    this.validateSecurity(skill.content, issues);

    // Step 5: Quality scoring
    this.validateQuality(skill, issues);

    const hasErrors = issues.some((i) => i.severity === 'error');
    const score = this.calculateScore(issues);

    return {
      valid: !hasErrors,
      issues,
      score,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Quick validation - only checks for blocking errors.
   */
  quickValidate(skill: SkillDefinition): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Only check critical fields
    if (!skill.metadata.name) {
      issues.push({
        severity: 'error',
        code: 'MISSING_NAME',
        message: 'Skill name is required',
        suggestion: 'Add a unique kebab-case name for this skill',
      });
    }

    if (!skill.metadata.description) {
      issues.push({
        severity: 'error',
        code: 'MISSING_DESCRIPTION',
        message: 'Skill description is required',
        suggestion: 'Add a one-line description of what this skill does',
      });
    }

    if (!skill.content || skill.content.length < 20) {
      issues.push({
        severity: 'error',
        code: 'EMPTY_CONTENT',
        message: 'Skill content is too short or empty',
        suggestion: 'Add detailed instructions for the AI agent to follow',
      });
    }

    return issues;
  }

  /**
   * Validate a skill file on disk.
   */
  async validateFile(filePath: string): Promise<ValidationResult> {
    try {
      const content = await readFile(filePath, 'utf-8');

      // Parse as markdown - extract YAML frontmatter if present
      const { metadata, body } = this.parseSkillFile(content, filePath);

      const skill: SkillDefinition = {
        metadata,
        content: body,
      };

      return this.validate(skill);
    } catch (err: any) {
      return {
        valid: false,
        issues: [
          {
            severity: 'error',
            code: 'FILE_READ_ERROR',
            message: `Cannot read skill file: ${err.message}`,
          },
        ],
        score: 0,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Compare two versions of a skill and report differences.
   */
  async diff(oldSkill: SkillDefinition, newSkill: SkillDefinition): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Version check
    if (oldSkill.metadata.version && newSkill.metadata.version) {
      if (this.compareVersions(oldSkill.metadata.version, newSkill.metadata.version) > 0) {
        issues.push({
          severity: 'warning',
          code: 'VERSION_DOWNGRADE',
          message: `Version decreased from ${oldSkill.metadata.version} to ${newSkill.metadata.version}`,
          suggestion: 'Version should only increase. Consider bumping the version number.',
        });
      }
    }

    // Content size change
    const sizeDiff = newSkill.content.length - oldSkill.content.length;
    if (Math.abs(sizeDiff) > oldSkill.content.length * 0.5 && sizeDiff < 0) {
      issues.push({
        severity: 'warning',
        code: 'SIGNIFICANT_SHRINKAGE',
        message: `Content reduced by ${Math.abs(sizeDiff)} characters (${Math.round(Math.abs(sizeDiff) / oldSkill.content.length * 100)}%)`,
        suggestion: 'Verify that important content was not accidentally removed',
      });
    }

    // Name change
    if (oldSkill.metadata.name !== newSkill.metadata.name) {
      issues.push({
        severity: 'info',
        code: 'NAME_CHANGED',
        message: `Skill renamed from "${oldSkill.metadata.name}" to "${newSkill.metadata.name}"`,
      });
    }

    // Tag changes
    const oldTags = new Set(oldSkill.metadata.tags || []);
    const newTags = new Set(newSkill.metadata.tags || []);
    const removedTags = [...oldTags].filter((t) => !newTags.has(t));
    const addedTags = [...newTags].filter((t) => !oldTags.has(t));

    if (removedTags.length > 0) {
      issues.push({
        severity: 'info',
        code: 'TAGS_REMOVED',
        message: `Tags removed: ${removedTags.join(', ')}`,
      });
    }
    if (addedTags.length > 0) {
      issues.push({
        severity: 'info',
        code: 'TAGS_ADDED',
        message: `Tags added: ${addedTags.join(', ')}`,
      });
    }

    return issues;
  }

  // --- Private validation methods ---

  private validateMetadata(metadata: SkillMetadata, issues: ValidationIssue[]): void {
    // Required fields
    for (const field of REQUIRED_METADATA_FIELDS) {
      if (!metadata[field]) {
        issues.push({
          severity: 'error',
          code: `MISSING_${field.toUpperCase()}`,
          message: `Required metadata field "${field}" is missing or empty`,
          suggestion: `Add "${field}" to the skill metadata`,
        });
      }
    }

    // Recommended fields
    for (const field of RECOMMENDED_METADATA_FIELDS) {
      if (!metadata[field]) {
        issues.push({
          severity: 'info',
          code: `MISSING_RECOMMENDED_${field.toUpperCase()}`,
          message: `Recommended metadata field "${field}" is missing`,
          suggestion: `Consider adding "${field}" for better discoverability`,
        });
      }
    }

    // Name format validation
    if (metadata.name) {
      if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(metadata.name) && metadata.name.length > 1) {
        issues.push({
          severity: 'warning',
          code: 'INVALID_NAME_FORMAT',
          message: `Skill name "${metadata.name}" should be lowercase kebab-case`,
          suggestion: 'Use only lowercase letters, numbers, and hyphens. Example: "react-component-generator"',
        });
      }

      if (metadata.name.length > 50) {
        issues.push({
          severity: 'warning',
          code: 'NAME_TOO_LONG',
          message: `Skill name is ${metadata.name.length} characters, max 50 recommended`,
        });
      }
    }

    // Description length
    if (metadata.description) {
      if (metadata.description.length < 10) {
        issues.push({
          severity: 'warning',
          code: 'DESCRIPTION_TOO_SHORT',
          message: 'Description should be at least 10 characters for better discoverability',
        });
      } else if (metadata.description.length > 200) {
        issues.push({
          severity: 'info',
          code: 'DESCRIPTION_TOO_LONG',
          message: 'Description is long, consider keeping it under 200 characters for display',
        });
      }
    }

    // Version format
    if (metadata.version) {
      if (!/^\d+\.\d+\.\d+/.test(metadata.version)) {
        issues.push({
          severity: 'warning',
          code: 'INVALID_VERSION_FORMAT',
          message: `Version "${metadata.version}" does not follow semver (x.y.z)`,
          suggestion: 'Use semantic versioning like "1.0.0", "0.2.1"',
        });
      }
    }
  }

  private validateContent(content: string, issues: ValidationIssue[]): void {
    if (!content || content.length === 0) {
      issues.push({
        severity: 'error',
        code: 'EMPTY_CONTENT',
        message: 'Skill content is empty',
        suggestion: 'Add instructions, patterns, and examples for the AI agent',
      });
      return;
    }

    // Minimum content length
    if (content.length < MIN_CONTENT_LENGTH) {
      issues.push({
        severity: 'warning',
        code: 'CONTENT_TOO_SHORT',
        message: `Content is ${content.length} characters, minimum recommended is ${MIN_CONTENT_LENGTH}`,
        suggestion: 'Add more detailed instructions and examples to make the skill more useful',
      });
    }

    // Maximum content length
    if (content.length > MAX_CONTENT_LENGTH) {
      issues.push({
        severity: 'warning',
        code: 'CONTENT_TOO_LONG',
        message: `Content is ${content.length} characters, max recommended is ${MAX_CONTENT_LENGTH}`,
        suggestion: 'Consider splitting into multiple specialized skills or trimming verbose sections',
      });
    }

    // Check for placeholder content
    // Only detect actual placeholder markers, not mentions of them in documentation
    const placeholderPatterns = [
      /^TODO:\s*implement/mi,
      /^FIXME:\s*implement/mi,
      /^\s*\[insert.*here\]/mi,
      /lorem ipsum/i,
      /your content here/i,
      /\[待填写\]/,
      /\[待实现\]/,
    ];

    // Also check for lines that are ONLY "TODO" or "FIXME" without context
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === 'TODO' || trimmed === 'FIXME' || trimmed === 'TODO:') {
        issues.push({
          severity: 'error',
          code: 'PLACEHOLDER_CONTENT',
          message: 'Content contains placeholder text that should be filled in',
          suggestion: 'Replace all TODO/placeholder markers with actual instructions',
        });
        return; // Only report once
      }
    }

    for (const pattern of placeholderPatterns) {
      if (pattern.test(content)) {
        issues.push({
          severity: 'error',
          code: 'PLACEHOLDER_CONTENT',
          message: 'Content contains placeholder text that should be filled in',
          suggestion: 'Replace all TODO/placeholder markers with actual instructions',
        });
        break;
      }
    }
  }

  private validateStructure(content: string, issues: ValidationIssue[]): void {
    // Check for markdown headers (indicates good structure)
    const headerMatches = content.match(/^#{1,3}\s+.+$/gm);
    if (!headerMatches || headerMatches.length < 2) {
      issues.push({
        severity: 'info',
        code: 'POOR_STRUCTURE',
        message: 'Content lacks section headers for organization',
        suggestion: 'Use markdown headers (##) to organize content into clear sections',
      });
    }

    // Check for code examples
    const codeBlockMatches = content.match(/```[\s\S]*?```/g);
    if (!codeBlockMatches || codeBlockMatches.length === 0) {
      issues.push({
        severity: 'info',
        code: 'NO_CODE_EXAMPLES',
        message: 'No code examples found in the skill',
        suggestion: 'Include code examples to help the agent understand the expected patterns',
      });
    }

    // Check for numbered or bullet lists (indicates step-by-step instructions)
    const listMatches = content.match(/(?:^[\d]+\.\s|^\s*[-*]\s)/gm);
    if (!listMatches || listMatches.length < 2) {
      issues.push({
        severity: 'info',
        code: 'NO_PROCEDURAL_STEPS',
        message: 'No procedural steps found (numbered lists or bullet points)',
        suggestion: 'Add step-by-step instructions for the agent to follow',
      });
    }

    // Check for trigger/activation conditions
    const triggerPatterns = [
      /(?:when to use|trigger|activation|use this skill|when.*should)/i,
      /(?:applicable|适用|触发)/i,
    ];
    const hasTrigger = triggerPatterns.some((p) => p.test(content));
    if (!hasTrigger) {
      issues.push({
        severity: 'info',
        code: 'NO_TRIGGER_CONDITIONS',
        message: 'No trigger/activation conditions specified',
        suggestion: 'Add a section describing when this skill should be activated (e.g., "Use this skill when...")',
      });
    }
  }

  private validateSecurity(content: string, issues: ValidationIssue[]): void {
    // Check for potentially dangerous instructions
    const dangerousPatterns = [
      { pattern: /rm\s+-rf\s+\/|del\s+\/S\s+\/Q/i, message: 'Contains destructive file system commands', code: 'DANGEROUS_FS_COMMAND' },
      { pattern: /DROP\s+TABLE|DELETE\s+FROM\s+\w+(?!\s+WHERE)/i, message: 'Contains potentially dangerous SQL without WHERE clause', code: 'DANGEROUS_SQL' },
      { pattern: /eval\s*\(|Function\s*\(/, message: 'Contains eval() or Function() constructor usage', code: 'DANGEROUS_EVAL' },
      { pattern: /curl.*\|\s*(?:bash|sh)/i, message: 'Contains pipe-to-shell pattern (curl | bash)', code: 'PIPE_TO_SHELL' },
    ];

    for (const { pattern, message, code } of dangerousPatterns) {
      if (pattern.test(content)) {
        issues.push({
          severity: 'warning',
          code,
          message: `Security: ${message}`,
          suggestion: 'Review and add safety guards. If intentional, document why this is needed.',
        });
      }
    }
  }

  private validateQuality(skill: SkillDefinition, issues: ValidationIssue[]): void {
    // Check for auto-generated flag without human review
    if (skill.metadata.autoGenerated && !skill.metadata.reviewedAt) {
      issues.push({
        severity: 'info',
        code: 'AUTO_GENERATED_UNREVIEWED',
        message: 'Auto-generated skill has not been reviewed',
        suggestion: 'Have a human review and update the "reviewedAt" field after verification',
      });
    }
  }

  /**
   * Calculate a quality score (0-100) based on issues.
   */
  private calculateScore(issues: ValidationIssue[]): number {
    let score = 100;

    for (const issue of issues) {
      switch (issue.severity) {
        case 'error':
          score -= 25;
          break;
        case 'warning':
          score -= 10;
          break;
        case 'info':
          score -= 3;
          break;
      }
    }

    // Bonus for having good content length
    const contentIssues = issues.filter(
      (i) => i.code.includes('CONTENT') && i.severity !== 'error'
    );
    if (contentIssues.length === 0) {
      score += 5; // Bonus for good content sizing
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Parse a SKILL.md file with optional YAML frontmatter.
   */
  private parseSkillFile(
    content: string,
    filePath: string
  ): { metadata: SkillMetadata; body: string } {
    const defaultMetadata: SkillMetadata = {
      name: filePath ? filePath.replace(/\.md$/, '').split(/[\\/]/).pop() || 'unknown' : 'unknown',
      description: '',
      version: '0.1.0',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Check for YAML frontmatter
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (frontmatterMatch) {
      const yamlContent = frontmatterMatch[1];
      const body = frontmatterMatch[2].trim();

      const metadata: Record<string, any> = {};
      for (const line of yamlContent.split('\n')) {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;

        const key = line.slice(0, colonIndex).trim();
        let value = line.slice(colonIndex + 1).trim();

        // Remove quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        // Parse arrays
        if (value.startsWith('[') && value.endsWith(']')) {
          try {
            metadata[key] = JSON.parse(value);
          } catch {
            metadata[key] = value;
          }
        } else {
          metadata[key] = value;
        }
      }

      return {
        metadata: {
          ...defaultMetadata,
          ...metadata,
          name: metadata.name || defaultMetadata.name,
          tags: metadata.tags || [],
        },
        body,
      };
    }

    // No frontmatter - use defaults
    return {
      metadata: defaultMetadata,
      body: content.trim(),
    };
  }

  /**
   * Compare two semver version strings.
   * Returns: -1 (a < b), 0 (equal), 1 (a > b)
   */
  private compareVersions(a: string, b: string): number {
    const parseVersion = (v: string): number[] =>
      v.split('.').map((n) => parseInt(n, 10) || 0);

    const va = parseVersion(a);
    const vb = parseVersion(b);

    for (let i = 0; i < 3; i++) {
      if (va[i] < vb[i]) return -1;
      if (va[i] > vb[i]) return 1;
    }

    return 0;
  }
}
