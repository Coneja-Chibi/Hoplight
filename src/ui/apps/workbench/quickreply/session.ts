/** Pure editing operations for one quick-reply set. */
import type { QuickReply, QuickReplyBody } from "../../../../entities/quickreply/schema";
import { newUiId } from "../../../_shared/new-id";
import { deepEq } from "../editor-core";

export const addReply = (body: QuickReplyBody): QuickReplyBody => ({
  ...body,
  replies: [...body.replies, {
    id: newUiId("reply_"),
    label: "",
    message: "",
  }],
});

export const patchReply = (
  body: QuickReplyBody,
  id: string,
  patch: Partial<Pick<QuickReply, "label" | "message" | "title" | "hidden">>,
): QuickReplyBody => ({
  ...body,
  replies: body.replies.map((reply) => reply.id === id ? { ...reply, ...patch } : reply),
});

export const removeReply = (body: QuickReplyBody, id: string): QuickReplyBody => ({
  ...body,
  replies: body.replies.filter((reply) => reply.id !== id),
});

export const quickReplyDirty = (body: QuickReplyBody, baseline: QuickReplyBody): boolean =>
  !deepEq(body, baseline);
