import { useEffect, useRef, useState } from 'react'

/** Paces the prototype's reveal; completion of a real request should replace this timer. */
export default function useLoadingSequence(duration: number, onComplete: () => void) {
  const [stage, setStage] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(preference.matches)
    preference.addEventListener('change', update)
    return () => preference.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const timers = reducedMotion ? [] : [
      setTimeout(() => setStage(1), duration / 3),
      setTimeout(() => setStage(2), duration * 2 / 3),
    ]
    timers.push(setTimeout(() => setStage(3), reducedMotion ? 0 : duration))
    timers.push(setTimeout(() => onCompleteRef.current(), reducedMotion ? 0 : duration + 650))
    return () => timers.forEach(clearTimeout)
  }, [duration, reducedMotion])

  return { stage, complete: stage === 3, reducedMotion }
}
