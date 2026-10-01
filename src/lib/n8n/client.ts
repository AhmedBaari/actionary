/**
 * SastraNet n8n Outbox Dispatcher
 * Asynchronous, non-blocking webhook dispatcher for n8n workflows with retry logic.
 */

export type N8nEventType =
  | "sprint.rollover_warning"
  | "sprint.ended"
  | "task.overdue"
  | "task.pivoted"
  | "feedback.cycle_started"
  | "feedback.reminder"
  | "feedback.completed"
  | "feedback.finalized";

export async function dispatchN8nEvent(
  eventType: N8nEventType,
  payload: Record<string, unknown>
): Promise<{ dispatched: boolean; status?: number }> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;

  if (!webhookUrl) {
    // If not configured, silently succeed without blocking user flows
    return { dispatched: false };
  }

  const body = JSON.stringify({
    event: eventType,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (webhookSecret) {
      headers["X-SastraNet-Signature"] = webhookSecret;
    }

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(5000), // 5s timeout, non-blocking
    });

    return { dispatched: res.ok, status: res.status };
  } catch (error) {
    console.warn(`[n8n] Failed to dispatch event ${eventType}:`, error);
    return { dispatched: false };
  }
}

