import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, MapPin, List, Navigation, Map, ChevronRight, Star } from 'lucide-react-native';

const MENU_FILTERS = ['전체', '쇼유', '돈코츠', '시오', '미소', '토리파이탄'];

const SHOPS = [
  {
    id: 0,
    name: '멘야준',
    branch: '망원 본점',
    style: '쇼유 라멘',
    pinLabel: '준',
    dist: '420m',
    status: '영업 중',
    lastOrder: '20:30',
    match: 91,
    photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=300&h=200&fit=crop&auto=format&q=80',
    spec: '자가제면 · 닭과 오리 더블 육수',
  },
  {
    id: 1,
    name: '후쿠 라멘',
    branch: '합정점',
    style: '미소 라멘',
    pinLabel: '후',
    dist: '680m',
    status: '영업 중',
    lastOrder: '21:00',
    match: 82,
    photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=300&h=200&fit=crop&auto=format&q=80',
    spec: '진한 삿포로 적된장 육수',
  },
  {
    id: 2,
    name: '오레노라멘',
    branch: '마포 본점',
    style: '토리파이탄',
    pinLabel: '오',
    dist: '1.4km',
    status: '영업 중',
    lastOrder: '20:00',
    match: 75,
    photo: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=300&h=200&fit=crop&auto=format&q=80',
    spec: '닭백탕 · 미쉐린 빕구르망',
  },
];

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const [selectedFilter, setSelectedFilter] = useState('전체');
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [selectedShop, setSelectedShop] = useState(SHOPS[0]);

  return (
    <View style={styles.root}>
      {/* 상단 검색 & 필터 헤더 */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.searchBar}>
          <Search size={18} color="#7E7E7E" />
          <TextInput
            placeholder="매장명, 메뉴, 지역 검색"
            placeholderTextColor="#A0A0A0"
            style={styles.searchInput}
          />
        </View>

        {/* 필터 칩 가로 스크롤 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterScrollContent}>
          {MENU_FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterChip, selectedFilter === filter && styles.filterChipActive]}
              onPress={() => setSelectedFilter(filter)}
            >
              <Text style={[styles.filterChipText, selectedFilter === filter && styles.filterChipTextActive]}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 지도 / 목록 뷰 영역 */}
      {viewMode === 'map' ? (
        <View style={styles.mapArea}>
          {/* 모의 네이티브 지도 배경 */}
          <View style={styles.simulatedMap}>
            <View style={styles.mapGridPattern} />
            
            {/* 마커들 */}
            {SHOPS.map((shop) => (
              <TouchableOpacity
                key={shop.id}
                style={[
                  styles.markerContainer,
                  selectedShop.id === shop.id && styles.markerContainerActive,
                  shop.id === 0 && { top: '35%', left: '42%' },
                  shop.id === 1 && { top: '50%', left: '60%' },
                  shop.id === 2 && { top: '25%', left: '70%' },
                ]}
                onPress={() => setSelectedShop(shop)}
              >
                <View style={[styles.markerPin, selectedShop.id === shop.id && styles.markerPinActive]}>
                  <Text style={[styles.markerPinText, selectedShop.id === shop.id && styles.markerPinTextActive]}>
                    {shop.pinLabel}
                  </Text>
                </View>
                <View style={[styles.markerBadge, selectedShop.id === shop.id && styles.markerBadgeActive]}>
                  <Text style={[styles.markerBadgeText, selectedShop.id === shop.id && styles.markerBadgeTextActive]}>
                    {shop.name}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}

            {/* 내 위치 버튼 */}
            <TouchableOpacity style={styles.myLocationBtn} activeOpacity={0.8}>
              <Navigation size={18} color="#25282B" />
            </TouchableOpacity>

            {/* 뷰 모드 전환 버튼 (지도 ↔ 목록) */}
            <TouchableOpacity style={styles.toggleViewBtn} onPress={() => setViewMode('list')} activeOpacity={0.8}>
              <List size={16} color="#FFFFFF" />
              <Text style={styles.toggleViewText}>목록으로 보기</Text>
            </TouchableOpacity>
          </View>

          {/* 하단 선택된 매장 플로팅 카드 */}
          <View style={styles.bottomCardWrapper}>
            <TouchableOpacity style={styles.shopCard} activeOpacity={0.9}>
              <Image source={{ uri: selectedShop.photo }} style={styles.shopCardThumb} />
              <View style={styles.shopCardInfo}>
                <View style={styles.shopCardHeader}>
                  <Text style={styles.shopCardName}>{selectedShop.name} <Text style={styles.shopCardBranch}>{selectedShop.branch}</Text></Text>
                  <View style={styles.matchScoreBadge}>
                    <Text style={styles.matchScoreText}>{selectedShop.match}% 일치</Text>
                  </View>
                </View>
                <Text style={styles.shopCardSpec}>{selectedShop.spec}</Text>
                <View style={styles.shopCardMeta}>
                  <Text style={styles.shopCardDist}>{selectedShop.dist}</Text>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.shopCardStatus}>● {selectedShop.status}</Text>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.lastOrderText}>L.O {selectedShop.lastOrder}</Text>
                </View>
              </View>
              <ChevronRight size={20} color="#D6D3D1" style={{ alignSelf: 'center', marginRight: 4 }} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView style={styles.listContainer} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          <View style={styles.listHeaderRow}>
            <Text style={styles.listCount}>총 <Text style={{ color: '#E60000', fontWeight: '900' }}>{SHOPS.length}개</Text> 매장</Text>
            <TouchableOpacity style={styles.toggleToMapBtn} onPress={() => setViewMode('map')}>
              <Map size={14} color="#25282B" />
              <Text style={styles.toggleToMapText}>지도 보기</Text>
            </TouchableOpacity>
          </View>

          {SHOPS.map((shop) => (
            <TouchableOpacity key={shop.id} style={styles.shopListItem} activeOpacity={0.7}>
              <Image source={{ uri: shop.photo }} style={styles.listThumb} />
              <View style={styles.listInfo}>
                <View style={styles.shopCardHeader}>
                  <Text style={styles.shopCardName}>{shop.name} <Text style={styles.shopCardBranch}>{shop.branch}</Text></Text>
                  <View style={styles.matchScoreBadge}>
                    <Text style={styles.matchScoreText}>{shop.match}%</Text>
                  </View>
                </View>
                <Text style={styles.shopCardSpec}>{shop.spec}</Text>
                <View style={styles.shopCardMeta}>
                  <Text style={styles.shopCardDist}>{shop.dist}</Text>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.shopCardStatus}>● {shop.status}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#25282B',
    fontWeight: '600',
    padding: 0,
  },
  filterScroll: {
    marginTop: 10,
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E2E2E2',
  },
  filterChipActive: {
    backgroundColor: '#25282B',
    borderColor: '#25282B',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7E7E7E',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  mapArea: {
    flex: 1,
    position: 'relative',
  },
  simulatedMap: {
    flex: 1,
    backgroundColor: '#F4F3F0',
    position: 'relative',
  },
  mapGridPattern: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    opacity: 0.1,
  },
  markerContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  markerContainerActive: {
    zIndex: 10,
    transform: [{ scale: 1.1 }],
  },
  markerPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#25282B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  markerPinActive: {
    backgroundColor: '#E60000',
    borderColor: '#FFFFFF',
  },
  markerPinText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#25282B',
  },
  markerPinTextActive: {
    color: '#FFFFFF',
  },
  markerBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E2E2',
    marginTop: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  markerBadgeActive: {
    backgroundColor: '#25282B',
    borderColor: '#25282B',
  },
  markerBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#25282B',
  },
  markerBadgeTextActive: {
    color: '#FFFFFF',
  },
  myLocationBtn: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E2E2',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleViewBtn: {
    position: 'absolute',
    alignSelf: 'center',
    top: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#25282B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  toggleViewText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  bottomCardWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
  },
  shopCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E2E2E2',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    gap: 12,
  },
  shopCardThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F2F2F2',
  },
  shopCardInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  shopCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shopCardName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#25282B',
  },
  shopCardBranch: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7E7E7E',
  },
  matchScoreBadge: {
    backgroundColor: '#FFF0E5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  matchScoreText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#E60000',
  },
  shopCardSpec: {
    fontSize: 11.5,
    color: '#7E7E7E',
    marginTop: 3,
  },
  shopCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  shopCardDist: {
    fontSize: 11,
    fontWeight: '700',
    color: '#25282B',
  },
  metaDot: {
    color: '#7E7E7E',
    fontSize: 10,
  },
  shopCardStatus: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2E7D32',
  },
  lastOrderText: {
    fontSize: 10.5,
    color: '#7E7E7E',
  },
  listContainer: {
    flex: 1,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  listCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#25282B',
  },
  toggleToMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F2F2F2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  toggleToMapText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#25282B',
  },
  shopListItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E2E2',
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  listThumb: {
    width: 70,
    height: 70,
    borderRadius: 6,
    backgroundColor: '#F2F2F2',
  },
  listInfo: {
    flex: 1,
    justifyContent: 'center',
  },
});
