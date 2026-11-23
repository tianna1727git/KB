'use client';
import type {ReactNode} from 'react';
import {Tabs} from 'radix-ui';
export function SettingsTabs({value,onValueChange,sources,persona,fields,agents,settings}:{value:string,onValueChange:(value:string)=>void,sources:ReactNode,persona:ReactNode,fields:ReactNode,agents:ReactNode,settings:ReactNode}){
 return <Tabs.Root className="settings-layout" value={value} onValueChange={onValueChange}><Tabs.List className="settings-navigation" aria-label="工作台设置"><Tabs.Trigger value="sources">Sources</Tabs.Trigger><Tabs.Trigger value="persona">Persona</Tabs.Trigger><Tabs.Trigger value="fields">Fields</Tabs.Trigger><Tabs.Trigger value="agents">Agents</Tabs.Trigger><Tabs.Trigger value="settings">Settings</Tabs.Trigger></Tabs.List><Tabs.Content className="settings-content" value="sources">{sources}</Tabs.Content><Tabs.Content className="settings-content" value="persona">{persona}</Tabs.Content><Tabs.Content className="settings-content" value="fields">{fields}</Tabs.Content><Tabs.Content className="settings-content" value="agents">{agents}</Tabs.Content><Tabs.Content className="settings-content" value="settings">{settings}</Tabs.Content></Tabs.Root>;
}
