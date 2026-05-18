// Shared between POST/GET/PATCH/Reply comment routes and the admin moderation
// endpoint. Single source of truth for which User fields are exposed alongside
// a comment and how `avatarKey` is rewritten to a stable `/api/avatar/` URL.

export const commentUserSelect = {
  id: true,
  username: true,
  avatarKey: true,
} as const;

export interface CommentUserRow {
  id: string;
  username: string;
  avatarKey: string | null;
}

export interface SerializedCommentUser {
  id: string;
  username: string;
  avatarUrl: string | null;
}

export function serializeCommentUser(u: CommentUserRow): SerializedCommentUser {
  return {
    id: u.id,
    username: u.username,
    avatarUrl: u.avatarKey ? `/api/avatar/${u.avatarKey}` : null,
  };
}
