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
import { Bell, Flame, ExternalLink, ChevronRight } from 'lucide-react-native';

const FILTERS = ['전체', '한정 메뉴', '영업 공지', '이벤트'];

const NEWS_POSTS = [
  {
    id: 1,
    shop: '멘야준',
    branch: '망원 본점',
    handle: '@menyajun_official',
    type: '한정 메뉴',
    title: '여름 한정: 자가제면 냉 시오 라멘 개시',
    summary: [
      '제주산 토종닭 맑은 육수를 차갑게 정제하여 감칠맛 극대화',
      '9월 한 달간 매일 30그릇 한정 판매 (13,000원)',
      '평일 11:30 오픈 20분 전 방문 권장',
    ],
    time: '2시간 전',
    photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=600&h=400&fit=crop&auto=format&q=80',
    notifying: true,
  },
  {
    id: 2,
    shop: '오레노라멘',
    branch: '마포 본점',
    handle: '@orenoramen_kr',
    type: '영업 공지',
    title: '이번 주 토요일 육수 테스트로 인한 단축 운영 안내',
    summary: [
      '새로운 닭 육수 배합 테스트로 인해 12:00–18:00까지만 운영',
      '마지막 주문 시간은 17:30으로 단축됩니다',
      '일요일부터는 정상 영업 (11:00–21:00) 진행',
    ],
    time: '어제',
    photo: null,
    notifying: true,
  },
  {
    id: 3,
    shop: '후쿠 라멘',
    branch: '합정점',
    handle: '@fuku_ramen_seoul',
    type: '이벤트',
    title: '개점 1주년 감사제: 특제 미소 라멘 차슈 무료 증정',
    summary: [
      '9월 5일~7일 (3일간) 방문 고객 전원 수비드 삼겹 차슈 2장 쿠폰',
      '당일 조기 재료 소진 시 이벤트가 일찍 마감될 수 있습니다',
    ],
    time: '3일 전',
    photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=600&h=400&fit=crop&auto=format&q=80',
    notifying: false,
  },
];

export default function NewsScreen() {
  const insets = useSafeAreaInsets();
  const [selectedFilter, setSelectedFilter] = useState('전체');
  const [notifs, setNotifs] = useState<Record<number, boolean>>({ 1: true, 2: true, 3: false });

  const toggleNotif = (id: number) => {
    setNotifs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filtered = selectedFilter === '전체' ? NEWS_POSTS : NEWS_POSTS.filter((p) => p.type === selectedFilter);

  return (
    <View style={styles.root}>
      {/* 상단 헤더 */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerTop}>
          <Image source={require('@/assets/images/logo.png')} style={styles.headerLogo} resizeMode="contain" />
          <View>
            <Text style={styles.headerTitle}>라멘집 인스타 속보</Text>
            <Text style={styles.headerSubtitle}>단골 매장의 실시간 한정 메뉴, 팝업, 휴무 소식</Text>
          </View>
        </View>

        {/* 필터 칩 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterScrollContent}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, selectedFilter === f && styles.filterChipActive]}
              onPress={() => setSelectedFilter(f)}
            >
              <Text style={[styles.filterChipText, selectedFilter === f && styles.filterChipTextActive]}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 소식 피드 리스트 */}
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {filtered.map((news) => (
          <View key={news.id} style={styles.newsCard}>
            {/* 카드 상단 매장 정보 */}
            <View style={styles.cardHeader}>
              <View style={styles.shopInfo}>
                <View style={styles.shopNameRow}>
                  <Text style={styles.shopName}>{news.shop}</Text>
                  <Text style={styles.shopBranch}>{news.branch}</Text>
                </View>
                <Text style={styles.shopHandle}>{news.handle}</Text>
              </View>

              <View style={styles.headerRight}>
                <View style={[styles.typeBadge, news.type === '한정 메뉴' && { backgroundColor: '#FFE9D6' }]}>
                  <Text style={[styles.typeBadgeText, news.type === '한정 메뉴' && { color: '#E60000' }]}>{news.type}</Text>
                </View>
                <TouchableOpacity onPress={() => toggleNotif(news.id)} style={styles.bellBtn}>
                  <Bell size={16} color={notifs[news.id] ? '#E60000' : '#8B95A1'} fill={notifs[news.id] ? '#E60000' : 'none'} />
                </TouchableOpacity>
              </View>
            </View>

            {/* 대표 사진 */}
            {news.photo && (
              <Image source={{ uri: news.photo }} style={styles.newsImage} resizeMode="cover" />
            )}

            {/* 뉴스 제목 & 요약 불릿 */}
            <Text style={styles.newsTitle}>{news.title}</Text>
            <View style={styles.summaryBox}>
              {news.summary.map((line, idx) => (
                <View key={idx} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{line}</Text>
                </View>
              ))}
            </View>

            {/* 카드 푸터 */}
            <View style={styles.cardFooter}>
              <Text style={styles.timeText}>{news.time}</Text>
              <TouchableOpacity style={styles.instaLink}>
                <Text style={styles.instaLinkText}>인스타그램 원문</Text>
                <ExternalLink size={12} color="#7E7E7E" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
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
    paddingBottom: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12,
  },
  headerLogo: {
    width: 32,
    height: 32,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#25282B',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#7E7E7E',
    fontWeight: '600',
    marginTop: 1,
  },
  filterScroll: { marginTop: 4 },
  filterScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E2E2E2',
  },
  filterChipActive: {
    backgroundColor: '#25282B',
    borderColor: '#25282B',
  },
  filterChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#7E7E7E',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  newsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E2E2',
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  shopInfo: {
    flex: 1,
  },
  shopNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shopName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#25282B',
  },
  shopBranch: {
    fontSize: 11,
    color: '#7E7E7E',
    fontWeight: '700',
  },
  shopHandle: {
    fontSize: 11,
    color: '#3860BE',
    fontWeight: '600',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    backgroundColor: '#F2F2F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#4E5968',
  },
  bellBtn: {
    padding: 4,
  },
  newsImage: {
    width: '100%',
    height: 180,
    borderRadius: 6,
    backgroundColor: '#F2F2F2',
    marginBottom: 12,
  },
  newsTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#25282B',
    lineHeight: 20,
    marginBottom: 10,
  },
  summaryBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    padding: 10,
    gap: 6,
    marginBottom: 12,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
  },
  bulletDot: {
    color: '#E60000',
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 16,
  },
  bulletText: {
    flex: 1,
    fontSize: 12,
    color: '#4E5968',
    lineHeight: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F2F2F2',
    paddingTop: 10,
  },
  timeText: {
    fontSize: 11,
    color: '#A0A0A0',
  },
  instaLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  instaLinkText: {
    fontSize: 11,
    color: '#7E7E7E',
    fontWeight: '700',
  },
});
