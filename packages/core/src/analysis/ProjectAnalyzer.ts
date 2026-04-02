// ============================================================================
// ProjectAnalyzer - 快速项目分析工具
// 用于生成准确的项目简介文档，帮助智能体快速理解项目结构
// ============================================================================

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, dirname, basename, extname } from 'node:path';

// --- Types ---

export interface ProjectStructure {
  name: string;
  rootDir: string;
  description?: string;
  type: ProjectType;
  techStack: TechStack;
  directories: DirectoryInfo[];
  keyFiles: KeyFileInfo[];
  dependencies: DependencyInfo;
  codeMetrics: CodeMetrics;
  patterns: PatternInfo[];
}

export type ProjectType = 'unknown' | 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'desktop' | 'library' | 'cli' | 'monorepo';

export interface TechStack {
  languages: string[];
  frameworks: string[];
  tools: string[];
  testing: string[];
  buildTools: string[];
}

export interface DirectoryInfo {
  path: string;
  name: string;
  fileCount: number;
  subdirs: string[];
  purpose: string;
}

export interface KeyFileInfo {
  path: string;
  name: string;
  type: 'config' | 'entry' | 'readme' | 'test' | 'documentation' | 'main';
  description: string;
  size: number;
}

export interface DependencyInfo {
  production: Record<string, string>;
  development: Record<string, string>;
  peer: Record<string, string>;
  internal: string[];
}

export interface CodeMetrics {
  totalFiles: number;
  totalLines: number;
  languageBreakdown: Record<string, { files: number; lines: number }>;
  largestFiles: Array<{ path: string; lines: number }>;
}

export interface PatternInfo {
  type: 'architecture' | 'state-management' | 'routing' | 'styling' | 'api' | 'database' | 'testing';
  pattern: string;
  confidence: number;
  evidence: string[];
}

export interface AnalyzerOptions {
  maxDepth?: number;
  includeTests?: boolean;
  includeNodeModules?: boolean;
  analyzeImports?: boolean;
}

// --- ProjectAnalyzer ---

export class ProjectAnalyzer {
  private rootDir: string;
  private options: Required<AnalyzerOptions>;
  private cache = new Map<string, any>();

  constructor(rootDir: string, options: AnalyzerOptions = {}) {
    this.rootDir = rootDir;
    this.options = {
      maxDepth: options.maxDepth ?? 5,
      includeTests: options.includeTests ?? true,
      includeNodeModules: options.includeNodeModules ?? false,
      analyzeImports: options.analyzeImports ?? true,
    };
  }

  /**
   * 分析项目并生成结构化报告
   */
  async analyze(): Promise<ProjectStructure> {
    console.log('  Analyzing project...');

    const structure: ProjectStructure = {
      name: basename(this.rootDir),
      rootDir: this.rootDir,
      type: await this.detectProjectType(),
      techStack: await this.detectTechStack(),
      directories: await this.analyzeDirectories(),
      keyFiles: await this.identifyKeyFiles(),
      dependencies: await this.analyzeDependencies(),
      codeMetrics: await this.calculateCodeMetrics(),
      patterns: await this.detectPatterns(),
    };

    return structure;
  }

  /**
   * 生成 Markdown 格式的项目文档
   */
  generateMarkdown(structure: ProjectStructure): string {
    let md = '';

    // 标题
    md += `# ${structure.name} - Project Analysis\n\n`;

    // 项目概览
    md += '## Project Overview\n\n';
    md += `- **Type**: ${this.formatProjectType(structure.type)}\n`;
    md += `- **Root Directory**: \`${structure.rootDir}\`\n`;
    if (structure.description) {
      md += `- **Description**: ${structure.description}\n`;
    }
    md += '\n';

    // 技术栈
    md += '## Tech Stack\n\n';
    md += '### Languages\n';
    structure.techStack.languages.forEach(lang => md += `- ${lang}\n`);
    md += '\n';

    if (structure.techStack.frameworks.length > 0) {
      md += '### Frameworks\n';
      structure.techStack.frameworks.forEach(fw => md += `- ${fw}\n`);
      md += '\n';
    }

    if (structure.techStack.tools.length > 0) {
      md += '### Tools\n';
      structure.techStack.tools.forEach(tool => md += `- ${tool}\n`);
      md += '\n';
    }

    if (structure.techStack.testing.length > 0) {
      md += '### Testing\n';
      structure.techStack.testing.forEach(test => md += `- ${test}\n`);
      md += '\n';
    }

    if (structure.techStack.buildTools.length > 0) {
      md += '### Build Tools\n';
      structure.techStack.buildTools.forEach(bt => md += `- ${bt}\n`);
      md += '\n';
    }

    // 目录结构
    md += '## Directory Structure\n\n';
    structure.directories.forEach(dir => {
      md += `### ${dir.name}/\n`;
      md += `- **Purpose**: ${dir.purpose}\n`;
      md += `- **Files**: ${dir.fileCount}\n`;
      if (dir.subdirs.length > 0) {
        md += `- **Subdirectories**: ${dir.subdirs.map(s => `\`${s}\``).join(', ')}\n`;
      }
      md += '\n';
    });

    // 关键文件
    md += '## Key Files\n\n';
    structure.keyFiles.forEach(file => {
      md += `### ${file.name}\n`;
      md += `- **Path**: \`${relative(this.rootDir, file.path)}\`\n`;
      md += `- **Type**: ${file.type}\n`;
      md += `- **Size**: ${(file.size / 1024).toFixed(2)} KB\n`;
      if (file.description) {
        md += `- **Description**: ${file.description}\n`;
      }
      md += '\n';
    });

    // 依赖关系
    md += '## Dependencies\n\n';
    if (Object.keys(structure.dependencies.production).length > 0) {
      md += '### Production Dependencies\n';
      Object.entries(structure.dependencies.production).forEach(([name, version]) => {
        md += `- \`${name}\`: ${version}\n`;
      });
      md += '\n';
    }

    if (Object.keys(structure.dependencies.development).length > 0) {
      md += '### Development Dependencies\n';
      Object.entries(structure.dependencies.development).slice(0, 10).forEach(([name, version]) => {
        md += `- \`${name}\`: ${version}\n`;
      });
      if (Object.keys(structure.dependencies.development).length > 10) {
        md += `- ... and ${Object.keys(structure.dependencies.development).length - 10} more\n`;
      }
      md += '\n';
    }

    // 代码统计
    md += '## Code Metrics\n\n';
    md += `- **Total Files**: ${structure.codeMetrics.totalFiles}\n`;
    md += `- **Total Lines**: ${structure.codeMetrics.totalLines.toLocaleString()}\n`;
    md += '\n';

    md += '### Language Breakdown\n';
    Object.entries(structure.codeMetrics.languageBreakdown)
      .sort((a, b) => b[1].lines - a[1].lines)
      .forEach(([lang, stats]) => {
        const percentage = ((stats.lines / structure.codeMetrics.totalLines) * 100).toFixed(1);
        md += `- ${lang}: ${stats.files} files, ${stats.lines.toLocaleString()} lines (${percentage}%)\n`;
      });
    md += '\n';

    if (structure.codeMetrics.largestFiles.length > 0) {
      md += '### Largest Files\n';
      structure.codeMetrics.largestFiles.slice(0, 5).forEach(file => {
        md += `- \`${relative(this.rootDir, file.path)}\`: ${file.lines.toLocaleString()} lines\n`;
      });
      md += '\n';
    }

    // 架构模式
    if (structure.patterns.length > 0) {
      md += '## Architecture Patterns\n\n';
      structure.patterns.forEach(pattern => {
        md += `### ${pattern.type}: ${pattern.pattern}\n`;
        md += `- **Confidence**: ${(pattern.confidence * 100).toFixed(0)}%\n`;
        if (pattern.evidence.length > 0) {
          md += '- **Evidence**:\n';
          pattern.evidence.slice(0, 3).forEach(ev => md += `  - ${ev}\n`);
        }
        md += '\n';
      });
    }

    // 重构建议
    md += '## Refactoring Suggestions\n\n';
    md += this.generateRefactoringSuggestions(structure);
    md += '\n';

    return md;
  }

  // --- Private Methods ---

  private async detectProjectType(): Promise<ProjectType> {
    const hasFile = async (path: string) => {
      try {
        await stat(join(this.rootDir, path));
        return true;
      } catch {
        return false;
      }
    };

    const hasDir = async (path: string) => {
      try {
        const s = await stat(join(this.rootDir, path));
        return s.isDirectory();
      } catch {
        return false;
      }
    };

    // Check for monorepo
    if (await hasFile('pnpm-workspace.yaml') || await hasFile('lerna.json') || await hasFile('turbo.json')) {
      return 'monorepo';
    }

    // Check for frontend
    if (await hasFile('package.json')) {
      const pkg = await this.readPackageJson();
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps['react'] || deps['vue'] || deps['angular'] || deps['svelte']) {
        if (deps['next'] || deps['nuxt']) return 'fullstack';
        if (deps['express'] || deps['koa'] || deps['fastify']) return 'fullstack';
        return 'frontend';
      }

      if (deps['electron']) return 'desktop';
      if (deps['react-native'] || deps['expo']) return 'mobile';
      if (deps['express'] || deps['koa'] || deps['fastify'] || deps['nest']) return 'backend';
    }

    // Check for CLI tools
    if (await hasFile('bin') || await hasFile('cli')) {
      return 'cli';
    }

    // Check for library
    if (await hasFile('package.json')) {
      const pkg = await this.readPackageJson();
      if (pkg.type === 'module' || pkg.main || pkg.exports) {
        return 'library';
      }
    }

    return 'unknown';
  }

  private async detectTechStack(): Promise<TechStack> {
    const stack: TechStack = {
      languages: [],
      frameworks: [],
      tools: [],
      testing: [],
      buildTools: [],
    };

    try {
      const pkg = await this.readPackageJson();
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Detect languages from file extensions
      const files = await this.scanFiles('', 3);
      const extensions = new Set(files.map(f => extname(f).toLowerCase()));

      if (extensions.has('.ts') || extensions.has('.tsx')) stack.languages.push('TypeScript');
      if (extensions.has('.js') || extensions.has('.jsx')) stack.languages.push('JavaScript');
      if (extensions.has('.py')) stack.languages.push('Python');
      if (extensions.has('.java')) stack.languages.push('Java');
      if (extensions.has('.go')) stack.languages.push('Go');
      if (extensions.has('.rs')) stack.languages.push('Rust');

      // Detect frameworks
      if (deps['react']) stack.frameworks.push('React');
      if (deps['vue']) stack.frameworks.push('Vue');
      if (deps['angular']) stack.frameworks.push('Angular');
      if (deps['svelte']) stack.frameworks.push('Svelte');
      if (deps['next']) stack.frameworks.push('Next.js');
      if (deps['nuxt']) stack.frameworks.push('Nuxt');
      if (deps['express']) stack.frameworks.push('Express');
      if (deps['nest']) stack.frameworks.push('NestJS');
      if (deps['koa']) stack.frameworks.push('Koa');
      if (deps['fastify']) stack.frameworks.push('Fastify');

      // Detect tools
      if (deps['webpack']) stack.tools.push('Webpack');
      if (deps['vite']) stack.tools.push('Vite');
      if (deps['rollup']) stack.tools.push('Rollup');
      if (deps['esbuild']) stack.tools.push('esbuild');
      if (deps['typescript']) stack.tools.push('TypeScript');
      if (deps['eslint']) stack.tools.push('ESLint');
      if (deps['prettier']) stack.tools.push('Prettier');
      if (deps['babel']) stack.tools.push('Babel');

      // Detect testing
      if (deps['jest'] || deps['@jest/globals']) stack.testing.push('Jest');
      if (deps['vitest']) stack.testing.push('Vitest');
      if (deps['mocha']) stack.testing.push('Mocha');
      if (deps['cypress']) stack.testing.push('Cypress');
      if (deps['playwright']) stack.testing.push('Playwright');
      if (deps['@testing-library/react']) stack.testing.push('Testing Library');

      // Detect build tools
      if (await this.hasFile('webpack.config.js')) stack.buildTools.push('Webpack');
      if (await this.hasFile('vite.config.js') || await this.hasFile('vite.config.ts')) stack.buildTools.push('Vite');
      if (await this.hasFile('rollup.config.js')) stack.buildTools.push('Rollup');
      if (await this.hasFile('tsconfig.json')) stack.buildTools.push('TypeScript');
      if (await this.hasFile('babel.config.js')) stack.buildTools.push('Babel');
      if (await this.hasFile('.eslintrc.js') || await this.hasFile('.eslintrc.json')) stack.buildTools.push('ESLint');

    } catch {
      // No package.json found
    }

    return stack;
  }

  private async analyzeDirectories(): Promise<DirectoryInfo[]> {
    const dirs: DirectoryInfo[] = [];

    try {
      const entries = await readdir(this.rootDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name === 'node_modules' && !this.options.includeNodeModules) continue;
        if (entry.name.startsWith('.')) continue;

        const dirPath = join(this.rootDir, entry.name);
        const stats = await this.analyzeDirectory(dirPath, entry.name);

        dirs.push(stats);
      }
    } catch {
      // Error reading root directory
    }

    return dirs.sort((a, b) => b.fileCount - a.fileCount);
  }

  private async analyzeDirectory(dirPath: string, name: string): Promise<DirectoryInfo> {
    const info: DirectoryInfo = {
      path: dirPath,
      name,
      fileCount: 0,
      subdirs: [],
      purpose: this.inferDirectoryPurpose(name),
    };

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          info.subdirs.push(entry.name);
        } else {
          info.fileCount++;
        }
      }
    } catch {
      // Error reading directory
    }

    return info;
  }

  private inferDirectoryPurpose(name: string): string {
    const purposes: Record<string, string> = {
      src: 'Source code directory',
      lib: 'Library/build output',
      dist: 'Distribution/build output',
      build: 'Build output',
      test: 'Test files',
      tests: 'Test files',
      spec: 'Test specifications',
      __tests__: 'Test files',
      docs: 'Documentation',
      examples: 'Example files',
      public: 'Public assets',
      assets: 'Static assets',
      styles: 'Style files',
      components: 'React/Vue components',
      hooks: 'React hooks',
      utils: 'Utility functions',
      helpers: 'Helper functions',
      services: 'API/services layer',
      api: 'API definitions',
      types: 'TypeScript type definitions',
      interfaces: 'TypeScript interfaces',
      config: 'Configuration files',
      scripts: 'Build and utility scripts',
      bin: 'Executable binaries',
      tools: 'Development tools',
      middleware: 'Express middleware',
      routes: 'Route definitions',
      controllers: 'MVC controllers',
      models: 'Data models',
      store: 'State management',
      state: 'State management',
      contexts: 'React contexts',
      reducers: 'Redux reducers',
      actions: 'Redux actions',
      effects: 'Side effects',
      selectors: 'State selectors',
    };

    return purposes[name] || 'Directory';
  }

  private async identifyKeyFiles(): Promise<KeyFileInfo[]> {
    const keyFiles: KeyFileInfo[] = [];

    const keyFilePaths = [
      { path: 'package.json', type: 'config', description: 'Node.js package configuration' },
      { path: 'tsconfig.json', type: 'config', description: 'TypeScript configuration' },
      { path: 'README.md', type: 'readme', description: 'Project documentation' },
      { path: 'LICENSE', type: 'documentation', description: 'License information' },
      { path: '.gitignore', type: 'config', description: 'Git ignore rules' },
      { path: '.eslintrc.js', type: 'config', description: 'ESLint configuration' },
      { path: '.prettierrc', type: 'config', description: 'Prettier configuration' },
      { path: 'vite.config.js', type: 'config', description: 'Vite build configuration' },
      { path: 'webpack.config.js', type: 'config', description: 'Webpack build configuration' },
      { path: 'jest.config.js', type: 'config', description: 'Jest test configuration' },
      { path: 'vitest.config.ts', type: 'config', description: 'Vitest test configuration' },
      { path: 'src/index.ts', type: 'entry', description: 'Main entry point' },
      { path: 'src/index.js', type: 'entry', description: 'Main entry point' },
      { path: 'src/main.ts', type: 'entry', description: 'Main application file' },
      { path: 'src/main.js', type: 'entry', description: 'Main application file' },
      { path: 'src/App.tsx', type: 'entry', description: 'React root component' },
      { path: 'src/App.jsx', type: 'entry', description: 'React root component' },
    ];

    for (const keyFile of keyFilePaths) {
      try {
        const filePath = join(this.rootDir, keyFile.path);
        const stats = await stat(filePath);

        keyFiles.push({
          path: filePath,
          name: basename(filePath),
          type: keyFile.type as any,
          description: keyFile.description,
          size: stats.size,
        });
      } catch {
        // File doesn't exist
      }
    }

    return keyFiles;
  }

  private async analyzeDependencies(): Promise<DependencyInfo> {
    const deps: DependencyInfo = {
      production: {},
      development: {},
      peer: {},
      internal: [],
    };

    try {
      const pkg = await this.readPackageJson();

      if (pkg.dependencies) {
        deps.production = pkg.dependencies;
      }

      if (pkg.devDependencies) {
        deps.development = pkg.devDependencies;
      }

      if (pkg.peerDependencies) {
        deps.peer = pkg.peerDependencies;
      }

      // Detect internal dependencies (monorepo workspaces)
      if (pkg.workspaces || pkg.private) {
        deps.internal = this.detectInternalDependencies();
      }
    } catch {
      // No package.json
    }

    return deps;
  }

  private detectInternalDependencies(): string[] {
    // This is a simplified version - real implementation would scan for workspace packages
    return [];
  }

  private async calculateCodeMetrics(): Promise<CodeMetrics> {
    const metrics: CodeMetrics = {
      totalFiles: 0,
      totalLines: 0,
      languageBreakdown: {},
      largestFiles: [],
    };

    try {
      const files = await this.scanFiles('', this.options.maxDepth);

      for (const file of files) {
        const ext = extname(file).toLowerCase();
        if (
!['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rs', '.c', '.cpp', '.h', '.hpp'].includes(ext)
) {
          continue;
        }

        try {
          const content = await readFile(join(this.rootDir, file), 'utf-8');
          const lines = content.split('\n').length;

          metrics.totalFiles++;
          metrics.totalLines += lines;

          const lang = this.getLanguageFromExtension(ext);
          if (!metrics.languageBreakdown[lang]) {
            metrics.languageBreakdown[lang] = { files: 0, lines: 0 };
          }
          metrics.languageBreakdown[lang].files++;
          metrics.languageBreakdown[lang].lines += lines;

          metrics.largestFiles.push({ path: join(this.rootDir, file), lines });
        } catch {
          // Error reading file
        }
      }

      // Sort largest files
      metrics.largestFiles.sort((a, b) => b.lines - a.lines);
      metrics.largestFiles = metrics.largestFiles.slice(0, 10);
    } catch {
      // Error scanning files
    }

    return metrics;
  }

  private async detectPatterns(): Promise<PatternInfo[]> {
    const patterns: PatternInfo[] = [];

    try {
      const files = await this.scanFiles('', this.options.maxDepth);

      // Detect React patterns
      if (files.some(f => f.endsWith('.tsx') || f.endsWith('.jsx'))) {
        patterns.push({
          type: 'architecture',
          pattern: 'Component-based architecture',
          confidence: 0.9,
          evidence: ['Found .tsx/.jsx files'],
        });
      }

      // Detect Redux
      if (files.some(f => f.includes('redux') || f.includes('store'))) {
        patterns.push({
          type: 'state-management',
          pattern: 'Redux state management',
          confidence: 0.8,
          evidence: ['Found Redux-related files'],
        });
      }

      // Detect API patterns
      if (files.some(f => f.includes('api') || f.includes('service'))) {
        patterns.push({
          type: 'api',
          pattern: 'Service layer pattern',
          confidence: 0.7,
          evidence: ['Found API/service files'],
        });
      }

      // Detect testing patterns
      if (files.some(f => f.includes('.test.') || f.includes('.spec.'))) {
        patterns.push({
          type: 'testing',
          pattern: 'Unit testing',
          confidence: 0.9,
          evidence: ['Found test files'],
        });
      }
    } catch {
      // Error detecting patterns
    }

    return patterns;
  }

  private generateRefactoringSuggestions(structure: ProjectStructure): string {
    const suggestions: string[] = [];

    // Check for large files
    if (structure.codeMetrics.largestFiles.length > 0) {
      const largest = structure.codeMetrics.largestFiles[0];
      if (largest.lines > 500) {
        suggestions.push(`- Consider splitting \`${relative(this.rootDir, largest.path)}\` (${largest.lines} lines) into smaller modules`);
      }
    }

    // Check for testing
    if (structure.techStack.testing.length === 0) {
      suggestions.push('- Consider adding a testing framework (Jest, Vitest, etc.)');
    }

    // Check for linting
    if (!structure.techStack.tools.includes('ESLint')) {
      suggestions.push('- Consider adding ESLint for code quality');
    }

    // Check for TypeScript
    if (!structure.techStack.languages.includes('TypeScript') && structure.techStack.languages.includes('JavaScript')) {
      suggestions.push('- Consider migrating to TypeScript for better type safety');
    }

    if (suggestions.length === 0) {
      return 'No immediate refactoring suggestions detected.';
    }

    return suggestions.join('\n');
  }

  // --- Helper Methods ---

  private async hasFile(path: string): Promise<boolean> {
    try {
      await stat(join(this.rootDir, path));
      return true;
    } catch {
      return false;
    }
  }

  private async readPackageJson(): Promise<any> {
    const content = await readFile(join(this.rootDir, 'package.json'), 'utf-8');
    return JSON.parse(content);
  }

  private async scanFiles(dir: string, maxDepth: number): Promise<string[]> {
    const files: string[] = [];

    if (maxDepth < 0) return files;

    try {
      const dirPath = dir ? join(this.rootDir, dir) : this.rootDir;
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' && !this.options.includeNodeModules) continue;
          if (entry.name.startsWith('.')) continue;
          if (entry.name === 'dist' || entry.name === 'build' || entry.name === 'out') continue;

          const subPath = dir ? join(dir, entry.name) : entry.name;
          const subFiles = await this.scanFiles(subPath, maxDepth - 1);
          files.push(...subFiles);
        } else {
          const filePath = dir ? join(dir, entry.name) : entry.name;
          files.push(filePath);
        }
      }
    } catch {
      // Error reading directory
    }

    return files;
  }

  private getLanguageFromExtension(ext: string): string {
    const langMap: Record<string, string> = {
      '.js': 'JavaScript',
      '.jsx': 'JavaScript (React)',
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript (React)',
      '.py': 'Python',
      '.java': 'Java',
      '.go': 'Go',
      '.rs': 'Rust',
      '.c': 'C',
      '.cpp': 'C++',
      '.h': 'C/C++ Header',
      '.hpp': 'C++ Header',
    };

    return langMap[ext] || ext.substring(1);
  }

  private formatProjectType(type: ProjectType): string {
    const typeNames: Record<ProjectType, string> = {
      unknown: 'Unknown',
      frontend: 'Frontend Application',
      backend: 'Backend Application',
      fullstack: 'Full Stack Application',
      mobile: 'Mobile Application',
      desktop: 'Desktop Application',
      library: 'Library/Package',
      cli: 'CLI Tool',
      monorepo: 'Monorepo',
    };

    return typeNames[type];
  }
}
