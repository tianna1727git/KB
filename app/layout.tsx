import './seo-keywords.css';
import './settings.css';
import './globals.css';
import './sketch-ui.css';
import {MaterialCategoriesProvider} from '../components/material-categories-context';
import type {Metadata} from 'next';
export const metadata:Metadata={title:'Payo Content Agent Studio',description:'以知识为依据，协同研究、写作和检查，完成官网SEO文章。'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body><MaterialCategoriesProvider>{children}</MaterialCategoriesProvider></body></html>;}
