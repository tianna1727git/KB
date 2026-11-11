export const INSIGHTS_SCHEDULE={timezone:'Etc/UTC',weekday:3,hour:9,label:'每周三 09:00 UTC（每7天）'};
const anchor=Date.UTC(2026,0,7,9);
export const schedulePeriod=stamp=>Math.floor((Number(stamp)-anchor)/(7*86400000));
export function nextInsightsRun(stamp=Date.now()){const date=new Date(stamp),next=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()+(3-date.getUTCDay()+7)%7,9));if(next.getTime()<=stamp)next.setUTCDate(next.getUTCDate()+7);return next.toISOString();}
