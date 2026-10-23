import { useId } from "react"
import Svg, { Circle, Defs, G, Mask, Path, Rect, Text as SvgText, TextPath } from "react-native-svg"

import { fonts, usePalette } from "@/src/theme"

/*
 * 완식 도장. 매끈한 도형 대신 손으로 누른 고무 도장처럼 보이게 그린다(사용자 결정, 2026.10.23).
 * - 테두리: 굵은 바깥 테 + 가는 안쪽 테 두 줄. 반지름을 조금씩 흔들어 손으로 누른 가장자리를 낸다
 * - 글자: 테두리를 도는 문구와 가운데 큰 제목
 * - 잉크: 잔 점과 옅은 얼룩을 마스크로 뚫어 덜 묻은 자리를 만든다. 너무 닳아 보이지 않게 옅게 둔다
 * react-native-svg에는 노이즈 필터가 없어 결을 고정 난수로 만든다. 씨앗이 같아 늘 같은 도장이 찍힌다.
 */

const VIEW = 120
const CENTER = VIEW / 2
/** 테두리 문구가 지나는 원의 반지름. 바깥 테(49)와 안쪽 테(31.5) 사이 가운데다 */
const TEXT_RADIUS = 40.5
/**
 * 문구가 둘레를 거의 한 바퀴 채우는 자간. iOS가 textLength를 따르지 않아 자간으로 맞춘다.
 * "RAOTA ✦ 라멘 완식 인증 ✦ YYYY.MM.DD ✦"(31자) 기준이다
 */
const RING_LETTER_SPACING = 2.8

function seeded(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

/** 반지름을 몇 겹의 사인으로 흔든 닫힌 원 */
function wobblyCircle(radius: number, phase: number, amplitude: number): string {
  const steps = 144
  const points: string[] = []
  for (let index = 0; index < steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2
    const r =
      radius +
      amplitude * (0.55 * Math.sin(5 * angle + phase) + 0.3 * Math.sin(11 * angle + phase * 2.3) + 0.15 * Math.sin(23 * angle + phase * 0.7))
    points.push(`${(CENTER + r * Math.cos(angle)).toFixed(2)} ${(CENTER + r * Math.sin(angle)).toFixed(2)}`)
  }
  return `M${points.join("L")}Z`
}

/** 두 원 사이를 채운 고리. evenodd로 안쪽을 비운다 */
const ring = (outer: number, inner: number, phase: number, amplitude: number) =>
  wobblyCircle(outer, phase, amplitude) + wobblyCircle(inner, phase + 1.7, amplitude)

const RINGS = [ring(58.2, 52.6, 0.4, 0.55), ring(49.7, 48.3, 2.1, 0.35), ring(32.2, 30.8, 4.2, 0.3)]
const TEXT_PATH = `M${CENTER - TEXT_RADIUS} ${CENTER} a${TEXT_RADIUS} ${TEXT_RADIUS} 0 1 1 ${TEXT_RADIUS * 2} 0 a${TEXT_RADIUS} ${TEXT_RADIUS} 0 1 1 ${-TEXT_RADIUS * 2} 0`

/** 잉크가 덜 묻은 자리. 잔 점은 진하게 조금, 얼룩은 크고 옅게 몇 개만 */
const WEAR = (() => {
  const random = seeded(20261023)
  const inside = () => {
    const angle = random() * Math.PI * 2
    const r = Math.sqrt(random()) * 58
    return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) }
  }
  const specks = Array.from({ length: 90 }, () => ({ ...inside(), r: 0.3 + random() * 0.6, opacity: 0.45 + random() * 0.45 }))
  const blots = Array.from({ length: 4 }, () => ({ ...inside(), r: 7 + random() * 7, opacity: 0.12 + random() * 0.1 }))
  return [...blots, ...specks]
})()

export interface InkStampProps {
  size: number
  /** 테두리를 도는 문구 */
  ringText: string
  /** 가운데 큰 글자("완식") */
  title: string
  /** 제목 아래 작은 글자(날짜, 번호) */
  caption?: string
}

export function InkStamp({ size, ringText, title, caption }: InkStampProps) {
  const ink = usePalette().brand
  // url(#…) 참조에 콜론이 들어가면 iOS가 마스크를 찾지 못한다
  const id = useId().replace(/[^a-zA-Z0-9]/g, "")
  const maskId = `stamp-wear-${id}`
  const pathId = `stamp-ring-${id}`
  return (
    <Svg height={size} viewBox={`0 0 ${VIEW} ${VIEW}`} width={size}>
      <Defs>
        <Path d={TEXT_PATH} id={pathId} />
        <Mask height={VIEW} id={maskId} maskUnits="userSpaceOnUse" width={VIEW} x={0} y={0}>
          <Rect fill="#ffffff" height={VIEW} width={VIEW} />
          {WEAR.map((spot, index) => (
            <Circle cx={spot.x} cy={spot.y} fill="#000000" fillOpacity={spot.opacity} key={index} r={spot.r} />
          ))}
        </Mask>
      </Defs>
      <G fill={ink} mask={`url(#${maskId})`}>
        {RINGS.map((d, index) => (
          <Path d={d} fillRule="evenodd" key={index} />
        ))}
        <SvgText fontFamily={fonts.body} fontSize={9} fontWeight="700" letterSpacing={RING_LETTER_SPACING}>
          <TextPath href={`#${pathId}`}>
            {ringText}
          </TextPath>
        </SvgText>
        <SvgText fontFamily={fonts.body} fontSize={22} fontWeight="700" textAnchor="middle" x={CENTER} y={caption ? 64 : 68}>
          {title}
        </SvgText>
        {caption ? (
          <SvgText fontFamily={fonts.body} fontSize={8.5} fontWeight="700" letterSpacing={0.6} textAnchor="middle" x={CENTER} y={79}>
            {caption}
          </SvgText>
        ) : null}
      </G>
    </Svg>
  )
}
