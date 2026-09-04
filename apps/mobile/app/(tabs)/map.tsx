import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MapPin, Navigation, Compass } from 'lucide-react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function MapScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.mapPlaceholder}>
        <Compass size={48} color="#FF6B00" style={{ marginBottom: 12 }} />
        <Text style={[styles.placeholderTitle, { color: colors.text }]}>내 주변 라멘 지도</Text>
        <Text style={styles.placeholderDesc}>위치 기반으로 서울/경기 및 전국 라멘 맛집의{"\n"}영업시간, 실시간 대기, 평점을 탐색합니다.</Text>
        
        <View style={styles.pillRow}>
          <View style={styles.pillActive}><Text style={styles.pillActiveText}>전체</Text></View>
          <View style={styles.pill}><Text style={styles.pillText}>쇼유</Text></View>
          <View style={styles.pill}><Text style={styles.pillText}>돈코츠</Text></View>
          <View style={styles.pill}><Text style={styles.pillText}>츠케멘</Text></View>
        </View>

        <TouchableOpacity style={styles.actionBtn}>
          <Navigation size={16} color="#FFFFFF" />
          <Text style={styles.actionBtnText}>내 위치 중심으로 탐색</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  mapPlaceholder: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E8EB',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  placeholderDesc: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  pillActive: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pillActiveText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 12,
  },
  pill: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E8EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pillText: {
    color: '#4E5968',
    fontSize: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF6B00',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
