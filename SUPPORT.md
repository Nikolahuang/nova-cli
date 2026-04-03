# Support

## Getting Help

### Documentation
- [README](./README.md) - Project overview and quick start
- [INSTALLATION](./INSTALLATION.md) - Detailed installation guide
- [USER_GUIDE](./USER_GUIDE.md) - Comprehensive user guide
- [COMMAND_REFERENCE](./COMMAND_REFERENCE.md) - Complete command reference
- [NOVA_CLI_用户命令操作手册](./NOVA_CLI_用户命令操作手册.md) - 中文用户手册

### Quick Start
```bash
# Start Nova CLI
nova

# Get help
/help

# Initialize project context
/init

# List available skills
/skills list
```

## Common Issues

### Installation Issues

**Problem**: "command not found: nova"
- **Solution**: Make sure Node.js >= 18.0.0 is installed and global npm bin is in your PATH

**Problem**: Permission denied when installing globally
- **Solution**: Use `sudo npm install -g nova-ai-terminal@latest` on Linux/macOS, or run PowerShell as Administrator on Windows

### API Key Issues

**Problem**: "No API key configured"
- **Solution**: Run `nova auth set <provider>` to configure your API key

**Problem**: "Invalid API key"
- **Solution**: Verify your API key is correct and has the required permissions

### Model Issues

**Problem**: "Model not found"
- **Solution**: Run `nova model list` to see available models, or check your provider config

**Problem**: "Rate limit exceeded"
- **Solution**: Wait a few minutes before retrying, or upgrade your API plan

### Context Issues

**Problem**: "Context overflow"
- **Solution**: Use `/compact` to compress conversation history, or start a new session with `/reset`

**Problem**: "Project analysis failed"
- **Solution**: Ensure you're in a valid project directory with a package.json or similar config file

### Tool Issues

**Problem**: "Tool execution failed"
- **Solution**: Check tool permissions and file paths, verify approval mode settings

**Problem**: "MCP server connection failed"
- **Solution**: Check MCP server configuration and ensure the server is running

## Reporting Bugs

If you encounter a bug that's not covered above, please:

1. Check existing [issues](https://github.com/your-org/nova-cli/issues) to avoid duplicates
2. Use the [bug report template](./.github/ISSUE_TEMPLATE/bug_report.md)
3. Include:
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment information (OS, Node.js version, Nova CLI version)
   - Relevant logs and configuration

## Feature Requests

We welcome feature requests! Please:

1. Check existing [issues](https://github.com/your-org/nova-cli/issues) and [discussions](https://github.com/your-org/nova-cli/discussions)
2. Use the [feature request template](./.github/ISSUE_TEMPLATE/feature_request.md)
3. Describe the use case and expected behavior

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Community

- **GitHub Discussions**: [Link to discussions]
- **Discord**: [Link to Discord server]
- **Twitter/X**: [Link to Twitter]

## Professional Support

For enterprise support, custom integrations, or priority bug fixes, please contact us at:

- Email: support@nova-cli.dev
- Website: https://nova-cli.dev

## Security

For security vulnerabilities, please follow our [security policy](./SECURITY.md) and report privately.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.