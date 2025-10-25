# OpenSSH A2A Integration Guide

This document provides a complete, end-to-end guide to integrate OpenSSH with the A2A platform for credential-less, just-in-time access delivery. It covers architecture, setup, API reference, usage patterns, best practices, troubleshooting, performance, security hardening, and a production checklist with examples.

---

## 1) Architecture Overview

- Components
  - A2A Platform: Issues short-lived credentials and policy decisions via REST APIs and signed tokens.
  - A2A Broker/Agent (optional): Sidecar or gateway that brokers requests from bastions or workloads to A2A.
  - OpenSSH Server: Target host(s) running sshd that accept ephemeral credentials or certificate-based auth.
  - OpenSSH Client: Operator or automation client initiating SSH connections.
  - Secrets Store (optional): Stores bootstrap tokens, CA keys, or API keys with rotation.

- Trust model
  - SSH authentication uses short-lived user certificates signed by an A2A-backed CA, or dynamic ephemeral local accounts with one-time passwords (OTPs).
  - Authorization policies live in A2A and evaluate requester identity, device posture, time, resource, and action.
  - All tokens and certificates are time-bounded; revocation occurs by reducing TTL and policy updates.

- High-level flow
  1. Client (human or workload) requests access for a target host/role.
  2. A2A evaluates policy and returns a short-lived SSH certificate or one-time credential.
  3. Client connects to OpenSSH using the ephemeral credential; sshd validates against a trusted CA or PAM module.
  4. Session is optionally recorded and events are exported to SIEM.

- Topologies
  - Direct: Client talks to A2A API; uses returned SSH cert for direct ssh to host.
  - Bastion: Client connects to a bastion that fetches/validates credentials with A2A and then proxies to target.
  - Sidecar: Workload retrieves certs via a local A2A agent and mounts them as files with controlled permissions.

Diagram (conceptual)
Client -> A2A API -> [SSH Cert] -> ssh -> Target sshd (trusts A2A CA)

---

## 2) Setup Guide

Prerequisites
- OpenSSH 7.2+ on servers and clients (certificate auth supported)
- Admin access to A2A with ability to define policies and create an SSH CA
- Secure storage for CA private key (ideally HSM or KMS-backed)
- Network reachability from clients/bastions to A2A API

Server configuration (sshd)
1. Enable SSH certificate authentication by trusting the A2A-issued SSH CA public key
   - Obtain CA public key (ssh-ed25519 or rsa format), e.g., `a2a_ssh_ca.pub`
   - Place it on each target host and reference it in sshd_config:
     - TrustedUserCAKeys /etc/ssh/a2a_trusted_ca.pub
     - PubkeyAuthentication yes
     - PasswordAuthentication no (optional; recommended)
     - ChallengeResponseAuthentication no (optional)
     - AuthorizedPrincipalsFile /etc/ssh/authorized_principals/%u (optional for role scoping)
   - Restart sshd: `sudo systemctl restart sshd`

2. (Optional) Principal-based authorization
   - Create files under /etc/ssh/authorized_principals/<username> with allowed principals per user/role.

Client configuration
1. Install OpenSSH client and ensure it supports `-o CertificateFile` and `-o IdentityFile`.
2. Create an SSH config entry for convenience:

Host prod-*.example.com
  User ec2-user
  IdentityFile ~/.ssh/a2a_id_ed25519
  CertificateFile ~/.ssh/a2a_id_ed25519-cert.pub
  IdentitiesOnly yes
  PubkeyAcceptedAlgorithms +ssh-ed25519-cert-v01@openssh.com

A2A configuration
1. Create an SSH CA (or register an existing one) in A2A.
2. Define policies mapping identities/groups to principals, hosts, TTLs, and constraints (source IPs, times, MFA).
3. Create an application profile/credentials to call A2A APIs (client_id/secret or workload identity).
4. (Optional) Configure event sinks for audit (SIEM, CloudWatch, Splunk, Syslog).

---

## 3) API Reference (A2A)

Note: Endpoints and schemas are illustrative—replace base URL and fields with your A2A deployment specifics.

- POST /v1/ssh/certificates: Issue short-lived SSH user certificate
  Request
  {
    "principal": "deploy",
    "public_key": "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI...",
    "ttl": "10m",
    "hosts": ["web-01.example.com"],
    "reason": "Prod deploy",
    "constraints": {"source_ips": ["203.0.113.0/24"], "permit-agent-forwarding": false}
  }
  Response
  {
    "certificate": "ssh-ed25519-cert-v01@openssh.com AAAA...",
    "valid_before": "2025-10-25T02:25:00Z",
    "principals": ["deploy"],
    "extensions": {"permit-pty": true}
  }

- POST /v1/ssh/keys: Generate and escrow a new keypair (optional)
  Request: {"type": "ed25519", "comment": "a2a-client-42"}
  Response: {"public_key": "ssh-ed25519 AAAA...", "private_key": "-----BEGIN OPENSSH PRIVATE KEY-----..."}

- GET /v1/policies/ssh/: Evaluate policy for a subject/resource
  Query: subject, resource, action, context
  Response: {"allowed": true, "ttl": "10m", "principals": ["deploy"], "mfa": "required"}

- POST /v1/audit/events: Ingest or fetch session audit hooks (if using callback model)

Auth
- Use OAuth2 client credentials, JWT, or workload identity (IMDS/STS). Include bearer token in Authorization header.

---

## 4) Usage Patterns & Examples

A) Human operator (on-demand)
- Request a cert, then connect:

# 1) Generate key if needed
ssh-keygen -t ed25519 -f ~/.ssh/a2a_id_ed25519 -N ""

# 2) Request cert from A2A
curl -s -X POST "$A2A_URL/v1/ssh/certificates" \
  -H "Authorization: Bearer $A2A_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "principal": "deploy",
    "public_key": "'"$(cat ~/.ssh/a2a_id_ed25519.pub)'"",
    "ttl": "10m",
    "hosts": ["web-01.example.com"],
    "reason": "manual-maintenance"
  }' | jq -r .certificate > ~/.ssh/a2a_id_ed25519-cert.pub

# 3) SSH
ssh -i ~/.ssh/a2a_id_ed25519 -o CertificateFile=~/.ssh/a2a_id_ed25519-cert.pub ec2-user@web-01.example.com

B) Automation (CI/CD)
- Fetch cert at job start, run commands, let cert expire:

A2A_TOKEN=$(oidc-cli get-token)
PUB=$(cat "$WORKSPACE/ci_id_ed25519.pub")
curl -s -X POST "$A2A_URL/v1/ssh/certificates" \
  -H "Authorization: Bearer $A2A_TOKEN" -H "Content-Type: application/json" \
  -d '{"principal":"deploy","public_key":"'$PUB'","ttl":"10m"}' | jq -r .certificate > "$WORKSPACE/ci_id_ed25519-cert.pub"
ssh -i "$WORKSPACE/ci_id_ed25519" -o CertificateFile="$WORKSPACE/ci_id_ed25519-cert.pub" ec2-user@web-01.example.com 'uptime && whoami'

C) Bastion-mode with ProxyCommand

Host bastion
  HostName bastion.example.com
  User jump
  IdentityFile ~/.ssh/a2a_id_ed25519
  CertificateFile ~/.ssh/a2a_id_ed25519-cert.pub

Host *.corp.example.com
  ProxyCommand ssh -W %h:%p bastion
  User admin

---

## 5) Best Practices

- Prefer SSH certificates over static keys; set short TTLs (5–30 minutes).
- Enforce MFA for sensitive roles via A2A policy.
- Use principals to encode roles (deploy, breakglass, readonly) and scope access on servers via AuthorizedPrincipalsFile.
- Disable password authentication on servers when feasible.
- Store CA private key in HSM/KMS; never on disk unencrypted.
- Log issuance and access decisions; export to SIEM.
- Pin client source IP ranges and device posture when possible.
- Rotate client credentials and A2A API secrets regularly.

---

## 6) Troubleshooting

- ssh: Permission denied (publickey)
  - Verify server TrustedUserCAKeys path and file permissions (root:root, 0644).
  - Confirm certificate principals match allowed principals for the target user.
  - Check certificate validity period (valid_before/after) and client/server clock skew (use NTP).
- Certificate accepted but command denied
  - Review ForceCommand, PermitOpen, and AuthorizedPrincipalsFile options.
- API call failures
  - Check token expiry and scopes; verify base URL and TLS trust.
- Bastion connectivity issues
  - Validate ProxyCommand and that bastion trusts the same A2A CA.

---

## 7) Performance Optimization

- Cache certificates for their TTL and reuse within session pools to reduce API calls.
- Prefer ed25519 keys for speed and smaller size.
- Batch issuance for parallel jobs by requesting multiple principals/hosts when policy allows.
- Use keep-alives (ServerAliveInterval/CountMax) for long-running sessions.
- Place A2A brokers close to clients to minimize latency.

---

## 8) Security Hardening

- Set short TTLs, require MFA for production access, and enforce source IP constraints.
- Disable agent forwarding, X11 forwarding, and compression unless needed; set via certificate extensions.
- Use per-environment CAs; do not share CA across prod/non-prod.
- Lock down sshd_config: PermitRootLogin no, PasswordAuthentication no, ChallengeResponseAuthentication no, UsePAM yes.
- Monitor and alert on abnormal issuance rates and denied decisions.
- Regularly rotate and attest CA keys; maintain key custody logs.

---

## 9) Production Deployment Checklist

- A2A
  - [ ] SSH CA created and stored in HSM/KMS
  - [ ] Policies defined with principals, TTLs, MFA, constraints
  - [ ] API client configured with least-privilege scopes
  - [ ] Audit sink connected (SIEM)
- Servers
  - [ ] sshd_config updated with TrustedUserCAKeys and hardened settings
  - [ ] AuthorizedPrincipalsFile populated per role/user
  - [ ] NTP synchronized
- Clients/Bastions
  - [ ] SSH config entries created; paths correct
  - [ ] Automated flows request/refresh certs as needed
  - [ ] Proxy/Bastion config validated
- Validation
  - [ ] Successful test login with issued certificate
  - [ ] Policy denials behave as expected
  - [ ] Logs visible in SIEM

---

## 10) Appendix: Example Authorized Principals

ec2-user deploy
admin admin,breakglass environment=prod source-address=203.0.113.0/24

End of document.
