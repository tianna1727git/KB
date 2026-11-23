export function PersonaSettings(){
 return <section className="panel settings-panel persona-settings">
  <h2>Persona（目标读者）</h2>
  <p>当前不预设固定职业或行业画像，避免把不相关的受众假设带入文章。</p>
  <div className="persona-current"><span>当前默认</span><strong>不预设 Persona</strong></div>
  <p>创建文章任务时，可按具体主题选填目标读者；留空时由 Agent 根据选题和可查证据判断，不自动关联跨境卖家等特定人群。</p>
 </section>;
}
