import { useEffect, useMemo, useRef, useState } from "react"
import { router, useLocalSearchParams, useNavigation } from "expo-router"
import { Image } from "expo-image"
import * as ImagePicker from "expo-image-picker"
import DateTimePicker from "@react-native-community/datetimepicker"
import {
  Camera,
  ChevronDown,
  ImagePlus,
  MapPin,
  Trash2,
} from "lucide-react-native"
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native"

import {
  RAMEN_TYPES,
  REVISIT_OPTIONS,
  TASTE_FIELDS,
  type CreateRamenLogInput,
  type RevisitOption,
  type TasteNoteKey,
  type TasteNotes,
} from "@raota/shared"
import { useRaota } from "@/src/state/RaotaStore"
import { firstRecordValidationMessage } from "@/src/domain"
import {
  ActionButton,
  FlowHeader,
  FlowPage,
  FlowScroll,
  InlineNotice,
  SelectChip,
  flowStyles,
  palette,
} from "../_layout"

const MENU_OPTIONS: Record<number, string[]> = {
  1: ["특제 쇼유 라멘", "반숙 쇼유 라멘", "시오 라멘"],
  2: ["특제 삿포로 미소 라멘", "매운 미소 라멘", "차슈 미소 라멘"],
  3: ["토리파이탄 라멘", "카라파이탄 라멘", "쇼유 라멘"],
  4: ["농후 이에케 라멘", "매운 이에케 라멘", "특제 이에케 라멘"],
}

const EMPTY_TASTE: TasteNotes = {
  broth: [],
  noodle: [],
  seasoning: [],
  topping: [],
}

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export default function NewRecordScreen() {
  const { shopId } = useLocalSearchParams<{ shopId?: string }>()
  const navigation = useNavigation()
  const { state, getShop, actions } = useRaota()
  const parsedShopId = Number(shopId)
  const initialShopId = Number.isFinite(parsedShopId) ? parsedShopId : null
  const selectedShopId = state.recordDraft?.shopId ?? initialShopId
  const shop = selectedShopId ? getShop(selectedShopId) : undefined
  const menus = shop
    ? (MENU_OPTIONS[shop.id] ?? [
        `${shop.tags[0] ?? "대표"} 라멘`,
        "특제 라멘",
        "기본 라멘",
      ])
    : []

  const initialVisitDate = useRef(new Date()).current
  const initialMenuName = useRef(menus[0] ?? "").current
  const initialRamenType = useRef(
    shop?.tags.find((tag) => RAMEN_TYPES.includes(tag)) ?? "쇼유",
  ).current
  const initialRevisit: RevisitOption = "자주 감"

  const [photo, setPhoto] = useState<string | null>(null)
  const [visitDate, setVisitDate] = useState(initialVisitDate)
  const [menuName, setMenuName] = useState(initialMenuName)
  const [customMenu, setCustomMenu] = useState("")
  const [isCustomMenu, setIsCustomMenu] = useState(false)
  const [ramenType, setRamenType] = useState(initialRamenType)
  const [revisit, setRevisit] = useState<RevisitOption>(initialRevisit)
  const [tasteNotes, setTasteNotes] = useState<TasteNotes>(EMPTY_TASTE)
  const [note, setNote] = useState("")
  const [isPublic, setIsPublic] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const allowLeave = useRef(false)
  const previousShopId = useRef(selectedShopId)

  const effectiveMenu = isCustomMenu ? customMenu.trim() : menuName
  const isDirty = Boolean(
    photo ||
      note ||
      customMenu ||
      isCustomMenu ||
      selectedShopId !== initialShopId ||
      menuName !== initialMenuName ||
      ramenType !== initialRamenType ||
      formatDate(visitDate) !== formatDate(initialVisitDate) ||
      revisit !== initialRevisit ||
      !isPublic ||
      Object.values(tasteNotes).some((items) => items.length),
  )

  useEffect(() => {
    actions.startRecordDraft(initialShopId)
  }, [actions.startRecordDraft, initialShopId])

  useEffect(() => {
    if (previousShopId.current === selectedShopId) return
    previousShopId.current = selectedShopId
    const nextMenus = shop
      ? (MENU_OPTIONS[shop.id] ?? [
          `${shop.tags[0] ?? "대표"} 라멘`,
          "특제 라멘",
          "기본 라멘",
        ])
      : []
    setMenuName(nextMenus[0] ?? "")
    setCustomMenu("")
    setIsCustomMenu(false)
    setRamenType(
      shop?.tags.find((tag) => RAMEN_TYPES.includes(tag)) ?? "쇼유",
    )
  }, [selectedShopId, shop])

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (!isDirty || allowLeave.current) {
        actions.clearRecordDraft()
        return
      }
      event.preventDefault()
      Alert.alert(
        "기록 작성을 그만둘까요?",
        "입력한 내용은 저장되지 않습니다.",
        [
          { text: "계속 작성", style: "cancel" },
          {
            text: "나가기",
            style: "destructive",
            onPress: () => {
              allowLeave.current = true
              actions.clearRecordDraft()
              navigation.dispatch(event.data.action)
            },
          },
        ],
      )
    })
    return unsubscribe
  }, [actions.clearRecordDraft, isDirty, navigation])

  const openSettingsAlert = (kind: string) => {
    Alert.alert(
      `${kind} 권한이 필요해요`,
      `설정에서 ${kind} 접근을 허용하거나 사진 없이 기록을 계속할 수 있어요.`,
      [
        { text: "나중에", style: "cancel" },
        { text: "설정 열기", onPress: () => Linking.openSettings() },
      ],
    )
  }

  const pickPhoto = async (source: "camera" | "library") => {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      openSettingsAlert(source === "camera" ? "카메라" : "사진")
      return
    }
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            quality: 0.84,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            quality: 0.84,
          })
    const uri = !result.canceled ? result.assets[0]?.uri : undefined
    if (!uri) return
    setPhoto(uri)
  }

  const showPhotoMenu = () => {
    Alert.alert("라멘 사진 추가", "사진을 가져올 방법을 선택하세요.", [
      { text: "카메라로 촬영", onPress: () => void pickPhoto("camera") },
      { text: "사진 보관함", onPress: () => void pickPhoto("library") },
      { text: "취소", style: "cancel" },
    ])
  }

  const toggleTaste = (key: TasteNoteKey, option: string) => {
    setTasteNotes((current) => ({
      ...current,
      [key]: current[key].includes(option)
        ? current[key].filter((item) => item !== option)
        : [...current[key], option],
    }))
  }

  const validationMessage = useMemo(
    () =>
      firstRecordValidationMessage({
        shopId: shop?.id,
        menuName: effectiveMenu,
        ramenType,
        visitedAt: formatDate(visitDate),
        imageUrl: photo,
        photos: photo ? [photo] : [],
        note,
        tasteNotes,
        revisit,
        isPublic,
      }),
    [
      effectiveMenu,
      isPublic,
      note,
      photo,
      ramenType,
      revisit,
      shop?.id,
      tasteNotes,
      visitDate,
    ],
  )

  const save = async () => {
    if (validationMessage || !shop) {
      setError(validationMessage ?? "입력 내용을 확인해주세요.")
      return
    }
    const input: CreateRamenLogInput = {
      shopId: shop.id,
      shopName: shop.name,
      branch: shop.branch,
      menuName: effectiveMenu,
      ramenType,
      visitedAt: formatDate(visitDate),
      imageUrl: photo,
      photos: photo ? [photo] : [],
      note: note.trim(),
      tasteNotes,
      revisit,
      isPublic,
    }
    setSaving(true)
    setError(null)
    try {
      await new Promise((resolve) => setTimeout(resolve, 650))
      const created: unknown = await Promise.resolve(actions.createLog(input))
      const newId =
        typeof created === "number"
          ? created
          : typeof created === "object" && created && "id" in created
            ? String(created.id)
            : undefined
      allowLeave.current = true
      actions.clearRecordDraft()
      router.replace({
        pathname: "/record/complete",
        params: newId ? { logId: String(newId) } : {},
      })
    } catch {
      setError(
        "기록을 저장하지 못했어요. 연결 상태를 확인하고 다시 시도해주세요.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FlowPage>
      <FlowHeader
        title="라멘로그 작성"
        subtitle={
          shop
            ? `${shop.name}${shop.branch ? ` · ${shop.branch}` : ""}`
            : "매장을 선택해주세요"
        }
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <FlowScroll contentContainerStyle={styles.content}>
          {!!error && <InlineNotice text={error} tone="error" />}

          <View style={flowStyles.section}>
            <View style={styles.sectionHeader}>
              <Text style={flowStyles.sectionTitle}>시식 사진</Text>
              <Text style={styles.optional}>선택</Text>
            </View>
            {photo ? (
              <View style={styles.photoFrame}>
                <Image
                  source={{ uri: photo }}
                  contentFit="cover"
                  style={StyleSheet.absoluteFill}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="사진 삭제"
                  onPress={() => setPhoto(null)}
                  style={styles.removePhoto}
                >
                  <Trash2 color={palette.canvas} size={18} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="라멘 사진 추가"
                onPress={showPhotoMenu}
                style={styles.photoPicker}
              >
                <ImagePlus color={palette.red} size={26} />
                <Text style={styles.photoPickerTitle}>
                  먹기 전에 찍은 한 장
                </Text>
                <Text style={styles.photoPickerCopy}>
                  카메라로 촬영하거나 보관함에서 선택하세요.
                </Text>
              </Pressable>
            )}
          </View>

          <View style={[flowStyles.section, styles.formSection]}>
            <Text style={flowStyles.sectionTitle}>한 그릇 기본 정보</Text>
            <View>
              <Text style={flowStyles.label}>매장</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  shop ? `선택한 매장 ${shop.name}. 변경하기` : "매장 선택"
                }
                onPress={() => router.push("/record/select-shop")}
                style={styles.selectField}
              >
                <MapPin color={shop ? palette.red : palette.muted} size={19} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.selectValue,
                      !shop && { color: palette.muted },
                    ]}
                  >
                    {shop?.name ?? "방문한 매장을 선택하세요"}
                  </Text>
                  {!!shop?.branch && (
                    <Text style={styles.selectMeta}>{shop.branch}</Text>
                  )}
                </View>
                <ChevronDown color={palette.muted} size={19} />
              </Pressable>
            </View>

            <View>
              <Text style={flowStyles.label}>방문일</Text>
              <View style={styles.dateRow}>
                <Text style={styles.dateText}>{formatDate(visitDate)}</Text>
                <DateTimePicker
                  accessibilityLabel="방문일 선택"
                  display={Platform.OS === "ios" ? "compact" : "default"}
                  maximumDate={new Date()}
                  mode="date"
                  onChange={(_, date) => date && setVisitDate(date)}
                  value={visitDate}
                />
              </View>
            </View>

            <View>
              <Text style={flowStyles.label}>먹은 메뉴</Text>
              <View style={styles.chips}>
                {menus.map((menu) => (
                  <SelectChip
                    key={menu}
                    label={menu}
                    selected={!isCustomMenu && menuName === menu}
                    onPress={() => {
                      setIsCustomMenu(false)
                      setMenuName(menu)
                    }}
                  />
                ))}
                <SelectChip
                  label="직접 입력"
                  selected={isCustomMenu}
                  onPress={() => setIsCustomMenu(true)}
                />
              </View>
              {isCustomMenu && (
                <TextInput
                  accessibilityLabel="메뉴명 직접 입력"
                  maxLength={40}
                  onChangeText={setCustomMenu}
                  placeholder="메뉴명을 입력하세요"
                  placeholderTextColor={palette.quiet}
                  style={[flowStyles.input, { marginTop: 10 }]}
                  value={customMenu}
                />
              )}
            </View>

            <View>
              <Text style={flowStyles.label}>라멘 계보</Text>
              <View style={styles.chips}>
                {RAMEN_TYPES.map((type) => (
                  <SelectChip
                    key={type}
                    label={type}
                    selected={ramenType === type}
                    onPress={() => setRamenType(type)}
                  />
                ))}
              </View>
            </View>
          </View>

          <View style={[flowStyles.section, styles.formSection]}>
            <Text style={flowStyles.sectionTitle}>다시 먹고 싶은 정도</Text>
            <View style={styles.chips}>
              {REVISIT_OPTIONS.map((option) => (
                <SelectChip
                  key={option}
                  label={option}
                  selected={revisit === option}
                  onPress={() => setRevisit(option)}
                />
              ))}
            </View>
          </View>

          <View style={[flowStyles.section, styles.formSection]}>
            <Text style={flowStyles.sectionTitle}>맛의 기억</Text>
            <Text style={flowStyles.secondary}>
              각 항목에서 가장 가까운 느낌을 하나 이상 골라주세요.
            </Text>
            {TASTE_FIELDS.map((field) => (
              <View key={field.key}>
                <Text style={flowStyles.label}>{field.label}</Text>
                <View style={styles.chips}>
                  {field.options.map((option) => (
                    <SelectChip
                      key={option}
                      label={option}
                      selected={tasteNotes[field.key].includes(option)}
                      onPress={() => toggleTaste(field.key, option)}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>

          <View style={[flowStyles.section, styles.formSection]}>
            <View style={styles.sectionHeader}>
              <Text style={flowStyles.sectionTitle}>나만의 시식 메모</Text>
              <Text style={styles.counter}>{note.length}/500</Text>
            </View>
            <TextInput
              accessibilityLabel="시식 메모"
              maxLength={500}
              multiline
              onChangeText={setNote}
              placeholder="첫 모금, 면의 식감, 다음 주문 팁처럼 다시 기억하고 싶은 순간을 적어보세요."
              placeholderTextColor={palette.quiet}
              style={[flowStyles.input, styles.noteInput]}
              textAlignVertical="top"
              value={note}
            />
          </View>

          <View style={styles.publicRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.publicTitle}>라운지에 공개</Text>
              <Text style={styles.publicDescription}>
                끄면 나만 볼 수 있는 개인 기록으로 저장됩니다.
              </Text>
            </View>
            <Switch
              accessibilityLabel="라운지 공개"
              ios_backgroundColor={palette.line}
              onValueChange={setIsPublic}
              trackColor={{ false: palette.line, true: palette.red }}
              value={isPublic}
            />
          </View>
        </FlowScroll>

        <View style={flowStyles.bottomBar}>
          <ActionButton
            label="라멘로그 저장하기"
            loading={saving}
            disabled={saving}
            icon={<Camera color={palette.canvas} size={19} />}
            onPress={save}
          />
        </View>
      </KeyboardAvoidingView>
    </FlowPage>
  )
}

const styles = StyleSheet.create({
  content: { paddingTop: 14, gap: 14 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  optional: { color: palette.muted, fontSize: 12, fontWeight: "700" },
  photoFrame: {
    height: 220,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: palette.wash,
  },
  removePhoto: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(37,40,43,0.82)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoPicker: {
    minHeight: 150,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#C9C9C9",
    backgroundColor: palette.wash,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  photoPickerTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 9,
  },
  photoPickerCopy: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
    textAlign: "center",
  },
  formSection: { gap: 18 },
  selectField: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  selectValue: { color: palette.ink, fontSize: 15, fontWeight: "800" },
  selectMeta: { color: palette.muted, fontSize: 12, marginTop: 2 },
  dateRow: {
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateText: { color: palette.ink, fontSize: 15, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  counter: { color: palette.quiet, fontSize: 11 },
  noteInput: { minHeight: 132, paddingTop: 13 },
  publicRow: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: palette.wash,
  },
  publicTitle: { color: palette.ink, fontSize: 15, fontWeight: "800" },
  publicDescription: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
})
