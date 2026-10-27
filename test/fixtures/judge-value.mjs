// Shared synthetic verdict shape for OFFLINE provider-edge journeys only; never packaged.
export function judgeValue(tool) {
  const ids = tool.parameters.properties.views.items.properties.view.enum;
  const value = { views: ids.map(view => ({ view, judged: 'Umer fixture at this width and theme' })), design: { score: 9, gaps: ['Fixture gap'] }, plain: { score: 8, gaps: ['Fixture baseline gap'] }, against: 'Fixture baseline', reads_as: 'Notes for Umer', fix: 'Improve fixture hierarchy', axes: Object.fromEntries(['hierarchy', 'type', 'colour', 'spacing', 'imagery', 'proof_clarity', 'ai_tells'].map(a => [a, { score: 9, reason: 'Fixture assessment' }])) };
  if (tool.parameters.properties.flow) value.flow = { shell: { score: 9, reason: 'One fixture shell' }, character: { score: 9, reason: 'One fixture character' } };
  if (tool.parameters.properties.ai_side) Object.assign(value, { ai_side: { reads_as_ai: false, tells: [] }, hero: Array.from({ length: 9 }, (_, i) => ({ point: i + 1, met: true, reason: 'Fixture hero' })) });
  return value;
}
