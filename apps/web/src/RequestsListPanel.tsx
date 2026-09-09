import { useState } from 'react'
import './RequestsListPanel.css'

export function RequestsListPanel() {
  const [query, setQuery] = useState('')
  return <section className="requests-list-panel" aria-labelledby="requests-list-title">
    <header className="requests-list-header"><div><p className="eyebrow">CEV CMMS · Yêu cầu</p><h2 id="requests-list-title">Yêu cầu</h2><p>Tiếp nhận và theo dõi các yêu cầu bảo trì từ người dùng.</p></div><button type="button" className="requests-create-button" onClick={() => window.alert('Biểu mẫu tạo yêu cầu sẽ được nối dữ liệu ở bước tiếp theo.')}>＋ Tạo yêu cầu</button></header>
    <div className="requests-list-toolbar"><button type="button">Bộ lọc</button><button type="button">Tài sản⌄</button><button type="button">Trạng thái⌄</button><button type="button">Phân công cho⌄</button><button type="button">Địa điểm⌄</button><button type="button" className="requests-reset">Đặt lại bộ lọc</button><label htmlFor="requests-search">Tìm kiếm</label><input id="requests-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm kiếm" /></div>
    <div className="requests-empty-state"><strong>{query ? 'Không tìm thấy yêu cầu' : 'Chưa có yêu cầu'}</strong><span>Những yêu cầu mới gửi sẽ xuất hiện tại đây.</span></div>
  </section>
}
