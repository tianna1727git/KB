import {mcp} from '../lib/studio/mcp.mjs';
import {api} from '../lib/studio/api';
export default {fetch(req:Request,env:any){return mcp(req,env,api)}};
