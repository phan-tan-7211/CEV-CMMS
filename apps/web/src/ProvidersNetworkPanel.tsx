import { useState } from 'react'
import './ProvidersNetworkPanel.css'

export function ProvidersNetworkPanel() {
  const [tab, setTab] = useState<'search' | 'chat'>('search')
  const [query, setQuery] = useState('')

  return <section className="providers-network-panel" aria-labelledby="providers-network-title">
    <div className="providers-network-header">
      <div><p className="eyebrow">CEV CMMS · Nhà cung cấp</p><h2 id="providers-network-title">Nhà cung cấp & Mạng lưới</h2><p>Quản lý nhà cung cấp, thông tin liên hệ và mạng lưới dịch vụ.</p></div>
      <button className="providers-add-button" type="button" onClick={() => window.alert('Biểu mẫu thêm nhà cung cấp sẽ được nối dữ liệu ở bước tiếp theo.')}>＋ Thêm nhà cung cấp</button>
    </div>
    <div className="providers-network-tabs" role="tablist" aria-label="Nhà cung cấp">
      <button type="button" role="tab" aria-selected={tab === 'search'} className={tab === 'search' ? 'active' : ''} onClick={() => setTab('search')}>Tìm kiếm</button>
      <button type="button" role="tab" aria-selected={tab === 'chat'} className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>Chat</button>
    </div>
    {tab === 'search' ? <div className="providers-search-area">
      <label htmlFor="providers-search">Tìm kiếm nhà cung cấp</label>
      <input id="providers-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên, địa chỉ hoặc số điện thoại" />
      <div className="providers-empty-state"><strong>{query ? 'Không tìm thấy nhà cung cấp phù hợp' : 'Chưa có nhà cung cấp được hiển thị'}</strong><span>Thêm nhà cung cấp mới hoặc thay đổi từ khóa tìm kiếm.</span></div>
    </div> : <div className="providers-empty-state providers-chat-state"><strong>Chat với nhà cung cấp</strong><span>Khu vực trao đổi với nhà cung cấp sẽ được nối sau khi có dữ liệu hội thoại.</span></div>}
  </section>
}
