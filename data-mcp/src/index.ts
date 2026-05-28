/**
 * data-mcp: A paid MCP server scaffolded from OpenAPI on Cloudflare Workers
 * Integrates SolvaPay for monetization
 */

export interface Env {
  SOLVAPAY_API_KEY: string;
}

// MCP protocol types
interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string };
}

// Tool definitions (generated from OpenAPI)
const TOOLS = [
  {
    name: "getData",
    description: "Fetch data from the API",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Resource ID" },
      },
      required: ["id"],
    },
  },
];

// SolvaPay: check if user has paid access
async function checkSolvaPayAccess(
  apiKey: string,
  userId: string
): Promise<boolean> {
  // TODO: implement SolvaPay access check
  // const res = await fetch("https://api.solvapay.com/v1/access", {
  //   headers: { Authorization: `Bearer ${apiKey}` },
  //   body: JSON.stringify({ userId }),
  // });
  // return res.ok;
  return true; // placeholder
}

// Handle MCP tool calls
async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  env: Env
): Promise<unknown> {
  switch (name) {
    case "getData": {
      const id = args.id as string;
      // TODO: replace with actual API call from OpenAPI spec
      return { id, data: "placeholder response" };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Main MCP request handler
async function handleMCPRequest(
  request: MCPRequest,
  env: Env
): Promise<MCPResponse> {
  const { id, method, params } = request;

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "data-mcp", version: "1.0.0" },
        },
      };

    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: TOOLS } };

    case "tools/call": {
      const { name, arguments: args } = params as {
        name: string;
        arguments: Record<string, unknown>;
      };

      // SolvaPay access gate
      const userId = (params as Record<string, unknown>)
        .userId as string ?? "anonymous";
      const hasAccess = await checkSolvaPayAccess(env.SOLVAPAY_API_KEY, userId);
      if (!hasAccess) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: 402, message: "Payment required — subscribe via SolvaPay" },
        };
      }

      const result = await handleToolCall(name, args, env);
      return {
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text: JSON.stringify(result) }] },
      };
    }

    default:
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const body = (await request.json()) as MCPRequest;
      const response = await handleMCPRequest(body, env);
      return new Response(JSON.stringify(response), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  },
};
