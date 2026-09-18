import { useMemo, useState } from "react"
import { router } from "expo-router"
import {
  Bell,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  Settings2,
  Store,
  Trophy,
  X,
} from "lucide-react-native"
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native"

import type {
  AppNotification,
  NotificationSettings,
  NotificationType,
} from "@raota/shared"
import { useRaota } from "@/src/state/RaotaStore"
import {
  FlowHeader,
  FlowPage,
  Text,
  flowStyles,
  palette,
} from "./_layout"

type TabFilter = "all" | "activity" | "shop" | "system"

const TABS: Array<{
  id: TabFilter
  label: string
}> = [
  { id: "all", label: "전체" },
  { id: "activity", label: "활동" },
  { id: "shop", label: "관심 라멘집" },
  { id: "system", label: "승급·공지" },
]

const SETTINGS_LIST: Array<{
  key: keyof NotificationSettings
  label: string
  description: string
}> = [
  {
    key: "likesEnabled",
    label: "공감",
    description: "내 라멘로그 및 게시글 공감 소식",
  },
  {
    key: "commentsEnabled",
    label: "댓글과 답글",
    description: "내 활동에 달린 새로운 댓글 알림",
  },
  {
    key: "levelUpEnabled",
    label: "등급 소식",
    description: "기록 누적에 따른 승급 소식",
  },
  {
    key: "shopNewsEnabled",
    label: "관심 매장",
    description: "저장한 라멘집의 신메뉴·영업 공지",
  },
]

export default function NotificationsScreen() {
  const { state, unreadNotificationCount, actions } = useRaota()
  const [tab, setTab] = useState<TabFilter>("all")
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const notifications = useMemo(() => {
    if (tab === "activity")
      return state.notifications.filter(
        (item) => item.type === "like" || item.type === "comment",
      )
    if (tab === "shop")
      return state.notifications.filter((item) => item.type === "shop")
    if (tab === "system")
      return state.notifications.filter(
        (item) => item.type === "level" || item.type === "notice",
      )
    return state.notifications
  }, [tab, state.notifications])

  const unreadByTab = useMemo(
    () => ({
      all: unreadNotificationCount,
      activity: state.notifications.filter(
        (n) => !n.isRead && (n.type === "like" || n.type === "comment"),
      ).length,
      shop: state.notifications.filter((n) => !n.isRead && n.type === "shop").length,
      system: state.notifications.filter(
        (n) => !n.isRead && (n.type === "level" || n.type === "notice"),
      ).length,
    }),
    [state.notifications, unreadNotificationCount],
  )

  const openNotification = (item: AppNotification) => {
    if (!item.isRead) actions.markNotificationRead(item.id)

    if (item.targetScreen === "shop" && item.targetShopId) {
      router.push({
        pathname: "/shop/[shopId]",
        params: { shopId: String(item.targetShopId) },
      })
      return
    }
    if (item.targetScreen === "community-post" && item.targetPostId) {
      router.push({
        pathname: "/community/[postId]",
        params: { postId: String(item.targetPostId) },
      })
      return
    }
    if (item.targetScreen === "taste" && item.targetReportId) {
      router.push({
        pathname: "/taste/[reportId]",
        params: { reportId: item.targetReportId },
      })
      return
    }

    const targetRoutes: Record<
      string,
      "/native/lounge" | "/native/my" | "/native/news" | "/native/map" | "/taste"
    > = {
      lounge: "/native/lounge",
      my: "/native/my",
      news: "/native/news",
      map: "/native/map",
      taste: "/taste",
    }
    const route = item.targetScreen ? targetRoutes[item.targetScreen] : undefined
    if (route) {
      router.push(route)
      return
    }

    if (item.type === "comment" || item.type === "like") router.push("/native/lounge")
    else if (item.type === "level") router.push("/taste")
    else if (item.type === "shop" && item.targetShopId) {
      router.push({
        pathname: "/shop/[shopId]",
        params: { shopId: String(item.targetShopId) },
      })
    } else router.push("/native/news")
  }

  const updateSetting = (key: keyof NotificationSettings, value: boolean) => {
    actions.updateNotificationSettings({
      ...state.notificationSettings,
      [key]: value,
    })
  }

  const renderIcon = (type: NotificationType) => {
    switch (type) {
      case "like":
        return (
          <View style={[styles.iconBox, styles.iconBoxLike]}>
            <Heart color={palette.red} fill={palette.red} size={15} />
          </View>
        )
      case "comment":
        return (
          <View style={[styles.iconBox, styles.iconBoxComment]}>
            <MessageCircle color="#2563EB" size={15} />
          </View>
        )
      case "shop":
        return (
          <View style={[styles.iconBox, styles.iconBoxShop]}>
            <Store color="#D97706" size={15} />
          </View>
        )
      case "level":
        return (
          <View style={[styles.iconBox, styles.iconBoxLevel]}>
            <Trophy color="#9333EA" size={15} />
          </View>
        )
      default:
        return (
          <View style={[styles.iconBox, styles.iconBoxNotice]}>
            <Bell color="#57534E" size={15} />
          </View>
        )
    }
  }

  const renderBadge = (type: NotificationType, isRead: boolean) => {
    const label =
      type === "like"
        ? "공감"
        : type === "comment"
        ? "댓글"
        : type === "shop"
        ? "라멘집"
        : type === "level"
        ? "승급"
        : "공지"

    if (isRead) {
      return (
        <View style={styles.badgeRead}>
          <Text style={styles.badgeReadText}>{label}</Text>
        </View>
      )
    }

    switch (type) {
      case "like":
        return (
          <View style={[styles.badgeUnread, styles.badgeLike]}>
            <Text style={[styles.badgeUnreadText, { color: palette.red }]}>{label}</Text>
          </View>
        )
      case "comment":
        return (
          <View style={[styles.badgeUnread, styles.badgeComment]}>
            <Text style={[styles.badgeUnreadText, { color: "#2563EB" }]}>{label}</Text>
          </View>
        )
      case "shop":
        return (
          <View style={[styles.badgeUnread, styles.badgeShop]}>
            <Text style={[styles.badgeUnreadText, { color: "#B45309" }]}>{label}</Text>
          </View>
        )
      case "level":
        return (
          <View style={[styles.badgeUnread, styles.badgeLevel]}>
            <Text style={[styles.badgeUnreadText, { color: "#7E22CE" }]}>{label}</Text>
          </View>
        )
      default:
        return (
          <View style={[styles.badgeUnread, styles.badgeNotice]}>
            <Text style={[styles.badgeUnreadText, { color: "#44403C" }]}>{label}</Text>
          </View>
        )
    }
  }

  const getEmptyMessage = () => {
    switch (tab) {
      case "activity":
        return {
          title: "활동 알림이 없습니다",
          desc: "라멘로그를 작성하고 라멘러들과 소통하면 알림이 도착합니다.",
        }
      case "shop":
        return {
          title: "관심 라멘집 소식이 없습니다",
          desc: "자주 가는 라멘집을 저장하면 신메뉴와 계절 한정 소식을 받아볼 수 있습니다.",
        }
      case "system":
        return {
          title: "새로운 시스템 알림이 없습니다",
          desc: "활동 등급 승급 및 서비스 주요 업데이트 소식이 여기에 표시됩니다.",
        }
      default:
        return {
          title: "도착한 알림이 없습니다",
          desc: "새로운 라멘로그 반응이나 관심 매장의 소식이 생기면 알려드릴게요.",
        }
    }
  }

  return (
    <FlowPage>
      {/* 1. 상단 네비게이션 헤더 */}
      <FlowHeader
        title="알림"
        right={
          <View style={styles.headerRightRow}>
            {unreadNotificationCount > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="모두 읽음"
                onPress={actions.markAllNotificationsRead}
                style={styles.markAllButton}
              >
                <CheckCheck color={palette.red} size={15} />
                <Text style={styles.markAllText}>모두 읽음</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="알림 설정"
              onPress={() => setIsSettingsOpen(true)}
              style={styles.settingsIconButton}
            >
              <Settings2 color="#25282B" size={19} />
            </Pressable>
          </View>
        }
      />

      {/* 2. 카테고리 필터 탭 (Pills with top-right red dot for unread) */}
      <View style={styles.tabBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScroll}
        >
          {TABS.map((t) => {
            const isActive = tab === t.id
            const unreadInTab = unreadByTab[t.id]
            return (
              <Pressable
                key={t.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                onPress={() => setTab(t.id)}
                style={[styles.tabChip, isActive ? styles.tabChipActive : styles.tabChipNormal]}
              >
                <Text style={[styles.tabChipText, isActive && styles.tabChipTextActive]}>
                  {t.label}
                </Text>
                {unreadInTab > 0 && <View style={styles.tabRedDot} />}
              </Pressable>
            )
          })}
        </ScrollView>
      </View>

      {/* 3. 알림 아이템 목록 피드 */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconCircle}>
              <Bell color="#A8A29E" size={26} />
            </View>
            <Text style={styles.emptyTitle}>{getEmptyMessage().title}</Text>
            <Text style={styles.emptyDesc}>{getEmptyMessage().desc}</Text>
          </View>
        }
        renderItem={({ item }) => {
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.title}, ${item.content}`}
              onPress={() => openNotification(item)}
              style={({ pressed }) => [
                styles.notificationItem,
                !item.isRead && styles.notificationItemUnread,
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={styles.itemLeftCol}>
                {renderIcon(item.type)}
                <View style={styles.itemBodyCol}>
                  <View style={styles.itemTitleRow}>
                    {renderBadge(item.type, item.isRead)}
                    <Text
                      numberOfLines={1}
                      style={[styles.itemTitle, !item.isRead && styles.itemTitleUnread]}
                    >
                      {item.title}
                    </Text>
                  </View>
                  <Text numberOfLines={2} style={styles.itemContent}>
                    {item.content}
                  </Text>
                </View>
              </View>
              <Text style={styles.itemTimeText}>{item.time}</Text>
            </Pressable>
          )
        }}
      />

      {/* 4. 알림 수신 설정 바텀 시트 모달 */}
      <Modal
        animationType="slide"
        transparent
        visible={isSettingsOpen}
        onRequestClose={() => setIsSettingsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setIsSettingsOpen(false)} />
          <View style={styles.sheetContent}>
            {/* 드래그 핸들 */}
            <View style={styles.sheetHandleWrap}>
              <View style={styles.sheetHandle} />
            </View>

            {/* 헤더 */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleGroup}>
                <Bell color={palette.red} size={18} />
                <Text style={styles.sheetTitle}>알림 수신 설정</Text>
              </View>
              <Pressable
                accessibilityLabel="설정 창 닫기"
                onPress={() => setIsSettingsOpen(false)}
                hitSlop={8}
                style={styles.sheetCloseButton}
              >
                <X color="#78716C" size={19} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.sheetBody}>
              <Text style={styles.sheetDescription}>
                라오타에서 수신하고 싶은 푸시 알림 항목을 설정할 수 있습니다.
              </Text>

              {/* 마스터 푸시 알림 카드 */}
              <View style={styles.masterPushCard}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.masterPushTitle}>앱 푸시 알림 받기</Text>
                  <Text style={styles.masterPushSubtitle}>
                    라오타의 모든 주요 알림을 기기로 수신합니다.
                  </Text>
                </View>
                <Switch
                  accessibilityLabel="푸시 알림 알림"
                  ios_backgroundColor="#E7E5E4"
                  trackColor={{ false: "#E7E5E4", true: palette.red }}
                  value={state.notificationSettings.pushEnabled}
                  onValueChange={(val) => updateSetting("pushEnabled", val)}
                />
              </View>

              {/* 세부 알림 토글 목록 */}
              <View style={styles.settingsSubList}>
                {SETTINGS_LIST.map((item, idx) => {
                  const disabled = !state.notificationSettings.pushEnabled
                  return (
                    <View
                      key={item.key}
                      style={[styles.subSettingRow, idx > 0 && styles.subSettingRowBorder]}
                    >
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text
                          style={[styles.subSettingLabel, disabled && styles.subSettingDisabled]}
                        >
                          {item.label}
                        </Text>
                        <Text
                          style={[styles.subSettingDesc, disabled && styles.subSettingDisabled]}
                        >
                          {item.description}
                        </Text>
                      </View>
                      <Switch
                        accessibilityLabel={`${item.label} 알림`}
                        disabled={disabled}
                        ios_backgroundColor="#E7E5E4"
                        trackColor={{ false: "#E7E5E4", true: palette.red }}
                        value={state.notificationSettings[item.key]}
                        onValueChange={(val) => updateSetting(item.key, val)}
                      />
                    </View>
                  )
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </FlowPage>
  )
}

const styles = StyleSheet.create({
  headerRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  markAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  markAllText: {
    color: palette.red,
    fontSize: 11.5,
    fontWeight: "800",
  },
  settingsIconButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  // Tabs
  tabBar: {
    backgroundColor: "#FFFFFF",
    borderBottomColor: "#EAEAEA",
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  tabScroll: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: "center",
  },
  tabChip: {
    position: "relative",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  tabChipNormal: {
    backgroundColor: "#F5F5F4",
  },
  tabChipActive: {
    backgroundColor: "#25282B",
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#57534E",
  },
  tabChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  tabRedDot: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.red,
  },

  // Notification items
  listContent: {
    paddingBottom: 32,
    backgroundColor: "#FFFFFF",
  },
  notificationItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomColor: "#F0F0F2",
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: "#FFFFFF",
  },
  notificationItemUnread: {
    backgroundColor: "#FFEFEF",
  },
  itemLeftCol: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    flex: 1,
    paddingRight: 10,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  iconBoxLike: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  iconBoxComment: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  iconBoxShop: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  iconBoxLevel: {
    backgroundColor: "#FAF5FF",
    borderColor: "#E9D5FF",
  },
  iconBoxNotice: {
    backgroundColor: "#F5F5F4",
    borderColor: "#E7E5E4",
  },
  itemBodyCol: {
    flex: 1,
    gap: 3,
  },
  itemTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#44403C",
    flex: 1,
  },
  itemTitleUnread: {
    fontWeight: "900",
    color: "#1C1D21",
  },
  itemContent: {
    fontSize: 12,
    lineHeight: 17,
    color: "#78716C",
  },
  itemTimeText: {
    fontSize: 10,
    color: "#A8A29E",
    marginTop: 2,
  },

  // Type Badges
  badgeRead: {
    backgroundColor: "#F5F5F4",
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  badgeReadText: {
    color: "#A8A29E",
    fontSize: 9.5,
    fontWeight: "700",
  },
  badgeUnread: {
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  badgeUnreadText: {
    fontSize: 9.5,
    fontWeight: "800",
  },
  badgeLike: { backgroundColor: "#FEE2E2" },
  badgeComment: { backgroundColor: "#DBEAFE" },
  badgeShop: { backgroundColor: "#FEF3C7" },
  badgeLevel: { backgroundColor: "#F3E8FF" },
  badgeNotice: { backgroundColor: "#E7E5E4" },

  // Empty state
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#F5F5F4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#25282B",
  },
  emptyDesc: {
    fontSize: 12,
    color: "#A8A29E",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 260,
  },

  // Modal / Bottom Sheet
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheetContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "82%",
    paddingBottom: 28,
  },
  sheetHandleWrap: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 4,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D6D3D1",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomColor: "#F5F5F4",
    borderBottomWidth: 1,
  },
  sheetTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#25282B",
  },
  sheetCloseButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetBody: {
    padding: 20,
    gap: 14,
  },
  sheetDescription: {
    fontSize: 12,
    color: "#78716C",
    lineHeight: 17,
  },
  masterPushCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FAFAF9",
    borderColor: "#E7E5E4",
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
  },
  masterPushTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#25282B",
  },
  masterPushSubtitle: {
    fontSize: 11,
    color: "#78716C",
    marginTop: 2,
  },
  settingsSubList: {
    backgroundColor: "#FAFAF9",
    borderRadius: 10,
    borderColor: "#E7E5E4",
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  subSettingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
  },
  subSettingRowBorder: {
    borderTopColor: "#F5F5F4",
    borderTopWidth: 1,
  },
  subSettingLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#25282B",
  },
  subSettingDesc: {
    fontSize: 11,
    color: "#78716C",
    marginTop: 2,
  },
  subSettingDisabled: {
    opacity: 0.45,
  },
})
