import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronDown, Bookmark, Store, ImageOff, PenLine, Phone, Check, CalendarCheck } from 'lucide-react'
import type { ShopCatalogItem } from '../data/shops'

interface Props {
  /** 원장(`src/data/shops.ts`)의 매장. 없는 정보는 비어 있고 화면이 빈 상태를 보여준다. */
  shop: ShopCatalogItem
  savedShop: boolean
  isLoggedIn?: boolean
  onLoginRequest?: () => void
  onSaveShop: () => void
  onBack: () => void
  onRecord: () => void
}

const DAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
const DAY_SHORT = ['일', '월', '화', '수', '목', '금', '토']

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  )
}

const formatDistance = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`)

/** 영업 상태는 원장의 businessStatus와 isOpen에서만 파생한다. */
function businessLabel(shop: ShopCatalogItem): { label: string; open: boolean } {
  switch (shop.businessStatus) {
    case 'OPERATIONAL':
      return shop.isOpen ? { label: '영업 중', open: true } : { label: '준비 중', open: false }
    case 'CLOSED_TEMPORARILY':
      return { label: '임시 휴업', open: false }
    case 'CLOSED_PERMANENTLY':
      return { label: '폐업', open: false }
    default:
      return { label: '영업 정보 확인 필요', open: false }
  }
}

export default function ShopDetailScreen({ shop, savedShop, isLoggedIn = true, onLoginRequest, onSaveShop, onBack, onRecord }: Props) {
  const [photoIdx, setPhotoIdx] = useState(0)
  const [photoLoaded, setPhotoLoaded] = useState(false)
  const [showSavedToast, setShowSavedToast] = useState(false)
  const [showHoursDetail, setShowHoursDetail] = useState(false)

  // 다른 매장으로 바뀌면 사진 인덱스와 펼침 상태를 되돌린다.
  useEffect(() => {
    setPhotoIdx(0)
    setPhotoLoaded(false)
    setShowHoursDetail(false)
  }, [shop.id, shop.name])

  useEffect(() => {
    if (!showSavedToast) return
    const timer = setTimeout(() => setShowSavedToast(false), 2200)
    return () => clearTimeout(timer)
  }, [showSavedToast])

  const dayIndex = new Date().getDay()
  const todayName = DAY_NAMES[dayIndex]
  const todayShort = DAY_SHORT[dayIndex]

  const hasHours = shop.openingHours.length > 0
  const todayHourEntry = shop.openingHours.find(h => h.startsWith(todayName))
  const todayTimeText = (todayHourEntry ?? shop.openingHours[0])?.replace(/^.*?: /, '')

  const status = businessLabel(shop)
  const photo = shop.photos[photoIdx]
  const perks = [
    { label: '면 리필', value: shop.servicePerks?.noodleRefill },
    { label: '공깃밥 리필', value: shop.servicePerks?.riceRefill },
    { label: '육수 추가', value: shop.servicePerks?.soupRefill },
    { label: '양념', value: shop.servicePerks?.condiments },
  ].filter((perk): perk is { label: string; value: string } => Boolean(perk.value))
  const links = [
    shop.instagramUrl ? { key: 'instagram', label: '인스타그램', href: shop.instagramUrl, Icon: InstagramIcon } : null,
    shop.catchTableUrl ? { key: 'catchtable', label: '캐치테이블', href: shop.catchTableUrl, Icon: CalendarCheck } : null,
  ].filter((link): link is NonNullable<typeof link> => link !== null)

  const handleSave = () => {
    if (!isLoggedIn) {
      ;(onLoginRequest ?? onSaveShop)()
      return
    }
    onSaveShop()
    if (!savedShop) setShowSavedToast(true)
  }

  const iconButtonClass =
    'w-11 h-11 rounded-full bg-[#25282B]/70 flex items-center justify-center text-white active:scale-95 transition-transform'

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white text-[#25282B]">
      {/* 본문 스크롤 영역. 하단 고정 바에 가려지지 않도록 아래 여백을 둔다. */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-8">
        {/* 1. 대표 사진 */}
        <div className="relative aspect-[4/3] bg-[#E9E9E9]">
          {photo ? (
            <img
              key={photo}
              src={photo}
              alt={`${shop.name} 대표 사진`}
              onLoad={() => setPhotoLoaded(true)}
              className={`w-full h-full object-cover transition-opacity duration-200 ${photoLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#6B6E73]">
              <ImageOff className="w-7 h-7" aria-hidden="true" />
              <span className="text-[13px] font-medium">아직 등록된 사진이 없어요</span>
            </div>
          )}
          {photo && shop.photos.length > 1 && (
            <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
          )}

          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 pt-3 z-10">
            <button type="button" onClick={onBack} className={iconButtonClass} aria-label="뒤로가기">
              <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={handleSave} className={iconButtonClass} aria-label={savedShop ? '저장 취소' : '가고 싶어요'} aria-pressed={savedShop}>
              <Bookmark className="w-5 h-5" fill={savedShop ? '#E60000' : 'none'} color={savedShop ? '#E60000' : 'currentColor'} aria-hidden="true" />
            </button>
          </div>

          {shop.photos.length > 1 && (
            <div className="absolute bottom-3 left-4 right-4 flex gap-2 z-10 overflow-x-auto no-scrollbar" role="group" aria-label="매장 사진 선택">
              {shop.photos.map((p, i) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => {
                    if (i !== photoIdx) setPhotoLoaded(false)
                    setPhotoIdx(i)
                  }}
                  aria-label={`사진 ${i + 1}`}
                  aria-pressed={photoIdx === i}
                  className={`w-12 h-12 rounded-[6px] overflow-hidden border-2 flex-shrink-0 transition-opacity bg-[#E9E9E9] ${
                    photoIdx === i ? 'border-[#E60000] opacity-100' : 'border-white/70 opacity-75'
                  }`}
                >
                  <img src={p} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 2. 매장 헤드라인 */}
        <section className="px-5 pt-5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-bold">
            <span className={status.open ? 'text-[#2E7D32]' : 'text-[#6B6E73]'}>● {status.label}</span>
            {shop.distanceM > 0 && (
              <>
                <span className="text-[#BEBEBE]" aria-hidden="true">·</span>
                <span className="text-[#6B6E73]">{formatDistance(shop.distanceM)}</span>
              </>
            )}
            {shop.reviewCount > 0 && (
              <>
                <span className="text-[#BEBEBE]" aria-hidden="true">·</span>
                <span className="text-[#6B6E73]">라멘로그 {shop.reviewCount.toLocaleString()}개</span>
              </>
            )}
            {shop.rating > 0 && (
              <>
                <span className="text-[#BEBEBE]" aria-hidden="true">·</span>
                <span className="text-[#6B6E73]">★ {shop.rating.toFixed(1)}</span>
              </>
            )}
          </div>

          <p className="text-[13px] font-bold text-[#6B6E73] mt-3">{shop.style}</p>
          <h1 className="text-[20px] font-extrabold tracking-tight leading-tight mt-0.5 break-keep">
            {shop.name}
            {shop.branch && <span className="text-[#6B6E73] font-bold"> · {shop.branch}</span>}
          </h1>
          {shop.spec && <p className="text-[14px] text-[#25282B] mt-1.5 break-keep">{shop.spec}</p>}
          {shop.address && <p className="text-[13px] text-[#6B6E73] mt-1 break-keep">{shop.address}</p>}

          {shop.tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 mt-3" aria-label="특징">
              {shop.tags.map(tag => (
                <li key={tag} className="bg-[#F2F2F2] px-2.5 py-1 rounded-[4px] text-[12px] font-bold text-[#25282B]">
                  {tag}
                </li>
              ))}
            </ul>
          )}

          {shop.matchScore > 0 && (
            <div className="mt-4 pt-4 border-t border-[#E2E2E2]">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-bold text-[#6B6E73]">내 취향 일치도</span>
                <span className="text-[20px] font-extrabold tracking-tight text-[#E60000]">{shop.matchScore}%</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-[#F2F2F2] overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={shop.matchScore} aria-label="내 취향 일치도">
                <div className="h-full bg-[#E60000] rounded-full" style={{ width: `${shop.matchScore}%` }} />
              </div>
            </div>
          )}
        </section>

        {/* 3. 가게 소개 */}
        {shop.description && (
          <section className="mx-5 mt-5 bg-[#F2F2F2] rounded-[6px] p-4">
            <div className="flex items-center gap-1.5 mb-1.5 text-[13px] font-bold">
              <Store className="w-4 h-4" aria-hidden="true" />
              <span>가게 소개</span>
            </div>
            <p className="text-[14px] leading-relaxed break-keep">{shop.description}</p>
          </section>
        )}

        {/* 4. 매장 제공 혜택 */}
        {perks.length > 0 && (
          <section className="px-5 mt-5">
            <h2 className="text-[17px] font-extrabold tracking-tight mb-2.5">매장 혜택</h2>
            <dl className="grid grid-cols-2 gap-2">
              {perks.map(perk => (
                <div key={perk.label} className="bg-[#F2F2F2] py-2.5 px-3 rounded-[6px]">
                  <dt className="text-[12px] text-[#6B6E73] font-bold">{perk.label}</dt>
                  <dd className="text-[13px] font-bold mt-0.5 break-keep">{perk.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* 5. 가게 상세 정보 */}
        <section className="mx-5 mt-5 rounded-[6px] bg-[#25282B] p-5 text-white">
          <h2 className="text-[17px] font-extrabold tracking-tight mb-3">가게 상세 정보</h2>

          <div className="text-[14px]">
            <div className="flex justify-between gap-4 border-b border-white/15 py-3">
              <span className="text-white/70 flex-shrink-0">주소</span>
              <span className="text-right break-keep font-medium">{shop.address || '주소 정보가 아직 없어요'}</span>
            </div>

            <div className="border-b border-white/15">
              {hasHours ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowHoursDetail(open => !open)}
                    aria-expanded={showHoursDetail}
                    aria-controls="shop-hours-detail"
                    className="w-full min-h-11 flex justify-between items-center gap-4 py-2 text-left"
                  >
                    <span className="text-white/70 flex-shrink-0">영업시간</span>
                    <span className="flex items-center gap-2 font-medium">
                      <span className="text-[12px] font-bold text-white/70">오늘({todayShort})</span>
                      <span>{todayTimeText}</span>
                      <ChevronDown className={`w-4 h-4 text-white/70 transition-transform duration-200 ${showHoursDetail ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </span>
                  </button>

                  {showHoursDetail && (
                    <ul id="shop-hours-detail" className="mb-3 pt-2 border-t border-white/15 text-[13px] anim-fade-in">
                      {shop.openingHours.map(h => {
                        const isToday = h.startsWith(todayName)
                        const [day, ...rest] = h.split(':')
                        return (
                          <li key={h} className={`flex justify-between px-2 py-1.5 rounded-[4px] ${isToday ? 'bg-white/10 font-bold' : 'text-white/80'}`}>
                            <span className="flex items-center gap-2">
                              {day}
                              {isToday && <span className="text-[12px] font-bold text-[#FF6B6B]">오늘</span>}
                            </span>
                            <span>{rest.join(':').trim()}</span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </>
              ) : (
                <div className="flex justify-between gap-4 py-3">
                  <span className="text-white/70 flex-shrink-0">영업시간</span>
                  <span className="text-right text-white/80">영업시간 정보가 아직 없어요</span>
                </div>
              )}
            </div>

            {shop.lastOrder && (
              <div className="flex justify-between gap-4 border-b border-white/15 py-3">
                <span className="text-white/70 flex-shrink-0">라스트오더</span>
                <span className="font-medium">{shop.lastOrder}</span>
              </div>
            )}

            {shop.priceRange && (
              <div className="flex justify-between gap-4 border-b border-white/15 py-3">
                <span className="text-white/70 flex-shrink-0">가격대</span>
                <span className="font-medium">{shop.priceRange}</span>
              </div>
            )}

            {shop.phone && (
              <div className="flex justify-between items-center gap-4 border-b border-white/15 py-1.5">
                <span className="text-white/70 flex-shrink-0">전화번호</span>
                <a href={`tel:${shop.phone}`} className="min-h-11 inline-flex items-center gap-1.5 font-medium">
                  <Phone className="w-4 h-4 text-white/70" aria-hidden="true" />
                  {shop.phone}
                </a>
              </div>
            )}
          </div>

          {links.length > 0 && (
            <div className="mt-4 flex gap-2">
              {links.map(({ key, label, href, Icon }) => (
                <a
                  key={key}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 h-11 rounded-[6px] bg-white/10 border border-white/15 text-white text-[13px] font-bold flex items-center justify-center gap-2 active:bg-white/20 transition-colors"
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                </a>
              ))}
            </div>
          )}
        </section>

        {/* 6. 방문자 라멘로그 */}
        <section className="px-5 mt-6">
          <div className="flex items-baseline justify-between pb-3 border-b border-[#E2E2E2]">
            <h2 className="text-[17px] font-extrabold tracking-tight">
              방문자 라멘로그{shop.reviews.length > 0 && <span className="text-[#6B6E73] font-bold"> {shop.reviews.length}</span>}
            </h2>
            {shop.reviews.length > 0 && <span className="text-[12px] font-bold text-[#6B6E73]">구글 리뷰 연동</span>}
          </div>

          {shop.reviews.length > 0 ? (
            <ul className="divide-y divide-[#E2E2E2]">
              {shop.reviews.map(r => (
                <li key={`${r.author}-${r.time}`} className="py-4">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="text-[15px] font-bold truncate">{r.author}</span>
                      {r.level && <span className="text-[12px] text-[#6B6E73] shrink-0">{r.level}</span>}
                    </div>
                    <span className="text-[12px] text-[#6B6E73] shrink-0">{r.time}</span>
                  </div>
                  <span className="text-[12px] font-bold text-[#6B6E73]" aria-label={`별점 ${r.rating}점`}>
                    {'★'.repeat(Math.max(0, Math.min(5, Math.round(r.rating))))}
                  </span>
                  <p className="text-[14px] text-[#25282B] leading-relaxed mt-1 break-keep">{r.text}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-8 text-center">
              <p className="text-[15px] font-bold">아직 라멘로그가 없어요</p>
              <p className="text-[13px] text-[#6B6E73] mt-1">이 가게의 첫 번째 기록을 남겨보세요.</p>
              <button
                type="button"
                onClick={onRecord}
                className="mt-4 inline-flex items-center gap-1.5 min-h-11 px-5 rounded-[60px] border border-[#25282B] text-[14px] font-bold active:bg-[#F2F2F2] transition-colors"
              >
                <PenLine className="w-4 h-4" aria-hidden="true" />
                첫 기록 남기기
              </button>
            </div>
          )}
        </section>
      </div>

      {/* 하단 고정 액션 바 */}
      <footer className="flex-shrink-0 border-t border-[#E2E2E2] bg-white px-4 py-3">
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={handleSave}
            aria-pressed={savedShop}
            className={`flex-1 h-13 rounded-[60px] border flex items-center justify-center gap-2 text-[14px] font-bold active:scale-98 transition-transform ${
              savedShop ? 'border-[#E60000] bg-[#FFF0F0] text-[#E60000]' : 'border-[#E2E2E2] bg-white text-[#25282B]'
            }`}
          >
            <Bookmark className="w-4.5 h-4.5" fill={savedShop ? '#E60000' : 'none'} aria-hidden="true" />
            {savedShop ? '저장됨' : '가고 싶어요'}
          </button>
          <button
            type="button"
            onClick={onRecord}
            className="flex-1 h-13 rounded-[60px] bg-[#E60000] text-white text-[14px] font-bold active:scale-98 transition-transform flex items-center justify-center"
          >
            먹은 라멘 기록하기
          </button>
        </div>
      </footer>

      {showSavedToast && (
        <div role="status" className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 flex justify-center pointer-events-none anim-fade-in-up">
          <div className="bg-[#25282B] text-white text-[13px] font-bold px-4 py-3 rounded-[6px] shadow-[0_4px_16px_rgba(0,0,0,0.12)] flex items-center gap-2 whitespace-nowrap">
            <Check className="w-4 h-4 text-[#FF6B6B]" aria-hidden="true" />
            <span>가고 싶은 라멘집에 저장했어요</span>
          </div>
        </div>
      )}
    </div>
  )
}
