import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Flame, PenLine, X, Crosshair, Bookmark, Search, Sparkles } from 'lucide-react-native';

const RAMEN_PHOTOS = [
  'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=800&h=600&fit=crop&auto=format&q=80',
  'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=800&h=600&fit=crop&auto=format&q=80',
  'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=800&h=600&fit=crop&auto=format&q=80',
];

const NEARBY = [
  {
    num: '01',
    name: '멘야준',
    branch: '망원 본점',
    style: '특제 쇼유 라멘',
    broth: '동물계와 해산물 더블 육수',
    dist: '420m',
    score: '91%',
    status: '영업 중',
    photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=400&h=400&fit=crop&auto=format&q=80',
    tags: ['자가제면', '수비드 차슈'],
  },
  {
    num: '02',
    name: '후쿠 라멘',
    branch: '합정점',
    style: '진한 삿포로 미소 라멘',
    broth: '돼지뼈 육수와 볶음 채소',
    dist: '680m',
    score: '82%',
    status: '영업 중',
    photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=400&h=400&fit=crop&auto=format&q=80',
    tags: ['불향 가득', '꼬불꼬불 면'],
  },
  {
    num: '03',
    name: '오레노라멘',
    branch: '마포 본점',
    style: '토리파이탄 (닭백탕 라멘)',
    broth: '거품 낸 진한 닭 육수',
    dist: '1.4km',
    score: '75%',
    status: '영업 중',
    photo: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=400&h=400&fit=crop&auto=format&q=80',
    tags: ['미쉐린 빕구르망', '자가제면'],
  },
];

const POPULAR_SHOP_RANKINGS = [
  {
    rank: 1,
    name: '멘야준',
    branch: '망원 본점',
    style: '자가제면 특제 쇼유 라멘',
    views: '1,420회',
    photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=200&h=200&fit=crop&auto=format&q=80',
  },
  {
    rank: 2,
    name: '하쿠텐',
    branch: '연남점',
    style: '진한 농후 이에케 라멘',
    views: '1,180회',
    photo: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=200&h=200&fit=crop&auto=format&q=80',
  },
  {
    rank: 3,
    name: '오레노라멘',
    branch: '마포 본점',
    style: '크리미 토리파이탄 (닭백탕)',
    views: '960회',
    photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=200&h=200&fit=crop&auto=format&q=80',
  },
  {
    rank: 4,
    name: '담택',
    branch: '합정 본점',
    style: '깔끔한 유자 시오 라멘',
    views: '840회',
    photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=200&h=200&fit=crop&auto=format&q=80',
  },
  {
    rank: 5,
    name: '세상끝의라멘',
    branch: '합정점',
    style: '오사카식 블랙 쇼유 & 차슈',
    views: '720회',
    photo: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=200&h=200&fit=crop&auto=format&q=80',
  },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [fabOpen, setFabOpen] = useState(false);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. 상단 마스터 헤더 (공식 RAOTA 로고 + 슬로건 + 알림 센터) */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <View>
              <Text style={styles.logoText}>
                RAOTA<Text style={styles.logoDot}>.</Text>
              </Text>
              <Text style={styles.logoSlogan}>나의 라멘 취향을 찾는 곳</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.loginBtn}>
              <Text style={styles.loginBtnText}>로그인</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.registerBtn}>
              <Text style={styles.registerBtnText}>회원가입</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bellBtn}>
              <Bell size={20} color="#25282B" />
              <View style={styles.bellBadge} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. AI 3초 라멘 큐레이터 배너 */}
        <TouchableOpacity style={styles.aiBanner} activeOpacity={0.9}>
          <View style={styles.aiLeft}>
            <View style={styles.aiIconBox}>
              <Sparkles size={20} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.aiTitle}>오늘 뭐 먹지? AI 라멘 큐레이터</Text>
              <Text style={styles.aiSubtitle}>육수 농도 · 면 굵기 · 타레 맞춤 라멘 추천</Text>
            </View>
          </View>
          <Text style={styles.aiArrow}>→</Text>
        </TouchableOpacity>

        {/* 3. 오늘의 큐레이션 라멘집 */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitleRed}>오늘의 큐레이션 라멘집</Text>
            <Text style={styles.sectionMeta}>420m · 망원동</Text>
          </View>

          <TouchableOpacity style={styles.curationCard} activeOpacity={0.9}>
            <View style={styles.curationImageWrapper}>
              <Image source={{ uri: RAMEN_PHOTOS[0] }} style={styles.curationImage} resizeMode="cover" />
              <View style={styles.todayPickBadge}>
                <Text style={styles.todayPickBadgeText}>★ TODAY'S PICK</Text>
              </View>
            </View>

            <View style={styles.curationBody}>
              <View style={styles.shopNameRow}>
                <Text style={styles.curationShopName}>멘야준</Text>
                <View style={styles.branchBadge}>
                  <Text style={styles.branchBadgeText}>망원 본점</Text>
                </View>
              </View>

              <Text style={styles.curationDesc}>
                특제 쇼유 라멘 · 자가제면 스트레이트 면 · 닭과 오리 더블 육수
              </Text>

              {/* 에디터 인용구 (좌측 레드 악센트 바) */}
              <View style={styles.editorQuoteBox}>
                <Text style={styles.editorQuoteText}>
                  “진한 동물계 감칠맛과 단단한 자가제면 식감이 일품인 망원동의 대표 쇼유 라멘 명소입니다.”
                </Text>
              </View>

              {/* 태그 및 바로가기 CTA 버튼 */}
              <View style={styles.cardFooter}>
                <View style={styles.tagGroup}>
                  <View style={styles.pillTag}><Text style={styles.pillTagText}>#자가제면</Text></View>
                  <View style={styles.pillTag}><Text style={styles.pillTagText}>#맑은육수</Text></View>
                </View>
                <View style={styles.detailCtaBtn}>
                  <Text style={styles.detailCtaText}>매장 상세 보기 →</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* 4. 오늘 많이 본 라멘집 (실시간 조회순 랭킹) */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderWithIcon}>
              <Flame size={16} color="#E60000" fill="#E60000" />
              <Text style={styles.sectionTitleBlack}>오늘 많이 본 라멘집</Text>
            </View>
            <Text style={styles.sectionMeta}>실시간 조회수 기준</Text>
          </View>

          <View style={styles.rankingList}>
            {POPULAR_SHOP_RANKINGS.map((item) => (
              <TouchableOpacity key={item.rank} style={styles.rankingItem} activeOpacity={0.7}>
                <View style={styles.rankingLeft}>
                  <View
                    style={[
                      styles.rankNumberCircle,
                      item.rank === 1 && { backgroundColor: '#E60000' },
                      item.rank === 2 && { backgroundColor: '#25282B' },
                      item.rank === 3 && { backgroundColor: '#57534E' },
                      item.rank > 3 && { backgroundColor: '#F5F5F4' },
                    ]}
                  >
                    <Text style={[styles.rankNumberText, item.rank > 3 && { color: '#78716C' }]}>
                      {item.rank}
                    </Text>
                  </View>

                  <Image source={{ uri: item.photo }} style={styles.rankingThumb} />

                  <View style={styles.rankingInfo}>
                    <View style={styles.rankingTitleRow}>
                      <Text style={styles.rankingShopName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.rankingBranch}>{item.branch}</Text>
                    </View>
                    <Text style={styles.rankingStyle} numberOfLines={1}>{item.style}</Text>
                  </View>
                </View>

                <View style={styles.rankingRight}>
                  <Text style={styles.rankingViews}>{item.views}</Text>
                  <Text style={styles.rankingArrow}>→</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 5. 거리순 라멘집 목록 */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitleBlack}>거리순 라멘집 목록</Text>
            <Text style={styles.sectionMeta}>가까운 순서</Text>
          </View>

          <View style={styles.nearbyList}>
            {NEARBY.map((item, idx) => (
              <TouchableOpacity key={idx} style={styles.nearbyItem} activeOpacity={0.7}>
                <Text style={styles.nearbyNum}>{item.num}</Text>
                <Image source={{ uri: item.photo }} style={styles.nearbyThumb} />
                <View style={styles.nearbyInfo}>
                  <Text style={styles.nearbyShopName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.nearbyStyle} numberOfLines={1}>{item.style} · {item.broth}</Text>
                  <View style={styles.nearbyMetaRow}>
                    <Text style={styles.nearbyDist}>{item.dist}</Text>
                    <Text style={styles.nearbyDot}>·</Text>
                    <Text style={styles.nearbyStatus}>● {item.status}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 6. 미니멀 푸터 */}
        <View style={styles.footer}>
          <View style={styles.footerLinks}>
            <Text style={styles.footerLinkText}>이용약관</Text>
            <Text style={styles.footerDot}>·</Text>
            <Text style={styles.footerLinkText}>개인정보처리방침</Text>
            <Text style={styles.footerDot}>·</Text>
            <Text style={styles.footerLinkText}>문의하기</Text>
          </View>
          <Text style={styles.copyright}>© 2026 RAOTA · 라멘에 진심인 사람들</Text>
        </View>
      </ScrollView>

      {/* 7. 플로팅 스피드 다이얼 메뉴 (FAB) */}
      {fabOpen && (
        <TouchableOpacity
          style={styles.fabBackdrop}
          activeOpacity={1}
          onPress={() => setFabOpen(false)}
        />
      )}

      <View style={styles.fabContainer}>
        {fabOpen && (
          <View style={styles.fabMenuList}>
            <TouchableOpacity style={styles.fabMenuItem} activeOpacity={0.8}>
              <Text style={styles.fabMenuLabel}>주변 라멘집 기록하기</Text>
              <View style={styles.fabMenuIcon}>
                <Crosshair size={16} color="#E60000" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.fabMenuItem} activeOpacity={0.8}>
              <Text style={styles.fabMenuLabel}>저장 목록에서 기록하기</Text>
              <View style={styles.fabMenuIcon}>
                <Bookmark size={16} color="#E60000" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.fabMenuItem} activeOpacity={0.8}>
              <Text style={styles.fabMenuLabel}>직접 검색해서 기록하기</Text>
              <View style={styles.fabMenuIcon}>
                <Search size={16} color="#E60000" />
              </View>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[styles.fabBtn, fabOpen ? { backgroundColor: '#25282B' } : { backgroundColor: '#E60000' }]}
          onPress={() => setFabOpen(!fabOpen)}
          activeOpacity={0.85}
        >
          {fabOpen ? <X size={20} color="#FFFFFF" strokeWidth={2.5} /> : <PenLine size={20} color="#FFFFFF" strokeWidth={2.5} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E2E2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoImage: {
    width: 36,
    height: 36,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#25282B',
    letterSpacing: -0.5,
  },
  logoDot: {
    color: '#E60000',
  },
  logoSlogan: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7E7E7E',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loginBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  loginBtnText: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#25282B',
  },
  registerBtn: {
    backgroundColor: '#E60000',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  registerBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  bellBtn: {
    padding: 4,
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E60000',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  aiBanner: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#25282B',
    borderRadius: 6,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  aiIconBox: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#E60000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  aiSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  aiArrow: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E2E2',
    paddingBottom: 8,
    marginBottom: 12,
  },
  sectionHeaderWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitleRed: {
    fontSize: 13,
    fontWeight: '900',
    color: '#E60000',
    letterSpacing: -0.3,
  },
  sectionTitleBlack: {
    fontSize: 13,
    fontWeight: '900',
    color: '#25282B',
    letterSpacing: -0.3,
  },
  sectionMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7E7E7E',
  },
  curationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E2E2',
    overflow: 'hidden',
  },
  curationImageWrapper: {
    width: '100%',
    height: 200,
    backgroundColor: '#F2F2F2',
    position: 'relative',
  },
  curationImage: {
    width: '100%',
    height: '100%',
  },
  todayPickBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#E60000',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  todayPickBadgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  curationBody: {
    padding: 16,
  },
  shopNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  curationShopName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#25282B',
  },
  branchBadge: {
    backgroundColor: '#F2F2F2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  branchBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7E7E7E',
  },
  curationDesc: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7E7E7E',
    marginTop: 4,
  },
  editorQuoteBox: {
    backgroundColor: '#F8F8F8',
    borderLeftWidth: 3,
    borderLeftColor: '#E60000',
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    padding: 12,
    marginVertical: 12,
  },
  editorQuoteText: {
    fontSize: 12.5,
    lineHeight: 18,
    color: '#25282B',
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E2E2',
    paddingTop: 10,
  },
  tagGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  pillTag: {
    backgroundColor: '#F2F2F2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  pillTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#25282B',
  },
  detailCtaBtn: {
    backgroundColor: '#E60000',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  detailCtaText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '900',
  },
  rankingList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E2E2',
    overflow: 'hidden',
  },
  rankingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F4',
  },
  rankingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rankNumberCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNumberText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  rankingThumb: {
    width: 44,
    height: 44,
    borderRadius: 4,
    backgroundColor: '#F5F5F4',
  },
  rankingInfo: {
    flex: 1,
  },
  rankingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rankingShopName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#25282B',
  },
  rankingBranch: {
    fontSize: 10,
    color: '#A8A29E',
    fontWeight: '700',
  },
  rankingStyle: {
    fontSize: 11,
    color: '#78716C',
    marginTop: 2,
  },
  rankingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 8,
  },
  rankingViews: {
    fontSize: 11,
    fontWeight: '500',
    color: '#7E7E7E',
  },
  rankingArrow: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D6D3D1',
  },
  nearbyList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E2E2',
    overflow: 'hidden',
  },
  nearbyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E2E2',
  },
  nearbyNum: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7E7E7E',
    width: 20,
    textAlign: 'center',
  },
  nearbyThumb: {
    width: 52,
    height: 52,
    borderRadius: 6,
    backgroundColor: '#F2F2F2',
  },
  nearbyInfo: {
    flex: 1,
  },
  nearbyShopName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#25282B',
  },
  nearbyStyle: {
    fontSize: 11,
    color: '#7E7E7E',
    marginTop: 2,
  },
  nearbyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  nearbyDist: {
    fontSize: 10,
    color: '#7E7E7E',
    fontWeight: '500',
  },
  nearbyDot: {
    fontSize: 10,
    color: '#7E7E7E',
  },
  nearbyStatus: {
    fontSize: 10,
    color: '#2E7D32',
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    alignItems: 'center',
    gap: 6,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerLinkText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#7E7E7E',
  },
  footerDot: {
    color: '#E2E2E2',
  },
  copyright: {
    fontSize: 9.5,
    color: '#A0A0A0',
    fontWeight: '500',
  },
  fabBackdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 20,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 30,
    alignItems: 'flex-end',
    gap: 10,
  },
  fabMenuList: {
    alignItems: 'flex-end',
    gap: 8,
  },
  fabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fabMenuLabel: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#25282B',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E2E2',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  fabMenuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E2E2',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  fabBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
});
