# Network security

This is a local AI development stack, not an internet-facing deployment. Its default policy favors useful local interoperability while limiting exposure to the personal computer.

## Baseline implemented here

| Control               | Default                                                                   | Why                                                                    |
| --------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Networks              | Named bridges `forkedai-edge`, `forkedai-inference`, and `forkedai-media` | Service-name DNS with inference/media trust-zone separation            |
| Host publishing       | Caddy HTTPS gateway on IPv4 loopback ports 8443-8447                      | One reviewed ingress service without intentional LAN exposure          |
| Standalone attachment | Not enabled by Compose                                                    | Reduces accidental attachment of unrelated containers                  |
| Privilege escalation  | `no-new-privileges:true`                                                  | Blocks gaining additional privileges through setuid/setgid executables |
| Docker socket         | Never mounted                                                             | Prevents a compromised AI service from controlling the Docker daemon   |
| Model/document mounts | Read-only where practical                                                 | Limits modification of source assets and private documents             |
| Secrets               | Outside Git and Compose manifests                                         | Avoids leaking Hugging Face, GitHub, or application credentials        |

Each bridge is a trust boundary, not a per-service firewall. Containers sharing one bridge can reach one another’s container ports even when those ports are not published. Treat every container on the same bridge as mutually trusted. The multi-homed gateway is a high-value dependency because it can reach both workload zones. Anyone who controls the Docker daemon is already an administrator and can change network membership.

## Threat model

The most likely risks are accidentally publishing an unauthenticated AI API to the LAN, running untrusted extensions or model-loading code, giving a tool-using model host credentials, and allowing one compromised container to move laterally to another. Generated media and prompts can also contain private data.

Use GGUF or safetensors artifacts when possible, pin Hub revisions, verify checksums, and review extensions before enabling them. Do not give model containers the Docker socket, SSH agent, browser profile, home directory, cloud credentials, or broad writable host mounts. Keep Docker Desktop, the NVIDIA driver, base images, and application forks patched.

Treat Compose files, overrides, Dockerfiles, build contexts, and referenced bind
mounts as executable trusted input. Docker Compose can grant devices, host
filesystem access, elevated privileges, or host networking exactly as requested.
Review `npm run stack:config` before applying changes and do not run untrusted
Compose projects with access to this stack's data roots.

WSL2 is optimized for development interoperability, not maximum isolation from
other software running under the same Windows user. For workloads that require a
stronger boundary, evaluate Docker Desktop's Hyper-V backend or Enhanced
Container Isolation, then separately validate GPU support, bind mounts, and
performance before migrating this stack.

## Shared-storage boundary

All backend containers can read the common model, plugin, and tool roots and can exchange files through common tensor and object roots. This intentionally creates a data trust boundary: a compromised backend can read every shared model, plugin, and tool and can replace writable tensors or objects consumed by another backend. The static Comfy frontend receives none of these mounts.

Models, plugins, and tools are mounted read-only. A nested writable
`models/inbox` and `plugins/inbox` overlay exists only for staging; promote
reviewed artifacts into the catalog with `npm run models -- promote` /
`promote-plugin` before treating them as shared library content. Keep
service-specific runtime state outside the shared roots, review host-side
plugin changes, pin model and plugin revisions, and do not store credentials,
personal documents, browser data, or executable secrets in shared objects.
Serialized tensors are data exchange, not shared live GPU memory. Avoid
pickle-based formats from untrusted sources because deserialization can execute
code.

The host placement is also a recovery boundary: C: contains read-mostly assets, E: contains durable private state, and the two-column Simple Storage Space on D: contains only rebuildable caches and disposable scratch data. Media backups use the host-only `E:/VIMG` root, which is deliberately excluded from Compose mounts so a compromised container cannot alter the backup directly. Do not move the Caddy CA, private documents, generated media that has not been backed up, or the only copy of a workflow onto D: because that Storage Space has no redundancy.

## Comfy service routing

`comfy-frontend` reaches `comfy-backend` through service DNS on `forkedai-media`. Neither service receives a host-gateway mapping or publishes a host port. Trusted local clients use `https://localhost:8446` for the UI and `https://localhost:8447` for direct API access through the gateway.

ComfyUI model files are mounted read-only. Input, output, user state, temporary files, and caches use narrowly scoped writable mounts; the container does not receive the Docker socket, source repository, home directory, or host credentials.

## Gateway authentication follow-up

Caddy is the only host-facing container. It uses an internal development CA for
`GATEWAY_HOSTNAME` (default `localhost`), serving LocalAI on 8443, PrivateGPT on
8444, Stable Diffusion on 8445, the Comfy UI on 8446, and the Comfy API on 8447.
Backend traffic remains HTTP within its trust-zone bridge. Each reverse proxy
imports a shared `bridge_upstream` health probe so Caddy re-dials Docker DNS
after a backend recreate instead of holding a stale address. The Caddy admin API
is disabled, configuration is mounted read-only, and CA state is persisted under
`RUNTIME_ROOT/caddy/data`.

The gateway is deliberately unauthenticated while it remains bound to loopback;
HTTPS protects transport and server identity but does not authorize a client.
`npm run media -- init` installs a no-op auth snippet at
`RUNTIME_ROOT/caddy/gateway-auth.caddy`. Before binding to a LAN or VPN address,
complete this follow-up:

1. Set `GATEWAY_HOSTNAME` to a controlled LAN or VPN DNS name and configure
   certificates trusted by every intended client (or keep `tls internal` only for
   lab clients that trust the Caddy CA).
2. Generate a bcrypt hash (never commit plaintext):

```powershell
docker run --rm caddy:2.11.4-alpine caddy hash-password
```

3. Replace `RUNTIME_ROOT/caddy/gateway-auth.caddy` with a `basicauth` snippet
   based on [docker/gateway-auth.basicauth.example.caddy](../docker/gateway-auth.basicauth.example.caddy).
4. Restrict Windows Firewall to the required profile, gateway port, interface,
   and source addresses.
5. Optionally set managed-stack `LOCALAI_API_KEY` as a second layer after gateway
   auth is working (still never commit the secret).
6. Verify that no backend service has a published port and test both permitted
   and rejected clients.

`npm run stack -- up` / `switch` / `config` refuse a non-loopback
`FORKEDAI_BIND_ADDRESS` unless the auth snippet contains `basicauth`.
`stack:doctor` reports the same gate as a WARN/failing check.

Do not place plaintext passwords or CA private keys in Compose, the Caddyfile,
`.env`, or Git. Until the follow-up is complete, keep
`FORKEDAI_BIND_ADDRESS=127.0.0.1`.

## Preparing an exposure change

Keep the localhost default until the controls required by the selected option are ready. Before changing `.env` or a Compose override:

1. Identify exactly which clients need access and which service ports they need. Choose the least-exposed option that meets that requirement.
2. Capture the current resolved Compose configuration, published ports, and network membership using the commands under [Operational checks](#operational-checks).
3. Prepare authentication, TLS, firewall rules, VPN enrollment, proxy routing, or cached dependencies before widening or restricting connectivity.
4. Define a success test from every intended client and a rejection test from at least one client that should not have access.
5. Keep a rollback ready: restore `FORKEDAI_BIND_ADDRESS=127.0.0.1`, remove the option-specific override and firewall rules, then recreate the gateway and affected services.

Do not commit `.env`, credentials, private keys, firewall exports, or VPN enrollment material. Record only non-secret architecture decisions and sanitized test results in Git.

| Proposed change              | Ready-to-change gate                                                                                       | Rollback trigger                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Private LAN                  | Stable host address, restricted private-profile firewall rules, and authenticated TLS proxy tested locally | An unintended LAN client can connect, or an intended client bypasses authentication      |
| VPN-only                     | VPN interface and subnet confirmed, intended devices enrolled, and firewall limited to that subnet         | Traffic reaches the service outside the VPN, or device revocation does not remove access |
| Segmented bridges            | Service dependency map complete and only the authenticated proxy intentionally multi-homed                 | A service can reach a network not required by its dependency map                         |
| Egress-restricted or offline | Images, models, packages, backends, and update procedure available without runtime egress                  | Startup or an approved workflow requires an unplanned external endpoint                  |
| External shared network      | Network owner, name, participating projects, and cleanup responsibility documented                         | An unapproved project or standalone container joins the trust zone                       |

## Exposure choices

### 1. Localhost only — recommended

Keep:

```dotenv
FORKEDAI_BIND_ADDRESS=127.0.0.1
```

This is the implemented default. Host applications use `https://localhost` on the service-specific gateway ports 8443-8447, while containers use service DNS such as `http://localai:8080`.

**Setbacks:** Other computers and phones cannot reach the services, and remote access requires a separate VPN or tunnel. Loopback binding is not authentication: untrusted software running on the computer can still attempt to connect to the published ports.

### 2. Private LAN

Bind to the computer's specific LAN address, not `0.0.0.0`:

```dotenv
FORKEDAI_BIND_ADDRESS=192.168.1.25
```

Changing the bind address alone is insufficient. The checked-in Caddy routes and internal certificates are for `localhost`; an IP-address request will not have the intended site name or trusted certificate.

Before recreating the gateway, replace the Caddy site names with controlled LAN or VPN DNS names, provision certificates trusted by every intended client, and add reviewed authentication. Then add Windows Firewall rules restricted to the private profile, required ports, interface, and trusted source addresses.

LocalAI, PrivateGPT, Stable Diffusion, and Comfy endpoints should be assumed unauthenticated unless authentication has been explicitly configured and tested.

**Setbacks:** This expands the attack surface to other devices on the LAN and adds firewall, certificate, authentication, and address-management work. A DHCP address change or an overly broad firewall rule can either break access or expose more than intended, and a private LAN should not be treated as inherently trusted.

### 3. VPN-only remote access

Prefer a WireGuard or Tailscale-style private VPN over router port forwarding. Bind to the VPN interface address and restrict the host firewall to the VPN subnet. Do not publish these development endpoints directly to the internet.

**Setbacks:** Every client must be enrolled and kept secure, and access depends on the VPN software, identity provider or coordination service, and correct routing. A compromised enrolled device may still reach the services; VPN access does not replace application authentication.

### 4. Segmented bridges

The implemented topology uses multiple networks:

- `forkedai-edge`: HTTPS gateway ingress.
- `forkedai-inference`: gateway, PrivateGPT, and LocalAI.
- `forkedai-media`: gateway and media services.

Only the gateway joins more than one network. This reduces lateral movement but adds routing and troubleshooting overhead. Further split a zone if services within it are not mutually trusted; a bridge cannot provide per-service firewall isolation.

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
docker network inspect forkedai-edge forkedai-inference forkedai-media
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Networks}}"
```

The only published bindings should belong to the gateway at `127.0.0.1:8443` through `127.0.0.1:8447`; backend services should show no host port. The network inspection should show only the intended ForkedAI containers. Re-run these checks after adding a service, changing `.env`, or upgrading Docker.

## Incident response

If a container or extension behaves unexpectedly, stop the affected service, disconnect it from the bridge, revoke any credentials it could access, and review its writable mounts before restarting. Preserve logs and generated files needed for investigation. Rebuild from reviewed sources rather than trusting a modified container filesystem.
