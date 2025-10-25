private async findFiles(pattern: string, context?: ToolExecutionContext): Promise<string[]> {
  const baseDir = context?.workingDirectory || process.cwd();
  
  // Sanitize pattern to prevent path traversal
  const sanitizedPattern = pattern.replace(/\.\.\/|\.\.\\\\/g, '').replace(/^\//, '');
  
  // Use proper glob matching
  if (sanitizedPattern.includes('*')) {
    const regexPattern = sanitizedPattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    
    const regex = new RegExp(`^${regexPattern}$`);
    const files = await fs.readdir(baseDir);
    return files.filter(file => regex.test(file));
  } else {
    const files = await fs.readdir(baseDir);
    return files.filter(file => file.includes(sanitizedPattern));
  }
}
