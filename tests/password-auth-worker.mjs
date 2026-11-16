import {passwordAuth} from '../lib/studio/password-auth.mjs';
import {api} from '../lib/studio/api';
import {gatewayIdentity} from '../lib/studio/gateway-identity.mjs';
export default {async fetch(request, env) {
  const result = env.STUDIO_AUTH_MODE === 'gateway' ? await gatewayIdentity(request, env) : await passwordAuth(request, env);
  if (result.response) return result.response;
  if (new URL(request.url).pathname === '/__test_echo') return Response.json({workspace: env.AUTH_WORKSPACE, body: await result.request.text()});
  return api(result.request, env);
}};
