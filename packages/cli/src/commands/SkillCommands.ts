// ============================================================================
// Skill Commands - CLI commands for skill management
// ============================================================================

import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { prompt } from 'inquirer';
import { Octokit } from '@octokit/rest';
import { spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(spawn);

interface SkillMetadata {
  name: string;
  description: string;
  version: string;
  author?: string;
  category?: string;
  tags?: string[];
  installedAt: string;
  source: string;
  path: string;
}

interface GitHubSkill {
  name: string;
  description: string;
  path: string;
  defaultBranch?: string;
}

export class SkillCommands {
  private skillsDir: string;
  private octokit: Octokit | null;
  private gitHubRepo: string;

  constructor() {
    this.skillsDir = path.join(os.homedir(), '.nova-cli', 'skills');
    this.octokit = null;
    this.gitHubRepo = 'https://github.com/daymade/claude-code-skills';
  }

  /**
   * Initialize skills directory
   */
  private async initializeSkillsDir(): Promise<void> {
    await fs.mkdir(this.skillsDir, { recursive: true });
  }

  /**
   * Get all installed skills
   */
  async getInstalledSkills(): Promise<SkillMetadata[]> {
    await this.initializeSkillsDir();
    
    const skills: SkillMetadata[] = [];
    const entries = await fs.readdir(this.skillsDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        try {
          const metadataPath = path.join(this.skillsDir, entry.name, 'skill.json');
          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
          skills.push(metadata);
        } catch {
          // No metadata, create basic entry
          skills.push({
            name: entry.name,
            description: 'No description available',
            version: '1.0.0',
            installedAt: new Date().toISOString(),
            source: 'unknown',
            path: path.join(this.skillsDir, entry.name),
          });
        }
      }
    }
    
    return skills;
  }

  /**
   * Search for skills
   */
  async searchSkills(query: string): Promise<SkillMetadata[]> {
    const skills = await this.getInstalledSkills();
    const lowerQuery = query.toLowerCase();
    
    return skills.filter(skill => 
      skill.name.toLowerCase().includes(lowerQuery) ||
      skill.description.toLowerCase().includes(lowerQuery) ||
      skill.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get skill info
   */
  async getSkillInfo(name: string): Promise<SkillMetadata | null> {
    const skills = await this.getInstalledSkills();
    return skills.find(s => s.name === name) || null;
  }

  /**
   * Integrate skills from SkillsHub
   */
  async integrateSkills(): Promise<void> {
    console.log('Integrating skills from SkillsHub...');
    
    try {
      // Run the integration script
      const scriptPath = path.join(process.cwd(), 'scripts', 'integrate-skills.ts');
      
      if (!await fs.access(scriptPath).then(() => true).catch(() => false)) {
        console.error('Integration script not found at:', scriptPath);
        return;
      }
      
      const { stdout, stderr } = await execAsync('npx', ['ts-node', scriptPath], {
        cwd: process.cwd(),
        stdio: 'inherit',
      });
      
      if (stderr) {
        console.error('Integration errors:', stderr);
      }
      
      console.log('Skills integration completed');
    } catch (error) {
      console.error('Failed to integrate skills:', error);
    }
  }

  /**
   * Initialize GitHub API client
   */
  private async initializeGitHubClient(): Promise<void> {
    try {
      // Try to get GitHub token from environment
      const token = process.env.GITHUB_TOKEN;
      
      if (token) {
        this.octokit = new Octokit({ auth: token });
      } else {
        // Use unauthenticated client (rate limited)
        this.octokit = new Octokit();
      }
    } catch (error) {
      console.error('Failed to initialize GitHub client:', error);
      this.octokit = null;
    }
  }

  /**
   * Fetch available skills from GitHub repository
   */
  async fetchGitHubSkills(): Promise<GitHubSkill[]> {
    if (!this.octokit) {
      await this.initializeGitHubClient();
    }
    
    try {
      // Parse repository URL
      const repoUrl = new URL(this.gitHubRepo);
      const owner = repoUrl.pathname.split('/')[1];
      const repo = repoUrl.pathname.split('/')[2];
      
      if (!owner || !repo) {
        throw new Error('Invalid GitHub repository URL');
      }
      
      // Get repository contents
      const { data } = await this.octokit!.repos.getContents({
        owner,
        repo,
        path: '',
      });
      
      if (!Array.isArray(data)) {
        throw new Error('Unexpected response from GitHub API');
      }
      
      // Filter for skill directories (those with SKILL.md)
      const skills: GitHubSkill[] = [];
      
      for (const item of data) {
        if (item.type === 'dir') {
          try {
            // Check if directory has SKILL.md
            const skillCheck = await this.octokit!.repos.getContents({
              owner,
              repo,
              path: `${item.name}/SKILL.md`,
            });
            
            if (skillCheck.data) {
              // Get description from README if available
              let description = '';
              try {
                const readmeCheck = await this.octokit!.repos.getContents({
                  owner,
                  repo,
                  path: `${item.name}/README.md`,
                });
                
                if (readmeCheck.data && typeof readmeCheck.data === 'object' && 'content' in readmeCheck.data) {
                  const content = Buffer.from(readmeCheck.data.content, 'base64').toString('utf-8');
                  const lines = content.split('\n');
                  const firstPara = lines.find(line => line.trim() && !line.trim().startsWith('#'));
                  if (firstPara) {
                    description = firstPara.trim().substring(0, 200);
                  }
                }
              } catch {
                // No README, that's fine
              }
              
              skills.push({
                name: item.name,
                description,
                path: item.path,
                defaultBranch: 'main',
              });
            }
          } catch {
            // No SKILL.md, skip this directory
          }
        }
      }
      
      return skills;
    } catch (error) {
      console.error('Failed to fetch skills from GitHub:', error);
      throw error;
    }
  }

  /**
   * Install skill from GitHub
   */
  async installGitHubSkill(skillName: string): Promise<void> {
    try {
      console.log(`Installing skill: ${skillName}`);
      
      // Parse repository URL
      const repoUrl = new URL(this.gitHubRepo);
      const owner = repoUrl.pathname.split('/')[1];
      const repo = repoUrl.pathname.split('/')[2];
      
      if (!owner || !repo) {
        throw new Error('Invalid GitHub repository URL');
      }
      
      // Create temporary directory for cloning
      const tempDir = path.join(os.tmpdir(), `nova-skill-${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });
      
      try {
        // Clone repository
        console.log('Cloning repository...');
        await execAsync('git', ['clone', '--depth', '1', this.gitHubRepo, tempDir], {
          stdio: 'inherit',
        });
        
        // Copy skill directory
        const skillSourceDir = path.join(tempDir, skillName);
        const skillTargetDir = path.join(this.skillsDir, skillName);
        
        // Check if skill already exists
        const existingSkills = await this.getInstalledSkills();
        const existingSkill = existingSkills.find(s => s.name === skillName);
        
        if (existingSkill) {
          console.log(`Skill "${skillName}" already exists. Preserving existing version.`);
          return;
        }
        
        // Copy skill files
        await fs.mkdir(skillTargetDir, { recursive: true });
        await this.copyDirectoryRecursive(skillSourceDir, skillTargetDir);
        
        // Create metadata
        const metadata: SkillMetadata = {
          name: skillName,
          description: `Skill from ${this.gitHubRepo}`,
          version: '1.0.0',
          installedAt: new Date().toISOString(),
          source: this.gitHubRepo,
          path: skillTargetDir,
        };
        
        await fs.writeFile(
          path.join(skillTargetDir, 'skill.json'),
          JSON.stringify(metadata, null, 2)
        );
        
        console.log(`Successfully installed skill: ${skillName}`);
      } finally {
        // Clean up temporary directory
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      console.error(`Failed to install skill "${skillName}":`, error);
      throw error;
    }
  }

  /**
   * Copy directory recursively
   */
  private async copyDirectoryRecursive(sourceDir: string, targetDir: string): Promise<void> {
    const entries = await fs.readdir(sourceDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry.name);
      const targetPath = path.join(targetDir, entry.name);
      
      if (entry.isDirectory()) {
        await fs.mkdir(targetPath, { recursive: true });
        await this.copyDirectoryRecursive(sourcePath, targetPath);
      } else {
        await fs.copyFile(sourcePath, targetPath);
      }
    }
  }

  /**
   * Add custom skill from local path
   */
  async addCustomSkill(skillPath: string): Promise<void> {
    try {
      console.log(`Adding custom skill from: ${skillPath}`);
      
      const resolvedPath = path.resolve(skillPath);
      
      // Check if path exists
      const stat = await fs.stat(resolvedPath);
      if (!stat.isDirectory()) {
        throw new Error('Skill path must be a directory');
      }
      
      // Get skill name from directory name
      const skillName = path.basename(resolvedPath);
      const targetDir = path.join(this.skillsDir, skillName);
      
      // Check if skill already exists
      const existingSkills = await this.getInstalledSkills();
      const existingSkill = existingSkills.find(s => s.name === skillName);
      
      if (existingSkill) {
        console.log(`Skill "${skillName}" already exists. Preserving existing version.`);
        return;
      }
      
      // Copy skill files
      await fs.mkdir(targetDir, { recursive: true });
      await this.copyDirectoryRecursive(resolvedPath, targetDir);
      
      // Try to extract description from SKILL.md or README.md
      let description = 'Custom skill';
      try {
        const skillMdPath = path.join(resolvedPath, 'SKILL.md');
        const readmeMdPath = path.join(resolvedPath, 'README.md');
        
        const descriptionFile = await fs.access(skillMdPath).then(() => skillMdPath)
          .catch(() => fs.access(readmeMdPath).then(() => readmeMdPath).catch(() => null));
        
        if (descriptionFile) {
          const content = await fs.readFile(descriptionFile, 'utf-8');
          const lines = content.split('\n');
          const firstPara = lines.find(line => line.trim() && !line.trim().startsWith('#'));
          if (firstPara) {
            description = firstPara.trim().substring(0, 200);
          }
        }
      } catch {
        // Ignore description extraction errors
      }
      
      // Create metadata
      const metadata: SkillMetadata = {
        name: skillName,
        description,
        version: '1.0.0',
        installedAt: new Date().toISOString(),
        source: 'custom',
        path: resolvedPath,
      };
      
      await fs.writeFile(
        path.join(targetDir, 'skill.json'),
        JSON.stringify(metadata, null, 2)
      );
      
      console.log(`Successfully added custom skill: ${skillName}`);
    } catch (error) {
      console.error('Failed to add custom skill:', error);
      throw error;
    }
  }

  /**
   * Remove a skill
   */
  async removeSkill(skillName: string): Promise<void> {
    try {
      const skillDir = path.join(this.skillsDir, skillName);
      
      // Check if skill exists
      const stat = await fs.stat(skillDir);
      if (!stat.isDirectory()) {
        throw new Error(`Skill "${skillName}" not found`);
      }
      
      // Remove directory
      await fs.rm(skillDir, { recursive: true, force: true });
      
      console.log(`Successfully removed skill: ${skillName}`);
    } catch (error) {
      console.error(`Failed to remove skill "${skillName}":`, error);
      throw error;
    }
  }

  /**
   * Enable a skill for current session
   */
  async enableSkill(skillName: string): Promise<void> {
    // This would typically load the skill into the current agent context
    console.log(`Enabling skill: ${skillName}`);
    
    const skill = await this.getSkillInfo(skillName);
    if (!skill) {
      throw new Error(`Skill "${skillName}" not found`);
    }
    
    // Check for script file
    if (skill.path) {
      const scriptPath = path.join(this.skillsDir, skillName, 'script.js');
      try {
        await fs.access(scriptPath);
        console.log(`Skill "${skillName}" can be loaded from: ${scriptPath}`);
      } catch {
        // No script file, that's fine
      }
    }
    
    console.log(`Skill "${skillName}" enabled for current session`);
  }

  /**
   * Disable a skill for current session
   */
  async disableSkill(skillName: string): Promise<void> {
    console.log(`Disabling skill: ${skillName}`);
    console.log(`Skill "${skillName}" disabled for current session`);
  }

  /**
   * Interactive skill selector
   */
  async interactiveSkillSelector(): Promise<string | null> {
    try {
      const skills = await this.fetchGitHubSkills();
      
      if (skills.length === 0) {
        console.log('No skills found in the repository');
        return null;
      }
      
      const { selectedSkill } = await prompt([
        {
          type: 'list',
          name: 'selectedSkill',
          message: 'Select a skill to install:',
          choices: skills.map(skill => ({
            name: `${skill.name} - ${skill.description || 'No description'}`,
            value: skill.name,
          })),
          pageSize: 20,
        },
      ]);
      
      return selectedSkill;
    } catch (error) {
      console.error('Failed to show skill selector:', error);
      return null;
    }
  }

  /**
   * Register all skill commands
   */
  registerCommands(program: Command): void {
    const skillsCommand = program.command('skills').alias('skill').description('Manage skills');

    // List skills
    skillsCommand
      .command('list')
      .alias('ls')
      .description('List all installed skills')
      .action(async () => {
        const skills = await this.getInstalledSkills();
        
        if (skills.length === 0) {
          console.log('No skills installed');
          return;
        }
        
        console.log('Installed skills:');
        console.log('=' .repeat(60));
        
        for (const skill of skills) {
          console.log(`Name: ${skill.name}`);
          console.log(`Description: ${skill.description}`);
          console.log(`Version: ${skill.version}`);
          if (skill.author) console.log(`Author: ${skill.author}`);
          if (skill.category) console.log(`Category: ${skill.category}`);
          if (skill.tags && skill.tags.length > 0) console.log(`Tags: ${skill.tags.join(', ')}`);
          console.log(`Source: ${skill.source}`);
          console.log(`Installed: ${new Date(skill.installedAt).toLocaleDateString()}`);
          console.log('-'.repeat(60));
        }
      });

    // Search skills
    skillsCommand
      .command('search <query>')
      .description('Search for skills')
      .action(async (query) => {
        const skills = await this.searchSkills(query);
        
        if (skills.length === 0) {
          console.log(`No skills found matching: ${query}`);
          return;
        }
        
        console.log(`Found ${skills.length} skill(s) matching: ${query}`);
        for (const skill of skills) {
          console.log(`• ${skill.name}: ${skill.description}`);
        }
      });

    // Info command
    skillsCommand
      .command('info <name>')
      .description('Show skill details')
      .action(async (name) => {
        const skill = await this.getSkillInfo(name);
        
        if (!skill) {
          console.error(`Skill "${name}" not found`);
          return;
        }
        
        console.log(`Skill: ${skill.name}`);
        console.log(`Description: ${skill.description}`);
        console.log(`Version: ${skill.version}`);
        if (skill.author) console.log(`Author: ${skill.author}`);
        if (skill.category) console.log(`Category: ${skill.category}`);
        if (skill.tags && skill.tags.length > 0) console.log(`Tags: ${skill.tags.join(', ')}`);
        console.log(`Source: ${skill.source}`);
        console.log(`Path: ${skill.path}`);
        console.log(`Installed: ${new Date(skill.installedAt).toLocaleString()}`);
      });

    // Integrate skills from SkillsHub
    skillsCommand
      .command('integrate')
      .description('Integrate skills from SkillsHub folder')
      .action(async () => {
        await this.integrateSkills();
      });

    // GitHub skills server
    skillsCommand
      .command('server')
      .description('Browse and install skills from GitHub repository')
      .action(async () => {
        console.log(`Connecting to GitHub repository: ${this.gitHubRepo}`);
        
        try {
          const selectedSkill = await this.interactiveSkillSelector();
          
          if (selectedSkill) {
            console.log(`Installing selected skill: ${selectedSkill}`);
            await this.installGitHubSkill(selectedSkill);
          } else {
            console.log('No skill selected');
          }
        } catch (error) {
          console.error('Failed to browse skills:', error);
        }
      });

    // Add custom skill
    skillsCommand
      .command('add <path>')
      .description('Add custom skill from local path')
      .action(async (skillPath) => {
        try {
          await this.addCustomSkill(skillPath);
        } catch (error) {
          console.error('Failed to add skill:', error);
        }
      });

    // Remove skill
    skillsCommand
      .command('remove <name>')
      .description('Remove a skill')
      .action(async (name) => {
        try {
          await this.removeSkill(name);
        } catch (error) {
          console.error('Failed to remove skill:', error);
        }
      });

    // Enable skill
    skillsCommand
      .command('enable <name>')
      .description('Enable a skill for current session')
      .action(async (name) => {
        try {
          await this.enableSkill(name);
        } catch (error) {
          console.error('Failed to enable skill:', error);
        }
      });

    // Disable skill
    skillsCommand
      .command('disable <name>')
      .description('Disable a skill for current session')
      .action(async (name) => {
        try {
          await this.disableSkill(name);
        } catch (error) {
          console.error('Failed to disable skill:', error);
        }
      });
  }
}

export default SkillCommands;