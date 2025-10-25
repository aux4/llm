# Read File Tool

Read the contents of any text-based file from the local disk to examine, analyze, or understand its contents.

## Overview

This tool is your primary method for **examining existing files** in a project. Use it to understand codebases, check configuration files, read documentation, or analyze any text-based content. It's essential for getting context before making changes or understanding how systems work.

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | string | ✅ Yes | Path to the file to read. Can be relative (`./src/app.js`) or absolute (`/home/user/config.json`). Supports tilde expansion (`~/Documents/notes.txt`) |

## Security & Access Control

- **✅ Allowed locations:**
  - Current working directory and all subdirectories
  - User's `.aux4.config/packages` folder
- **❌ Restricted:** Cannot read files outside these locations for security
- **🔍 Path resolution:** Automatically expands `~` to home directory

## When to Use This Tool

- **📖 Code exploration:** Understanding existing source code structure
- **⚙️ Configuration review:** Checking settings in config files (`package.json`, `.env`, etc.)
- **📚 Documentation reading:** Examining README files, API docs, or comments
- **🔍 Debugging:** Investigating log files or error outputs
- **📋 Content analysis:** Reading data files, templates, or any text content

## Common File Types

- **Source code:** `.js`, `.ts`, `.py`, `.java`, `.go`, etc.
- **Configuration:** `package.json`, `.env`, `config.yaml`, `.gitignore`
- **Documentation:** `README.md`, `CHANGELOG.md`, API docs
- **Data files:** `.txt`, `.csv`, `.json`, `.xml`, `.yaml`
- **Build files:** `Dockerfile`, `Makefile`, build scripts

## Response Format

- **✅ Success:** Returns complete file contents as UTF-8 text
- **❌ File not found:** Returns `"File not found"`
- **❌ Access denied:** Returns `"Access denied"`
- **❌ Other errors:** Returns descriptive error message

> **💡 Tip:** Always use this tool before making changes to understand the current state of files and avoid breaking existing functionality.