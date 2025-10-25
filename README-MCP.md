# MCP (Model Context Protocol) Setup Guide

## 📋 Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Configured MCP Servers](#configured-mcp-servers)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)
- [Additional Resources](#additional-resources)

## 🎯 Overview

This repository includes a comprehensive Model Context Protocol (MCP) configuration that enables Claude Desktop to interact with various external services and tools. MCP allows AI assistants to access file systems, databases, APIs, and other resources in a secure and structured way.

## ✅ Prerequisites

Before setting up MCP servers, ensure you have:

- **Claude Desktop Application** installed (latest version)
- **Node.js** (v18 or higher) and **npm** installed
- **Python** (v3.10 or higher) for Python-based servers
- **Git** for cloning repositories
- Necessary **API keys** for third-party services

## 📦 Installation

### 1. Install Claude Desktop

Download and install Claude Desktop from the official Anthropic website:
```bash
# Visit: https://claude.ai/download
```

### 2. Install Node.js MCP Servers

Most MCP servers are available via npm. Install them globally:

```bash
# Core MCP servers
npm install -g @modelcontextprotocol/server-filesystem
npm install -g @modelcontextprotocol/server-github
npm install -g @modelcontextprotocol/server-brave-search
npm install -g @modelcontextprotocol/server-memory
npm install -g @modelcontextprotocol/server-postgres
npm install -g @modelcontextprotocol/server-sqlite

# Additional specialized servers
npm install -g @modelcontextprotocol/server-everything
npm install -g mcp-server-fetch
```

### 3. Install Python MCP Servers

For Python-based servers:

```bash
# Using pip
pip install mcp-server-git

# Or using uvx (recommended for isolated environments)
uvx mcp-server-git
```

## ⚙️ Configuration

### Configuration File Location

The MCP configuration file is located at:

**macOS/Linux:**
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```bash
%APPDATA%\Claude\claude_desktop_config.json
```

### Basic Configuration Structure

The configuration follows this JSON structure:

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-name"],
      "env": {
        "API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## 🔧 Configured MCP Servers

This repository includes the following pre-configured MCP servers:

### 1. **Filesystem Server**
Provides read/write access to specified directories.

```json
"filesystem": {
  "command": "npx",
  "args": [
    "-y",
    "@modelcontextprotocol/server-filesystem",
    "/path/to/allowed/directory"
  ]
}
```

**Capabilities:**
- Read files and directories
- Write and modify files
- Create and delete files/folders
- Search file contents

**Usage Example:**
```
"Read the contents of /project/README.md"
"Create a new file called notes.txt in /documents"
```

---

### 2. **GitHub Server**
Enables interaction with GitHub repositories, issues, and pull requests.

```json
"github": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token_here"
  }
}
```

**Authentication Setup:**
1. Go to https://github.com/settings/tokens
2. Generate a new personal access token
3. Grant necessary permissions (repo, read:org, etc.)
4. Add token to configuration

**Capabilities:**
- Search repositories
- Read/create issues and PRs
- Access repository files
- Manage branches and commits

**Usage Example:**
```
"Search for TypeScript repositories about AI"
"Create an issue in my-repo about bug fixes"
"Show me recent commits in main branch"
```

---

### 3. **Brave Search Server**
Provides web search capabilities using Brave Search API.

```json
"brave-search": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-brave-search"],
  "env": {
    "BRAVE_API_KEY": "BSA_your_api_key_here"
  }
}
```

**Authentication Setup:**
1. Visit https://brave.com/search/api/
2. Sign up for API access
3. Generate API key
4. Add to configuration

**Capabilities:**
- Web search queries
- News search
- Image search (if enabled)
- Safe search filtering

**Usage Example:**
```
"Search the web for latest AI developments"
"Find recent news about TypeScript 5.0"
```

---

### 4. **Memory Server**
Provides persistent knowledge graph memory across conversations.

```json
"memory": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-memory"]
}
```

**Capabilities:**
- Store facts and relationships
- Retrieve stored knowledge
- Build entity relationships
- Persistent memory across sessions

**Usage Example:**
```
"Remember that my project uses TypeScript and React"
"What do you know about my tech stack?"
```

---

### 5. **PostgreSQL Server**
Enables querying and managing PostgreSQL databases.

```json
"postgres": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-postgres"],
  "env": {
    "POSTGRES_CONNECTION_STRING": "postgresql://user:password@localhost:5432/dbname"
  }
}
```

**Authentication Setup:**
- Set up PostgreSQL database
- Create connection string with credentials
- Ensure proper permissions

**Capabilities:**
- Execute SQL queries
- Read database schema
- Manage tables and data
- Transaction support

**Usage Example:**
```
"Show me the users table schema"
"Query all orders from last month"
"Create a new table for products"
```

---

### 6. **SQLite Server**
Provides access to SQLite database files.

```json
"sqlite": {
  "command": "npx",
  "args": [
    "-y",
    "@modelcontextprotocol/server-sqlite",
    "/path/to/database.db"
  ]
}
```

**Capabilities:**
- Query SQLite databases
- Read table structures
- Execute SELECT, INSERT, UPDATE, DELETE
- Database inspection

**Usage Example:**
```
"List all tables in the database"
"Show me records from the customers table"
```

---

### 7. **Git Server**
Enables Git operations and repository management.

```json
"git": {
  "command": "uvx",
  "args": ["mcp-server-git", "--repository", "/path/to/repo"]
}
```

**Capabilities:**
- Check Git status
- View commit history
- Create commits
- Manage branches
- View diffs and changes

**Usage Example:**
```
"Show me the latest commits"
"What files have changed?"
"Create a commit with these changes"
```

---

### 8. **Fetch Server**
Provides HTTP request capabilities for APIs.

```json
"fetch": {
  "command": "npx",
  "args": ["-y", "mcp-server-fetch"]
}
```

**Capabilities:**
- Make GET/POST/PUT/DELETE requests
- Handle JSON/text responses
- Custom headers and authentication
- REST API interactions

**Usage Example:**
```
"Fetch data from https://api.example.com/users"
"Make a POST request to create a new resource"
```

---

### 9. **Everything Server**
A comprehensive server combining multiple capabilities.

```json
"everything": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-everything"]
}
```

**Capabilities:**
- Multi-purpose operations
- Combined tool access
- Flexible configuration

## 🚀 Usage Examples

### Example 1: File Operations with Memory
```
User: "Read the project README and remember the key technologies used"

# Claude uses:
# 1. Filesystem server to read README.md
# 2. Memory server to store key facts
```

### Example 2: Research and Documentation
```
User: "Search for best practices in React hooks and create a summary document"

# Claude uses:
# 1. Brave Search to find information
# 2. Filesystem server to create summary.md
```

### Example 3: Database Analysis
```
User: "Analyze the users table in my database and show demographics"

# Claude uses:
# 1. PostgreSQL/SQLite server to query data
# 2. Analysis and summarization
```

### Example 4: GitHub Workflow
```
User: "Check my repository issues and create a PR for bug fixes"

# Claude uses:
# 1. GitHub server to fetch issues
# 2. Git server for local changes
# 3. GitHub server to create PR
```

## 🔧 Troubleshooting

### Common Issues

#### 1. **Server Not Starting**
```bash
# Check if Node.js/npm is installed
node --version
npm --version

# Reinstall the problematic server
npm install -g @modelcontextprotocol/server-name
```

#### 2. **Authentication Errors**
- Verify API keys are correct
- Check environment variable names
- Ensure proper permissions for tokens
- Restart Claude Desktop after config changes

#### 3. **Permission Denied**
```bash
# For filesystem access
chmod +r /path/to/directory

# For database access
# Verify connection string and user permissions
```

#### 4. **Configuration Not Loading**
- Validate JSON syntax (use https://jsonlint.com)
- Check file path is correct
- Restart Claude Desktop completely
- Check Claude Desktop logs

### Viewing Logs

**macOS:**
```bash
tail -f ~/Library/Logs/Claude/mcp*.log
```

**Windows:**
```bash
type %APPDATA%\Claude\Logs\mcp*.log
```

## 📚 Additional Resources

### Official Documentation
- [MCP Official Documentation](https://modelcontextprotocol.io)
- [MCP Specification](https://spec.modelcontextprotocol.io)
- [Claude Desktop Documentation](https://docs.anthropic.com/claude/desktop)

### Community Resources
- [MCP GitHub Repository](https://github.com/modelcontextprotocol)
- [MCP Server Registry](https://github.com/modelcontextprotocol/servers)
- [Community MCP Servers](https://github.com/topics/mcp-server)

### Example Repositories
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk)
- [Custom MCP Server Examples](https://github.com/modelcontextprotocol/servers/tree/main/src)

## 🔐 Security Best Practices

1. **Never commit API keys** to version control
2. Use **environment variables** for sensitive data
3. Restrict **filesystem access** to necessary directories only
4. Use **minimal permissions** for database connections
5. Regularly **rotate API keys** and tokens
6. Review **server permissions** periodically

## 🤝 Contributing

To add new MCP servers or improve documentation:

1. Fork this repository
2. Add your server configuration
3. Document setup and usage
4. Submit a pull request

## 📄 License

See repository LICENSE file for details.

---

**Last Updated:** October 25, 2025

**Maintained by:** A2A Project Contributors
