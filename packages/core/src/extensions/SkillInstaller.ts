// ============================================================================
// SkillInstaller - Install skills from GitHub repositories
// ============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';

export interface SkillInstallOptions {
  /** GitHub repository URL or shorthand (e.g., "obra/superpowers") */
  source: string;
  /** Target directory for installation (default: ~/.nova/skills/) */
  targetDir?: string;
  /** Specific skill names to install (default: all) */
  skills?: string[];
  /** Force overwrite existing skills */
  force?: boolean;
}

export interface InstalledSkill {
  name: string;
  path: string;
  source: string;
}

/**
 * Install skills from GitHub repositories
 * 
 * Supports formats:
 * - "obra/superpowers" -> https://github.com/obra/superpowers
 * - "https://github.com/obra/superpowers"
 * - Full GitHub URL
 */
export class SkillInstaller {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.join(os.homedir(), '.nova', 'skills');
  }

  /**
   * Install skills from a GitHub repository
   */
  async install(options: SkillInstallOptions): Promise<InstalledSkill[]> {
    const { source, targetDir, skills: specificSkills, force } = options;
    const target = targetDir || this.baseDir;

    // Parse GitHub URL
    const repoUrl = this.parseGitHubUrl(source);
    const repoName = repoUrl.split('/').pop() || 'unknown';

    console.log(`Installing skills from ${repoUrl}...`);

    // Create temp directory for cloning
    const tempDir = path.join(os.tmpdir(), `nova-skills-${Date.now()}`);

    try {
      // Clone repository
      console.log(`  Cloning repository...`);
      execSync(`git clone --depth 1 ${repoUrl} "${tempDir}"`, { stdio: 'pipe' });

      // Find skills directory
      const skillsDir = this.findSkillsDirectory(tempDir);
      if (!skillsDir) {
        throw new Error(`No skills directory found in ${repoName}`);
      }

      // Get all skills
      const availableSkills = this.listSkills(skillsDir);
      const toInstall = specificSkills 
        ? availableSkills.filter(s => specificSkills.includes(s))
        : availableSkills;

      if (toInstall.length === 0) {
        throw new Error(`No matching skills found`);
      }

      // Install each skill
      const installed: InstalledSkill[] = [];
      for (const skillName of toInstall) {
        const srcPath = path.join(skillsDir, skillName);
        const destPath = path.join(target, skillName);

        // Check if exists
        if (fs.existsSync(destPath) && !force) {
          console.log(`  ⚠ ${skillName} already exists, use --force to overwrite`);
          continue;
        }

        // Copy skill
        this.copySkill(srcPath, destPath);
        installed.push({ name: skillName, path: destPath, source: repoUrl });
        console.log(`  ✓ Installed: ${skillName}`);
      }

      return installed;
    } finally {
      // Cleanup temp directory
      this.rmrf(tempDir);
    }
  }

  /**
   * Parse various Git repository URL formats (GitHub, Gitee, etc.)
   */
  private parseGitHubUrl(source: string): string {
    // Already a full URL (GitHub, Gitee, GitLab, etc.)
    if (source.startsWith('https://') || source.startsWith('git@')) {
      return source;
    }

    // Gitee shorthand: "gitee:owner/repo"
    if (source.startsWith('gitee:')) {
      const repoPath = source.substring(6); // Remove 'gitee:'
      return `https://gitee.com/${repoPath}.git`;
    }

    // GitHub shorthand: "owner/repo"
    if (source.match(/^[\w-]+\/[\w-]+$/)) {
      return `https://github.com/${source}.git`;
    }

    // Assume it's a GitHub shorthand
    return `https://github.com/${source}.git`;
  }

  /**
   * Find the skills directory in a repository
   */
  private findSkillsDirectory(repoDir: string): string | null {
    // Common skill directory names
    const candidates = ['skills', '.claude/skills', 'plugins', '.skills'];

    for (const name of candidates) {
      const fullPath = path.join(repoDir, name);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
        // Verify it contains SKILL.md files
        const entries = fs.readdirSync(fullPath);
        const hasSkills = entries.some(entry => {
          const skillPath = path.join(fullPath, entry);
          return fs.statSync(skillPath).isDirectory() && 
                 fs.existsSync(path.join(skillPath, 'SKILL.md'));
        });
        if (hasSkills) return fullPath;
      }
    }

    return null;
  }

  /**
   * List all skill directories
   */
  private listSkills(skillsDir: string): string[] {
    return fs.readdirSync(skillsDir).filter(entry => {
      const skillPath = path.join(skillsDir, entry);
      return fs.statSync(skillPath).isDirectory() &&
             fs.existsSync(path.join(skillPath, 'SKILL.md'));
    });
  }

  /**
   * Copy a skill directory
   */
  private copySkill(src: string, dest: string): void {
    // Create destination
    fs.mkdirSync(dest, { recursive: true });

    // Copy all files
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copySkill(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * Recursive delete
   */
  private rmrf(dir: string): void {
    if (!fs.existsSync(dir)) return;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        this.rmrf(fullPath);
      } else {
        fs.unlinkSync(fullPath);
      }
    }
    fs.rmdirSync(dir);
  }

  /**
   * List installed skills
   */
  listInstalled(): string[] {
    if (!fs.existsSync(this.baseDir)) return [];
    return fs.readdirSync(this.baseDir).filter(name => {
      return fs.existsSync(path.join(this.baseDir, name, 'SKILL.md'));
    });
  }

  /**
   * Uninstall a skill
   */
  uninstall(skillName: string): boolean {
    const skillPath = path.join(this.baseDir, skillName);
    if (!fs.existsSync(skillPath)) return false;
    this.rmrf(skillPath);
    return true;
  }
}

/**
 * Popular skill repositories
 */
export const POPULAR_SKILL_REPOS = {
  superpowers: {
    // Default to Gitee mirror for better accessibility in China
    url: 'gitee:anderson2/superpowers',
    description: 'Agentic skills framework - TDD, debugging, code review, planning',
    skills: [
      'brainstorming',
      'writing-plans',
      'executing-plans',
      'test-driven-development',
      'systematic-debugging',
      'requesting-code-review',
      'receiving-code-review',
      'using-git-worktrees',
      'finishing-a-development-branch',
      'subagent-driven-development',
      'verification-before-completion',
      'writing-skills',
    ],
  },
};

/**
 * Quick install function
 */
export async function installSuperpowers(baseDir?: string): Promise<InstalledSkill[]> {
  const installer = new SkillInstaller(baseDir);
  return installer.install({
    source: 'gitee:anderson2/superpowers',
    force: false,
  });
}
