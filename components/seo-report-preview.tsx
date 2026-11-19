'use client';
import {Fragment} from 'react';
function Inline({text}:{text:string}){return <>{text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/g).map((part,i)=>{if(part.startsWith('**')&&part.endsWith('**'))return <strong key={i}>{part.slice(2,-2)}</strong>;if(part.startsWith('`')&&part.endsWith('`'))return <code key={i}>{part.slice(1,-1)}</code>;const link=part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);if(link)return <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>;return <Fragment key={i}>{part}</Fragment>;})}</>;}
export function SEOReportPreview({markdown,draft=false}:{markdown:string;draft?:boolean}){
 const lines=markdown.split(/\r?\n/),blocks:React.ReactNode[]=[];let i=0;
 const cells=(line:string)=>line.trim().replace(/^\||\|$/g,'').split(/(?<!\\)\|/).map(c=>c.trim().replace(/\\\|/g,'|'));
 while(i<lines.length){const line=lines[i];if(!line.trim()){i++;continue;}const heading=line.match(/^(#{1,4})\s+(.*)$/);if(heading){const content=<Inline text={heading[2]}/>;blocks.push(heading[1].length===1?<h1 key={i}>{content}</h1>:heading[1].length===2?<h2 key={i}>{content}</h2>:<h3 key={i}>{content}</h3>);i++;continue;}
  if(line.trim().startsWith('|')&&/^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i+1]||'')){const header=cells(line),rows:string[][]=[];i+=2;while(i<lines.length&&lines[i].trim().startsWith('|'))rows.push(cells(lines[i++]));blocks.push(<div className="table-wrap" key={'t'+i}><table><thead><tr>{header.map((c,j)=><th key={j}><Inline text={c}/></th>)}</tr></thead><tbody>{rows.map((r,j)=><tr key={j}>{r.map((c,k)=><td key={k}><Inline text={c}/></td>)}</tr>)}</tbody></table></div>);continue;}
  if(/^\s*[-*]\s+/.test(line)){const items:string[]=[];while(i<lines.length&&/^\s*[-*]\s+/.test(lines[i]))items.push(lines[i++].replace(/^\s*[-*]\s+/,''));blocks.push(<ul key={'l'+i}>{items.map((v,j)=><li key={j}><Inline text={v}/></li>)}</ul>);continue;}
  const paragraphs=[line];i++;while(i<lines.length&&lines[i].trim()&&!/^(#{1,4}\s|\s*[-*]\s|\s*\|)/.test(lines[i]))paragraphs.push(lines[i++]);blocks.push(<p key={'p'+i}><Inline text={paragraphs.join(' ')}/></p>);
 }
 return <article className="seo-report-preview" aria-label="SEO关键词研究报告预览">{draft&&<p className="banner" role="status">报告尚未生成完成，以下为过程预览。请继续生成后再导出正式报告。</p>}{blocks}</article>;
}
