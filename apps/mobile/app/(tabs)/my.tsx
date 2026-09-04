import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { Award, Calendar, BookOpen, Settings } from 'lucide-react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { UserProfile } from '@raota/shared';

const MOCK_PROFILE: UserProfile = {
  id: 'usr-1',
  name: '홍길동',
  nickname: '라멘오타쿠',
  avatar: null,
  level: '라멘 미식가 (Lv.5)',
  levelNumber: 5,
  membershipNo: 'RAOTA-2026-0042',
  visitedCount: 42,
  revisitCount: 18,
  isLoggedIn: true,
};

export default function MyScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 프로필 카드 */}
      <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitial}>🍜</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.nickname, { color: colors.text }]}>{MOCK_PROFILE.nickname}</Text>
          <Text style={styles.levelText}>{MOCK_PROFILE.level}</Text>
          <Text style={styles.memberNo}>{MOCK_PROFILE.membershipNo}</Text>
        </View>
      </View>

      {/* 통계 카드 */}
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.statNumber}>42</Text>
          <Text style={styles.statLabel}>방문 매장</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.statNumber}>18</Text>
          <Text style={styles.statLabel}>재방문 횟수</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.statNumber}>7일</Text>
          <Text style={styles.statLabel}>연속 기록</Text>
        </View>
      </View>

      {/* 취향 리포트 요약 */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>나의 라멘 취향 분석</Text>
          <Text style={styles.cardMore}>상세 리포트</Text>
        </View>
        <Text style={styles.cardBody}>
          주로 <Text style={{ fontWeight: '700', color: '#FF6B00' }}>진한 쇼유 & 돈코츠</Text> 계열을 선호하며, 단단한 면발과 계란 토핑 만족도가 높습니다.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    gap: 16,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFE9D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 28,
  },
  profileInfo: {
    flex: 1,
  },
  nickname: {
    fontSize: 18,
    fontWeight: '700',
  },
  levelText: {
    fontSize: 13,
    color: '#FF6B00',
    fontWeight: '600',
    marginTop: 2,
  },
  memberNo: {
    fontSize: 11,
    color: '#8B95A1',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#191F28',
  },
  statLabel: {
    fontSize: 12,
    color: '#8B95A1',
    marginTop: 4,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardMore: {
    fontSize: 12,
    color: '#FF6B00',
    fontWeight: '600',
  },
  cardBody: {
    fontSize: 13,
    color: '#4E5968',
    lineHeight: 20,
  },
});
