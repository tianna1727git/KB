import {mcp} from '../lib/studio/mcp.mjs';
import {api} from '../lib/studio/api';
import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

const worker = {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    if(new URL(request.url).pathname==='/mcp')return mcp(request,env,api);
    if(new URL(request.url).pathname.startsWith('/api/studio/')){
      // Synthetic identity for the isolated local preview only. Vite removes this branch from production.
      if(import.meta.env.DEV){const headers=new Headers(request.headers);headers.set('oai-authenticated-user-id','studio-local-preview');headers.set('oai-authenticated-user-email','tianna1727@gmail.com');request=new Request(request,{headers});}
      return api(request,env);
    }
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
  },
};

export default worker;
