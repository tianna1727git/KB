import {LIBRARY_CATEGORIES as categories} from './library-categories.mjs';
export const LIBRARY_CATEGORIES=categories;
export function validLibraryCategory(value:unknown):value is string{return typeof value==='string'&&(LIBRARY_CATEGORIES as readonly string[]).includes(value);}
