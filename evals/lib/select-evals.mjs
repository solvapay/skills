/**
 * Eval runner contract helpers. The executor lives outside this repo;
 * import these so a missing `requires` env var skips rather than fails.
 */

/**
 * @param {{ requires?: string[] }} evalCase
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function evalIsRunnable(evalCase, env = process.env) {
  const requires = evalCase.requires ?? []
  return requires.every(key => Boolean(env[key]))
}

/**
 * @param {string} template
 * @param {Record<string, string>} values
 */
function interpolate(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in values)) {
      throw new Error(`Unknown eval param placeholder {{${key}}}`)
    }
    return values[key]
  })
}

/**
 * @param {Record<string, unknown>} value
 * @param {Record<string, string>} values
 * @returns {unknown}
 */
function interpolateDeep(value, values) {
  if (typeof value === 'string') return interpolate(value, values)
  if (Array.isArray(value)) return value.map(item => interpolateDeep(item, values))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, interpolateDeep(item, values)]),
    )
  }
  return value
}

/**
 * Expand a parametrized eval into one concrete case per `params` row.
 * @param {object} evalCase
 * @returns {object[]}
 */
export function expandEvalParams(evalCase) {
  const params = evalCase.params
  if (!Array.isArray(params) || params.length === 0) return [evalCase]
  return params.map(param => {
    const values = Object.fromEntries(
      Object.entries(param).map(([key, value]) => [key, String(value)]),
    )
    const { params: _params, ...rest } = evalCase
    return {
      ...interpolateDeep(rest, values),
      param,
    }
  })
}

/**
 * @param {object[]} evals
 * @param {NodeJS.ProcessEnv} [env]
 */
export function selectEvals(evals, env = process.env) {
  return evals.flatMap(expandEvalParams).filter(evalCase => evalIsRunnable(evalCase, env))
}
