import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Award, ChevronRight, Bookmark, MapPin, Heart, MessageSquare, Settings, Bell } from 'lucide-react-native';

const TASTE_AXES = [
  { label: '국물 농도', value: '진해요 (88%)', score: 0.88 },
  { label: '간 (염도)', value: '딱 좋아요 (75%)', score: 0.75 },
  { label: '면 익힘', value: '단단해요 (92%)', score: 0.92 },
  { label: '기름기', value: '적당해요 (65%)', score: 0.65 },
  { label: '감칠맛', value: '풍부해요 (95%)', score: 0.95 },
];

const VISITED_SHOPS = [
  {
    id: 1,
    name: '멘야준',
    branch: '망원 본점',
    style: '특제 쇼유 라멘',
    visits: 6,
    lastVisited: '2026.09.01',
    photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=200&h=200&fit=crop&auto=format&q=80',
    regular: true,
  },
  {
    id: 2,
    name: '오레노라멘',
    branch: '마포 본점',
    style: '토리파이탄',
    visits: 4,
    lastVisited: '2026.08.31',
    photo: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=200&h=200&fit=crop&auto=format&q=80',
    regular: true,
  },
  {
    id: 3,
    name: '세상끝의라멘',
    branch: '합정점',
    style: '블랙 쇼유 라멘',
    visits: 3,
    lastVisited: '2026.08.25',
    photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=200&h=200&fit=crop&auto=format&q=80',
    regular: false,
  },
];

export default function MyScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'shops' | 'bookmarks' | 'posts'>('shops');

  return (
    <View style={styles.root}>
      {/* 상단 헤더 */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.headerTitle}>마이페이지</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn}>
            <Bell size={20} color="#25282B" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <Settings size={20} color="#25282B" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* 회원 카드 */}
        <View style={styles.memberCard}>
          <View style={styles.avatarBox}>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=120&h=120&fit=crop&auto=format&q=80' }}
              style={styles.avatarImg}
            />
            <View style={styles.levelPill}>
              <Text style={styles.levelPillText}>Lv.5</Text>
            </View>
          </View>

          <View style={styles.memberInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.memberName}>라멘오타쿠</Text>
              <View style={styles.gradeBadge}>
                <Text style={styles.gradeBadgeText}>라멘 미식가</Text>
              </View>
            </View>
            <Text style={styles.memberNo}>RAOTA-2026-0042</Text>
            <Text style={styles.memberBio}>진한 쇼유와 이에케 라멘에 빠져있는 직장인 🍜</Text>
          </View>
        </View>

        {/* 3대 핵심 지표 박스 */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>42</Text>
            <Text style={styles.statLabel}>방문 매장</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>18</Text>
            <Text style={styles.statLabel}>재방문</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: '#E60000' }]}>7일</Text>
            <Text style={styles.statLabel}>연속 기록</Text>
          </View>
        </View>

        {/* 라멘 취향 분석 5축 카드 */}
        <View style={styles.tasteCard}>
          <View style={styles.tasteHeader}>
            <View>
              <Text style={styles.tasteTitle}>나의 라멘 취향 리포트</Text>
              <Text style={styles.tasteSubtitle}>42개 방문 로그 기반 실시간 분석</Text>
            </View>
            <TouchableOpacity style={styles.tasteMoreBtn}>
              <Text style={styles.tasteMoreText}>상세 분석</Text>
              <ChevronRight size={14} color="#E60000" />
            </TouchableOpacity>
          </View>

          <View style={styles.axesList}>
            {TASTE_AXES.map((axis, idx) => (
              <View key={idx} style={styles.axisItem}>
                <View style={styles.axisLabelRow}>
                  <Text style={styles.axisName}>{axis.label}</Text>
                  <Text style={styles.axisVal}>{axis.value}</Text>
                </View>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${axis.score * 100}%` }]} />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 활동 탭 */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.switchTab, activeTab === 'shops' && styles.switchTabActive]}
            onPress={() => setActiveTab('shops')}
          >
            <Text style={[styles.switchTabText, activeTab === 'shops' && styles.switchTabTextActive]}>
              방문 매장 (42)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.switchTab, activeTab === 'bookmarks' && styles.switchTabActive]}
            onPress={() => setActiveTab('bookmarks')}
          >
            <Text style={[styles.switchTabText, activeTab === 'bookmarks' && styles.switchTabTextActive]}>
              찜한 곳 (12)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.switchTab, activeTab === 'posts' && styles.switchTabActive]}
            onPress={() => setActiveTab('posts')}
          >
            <Text style={[styles.switchTabText, activeTab === 'posts' && styles.switchTabTextActive]}>
              작성 글 (5)
            </Text>
          </TouchableOpacity>
        </View>

        {/* 방문 매장 리스트 */}
        <View style={styles.shopList}>
          {VISITED_SHOPS.map((shop) => (
            <TouchableOpacity key={shop.id} style={styles.shopItem} activeOpacity={0.7}>
              <Image source={{ uri: shop.photo }} style={styles.shopThumb} />
              <View style={styles.shopItemInfo}>
                <View style={styles.shopItemHeader}>
                  <Text style={styles.shopItemName}>{shop.name} {shop.branch}</Text>
                  {shop.regular && (
                    <View style={styles.regularBadge}>
                      <Text style={styles.regularBadgeText}>★ 단골</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.shopItemStyle}>{shop.style}</Text>
                <View style={styles.shopItemFooter}>
                  <Text style={styles.visitCountText}>{shop.visits}회 방문</Text>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.lastVisitDate}>최근 {shop.lastVisited}</Text>
                </View>
              </View>
              <ChevronRight size={18} color="#D6D3D1" style={{ alignSelf: 'center' }} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E2E2',
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#25282B',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    padding: 6,
  },
  container: {
    flex: 1,
  },
  memberCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E2E2',
    padding: 16,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarBox: {
    position: 'relative',
  },
  avatarImg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F2F2F2',
  },
  levelPill: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#E60000',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  levelPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  memberInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#25282B',
  },
  gradeBadge: {
    backgroundColor: '#FFE9D6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gradeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#E60000',
  },
  memberNo: {
    fontSize: 11,
    color: '#7E7E7E',
    fontWeight: '600',
    marginTop: 2,
  },
  memberBio: {
    fontSize: 11.5,
    color: '#4E5968',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E2E2',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#25282B',
  },
  statLabel: {
    fontSize: 11,
    color: '#7E7E7E',
    fontWeight: '700',
    marginTop: 4,
  },
  tasteCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E2E2',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  tasteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  tasteTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#25282B',
  },
  tasteSubtitle: {
    fontSize: 11,
    color: '#7E7E7E',
    marginTop: 2,
  },
  tasteMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  tasteMoreText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#E60000',
  },
  axesList: {
    gap: 10,
  },
  axisItem: {
    gap: 4,
  },
  axisLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  axisName: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#25282B',
  },
  axisVal: {
    fontSize: 11,
    color: '#7E7E7E',
    fontWeight: '600',
  },
  barBg: {
    height: 6,
    backgroundColor: '#F2F2F2',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#E60000',
    borderRadius: 3,
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F2',
    borderRadius: 6,
    padding: 3,
    marginBottom: 12,
  },
  switchTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 4,
  },
  switchTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  switchTabText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#7E7E7E',
  },
  switchTabTextActive: {
    color: '#25282B',
    fontWeight: '900',
  },
  shopList: {
    gap: 10,
  },
  shopItem: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E2E2',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
  },
  shopThumb: {
    width: 60,
    height: 60,
    borderRadius: 6,
    backgroundColor: '#F2F2F2',
  },
  shopItemInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  shopItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shopItemName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#25282B',
  },
  regularBadge: {
    backgroundColor: '#FFE9D6',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  regularBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#E60000',
  },
  shopItemStyle: {
    fontSize: 11.5,
    color: '#7E7E7E',
    marginTop: 2,
  },
  shopItemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  visitCountText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#25282B',
  },
  metaDot: {
    fontSize: 10,
    color: '#A0A0A0',
  },
  lastVisitDate: {
    fontSize: 10.5,
    color: '#7E7E7E',
  },
});
