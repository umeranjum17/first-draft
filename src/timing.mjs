// Where a make's seconds go: work runs under a named stage and the stages add up (several options at once add their own seconds).
export const stopwatch = () => {
  const clock = {};
  return {
    timed: async (stage, work) => { const since = Date.now(); try { return await work(); } finally { clock[stage] = (clock[stage] ?? 0) + (Date.now() - since) / 1000; } },
    seconds: () => Object.fromEntries(Object.entries(clock).map(([k, v]) => [`${k}_s`, Math.round(v)])),
  };
};
