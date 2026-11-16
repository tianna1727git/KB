import {mcp} from '../lib/studio/mcp.mjs';
import {api} from '../lib/studio/api';
import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import { passwordAuth } from '../lib/studio/password-auth.mjs';

const worker = {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    const auth = await passwordAuth(request, env);
    if (auth.response) return auth.response;
    request = auth.request!;
    const dispatch = async () => {
      if(new URL(request.url).pathname==='/mcp')return mcp(request,env,api);
      if(new URL(request.url).pathname.startsWith('/api/studio/')){
        // Synthetic identity for the isolated local preview only. Vite removes this branch from production.
        if(import.meta.env.DEV && env.STUDIO_AUTH_MODE !== 'password'){const headers=new Headers(request.headers);headers.set('oai-authenticated-user-id','studio-local-preview');headers.set('oai-authenticated-user-email','tianna1727@gmail.com');request=new Request(request,{headers});}
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
      // Standalone password deployments run the Worker before static assets too.
      if (env.STUDIO_AUTH_MODE === 'password' && env.ASSETS && ['GET', 'HEAD'].includes(request.method)) {
        const asset = await env.ASSETS.fetch(request);
        if (asset.status !== 404) return asset;
      }
      return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
    };
    const result = await dispatch();
    if (env.STUDIO_AUTH_MODE !== 'password') return result;
    const headers = new Headers(result.headers);
    headers.set('Cache-Control', 'private, no-store');
    headers.set('Vary', headers.get('Vary') ? headers.get('Vary') + ', Cookie' : 'Cookie');
    return new Response(result.body, {status: result.status, statusText: result.statusText, headers});
  },
};

export default worker;
