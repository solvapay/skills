import { z } from 'zod'
import type { AdditionalToolsContext } from '@solvapay/mcp'

export function registerManagePet(ctx: AdditionalToolsContext): void {
  ctx.registerPayable('manage_pet', {
    title: 'Manage Pet',
    description:
      'Create, update, or delete a pet in the store. Use action="create" to add a new pet, action="update" to modify an existing pet, or action="delete" to remove a pet by ID.',
    schema: {
      action: z
        .enum(['create', 'update', 'delete'])
        .describe('The operation to perform on the pet.'),
      id: z
        .string()
        .optional()
        .describe('Pet ID. Required for action="update" and action="delete".'),
      name: z
        .string()
        .optional()
        .describe('Pet name. Required for action="create"; optional for action="update".'),
      status: z
        .enum(['available', 'pending', 'sold'])
        .optional()
        .describe('Pet status. Used for action="create" or action="update".'),
      category: z
        .string()
        .optional()
        .describe('Pet category name. Used for action="create" or action="update".'),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: true,
    },
    handler: async ({ action, id, name, status, category }, c) => {
      const BASE = 'https://petstore.swagger.io/v2'

      switch (action) {
        case 'create': {
          if (!name) throw new Error('`name` is required when action="create"')
          const body = {
            name,
            status: status ?? 'available',
            ...(category ? { category: { name: category } } : {}),
          }
          const res = await fetch(`${BASE}/pet`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          })
          if (!res.ok) throw new Error(`Petstore API error: ${res.status}`)
          const data = await res.json() as Record<string, unknown>
          return c.respond(data, { text: `Pet "${name}" created with ID ${data['id']}.` })
        }
        case 'update': {
          if (!id) throw new Error('`id` is required when action="update"')
          const body: Record<string, unknown> = { id }
          if (name) body['name'] = name
          if (status) body['status'] = status
          if (category) body['category'] = { name: category }
          const res = await fetch(`${BASE}/pet`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          })
          if (!res.ok) throw new Error(`Petstore API error: ${res.status}`)
          const data = await res.json() as Record<string, unknown>
          return c.respond(data, { text: `Pet ${id} updated successfully.` })
        }
        case 'delete': {
          if (!id) throw new Error('`id` is required when action="delete"')
          const res = await fetch(`${BASE}/pet/${encodeURIComponent(id)}`, {
            method: 'DELETE',
          })
          if (!res.ok) throw new Error(`Petstore API error: ${res.status}`)
          return c.respond({ id, deleted: true }, { text: `Pet ${id} deleted successfully.` })
        }
      }
    },
  })
}
