# CMMS Collaboration, Notifications and SLA

Backend-only contract for Mobile/Web integration.

## Comments and activity
- `rpc_cmms_add_comment(entityType, entityId, body, mentionPersonIds, parentCommentId)`
- Supported entities: `WORK_ORDER`, `REQUEST`, `ASSET`, `PM`, `PURCHASE_ORDER`
- Mentions automatically create notifications and watcher entries.
- `cmms_activity_event` provides a unified history feed independent from legacy audit logs.

## Watchers
- `rpc_cmms_watch_entity(entityType, entityId, personId, watch, reason)`
- Reasons: `MANUAL`, `ASSIGNEE`, `CREATOR`, `MENTION`, `APPROVER`, `TEAM`
- Watchers receive future comment notifications.

## Notification inbox
- `rpc_cmms_notification_inbox(unreadOnly, limit, offset)`
- `rpc_cmms_mark_notification_read(notificationId)`
- Types: `COMMENT`, `MENTION`, `ASSIGNMENT`, `STATUS_CHANGE`, `SLA_WARNING`, `SLA_BREACH`, `ESCALATION`, `SYSTEM`
- Priority: `LOW`, `NORMAL`, `HIGH`, `URGENT`

## SLA
`cmms_sla_policy` supports different policies for Work Orders and Requests with optional priority-specific rules.

Fields include:
- response target in minutes
- resolution target in minutes
- warning threshold percentage
- escalation person
- escalation team

`rpc_cmms_start_sla(entityType, entityId, priority)` selects the most specific active policy and creates an SLA instance.

`rpc_cmms_run_sla_escalation(now)` scans active instances and:
- marks warning when the configured percentage of resolution time is reached
- sends SLA warning notifications
- marks breach when resolution due time is exceeded
- notifies escalation person/team
- writes activity events

The RPC is intended for a scheduled server/cron caller later. It is not tied to Mobile UI.

## UI ownership boundary
This backend lane does not modify Mobile navigation, Scan, Home, Requests, Work Orders, More, or picker UI.
