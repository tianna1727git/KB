export const LIBRARY_CATEGORIES = ['About Payoneer','Events','Product Guide','Products & Solutions','Product Brochure','Templates & Tools','Whitepaper'] as const;
export function validLibraryCategory(value:unknown):value is string{return typeof value==='string'&&(LIBRARY_CATEGORIES as readonly string[]).includes(value);}
