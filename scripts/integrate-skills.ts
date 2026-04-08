#!/usr/bin/env node
// ============================================================================
// SkillsHub Integration Script - Integrates skills from SkillsHub folder
// ============================================================================

const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

interface SkillDefinition {
  name: string;
  description: string;
  version: string;
  author?: string;
  category?: string;
  tags?: string[];
  scriptFile?: string;
  assets?: string[];
}

interface IntegrationResult {
  success: boolean;
  skillName: string;
  message: string;
  error?: string;
}

class SkillsHubIntegrator {
  private skillsHubPath: string;
  private skillsInstallPath: string;
  private existingSkills: Set<string>;

  constructor() {
    this.skillsHubPath = path.join(process.cwd(), 'SkillsHub');
    this.skillsInstallPath = path.join(os.homedir(), '.nova-cli', 'skills');
    this.existingSkills = new Set();
  }

  /**
   * Initialize the integrator
   */
  async initialize(): Promise<void> {
    try {
      // Ensure skills directory exists
      await fs.mkdir(this.skillsInstallPath, { recursive: true });
      
      // Get list of existing skills
      const existingDirs = await fs.readdir(this.skillsInstallPath, { withFileTypes: true });
      for (const dir of existingDirs) {
        if (dir.isDirectory()) {
          this.existingSkills.add(dir.name);
        }
      }
      
      console.log(`Found ${this.existingSkills.size} existing skills`);
    } catch (error) {
      console.error('Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Parse SKILL.md file to extract skill definition
   */
  async parseSkillDefinition(skillDir: string): Promise<SkillDefinition | null> {
    try {
      const skillMdPath = path.join(skillDir, 'SKILL.md');
      const content = await fs.readFile(skillMdPath, 'utf-8');
      
      // Simple parsing - extract metadata from YAML frontmatter or comments
      const lines = content.split('\n');
      const definition: SkillDefinition = {
        name: path.basename(skillDir),
        description: '',
        version: '1.0.0',
      };
      
      // Look for metadata in comments or YAML-like format
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('//')) {
          const metaMatch = trimmed.match(/@(\w+)\s+(.+)/);
          if (metaMatch) {
            const [, key, value] = metaMatch;
            switch (key) {
              case 'name':
                definition.name = value;
                break;
              case 'description':
                definition.description = value;
                break;
              case 'version':
                definition.version = value;
                break;
              case 'author':
                definition.author = value;
                break;
              case 'category':
                definition.category = value;
                break;
              case 'tags':
                definition.tags = value.split(',').map((t: string) => t.trim());
                break;
              case 'script':
                definition.scriptFile = value;
                break;
            }
          }
        }
      }
      
      // If no description found, use first paragraph
      if (!definition.description) {
        const firstPara = lines.find((line: string) => line.trim() && !line.trim().startsWith('#'));
        if (firstPara) {
          definition.description = firstPara.trim().substring(0, 200);
        }
      }
      
      return definition;
    } catch (error) {
      console.warn(`Failed to parse skill definition for ${skillDir}:`, error);
      return null;
    }
  }

  /**
   * Check if skill already exists and should be preserved
   */
  shouldPreserveExisting(skillName: string): boolean {
    // As requested: preserve existing skills on conflict
    return this.existingSkills.has(skillName);
  }

  /**
   * Copy skill files to installation directory
   */
  async copySkillFiles(skillDir: string, skillName: string): Promise<void> {
    const targetDir = path.join(this.skillsInstallPath, skillName);
    
    // Create target directory
    await fs.mkdir(targetDir, { recursive: true });
    
    // Copy all files
    const entries = await fs.readdir(skillDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const sourcePath = path.join(skillDir, entry.name);
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
   * Recursively copy directory
   */
  async copyDirectoryRecursive(sourceDir: string, targetDir: string): Promise<void> {
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
   * Generate skill metadata file
   */
  async generateSkillMetadata(skillDir: string, definition: SkillDefinition): Promise<void> {
    const targetDir = path.join(this.skillsInstallPath, definition.name);
    const metadata = {
      ...definition,
      installedAt: new Date().toISOString(),
      source: 'SkillsHub',
      path: skillDir,
    };
    
    await fs.writeFile(
      path.join(targetDir, 'skill.json'),
      JSON.stringify(metadata, null, 2)
    );
  }

  /**
   * Integrate a single skill
   */
  async integrateSkill(skillDir: string): Promise<IntegrationResult> {
    const skillName = path.basename(skillDir);
    
    try {
      console.log(`Processing skill: ${skillName}`);
      
      // Parse skill definition
      const definition = await this.parseSkillDefinition(skillDir);
      if (!definition) {
        return {
          success: false,
          skillName,
          message: 'Failed to parse skill definition',
          error: 'Invalid or missing SKILL.md',
        };
      }
      
      // Check for conflicts
      if (this.shouldPreserveExisting(definition.name)) {
        return {
          success: true,
          skillName: definition.name,
          message: 'Skill already exists, preserving existing version',
        };
      }
      
      // Copy files
      await this.copySkillFiles(skillDir, definition.name);
      
      // Generate metadata
      await this.generateSkillMetadata(skillDir, definition);
      
      // Add to existing skills set
      this.existingSkills.add(definition.name);
      
      return {
        success: true,
        skillName: definition.name,
        message: 'Successfully integrated',
      };
    } catch (error) {
      return {
        success: false,
        skillName,
        message: 'Integration failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Integrate all skills from SkillsHub
   */
  async integrateAllSkills(): Promise<IntegrationResult[]> {
    const results: IntegrationResult[] = [];
    
    try {
      const entries = await fs.readdir(this.skillsHubPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillDir = path.join(this.skillsHubPath, entry.name);
          const result = await this.integrateSkill(skillDir);
          results.push(result);
          
          if (result.success) {
            console.log(`✓ ${result.skillName}: ${result.message}`);
          } else {
            console.error(`✗ ${result.skillName}: ${result.message}`);
            if (result.error) {
              console.error(`  Error: ${result.error}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to read SkillsHub directory:', error);
    }
    
    return results;
  }

  /**
   * Generate summary report
   */
  generateReport(results: IntegrationResult[]): string {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const preserved = successful.filter(r => r.message.includes('preserving'));
    const integrated = successful.filter(r => !r.message.includes('preserving'));
    
    let report = 'SkillsHub Integration Report\n';
    report += '=' .repeat(40) + '\n\n';
    report += `Total skills processed: ${results.length}\n`;
    report += `Successfully integrated: ${integrated.length}\n`;
    report += `Preserved existing: ${preserved.length}\n`;
    report += `Failed: ${failed.length}\n\n`;
    
    if (integrated.length > 0) {
      report += 'Newly integrated skills:\n';
      for (const result of integrated) {
        report += `  • ${result.skillName}: ${result.message}\n`;
      }
      report += '\n';
    }
    
    if (preserved.length > 0) {
      report += 'Preserved existing skills:\n';
      for (const result of preserved) {
        report += `  • ${result.skillName}: ${result.message}\n`;
      }
      report += '\n';
    }
    
    if (failed.length > 0) {
      report += 'Failed integrations:\n';
      for (const result of failed) {
        report += `  • ${result.skillName}: ${result.message}\n`;
        if (result.error) {
          report += `    Error: ${result.error}\n`;
        }
      }
      report += '\n';
    }
    
    report += `Skills are installed in: ${this.skillsInstallPath}\n`;
    
    return report;
  }
}

// ============================================================================
// Main execution
// ============================================================================

async function main() {
  console.log('SkillsHub Integration Script');
  console.log('=' .repeat(40));
  
  const integrator = new SkillsHubIntegrator();
  
  try {
    await integrator.initialize();
    const results = await integrator.integrateAllSkills();
    const report = integrator.generateReport(results);
    
    console.log('\n' + report);
    
    // Save report to file
    const reportPath = path.join(process.cwd(), 'skills-integration-report.md');
    await fs.writeFile(reportPath, report);
    console.log(`Report saved to: ${reportPath}`);
    
    // Exit with appropriate code
    const failedCount = results.filter(r => !r.success).length;
    process.exit(failedCount > 0 ? 1 : 0);
  } catch (error) {
    console.error('Integration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { SkillsHubIntegrator };