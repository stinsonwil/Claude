// Compiles a workflow definition into task-engine steps, so workflow runs use
// the exact same durable execution path as every other Yoshi task.
//
// Definition shape: { blocks: [{ id, type, title, instructions, params,
// depends_on: [blockId], only_if_block?: blockId }] }
// Block types map 1:1 onto capability keys.

const BLOCK_TYPES = [
  'research', 'browser', 'file_analysis', 'create_document', 'setup_monitor',
  'setup_schedule', 'save_memory', 'approval', 'condition', 'notify_user', 'answer',
];

export function validateWorkflowDefinition(definition) {
  if (!definition || !Array.isArray(definition.blocks)) throw badReq('Workflow definition must have a blocks array');
  const ids = new Set();
  for (const b of definition.blocks) {
    if (!b.id) throw badReq('Every block needs an id');
    if (ids.has(b.id)) throw badReq(`Duplicate block id: ${b.id}`);
    ids.add(b.id);
    if (!BLOCK_TYPES.includes(b.type)) throw badReq(`Unknown block type: ${b.type}. Allowed: ${BLOCK_TYPES.join(', ')}`);
  }
  for (const b of definition.blocks) {
    for (const dep of b.depends_on || []) {
      if (!ids.has(dep)) throw badReq(`Block "${b.id}" depends on unknown block "${dep}"`);
    }
    if (b.only_if_block && !ids.has(b.only_if_block)) throw badReq(`Block "${b.id}" references unknown condition block "${b.only_if_block}"`);
  }
  // Cycle check via topological sort.
  orderBlocks(definition.blocks);
  return true;
}

function orderBlocks(blocks) {
  const remaining = new Map(blocks.map((b) => [b.id, b]));
  const ordered = [];
  const placed = new Set();
  while (remaining.size) {
    let progressed = false;
    for (const [id, b] of remaining) {
      if ((b.depends_on || []).every((d) => placed.has(d))) {
        ordered.push(b);
        placed.add(id);
        remaining.delete(id);
        progressed = true;
      }
    }
    if (!progressed) throw badReq('Workflow has a dependency cycle');
  }
  return ordered;
}

export function stepsFromWorkflow(definition, { inputText = '' } = {}) {
  validateWorkflowDefinition(definition);
  const ordered = orderBlocks(definition.blocks);
  const idxOf = new Map(ordered.map((b, i) => [b.id, i]));
  return ordered.map((b) => {
    const params = { ...(b.params || {}) };
    if (b.only_if_block !== undefined && b.only_if_block !== null && b.only_if_block !== '') {
      params.only_if_step = idxOf.get(b.only_if_block);
    }
    return {
      title: b.title || `${b.type} block`,
      capability: b.type,
      instructions: [b.instructions || '', inputText ? `\nRun input from the user: ${inputText}` : ''].join(''),
      params,
      depends_on: (b.depends_on || []).map((d) => idxOf.get(d)),
      requires_approval: b.type === 'approval',
    };
  });
}

function badReq(message) {
  return Object.assign(new Error(message), { status: 400 });
}

export const WORKFLOW_BLOCK_TYPES = BLOCK_TYPES;
