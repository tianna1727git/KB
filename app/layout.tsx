import './seo-keywords.css';
import './settings.css';
import './globals.css';
import './sketch-ui.css';
import {MaterialCategoriesProvider} from '../components/material-categories-context';
import type {Metadata} from 'next';
export const metadata:Metadata={title:'Payo Content Agent Studio',description:'以知识为依据，协同研究、写作和检查，完成官网SEO文章。'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body><svg aria-hidden="true" width="0" height="0" style={{position:'absolute',overflow:'hidden'}}><filter id="payo-pencil-wobble" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="1" seed="7" result="grain"/><feDisplacementMap in="SourceGraphic" in2="grain" scale="1.1" xChannelSelector="R" yChannelSelector="G"/></filter></svg><MaterialCategoriesProvider>{children}</MaterialCategoriesProvider></body></html>;}
