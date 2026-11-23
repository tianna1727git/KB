import {BrewingTitle} from './brewing-title';

export function WorkspaceLoading({compact = false}: {compact?: boolean} = {}) {
  return (
    <section role="status" className={compact ? 'workspace-brewing brewing-compact' : 'workspace-brewing'}>
      <div className="brewing-band" aria-hidden="true">
        <img className="brewing-trumpet" src="/pencil/brewing/trumpeter.webp" alt="" />
        <img className="brewing-neon" src="/pencil/brewing/neon.webp" alt="" />
        <img className="brewing-sax" src="/pencil/brewing/saxophonist.webp" alt="" />
      </div>
      <BrewingTitle/>
      <p>Gathering your sources and drafts.</p>
    </section>
  );
}
