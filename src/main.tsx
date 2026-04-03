import React, { useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'

type ApiResponse<T> = {
  success: boolean
  data: T
}

type ShelterSummary = {
  shelterId: string
  shelterName: string
  shelterType: string
  district: string
  address: string
  latitude: number
  longitude: number
  openStatus: string
  capacity: number
  distanceMeters?: number | null
}

type ShelterDetail = ShelterSummary & {
  phone?: string | null
  openingHours: string
  note: string
}

type ShelterMapGroup = {
  shelterType: string
  color: string
  shelters: ShelterSummary[]
}

const API_BASE_URL = '/api/v1'
const DEFAULT_POSITION = { latitude: 37.5665, longitude: 126.9780 }
const FAVORITES_STORAGE_KEY = 'shelter-now:favorites'

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`)
  if (!response.ok) throw new Error(`request failed: ${response.status}`)
  const json = (await response.json()) as ApiResponse<T>
  return json.data
}

function formatDistance(distanceMeters?: number | null) {
  if (distanceMeters == null) return '거리 미확인'
  if (distanceMeters < 1000) return `${distanceMeters}m`
  return `${(distanceMeters / 1000).toFixed(1)}km`
}

function formatPosition(latitude: number, longitude: number) {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
}

function App() {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [districtFilter, setDistrictFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState<'distance' | 'capacity' | 'name'>('distance')
  const [position, setPosition] = useState(DEFAULT_POSITION)
  const [shelters, setShelters] = useState<ShelterSummary[]>([])
  const [mapGroups, setMapGroups] = useState<ShelterMapGroup[]>([])
  const [selectedShelter, setSelectedShelter] = useState<ShelterDetail | null>(null)
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [locationMessage, setLocationMessage] = useState('서울시청 기준으로 불러오는 중')

  const types = useMemo(() => mapGroups.map((group) => group.shelterType), [mapGroups])
  const statuses = useMemo(
    () => ['운영중', '상시개방', '운영준비'],
    [],
  )
  const districts = useMemo(
    () => [...new Set(shelters.map((item) => item.district))].sort(),
    [shelters],
  )
  const favoriteShelters = useMemo(
    () => shelters.filter((item) => favoriteIds.includes(item.shelterId)),
    [favoriteIds, shelters],
  )

  async function loadMap() {
    const data = await fetchJson<ShelterMapGroup[]>('/shelters/map')
    setMapGroups(data)
  }

  async function loadShelters(nextPosition = position) {
    setLoading(true)
    setErrorMessage('')
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set('query', query.trim())
      if (typeFilter) params.set('shelterType', typeFilter)
      if (districtFilter) params.set('district', districtFilter)
      if (statusFilter) params.set('openStatus', statusFilter)
      params.set('sortBy', sortBy)
      params.set('latitude', String(nextPosition.latitude))
      params.set('longitude', String(nextPosition.longitude))

      const data = await fetchJson<ShelterSummary[]>(`/shelters?${params.toString()}`)
      setShelters(data)
      if (data[0]) {
        void focusShelter(data[0].shelterId)
      }
    } catch {
      setErrorMessage('쉼터 목록을 불러오지 못했습니다.')
      setShelters([])
      setSelectedShelter(null)
    } finally {
      setLoading(false)
    }
  }

  async function focusShelter(shelterId: string) {
    const data = await fetchJson<ShelterDetail>(`/shelters/${shelterId}`)
    setSelectedShelter(data)
  }

  function requestCurrentPosition() {
    if (!navigator.geolocation) {
      setLocationMessage('브라우저 위치 기능을 지원하지 않아 서울시청 기준으로 제공 중')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (geo) => {
        const nextPosition = {
          latitude: geo.coords.latitude,
          longitude: geo.coords.longitude,
        }
        setPosition(nextPosition)
        setLocationMessage(`현재 위치 기준 ${formatPosition(nextPosition.latitude, nextPosition.longitude)}`)
        void loadShelters(nextPosition)
      },
      () => {
        setLocationMessage('위치 권한이 없어 서울시청 기준으로 제공 중')
      },
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  function toggleFavorite(shelterId: string) {
    setFavoriteIds((prev) => {
      const next = prev.includes(shelterId)
        ? prev.filter((id) => id !== shelterId)
        : [...prev, shelterId]
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  function openExternalMap(shelter: ShelterDetail) {
    const url = `https://map.naver.com/v5/search/${encodeURIComponent(shelter.shelterName)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  useEffect(() => {
    const storedFavorites = localStorage.getItem(FAVORITES_STORAGE_KEY)
    if (storedFavorites) {
      try {
        setFavoriteIds(JSON.parse(storedFavorites))
      } catch {
        localStorage.removeItem(FAVORITES_STORAGE_KEY)
      }
    }
    void loadMap()
    void loadShelters()
    requestCurrentPosition()
  }, [])

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">ShelterNow</p>
          <h1>가까운 대피소와 쉼터를 더 빨리 찾는 방법</h1>
          <p className="summary">
            현재 위치 기준으로 가까운 무더위쉼터, 한파쉼터, 민방위대피소, 임시주거시설을
            한 화면에서 탐색하는 공공 안전 서비스다.
          </p>
        </div>
        <div className="hero-card">
          <span className="label">Current Focus</span>
          <strong>{selectedShelter?.shelterName ?? '대표 쉼터를 선택해봐'}</strong>
          <p>{selectedShelter?.note ?? '쉼터를 선택하면 운영 상태와 상세 정보를 보여준다.'}</p>
          <small className="location-copy">{locationMessage}</small>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Map</p>
            <h2>유형별 쉼터 맵</h2>
          </div>
        </div>
        <div className="map-groups">
          {mapGroups.map((group) => (
            <article key={group.shelterType} className="map-group-card">
              <div className="map-group-head">
                <span className="map-dot" style={{ backgroundColor: group.color }} />
                <strong>{group.shelterType}</strong>
                <small>{group.shelters.length}개</small>
              </div>
              <div className="map-track" style={{ ['--line-color' as string]: group.color }}>
                {group.shelters.map((shelter) => (
                  <button
                    key={shelter.shelterId}
                    type="button"
                    className={`map-node${selectedShelter?.shelterId === shelter.shelterId ? ' selected' : ''}`}
                    onClick={() => void focusShelter(shelter.shelterId)}
                  >
                    <span className="map-node-dot" style={{ backgroundColor: group.color }} />
                    <strong>{shelter.shelterName}</strong>
                    <span>{shelter.district}</span>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Search</p>
            <h2>가까운 쉼터 탐색</h2>
          </div>
        </div>
        <div className="action-row">
          <button type="button" className="secondary-button" onClick={() => requestCurrentPosition()}>
            현재 위치로 재조회
          </button>
          <small className="location-copy">{locationMessage}</small>
        </div>
        <div className="search-box">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="쉼터 이름 또는 주소" />
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="">전체 유형</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select value={districtFilter} onChange={(event) => setDistrictFilter(event.target.value)}>
            <option value="">전체 자치구</option>
            {districts.map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">전체 운영 상태</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as 'distance' | 'capacity' | 'name')}>
            <option value="distance">거리순</option>
            <option value="capacity">수용인원순</option>
            <option value="name">이름순</option>
          </select>
          <button type="button" onClick={() => void loadShelters()}>
            Search
          </button>
        </div>
        {loading ? <p className="feedback">쉼터를 불러오는 중...</p> : null}
        {errorMessage ? <p className="feedback error">{errorMessage}</p> : null}
        {favoriteShelters.length ? (
          <div className="favorite-strip">
            <span className="label">Favorites</span>
            <div className="favorite-chip-row">
              {favoriteShelters.map((shelter) => (
                <button
                  key={shelter.shelterId}
                  type="button"
                  className="favorite-chip"
                  onClick={() => void focusShelter(shelter.shelterId)}
                >
                  {shelter.shelterName}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="shelter-grid">
          {shelters.map((shelter) => (
            <div
              key={shelter.shelterId}
              className={`shelter-card${selectedShelter?.shelterId === shelter.shelterId ? ' selected' : ''}`}
            >
              <button type="button" className="shelter-card-main" onClick={() => void focusShelter(shelter.shelterId)}>
                <strong>{shelter.shelterName}</strong>
                <span>{shelter.shelterType}</span>
                <small>
                  {shelter.district} · {formatDistance(shelter.distanceMeters)}
                </small>
              </button>
              <button
                type="button"
                className={`favorite-button${favoriteIds.includes(shelter.shelterId) ? ' active' : ''}`}
                onClick={() => toggleFavorite(shelter.shelterId)}
              >
                {favoriteIds.includes(shelter.shelterId) ? '저장됨' : '즐겨찾기'}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="detail-panel">
        <div>
          <p className="eyebrow">Detail</p>
          <h2>{selectedShelter?.shelterName ?? '쉼터를 선택하면 상세 정보를 보여준다'}</h2>
        </div>
        {selectedShelter ? (
          <div className="detail-grid">
            <article className="detail-card">
              <span className="label">Type</span>
              <strong>{selectedShelter.shelterType}</strong>
              <p>{selectedShelter.openStatus}</p>
            </article>
            <article className="detail-card">
              <span className="label">Capacity</span>
              <strong>{selectedShelter.capacity}명</strong>
              <p>{selectedShelter.openingHours}</p>
            </article>
            <article className="detail-card wide">
              <span className="label">Address</span>
              <strong>{selectedShelter.address}</strong>
              <p>{selectedShelter.note}</p>
              <p className="detail-meta">
                {selectedShelter.phone ? `연락처 ${selectedShelter.phone}` : '연락처 미등록'} · 현재 위치 기준{' '}
                {formatDistance(shelters.find((item) => item.shelterId === selectedShelter.shelterId)?.distanceMeters)}
              </p>
              <div className="detail-actions">
                <button type="button" className="secondary-button" onClick={() => openExternalMap(selectedShelter)}>
                  외부 지도 열기
                </button>
                {selectedShelter.phone ? (
                  <a className="link-button" href={`tel:${selectedShelter.phone}`}>
                    전화하기
                  </a>
                ) : null}
              </div>
            </article>
          </div>
        ) : null}
      </section>
    </main>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
