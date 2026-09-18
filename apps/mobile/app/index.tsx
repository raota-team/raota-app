import AsyncStorage from "@react-native-async-storage/async-storage"
import Constants from "expo-constants"
import { useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"
import {
  ExternalLink,
  Globe,
  Layers,
  RefreshCw,
  Settings,
  Wifi,
  WifiOff,
  X,
} from "lucide-react-native"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text as NativeText,
  TextInput,
  TouchableOpacity,
  View,
  type TextProps,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { WebView, WebViewNavigation } from "react-native-webview"
import { fonts } from "@/src/theme"

const STORAGE_KEY_CUSTOM_URL = "@raota/custom_webview_url"
const DEFAULT_VITE_PORT = 8443

function Text({ style, ...props }: TextProps) {
  return <NativeText {...props} style={[{ fontFamily: fonts.body }, style]} />
}

function getDetectedDevUrl(): string {
  if (Platform.OS === "web") {
    return "http://localhost:8443"
  }
  const hostUri = Constants.expoConfig?.hostUri
  if (hostUri) {
    const ip = hostUri.split(":")[0]
    if (ip && ip !== "localhost" && ip !== "127.0.0.1") {
      return `http://${ip}:${DEFAULT_VITE_PORT}`
    }
  }
  // Default LAN fallback if detected earlier
  return "http://192.168.45.190:8443"
}

export default function WebViewScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const webViewRef = useRef<WebView>(null)

  const bottomInset = Math.max(insets.bottom, 28)

  // Injected CSS to adapt Figma Make desktop frame to mobile viewport
  const injectedCss = useMemo(
    () => `
    html, body {
      width: 100% !important;
      height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      background-color: #FFFFFF !important;
      overflow: hidden !important;
      -webkit-overflow-scrolling: touch !important;
    }
    /* ONLY style the root shell container in App.tsx - never touch nested <main> like MyScreen */
    #root > main {
      background-color: #FFFFFF !important;
      padding: 0 !important;
      margin: 0 !important;
      width: 100% !important;
      height: 100% !important;
      min-height: 100% !important;
      max-height: 100% !important;
    }
    #root > main > div {
      max-width: 100% !important;
      width: 100% !important;
      height: 100% !important;
      border-radius: 0 !important;
      border: none !important;
      box-shadow: none !important;
    }
    /* Hide fake dynamic island notch and mock status bar */
    #root > main > div > div:first-child.pointer-events-none {
      display: none !important;
    }
    /* Hide fake bottom home indicator bar line */
    #root > main > div > div.pointer-events-none:last-child {
      display: none !important;
    }
    /* Elevate 5-tab navigation bar comfortably above phone home swipe indicator */
    nav {
      padding-bottom: ${bottomInset}px !important;
      background-color: #FFFFFF !important;
    }
    /* Elevate fixed bottom footers (e.g. in shop detail or sheet actions) */
    footer {
      padding-bottom: ${bottomInset}px !important;
      background-color: #FFFFFF !important;
    }
  `,
    [bottomInset]
  )

  const injectedJs = useMemo(
    () => `
    (function() {
      function injectStyle() {
        var existing = document.getElementById("raota-mobile-style");
        if (existing) {
          existing.innerHTML = ${JSON.stringify(injectedCss)};
          return;
        }
        var style = document.createElement("style");
        style.id = "raota-mobile-style";
        style.innerHTML = ${JSON.stringify(injectedCss)};
        document.head.appendChild(style);
      }
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", injectStyle);
      } else {
        injectStyle();
      }
      setTimeout(injectStyle, 200);
      setTimeout(injectStyle, 600);
      setTimeout(injectStyle, 1200);
    })();
    true;
  `,
    [injectedCss]
  )

  const [currentUrl, setCurrentUrl] = useState<string>(getDetectedDevUrl())
  const [canGoBack, setCanGoBack] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [inputUrl, setInputUrl] = useState(currentUrl)
  const [showDevPill, setShowDevPill] = useState(true)

  // Load custom URL if stored
  useEffect(() => {
    async function loadSavedUrl() {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY_CUSTOM_URL)
        if (saved) {
          setCurrentUrl(saved)
          setInputUrl(saved)
        }
      } catch (err) {
        console.warn("Failed to load saved webview url", err)
      }
    }
    void loadSavedUrl()
  }, [])

  // Android hardware back handler
  useEffect(() => {
    if (Platform.OS !== "android") return

    const onBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack()
        return true
      }
      return false
    }

    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress)
    return () => sub.remove()
  }, [canGoBack])

  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack)
    setIsLoading(navState.loading)
  }, [])

  const handleReload = useCallback(() => {
    setHasError(false)
    setIsLoading(true)
    webViewRef.current?.reload()
  }, [])

  const handleSaveUrl = useCallback(async () => {
    let clean = inputUrl.trim()
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
      clean = "http://" + clean
    }
    try {
      await AsyncStorage.setItem(STORAGE_KEY_CUSTOM_URL, clean)
      setCurrentUrl(clean)
      setShowSettingsModal(false)
      setHasError(false)
      setIsLoading(true)
    } catch (err) {
      Alert.alert("오류", "URL 저장 실패")
    }
  }, [inputUrl])

  const handleResetUrl = useCallback(async () => {
    const defaultUrl = getDetectedDevUrl()
    try {
      await AsyncStorage.removeItem(STORAGE_KEY_CUSTOM_URL)
      setCurrentUrl(defaultUrl)
      setInputUrl(defaultUrl)
      setShowSettingsModal(false)
      setHasError(false)
      setIsLoading(true)
    } catch (err) {
      Alert.alert("오류", "기본 URL 복원 실패")
    }
  }, [])

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Main WebView */}
      <WebView
        ref={webViewRef}
        source={{ uri: currentUrl }}
        injectedJavaScriptBeforeContentLoaded={injectedJs}
        injectedJavaScript={injectedJs}
        onNavigationStateChange={handleNavigationStateChange}
        onLoadStart={() => {
          setIsLoading(true)
          setHasError(false)
        }}
        onLoadEnd={() => setIsLoading(false)}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent
          console.warn("WebView error: ", nativeEvent)
          setHasError(true)
          setErrorMessage(nativeEvent.description || "연결 실패")
          setIsLoading(false)
        }}
        pullToRefreshEnabled={true}
        allowsBackForwardNavigationGestures={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        style={styles.webView}
      />

      {/* Loading Overlay */}
      {isLoading && !hasError && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <View style={styles.loadingCard}>
            <Text style={styles.brandTitle}>
              RAOTA<Text style={styles.brandDot}>.</Text>
            </Text>
            <ActivityIndicator size="small" color="#E60000" style={{ marginTop: 12 }} />
            <Text style={styles.loadingSubtitle}>Figma Make 불러오는 중...</Text>
          </View>
        </View>
      )}

      {/* Error Fallback Screen */}
      {hasError && (
        <View style={styles.errorContainer}>
          <View style={styles.errorIconWrap}>
            <WifiOff size={40} color="#E60000" />
          </View>
          <Text style={styles.errorTitle}>피그마 메이크 서버에 연결할 수 없습니다</Text>
          <Text style={styles.errorDescription}>
            Vite 개발 서버가 실행 중인지, 모바일 기기와 컴퓨터가 같은 Wi-Fi에 연결되어 있는지 확인해주세요.
          </Text>

          <View style={styles.urlBox}>
            <Globe size={16} color="#7E7E7E" />
            <Text style={styles.urlBoxText} numberOfLines={1}>
              {currentUrl}
            </Text>
          </View>

          <View style={styles.errorActions}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleReload}
              activeOpacity={0.8}
            >
              <RefreshCw size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>다시 연결 시도</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setShowSettingsModal(true)}
              activeOpacity={0.8}
            >
              <Settings size={18} color="#25282B" />
              <Text style={styles.secondaryButtonText}>서버 주소 변경</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.ghostButton}
              onPress={() => router.push("/native" as any)}
              activeOpacity={0.8}
            >
              <Layers size={18} color="#E60000" />
              <Text style={styles.ghostButtonText}>네이티브 모드로 둘러보기</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Floating Developer / Preview Tool Pill */}
      {showDevPill && !hasError && (
        <View style={[styles.floatingPill, { bottom: bottomInset + 56 + 12 }]}>
          <TouchableOpacity
            style={styles.pillAction}
            onPress={handleReload}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <RefreshCw size={14} color="#25282B" />
          </TouchableOpacity>

          <View style={styles.pillDivider} />

          <TouchableOpacity
            style={styles.pillAction}
            onPress={() => router.push("/native" as any)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Layers size={14} color="#E60000" />
            <Text style={styles.pillNativeText}>네이티브</Text>
          </TouchableOpacity>

          <View style={styles.pillDivider} />

          <TouchableOpacity
            style={styles.pillAction}
            onPress={() => setShowSettingsModal(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Settings size={14} color="#7E7E7E" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pillClose}
            onPress={() => setShowDevPill(false)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={12} color="#A0A0A0" />
          </TouchableOpacity>
        </View>
      )}

      {/* Settings / IP Modal */}
      <Modal
        visible={showSettingsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Vite 서버 연결 설정</Text>
              <TouchableOpacity
                onPress={() => setShowSettingsModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#25282B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalHelp}>
              컴퓨터의 로컬 IP(Wi-Fi IP)와 포트(8443)를 입력해주세요.
            </Text>

            <TextInput
              value={inputUrl}
              onChangeText={setInputUrl}
              placeholder="http://192.168.45.190:8443"
              placeholderTextColor="#A0A0A0"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.modalInput}
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalResetButton}
                onPress={handleResetUrl}
                activeOpacity={0.8}
              >
                <Text style={styles.modalResetText}>기본값</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleSaveUrl}
                activeOpacity={0.8}
              >
                <Text style={styles.modalSaveText}>적용하기</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalDivider} />

            <TouchableOpacity
              style={styles.modalNativeNavButton}
              onPress={() => {
                setShowSettingsModal(false)
                router.push("/native" as any)
              }}
              activeOpacity={0.8}
            >
              <Layers size={18} color="#E60000" />
              <Text style={styles.modalNativeNavText}>네이티브 모드로 열기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  webView: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  loadingCard: {
    alignItems: "center",
    padding: 24,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#25282B",
    letterSpacing: -0.5,
  },
  brandDot: {
    color: "#E60000",
  },
  loadingSubtitle: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: "500",
    color: "#7E7E7E",
  },
  errorContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    zIndex: 20,
  },
  errorIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FFF0F0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#25282B",
    textAlign: "center",
    marginBottom: 8,
  },
  errorDescription: {
    fontSize: 14,
    color: "#7E7E7E",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  urlBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7F8F9",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 24,
    gap: 8,
    maxWidth: "100%",
  },
  urlBoxText: {
    fontSize: 12,
    color: "#4B5563",
    fontWeight: "500",
  },
  errorActions: {
    width: "100%",
    gap: 10,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#E60000",
    height: 48,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F7F8F9",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    height: 48,
    borderRadius: 12,
  },
  secondaryButtonText: {
    color: "#25282B",
    fontSize: 15,
    fontWeight: "600",
  },
  ghostButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
  },
  ghostButtonText: {
    color: "#E60000",
    fontSize: 14,
    fontWeight: "700",
  },
  floatingPill: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
    zIndex: 99,
  },
  pillAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pillNativeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#E60000",
  },
  pillDivider: {
    width: 1,
    height: 12,
    backgroundColor: "#E5E7EB",
  },
  pillClose: {
    paddingLeft: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#25282B",
  },
  modalHelp: {
    fontSize: 13,
    color: "#7E7E7E",
    marginBottom: 16,
    lineHeight: 18,
  },
  modalInput: {
    height: 48,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 14,
    fontFamily: fonts.body,
    fontSize: 14,
    color: "#25282B",
    backgroundColor: "#F9FAFB",
    marginBottom: 16,
  },
  modalButtonRow: {
    flexDirection: "row",
    gap: 10,
  },
  modalResetButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  modalResetText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
  },
  modalSaveButton: {
    flex: 2,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#E60000",
    justifyContent: "center",
    alignItems: "center",
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  modalDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 16,
  },
  modalNativeNavButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  modalNativeNavText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#E60000",
  },
})
