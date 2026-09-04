import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, PenSquare, Heart, MessageCircle, Eye, Tag } from 'lucide-react-native';

const CATEGORIES = ['전체', '맛집후기', 'Q&A', '라멘꿀팁', '자유토크'];

const POSTS = [
  {
    postId: 1,
    category: 'REVIEW',
    categoryLabel: '맛집후기',
    title: '망원·합정 일대 인생 쇼유 라멘 3곳 추천합니다',
    content: '자가제면과 동물계 육수의 밸런스가 완벽한 곳들만 엄선했습니다. 1위는 역시 멘야준, 2위는 세상끝의라멘, 3위는 묘코입니다.',
    authorName: '쇼유장인',
    authorLevel: '라멘 미식가 (Lv.5)',
    createdAt: '2026.09.01',
    likeCount: 42,
    commentCount: 3,
    viewCount: 318,
    isLiked: true,
    shopName: '멘야준',
  },
  {
    postId: 2,
    category: 'QUESTION',
    categoryLabel: 'Q&A',
    title: '돈코츠 농도 높은 곳 처음 가보는데 어디가 입문용으로 좋을까요?',
    content: '하쿠텐이나 부탄츄 가보려고 하는데 극강의 꼬릿함에 적응할 수 있을지 걱정입니다. 추천 부탁드려요!',
    authorName: '라린이',
    authorLevel: '라멘집 탐험가 (Lv.3)',
    createdAt: '2026.09.01',
    likeCount: 15,
    commentCount: 2,
    viewCount: 184,
    isLiked: false,
    shopName: '오레노라멘',
  },
  {
    postId: 3,
    category: 'TIP',
    categoryLabel: '라멘꿀팁',
    title: '연남동 신규 오픈 라멘집 차슈 추가 및 공깃밥 무료 꿀팁',
    content: '점심시간 한정으로 차슈 2장 추가 주문 시 공깃밥이 무한 리필됩니다. 국물에 말아먹기 딱 좋은 염도예요.',
    authorName: '스프원샷',
    authorLevel: '라멘 마니아 (Lv.4)',
    createdAt: '2026.08.31',
    likeCount: 29,
    commentCount: 7,
    viewCount: 412,
    isLiked: false,
    shopName: '후쿠 라멘',
  },
];

export default function LoungeScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'community' | 'feed'>('community');
  const [selectedCat, setSelectedCat] = useState('전체');

  return (
    <View style={styles.root}>
      {/* 상단 헤더 */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>커뮤니티 라운지</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn}>
              <Search size={20} color="#25282B" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.writeBtn}>
              <PenSquare size={16} color="#FFFFFF" />
              <Text style={styles.writeBtnText}>글쓰기</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 탭 전환 (커뮤니티 ↔ 라멘로그 피드) */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.switchTab, activeTab === 'community' && styles.switchTabActive]}
            onPress={() => setActiveTab('community')}
          >
            <Text style={[styles.switchTabText, activeTab === 'community' && styles.switchTabTextActive]}>
              자유 라운지
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.switchTab, activeTab === 'feed' && styles.switchTabActive]}
            onPress={() => setActiveTab('feed')}
          >
            <Text style={[styles.switchTabText, activeTab === 'feed' && styles.switchTabTextActive]}>
              라멘로그 피드
            </Text>
          </TouchableOpacity>
        </View>

        {/* 카테고리 칩 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catScrollContent}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, selectedCat === cat && styles.catChipActive]}
              onPress={() => setSelectedCat(cat)}
            >
              <Text style={[styles.catChipText, selectedCat === cat && styles.catChipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 게시글 목록 */}
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {POSTS.map((post) => (
          <TouchableOpacity key={post.postId} style={styles.postCard} activeOpacity={0.8}>
            <View style={styles.postTopRow}>
              <View style={styles.catBadge}>
                <Text style={styles.catBadgeText}>{post.categoryLabel}</Text>
              </View>
              {post.shopName && (
                <View style={styles.shopTag}>
                  <Text style={styles.shopTagText}>📍 {post.shopName}</Text>
                </View>
              )}
            </View>

            <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>
            <Text style={styles.postContent} numberOfLines={2}>{post.content}</Text>

            <View style={styles.postFooter}>
              <View style={styles.authorRow}>
                <Text style={styles.authorName}>{post.authorName}</Text>
                <Text style={styles.authorLevel}>{post.authorLevel}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.dateText}>{post.createdAt}</Text>
              </View>

              <View style={styles.metricGroup}>
                <View style={styles.metricItem}>
                  <Heart size={14} color={post.isLiked ? '#E60000' : '#8B95A1'} fill={post.isLiked ? '#E60000' : 'none'} />
                  <Text style={[styles.metricCount, post.isLiked && { color: '#E60000', fontWeight: '700' }]}>{post.likeCount}</Text>
                </View>
                <View style={styles.metricItem}>
                  <MessageCircle size={14} color="#8B95A1" />
                  <Text style={styles.metricCount}>{post.commentCount}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Eye size={14} color="#8B95A1" />
                  <Text style={styles.metricCount}>{post.viewCount}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#25282B',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    padding: 6,
  },
  writeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E60000',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  writeBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  tabSwitcher: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#F2F2F2',
    borderRadius: 6,
    padding: 3,
    marginBottom: 10,
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
    fontSize: 12.5,
    fontWeight: '700',
    color: '#7E7E7E',
  },
  switchTabTextActive: {
    color: '#25282B',
    fontWeight: '900',
  },
  catScroll: { marginTop: 4 },
  catScrollContent: {
    paddingHorizontal: 16,
    gap: 6,
  },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E2E2E2',
  },
  catChipActive: {
    backgroundColor: '#25282B',
    borderColor: '#25282B',
  },
  catChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#7E7E7E',
  },
  catChipTextActive: {
    color: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E2E2',
    padding: 16,
    marginBottom: 12,
  },
  postTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  catBadge: {
    backgroundColor: '#FFF0E5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  catBadgeText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#E60000',
  },
  shopTag: {
    backgroundColor: '#F2F2F2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  shopTagText: {
    fontSize: 10.5,
    color: '#4E5968',
    fontWeight: '600',
  },
  postTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#25282B',
    lineHeight: 20,
    marginBottom: 6,
  },
  postContent: {
    fontSize: 12.5,
    color: '#7E7E7E',
    lineHeight: 18,
    marginBottom: 12,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F2F2F2',
    paddingTop: 10,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  authorName: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#25282B',
  },
  authorLevel: {
    fontSize: 10,
    color: '#E60000',
    fontWeight: '700',
  },
  metaDot: {
    color: '#A0A0A0',
    fontSize: 10,
  },
  dateText: {
    fontSize: 10.5,
    color: '#A0A0A0',
  },
  metricGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metricCount: {
    fontSize: 11,
    color: '#7E7E7E',
    fontWeight: '600',
  },
});
