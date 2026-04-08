// ============================================================================
// CLI Argument Parser
// ============================================================================

export interface CliArgs {
  command: string;
  subcommand?: string;
  prompt?: string;
  model?: string;
  projectDir?: string;
  approvalMode?: 'yolo' | 'default' | 'accepting_edits' | 'plan' | 'smart';
  maxTurns?: number;
  noStream?: boolean;
  noMcp?: boolean;
  /** --no-input: non-interactive mode, never prompt for input */
  noInput?: boolean;
  /** --json: output in JSON format for machine parsing */
  json?: boolean;
  /** --limit: maximum number of items to display */
  limit?: number;
  /** --minimal: minimal mode - reduced prompt & essential tools only */
  minimal?: boolean;
  /** --thinking: control thinking mode (enabled|disabled|auto) */
  thinking?: string;
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  providerType?: string;
  defaultModel?: string;
  modelName?: string;
  features?: string;
  costIn?: number;
  costOut?: number;
  maxContext?: number;
  maxOutput?: number;
  ollamaHost?: string;
  ollamaModel?: string;
  /** -c: continue the most recent session */
  continueSession?: boolean;
  /** -r / --resume: interactively pick a session to resume */
  resumeSession?: boolean;
  /** direct session ID to restore */
  sessionId?: string;
  /** --force: force overwrite existing skills */
  force?: boolean;
  /** --source: GitHub repository source for skills install */
  source?: string;
  [key: string]: unknown;
}

export function parseCliArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    command: 'repl',
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    switch (arg) {
      case '-p':
      case '--prompt':
        args.prompt = argv[++i];
        break;
      case '-m':
      case '--model':
        args.model = argv[++i];
        break;
      case '-d':
      case '--directory':
        args.projectDir = argv[++i];
        break;
      case '--approval-mode':
        args.approvalMode = argv[++i] as 'yolo' | 'default' | 'accepting_edits' | 'plan' | 'smart';
        break;
      case '--max-turns':
        args.maxTurns = parseInt(argv[++i], 10);
        break;
      case '--no-stream':
        args.noStream = true;
        break;
      case '--no-mcp':
        args.noMcp = true;
        break;
      case '--no-input':
        args.noInput = true;
        break;
      case '--json':
        args.json = true;
        break;
      case '--limit':
      case '-l':
        args.limit = parseInt(argv[++i], 10);
        break;
      case '--minimal':
      case '-M':
        args.minimal = true;
        break;
      case '--thinking':
      case '-t':
        args.thinking = argv[++i];
        break;
      case '-c':
      case '--continue':
        args.continueSession = true;
        break;
      case '-r':
      case '--resume':
        args.resumeSession = true;
        // Optionally a session ID can follow: -r <id>
        if (argv[i + 1] && !argv[i + 1].startsWith('-') && argv[i + 1].length === 36) {
          args.sessionId = argv[++i];
        }
        break;
      case '--key':
        args.apiKey = argv[++i];
        break;
      case '--base-url':
        args.baseUrl = argv[++i];
        break;
      // Provider management flags
      case '--type':
        args.providerType = argv[++i];
        break;
      case '--default-model':
        args.defaultModel = argv[++i];
        break;
      case '--model-name':
        args.modelName = argv[++i];
        break;
      case '--model-id':
        args.ollamaModel = argv[++i]; // reused for provider add-model and ollama
        break;
      case '--features':
        args.features = argv[++i];
        break;
      case '--cost-in':
        args.costIn = parseFloat(argv[++i]);
        break;
      case '--cost-out':
        args.costOut = parseFloat(argv[++i]);
        break;
      case '--max-context':
        args.maxContext = parseInt(argv[++i], 10);
        break;
      case '--max-output':
        args.maxOutput = parseInt(argv[++i], 10);
        break;
      case '--host':
        args.ollamaHost = argv[++i];
        break;
      // Command: set (quick config: nova set <base-url> <api-key> -m <model>)
      case 'set': {
        args.command = 'set';
        // Parse positional args and flags
        let argQueue: string[] = [];
        let modelFlag = false;
        let nameFlag = false;
        let typeFlag = false;
        for (let j = i + 1; j < argv.length; j++) {
          const a = argv[j];
          if (a === '-m' || a === '--model') { modelFlag = true; continue; }
          if (a === '-n' || a === '--name') { nameFlag = true; continue; }
          if (a === '-t' || a === '--type') { typeFlag = true; continue; }
          if (modelFlag) { args.model = a; modelFlag = false; i = j; continue; }
          if (nameFlag) { args.provider = a; nameFlag = false; i = j; continue; }
          if (typeFlag) { args.providerType = a; typeFlag = false; i = j; continue; }
          if (a.startsWith('--key=')) { args.apiKey = a.slice(6); i = j; continue; }
          if (a.startsWith('--base-url=')) { args.baseUrl = a.slice(11); i = j; continue; }
          argQueue.push(a);
          i = j;
        }
        // Positional: base-url, api-key
        if (argQueue.length >= 1) args.baseUrl = argQueue[0];
        if (argQueue.length >= 2) args.apiKey = argQueue[1];
        break;
      }
      // Command: config
      case 'config':
        args.command = 'config';
        args.subcommand = argv[++i];
        break;
      // Command: model
      case 'model':
        args.command = 'model';
        args.subcommand = argv[++i];
        break;
      // Command: auth
      case 'auth':
        args.command = 'auth';
        args.subcommand = argv[++i];
        if (args.subcommand === 'set' || args.subcommand === 'remove') {
          args.provider = argv[++i];
        }
        // Parse optional --key and --base-url flags
        while (argv[i + 1]?.startsWith('--')) {
          i++;
          if (argv[i] === '--key') args.apiKey = argv[++i];
          else if (argv[i] === '--base-url') args.baseUrl = argv[++i];
        }
        break;
      // Command: provider
      case 'provider':
        args.command = 'provider';
        args.subcommand = argv[++i];
        if (args.subcommand === 'add') {
          // Simplified syntax: nova provider add <base-url> <api-key> [-m <model>] [-n <name>]
          // Or: nova provider add --base-url <url> --key <key> (legacy)
          // Peek ahead to check if next arg is a flag or positional
          while (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
            const nextArg = argv[i + 1];
            if (!args.baseUrl) {
              args.baseUrl = nextArg;
            } else if (!args.apiKey) {
              args.apiKey = nextArg;
            }
            i++;
          }
        } else if (args.subcommand === 'remove' || args.subcommand === 'add-model') {
          args.provider = argv[++i];
        }
        // Parse optional flags
        while (argv[i + 1]?.startsWith('-')) {
          i++;
          if (argv[i] === '--key' || argv[i] === '-k') args.apiKey = argv[++i];
          else if (argv[i] === '--base-url' || argv[i] === '-u') args.baseUrl = argv[++i];
          else if (argv[i] === '--type' || argv[i] === '-t') args.providerType = argv[++i];
          else if (argv[i] === '--default-model' || argv[i] === '-m' || argv[i] === '--model') args.defaultModel = argv[++i];
          else if (argv[i] === '--name' || argv[i] === '-n') args.provider = argv[++i];
          else if (argv[i] === '--model-id') args.ollamaModel = argv[++i];
          else if (argv[i] === '--model-name') args.modelName = argv[++i];
          else if (argv[i] === '--features') args.features = argv[++i];
          else if (argv[i] === '--cost-in') args.costIn = parseFloat(argv[++i]);
          else if (argv[i] === '--cost-out') args.costOut = parseFloat(argv[++i]);
          else if (argv[i] === '--max-context') args.maxContext = parseInt(argv[++i], 10);
          else if (argv[i] === '--max-output') args.maxOutput = parseInt(argv[++i], 10);
        }
        break;
      // Command: ollama
      case 'ollama':
        args.command = 'ollama';
        args.subcommand = argv[++i];
        if (args.subcommand === 'pull' || args.subcommand === 'rm' || args.subcommand === 'info' || args.subcommand === 'run') {
          args.ollamaModel = argv[++i];
        }
        // Parse optional --host flag
        while (argv[i + 1]?.startsWith('--')) {
          i++;
          if (argv[i] === '--host') args.ollamaHost = argv[++i];
        }
        break;
      // Command: mcp
      case 'mcp':
        args.command = 'mcp';
        if (argv[i + 1] && !argv[i + 1].startsWith('-')) {
          args.subcommand = argv[++i];
        }
        break;
      // Command: skills
      case 'skills':
        args.command = 'skills';
        if (argv[i + 1] && !argv[i + 1].startsWith('-')) {
          args.subcommand = argv[++i];
        }
        // Parse optional flags for install command
        while (argv[i + 1]?.startsWith('--')) {
          i++;
          if (argv[i] === '--force') {
            args.force = true;
          } else if (argv[i] === '--source') {
            args.source = argv[++i];
          } else if (argv[i] === '--provider') {
            // Alias for --source for backward compatibility
            args.source = argv[++i];
          }
        }
        // If install command has a positional argument (source), capture it
        if (args.subcommand === 'install' && argv[i + 1] && !argv[i + 1].startsWith('-')) {
          args.source = argv[++i];
        }
        break;
      // Command: coding-plan
      case 'coding-plan':
        args.command = 'coding-plan';
        args.subcommand = argv[++i];
        if (args.subcommand === 'add') {
          args.provider = argv[++i];
          i++;
          if (argv[i] === '--key' || argv[i] === '-k') args.apiKey = argv[++i];
        }
        break;
      case 'version':
      case '--version':
      case '-v':
        args.command = 'version';
        break;
      case 'help':
      case '--help':
      case '-h':
        args.command = 'help';
        break;
      default:
        if (args.command === 'repl' && !arg.startsWith('-')) {
          args.prompt = arg;
        }
        break;
    }

    i++;
  }

  // Auto-detect non-interactive mode when stdin is not a TTY
  // This ensures commands never hang waiting for input in automated contexts
  if (!process.stdin.isTTY && args.noInput === undefined) {
    args.noInput = true;
  }

  return args;
}
