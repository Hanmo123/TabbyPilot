# Tabby Pilot

AI Agent plugin for Tabby terminal - Copilot-style chat assistant powered by Claude.

## Features

- 🤖 **AI Chat Interface**: Copilot-style chat sidebar
- ⌨️ **Keyboard Shortcut**: Open chat with `Cmd+Shift+C` (macOS) or `Ctrl+Shift+C` (Windows/Linux)
- 🛠️ **Shell Command Execution**: AI can execute shell commands with user approval
- 💬 **Multi-Session Support**: Create and manage multiple chat sessions
- 🔒 **User Confirmation**: All shell commands require explicit user approval
- 🎨 **Native Tabby Theme**: Matches your Tabby theme
- ⚡ **AI SDK Integration**: Direct streaming support with Anthropic Claude

## Quick Start

**Fastest way to test:**
```bash
cd /path/to/tabby-pilot
bun install
bun run build
TABBY_PLUGINS=$(pwd) tabby --debug
```

Then configure your API key in Settings → Pilot and press `Cmd+Shift+C` to start chatting!

## Installation

### Development Mode (Recommended for Testing)

```bash
# Build the plugin
bun install
bun run build

# Start Tabby with plugin
TABBY_PLUGINS=/path/to/tabby-pilot tabby --debug
```

### Install to User Plugin Directory

```bash
# Install plugin
cd ~/.config/Tabby/plugins/
bun add /path/to/tabby-pilot

# Or use symlink for development
cd ~/.config/Tabby/plugins/node_modules/
ln -s /path/to/tabby-pilot

# Restart Tabby
```

## Configuration

1. Open Tabby Settings
2. Go to **Pilot** section
3. Configure:
   - **API Key**: Your Anthropic API key (get one at https://console.anthropic.com)
   - **Model**: Select Claude model (e.g., `claude-3-5-sonnet-20241022`)
   - **Temperature**: Controls randomness (0.0 - 1.0, default 0.7)
   - **Max Tokens**: Maximum response length (default 4096)

## Usage

1. Press `Cmd+Shift+C` (macOS) or `Ctrl+Shift+C` (Windows/Linux) to open chat
2. Type your message and press `Ctrl+Enter` or click Send
3. When AI suggests a shell command:
   - A confirmation card appears showing the command
   - Click **Approve** to execute or **Reject** to cancel
4. Chat history is automatically saved across sessions

## Development

### Watch Mode (Auto-rebuild)

```bash
# Terminal 1: Watch and rebuild on changes
bun run watch

# Terminal 2: Run Tabby
TABBY_PLUGINS=$(pwd) tabby --debug
```

After code changes, restart Tabby to see updates.

### Project Structure

```
tabby-pilot/
├── packages/
│   ├── ai-runtime/           # AI SDK runtime wrapper
│   └── tabby-pilot/
│       ├── src/              # Angular plugin source
│       ├── dist/             # Plugin build output
│       ├── package.json
│       ├── tsconfig.json
│       └── webpack.config.mjs
├── bun.lock
├── package.json
├── README.md
└── AGENTS.md                 # Complete development documentation
```

## Troubleshooting

### Plugin not loading?

1. Check if `packages/tabby-pilot/dist/index.js` exists
2. Verify `package.json` has `"keywords": ["tabby-plugin"]`
3. Check Tabby logs: `tail -f ~/Library/Logs/Tabby/log.log` (macOS)
4. Open Tabby DevTools (Cmd+Shift+I) and check Console for errors

### No Pilot tab in Settings?

The plugin failed to load. Check:
- Build was successful: `bun run build`
- Environment variable: `echo $TABBY_PLUGINS`
- Package name starts with `tabby-`: `"name": "tabby-pilot"`

### Shortcut key not working?

1. Verify plugin is loaded (Settings → Plugins → Installed)
2. Check for hotkey conflicts (Settings → Hotkeys, search "pilot")

## Technical Details

- **Framework**: Angular 15
- **AI SDK**: Vercel AI SDK + Anthropic SDK
- **Build**: Webpack 5
  - `to-string-loader` for component styles (converts CSS to strings)
  - `pug-loader` for templates
  - Angular externals for shared dependencies
- **Language**: TypeScript 4.9
- **Architecture**: Tabby plugin system (provider-based DI)
- **Bundle Size**: 682KB

## Documentation

- **AGENTS.md** - Complete development documentation including:
  - Requirements and technical architecture
  - Build process and problem-solving steps
  - Configuration details and best practices
  - Troubleshooting guide
  - Lessons learned

## Requirements

- Tabby Terminal 1.0.156 or later
- Anthropic API key
- Bun 1.3+ (for install/build)

## Known Limitations

1. Shell commands execute in a default directory (not the active terminal's CWD)
2. No Markdown rendering yet (plain text only)
3. API key stored in plain text in Tabby config
4. Session switching UI is basic (new/clear only)

## License

MIT
