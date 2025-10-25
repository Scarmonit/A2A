# Figma MCP Usage Examples

## Overview
This guide demonstrates how to use the Figma MCP server to generate websites from Figma designs.

## Prerequisites
- Figma Personal Access Token configured in `config.json`
- MCP server installed and running
- Access to Figma design files

## Example 1: Extract Design Components

```javascript
// Request design components from Figma file
const response = await mcp.call('figma', {
  method: 'getFileComponents',
  fileKey: 'YOUR_FILE_KEY',
  options: {
    includeStyles: true,
    format: 'svg'
  }
});
```

## Example 2: Generate Website from Figma Design

```javascript
// Convert Figma design to HTML/CSS
const website = await mcp.call('figma', {
  method: 'exportToWeb',
  fileKey: 'YOUR_FILE_KEY',
  options: {
    responsive: true,
    framework: 'react',
    includeAssets: true
  }
});
```

## Example 3: Extract Design Tokens

```javascript
// Get design tokens (colors, typography, spacing)
const tokens = await mcp.call('figma', {
  method: 'getDesignTokens',
  fileKey: 'YOUR_FILE_KEY',
  tokenTypes: ['colors', 'typography', 'spacing']
});
```

## Best Practices

1. **Organize Figma Files**: Use proper naming conventions and layer organization
2. **Use Components**: Leverage Figma components for reusable elements
3. **Define Styles**: Create consistent color and text styles
4. **Auto Layout**: Use auto-layout for responsive designs
5. **Export Settings**: Configure proper export settings for assets

## Common Use Cases

- Landing page generation from Figma mockups
- Design system documentation
- Component library extraction
- Style guide automation
- Prototype to production conversion
