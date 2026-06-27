import { useState, useEffect, useRef, useCallback } from 'react'

export type TTSState = 'idle' | 'playing' | 'paused'

export function useTTS() {
  const [state, setState] = useState<TTSState>('idle')
  const [rate, setRate] = useState(1.0)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel()
    }
  }, [])

  const play = useCallback((text: string, voiceName?: string) => {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = rate

    if (voiceName) {
      const voices = window.speechSynthesis.getVoices()
      const voice = voices.find(v => v.name === voiceName)
      if (voice) utterance.voice = voice
    }

    utterance.onstart = () => setState('playing')
    utterance.onpause = () => setState('paused')
    utterance.onresume = () => setState('playing')
    utterance.onend = () => setState('idle')
    utterance.onerror = () => setState('idle')

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
    setState('playing')
  }, [rate])

  const pause = useCallback(() => {
    window.speechSynthesis.pause()
    setState('paused')
  }, [])

  const resume = useCallback(() => {
    window.speechSynthesis.resume()
    setState('playing')
  }, [])

  const stop = useCallback(() => {
    window.speechSynthesis.cancel()
    setState('idle')
  }, [])

  const updateRate = useCallback((newRate: number) => {
    setRate(newRate)
  }, [])

  return { state, rate, play, pause, resume, stop, updateRate }
}
