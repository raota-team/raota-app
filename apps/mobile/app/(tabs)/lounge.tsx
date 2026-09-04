import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { MessageSquare, MessageCircle, Heart } from 'lucide-react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

const POSTS = [
  {
    id: 1,
    category: 'TIP',
    title: '연남동 신규 오픈 라멘집 차슈 추가 꿀팁 공유합니다',
    author: '스프원샷',
    time: '30분 전',
    likes: 15,
    comments: 6,
  },
  {
    id: 2,
    category: 'FREE',
    title: '오사카 라멘 원정 3박4일 코스 짜봤는데 피드백 부탁드려요!',
    author: '라멘오타쿠',
    time: '2시간 전',
    likes: 42,
    comments: 18,
  },
];

export default function LoungeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerBox}>
        <Text style={[styles.title, { color: colors.text }]}>라멘 오타쿠 라운지</Text>
        <Text style={styles.subtitle}>라멘 애호가들과 맛집 정보와 솔직 후기를 나눠보세요.</Text>
      </View>

      {POSTS.map((post) => (
        <View key={post.id} style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.badgeRow}>
            <View style={styles.catBadge}><Text style={styles.catBadgeText}>{post.category}</Text></View>
            <Text style={styles.timeText}>{post.time}</Text>
          </View>
          <Text style={[styles.postTitle, { color: colors.text }]}>{post.title}</Text>
          <View style={styles.postFooter}>
            <Text style={styles.authorText}>{post.author}</Text>
            <View style={styles.iconGroup}>
              <View style={styles.metaItem}>
                <Heart size={14} color="#8B95A1" />
                <Text style={styles.metaCount}>{post.likes}</Text>
              </View>
              <View style={styles.metaItem}>
                <MessageCircle size={14} color="#8B95A1" />
                <Text style={styles.metaCount}>{post.comments}</Text>
              </View>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  headerBox: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  postCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  catBadge: {
    backgroundColor: '#FFF0E5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  catBadgeText: {
    color: '#FF6B00',
    fontSize: 11,
    fontWeight: '700',
  },
  timeText: {
    color: '#8B95A1',
    fontSize: 12,
  },
  postTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 12,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  authorText: {
    fontSize: 12,
    color: '#8B95A1',
  },
  iconGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaCount: {
    fontSize: 12,
    color: '#8B95A1',
  },
});
