'use client';
import {createContext,useContext,useEffect,useState,ReactNode} from 'react';
import {DEFAULT_MATERIAL_CATEGORIES,categoryLabel,categoryMatches,categoryOptions} from '../lib/studio/material-categories.mjs';
export type CategoryNode={value:string;label:string;parent:string|null;organizationPolicy?:string};
export type CategoryConfig={name:string;key:string;type:string;levels:number;nodes:CategoryNode[];revision:number;usage:{value:string;count:number}[]};
const initial={...DEFAULT_MATERIAL_CATEGORIES,revision:0,usage:[]} as CategoryConfig;
const Context=createContext({config:initial,loading:false,error:'',reload:async()=>{}});
export function MaterialCategoriesProvider({children}:{children:ReactNode}){
 const [config,setConfig]=useState(initial),[loading,setLoading]=useState(true),[error,setError]=useState('');
 async function reload(){setLoading(true);setError('');try{const r=await fetch('/api/studio/materialCategories');const j=await r.json() as CategoryConfig&{error?:string};if(!r.ok)throw Error(j.error||'读取分类配置失败');setConfig(j);}catch(e:any){setError(e.message);throw e;}finally{setLoading(false);}}
 useEffect(()=>{reload().catch(()=>{});const focus=()=>reload().catch(()=>{});window.addEventListener('focus',focus);return()=>window.removeEventListener('focus',focus);},[]);
 return <Context.Provider value={{config,loading,error,reload}}>{children}</Context.Provider>;
}
export function useMaterialCategories(){const context=useContext(Context);return {...context,options:categoryOptions(context.config) as (CategoryNode&{path:string})[],label:(value:string)=>categoryLabel(context.config,value),matches:(value:string,selected:string)=>categoryMatches(context.config,value,selected)};}
