# Cloudflare Tunnel Setup for AgentOS

## Overview
This document describes the Cloudflare tunnel setup that enables HTTPS access to the local AgentOS instance running on port 7777.

## Tunnel Details
- **Tunnel Name**: agentos-tunnel
- **Tunnel ID**: 324dd653-7f1d-41d7-ae9a-7d3e3ae54c1d
- **Tunnel URL**: https://agentos-tunnel.significa.sk
- **Local AgentOS**: http://0.0.0.0:7777

## Environment Variables
The following environment variables have been set in the local .env file:

```
AGENT_OS_URL=https://agentos-tunnel.significa.sk
OPENVPM_AGENTOS_BASE_URL=https://agentos-tunnel.significa.sk
```

## Starting the Tunnel
To start the tunnel manually:

```bash
cloudflared tunnel --config C:\\Users\\marek\\.cloudflared\\tunnels\\agentos-tunnel.yml run agentos-tunnel
```

## Dokploy Deployment
For production deployment via Dokploy, ensure the same environment variables are set in the Dokploy application settings:

- AGENT_OS_URL=https://agentos-tunnel.significa.sk
- OPENVPM_AGENTOS_BASE_URL=https://agentos-tunnel.significa.sk

## Verification
Test the tunnel is working:

```bash
curl https://agentos-tunnel.significa.sk/health
```

Expected response:
```json
{"status":"ok","instantiated_at":"..."}
```

## Notes
- The tunnel must be running for the web application to communicate with AgentOS
- The tunnel does not persist after system restart - it needs to be started manually or set up as a Windows service for production use

