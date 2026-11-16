import {passwordAuth} from '../lib/studio/password-auth.mjs';
import {api} from '../lib/studio/api';
export default {async fetch(request, env) {
  const result = await passwordAuth(request, env);
  if (result.response) return result.response;
  return api(result.request, env);
}};
