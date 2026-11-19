'use client';
import type {ReactNode} from 'react';
import {Tabs} from 'radix-ui';
export function SettingsTabs({value,onValueChange,services,fields}:{value:string,onValueChange:(value:string)=>void,services:ReactNode,fields:ReactNode}){
 return <Tabs.Root className="settings-layout" value={value} onValueChange={onValueChange}><Tabs.List className="settings-navigation" aria-label="工作台设置"><Tabs.Trigger value="services">服务设置</Tabs.Trigger><Tabs.Trigger value="fields">字段设置</Tabs.Trigger></Tabs.List><Tabs.Content className="settings-content" value="services">{services}</Tabs.Content><Tabs.Content className="settings-content" value="fields">{fields}</Tabs.Content></Tabs.Root>;
}
