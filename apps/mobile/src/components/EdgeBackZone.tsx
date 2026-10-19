import { StyleSheet, View } from "react-native"

/**
 * iOS의 뒤로 쓸기는 화면 왼쪽 가장자리에서 시작한다. 그 자리에 가로 스크롤(사진 넘기기, 칩 줄)이
 * 깔려 있으면 스크롤이 손가락을 먼저 가져가서 뒤로가기가 먹히지 않는다.
 * 가장자리 띠를 평범한 뷰로 덮어 두면 그 자리의 터치는 스크롤이 아니라 내비게이션의 뒤로 쓸기가 받는다.
 * 가로 스크롤이 화면 왼쪽 끝까지 닿는 화면의 맨 바깥 View 안, 마지막 자식으로 둔다.
 */
export function EdgeBackZone() {
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.zone} testID="edge-back-zone" />
}

const styles = StyleSheet.create({
  zone: { position: "absolute", left: 0, top: 0, bottom: 0, width: 20, zIndex: 10 },
})
