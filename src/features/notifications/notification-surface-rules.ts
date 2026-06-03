import {
  demoNotificationRecipientContext,
  resolveNotificationRecipientRule,
  type GlobalNotification,
  type NotificationRecipientContext,
} from "@/features/notifications/mock-notifications";

export type NotificationSourceContext = {
  domain?: GlobalNotification["domain"];
  sourceKind?: GlobalNotification["source"]["kind"];
  entityId?: string;
};

export type NotificationSurfaceContext = NotificationRecipientContext & {
  sourceContext?: NotificationSourceContext;
};

export type NotificationSurfaceVisibility = {
  drawer: true;
  toast: boolean;
  inlineAlert: boolean;
  reason: string;
};

function isCurrentNotification(notification: GlobalNotification) {
  return notification.unread && !notification.archived;
}

function matchesSourceContext(notification: GlobalNotification, sourceContext?: NotificationSourceContext) {
  if (!sourceContext) return false;

  if (sourceContext.entityId && notification.source.entity_id === sourceContext.entityId) {
    return true;
  }

  if (sourceContext.sourceKind && notification.source.kind === sourceContext.sourceKind) {
    return true;
  }

  return Boolean(sourceContext.domain && notification.domain === sourceContext.domain);
}

function matchesRecipientContext(notification: GlobalNotification, context: NotificationSurfaceContext) {
  if (notification.recipient.kind === "user") {
    return Boolean(context.userId && notification.recipient.id === context.userId);
  }

  if (notification.recipient.kind === "active_role") {
    return context.activeRoleIds.includes(notification.recipient.id);
  }

  return context.includeRoleQueue !== false && context.activeRoleIds.includes(notification.recipient.id);
}

export function resolveNotificationSurfaceVisibility(
  notification: GlobalNotification,
  context: NotificationSurfaceContext = demoNotificationRecipientContext
): NotificationSurfaceVisibility {
  const recipientRule = resolveNotificationRecipientRule(notification, context);

  if (!isCurrentNotification(notification)) {
    return {
      drawer: true,
      toast: false,
      inlineAlert: false,
      reason: "historical notification remains available in drawer/archive only",
    };
  }

  if (notification.toast_policy === "drawer_only") {
    return {
      drawer: true,
      toast: false,
      inlineAlert: false,
      reason: "drawer-only policy suppresses transient surfaces",
    };
  }

  if (notification.toast_policy === "inline_first") {
    return {
      drawer: true,
      toast: false,
      inlineAlert:
        recipientRule.recipientMatched &&
        (notification.source.kind === "fallback_detail" ||
          matchesSourceContext(notification, context.sourceContext)),
      reason: "inline-first policy prefers source workflow recovery over toast",
    };
  }

  if (notification.toast_policy === "source_context_only") {
    return {
      drawer: true,
      toast: matchesRecipientContext(notification, context) && matchesSourceContext(notification, context.sourceContext),
      inlineAlert: false,
      reason: "source-context policy requires the user to already be near the source workflow",
    };
  }

  return {
    drawer: true,
    toast: recipientRule.recipientMatched,
    inlineAlert: false,
    reason: `${notification.toast_policy} policy can toast for the matched current recipient`,
  };
}
