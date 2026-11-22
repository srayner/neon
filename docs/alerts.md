# Neon Alerts Specification

This document defines every alert Neon can send, what each one means, how
severe it is, and how it behaves over time. It is the source of truth: the
code and its tests must follow it. When behaviour needs to change, change
this document first.

**Status:** specification only. Apart from the test alert on the Settings
page, none of these alerts is built yet.

---

## 1. Delivery

Alerts are sent as push notifications through a self-hosted
[ntfy](https://ntfy.sh) server, configured with `NTFY_URL`, `NTFY_TOPIC` and
`NTFY_TOKEN` (see the [README](../README.md)).

---

## 2. Alert IDs

Every alert has a short ID made of a category letter and a number, e.g. `C1`.

| Letter | Category |
|---|---|
| C | Containers |
| H | Host and agent |
| R | Server resources |
| S | Security |

Rules:

- **IDs never change and are never reused.** If an alert is dropped, its ID
  is retired and left as a gap.
- **A new alert takes the next free number in its category.**
- Tests, alert messages and discussions refer to alerts by ID.

---

## 3. Severity

Each alert ID has one fixed severity. Severity decides the ntfy priority,
which decides how the phone reacts.

| Severity | Meaning | ntfy priority | On the phone |
|---|---|---|---|
| Critical | Something is down | 5 (max) | Pop-up, sound, long vibration |
| Warning | Degraded or at risk | 3 (default) | Sound, short vibration |
| Info | Worth knowing, nothing to do | 2 (low) | Silent; shows in the notification drawer |

Priority levels are as described in the ntfy documentation
(<https://docs.ntfy.sh/publish/#message-priority>).

---

## 4. Conditions and events

Every alert is one of two kinds.

### Conditions

A **condition** is a problem that stays true until something changes, such as
a container being down.

- When the problem starts, the alert **opens** and a notification is sent at
  the alert's severity.
- While the alert is open, it is **not sent again**, however many times the
  underlying signal repeats.
- When the problem clears, the alert **resolves** and a "resolved"
  notification is sent at Info priority.
- Every condition has a resolved notification. There are no separate
  "recovered" or "back online" alerts.

### Events

An **event** is a one-off fact with nothing to fix, such as a new container
appearing. It sends one notification and has no resolved notification.

---

## 5. Alert catalogue

### Conditions

| ID | Alert | Opens when | Resolves when | Severity |
|---|---|---|---|---|
| C1 | Container down | A running container stops running, for any reason. This includes a container stopped on purpose. The message says why: stopped, crashed (with exit code), killed, or out of memory. | The container is running again | Critical |
| C2 | Crash loop | A container keeps crashing and restarting | The container stays up | Critical |
| C3 | Unhealthy | A container's health check reports unhealthy. Only applies to containers with a health check. | The health check reports healthy | Warning |
| C4 | Paused | A container is paused | The container is unpaused | Info |
| H1 | Server offline | Neon stops hearing from a server's agent | The agent is heard from again | Critical |
| H2 | Docker unreachable | The agent is running but cannot talk to Docker | The agent can talk to Docker again | Critical |
| R1 | Disk nearly full | Disk usage goes above a threshold | Disk usage falls back below it | Warning |
| R2 | Memory high | Memory usage stays above a threshold | Memory usage falls back below it | Warning |
| R3 | CPU high | CPU usage stays above a threshold | CPU usage falls back below it | Warning |
| S1 | Security issues found | A security scan finds issues | The issues are fixed | Warning |

### Events

| ID | Alert | Sent when | Severity |
|---|---|---|---|
| C5 | Container removed | A container Neon knew about is removed | Info |
| C6 | New container | A container Neon has not seen before appears | Info |
| C7 | Image changed | A service is now running a different image version | Info |
| H3 | Monitoring gap | The agent, or its connection to Docker, was down for a while, so changes may have been missed. The message says how long. | Warning |

### Notes

- **C1 and manual stops.** Stopping a container on purpose raises C1. This is
  deliberate, and stopping a container is the main way to check that alerting
  works.
- **S1** comes from Trivy scan data and belongs to a separate milestone.
  Alerts will be grouped (for example one notification per scan) so a scan
  does not send one notification per issue. The grouping rules will be
  defined in that milestone.

---

## 6. Open questions

These must be decided, and this document updated, before the related alerts
are built.

1. **Deploys and C1.** A deploy stops the old container and starts a new one,
   which would raise C1 for every replaced container. Options: alert on every
   stop, or wait a short grace period and stay quiet if the same service is
   running again by then.
2. **C1 and C2 together.** A container in a crash loop is also repeatedly
   down. The expected rule is that C2 replaces C1 rather than both being
   open, but this needs defining.
3. **Thresholds and timings.** The crash-loop rule (how many crashes in how
   long), how long before H1 opens, the R1–R3 thresholds, and how long R2 and
   R3 must stay high.
4. **Security grouping.** How S1 notifications are grouped (see notes above).
