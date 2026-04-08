// ============================================================================
// extensions - Skill registry, auto-generation, validation, and installation
// ============================================================================

export { SkillRegistry } from './SkillRegistry.js';
export type { SkillMetadata, SkillDefinition, SkillSearchParams } from './SkillRegistry.js';
export { SkillGenerator } from './SkillGenerator.js';
export type { GenerationResult, GenerationOptions } from './SkillGenerator.js';
export { SkillValidator } from './SkillValidator.js';
export type { ValidationResult, ValidationIssue } from './SkillValidator.js';
export { SkillInstaller, POPULAR_SKILL_REPOS, installSuperpowers } from './SkillInstaller.js';
export type { SkillInstallOptions, InstalledSkill } from './SkillInstaller.js';

/** Skill type alias for convenience */
export type Skill = import('./SkillRegistry.js').SkillDefinition;
