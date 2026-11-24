# Neon Alerts Specification

This document defines every alert Neon can send, what each one means, how
severe it is, how it behaves over time, where it is decided and how it is
tested. It is the source of truth: the code and its tests must follow it.
When behaviour needs to change, change this document first.

**Status:** the alert engine (sections 4, 5 and 7.1) is built. Apart from
the test alert on the Settings page, none of the alerts in section 6 is built
yet.

---

## 1. Delivery

Alerts are sent as push notifications through a self-hosted
[ntfy](https://ntfy.sh) server, configured with `NTFY_URL`, `NTFY_TOPIC` and
`NTFY_TOKEN` (see the [README](../README.md)).

---

## 2. Where alerts are decided

**The agent reports facts. The Neon server decides alerts.**

### The agent

The agent runs on each server. It collects what it sees and sends it to
Neon. It does not decide severity, open or resolve alerts, or send
notifications.

| Fact | Sent |
|---|---|
| Server details, including OS and Docker version, and the agent's heartbeat interval | When the agent registers (on start, and when its token is renewed) |
| Heartbeat | Every 60 seconds |
| Metrics (CPU, memory, disk) | On a schedule |
| The full list of containers and their state | On a schedule, and whenever Docker reports a container change |
| Whether it can reach Docker | When this changes |
| Gaps in its view of Docker (from when to when) | When it reconnects |

Docker sends several events for a single action (one `docker stop` produces
`kill`, `stop` and `die`). The agent uses Docker events only as a prompt to
read the containers' current state; it does not forward each event as a
separate fact. The server never counts Docker events.

### The server

The Neon server holds every rule in this document. It compares each new fact
with what it already knows, opens and resolves alerts, makes sure an open
alert does not fire again, records activity and sends notifications.

Reasons:

- Some alerts can only be seen by the server: if an agent goes silent (H1),
  it cannot report that itself.
- The server keeps alerts in its database, so they survive restarts of either
  the agent or the server.
- All the rules are in one place, so they are tested in one place.
- The ntfy credentials stay on the server.

---

## 3. Alert IDs

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

## 4. Severity

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

## 5. Conditions, events and the alert record

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
- There is at most one open alert per alert ID per subject (a container,
  service or server).

### Events

An **event** is a one-off fact with nothing to fix, such as a new container
appearing. It sends one notification and has no resolved notification.

### The alert record

Every alert, condition or event, is stored as an **alert record** in Neon's
database. It holds:

- the alert ID (e.g. `C1`) and its severity
- what it is about: the server, and the container or service where relevant
- the message
- its status: **open** or **resolved** for conditions; events are recorded
  as resolved straight away
- when it opened and, for conditions, when it resolved
- its notifications (one when it opens and, for conditions, one when it
  resolves), each with a status of **pending**, **sent** or **failed**, the
  number of attempts and the last error

Neon's activity timeline records an entry when an alert opens and when it
resolves, linked to the alert record.

### The scheduled check

Neon runs one check every 30 seconds, inside Neon itself, started from
Next.js's startup hook (`instrumentation.ts`). It needs no separate cron job.
Each run:

1. Looks for servers whose heartbeats have stopped (H1, see section 7.3).
2. Sends pending notifications.

### Sending notifications

Notifications are only ever sent by the scheduled check. Nothing sends one
directly.

1. When an alert opens or resolves, its notification is saved as
   **pending**.
2. The scheduled check sends pending notifications oldest first, so a
   resolved notification never arrives before its opening one.
3. A notification that is delivered is marked **sent**. One that is not
   stays pending and is tried again on the next check.
4. A notification still not delivered 1 hour after it was created is marked
   **failed** and not tried again. This stops a backlog flooding the phone
   when ntfy comes back after a long outage. The alert itself is still
   recorded in Neon.

Every notification states the time the change happened, in UTC (e.g.
"atlas down at 14:02 UTC on 24 Nov 2026"), so a notification that arrives
late does not mislead. Times are stored in UTC; Neon's web pages can show
them in UTC or the browser's local time. The Alerts
section of the Settings page shows how many notifications have failed.

### Subjects that are recreated

A deploy replaces a container with a new one that has a new Docker ID.
Container alerts are therefore about the **service** (the Docker Compose
project and service name), or the container name for containers not run by
Compose, not about the Docker container ID. An alert opened for a service
can be resolved by its replacement container.

---

## 6. Alert catalogue

### C: Containers

| ID | Alert | Kind | Fires when | Resolves when | Severity |
|---|---|---|---|---|---|
| C1 | Container down | Condition | A running container stops running, for any reason. This includes a container stopped on purpose. The message says why: stopped, crashed (with exit code), killed, or out of memory. | The container is running again | Critical |
| C2 | Crash loop | Condition | A container keeps crashing and restarting | The container stays up | Critical |
| C3 | Unhealthy | Condition | A container's health check reports unhealthy. Only applies to containers with a health check. | The health check reports healthy | Warning |
| C4 | Paused | Condition | A container is paused | The container is unpaused | Info |
| C5 | Container removed | Event | A container Neon knew about is removed, other than being replaced by a deploy | — | Info |
| C6 | New container | Event | A container for a service Neon has not seen before appears | — | Info |
| C7 | Service version changed | Event | A service is running a different image version from before. The version is the one Neon already shows for the service, taken from the image tags. | — | Info |

### H: Host and agent

| ID | Alert | Kind | Fires when | Resolves when | Severity |
|---|---|---|---|---|---|
| H1 | Server offline | Condition | Neon stops receiving heartbeats from a server's agent | Heartbeats arrive again | Critical |
| H2 | Docker unreachable | Condition | The agent is running but cannot talk to Docker | The agent can talk to Docker again | Critical |
| H3 | Monitoring gap | Event | The agent, or its connection to Docker, was down for a while, so changes may have been missed. The message says how long. | — | Warning |
| H4 | OS version changed | Event | A server reports a different operating system version or kernel from before | — | Info |
| H5 | Docker version changed | Event | A server reports a different Docker version from before | — | Info |
| H6 | New server | Event | Neon hears from a server for the first time, e.g. "New server detected: server4 (12 containers)" | — | Info |

### R: Server resources

| ID | Alert | Kind | Fires when | Resolves when | Severity |
|---|---|---|---|---|---|
| R1 | Disk nearly full | Condition | Disk usage goes above a threshold | Disk usage falls back below it | Warning |
| R2 | Memory high | Condition | Memory usage stays above a threshold | Memory usage falls back below it | Warning |
| R3 | CPU high | Condition | CPU usage stays above a threshold | CPU usage falls back below it | Warning |

### S: Security

| ID | Alert | Kind | Fires when | Resolves when | Severity |
|---|---|---|---|---|---|
| S1 | Security issues found | Condition | A scan of an image finds at least one fixable issue | A later scan of that image finds no fixable issues | Warning |
| S2 | Security issues changed | Event | A scan of an image whose S1 is open finds a different set of fixable issues: some new, some fixed, or both | — | Info |

### Notes

- **C1 and manual stops.** Stopping a container on purpose raises C1. This is
  deliberate, and stopping a container is the main way to check that alerting
  works.
- **Deploys.** There is no grace period: C1 opens on every stop, including
  the old container being stopped during a deploy. A deploy that changes the
  version therefore sends, in order: C1 Container down, C1 resolved when the
  new container is running, and C7 Service version changed (e.g. "atlas
  0.17.6 → 0.17.7").
- **First sighting.** The first time Neon hears from a server (typically when
  the agent is installed on a new server), it sends H6 and records the
  server's OS version, Docker version, containers and service versions
  without sending H4, H5, C6 or C7. Agent restarts, server reboots, Neon
  restarts and reconnections are not first sightings.
- **Crash loops (C1 and C2).** While C2 is open for a service, C1 is not
  raised for it. Before the loop is detected, each crash raises C1 and each
  restart resolves it. Once C2 opens, further crashes send nothing. C2
  resolves when the service has stayed up for the crash-loop window. If the
  service stays down while C2 is open, C2 stays open.
- **Security (S1 and S2).** These come from Trivy scan data, produced by the
  "Vulnerability scanning" milestone.
  - **Only fixable issues count**, whatever their severity. An issue is
    fixable when Trivy reports a version that fixes it. Issues with no fix
    never raise or change an alert.
  - **The subject is the image on a server.** Images are matched by name,
    not tag, so a deploy's new version is compared with the old one.
  - **One S1 per image covers all its fixable issues**, e.g. "atlas: 4
    fixable security issues (1 high, 3 medium)". The first scan of an image
    raises S1 if it finds any.
  - **Each scan of an image sends at most one notification:**

    | Scan result | Notification |
    |---|---|
    | Fixable issues found, no S1 open for the image | S1 opens |
    | S1 open, set of fixable issues changed | S2, e.g. "atlas: 2 new, 3 fixed, 5 remaining" |
    | S1 open, nothing changed | None |
    | S1 open, no fixable issues left | S1 resolved |

  - **S1 is always Warning**, whatever the severity of the findings; the
    message gives the counts by severity. Critical is kept for things that
    are down; a vulnerability needs fixing soon, not within minutes.

---

## 7. Settings

Alert rules use settings stored in Neon's database and changed from within
the app. Defaults apply until they are changed.

### 7.1 Alert rules (Settings page)

These apply to every server.

| Setting | Default | Used by |
|---|---|---|
| Crash loop: number of crashes | 3 | C2 |
| Crash loop: time window | 5 minutes | C2 opens when the service crashes this many times within the window, and resolves when it has stayed up for the window |
| Missed heartbeats before a server is offline | 5 | H1 |
| How long memory or CPU must stay high | 10 minutes | R2, R3 |

### 7.2 Alert thresholds (server details page)

Each server has its own thresholds. Leaving one blank turns that alert off
for that server.

| Threshold | Default | Used by |
|---|---|---|
| Disk usage | 90% | R1 |
| Memory usage | 90% | R2 |
| CPU usage | 90% | R3 |

### 7.3 How the settings are applied

- **H1.** The heartbeat interval is set on each agent (`HEARTBEAT_INTERVAL`,
  default 60 seconds), and the agent sends it to Neon when it registers. H1
  opens when no heartbeat has arrived for the number of missed heartbeats
  times that server's interval (5 minutes at the defaults), and resolves when
  a heartbeat arrives.
  - Neon records the time each heartbeat arrives.
  - Because H1 opens when something does *not* happen, the scheduled check
    (section 5) looks at every server every 30 seconds.
  - Missed heartbeats are counted from whichever is later: the last heartbeat
    or the time Neon started. Neon only counts heartbeats it missed while it
    was running to receive them, so a restart of Neon itself does not raise
    H1 for every server.
  - The first build must confirm the check runs in Neon's production image
    (standalone output, `node server.js`). The Next.js documentation does not
    say.
- **R1.** Opens on the first reading above the disk threshold and resolves on
  the first reading below it. Disk usage changes slowly, and a filling disk
  should not wait.
- **R2 and R3.** Open when every reading has been above the threshold for the
  set time, and resolve when every reading has been below it for the same
  time. Waiting in both directions stops a value hovering around the
  threshold from sending repeated alerts.

---

## 8. Testing

Every alert ID has tests, and every test names the alert ID and the rule it
checks. An alert is not done until all three layers pass.

### 8.1 Server rules (automated)

The server's alert rules are tested on their own, without Docker or a
network: given what Neon knew before and a new fact, check which alerts open,
resolve or stay quiet. Every row of the catalogue and every rule in section 5
(no repeat while open, one open alert per subject, resolved notification,
subjects that are recreated) has at least one test.

### 8.2 Agent reporting (automated, against real Docker)

A test script drives a real Docker daemon and checks what the agent reports:

- stopping, killing and removing a container
- a container that crashes, and one that keeps crashing under a restart
  policy
- a health check that fails, then passes
- pausing and unpausing
- a burst of containers starting at once
- the agent losing and regaining its connection to Docker

Where tests need Docker's event sequences as input, they use sequences
recorded from a real Docker daemon, with the Docker version noted. They are
never written by hand.

### 8.3 End to end (manual)

Each alert ID has a short manual check that ends with the notification on
the phone at the right priority, and its resolved notification for
conditions. The first one is: stop a container, receive C1; start it again,
receive C1 resolved.

---

## 9. Open questions

Questions that must be decided, and this document updated, before the
related alerts are built.

None at present.
