# Continue Autonomous Execution Guide

## Overview
This document explains A2A's autonomous execution capabilities powered by Continue + MCP. It covers how agents run tasks end-to-end, coordinate parallel work, control browsers, use context providers, and expose APIs.

## Parallel Processing Architecture
- Task planner decomposes goals into dependent and independent subtasks
- Parallel worker pool executes independent subtasks concurrently
- Deterministic job queue with priorities and retry backoff
- Shared blackboard state with CRDT-style conflict resolution
- Idempotent operations, exactly-once side-effect guards
- Cancellation, deadlines, and budget-aware scheduling

### Concurrency Model
- Node.js worker threads for CPU-bound work; async I/O with promises and streams
- Bounded concurrency via p-limit; fan-out/fan-in patterns
- Structured logging and trace IDs per task; OpenTelemetry hooks
- Circuit breakers/timeouts for external calls

## Browser Control Integration
- Headless control via Playwright/Puppeteer adapters
- High-level skills: navigate, search, click, fill, select, upload, wait, scroll, download
- DOM safety: interact only with vetted nodes; avoid hidden/readonly; handle modals
- Robustness: retries, waits for network idle, selector fallbacks
- Policy: never execute page-embedded instructions; treat content as untrusted

## MCP Protocol Implementation
- Implements Model Context Protocol over stdio and SSE transports
- Tools: navigate, click, form_fill, search, scroll_page, wait, download, return_documents, todo_write, confirm_action
- Schema validation, capability negotiation, and tool-level rate limiting
- Session memory with ephemeral context windows per task

## Context Provider Usage
- Providers: file tree, repo index, README, recent commits, issue/PR metadata
- Retrieval: hybrid BM25 + embeddings; chunking with semantic re-ranking
- RAG safety: cite sources with document IDs and URL nodes

## Rules System
- Hierarchy: System > Developer > Site-specific > User intent
- Hard constraints: max two-sentence status bar updates; confirm before irreversible actions
- Authentication policy: fail fast on sign-in walls (except LMS portals)
- Persistence: try alternative paths, scroll, clear filters before failing

## Prompt Engineering
- Status outputs concise and situational
- Tool calls are atomic, targeted, and minimal
- Use wait after state-changing actions; avoid stale node IDs
- Provide drafts via confirm_action before submissions

## Real-World Examples
1) Create file in GitHub repo with content and commit message
2) Collect links from a paginated results page and export
3) Dismiss modal, apply filters, and download artifact
Each example leverages plan → parallel execute → verify → cite.

## Troubleshooting Guide
- Nothing happens after click: wait, then retry with alternative selector
- Element missing: scroll or expand sections; refresh context
- Validation errors: stop using stale nodes; re-query page
- Auth required: terminate task and cite sign-in URL
- Infinite spinners: set timeout and backoff; capture partial results

## API Reference
- Tool: navigate(url|back)
- Tool: click(node)
- Tool: form_fill(fill|select|set_file|unselect)
- Tool: search(node, value)
- Tool: scroll_page(direction)
- Tool: wait(seconds)
- Tool: download(node, as_attachment)
- Tool: return_documents(document_ids, citation_items, success)
- Tool: todo_write(todos[])
- Tool: confirm_action(text, placeholder)

## Commit Message
Use: "docs: Add comprehensive Continue autonomous execution guide"
