import * as ImagePicker from "expo-image-picker"
import { router, useFocusEffect } from "expo-router"
import {
  Award,
  Bell,
  Bookmark,
  ChevronDown,
  ChevronRight,
  FileText,
  Flame,
  Heart,
  Lightbulb,
  MapPin,
  MessageSquare,
  PenLine,
  Search,
  Sparkles,
  Trash2,
  Trophy,
  UserRound,
  Utensils,
  X,
} from "lucide-react-native"
import { useCallback, useMemo, useState } from "react"
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text as NativeText,
  TextInput,
  View,
  type TextProps,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import type { ProfileUpdateInput, UserProfile } from "@raota/shared"
import { ResilientUriImage } from "@/src/components"
import { useRaota } from "@/src/state/RaotaStore"
import { colors, fonts } from "@/src/theme"

const RED = colors.brand
const INK = colors.text
const MUTED = colors.textMuted
const LINE = colors.border
const SOFT = colors.backgroundBasement

function Text({ style, ...props }: TextProps) {
  const resolvedStyle = StyleSheet.flatten(style)
  const readableSize =
    typeof resolvedStyle?.fontSize === "number" && resolvedStyle.fontSize < 11
      ? { fontSize: 11 }
      : null
  return (
    <NativeText
      {...props}
      style={[{ fontFamily: fonts.body }, style, readableSize]}
    />
  )
}

const RAMEN_STYLES = [
  "돈코츠 (돼지뼈)",
  "쇼유 (간장)",
  "토리파이탄 (닭백탕)",
  "시오 (소금)",
  "미소 (된장)",
  "츠케멘",
  "마제소바",
  "아부라소바",
]

export interface RamenActivityLevel {
  min: number
  title: string
  nextTarget: number | null
  desc: string
}

export const RAMEN_ACTIVITY_LEVELS: RamenActivityLevel[] = [
  { min: 0, title: "라멘 입문자", nextTarget: 1, desc: "첫 기록 전" },
  { min: 1, title: "라멘을 즐기는 자", nextTarget: 10, desc: "라멘로그 1개 이상" },
  { min: 10, title: "라멘집 탐험가", nextTarget: 30, desc: "라멘로그 10개 이상" },
  { min: 30, title: "라멘집 단골", nextTarget: 50, desc: "라멘로그 30개 이상" },
  { min: 50, title: "라멘 미식가", nextTarget: 100, desc: "라멘로그 50개 이상" },
  { min: 100, title: "라멘 마스터", nextTarget: null, desc: "라멘로그 100개 이상" },
]

export const getRamenActivityLevel = (logCount: number) => {
  const currentLevel =
    [...RAMEN_ACTIVITY_LEVELS]
      .reverse()
      .find((level) => logCount >= level.min) || RAMEN_ACTIVITY_LEVELS[0]
  const nextLevel = currentLevel.nextTarget
    ? RAMEN_ACTIVITY_LEVELS.find((level) => level.min === currentLevel.nextTarget)
    : null
  const progress = currentLevel.nextTarget
    ? Math.min(
        100,
        ((logCount - currentLevel.min) /
          (currentLevel.nextTarget - currentLevel.min)) *
          100,
      )
    : 100

  return { ...currentLevel, nextLevel, progress: Math.max(0, progress) }
}

const TABS = [
  { id: "logs", label: "라멘로그", icon: Utensils },
  { id: "visits", label: "방문매장", icon: MapPin },
  { id: "saved", label: "가고싶어요", icon: Bookmark },
  { id: "posts", label: "작성글", icon: FileText },
  { id: "comments", label: "댓글", icon: MessageSquare },
] as const
type ActivityTab = typeof TABS[number]["id"]
type PeriodType = "1y" | "2026" | "2025"

const RAOTA_THEME = ["#F2F2F2", "#FFD6D6", "#FFA8A8", "#FF5C5C", "#E60000"]

const DEMO_VISITED_SHOPS = [
  {
    id: 1,
    name: "멘야준",
    branch: "망원 본점",
    location: "서울 마포구 망원로",
    style: "특제 쇼유 라멘",
    tags: ["쇼유", "자가제면", "오리육수"],
    photo:
      "https://images.unsplash.com/photo-1742633882713-593c13e90231?w=300&h=300&fit=crop&auto=format&q=80",
    visitCount: 6,
    lastVisited: "2026. 09. 01",
    isRegular: true,
    bestMenu: "특제 쇼유 라멘",
  },
  {
    id: 3,
    name: "오레노라멘",
    branch: "마포 본점",
    location: "서울 마포구 독막로",
    style: "토리파이탄",
    tags: ["닭백탕", "미쉐린 빕구르망"],
    photo:
      "https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=300&h=300&fit=crop&auto=format&q=80",
    visitCount: 4,
    lastVisited: "2026. 08. 31",
    isRegular: true,
    bestMenu: "토리파이탄 라멘",
  },
  {
    id: 2,
    name: "세상끝의라멘",
    branch: "합정점",
    location: "서울 마포구 양화로",
    style: "블랙 쇼유 라멘",
    tags: ["오사카 블랙", "두툼한 차슈"],
    photo:
      "https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=300&h=300&fit=crop&auto=format&q=80",
    visitCount: 3,
    lastVisited: "2026. 08. 25",
    isRegular: true,
    bestMenu: "끝라멘 (특제)",
  },
  {
    id: 4,
    name: "하쿠텐 라멘",
    branch: "연남점",
    location: "서울 마포구 동교로",
    style: "이에케 라멘",
    tags: ["돈골간장", "시금치", "갓김치"],
    photo:
      "https://images.unsplash.com/photo-1742633882713-593c13e90231?w=300&h=300&fit=crop&auto=format&q=80",
    visitCount: 2,
    lastVisited: "2026. 08. 18",
    bestMenu: "이에케 라멘 (진하게)",
  },
  {
    id: 5,
    name: "라멘 무메이",
    branch: "상수 본점",
    location: "서울 마포구 와우산로",
    style: "시오 라멘",
    tags: ["해산물 육수", "깔끔함"],
    photo:
      "https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=300&h=300&fit=crop&auto=format&q=80",
    visitCount: 2,
    lastVisited: "2026. 08. 10",
    bestMenu: "특제 파이탄 시오",
  },
  {
    id: 6,
    name: "멘지",
    branch: "망원점",
    location: "서울 마포구 월드컵로",
    style: "토리파이탄",
    tags: ["자가제면", "닭 육수"],
    photo:
      "https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=300&h=300&fit=crop&auto=format&q=80",
    visitCount: 1,
    lastVisited: "2026. 07. 29",
    bestMenu: "파이탄 라멘",
  },
]

const DEMO_POSTS = [
  {
    id: 1,
    category: "맛집후기",
    title: "망원·합정 일대 인생 쇼유 라멘 3곳 추천합니다",
    content:
      "자가제면과 동물계 육수의 밸런스가 완벽한 곳들만 엄선했습니다. 1위는 역시 멘야준, 2위는 세상끝의라멘, 3위는 묘코입니다.",
    createdAt: "2026. 09. 01",
    likes: 42,
    comments: 3,
  },
  {
    id: 2,
    category: "라멘꿀팁",
    title: "오레노라멘 토리파이탄 면 추가(카에다마) 200% 즐기는 법",
    content:
      "국물이 1/3 남았을 때 카에다마를 요청하고 후추와 다시마 식초를 두 방울 떨어뜨리면 새로운 감칠맛이 열립니다.",
    createdAt: "2026. 08. 28",
    likes: 28,
    comments: 5,
  },
  {
    id: 3,
    category: "자유게시판",
    title: "오늘 하쿠텐 웨이팅 현황 공유 (평일 점심)",
    content:
      "11시 20분 도착 기준 대기 4팀 있었습니다. 회전율 빨라서 15분 만에 착석했네요. 이에케 기름 보통 추천!",
    createdAt: "2026. 08. 18",
    likes: 19,
    comments: 2,
  },
]

export function getCategoryBadgeColors(category?: string, label?: string) {
  const cat = (category || label || "").toUpperCase()
  if (cat.includes("REVIEW") || cat.includes("후기") || cat.includes("맛집")) {
    return { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0" }
  }
  if (cat.includes("TIP") || cat.includes("팁")) {
    return { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" }
  }
  if (cat.includes("QUESTION") || cat.includes("Q&A") || cat.includes("질문")) {
    return { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" }
  }
  if (cat.includes("POPULAR") || cat.includes("인기")) {
    return { bg: "#FEF2F2", text: "#E60000", border: "#FECACA" }
  }
  return { bg: "#F5F5F4", text: "#57534E", border: "#E7E5E4" }
}

const DEMO_COMMENTS = [
  {
    id: 1,
    targetTitle: "세상끝의라멘 처음 가보려는데 첫라멘 끝라멘 추천",
    targetAuthor: "라린이",
    comment:
      '쇼유 본연의 깊은 풍미를 원하시면 첫 방문엔 무조건 "끝라멘" 추천드립니다! 닭가슴살 차슈가 예술이에요.',
    createdAt: "2026. 09. 01",
    likes: 5,
  },
  {
    id: 2,
    targetTitle: "망원동 혼밥하기 좋은 라멘집 베스트",
    targetAuthor: "멘덕후",
    comment:
      "멘야준 닷지석이 넓고 조용해서 혼밥 난이도 최하입니다. 사장님도 엄청 친절하세요.",
    createdAt: "2026. 08. 25",
    likes: 3,
  },
  {
    id: 3,
    targetTitle: "이에케 라멘 간 조절 다들 어떻게 드시나요?",
    targetAuthor: "쇼유장인",
    comment:
      "저는 무조건 [맛 보통 / 기름 보통 / 면 단단하게]로 갑니다. 밥 시켜서 김 싸먹으면 극락!",
    createdAt: "2026. 08. 14",
    likes: 7,
  },
]

const DEMO_LOGS = [
  {
    shop: "멘야준",
    loc: "망원 본점",
    menu: "특제 쇼유 라멘",
    date: "09.01",
    score: 5,
    photo:
      "https://images.unsplash.com/photo-1742633882713-593c13e90231?w=200&h=200&fit=crop&auto=format&q=80",
    isNew: true,
  },
  {
    shop: "오레노라멘",
    loc: "마포 본점",
    menu: "특제 돈코츠 라멘",
    date: "08.28",
    score: 5,
    photo:
      "https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=200&h=200&fit=crop&auto=format&q=80",
  },
  {
    shop: "묘코",
    loc: "연남점",
    menu: "특제 쇼유 라멘",
    date: "08.22",
    score: 5,
    photo:
      "https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=200&h=200&fit=crop&auto=format&q=80",
  },
  {
    shop: "후쿠 라멘",
    loc: "합정점",
    menu: "특제 미소 라멘",
    date: "08.15",
    score: 4,
    photo:
      "https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=200&h=200&fit=crop&auto=format&q=80",
  },
]

function openShop(shopId: number) {
  router.push({
    pathname: "/shop/[shopId]",
    params: { shopId: String(shopId) },
  })
}

function ProfileSheet({
  user,
  visible,
  onClose,
  onSave,
}: {
  user: UserProfile
  visible: boolean
  onClose: () => void
  onSave: (input: ProfileUpdateInput) => Promise<void>
}) {
  const insets = useSafeAreaInsets()
  const [nickname, setNickname] = useState(user.nickname)
  const [email, setEmail] = useState(user.email ?? "")
  const [bio, setBio] = useState(user.bio ?? "")
  const [favorite, setFavorite] = useState(user.favoriteRamenType ?? "돈코츠 (돼지뼈)")
  const [avatar, setAvatar] = useState<string | null>(user.avatar)
  const [saving, setSaving] = useState(false)

  const chooseAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert(
        "사진 접근 권한이 필요해요",
        "프로필 사진을 바꾸려면 설정에서 사진 접근을 허용해주세요. 사진을 바꾸지 않고도 계속할 수 있어요.",
        [
          { text: "사진 없이 계속", style: "cancel" },
          { text: "설정 열기", onPress: () => Linking.openSettings() },
        ],
      )
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ["images"],
      quality: 0.82,
    })
    if (!result.canceled) setAvatar(result.assets[0].uri)
  }

  const save = async () => {
    if (!nickname.trim()) {
      Alert.alert(
        "닉네임을 입력해주세요",
        "라운지와 라멘로그에 표시할 이름이 필요해요.",
      )
      return
    }
    if (email && (!email.includes("@") || !email.includes("."))) {
      Alert.alert(
        "이메일을 확인해주세요",
        "예: ramen@raota.kr 형식으로 입력해주세요.",
      )
      return
    }
    setSaving(true)
    try {
      await onSave({
        nickname: nickname.trim(),
        email: email.trim(),
        bio: bio.trim(),
        favoriteRamenType: favorite,
        avatar,
      })
      onClose()
    } catch {
      Alert.alert(
        "프로필을 저장하지 못했어요",
        "사진 파일과 입력 내용을 확인한 뒤 다시 시도해주세요.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalRoot}
      >
        <View style={[styles.sheetHeader, { paddingTop: insets.top + 4 }]}>
          <Pressable
            accessibilityLabel="프로필 편집 닫기"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.modalIconButton}
          >
            <X color={INK} size={21} />
          </Pressable>
          <Text style={styles.sheetTitle}>프로필 편집</Text>
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={save}
            style={styles.saveHeaderButton}
          >
            <Text style={styles.saveHeaderText}>
              {saving ? "저장 중" : "저장"}
            </Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={[
            styles.sheetContent,
            { paddingBottom: insets.bottom + 28 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            accessibilityLabel="프로필 사진 변경"
            accessibilityRole="button"
            onPress={chooseAvatar}
            style={styles.avatarEdit}
          >
            {avatar ? (
              <ResilientUriImage
                accessibilityLabel="선택한 프로필 사진"
                fallback={<UserRound color="#FFFFFF" size={30} />}
                fallbackBackgroundColor={INK}
                fallbackTintColor="#FFFFFF"
                style={styles.avatarEditImage}
                uri={avatar}
              />
            ) : (
              <View style={styles.avatarEditFallback}>
                <UserRound color="#FFFFFF" size={30} />
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <PenLine color="#FFFFFF" size={13} />
            </View>
          </Pressable>
          <Text style={styles.avatarHelp}>
            사진을 눌러 프로필 이미지를 변경하세요
          </Text>

          <Text style={styles.fieldLabel}>닉네임</Text>
          <TextInput
            accessibilityLabel="닉네임"
            autoCapitalize="none"
            maxLength={16}
            onChangeText={setNickname}
            placeholder="닉네임"
            placeholderTextColor="#9DA1A5"
            style={styles.input}
            value={nickname}
          />
          <Text style={styles.fieldLabel}>이메일</Text>
          <TextInput
            accessibilityLabel="이메일"
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="ramen@raota.kr"
            placeholderTextColor="#9DA1A5"
            style={styles.input}
            value={email}
          />
          <Text style={styles.fieldLabel}>한 줄 소개</Text>
          <TextInput
            accessibilityLabel="한 줄 소개"
            maxLength={80}
            multiline
            onChangeText={setBio}
            placeholder="좋아하는 라멘 취향을 소개해주세요"
            placeholderTextColor="#9DA1A5"
            style={[styles.input, styles.textArea]}
            textAlignVertical="top"
            value={bio}
          />
          <Text style={styles.fieldLabel}>선호 라멘 스타일</Text>
          <View style={styles.styleGrid}>
            {RAMEN_STYLES.map((style) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: favorite === style }}
                key={style}
                onPress={() => setFavorite(style)}
                style={[
                  styles.styleChip,
                  favorite === style && styles.styleChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.styleChipText,
                    favorite === style && styles.styleChipTextActive,
                  ]}
                >
                  {style}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function GradeGuideModal({
  visible,
  onClose,
}: {
  visible: boolean
  onClose: () => void
}) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.guideOverlay}>
        <View style={styles.guideModalBox}>
          <View style={styles.guideModalHeader}>
            <View style={styles.guideHeaderTitleRow}>
              <Award color={RED} size={18} />
              <Text style={styles.guideModalTitle}>라멘 활동 등급 안내</Text>
            </View>
            <Pressable
              accessibilityLabel="닫기"
              accessibilityRole="button"
              onPress={onClose}
              style={styles.guideCloseButton}
            >
              <X color={INK} size={18} />
            </Pressable>
          </View>

          <Text style={styles.guideModalDesc}>
            작성한 라멘로그 누적 개수에 따라 등급이 자동으로 승급되며, 프로필 뱃지와 맞춤 취향 혜택이 부여됩니다.
          </Text>

          <View style={styles.guideTierList}>
            {RAMEN_ACTIVITY_LEVELS.map((tier, idx) => (
              <View key={tier.title} style={styles.guideTierRow}>
                <View style={styles.guideTierBadge}>
                  <Text style={styles.guideTierBadgeText}>Lv.{idx + 1}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.guideTierTitle}>{tier.title}</Text>
                  <Text style={styles.guideTierCriteria}>{tier.desc}</Text>
                </View>
                <Text style={styles.guideTierMin}>
                  {tier.nextTarget ? `${tier.min} ~ ${tier.nextTarget - 1}그릇` : "100그릇 이상"}
                </Text>
              </View>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={styles.guideConfirmButton}
          >
            <Text style={styles.guideConfirmText}>확인</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

function LoggedOutView({ top }: { top: number }) {
  return (
    <ScrollView
      contentContainerStyle={[styles.loggedOut, { paddingTop: top + 40 }]}
    >
      <View style={styles.loggedOutLogoWrap}>
        <Image
          source={require("@/assets/images/logo.png")}
          style={styles.loggedOutLogo}
        />
      </View>
      <Text style={styles.loggedOutWordmark}>
        RAOTA<Text style={styles.red}>.</Text>
      </Text>
      <Text style={styles.loggedOutTitle}>
        나만의 라멘 취향을{"\n"}한 그릇씩 발견해보세요
      </Text>
      <Text style={styles.loggedOutBody}>
        방문 기록을 모으면 취향 리포트와{"\n"}나에게 꼭 맞는 라멘집을
        추천해드려요.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/auth/login")}
        style={styles.loginPrimary}
      >
        <Text style={styles.loginPrimaryText}>로그인</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/auth/onboarding")}
        style={styles.joinSecondary}
      >
        <Text style={styles.joinSecondaryText}>처음이라면 회원가입</Text>
      </Pressable>
      <View style={styles.guestPerks}>
        <View style={styles.guestPerk}>
          <Sparkles color={RED} size={18} />
          <Text style={styles.guestPerkText}>월간 취향 리포트</Text>
        </View>
        <View style={styles.guestPerk}>
          <Bookmark color={RED} size={18} />
          <Text style={styles.guestPerkText}>가고 싶은 매장 저장</Text>
        </View>
        <View style={styles.guestPerk}>
          <Heart color={RED} size={18} />
          <Text style={styles.guestPerkText}>라오타 라운지 참여</Text>
        </View>
      </View>
    </ScrollView>
  )
}

export default function MyScreen() {
  const insets = useSafeAreaInsets()
  const {
    state,
    shops,
    currentUser,
    currentTasteReport,
    userLogs,
    unreadNotificationCount,
    actions,
  } = useRaota()

  const [activeTab, setActiveTab] = useState<ActivityTab>("logs")
  const [visitedShopSort, setVisitedShopSort] = useState<"count" | "recent" | "name">("count")
  const [visitedShopQuery, setVisitedShopQuery] = useState("")
  const [savedShopQuery, setSavedShopQuery] = useState("")
  const [period, setPeriod] = useState<PeriodType>("1y")
  const [selectedDay, setSelectedDay] = useState<{ date: string; count: number; level: number; shop?: string } | null>(null)
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false)
  const [isGradeGuideOpen, setIsGradeGuideOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useFocusEffect(
    useCallback(() => {
      NativeStatusBar.setBarStyle(
        currentUser?.isLoggedIn ? "light-content" : "dark-content",
        true,
      )
      return () => NativeStatusBar.setBarStyle("dark-content", true)
    }, [currentUser?.isLoggedIn]),
  )

  const totalLogCount = (currentUser?.visitedCount ?? 0) || userLogs.length || 42
  const conqueredCount = new Set(userLogs.map((l) => l.shop.id)).size || 28
  const reportProgress = Math.min(100, totalLogCount * 5 + 30) || 94

  const ramenActivityLevel = useMemo(
    () => getRamenActivityLevel(totalLogCount),
    [totalLogCount],
  )

  // Tab 2: Visited Shops
  const visitedShops = useMemo(() => {
    let list = DEMO_VISITED_SHOPS
    if (visitedShopQuery.trim()) {
      const q = visitedShopQuery.trim().toLowerCase()
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.branch.toLowerCase().includes(q) ||
          s.location.toLowerCase().includes(q) ||
          s.style.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q)),
      )
    }
    const copy = [...list]
    if (visitedShopSort === "count") {
      copy.sort((a, b) => b.visitCount - a.visitCount)
    } else if (visitedShopSort === "recent") {
      copy.sort((a, b) => b.lastVisited.localeCompare(a.lastVisited))
    } else if (visitedShopSort === "name") {
      copy.sort((a, b) => a.name.localeCompare(b.name, "ko"))
    }
    return copy
  }, [visitedShopQuery, visitedShopSort])

  // Tab 3: Saved Shops
  const savedShops = useMemo(() => {
    const list = shops.filter((s) => state.bookmarkedShopIds.includes(s.id))
    const displayList = list.length ? list : shops.slice(0, 4)
    if (!savedShopQuery.trim()) return displayList
    const q = savedShopQuery.trim().toLowerCase()
    return displayList.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.branch && s.branch.toLowerCase().includes(q)) ||
        s.address.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }, [savedShopQuery, shops, state.bookmarkedShopIds])

  // Heatmap Weeks Data (16 columns of 7 days with realistic dates and month labels)
  const heatmapWeeks = useMemo(() => {
    // 2026년 9월 5일 기준 직전 16주 (112일) 데이터
    const shopList = ["멘야준", "하쿠텐", "세상끝의라멘", "담택", "오레노라멘", "후쿠 라멘", "이리에라멘", "묘코", "멘지"]
    const baseLevels = [
      [0, 1, 0, 2, 0, 0, 1],
      [0, 0, 0, 1, 0, 2, 0],
      [1, 0, 2, 0, 0, 1, 0],
      [0, 0, 0, 0, 1, 0, 0],
      [0, 1, 0, 0, 2, 0, 1],
      [0, 0, 2, 0, 1, 0, 0],
      [1, 0, 0, 1, 0, 2, 0],
      [0, 2, 0, 0, 0, 1, 1],
      [0, 0, 1, 0, 2, 0, 0],
      [1, 0, 0, 2, 0, 1, 0],
      [0, 1, 0, 0, 1, 0, 2],
      [0, 0, 2, 0, 0, 1, 0],
      [1, 0, 0, 1, 2, 0, 0],
      [0, 2, 0, 0, 1, 0, 1],
      [1, 0, 1, 2, 0, 3, 0],
      [0, 1, 2, 0, 1, 4, 1],
    ]

    const endDate = new Date(2026, 8, 5) // 2026-09-05 (Sat)
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - (16 * 7 - 1)) // 112 days prior

    const weeks: { monthLabel?: string; days: { date: string; count: number; level: number; shop?: string }[] }[] = []
    let cur = new Date(startDate)
    let lastMonth = -1

    for (let w = 0; w < 16; w++) {
      const days = []
      let weekMonthLabel: string | undefined = undefined

      for (let d = 0; d < 7; d++) {
        const m = cur.getMonth() + 1
        const dt = cur.getDate()
        const y = cur.getFullYear()
        const dateStr = `${y}.${String(m).padStart(2, '0')}.${String(dt).padStart(2, '0')}`
        
        if (m !== lastMonth) {
          weekMonthLabel = `${m}월`
          lastMonth = m
        }

        const level = baseLevels[w % baseLevels.length][d]
        const count = level === 4 ? 3 : level === 3 ? 2 : level > 0 ? level : 0
        const shop = count > 0 ? shopList[(w * 7 + d) % shopList.length] : undefined

        days.push({
          date: dateStr,
          count,
          level,
          shop,
        })
        cur.setDate(cur.getDate() + 1)
      }
      weeks.push({ monthLabel: weekMonthLabel, days })
    }
    return weeks
  }, [])

  if (!currentUser?.isLoggedIn) return <LoggedOutView top={insets.top} />

  const confirmLogout = () => {
    Alert.alert(
      "로그아웃할까요?",
      "저장된 라멘 기록은 다음 로그인 때 다시 볼 수 있어요.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "로그아웃",
          onPress: () => {
            void actions.logout()
          },
        },
      ],
    )
  }

  const confirmWithdraw = () => {
    Alert.alert(
      "정말 탈퇴할까요?",
      "프로필과 로컬 기록, 저장한 사진이 모두 삭제됩니다. 이 작업은 되돌릴 수 없어요.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "회원 탈퇴",
          style: "destructive",
          onPress: () => {
            void actions.withdraw()
          },
        },
      ],
    )
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              setRefreshing(true)
              setTimeout(() => setRefreshing(false), 600)
            }}
            refreshing={refreshing}
            tintColor={RED}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 1. 상단 라멘 클럽 회원증 카드 (보더폰 딥 잉크 히어로 밴드) */}
        <View style={[styles.heroHeader, { paddingTop: insets.top + 16 }]}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroProfileGroup}>
              <Pressable
                accessibilityLabel="프로필 사진 편집"
                accessibilityRole="button"
                onPress={() => setProfileOpen(true)}
                style={styles.heroAvatarBox}
              >
                {currentUser.avatar ? (
                  <ResilientUriImage
                    accessibilityLabel={`${currentUser.nickname} 프로필 사진`}
                    fallback={<UserRound color="#FFFFFF" size={24} />}
                    fallbackBackgroundColor={INK}
                    fallbackTintColor="#FFFFFF"
                    style={styles.heroAvatar}
                    uri={currentUser.avatar}
                  />
                ) : (
                  <Image
                    source={require("@/assets/images/logo.png")}
                    style={styles.heroLogo}
                  />
                )}
              </Pressable>
              <View style={styles.heroNameCol}>
                <View style={styles.heroTitleRow}>
                  <Text style={styles.heroNickname}>{currentUser.nickname || "뿡"}</Text>
                  <View style={styles.heroLevelBadge}>
                    <Text style={styles.heroLevelBadgeText}>
                      {ramenActivityLevel.title}
                    </Text>
                  </View>
                </View>
                <Text style={styles.heroSubtitle}>RAOTA 라멘클럽 회원</Text>
              </View>
            </View>

            <View style={styles.heroRightActions}>
              <Pressable
                accessibilityLabel={`읽지 않은 알림 ${unreadNotificationCount}개`}
                accessibilityRole="button"
                onPress={() => router.push("/notifications")}
                style={styles.heroBellButton}
              >
                <Bell color="rgba(255,255,255,0.85)" size={18} />
                {unreadNotificationCount > 0 && (
                  <View style={styles.heroBellDot} />
                )}
              </Pressable>
              <View style={styles.heroMembershipBox}>
                <Text style={styles.heroMembershipLabel}>MEMBERSHIP</Text>
                <Text style={styles.heroMembershipNo}>
                  {currentUser.membershipNo || "#RT-0842"}
                </Text>
              </View>
            </View>
          </View>

          {/* 완식 통계 스펙 바 */}
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatBox}>
              <Text style={styles.heroStatLabel}>총 라멘로그</Text>
              <Text style={styles.heroStatValue}>{totalLogCount}그릇</Text>
            </View>
            <View style={styles.heroStatBox}>
              <Text style={styles.heroStatLabel}>정복 라멘집</Text>
              <Text style={[styles.heroStatValue, styles.textRed]}>{conqueredCount}곳</Text>
            </View>
            <Pressable
              accessibilityLabel="취향 리포트 열기"
              accessibilityRole="button"
              onPress={() => router.push("/taste")}
              style={styles.heroStatBox}
            >
              <Text style={styles.heroStatLabel}>취향 리포트 완성도</Text>
              <Text style={styles.heroStatValue}>{reportProgress}%</Text>
            </Pressable>
          </View>
        </View>

        {/* 2. 본문 컨텐츠 */}
        <View style={styles.mainContent}>
          {/* 🏆 라멘 활동 등급 & 등급 안내 카드 */}
          <View style={styles.cardContainer}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.kickerRed}>라멘 활동 등급</Text>
                <View style={styles.gradeTitleRow}>
                  <Text style={styles.gradeTitleText}>{ramenActivityLevel.title}</Text>
                  <Text style={styles.gradeLevelNumberText}>
                    (Lv.{RAMEN_ACTIVITY_LEVELS.findIndex((l) => l.title === ramenActivityLevel.title) + 1})
                  </Text>
                </View>
              </View>
              <Pressable
                accessibilityLabel="등급 안내 보기"
                accessibilityRole="button"
                onPress={() => setIsGradeGuideOpen(true)}
                style={styles.gradeGuideButton}
              >
                <Award color={RED} size={13} />
                <Text style={styles.gradeGuideButtonText}>등급 안내</Text>
              </Pressable>
            </View>

            {ramenActivityLevel.nextLevel ? (
              <View style={styles.gradeProgressWrap}>
                <View style={styles.gradeProgressHeader}>
                  <Text style={styles.gradeNextLabel}>
                    다음 등급: <Text style={styles.gradeNextTitle}>{ramenActivityLevel.nextLevel.title}</Text>
                  </Text>
                  <Text style={styles.gradeFraction}>
                    {totalLogCount} / {ramenActivityLevel.nextLevel.min}그릇 ({Math.round(ramenActivityLevel.progress)}%)
                  </Text>
                </View>
                <View style={styles.gradeTrack}>
                  <View
                    style={[
                      styles.gradeFill,
                      { width: `${ramenActivityLevel.progress}%` },
                    ]}
                  />
                </View>
                <Text style={styles.gradeRemaining}>
                  {ramenActivityLevel.nextLevel.title}까지 {ramenActivityLevel.nextLevel.min - totalLogCount}그릇 남았습니다.
                </Text>
              </View>
            ) : (
              <View style={styles.gradeMaxWrap}>
                <Text style={styles.gradeMaxText}>
                  ✨ 최고 등급인 라멘 마스터에 도달하셨습니다!
                </Text>
              </View>
            )}
          </View>

          {/* 취향 리포트 분석서 바로가기 카드 */}
          <Pressable
            accessibilityLabel="라멘 취향 리포트 열기"
            accessibilityRole="button"
            onPress={() => router.push("/taste")}
            style={({ pressed }) => [
              styles.cardContainer,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.tasteCardTop}>
              <View style={styles.tasteKickerWrap}>
                <Text style={styles.kickerRed}>라멘 취향 리포트</Text>
                <View style={styles.tasteBadge}>
                  <Text style={styles.tasteBadgeText}>누적 종합</Text>
                </View>
              </View>
              <Text style={styles.tasteLinkArrow}>취향 분석 열람 →</Text>
            </View>
            <Text style={styles.tasteTitle}>
              {currentTasteReport ? "진한 돈골파" : "진한 돈골파"}
            </Text>
            <Text numberOfLines={2} style={styles.tasteDesc}>
              {currentTasteReport?.quote ??
                "완식한 모든 라멘로그를 분석한 올타임 미각 DNA입니다. (매월 1일 월간호 자동 보관)"}
            </Text>
          </Pressable>

          {/* 🌟 마이 아카이브 5단 서브 탭 */}
          <ScrollView
            contentContainerStyle={styles.tabsRow}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id
              const count =
                id === "logs"
                  ? totalLogCount
                  : id === "visits"
                    ? DEMO_VISITED_SHOPS.length
                    : id === "saved"
                      ? savedShops.length
                      : id === "posts"
                        ? DEMO_POSTS.length
                        : DEMO_COMMENTS.length

              return (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  key={id}
                  onPress={() => setActiveTab(id)}
                  style={[styles.tabButton, active && styles.tabButtonActive]}
                >
                  <Icon
                    color={active ? "#FFFFFF" : "#78716C"}
                    size={14}
                  />
                  <Text
                    style={[styles.tabButtonText, active && styles.tabButtonTextActive]}
                  >
                    {label}
                  </Text>
                  <View
                    style={[styles.tabCountBadge, active && styles.tabCountBadgeActive]}
                  >
                    <Text
                      style={[
                        styles.tabCountText,
                        active && styles.tabCountTextActive,
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                </Pressable>
              )
            })}
          </ScrollView>

          {/* 탭 1: 🍜 라멘로그 */}
          {activeTab === "logs" && (
            <View style={styles.tabContentArea}>
              {/* 완식 캘린더 잔디 카드 */}
              <View style={styles.cardContainer}>
                <View style={styles.calendarCardHeader}>
                  <View style={styles.calendarTitleWrap}>
                    <Utensils color={RED} size={15} />
                    <Text style={styles.cardTitle}>라멘로그 캘린더</Text>
                  </View>
                  <View style={styles.calendarRightWrap}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setIsPeriodDropdownOpen((v) => !v)}
                      style={styles.periodPickerButton}
                    >
                      <Text style={styles.periodPickerText}>
                        {period === "1y" ? "최근 1년" : `${period}년`}
                      </Text>
                      <ChevronDown color="#78716C" size={12} />
                    </Pressable>
                    <View style={styles.bowlCountBadge}>
                      <Text style={styles.bowlCountBadgeText}>
                        {totalLogCount}그릇
                      </Text>
                    </View>
                  </View>
                </View>

                {isPeriodDropdownOpen && (
                  <View style={styles.periodDropdownMenu}>
                    {[
                      { label: "최근 1년", val: "1y" },
                      { label: "2026년", val: "2026" },
                      { label: "2025년", val: "2025" },
                    ].map((opt) => (
                      <Pressable
                        key={opt.val}
                        onPress={() => {
                          setPeriod(opt.val as PeriodType)
                          setIsPeriodDropdownOpen(false)
                        }}
                        style={[
                          styles.periodDropdownItem,
                          period === opt.val && styles.periodDropdownItemActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.periodDropdownText,
                            period === opt.val && styles.periodDropdownTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                {/* 가로 스크롤 잔디 영역 (요일 + 월 헤더 + 인터랙티브 셀) */}
                <View style={styles.calendarRowLayout}>
                  {/* 좌측 요일 라벨 열 */}
                  <View style={styles.calendarWeekdayCol}>
                    <View style={styles.calendarMonthHeaderSpacer} />
                    {["일", "월", "화", "수", "목", "금", "토"].map((dayName, idx) => (
                      <View key={dayName} style={styles.calendarWeekdayCell}>
                        <Text style={styles.calendarWeekdayText}>
                          {idx % 2 === 1 ? dayName : ""}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* 가로 스크롤 잔디 컬럼들 */}
                  <ScrollView
                    contentContainerStyle={styles.calendarGridScroll}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                  >
                    <View style={styles.calendarColumnsWrap}>
                      {heatmapWeeks.map((week, wIdx) => (
                        <View key={`week-${wIdx}`} style={styles.calendarCol}>
                          {/* 월 라벨 */}
                          <View style={styles.calendarMonthHeaderCell}>
                            <Text style={styles.calendarMonthHeaderText}>
                              {week.monthLabel || ""}
                            </Text>
                          </View>
                          {/* 7일 네모 칸 */}
                          {week.days.map((day, dIdx) => {
                            const isSelected = selectedDay?.date === day.date
                            return (
                              <Pressable
                                key={`day-${wIdx}-${dIdx}`}
                                accessibilityRole="button"
                                accessibilityLabel={`${day.date} ${day.count}그릇`}
                                onPress={() => setSelectedDay(day)}
                                style={[
                                  styles.calendarSquare,
                                  { backgroundColor: RAOTA_THEME[day.level] },
                                  isSelected && styles.calendarSquareSelected,
                                ]}
                              />
                            )
                          })}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {/* 툴팁: 선택한 날짜 기록 상세 */}
                {selectedDay && (
                  <View style={styles.calendarTooltipBubble}>
                    <Text style={styles.calendarTooltipText}>
                      📅 <Text style={styles.calendarTooltipDate}>{selectedDay.date}</Text> :{" "}
                      {selectedDay.count > 0 ? (
                        <Text style={styles.calendarTooltipBold}>
                          {selectedDay.count}그릇 완식 ✓{selectedDay.shop ? ` (${selectedDay.shop})` : ""}
                        </Text>
                      ) : (
                        <Text style={styles.calendarTooltipMuted}>기록 없음</Text>
                      )}
                    </Text>
                    <Pressable
                      accessibilityLabel="닫기"
                      onPress={() => setSelectedDay(null)}
                      hitSlop={8}
                      style={styles.calendarTooltipClose}
                    >
                      <X color="#78716C" size={12} />
                    </Pressable>
                  </View>
                )}

                {/* 하단 범례 바 */}
                <View style={styles.calendarLegendRow}>
                  <View style={styles.legendLeft}>
                    <Lightbulb color="#F59E0B" size={13} />
                    <Text style={styles.legendText}>
                      라멘로그를 작성하면 캘린더가 채워집니다.
                    </Text>
                  </View>
                  <View style={styles.legendRight}>
                    <Text style={styles.legendScaleText}>적음</Text>
                    <View style={styles.legendSquares}>
                      {RAOTA_THEME.map((color, i) => (
                        <View
                          key={`legend-${i}`}
                          style={[styles.legendBox, { backgroundColor: color }]}
                        />
                      ))}
                    </View>
                    <Text style={styles.legendScaleText}>많음</Text>
                  </View>
                </View>

                {/* 스트릭 뱃지 바 */}
                <View style={styles.streakGrid}>
                  <View style={styles.streakBox}>
                    <Text style={styles.streakLabel}>최장 연속 기록</Text>
                    <Text style={styles.streakValue}>
                      7일 연속 <Text style={styles.streakSub}>(2026.07)</Text>
                    </Text>
                  </View>
                  <View style={styles.streakBox}>
                    <Text style={styles.streakLabel}>현재 연속 기록</Text>
                    <Text style={styles.streakValue}>
                      3일 연속 <Text style={[styles.streakSub, { color: RED }]}>(진행 중 🔥)</Text>
                    </Text>
                  </View>
                </View>
              </View>

              {/* 최근 마이 라멘로그 카드 */}
              <View style={[styles.cardContainer, styles.recentLogsCard]}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>최근 마이 라멘로그</Text>
                  <Text style={styles.cardSubtitle}>최근 기록</Text>
                </View>
                <View style={styles.logList}>
                  {DEMO_LOGS.map((log, i) => (
                    <Pressable
                      key={`log-${i}`}
                      accessibilityRole="button"
                      onPress={() => router.push("/shop/1")}
                      style={styles.logItemRow}
                    >
                      <ResilientUriImage
                        accessibilityLabel={`${log.menu} 사진`}
                        style={styles.logItemPhoto}
                        uri={log.photo}
                      />
                      <View style={styles.flex}>
                        <View style={styles.logItemTitleRow}>
                          <Text numberOfLines={1} style={styles.logItemShop}>
                            {log.shop} · {log.loc}
                          </Text>
                          {log.isNew && (
                            <View style={styles.newBadge}>
                              <Text style={styles.newBadgeText}>신규</Text>
                            </View>
                          )}
                        </View>
                        <Text numberOfLines={1} style={styles.logItemMenu}>
                          {log.menu}
                        </Text>
                      </View>
                      <Text style={styles.logItemDate}>{log.date}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* 탭 2: 📍 방문매장 */}
          {activeTab === "visits" && (
            <View style={styles.tabContentArea}>
              <View style={styles.cardContainer}>
                <View style={styles.cardHeaderCol}>
                  <View style={styles.visitHeaderTop}>
                    <View>
                      <Text style={styles.cardTitle}>
                        라멘로그 정복 라멘집 ({visitedShops.length}곳)
                      </Text>
                      <Text style={styles.cardSubtitle}>
                        라멘로그를 남긴 매장 아카이브
                      </Text>
                    </View>
                    <View style={styles.sortPillsGroup}>
                      {[
                        { key: "count", label: "방문순" },
                        { key: "recent", label: "최신순" },
                        { key: "name", label: "이름순" },
                      ].map((s) => (
                        <Pressable
                          key={s.key}
                          accessibilityRole="button"
                          onPress={() => setVisitedShopSort(s.key as any)}
                          style={[
                            styles.sortPill,
                            visitedShopSort === s.key && styles.sortPillActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.sortPillText,
                              visitedShopSort === s.key && styles.sortPillTextActive,
                            ]}
                          >
                            {s.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={styles.searchBar}>
                    <Search color="#999DA1" size={14} />
                    <TextInput
                      accessibilityLabel="방문 라멘집 검색"
                      onChangeText={setVisitedShopQuery}
                      placeholder="방문한 라멘집 검색 (이름, 지점, 지역...)"
                      placeholderTextColor="#999DA1"
                      style={styles.searchInput}
                      value={visitedShopQuery}
                    />
                    {visitedShopQuery ? (
                      <Pressable
                        accessibilityLabel="검색 지우기"
                        onPress={() => setVisitedShopQuery("")}
                        style={styles.searchClear}
                      >
                        <Text style={styles.searchClearText}>✕</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                <View style={styles.shopList}>
                  {visitedShops.map((shop) => (
                    <Pressable
                      key={`visit-${shop.id}`}
                      accessibilityRole="button"
                      onPress={() => openShop(shop.id)}
                      style={styles.shopItemRow}
                    >
                      <ResilientUriImage
                        accessibilityLabel={`${shop.name} 대표 사진`}
                        style={styles.shopItemPhoto}
                        uri={shop.photo}
                      />
                      <View style={styles.flex}>
                        <View style={styles.shopTitleRow}>
                          <Text numberOfLines={1} style={styles.shopItemName}>
                            {shop.name} {shop.branch ? `· ${shop.branch}` : ""}
                          </Text>
                          {shop.isRegular && (
                            <View style={styles.regularBadge}>
                              <Text style={styles.regularBadgeText}>단골</Text>
                              <Trophy color="#B45309" size={10} />
                            </View>
                          )}
                        </View>
                        <View style={styles.shopLocationRow}>
                          <MapPin color="#A8ACAF" size={11} />
                          <Text numberOfLines={1} style={styles.shopLocationText}>
                            {shop.location}
                          </Text>
                        </View>
                        <Text numberOfLines={1} style={styles.shopBestMenu}>
                          대표: {shop.bestMenu}
                        </Text>
                      </View>
                      <View style={styles.shopMetaRight}>
                        <Text style={styles.visitCountBadgeText}>
                          {shop.visitCount}회 기록 ✓
                        </Text>
                        <Text style={styles.lastVisitedText}>
                          {shop.lastVisited}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* 탭 3: 🔖 가고싶어요 */}
          {activeTab === "saved" && (
            <View style={styles.tabContentArea}>
              <View style={styles.cardContainer}>
                <View style={styles.cardHeaderCol}>
                  <View>
                    <Text style={styles.cardTitle}>
                      가고 싶어요 저장 매장 ({savedShops.length}곳)
                    </Text>
                    <Text style={styles.cardSubtitle}>
                      관심 있는 라멘집을 저장해두고 언제든 찾아보세요
                    </Text>
                  </View>
                  <View style={styles.searchBar}>
                    <Search color="#999DA1" size={14} />
                    <TextInput
                      accessibilityLabel="저장 매장 검색"
                      onChangeText={setSavedShopQuery}
                      placeholder="저장한 매장명, 지역, 스타일 검색..."
                      placeholderTextColor="#999DA1"
                      style={styles.searchInput}
                      value={savedShopQuery}
                    />
                    {savedShopQuery ? (
                      <Pressable
                        accessibilityLabel="검색 지우기"
                        onPress={() => setSavedShopQuery("")}
                        style={styles.searchClear}
                      >
                        <Text style={styles.searchClearText}>✕</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                <View style={styles.shopList}>
                  {savedShops.map((shop) => (
                    <View key={`saved-${shop.id}`} style={styles.savedItemRow}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => openShop(shop.id)}
                        style={styles.savedItemLeft}
                      >
                        <ResilientUriImage
                          accessibilityLabel={`${shop.name} 사진`}
                          style={styles.shopItemPhoto}
                          uri={shop.photos[0]}
                        />
                        <View style={styles.flex}>
                          <View style={styles.shopTitleRow}>
                            <Text numberOfLines={1} style={styles.shopItemName}>
                              {shop.name}
                            </Text>
                            {shop.branch ? (
                              <Text style={styles.shopBranchText}>
                                {shop.branch}
                              </Text>
                            ) : null}
                          </View>
                          <Text numberOfLines={1} style={styles.savedItemStyle}>
                            {shop.address.split(" ")[1] ?? "서울"} · {shop.tags[0] ?? "라멘"}
                          </Text>
                          <View style={styles.tagsMiniRow}>
                            {shop.tags.slice(0, 3).map((tag, idx) => (
                              <View key={idx} style={styles.tagMiniChip}>
                                <Text style={styles.tagMiniText}>#{tag}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      </Pressable>

                      <View style={styles.savedItemActions}>
                        <Pressable
                          accessibilityLabel="저장 해제"
                          accessibilityRole="button"
                          onPress={() => actions.toggleBookmark(shop.id)}
                          style={styles.savedBookmarkIcon}
                        >
                          <Bookmark color={RED} fill={RED} size={17} />
                        </Pressable>
                        <Pressable
                          accessibilityLabel="상세보기"
                          accessibilityRole="button"
                          onPress={() => openShop(shop.id)}
                          style={styles.savedDetailButton}
                        >
                          <Text style={styles.savedDetailButtonText}>
                            상세보기 →
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* 탭 4: ✍️ 작성글 */}
          {activeTab === "posts" && (
            <View style={styles.tabContentArea}>
              <View style={styles.cardContainer}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>
                    내가 작성한 커뮤니티 글 ({DEMO_POSTS.length})
                  </Text>
                  <Text style={styles.cardSubtitle}>최신순</Text>
                </View>
                <View style={styles.postList}>
                  {DEMO_POSTS.map((post) => (
                    <Pressable
                      key={`post-${post.id}`}
                      accessibilityRole="button"
                      onPress={() => router.push("/native/lounge")}
                      style={styles.postItemRow}
                    >
                      <View style={styles.postMetaRow}>
                        {(() => {
                          const catColors = getCategoryBadgeColors(post.category)
                          return (
                            <View style={[styles.postCategoryBadge, { backgroundColor: catColors.bg }]}>
                              <Text style={[styles.postCategoryText, { color: catColors.text }]}>
                                {post.category}
                              </Text>
                            </View>
                          )
                        })()}
                        <Text style={styles.postDateText}>{post.createdAt}</Text>
                      </View>
                      <Text style={styles.postTitleText}>{post.title}</Text>
                      <Text numberOfLines={2} style={styles.postContentText}>
                        {post.content}
                      </Text>
                      <View style={styles.postStatsRow}>
                        <View style={styles.postStatItem}>
                          <Heart color={RED} fill={RED} size={12} />
                          <Text style={styles.postLikeCount}>{post.likes}</Text>
                        </View>
                        <View style={styles.postStatItem}>
                          <MessageSquare color="#A8ACAF" size={12} />
                          <Text style={styles.postCommentCount}>
                            {post.comments}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* 탭 5: 💬 댓글 */}
          {activeTab === "comments" && (
            <View style={styles.tabContentArea}>
              <View style={styles.cardContainer}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>
                    내가 남긴 댓글 ({DEMO_COMMENTS.length})
                  </Text>
                  <Text style={styles.cardSubtitle}>최신순</Text>
                </View>
                <View style={styles.commentList}>
                  {DEMO_COMMENTS.map((c) => (
                    <Pressable
                      key={`comment-${c.id}`}
                      accessibilityRole="button"
                      onPress={() => router.push("/native/lounge")}
                      style={styles.commentItemRow}
                    >
                      <View style={styles.commentTargetBox}>
                        <Text numberOfLines={1} style={styles.commentTargetText}>
                          원문: <Text style={styles.commentTargetTitle}>{c.targetTitle}</Text> ({c.targetAuthor})
                        </Text>
                      </View>
                      <Text style={styles.commentBodyText}>"{c.comment}"</Text>
                      <View style={styles.commentFooterRow}>
                        <Text style={styles.commentDateText}>{c.createdAt}</Text>
                        <View style={styles.postStatItem}>
                          <Heart color={RED} fill={RED} size={12} />
                          <Text style={styles.postLikeCount}>{c.likes}</Text>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* ⚙️ 계정 및 회원 관리 카드 */}
          <View style={styles.cardContainer}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>계정 설정 & 멤버십</Text>
              <Text style={styles.accountVersionText}>v1.0.0</Text>
            </View>
            <View style={styles.accountBody}>
              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>연동 계정</Text>
                <View style={styles.accountValueGroup}>
                  <Text numberOfLines={1} style={styles.accountValueText}>
                    {currentUser.email || "bbung@raota.net"}
                  </Text>
                  <Pressable
                    accessibilityLabel="연동 계정 변경"
                    accessibilityRole="button"
                    onPress={() => setProfileOpen(true)}
                    style={styles.accountButton}
                  >
                    <Text style={styles.accountButtonText}>변경</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>선호 스타일</Text>
                <View style={styles.accountValueGroup}>
                  <Text style={styles.accountFavoriteText}>
                    {currentUser.favoriteRamenType || "돈코츠 (돼지뼈)"}
                  </Text>
                  <Pressable
                    accessibilityLabel="선호 스타일 변경"
                    accessibilityRole="button"
                    onPress={() => setProfileOpen(true)}
                    style={styles.accountButton}
                  >
                    <Text style={styles.accountButtonText}>변경</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.accountLogoutWrap}>
                <Pressable
                  accessibilityLabel="로그아웃"
                  accessibilityRole="button"
                  onPress={confirmLogout}
                  style={styles.accountLogoutButton}
                >
                  <Text style={styles.accountLogoutText}>로그아웃</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <Pressable
            accessibilityLabel="회원 탈퇴"
            accessibilityRole="button"
            onPress={confirmWithdraw}
            style={styles.withdrawButton}
          >
            <Text style={styles.withdrawButtonText}>회원 탈퇴</Text>
          </Pressable>

          {/* 초슬림 미니멀 푸터 */}
          <View style={styles.myFooter}>
            <View style={styles.myFooterLinks}>
              <Text style={styles.myFooterLink}>이용약관</Text>
              <Text style={styles.myFooterDot}>·</Text>
              <Text style={styles.myFooterLink}>개인정보처리방침</Text>
              <Text style={styles.myFooterDot}>·</Text>
              <Text style={styles.myFooterLink}>문의하기</Text>
            </View>
            <Text style={styles.myFooterCopy}>
              © 2026 RAOTA · 라멘에 진심인 사람들
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* 프로필 편집 모달 */}
      <ProfileSheet
        key={`${currentUser.id}-${profileOpen ? "open" : "closed"}`}
        onClose={() => setProfileOpen(false)}
        onSave={async (input) => {
          await actions.updateProfile(input)
        }}
        user={currentUser}
        visible={profileOpen}
      />

      {/* 등급 안내 모달 */}
      <GradeGuideModal
        onClose={() => setIsGradeGuideOpen(false)}
        visible={isGradeGuideOpen}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  flex: { flex: 1, minWidth: 0 },
  textRed: { color: RED },
  red: { color: RED },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  scrollContent: { paddingBottom: 16 },

  // Hero Header
  heroHeader: {
    backgroundColor: INK,
    paddingBottom: 22,
    paddingHorizontal: 20,
    borderBottomColor: "#1A1C1E",
    borderBottomWidth: 1,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroProfileGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    flex: 1,
  },
  heroAvatarBox: {
    width: 56,
    height: 56,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    padding: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  heroAvatar: { width: 50, height: 50, borderRadius: 4 },
  heroLogo: { width: 38, height: 38, resizeMode: "contain" },
  heroNameCol: { flex: 1, minWidth: 0 },
  heroTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  heroNickname: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  heroLevelBadge: {
    backgroundColor: RED,
    borderRadius: 32,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  heroLevelBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    marginTop: 3,
  },
  heroRightActions: {
    alignItems: "flex-end",
    gap: 6,
  },
  heroBellButton: {
    position: "relative",
    padding: 6,
  },
  heroBellDot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: RED,
    borderWidth: 2,
    borderColor: INK,
  },
  heroMembershipBox: {
    alignItems: "flex-end",
  },
  heroMembershipLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 9,
    fontWeight: "800",
    fontFamily: fonts.body,
    letterSpacing: 0.8,
  },
  heroMembershipNo: {
    color: RED,
    fontSize: 14,
    fontWeight: "900",
  },
  heroStatsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
    paddingTop: 16,
    borderTopColor: "rgba(255,255,255,0.1)",
    borderTopWidth: 1,
  },
  heroStatBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingVertical: 9,
    borderRadius: 4,
    alignItems: "center",
  },
  heroStatLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 9.5,
    fontWeight: "600",
  },
  heroStatValue: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontWeight: "900",
    marginTop: 3,
  },

  // Main Content
  mainContent: {
    padding: 18,
    gap: 14,
  },
  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: LINE,
    padding: 16,
  },
  recentLogsCard: {
    paddingBottom: 8,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomColor: LINE,
    borderBottomWidth: 1,
    paddingBottom: 10,
    marginBottom: 10,
  },
  cardHeaderCol: {
    borderBottomColor: LINE,
    borderBottomWidth: 1,
    paddingBottom: 12,
    marginBottom: 8,
    gap: 10,
  },
  cardTitle: {
    color: INK,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    color: "#7E7E7E",
    fontSize: 10.5,
    marginTop: 2,
  },
  kickerRed: {
    color: RED,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Grade Card
  gradeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  gradeTitleText: {
    color: INK,
    fontSize: 16,
    fontWeight: "900",
  },
  gradeLevelNumberText: {
    color: "#A8ACAF",
    fontSize: 11,
    fontWeight: "700",
  },
  gradeGuideButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 4,
    backgroundColor: SOFT,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  gradeGuideButtonText: {
    color: INK,
    fontSize: 11,
    fontWeight: "900",
  },
  gradeProgressWrap: {
    paddingTop: 8,
    gap: 6,
  },
  gradeProgressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  gradeNextLabel: {
    color: "#78716C",
    fontSize: 11,
  },
  gradeNextTitle: {
    color: INK,
    fontWeight: "800",
  },
  gradeFraction: {
    color: RED,
    fontSize: 11,
    fontWeight: "900",
  },
  gradeTrack: {
    height: 7,
    backgroundColor: "#F0F0F2",
    borderRadius: 4,
    overflow: "hidden",
  },
  gradeFill: {
    height: "100%",
    backgroundColor: RED,
    borderRadius: 4,
  },
  gradeRemaining: {
    color: "#A8ACAF",
    fontSize: 10,
    textAlign: "right",
  },
  gradeMaxWrap: {
    paddingTop: 8,
  },
  gradeMaxText: {
    color: "#78716C",
    fontSize: 11,
    fontWeight: "700",
  },

  // Taste Card
  tasteCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomColor: LINE,
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: 8,
  },
  tasteKickerWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tasteBadge: {
    backgroundColor: "rgba(230,0,0,0.1)",
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tasteBadgeText: {
    color: RED,
    fontSize: 9.5,
    fontWeight: "800",
  },
  tasteLinkArrow: {
    color: INK,
    fontSize: 11,
    fontWeight: "700",
  },
  tasteTitle: {
    color: INK,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  tasteDesc: {
    color: "#7E7E7E",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  // 5 Sub Tabs Row
  tabsRow: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 2,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabButtonActive: {
    backgroundColor: INK,
    borderColor: INK,
  },
  tabButtonText: {
    color: "#78716C",
    fontSize: 11.5,
    fontWeight: "800",
  },
  tabButtonTextActive: {
    color: "#FFFFFF",
  },
  tabCountBadge: {
    backgroundColor: SOFT,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tabCountBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  tabCountText: {
    color: "#78716C",
    fontSize: 10,
    fontWeight: "900",
  },
  tabCountTextActive: {
    color: "#FFFFFF",
  },
  tabContentArea: {
    gap: 14,
  },

  // Calendar
  calendarCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomColor: LINE,
    borderBottomWidth: 1,
    paddingBottom: 9,
    marginBottom: 10,
  },
  calendarTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  calendarRightWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  periodPickerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: SOFT,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  periodPickerText: {
    color: INK,
    fontSize: 10.5,
    fontWeight: "700",
  },
  bowlCountBadge: {
    backgroundColor: "rgba(230,0,0,0.1)",
    borderRadius: 32,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  bowlCountBadgeText: {
    color: RED,
    fontSize: 10,
    fontWeight: "800",
  },
  periodDropdownMenu: {
    backgroundColor: "#FFFFFF",
    borderColor: LINE,
    borderWidth: 1,
    borderRadius: 4,
    marginBottom: 10,
    padding: 4,
    gap: 2,
  },
  periodDropdownItem: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 3,
  },
  periodDropdownItemActive: {
    backgroundColor: "rgba(230,0,0,0.08)",
  },
  periodDropdownText: {
    color: INK,
    fontSize: 11,
    fontWeight: "600",
  },
  periodDropdownTextActive: {
    color: RED,
    fontWeight: "900",
  },
  calendarGridScroll: {
    paddingVertical: 4,
  },
  calendarColumnsWrap: {
    flexDirection: "row",
    gap: 3,
  },
  calendarCol: {
    flexDirection: "column",
    gap: 3,
  },
  calendarSquare: {
    width: 14,
    height: 14,
    borderRadius: 2,
  },
  calendarLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopColor: LINE,
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 8,
  },
  legendLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  legendText: {
    color: "#7E7E7E",
    fontSize: 9.5,
  },
  legendRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendScaleText: {
    color: "#7E7E7E",
    fontSize: 9.5,
  },
  legendSquares: {
    flexDirection: "row",
    gap: 2,
  },
  legendBox: {
    width: 9,
    height: 9,
    borderRadius: 2,
  },
  streakGrid: {
    flexDirection: "row",
    gap: 8,
    borderTopColor: LINE,
    borderTopWidth: 1,
    borderStyle: "dashed",
    marginTop: 10,
    paddingTop: 10,
  },
  // Heatmap Enhancements
  calendarRowLayout: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  calendarWeekdayCol: {
    width: 18,
    marginRight: 4,
    alignItems: "center",
  },
  calendarMonthHeaderSpacer: {
    height: 16,
    marginBottom: 4,
  },
  calendarWeekdayCell: {
    height: 14,
    marginBottom: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  calendarWeekdayText: {
    color: "#A8A29E",
    fontSize: 9,
    fontWeight: "600",
  },
  calendarMonthHeaderCell: {
    height: 16,
    marginBottom: 4,
    justifyContent: "center",
  },
  calendarMonthHeaderText: {
    color: "#78716C",
    fontSize: 9,
    fontWeight: "700",
  },
  calendarSquareSelected: {
    borderColor: "#25282B",
    borderWidth: 1.5,
  },
  calendarTooltipBubble: {
    backgroundColor: "#F5F5F4",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  calendarTooltipText: {
    fontSize: 11,
    color: "#25282B",
  },
  calendarTooltipDate: {
    fontWeight: "700",
    color: "#25282B",
  },
  calendarTooltipBold: {
    fontWeight: "800",
    color: RED,
  },
  calendarTooltipMuted: {
    color: "#78716C",
  },
  calendarTooltipClose: {
    padding: 2,
  },
  streakSub: {
    fontSize: 10,
    fontWeight: "600",
    color: "#78716C",
  },

  // My Page Footer
  myFooter: {
    alignItems: "center",
    marginTop: 18,
    marginBottom: 10,
    paddingVertical: 10,
  },
  myFooterLinks: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 5,
  },
  myFooterLink: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#78716C",
  },
  myFooterDot: {
    fontSize: 10.5,
    color: LINE,
  },
  myFooterCopy: {
    fontSize: 9.5,
    color: "#A8A29E",
  },

  streakBox: {
    flex: 1,
    backgroundColor: SOFT,
    borderRadius: 4,
    paddingVertical: 7,
    alignItems: "center",
  },
  streakLabel: {
    color: "#7E7E7E",
    fontSize: 9,
  },
  streakValue: {
    color: INK,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 2,
  },

  // Log List
  logList: {
    gap: 12,
  },
  logItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 4,
  },
  logItemPhoto: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: SOFT,
    borderWidth: 1,
    borderColor: LINE,
  },
  logItemTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  logItemShop: {
    color: INK,
    fontSize: 13,
    fontWeight: "900",
  },
  newBadge: {
    backgroundColor: "rgba(230,0,0,0.1)",
    borderRadius: 32,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  newBadgeText: {
    color: RED,
    fontSize: 9,
    fontWeight: "800",
  },
  logItemMenu: {
    color: "#7E7E7E",
    fontSize: 11,
    marginTop: 2,
  },
  logItemDate: {
    color: "#7E7E7E",
    fontSize: 11,
    fontWeight: "700",
  },

  // Visited Tab
  visitHeaderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  sortPillsGroup: {
    flexDirection: "row",
    backgroundColor: SOFT,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: LINE,
    padding: 2,
    gap: 2,
  },
  sortPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 3,
  },
  sortPillActive: {
    backgroundColor: INK,
  },
  sortPillText: {
    color: "#78716C",
    fontSize: 9.5,
    fontWeight: "700",
  },
  sortPillTextActive: {
    color: "#FFFFFF",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F8F9",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: LINE,
    paddingHorizontal: 10,
    height: 36,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    color: INK,
    fontSize: 11.5,
    paddingVertical: 0,
  },
  searchClear: {
    padding: 4,
  },
  searchClearText: {
    color: "#999DA1",
    fontSize: 12,
  },
  shopList: {
    gap: 12,
  },
  shopItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 6,
    borderBottomColor: "#F4F4F5",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  shopItemPhoto: {
    width: 52,
    height: 52,
    borderRadius: 6,
    backgroundColor: SOFT,
    borderWidth: 1,
    borderColor: LINE,
  },
  shopTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  shopItemName: {
    color: INK,
    fontSize: 13,
    fontWeight: "900",
  },
  regularBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  regularBadgeText: {
    color: "#B45309",
    fontSize: 9,
    fontWeight: "900",
  },
  shopLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  shopLocationText: {
    color: "#78716C",
    fontSize: 10.5,
  },
  shopBestMenu: {
    color: RED,
    fontSize: 10.5,
    fontWeight: "700",
    marginTop: 2,
  },
  shopMetaRight: {
    alignItems: "flex-end",
  },
  visitCountBadgeText: {
    color: RED,
    fontSize: 12,
    fontWeight: "900",
  },
  lastVisitedText: {
    color: "#A8ACAF",
    fontSize: 9.5,
    marginTop: 2,
    fontFamily: fonts.body,
  },

  // Saved Tab
  savedItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomColor: "#F4F4F5",
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  savedItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    flex: 1,
  },
  shopBranchText: {
    color: "#A8ACAF",
    fontSize: 10.5,
    fontWeight: "700",
  },
  savedItemStyle: {
    color: "#78716C",
    fontSize: 11,
    marginTop: 2,
  },
  tagsMiniRow: {
    flexDirection: "row",
    gap: 4,
    marginTop: 4,
    flexWrap: "wrap",
  },
  tagMiniChip: {
    backgroundColor: SOFT,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tagMiniText: {
    color: "#57534E",
    fontSize: 9,
    fontWeight: "700",
  },
  savedItemActions: {
    alignItems: "flex-end",
    gap: 6,
  },
  savedBookmarkIcon: {
    padding: 4,
  },
  savedDetailButton: {
    backgroundColor: SOFT,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  savedDetailButtonText: {
    color: "#57534E",
    fontSize: 10.5,
    fontWeight: "700",
  },

  // Posts Tab
  postList: {
    gap: 14,
  },
  postItemRow: {
    paddingVertical: 6,
    borderBottomColor: "#F4F4F5",
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  postMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  postCategoryBadge: {
    backgroundColor: SOFT,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  postCategoryText: {
    color: "#57534E",
    fontSize: 9.5,
    fontWeight: "700",
  },
  postDateText: {
    color: "#A8ACAF",
    fontSize: 10,
  },
  postTitleText: {
    color: INK,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18,
  },
  postContentText: {
    color: "#78716C",
    fontSize: 11.5,
    lineHeight: 17,
  },
  postStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  postStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  postLikeCount: {
    color: RED,
    fontSize: 11,
    fontWeight: "800",
  },
  postCommentCount: {
    color: "#78716C",
    fontSize: 11,
    fontWeight: "700",
  },

  // Comments Tab
  commentList: {
    gap: 14,
  },
  commentItemRow: {
    paddingVertical: 6,
    borderBottomColor: "#F4F4F5",
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 5,
  },
  commentTargetBox: {
    backgroundColor: "#F7F7F8",
    borderColor: "#EAEAEA",
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  commentTargetText: {
    color: "#78716C",
    fontSize: 10,
    fontWeight: "700",
  },
  commentTargetTitle: {
    color: INK,
  },
  commentBodyText: {
    color: INK,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 18,
  },
  commentFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  commentDateText: {
    color: "#A8ACAF",
    fontSize: 10.5,
  },

  // Account Card
  accountVersionText: {
    color: "#A8ACAF",
    fontFamily: fonts.body,
    fontSize: 10,
  },
  accountBody: {
    gap: 4,
    paddingTop: 4,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 40,
  },
  accountLabel: {
    color: "#78716C",
    fontSize: 12,
    fontWeight: "600",
  },
  accountValueGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  accountValueText: {
    color: INK,
    fontSize: 12,
    fontWeight: "800",
    maxWidth: 160,
  },
  accountFavoriteText: {
    color: RED,
    fontSize: 12,
    fontWeight: "900",
  },
  accountButton: {
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 4,
    backgroundColor: SOFT,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  accountButtonText: {
    color: INK,
    fontSize: 10.5,
    fontWeight: "800",
  },
  accountLogoutWrap: {
    borderTopColor: "#F4F4F5",
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 10,
  },
  accountLogoutButton: {
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 4,
    backgroundColor: SOFT,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
  },
  accountLogoutText: {
    color: "#57534E",
    fontSize: 11.5,
    fontWeight: "800",
  },
  withdrawButton: {
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  withdrawButtonText: {
    color: "#A8ACAF",
    fontSize: 11,
    textDecorationLine: "underline",
  },

  // Modals
  guideOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  guideModalBox: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 20,
    gap: 12,
  },
  guideModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomColor: LINE,
    borderBottomWidth: 1,
    paddingBottom: 10,
  },
  guideHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  guideModalTitle: {
    color: INK,
    fontSize: 15,
    fontWeight: "900",
  },
  guideCloseButton: {
    padding: 4,
  },
  guideModalDesc: {
    color: "#78716C",
    fontSize: 11,
    lineHeight: 16,
  },
  guideTierList: {
    gap: 8,
    paddingVertical: 4,
  },
  guideTierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FAFAFA",
    borderRadius: 4,
    padding: 8,
  },
  guideTierBadge: {
    backgroundColor: RED,
    borderRadius: 14,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  guideTierBadgeText: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontWeight: "900",
  },
  guideTierTitle: {
    color: INK,
    fontSize: 12,
    fontWeight: "800",
  },
  guideTierCriteria: {
    color: "#A8ACAF",
    fontSize: 10,
  },
  guideTierMin: {
    color: RED,
    fontSize: 10,
    fontWeight: "800",
  },
  guideConfirmButton: {
    backgroundColor: INK,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    marginTop: 6,
  },
  guideConfirmText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  // Profile Modal
  modalRoot: { backgroundColor: "#FFFFFF", flex: 1 },
  sheetHeader: {
    alignItems: "center",
    borderBottomColor: LINE,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 62,
    paddingHorizontal: 8,
    paddingBottom: 7,
  },
  modalIconButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  sheetTitle: { color: INK, fontSize: 16, fontWeight: "900" },
  saveHeaderButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    minWidth: 58,
    paddingHorizontal: 8,
  },
  saveHeaderText: { color: RED, fontSize: 12, fontWeight: "900" },
  sheetContent: { padding: 20 },
  avatarEdit: { alignSelf: "center", marginTop: 8, position: "relative" },
  avatarEditImage: { borderRadius: 44, height: 88, width: 88 },
  avatarEditFallback: {
    alignItems: "center",
    backgroundColor: INK,
    borderRadius: 44,
    height: 88,
    justifyContent: "center",
    width: 88,
  },
  avatarEditBadge: {
    alignItems: "center",
    backgroundColor: RED,
    borderColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 2,
    bottom: 0,
    height: 31,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    width: 31,
  },
  avatarHelp: {
    color: MUTED,
    fontSize: 10,
    marginBottom: 18,
    marginTop: 9,
    textAlign: "center",
  },
  fieldLabel: {
    color: INK,
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 7,
    marginTop: 14,
  },
  input: {
    borderColor: LINE,
    borderRadius: 5,
    borderWidth: 1,
    color: INK,
    fontSize: 13,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  textArea: { height: 92 },
  styleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  styleChip: {
    alignItems: "center",
    borderColor: LINE,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: 13,
  },
  styleChipActive: { backgroundColor: INK, borderColor: INK },
  styleChipText: { color: MUTED, fontSize: 11, fontWeight: "700" },
  styleChipTextActive: { color: "#FFFFFF", fontWeight: "900" },

  // Logged Out
  loggedOut: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    flexGrow: 1,
    paddingBottom: 100,
    paddingHorizontal: 28,
  },
  loggedOutLogoWrap: {
    alignItems: "center",
    backgroundColor: INK,
    borderRadius: 12,
    height: 96,
    justifyContent: "center",
    width: 96,
  },
  loggedOutLogo: { height: 67, width: 67 },
  loggedOutWordmark: {
    color: INK,
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -1.2,
    marginTop: 20,
  },
  loggedOutTitle: {
    color: INK,
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: -0.7,
    lineHeight: 31,
    marginTop: 16,
    textAlign: "center",
  },
  loggedOutBody: {
    color: MUTED,
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 12,
    textAlign: "center",
  },
  loginPrimary: {
    alignItems: "center",
    backgroundColor: RED,
    borderRadius: 25,
    justifyContent: "center",
    marginTop: 28,
    minHeight: 50,
    width: "100%",
  },
  loginPrimaryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  joinSecondary: {
    alignItems: "center",
    borderColor: INK,
    borderRadius: 25,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 9,
    minHeight: 50,
    width: "100%",
  },
  joinSecondaryText: { color: INK, fontSize: 13, fontWeight: "900" },
  guestPerks: {
    alignSelf: "stretch",
    borderTopColor: LINE,
    borderTopWidth: 1,
    gap: 13,
    marginTop: 30,
    paddingTop: 22,
  },
  guestPerk: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    minHeight: 34,
  },
  guestPerkText: { color: "#50555A", fontSize: 11.5, fontWeight: "700" },
})
