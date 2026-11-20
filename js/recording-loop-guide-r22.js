export function createRecordingLoopGuide(startStep = 0, loopSteps = 256) {
  return {
    lastStep: ((startStep % loopSteps) + loopSteps) % loopSteps,
    elapsedSteps: 0,
    announced: false
  };
}

export function advanceRecordingLoopGuide(state, step, loopSteps = 256) {
  if (!state || state.announced) return { state, shouldAnnounce: false };
  const normalizedStep = ((step % loopSteps) + loopSteps) % loopSteps;
  const delta = (normalizedStep - state.lastStep + loopSteps) % loopSteps;
  const elapsedSteps = state.elapsedSteps + delta;
  const shouldAnnounce = elapsedSteps >= loopSteps;
  return {
    state: {
      lastStep: normalizedStep,
      elapsedSteps,
      announced: shouldAnnounce
    },
    shouldAnnounce
  };
}
