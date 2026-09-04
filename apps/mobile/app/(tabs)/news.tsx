import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { Bell, Tag } from 'lucide-react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function NewsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerBox}>
        <Text style={[styles.title, { color: colors.text }]}>단골 매장 소식</Text>
        <Text style={styles.subtitle}>내가 찜한 매장의 팝업, 한정 메뉴 소식입니다.</Text>
      </View>

      <View style={[styles.newsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.tagBadge}><Text style={styles.tagText}>한정 메뉴</Text></View>
        <Text style={[styles.shopTitle, { color: colors.text }]}>멘야준 망원 본점</Text>
        <Text style={styles.newsBody}>이번 주말(9/6~9/7) 가을 한정 '흑식초 산미 쇼유 츠케멘' 50그릇 한정 개시합니다.</Text>
        <Text style={styles.dateText}>2026. 09. 04</Text>
      </View>
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
  newsCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  tagBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFE9D6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 8,
  },
  tagText: {
    color: '#D95A00',
    fontSize: 11,
    fontWeight: '700',
  },
  shopTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  newsBody: {
    fontSize: 13,
    color: '#4E5968',
    lineHeight: 18,
    marginBottom: 10,
  },
  dateText: {
    fontSize: 12,
    color: '#8B95A1',
  },
});
