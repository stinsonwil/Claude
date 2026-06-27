// TTS is handled directly in the renderer via Web Speech API
// See useTTS hook for implementation

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis.getVoices()
}

export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise(resolve => {
    const voices = window.speechSynthesis.getVoices()
    if (voices.length > 0) {
      resolve(voices)
      return
    }
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      resolve(window.speechSynthesis.getVoices())
    }, { once: true })
  })
}
