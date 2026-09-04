import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Sparkles, ChevronRight, Star, Heart } from 'lucide-react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { RamenLog } from '@raota/shared';

const SAMPLE_LOGS: RamenLog[] = [
  {
    id: 1,
    author: { name: '멘마수집가', level: '라멘 미식가 (Lv.5)' },
    shop: { id: 1, name: '멘야준', branch: '망원 본점', location: '서울 마포구' },
    menuName: '특제 쇼유 라멘',
    ramenType: '쇼유',
    visitedAt: '2026. 09. 01',
    imageUrl: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=800&h=600&fit=crop&auto=format&q=80',
    photos: [],
    note: '닭과 오리 더블 육수의 첫 모금 감칠맛이 폭발적임. 차슈 토핑 완성도가 예술.',
    tasteNotes: {
      broth: ['진해요', '감칠맛 좋아요'],
      noodle: ['단단해요', '국물이 잘 배어요'],
      seasoning: ['딱 좋아요'],
      topping: ['차슈 좋아요', '계란 좋아요'],
    },
    revisit: '자주 감',
    likes: 38,
    isLiked: false,
    isPublic: true,
    createdAt: '2시간 전',
  },
  {
    id: 2,
    author: { name: '토리파이탄러버', level: '라멘집 단골 (Lv.4)' },
    shop: { id: 3, name: '오레노라멘', branch: '마포 본점', location: '서울 마포구' },
    menuName: '토리파이탄 라멘',
    ramenType: '돈코츠',
    visitedAt: '2026. 08. 31',
    imageUrl: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=800&h=600&fit=crop&auto=format&q=80',
    photos: [],
    note: '거품 낸 닭 육수의 크리미함이 일품. 밥 말아먹기 딱 좋은 염도.',
    tasteNotes: {
      broth: ['진해요', '기름져요'],
      noodle: ['탄력 있어요'],
      seasoning: ['딱 좋아요'],
      topping: ['차슈 좋아요'],
    },
    revisit: '자주 감',
    likes: 24,
    isLiked: true,
    isPublic: true,
    createdAt: '어제',
  },
];

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 상단 큐레이션 배너 */}
      <View style={styles.bannerContainer}>
        <View style={styles.bannerBadge}>
          <Sparkles size={14} color="#FF6B00" />
          <Text style={styles.bannerBadgeText}>AI 취향 매칭</Text>
        </View>
        <Text style={styles.bannerTitle}>라멘 오타쿠를 위한{"\n"}오늘의 최적 라멘집</Text>
        <Text style={styles.bannerSubtitle}>회원님의 국물 진함 & 단단한 면 취향 98% 일치</Text>
        <TouchableOpacity style={styles.bannerButton} activeOpacity={0.8}>
          <Text style={styles.bannerButtonText}>추천 매장 3곳 보러가기</Text>
          <ChevronRight size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* 실시간 라멘 로그 섹션 */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>방금 올라온 라멘 기록</Text>
        <Text style={styles.sectionMore}>전체보기</Text>
      </View>

      {SAMPLE_LOGS.map((log) => (
        <View key={log.id} style={[styles.logCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.logHeader}>
            <View>
              <Text style={[styles.shopName, { color: colors.text }]}>{log.shop.name} {log.shop.branch}</Text>
              <Text style={styles.authorInfo}>{log.author.name} · {log.author.level}</Text>
            </View>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{log.ramenType}</Text>
            </View>
          </View>

          {log.imageUrl && (
            <Image source={{ uri: log.imageUrl }} style={styles.logImage} resizeMode="cover" />
          )}

          <Text style={[styles.menuTitle, { color: colors.text }]}>{log.menuName}</Text>
          <Text style={styles.logNote}>{log.note}</Text>

          <View style={styles.tagRow}>
            {Object.values(log.tasteNotes).flat().slice(0, 3).map((tag, idx) => (
              <View key={idx} style={styles.tasteTag}>
                <Text style={styles.tasteTagText}>#{tag}</Text>
              </View>
            ))}
          </View>

          <View style={styles.logFooter}>
            <Text style={styles.timeText}>{log.createdAt}</Text>
            <View style={styles.likeRow}>
              <Heart size={16} color={log.isLiked ? '#FF3B30' : '#8B95A1'} fill={log.isLiked ? '#FF3B30' : 'none'} />
              <Text style={styles.likeCount}>{log.likes}</Text>
            </View>
          </View>
        </View>
      ))}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  bannerContainer: {
    marginTop: 12,
    marginBottom: 24,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#FFF4EB',
    borderWidth: 1,
    borderColor: '#FFE0C7',
  },
  bannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  bannerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF6B00',
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#191F28',
    lineHeight: 28,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 6,
    marginBottom: 14,
  },
  bannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B00',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 4,
  },
  bannerButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionMore: {
    fontSize: 13,
    color: '#8B95A1',
  },
  logCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  shopName: {
    fontSize: 16,
    fontWeight: '700',
  },
  authorInfo: {
    fontSize: 12,
    color: '#8B95A1',
    marginTop: 2,
  },
  typeBadge: {
    backgroundColor: '#FFF0E5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    color: '#FF6B00',
    fontSize: 11,
    fontWeight: '700',
  },
  logImage: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    marginBottom: 12,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  logNote: {
    fontSize: 13,
    color: '#4E5968',
    lineHeight: 18,
    marginBottom: 10,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  tasteTag: {
    backgroundColor: '#F2F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  tasteTagText: {
    fontSize: 11,
    color: '#4E5968',
  },
  logFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F2F4F6',
    paddingTop: 10,
  },
  timeText: {
    fontSize: 12,
    color: '#8B95A1',
  },
  likeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likeCount: {
    fontSize: 12,
    color: '#8B95A1',
    fontWeight: '600',
  },
});
