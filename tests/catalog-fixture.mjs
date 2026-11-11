import {createHash} from 'node:crypto';
// Synthetic import fixtures: public tests must not require business document text.
export const catalog=Array.from({length:160},(_,i)=>{const markdown=`# Synthetic document ${i}\n\nPublic integration fixture ${i}.`;return {id:'fixture-'+i,name:`fixture-${i}.md`,path:`fixture-${i}.md`,title:`Synthetic document ${i}`,markdown,size:Buffer.byteLength(markdown),sha256:createHash('sha256').update(markdown).digest('hex'),collection:'ProductMarketingChina',imported:true,source:'Synthetic test fixture',libraryCategory:'Product Guide',sourceFormat:'md'};});
export const catalogPlugin={name:'synthetic-catalog',setup(build){build.onLoad({filter:/library-data\.json$/},()=>({contents:JSON.stringify(catalog),loader:'json'}));}};
