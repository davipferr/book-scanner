import { basename } from 'node:path';
import { producers, type Flow } from './flow.ts';

export const DIAGRAM_START = '<!-- pipeline:diagram:start -->';
export const DIAGRAM_END = '<!-- pipeline:diagram:end -->';

/**
 * Gera um diagrama Mermaid a partir do flow.yaml: uma caixa por etapa e uma
 * seta por arquivo que passa de uma etapa para outra.
 */
export function toMermaid(flow: Flow): string {
  const ownerOf = producers(flow);
  const lines = ['flowchart TD', '  user(["👤 você"])'];

  flow.steps.forEach((step, i) => {
    const tags = [step.source === 'local' ? 'local' : step.source, step.interactive ? 'interativa' : ''].filter(Boolean);
    lines.push(`  ${node(step.id)}["${i + 1}. ${step.title}<br/><b>${step.skill}</b><br/><small>${tags.join(' · ')}</small>"]`);
  });

  // Agrupa os arquivos por par (origem → destino) para não repetir setas.
  const edges = new Map<string, string[]>();
  for (const step of flow.steps) {
    if (step.inputs.length === 0) edges.set(`user→${step.id}`, ['ideia']);
    for (const input of step.inputs) {
      const from = ownerOf.get(input);
      if (!from) continue;
      const key = `${from}→${step.id}`;
      edges.set(key, [...(edges.get(key) ?? []), basename(input)]);
    }
  }
  for (const [key, files] of edges) {
    const [from, to] = key.split('→') as [string, string];
    lines.push(`  ${from === 'user' ? 'user' : node(from)} -->|${files.join('<br/>')}| ${node(to)}`);
  }
  for (const step of flow.steps) {
    if (step.onReject !== undefined) lines.push(`  ${node(step.id)} -.->|reprovado| ${node(step.onReject)}`);
  }

  lines.push('  classDef local fill:#e8f1ff,stroke:#3b82f6,color:#0b2545');
  lines.push('  classDef external fill:#fff4e5,stroke:#f59e0b,color:#3d2600');
  const local = flow.steps.filter((s) => s.source === 'local').map((s) => node(s.id));
  const external = flow.steps.filter((s) => s.source !== 'local').map((s) => node(s.id));
  if (local.length) lines.push(`  class ${local.join(',')} local`);
  if (external.length) lines.push(`  class ${external.join(',')} external`);
  return lines.join('\n');
}

/** Substitui o bloco entre os marcadores do README pelo diagrama atual. */
export function replaceDiagram(readme: string, mermaid: string): string | null {
  const start = readme.indexOf(DIAGRAM_START);
  const end = readme.indexOf(DIAGRAM_END);
  if (start === -1 || end === -1 || end < start) return null;
  const block = `${DIAGRAM_START}\n\`\`\`mermaid\n${mermaid}\n\`\`\`\n`;
  return readme.slice(0, start) + block + readme.slice(end);
}

// Mermaid reserva algumas palavras (ex.: "end"), então os nós ganham prefixo.
const node = (id: string) => `s_${id.replace(/-/g, '_')}`;
