export const SOURCE_FORMAT_LABELS={pdf:'PDF',word:'Word',excel:'Excel',powerpoint:'PPT',image:'图片',txt:'TXT',html:'HTML',markdown:'Markdown',url:'URL',video:'视频',other:'其他'};
export function sourceFormatGroup(file){
 const format=String(file.sourceFormat||file.originalName?.split('.').pop()||file.format||(file.sourceURL?'url':'')||file.name?.split('.').pop()||'').toLowerCase();
 if(format==='pdf')return 'pdf';if(['doc','docx'].includes(format))return 'word';if(['xls','xlsx','csv'].includes(format))return 'excel';if(['ppt','pptx'].includes(format))return 'powerpoint';if(['png','jpg','jpeg','gif','webp','bmp','jp2','svg'].includes(format))return 'image';if(format==='txt')return 'txt';if(['html','htm'].includes(format))return 'html';if(['md','markdown'].includes(format))return 'markdown';if(format==='url')return 'url';if(['mov','mp4','webm','m4v'].includes(format))return 'video';return 'other';
}
export function fileTimes(file,versions=[]){
 const uploadedAt=file.uploadedAt||file.created||file.imported||null;
 const latest=versions.filter(v=>v.libraryId===file.id&&v.version>1).sort((a,b)=>b.version-a.version)[0];
 return {uploadedAt,contentUpdatedAt:file.contentUpdatedAt||latest?.created||uploadedAt};
}
