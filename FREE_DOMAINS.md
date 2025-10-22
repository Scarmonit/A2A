# Free Domains and DNS Setup for A2A MCP Agents

## 🆓 Free Domain Providers

### 1. **Freenom** (Most Popular)
- **Domains**: .tk, .ml, .ga, .cf
- **Duration**: 12 months free
- **Renewal**: Free if traffic > 25 visits/3 months
- **Setup**: https://freenom.com

### 2. **EU.org** (Professional)  
- **Domain**: yourname.eu.org
- **Duration**: Permanent
- **Requirements**: Valid use case
- **Setup**: https://nic.eu.org

### 3. **Dot.tk**
- **Domain**: .tk domains
- **Duration**: 12 months free
- **Renewal**: Free with traffic
- **Setup**: https://dot.tk

### 4. **PP.ua** (Ukraine)
- **Domain**: yourname.pp.ua
- **Duration**: Permanent  
- **Requirements**: None
- **Setup**: https://pp.ua

### 5. **GitHub.io** (Developers)
- **Domain**: username.github.io/repo
- **Duration**: Permanent
- **Requirements**: GitHub account
- **Setup**: GitHub Pages

## 🌐 DNS Configuration

### Cloudflare (Free CDN + DNS)
```bash
# Add your domain to Cloudflare
1. Sign up at https://cloudflare.com
2. Add domain: a2a-agents.tk
3. Update nameservers at your domain provider:
   - NS1: charlie.ns.cloudflare.com  
   - NS2: lila.ns.cloudflare.com

# DNS Records
A     @           104.21.45.67   (Your server IP)
A     www         104.21.45.67   (Your server IP)  
CNAME api         a2a-mcp-server.railway.app
CNAME agents      a2a-mcp-agents.fly.dev
CNAME monitoring  a2a-grafana.onrender.com
```

### AWS Route 53 (12 months free)
```bash
# Create hosted zone
aws route53 create-hosted-zone --name a2a-agents.tk
# Add records via AWS console
```

### Google Cloud DNS (Free quota)
```bash
# Create zone  
gcloud dns managed-zones create a2a-zone --dns-name="a2a-agents.tk."
# Add records
gcloud dns record-sets transaction start --zone="a2a-zone"
```

## ⚡ Quick Setup Commands

### 1. Get Free .tk Domain
```bash
# Register at dot.tk
curl -X POST "https://api.dot.tk/v1/domain/register" \
  -d "domain=a2a-agents.tk" \
  -d "email=your@email.com"
```

### 2. Setup Cloudflare DNS
```bash
# Install Cloudflare CLI
npm install -g cloudflare-cli

# Add DNS records
cf-dns add a2a-agents.tk A @ 104.21.45.67
cf-dns add a2a-agents.tk CNAME api a2a-mcp-server.railway.app
cf-dns add a2a-agents.tk CNAME ws a2a-mcp-agents.fly.dev
```

### 3. SSL Certificate (Let's Encrypt)
```bash
# Install certbot
sudo apt-get install certbot

# Get SSL certificate
sudo certbot certonly --standalone -d a2a-agents.tk -d www.a2a-agents.tk
```

## 🚀 Recommended Setup

### Primary Domain: `a2a-agents.tk` (Freenom)
```
https://a2a-agents.tk           → Railway (Main API)
https://api.a2a-agents.tk       → Railway (API endpoint)
https://ws.a2a-agents.tk        → Fly.io (WebSocket streaming)  
https://agents.a2a-agents.tk    → Render (Agent management)
https://monitor.a2a-agents.tk   → Vercel (Monitoring dashboard)
```

### Backup Domains
```
a2a-mcp.ml                      → Secondary
agents-ai.ga                    → Backup
mcp-agents.cf                   → Failover
```

## 📊 DNS Configuration Examples

### Cloudflare Workers (Edge Computing)
```javascript
// workers.dev subdomain (free)
export default {
  async fetch(request, env, ctx) {
    // Proxy to your A2A MCP server
    return fetch('https://a2a-mcp-server.railway.app' + new URL(request.url).pathname, request);
  },
};
```

### Netlify Edge Functions
```javascript  
// _netlify/edge-functions/proxy.js
export default async (request, context) => {
  return await fetch('https://a2a-mcp-agents.fly.dev' + new URL(request.url).pathname, request);
};
```

### Vercel Edge Functions
```javascript
// api/proxy.js  
export default function handler(req, res) {
  // Proxy to your A2A agents
  proxy('https://a2a-mcp-server.railway.app')(req, res);
}
```

## 🔧 Automatic Domain Setup Script

```bash
#!/bin/bash
# setup-domain.sh

DOMAIN="a2a-agents.tk"
EMAIL="your@email.com"

echo "🌐 Setting up domain: $DOMAIN"

# 1. Register domain (manual step)
echo "📝 Register $DOMAIN at https://freenom.com"

# 2. Setup Cloudflare
echo "☁️  Adding to Cloudflare..."
curl -X POST "https://api.cloudflare.com/client/v4/zones" \
  -H "X-Auth-Email: $EMAIL" \
  -H "X-Auth-Key: $CF_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"name":"'$DOMAIN'","account":{"id":"'$CF_ACCOUNT_ID'"}}'

# 3. Add DNS records
ZONE_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=$DOMAIN" \
  -H "X-Auth-Email: $EMAIL" \
  -H "X-Auth-Key: $CF_API_KEY" | jq -r '.result[0].id')

# Add A record
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "X-Auth-Email: $EMAIL" \
  -H "X-Auth-Key: $CF_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"type":"CNAME","name":"@","content":"a2a-mcp-server.railway.app","ttl":1}'

echo "✅ Domain setup complete!"
echo "🔗 Your A2A agents are now available at: https://$DOMAIN"
```

## 🎯 Best Practices

1. **Use Cloudflare** for free SSL, CDN, and DDoS protection
2. **Setup monitoring** with UptimeRobot (free)  
3. **Enable caching** for better performance
4. **Use multiple domains** for redundancy
5. **Monitor DNS propagation** with whatsmydns.net

## 📈 Performance Optimizations

### Cloudflare Settings
- **SSL**: Full (strict)  
- **Minify**: CSS, JS, HTML
- **Brotli**: Enabled
- **HTTP/2**: Enabled
- **Cache Level**: Standard

### DNS Optimizations  
- **TTL**: 300 seconds (5 minutes)
- **CNAME Flattening**: Enabled
- **IPv6**: Enabled

Your A2A MCP agents will be blazing fast with global CDN and optimal DNS configuration! 🚀