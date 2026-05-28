import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const skillsRoot = path.join(__dirname, '..', 'skills')
const xmlPattern = /<[^>]+>/
const frontmatterFields = ['name', 'description', 'compatibility']
const claudeAiDescriptionLimit = 200

function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/)
  if (!match) {
    throw new Error('missing frontmatter')
  }

  const fields = {}
  let current = null
  let buffer = []

  for (const line of match[1].split('\n')) {
    if (/^[a-zA-Z0-9_-]+:/.test(line)) {
      if (current !== null) {
        fields[current] = buffer.join('\n').trim()
      }

      const colonIndex = line.indexOf(':')
      current = line.slice(0, colonIndex).trim()
      const value = line.slice(colonIndex + 1).trim()

      if (value === '>' || value === '|') {
        buffer = []
      } else if (value) {
        fields[current] = value
        current = null
        buffer = []
      } else {
        buffer = []
      }
      continue
    }

    if (current !== null && line.startsWith('  ')) {
      buffer.push(line.slice(2))
    }
  }

  if (current !== null) {
    fields[current] = buffer.join('\n').trim()
  }

  return fields
}

const skillDirs = (await readdir(skillsRoot, { withFileTypes: true }))
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort()

let hasErrors = false

for (const skillName of skillDirs) {
  const skillPath = path.join(skillsRoot, skillName, 'SKILL.md')
  const text = await readFile(skillPath, 'utf8')
  const fields = parseFrontmatter(text)

  for (const field of frontmatterFields) {
    const value = fields[field]
    if (!value) {
      continue
    }

    const tags = value.match(xmlPattern)
    if (tags) {
      hasErrors = true
      console.error(`${skillPath}: ${field} contains XML-like tags: ${tags.join(', ')}`)
    }
  }

  const description = fields.description ?? ''
  if (description.length > claudeAiDescriptionLimit) {
    console.warn(
      `${skillPath}: description is ${description.length} chars (claude.ai limit is ${claudeAiDescriptionLimit})`,
    )
  }
}

if (hasErrors) {
  process.exit(1)
}

console.log(`Frontmatter OK for ${skillDirs.length} skills`)
