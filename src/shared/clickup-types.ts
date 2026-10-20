export type ClickUpWorkspace = { id: string; name: string; memberCount: number }

export type ClickUpSpace = { id: string; name: string }

export type ClickUpList = {
  id: string
  name: string
  folderId: string | null
  folderName: string | null
}

export type ClickUpTask = {
  id: string
  customId: string | null
  name: string
  status: string | null
  /** ClickUp priority name: urgent, high, normal or low. */
  priority: string | null
  url: string | null
  assignees: string[]
  dueDate: string | null
  updatedAt: string | null
  listId: string | null
  listName: string | null
  /** Markdown description; only filled by single-task reads. */
  description?: string | null
}

export type ClickUpComment = {
  id: string
  author: string | null
  text: string
  createdAt: string | null
}

export const CLICKUP_PRIORITY_NAMES = ['urgent', 'high', 'normal', 'low'] as const
export type ClickUpPriorityName = (typeof CLICKUP_PRIORITY_NAMES)[number]
