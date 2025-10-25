# Puppeteer MCP Usage Examples

## Overview
Demonstrations of browser automation, web scraping, and testing using Puppeteer MCP.

## Example 1: Screenshot Capture
```javascript
const screenshot = await mcp.call('puppeteer', {
  method: 'captureScreenshot',
  url: 'https://example.com',
  options: { fullPage: true }
});
```

## Example 2: Web Scraping
```javascript
const data = await mcp.call('puppeteer', {
  method: 'scrapeData',
  url: 'https://example.com/products',
  selectors: ['.product-title', '.product-price']
});
```

## Example 3: PDF Generation
```javascript
const pdf = await mcp.call('puppeteer', {
  method: 'generatePDF',
  url: 'https://example.com/report',
  options: { format: 'A4', printBackground: true }
});
```

## Best Practices
- Use headless mode for production
- Set appropriate timeouts
- Handle navigation errors
- Clean up browser instances
