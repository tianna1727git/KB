export const MAX_UPLOAD_FILES=50;
export const DOCUMENT_MAX_BYTES=200*1024*1024;
export const TEXT_MAX_BYTES=20*1024*1024;
export const MAX_DOCUMENT_PAGES=200;
export const UPLOAD_ACCEPT='.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.html,.htm,.png,.jpg,.jpeg,.jp2,.webp,.gif,.bmp,.txt,.md,.markdown';
export const UPLOAD_EXTENSION=/\.(pdf|doc|docx|ppt|pptx|xls|xlsx|html|htm|png|jpe?g|jp2|webp|gif|bmp|txt|md|markdown)$/i;
export const localTextUpload=file=>/\.(txt|md|markdown|html|htm)$/i.test(file.name)&&file.size<=TEXT_MAX_BYTES;
export function uploadFileError({name,size}){
 if(typeof name!=='string'||!name.trim()||name.length>512||!UPLOAD_EXTENSION.test(name))return '不支持此文件格式';
 if(!Number.isSafeInteger(size)||size<=0)return '文件为空或大小无效，请重新选择';
 if(size>DOCUMENT_MAX_BYTES)return '单文件不能超过 200 MB';
 if(/\.(txt|md|markdown)$/i.test(name)&&size>TEXT_MAX_BYTES)return 'TXT / Markdown 为本地导入格式，最大 20 MB；可转为 PDF 或 HTML 后上传';
 return '';
}
