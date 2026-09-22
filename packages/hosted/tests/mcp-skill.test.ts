import {readFile} from 'node:fs/promises';
import {describe, expect, it} from 'vitest';
import {
  mcpProductManagementToolNames,
  mcpProtocolVersion,
} from '../src/index.js';

const skillRoot = new URL('../../../skills/basiclinear-product-management/', import.meta.url);

async function skillFile(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, skillRoot), 'utf8');
}

describe('packaged BasicLinear product-management skill', () => {
  it('maps exactly the MCP PM allowlist and its stable protocol', async () => {
    const [skill, toolMap, safety] = await Promise.all([
      skillFile('SKILL.md'),
      skillFile('references/tool-map.md'),
      skillFile('references/safety.md'),
    ]);
    expect(skill).toMatch(/^---\nname: basiclinear-product-management\n/u);
    expect(skill).toContain(`stable \`${mcpProtocolVersion}\` protocol`);
    expect(safety).toContain(`stable \`${mcpProtocolVersion}\` stateless Streamable HTTP profile`);
    expect(safety).toContain('There is no GET event stream or persistent MCP session.');
    for (const name of mcpProductManagementToolNames) expect(toolMap).toContain(`\`${name}\``);
    const mappedNames = [...toolMap.matchAll(/`([a-z][a-z0-9]*\.[a-z][a-z0-9]*)`/gu)]
      .map((match) => match[1])
      .filter((name): name is string => name !== undefined)
      .sort();
    expect(mappedNames).toEqual([...mcpProductManagementToolNames]);
    expect(toolMap).toContain('There are exactly 27 PM tools.');
  });

  it('requires destructive confirmation and rejects prohibited product expansion', async () => {
    const [skill, safety, agentMetadata] = await Promise.all([
      skillFile('SKILL.md'),
      skillFile('references/safety.md'),
      skillFile('agents/openai.yaml'),
    ]);
    for (const name of ['comment.delete', 'member.remove', 'invitation.revoke']) {
      expect(skill).toContain(name);
      expect(safety).toContain(name);
    }
    expect(skill).toContain('Obtain explicit user confirmation immediately before');
    expect(skill).toContain('Do not invent or seek tools for autonomous agents');
    expect(safety).toContain('Do not use MCP to buy or change a subscription.');
    expect(skill).not.toMatch(/(?:^|\n)#+\s+(?:Agent|Code review|Repository|Pull request)/iu);
    expect(agentMetadata).toContain('display_name: "BasicLinear Product Management"');
    expect(agentMetadata).toContain('$basiclinear-product-management');
  });
});
