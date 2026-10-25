import { diskProbe, error, REPO_ROOT, userPath, type FileProbe, type Issue } from './files.ts';
import { FLOW_FILE, parseFlow, type Flow } from './flow.ts';
import { MANIFEST_FILE, parseManifest, type Manifest } from './skills.ts';

export interface Project {
  root: string;
  probe: FileProbe;
  flow: Flow | null;
  manifest: Manifest | null;
  /** Problemas ao ler flow.yaml e skills.json. */
  issues: Issue[];
}

/** Lê pipeline/flow.yaml e pipeline/skills.json a partir da raiz do repositório (ou de `--root`). */
export function loadProject(root = REPO_ROOT): Project {
  const abs = userPath(root);
  const probe = diskProbe(abs);
  const issues: Issue[] = [];

  const flowText = probe.read(FLOW_FILE);
  let flow: Flow | null = null;
  if (flowText === null) issues.push(error(FLOW_FILE, `não encontrado em ${abs}`));
  else ({ flow } = withIssues(parseFlow(flowText), issues));

  const manifestText = probe.read(MANIFEST_FILE);
  let manifest: Manifest | null = { agents: [], external: [] };
  if (manifestText !== null) ({ manifest } = withIssues(parseManifest(manifestText), issues));

  return { root: abs, probe, flow, manifest, issues };
}

function withIssues<T extends { issues: Issue[] }>(result: T, into: Issue[]): T {
  into.push(...result.issues);
  return result;
}

const color = (code: number) => (text: string) => (process.stdout.isTTY ? `\x1b[${code}m${text}\x1b[0m` : text);
export const red = color(31);
export const yellow = color(33);
export const green = color(32);
export const cyan = color(36);
export const dim = color(2);
export const bold = color(1);

export function printIssues(issues: Issue[]): void {
  for (const issue of issues) {
    const tag = issue.level === 'error' ? red('erro ') : yellow('aviso');
    console.log(`  ${tag} ${dim(issue.where)}\n        ${issue.message}`);
  }
}
