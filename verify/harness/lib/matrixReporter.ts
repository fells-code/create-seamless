import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

// Prints a flow x layer conformance grid at the end of the run. Layer comes from
// the spec's directory (api/adapter/react); flow from the spec file name, with a
// few aliases folded together so the same flow lines up across layers.

const LAYERS = ['api', 'adapter', 'react'] as const;
type Layer = (typeof LAYERS)[number];

const FLOW_ALIASES: Record<string, string> = {
  emailOtpLogin: 'emailOtp',
  registration: 'register',
  magicLinkLogin: 'magicLink',
  passkeyRegister: 'passkey',
  passkeyLogin: 'passkey',
  adminBootstrap: 'admin',
  sessionLifecycle: 'session',
};

interface Entry {
  flow: string;
  layer: Layer;
  passed: boolean;
}

export default class MatrixReporter implements Reporter {
  private tests = new Map<string, Entry>();

  onTestEnd(test: TestCase, result: TestResult): void {
    const match = test.location.file.match(/\/(api|adapter|react)\/([^/]+)\.spec\.[tj]s$/);
    if (!match) return;
    const layer = match[1] as Layer;
    const base = match[2];
    const flow = FLOW_ALIASES[base] ?? base;
    // Keyed by test id so the final attempt (after retries) is the one that counts.
    this.tests.set(test.id, { flow, layer, passed: result.status === 'passed' });
  }

  onEnd(_result: FullResult): void {
    const cells = new Map<string, boolean>();
    for (const { flow, layer, passed } of this.tests.values()) {
      const key = `${flow}|${layer}`;
      cells.set(key, (cells.get(key) ?? true) && passed);
    }
    if (cells.size === 0) return;

    const flows = [...new Set([...cells.keys()].map((k) => k.split('|')[0]))].sort();
    const symbol = (flow: string, layer: Layer): string => {
      const value = cells.get(`${flow}|${layer}`);
      return value === undefined ? '-' : value ? '✓' : '✗';
    };

    const flowWidth = Math.max('flow'.length, ...flows.map((f) => f.length));
    const pad = (text: string, width: number) =>
      text + ' '.repeat(Math.max(0, width - text.length));
    const row = (label: string, get: (layer: Layer) => string) =>
      `  ${pad(label, flowWidth)}   ${LAYERS.map((l) => pad(get(l), 9)).join('')}`;
    const rule = `  ${'-'.repeat(flowWidth + 3 + LAYERS.length * 9)}`;

    const lines = [
      '',
      '  Conformance matrix',
      rule,
      row('flow', (l) => l),
      rule,
      ...flows.map((f) => row(f, (l) => symbol(f, l))),
      rule,
      '',
    ];
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
  }
}
