export const TUTORIAL_GUIDE_MESSAGES = Object.freeze({
  beat: Object.freeze({
    1: "「▶ 再生」を押してみよう！",
    2: "トラックを変えてみよう！",
    3: "ほかのトラックも変えてみよう！",
    4: "ボイスでも遊べるよ！「できた！」でもOK！"
  }),
  voice: Object.freeze({
    1: "パッドを押してみよう！",
    2: "ほかのパッドも押してみよう！",
    3: "「● 録音」で音を残せるよ！",
    4: "ビートに合わせてパッドを押そう！",
    5: "「つぎたし」や「やり直し」もできるよ！",
    6: "ビートに戻る？ それとも「できた！」？"
  })
});

export function createTutorialGuideState() {
  return {
    activeTab: "pico",
    beat: { stage: 1, trackChangeCount: 0 },
    voice: { stage: 1, padPressCount: 0 }
  };
}

export function updateTutorialGuide(state, event) {
  switch (event.type) {
    case "enter-tab":
      if (event.tab === "pico") {
        return {
          ...state,
          activeTab: "pico",
          beat: { stage: event.playing ? 2 : 1, trackChangeCount: 0 }
        };
      }
      if (event.tab === "voice") {
        return {
          ...state,
          activeTab: "voice",
          voice: {
            stage: event.recording ? 4 : 1,
            padPressCount: 0
          }
        };
      }
      return state;

    case "playback-started":
      if (state.activeTab !== "pico" || state.beat.stage !== 1) return state;
      return { ...state, beat: { ...state.beat, stage: 2 } };

    case "track-changed": {
      if (state.activeTab !== "pico" || state.beat.stage < 2) return state;
      const trackChangeCount = Math.min(2, state.beat.trackChangeCount + 1);
      return {
        ...state,
        beat: {
          stage: trackChangeCount === 1 ? 3 : 4,
          trackChangeCount
        }
      };
    }

    case "pad-pressed": {
      if (state.activeTab !== "voice" || state.voice.stage >= 3) return state;
      const padPressCount = Math.min(2, state.voice.padPressCount + 1);
      return {
        ...state,
        voice: {
          stage: padPressCount === 1 ? 2 : 3,
          padPressCount
        }
      };
    }

    case "recording-started":
      return { ...state, voice: { ...state.voice, stage: 4 } };

    case "recording-stopped":
      if (state.activeTab !== "voice") return state;
      return { ...state, voice: { ...state.voice, stage: 5 } };

    case "voice-exit-ready":
      if (state.activeTab !== "voice" || state.voice.stage !== 5) return state;
      return { ...state, voice: { ...state.voice, stage: 6 } };

    default:
      return state;
  }
}

export function tutorialGuideMessage(state) {
  if (state.activeTab === "voice") {
    return TUTORIAL_GUIDE_MESSAGES.voice[state.voice.stage];
  }
  return TUTORIAL_GUIDE_MESSAGES.beat[state.beat.stage];
}
