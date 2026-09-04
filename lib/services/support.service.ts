// KROWN POS — Support Service
// Conversations, messages, AI chatbot, agent workload

import { getSql, queryWithRetry } from '@/lib/neon-server';
import { TenantContext, setTenantContext } from '@/lib/tenant';
import { generateId } from '@/lib/id';
import { logAudit } from '@/lib/audit';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SupportConversation {
  id: string;
  organization_id: string;
  customer_staff_id: string;
  assigned_agent_id?: string;
  category: 'general' | 'technical' | 'billing' | 'security' | 'feature_request' | 'bug_report';
  status: 'open' | 'waiting_for_support' | 'waiting_for_customer' | 'in_progress' | 'resolved' | 'closed';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  subject: string;
  device_id?: string;
  app_version?: string;
  context: any;
  resolved_at?: string;
  closed_at?: string;
  first_response_at?: string;
  last_customer_message_at?: string;
  last_agent_message_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_type: 'customer' | 'agent' | 'system' | 'ai';
  content: string;
  message_type: 'text' | 'image' | 'file' | 'system' | 'note';
  is_internal_note: boolean;
  metadata: any;
  created_at: string;
}

export interface AIResponse {
  answer: string;
  escalate: boolean;
  confidence: number;
}

// ── Knowledge Base ─────────────────────────────────────────────────────────

const KNOWLEDGE_BASE: Array<{ patterns: string[]; answer: string }> = [
  {
    patterns: ['add staff', 'add employee', 'new staff', 'new employee', 'hire', 'onboard staff'],
    answer: 'To add staff, go to Staff Management → Add Staff. Fill in their details and assign a role.',
  },
  {
    patterns: ['register device', 'add device', 'new device', 'enroll device', 'setup device'],
    answer: 'Go to Settings → Devices → Add Device. A QR code will be generated for the new device to scan.',
  },
  {
    patterns: ['reset pin', 'forgot pin', 'pin reset', 'change pin'],
    answer: 'Super Admin can reset PINs from Staff Management → Select Staff → Reset PIN.',
  },
  {
    patterns: ['printer', 'configure printer', 'setup printer', 'add printer', 'print settings'],
    answer: 'Go to Settings → Printers. Add your printer and assign it to a branch.',
  },
  {
    patterns: ['view report', 'reports', 'analytics', 'sales report', 'daily report', 'view sales'],
    answer: 'Go to Reports in the Manager dashboard. You can filter by date, branch, and category.',
  },
  {
    patterns: ['manage table', 'tables', 'table layout', 'zone', 'add table', 'edit table'],
    answer: 'Go to Zones → Tables. You can add, edit, and assign tables to zones.',
  },
  {
    patterns: ['inventory', 'ingredient', 'stock', 'deduct inventory', 'add ingredient'],
    answer: 'Go to Inventory → Ingredients. Add ingredients and link them to menu items for automatic deduction.',
  },
  {
    patterns: ['contact support', 'human support', 'talk to agent', 'customer support', 'help'],
    answer: 'You can contact human support from the Support Center. Click "Contact Human" to start a conversation.',
  },
];

function matchKnowledgeBase(question: string): AIResponse {
  const lower = question.toLowerCase();

  for (const entry of KNOWLEDGE_BASE) {
    for (const pattern of entry.patterns) {
      if (lower.includes(pattern)) {
        return { answer: entry.answer, escalate: false, confidence: 0.9 };
      }
    }
  }

  return {
    answer: "I don't have enough information to safely answer that. Would you like to contact Krown Support?",
    escalate: true,
    confidence: 0,
  };
}

// ── Service Methods ────────────────────────────────────────────────────────

export async function createConversation(
  ctx: TenantContext,
  input: {
    customer_staff_id: string;
    category?: SupportConversation['category'];
    priority?: SupportConversation['priority'];
    subject: string;
    device_id?: string;
    app_version?: string;
    context?: any;
  }
): Promise<SupportConversation> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const id = generateId();

  await sql`
    INSERT INTO support_conversations (id, organization_id, customer_staff_id, category, priority, subject, device_id, app_version, context)
    VALUES (${id}, ${ctx.organizationId}, ${input.customer_staff_id}, ${input.category || 'general'}, ${input.priority || 'normal'}, ${input.subject}, ${input.device_id || null}, ${input.app_version || null}, ${JSON.stringify(input.context || {})})
  `;

  await logAudit(ctx.userId, 'support.conversation_create', { conversationId: id, subject: input.subject }, ctx.organizationId, ctx.branchId);

  const rows = await sql`SELECT * FROM support_conversations WHERE id = ${id} AND organization_id = ${ctx.organizationId}`;
  return rows[0] as SupportConversation;
}

export async function listConversations(
  ctx: TenantContext,
  filters?: {
    status?: string;
    agent_id?: string;
    priority?: string;
    limit?: number;
    offset?: number;
  }
): Promise<SupportConversation[]> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;

  let rows;
  if (filters?.status && filters?.agent_id) {
    rows = await sql`SELECT * FROM support_conversations WHERE organization_id = ${ctx.organizationId} AND status = ${filters.status} AND assigned_agent_id = ${filters.agent_id} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  } else if (filters?.status) {
    rows = await sql`SELECT * FROM support_conversations WHERE organization_id = ${ctx.organizationId} AND status = ${filters.status} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  } else if (filters?.agent_id) {
    rows = await sql`SELECT * FROM support_conversations WHERE organization_id = ${ctx.organizationId} AND assigned_agent_id = ${filters.agent_id} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  } else if (filters?.priority) {
    rows = await sql`SELECT * FROM support_conversations WHERE organization_id = ${ctx.organizationId} AND priority = ${filters.priority} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  } else {
    rows = await sql`SELECT * FROM support_conversations WHERE organization_id = ${ctx.organizationId} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  }

  return rows as SupportConversation[];
}

export async function getConversation(
  ctx: TenantContext,
  conversationId: string
): Promise<{ conversation: SupportConversation; messages: SupportMessage[] } | null> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const convRows = await sql`SELECT * FROM support_conversations WHERE id = ${conversationId} AND organization_id = ${ctx.organizationId}`;
  if (convRows.length === 0) return null;

  const messages = await sql`SELECT * FROM support_messages WHERE conversation_id = ${conversationId} ORDER BY created_at ASC`;

  return {
    conversation: convRows[0] as SupportConversation,
    messages: messages as SupportMessage[],
  };
}

export async function assignAgent(
  ctx: TenantContext,
  conversationId: string,
  agentId: string
): Promise<SupportConversation> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await sql`SELECT * FROM support_conversations WHERE id = ${conversationId} AND organization_id = ${ctx.organizationId}`;
  if (existing.length === 0) throw new Error('Conversation not found');

  await sql`
    UPDATE support_conversations SET assigned_agent_id = ${agentId}, status = 'in_progress', updated_at = NOW()
    WHERE id = ${conversationId} AND organization_id = ${ctx.organizationId}
  `;

  // Send system message
  const msgId = generateId();
  await sql`
    INSERT INTO support_messages (id, conversation_id, sender_id, sender_type, content, message_type, organization_id, branch_id)
    VALUES (${msgId}, ${conversationId}, ${ctx.userId}, 'system', ${`Conversation assigned to agent ${agentId}`}, 'system', ${ctx.organizationId}, ${ctx.branchId})
  `;

  await logAudit(ctx.userId, 'support.conversation_assign', { conversationId, agentId }, ctx.organizationId, ctx.branchId);

  const rows = await sql`SELECT * FROM support_conversations WHERE id = ${conversationId} AND organization_id = ${ctx.organizationId}`;
  return rows[0] as SupportConversation;
}

export async function updateStatus(
  ctx: TenantContext,
  conversationId: string,
  status: SupportConversation['status']
): Promise<SupportConversation> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await sql`SELECT * FROM support_conversations WHERE id = ${conversationId} AND organization_id = ${ctx.organizationId}`;
  if (existing.length === 0) throw new Error('Conversation not found');

  await sql`
    UPDATE support_conversations SET status = ${status}, updated_at = NOW() WHERE id = ${conversationId} AND organization_id = ${ctx.organizationId}
  `;

  await logAudit(ctx.userId, 'support.conversation_status', { conversationId, status }, ctx.organizationId, ctx.branchId);

  const rows = await sql`SELECT * FROM support_conversations WHERE id = ${conversationId} AND organization_id = ${ctx.organizationId}`;
  return rows[0] as SupportConversation;
}

export async function resolveConversation(
  ctx: TenantContext,
  conversationId: string
): Promise<SupportConversation> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await sql`SELECT * FROM support_conversations WHERE id = ${conversationId} AND organization_id = ${ctx.organizationId}`;
  if (existing.length === 0) throw new Error('Conversation not found');

  await sql`
    UPDATE support_conversations SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
    WHERE id = ${conversationId} AND organization_id = ${ctx.organizationId}
  `;

  await logAudit(ctx.userId, 'support.conversation_resolve', { conversationId }, ctx.organizationId, ctx.branchId);

  const rows = await sql`SELECT * FROM support_conversations WHERE id = ${conversationId} AND organization_id = ${ctx.organizationId}`;
  return rows[0] as SupportConversation;
}

export async function closeConversation(
  ctx: TenantContext,
  conversationId: string
): Promise<SupportConversation> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await sql`SELECT * FROM support_conversations WHERE id = ${conversationId} AND organization_id = ${ctx.organizationId}`;
  if (existing.length === 0) throw new Error('Conversation not found');

  await sql`
    UPDATE support_conversations SET status = 'closed', closed_at = NOW(), updated_at = NOW()
    WHERE id = ${conversationId} AND organization_id = ${ctx.organizationId}
  `;

  await logAudit(ctx.userId, 'support.conversation_close', { conversationId }, ctx.organizationId, ctx.branchId);

  const rows = await sql`SELECT * FROM support_conversations WHERE id = ${conversationId} AND organization_id = ${ctx.organizationId}`;
  return rows[0] as SupportConversation;
}

export async function reopenConversation(
  ctx: TenantContext,
  conversationId: string
): Promise<SupportConversation> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await sql`SELECT * FROM support_conversations WHERE id = ${conversationId} AND organization_id = ${ctx.organizationId}`;
  if (existing.length === 0) throw new Error('Conversation not found');

  await sql`
    UPDATE support_conversations SET status = 'open', resolved_at = NULL, closed_at = NULL, updated_at = NOW()
    WHERE id = ${conversationId} AND organization_id = ${ctx.organizationId}
  `;

  await logAudit(ctx.userId, 'support.conversation_reopen', { conversationId }, ctx.organizationId, ctx.branchId);

  const rows = await sql`SELECT * FROM support_conversations WHERE id = ${conversationId} AND organization_id = ${ctx.organizationId}`;
  return rows[0] as SupportConversation;
}

// ── Messages ───────────────────────────────────────────────────────────────

export async function sendMessage(
  ctx: TenantContext,
  conversationId: string,
  content: string,
  senderType: SupportMessage['sender_type'],
  messageType?: SupportMessage['message_type'],
  isInternal?: boolean
): Promise<SupportMessage> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await sql`SELECT * FROM support_conversations WHERE id = ${conversationId} AND organization_id = ${ctx.organizationId}`;
  if (existing.length === 0) throw new Error('Conversation not found');

  const id = generateId();
  const isAgent = senderType === 'agent' || senderType === 'ai';

  await sql`
    INSERT INTO support_messages (id, conversation_id, sender_id, sender_type, content, message_type, is_internal_note, organization_id, branch_id)
    VALUES (${id}, ${conversationId}, ${ctx.userId}, ${senderType}, ${content}, ${messageType || 'text'}, ${isInternal || false}, ${ctx.organizationId}, ${ctx.branchId})
  `;

  // Update conversation timestamps
  if (isAgent) {
    await sql`
      UPDATE support_conversations
      SET last_agent_message_at = NOW(), updated_at = NOW(),
          first_response_at = COALESCE(first_response_at, NOW())
      WHERE id = ${conversationId} AND organization_id = ${ctx.organizationId}
    `;
  } else {
    await sql`
      UPDATE support_conversations
      SET last_customer_message_at = NOW(), updated_at = NOW(), status = 'waiting_for_support'
      WHERE id = ${conversationId} AND organization_id = ${ctx.organizationId} AND status IN ('open', 'waiting_for_customer')
    `;
  }

  const rows = await sql`SELECT * FROM support_messages WHERE id = ${id}`;
  return rows[0] as SupportMessage;
}

export async function getMessages(
  ctx: TenantContext,
  conversationId: string,
  limit?: number,
  offset?: number
): Promise<SupportMessage[]> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const lim = limit || 50;
  const off = offset || 0;

  const rows = await sql`
    SELECT * FROM support_messages WHERE conversation_id = ${conversationId}
    ORDER BY created_at ASC LIMIT ${lim} OFFSET ${off}
  `;
  return rows as SupportMessage[];
}

// ── Stats & Workload ───────────────────────────────────────────────────────

export async function getConversationStats(ctx: TenantContext): Promise<{
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
  total: number;
}> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const statusRows = await sql`SELECT status, COUNT(*)::int as count FROM support_conversations WHERE organization_id = ${ctx.organizationId} GROUP BY status`;
  const categoryRows = await sql`SELECT category, COUNT(*)::int as count FROM support_conversations WHERE organization_id = ${ctx.organizationId} GROUP BY category`;
  const priorityRows = await sql`SELECT priority, COUNT(*)::int as count FROM support_conversations WHERE organization_id = ${ctx.organizationId} GROUP BY priority`;
  const totalRows = await sql`SELECT COUNT(*)::int as count FROM support_conversations WHERE organization_id = ${ctx.organizationId}`;

  const byStatus: Record<string, number> = {};
  for (const row of statusRows as any[]) byStatus[row.status] = row.count;

  const byCategory: Record<string, number> = {};
  for (const row of categoryRows as any[]) byCategory[row.category] = row.count;

  const byPriority: Record<string, number> = {};
  for (const row of priorityRows as any[]) byPriority[row.priority] = row.count;

  return { byStatus, byCategory, byPriority, total: (totalRows[0] as any).count };
}

export async function getAgentWorkload(
  ctx: TenantContext
): Promise<Array<{ agent_id: string; agent_name: string; open_count: number; in_progress_count: number }>> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const rows = await sql`
    SELECT
      sc.assigned_agent_id as agent_id,
      s.name as agent_name,
      COUNT(*) FILTER (WHERE sc.status = 'open')::int as open_count,
      COUNT(*) FILTER (WHERE sc.status = 'in_progress')::int as in_progress_count
    FROM support_conversations sc
    JOIN staff s ON sc.assigned_agent_id = s.id
    WHERE sc.organization_id = ${ctx.organizationId}
      AND sc.assigned_agent_id IS NOT NULL
      AND sc.status IN ('open', 'waiting_for_support', 'in_progress')
    GROUP BY sc.assigned_agent_id, s.name
    ORDER BY (COUNT(*) FILTER (WHERE sc.status = 'open') + COUNT(*) FILTER (WHERE sc.status = 'in_progress')) DESC
  `;

  return rows as Array<{ agent_id: string; agent_name: string; open_count: number; in_progress_count: number }>;
}

export async function searchConversations(
  ctx: TenantContext,
  query: string
): Promise<SupportConversation[]> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const searchTerm = `%${query}%`;

  const rows = await sql`
    SELECT * FROM support_conversations
    WHERE organization_id = ${ctx.organizationId}
      AND (subject ILIKE ${searchTerm} OR id::text ILIKE ${searchTerm})
    ORDER BY created_at DESC
    LIMIT 20
  `;

  return rows as SupportConversation[];
}

// ── AI Chatbot ─────────────────────────────────────────────────────────────

export async function getAIResponse(question: string): Promise<AIResponse> {
  return matchKnowledgeBase(question);
}
