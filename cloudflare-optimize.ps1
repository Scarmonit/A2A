# Cloudflare Performance Optimization for A2A MCP Agents

# Page Rules (add in Cloudflare dashboard)
# 1. api.yourdomain.com/healthz*
#    - Cache Level: Bypass
#    - Edge Cache TTL: 2 minutes
#    
# 2. api.yourdomain.com/metrics*  
#    - Cache Level: Bypass
#    - Browser Cache TTL: 30 minutes
#
# 3. ws.yourdomain.com/*
#    - SSL: Flexible (for WebSocket compatibility)
#    - Cache Level: Bypass
#
# 4. *.yourdomain.com/*
#    - Cache Level: Standard
#    - Edge Cache TTL: 2 hours
#    - Browser Cache TTL: 4 hours
#    - Security Level: Medium

Write-Host "⚡ Cloudflare optimization guidelines:" -ForegroundColor Cyan
Write-Host "1. Enable HTTP/3 for faster connections" -ForegroundColor White
Write-Host "2. Use Full (strict) SSL for security" -ForegroundColor White  
Write-Host "3. Enable Brotli compression" -ForegroundColor White
Write-Host "4. Set up Page Rules for caching" -ForegroundColor White
Write-Host "5. Configure Rate Limiting for protection" -ForegroundColor White
