# Personal-computer network security

This is a local AI development stack, not an internet-facing deployment. Its default policy favors useful local interoperability while limiting exposure to the personal computer.

## Baseline implemented here

| Control | Default | Why |
| --- | --- | --- |
| Network | Named user-defined bridge `forkedai-shared` | Service-name DNS and isolation from unrelated Docker networks |
| Host publishing | IPv4 loopback `127.0.0.1` | Browser and desktop access without intentional LAN exposure |
| Standalone attachment | Not enabled by Compose | Reduces accidental attachment of unrelated containers |
| Privilege escalation | `no-new-privileges:true` | Blocks gaining additional privileges through setuid/setgid executables |
| Docker socket | Never mounted | Prevents a compromised AI service from controlling the Docker daemon |
| Model/document mounts | Read-only where practical | Limits modification of source assets and private documents |
| Secrets | Outside Git and Compose manifests | Avoids leaking Hugging Face, GitHub, or application credentials |

The shared bridge is a trust boundary around this stack, not between its services. Containers on one user-defined bridge can reach one another's container ports even when those ports are not published. Treat every container attached to it as mutually trusted. Anyone who controls the Docker daemon is already an administrator and can change network membership.

## Personal-computer threat model

The most likely risks are accidentally publishing an unauthenticated AI API to the LAN, running untrusted extensions or model-loading code, giving a tool-using model host credentials, and allowing one compromised container to move laterally to another. Generated media and prompts can also contain private data.

Use GGUF or safetensors artifacts when possible, pin Hub revisions, verify checksums, and review extensions before enabling them. Do not give model containers the Docker socket, SSH agent, browser profile, home directory, cloud credentials, or broad writable host mounts. Keep Docker Desktop, the NVIDIA driver, base images, and application forks patched.

## Comfy host-gateway exception

Only `comfy-frontend` receives the `host.docker.internal` mapping because this repository currently manages the frontend but not a ComfyUI backend container. Its proxy targets host port 8188. Host-gateway reachability is not authentication; keep the backend bound locally and trusted.

If the backend becomes a managed container, attach it to `forkedai-shared`, set `COMFY_BACKEND=http://comfy-backend:8188`, and remove the `extra_hosts` entry so the frontend uses service DNS instead of a route back to the host.

## Exposure choices

### 1. Localhost only — recommended

Keep:

```dotenv
FORKEDAI_BIND_ADDRESS=127.0.0.1
```

This is the implemented default. Host applications use `http://localhost:<port>`, while containers use service DNS such as `http://localai:8080`.

**Setbacks:** Other computers and phones cannot reach the services, and remote access requires a separate VPN or tunnel. Loopback binding is not authentication: untrusted software running on the computer can still attempt to connect to the published ports.

### 2. Private LAN

Bind to the computer's specific LAN address, not `0.0.0.0`:

```dotenv
FORKEDAI_BIND_ADDRESS=192.168.1.25
```

Add Windows Firewall rules restricted to the private profile, required ports, and trusted source addresses. Put an authenticated TLS reverse proxy in front of APIs before other people or devices can reach them. LocalAI, PrivateGPT, Stable Diffusion, and Comfy endpoints should be assumed unauthenticated unless you have explicitly configured authentication.

**Setbacks:** This expands the attack surface to other devices on the LAN and adds firewall, certificate, authentication, and address-management work. A DHCP address change or an overly broad firewall rule can either break access or expose more than intended, and a private LAN should not be treated as inherently trusted.

### 3. VPN-only remote access

Prefer a WireGuard or Tailscale-style private VPN over router port forwarding. Bind to the VPN interface address and restrict the host firewall to the VPN subnet. Do not publish these development endpoints directly to the internet.

**Setbacks:** Every client must be enrolled and kept secure, and access depends on the VPN software, identity provider or coordination service, and correct routing. A compromised enrolled device may still reach the services; VPN access does not replace application authentication.

### 4. Segmented bridges

When running less-trusted extensions or third-party services, replace the single bridge with multiple networks:

- `ai-edge`: reverse proxy and approved UIs.
- `ai-inference`: proxy, PrivateGPT, and LocalAI.
- `ai-media`: proxy and media generators.

Only a small authenticated proxy should join more than one network. This reduces lateral movement but adds routing and troubleshooting overhead. A single shared bridge cannot provide service-to-service firewall isolation.

**Setbacks:** Multiple networks make Compose configuration, service discovery, health checks, and debugging more complex. The multi-homed proxy becomes a high-value dependency, and incorrect network attachment can silently restore paths the segmentation was meant to remove. Segmentation also does not restrict outbound traffic by itself.

### 5. Egress-restricted or offline

Set `internal: true` on a separate runtime network only after images, models, Python packages, LocalAI backends, and Stable Diffusion helper repositories are present. Internal networks have no normal external route, so Hugging Face downloads, Git fetches, extension installation, and update checks will fail.

For selective outbound access, use a dedicated egress proxy or host firewall policy and allow only required registries and repositories. Build and download on an egress-enabled network, then run inference on an internal network.

**Setbacks:** Offline operation breaks on-demand downloads, extension installation, update checks, and any workflow that calls external APIs. Preloading and patching require more storage, planning, and maintenance, while selective allowlists can be brittle when registries, mirrors, or dependency endpoints change.

### 6. External shared network

If independently managed Compose projects must communicate, create a network explicitly and mark it `external: true` in an override file. This prevents one project from owning its lifecycle, but every attached project enters the same trust zone. Do not opt into `attachable: true` unless standalone-container attachment is a deliberate requirement.

**Setbacks:** The trust boundary expands to every participating project, so one compromised or misconfigured container can reach services outside its original stack. Network creation, naming, cleanup, and compatible service configuration must be coordinated separately; the external network also persists after any one Compose project is removed.

## Operational checks

```powershell
npm run stack:config
npm run stack -- up all
docker network inspect forkedai-shared
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Networks}}"
```

Expected host bindings begin with `127.0.0.1:`. The network inspection should show only the intended ForkedAI containers. Re-run these checks after adding a service, changing `.env`, or upgrading Docker.

## Incident response

If a container or extension behaves unexpectedly, stop the affected service, disconnect it from the bridge, revoke any credentials it could access, and review its writable mounts before restarting. Preserve logs and generated files needed for investigation. Rebuild from reviewed sources rather than trusting a modified container filesystem.
