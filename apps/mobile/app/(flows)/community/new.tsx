import { useEffect, useRef, useState } from "react"
import { router, useNavigation } from "expo-router"
import { Image } from "expo-image"
import * as ImagePicker from "expo-image-picker"
import { ImagePlus, MapPin, Trash2 } from "lucide-react-native"
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"

import type {
  CommunityPostCategory,
  CreateCommunityPostInput,
} from "@raota/shared"
import { useRaota } from "@/src/state/RaotaStore"
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

const CATEGORIES: Array<{
  id: Exclude<CommunityPostCategory, "POPULAR">
  label: string
}> = [
  { id: "REVIEW", label: "맛집후기" },
  { id: "TIP", label: "꿀팁" },
  { id: "QUESTION", label: "Q&A" },
  { id: "FREE", label: "자유" },
]

export default function NewCommunityPostScreen() {
  const navigation = useNavigation()
  const { currentUser, shops, actions } = useRaota()
  const [category, setCategory] =
    useState<CreateCommunityPostInput["category"]>("REVIEW")
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [details, setDetails] = useState("")
  const [shopId, setShopId] = useState<number | undefined>()
  const [photos, setPhotos] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const allowLeave = useRef(false)
  const isDirty = Boolean(
    title || content || details || photos.length || shopId,
  )

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (!isDirty || allowLeave.current) return
      event.preventDefault()
      Alert.alert(
        "글 작성을 그만둘까요?",
        "작성 중인 내용은 저장되지 않습니다.",
        [
          { text: "계속 작성", style: "cancel" },
          {
            text: "나가기",
            style: "destructive",
            onPress: () => {
              allowLeave.current = true
              navigation.dispatch(event.data.action)
            },
          },
        ],
      )
    })
    return unsubscribe
  }, [isDirty, navigation])

  const pickPhotos = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert(
        "사진 접근 권한이 필요해요",
        "설정에서 사진 접근을 허용해주세요.",
        [
          { text: "취소", style: "cancel" },
          { text: "설정 열기", onPress: () => Linking.openSettings() },
        ],
      )
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 3 - photos.length,
      quality: 0.82,
    })
    if (result.canceled) return
    const next = result.assets
      .slice(0, 3 - photos.length)
      .map((asset) => asset.uri)
    setPhotos((current) => [...current, ...next].slice(0, 3))
  }

  const publish = async () => {
    if (!currentUser) {
      router.push("/auth/login")
      return
    }
    if (title.trim().length < 4) {
      setError("제목을 4자 이상 입력해주세요.")
      return
    }
    if (content.trim().length < 10) {
      setError("내용을 10자 이상 입력해주세요.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const created = await actions.createPost({
        category,
        title: title.trim(),
        content: content.trim(),
        detailedContent: details.trim()
          ? details
              .split(/\n\s*\n/)
              .map((item) => item.trim())
              .filter(Boolean)
          : undefined,
        shopId,
        imageUrls: photos,
      })
      allowLeave.current = true
      router.replace({
        pathname: "/community/[postId]",
        params: { postId: String(created.id) },
      })
    } catch {
      setError("글을 등록하지 못했어요. 잠시 후 다시 시도해주세요.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <FlowPage>
      <FlowHeader title="새 글 쓰기" subtitle="라멘러들과 경험을 나눠보세요" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlowScroll contentContainerStyle={styles.content}>
          {!!error && <InlineNotice text={error} tone="error" />}
          <View>
            <Text style={flowStyles.label}>게시판</Text>
            <View style={styles.chips}>
              {CATEGORIES.map((item) => (
                <SelectChip
                  key={item.id}
                  label={item.label}
                  selected={category === item.id}
                  onPress={() => setCategory(item.id)}
                />
              ))}
            </View>
          </View>
          <View>
            <View style={styles.labelRow}>
              <Text style={flowStyles.label}>제목</Text>
              <Text style={styles.counter}>{title.length}/60</Text>
            </View>
            <TextInput
              accessibilityLabel="글 제목"
              maxLength={60}
              onChangeText={setTitle}
              placeholder="이야기의 핵심을 한 문장으로 적어주세요"
              placeholderTextColor={palette.quiet}
              style={flowStyles.input}
              value={title}
            />
          </View>
          <View>
            <View style={styles.labelRow}>
              <Text style={flowStyles.label}>요약</Text>
              <Text style={styles.counter}>{content.length}/160</Text>
            </View>
            <TextInput
              accessibilityLabel="글 요약"
              maxLength={160}
              multiline
              onChangeText={setContent}
              placeholder="목록에서 먼저 보일 내용을 적어주세요."
              placeholderTextColor={palette.quiet}
              style={[flowStyles.input, styles.summaryInput]}
              textAlignVertical="top"
              value={content}
            />
          </View>
          <View>
            <Text style={flowStyles.label}>자세한 이야기 · 선택</Text>
            <TextInput
              accessibilityLabel="글 상세 내용"
              maxLength={1200}
              multiline
              onChangeText={setDetails}
              placeholder="방문 경험, 주문 팁, 추천 이유를 자유롭게 적어주세요. 문단은 빈 줄로 나눌 수 있어요."
              placeholderTextColor={palette.quiet}
              style={[flowStyles.input, styles.detailInput]}
              textAlignVertical="top"
              value={details}
            />
          </View>

          <View>
            <View style={styles.labelRow}>
              <Text style={flowStyles.label}>사진 · 선택</Text>
              <Text style={styles.counter}>{photos.length}/3</Text>
            </View>
            <View style={styles.photoRow}>
              {photos.map((photo, index) => (
                <View key={`${photo}-${index}`} style={styles.photoWrap}>
                  <Image
                    source={{ uri: photo }}
                    contentFit="cover"
                    style={styles.photo}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`사진 ${index + 1} 삭제`}
                    hitSlop={6}
                    onPress={() =>
                      setPhotos((items) =>
                        items.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    style={styles.removePhoto}
                  >
                    <Trash2 color={palette.canvas} size={15} />
                  </Pressable>
                </View>
              ))}
              {photos.length < 3 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="사진 추가"
                  onPress={pickPhotos}
                  style={styles.addPhoto}
                >
                  <ImagePlus color={palette.red} size={23} />
                  <Text style={styles.addPhotoText}>추가</Text>
                </Pressable>
              )}
            </View>
          </View>

          <View>
            <Text style={flowStyles.label}>관련 매장 · 선택</Text>
            <View style={styles.shopChips}>
              <SelectChip
                label="선택 안 함"
                selected={shopId === undefined}
                onPress={() => setShopId(undefined)}
              />
              {shops.slice(0, 8).map((shop) => (
                <SelectChip
                  key={shop.id}
                  label={shop.name}
                  selected={shopId === shop.id}
                  onPress={() => setShopId(shop.id)}
                />
              ))}
            </View>
            {!!shopId && (
              <View style={styles.linkedShop}>
                <MapPin color={palette.red} size={16} />
                <Text style={styles.linkedShopText}>
                  {shops.find((shop) => shop.id === shopId)?.name} 매장 링크가
                  글에 표시됩니다.
                </Text>
              </View>
            )}
          </View>
        </FlowScroll>
        <View style={flowStyles.bottomBar}>
          <ActionButton
            label="글 등록하기"
            shape="rounded"
            loading={saving}
            onPress={publish}
          />
        </View>
      </KeyboardAvoidingView>
    </FlowPage>
  )
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, gap: 20 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  counter: { color: palette.quiet, fontSize: 11 },
  summaryInput: { minHeight: 94, paddingTop: 12 },
  detailInput: { minHeight: 180, paddingTop: 12 },
  photoRow: { flexDirection: "row", gap: 8 },
  photoWrap: { width: 82, height: 82, borderRadius: 8, overflow: "hidden" },
  photo: { width: 82, height: 82 },
  removePhoto: {
    position: "absolute",
    right: 2,
    top: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(37,40,43,0.82)",
    alignItems: "center",
    justifyContent: "center",
  },
  addPhoto: {
    width: 82,
    height: 82,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#C9C9C9",
    backgroundColor: palette.wash,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addPhotoText: { color: palette.red, fontSize: 11, fontWeight: "800" },
  shopChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  linkedShop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    backgroundColor: palette.wash,
    borderRadius: 8,
    padding: 10,
  },
  linkedShopText: { flex: 1, color: palette.ink, fontSize: 12, lineHeight: 17 },
})
