import { useState } from 'react'
import './SetsListPanel.css'

export function SetsListPanel() {
  const [query, setQuery] = useState('')
  return <section className="sets-list-panel" aria-labelledby="sets-list-title">
    <header className="sets-list-header"><div><p className="eyebrow">CEV CMMS · Phân loại</p><h2 id="sets-list-title">Bộ thẻ</h2><p>Nhóm các thẻ để phân loại thiết bị, công việc và yêu cầu.</p></div><button type="button" className="sets-create-button" onClick={() => window.alert('Biểu mẫu tạo bộ thẻ sẽ được nối dữ liệu ở bước tiếp theo.')}>＋ Tạo bộ</button></header>
    <div className="sets-list-toolbar"><label htmlFor="sets-search">Tìm kiếm</label><input id="sets-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm kiếm" /></div>
    <div className="sets-empty-state"><div className="sets-empty-icon" aria-hidden="true">▱</div><strong>{query ? 'Không tìm thấy bộ thẻ' : 'Chưa có bộ thẻ'}</strong><span>Tạo bộ thẻ để bắt đầu tổ chức dữ liệu trong CEV CMMS.</span></div>
  </section>
}
