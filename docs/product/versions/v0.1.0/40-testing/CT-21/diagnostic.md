# CT-21 Clean-Host Runtime Diagnostic

Status: approval required before remote mutation

Observed: 2026-08-20

Target alias: `210CPU`

## Purpose

Determine whether the available remote host can execute P-T21 without touching the healthy local BasicLinear containers.

## Read-Only Findings

- The target reports Ubuntu 20.04.6 LTS, Linux 5.4, x86_64.
- `systemd-detect-virt` reports `docker`; cgroup paths place the target inside a Kubernetes-managed Docker container.
- Cgroup v1 mounts are read-only.
- The effective capability set does not include `CAP_SYS_ADMIN`.
- No Docker, Compose, Podman, nerdctl, containerd, Buildah, or related runtime binary is installed.
- The host has ample disk and memory for the test workload.
- Unprivileged user namespaces are enabled and `unshare -Ur true` succeeds.
- `/dev/fuse` exists and is writable.
- The configured Ubuntu repository advertises `docker.io` 26.1.3; `uidmap`, `slirp4netns`, and `fuse-overlayfs` are also available but not installed.
- No Docker socket is mounted from the outer host.

## Assessment

A normal Docker daemon inside this target is not a credible qualification environment. The missing `CAP_SYS_ADMIN`, read-only cgroups, and nested-container boundary prevent treating ordinary Docker-in-Docker as supported even if packages install.

A dedicated non-root account with rootless Docker 26, subordinate UID/GID ranges, userspace networking, and FUSE overlay storage is technically plausible because user namespaces and `/dev/fuse` work. It remains unproven until a minimal daemon and Compose probe pass. Installing the required packages and creating the account are persistent remote mutations and require maintainer approval.

## Candidate Probe After Approval

1. Install only `docker.io`, `uidmap`, `slirp4netns`, and `fuse-overlayfs` plus their required dependencies.
2. Create a dedicated `basiclinear-test` user with subordinate UID/GID ranges.
3. Configure a rootless daemon with FUSE overlay storage and userspace networking.
4. Confirm Docker Engine 26 and Compose compatibility.
5. Run a disposable `hello-world` or no-op container and prove create, start, network, volume, stop, and remove behavior.
6. Stop if any prerequisite requires privileged outer-container changes.
7. Only after the probe passes, transfer a source snapshot and execute the locked P-T21 protocol.

## Mutation Record

No package, user, daemon, socket, source file, container, volume, network, or system configuration was created or changed on `210CPU` during this diagnostic. Only read-only operating-system, capability, cgroup, device, package-candidate, disk, and memory commands were run.

The healthy local `basiclinear-verify-db`, `basiclinear-verify-api`, and `basiclinear-verify-web` containers were not stopped, recreated, or modified.
