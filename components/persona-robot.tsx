const accents=['#8c668f','#648b86','#b27a54','#6c7d9a','#a16e74','#7e8860'];
export function PersonaRobot({index=0,size=42}:{index?:number;size?:number}){
 const accent=accents[index%accents.length];
 return <svg className="persona-robot" width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="手绘机器人头像" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
  <path d="M23.8 7v4.2M21.3 6.7h5" stroke={accent}/><path d="M14 15.5c.5-2.7 2.7-4.2 5.7-4.2h9c3.3 0 5.7 2 5.9 5.2l1 15.4c.2 3-1.8 5.4-5 5.6-4.6.3-9.2.3-13.8 0-3-.2-4.8-2.4-4.6-5.4l.9-16.6Z"/><path d="M11.5 21.5h3M34.5 21h3M13.2 31.7l-3.4 2.2 3.5 1.4M34.5 31.2l3.4 2.5-3.5 1.1"/><path d="M19 22.5c.3-1.1 1.1-1.7 2.1-1.7 1.1 0 1.9.7 2 1.8M26.2 22.5c.3-1.1 1.1-1.7 2.1-1.7 1.1 0 1.9.7 2 1.8" stroke={accent}/><path d="M20 29.2c2.5 2.4 5.9 2.3 8.3-.1M17.5 40h13M20 37.8l-1 2.4m9-2.4 1 2.4"/>
 </svg>;
}
