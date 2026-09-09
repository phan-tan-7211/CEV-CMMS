import { useState } from 'react'
import './CustomersListPanel.css'

const SAMPLE_CUSTOMERS = [{ name: 'CEV Vietnam', contact: '—', address: 'Khu công nghiệp', phone: '—' }]

export function CustomersListPanel() {
  const [query, setQuery] = useState('')
  const rows = SAMPLE_CUSTOMERS.filter((row) => (row.name + ' ' + row.address + ' ' + row.phone).toLowerCase().includes(query.toLowerCase()))
  return <section className="customers-list-panel" aria-labelledby="customers-list-title">
    <header className="customers-list-header">
      <div><p className="eyebrow">CEV CMMS · Khách hàng</p><h2 id="customers-list-title">Khách hàng</h2><p>Quản lý khách hàng liên quan đến thiết bị và công việc.</p></div>
      <div className="customers-list-actions"><button type="button" className="secondary-button">Nhập / Xuất</button><button type="button" className="primary-button" onClick={() => window.alert('Biểu mẫu tạo khách hàng sẽ được nối dữ liệu ở bước tiếp theo.')}>＋ Tạo khách hàng</button></div>
    </header>
    <div className="customers-list-toolbar"><span>{rows.length} khách hàng</span><label htmlFor="customers-search">Tìm kiếm</label><input id="customers-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm kiếm" /></div>
    <div className="customers-table-wrap"><table><thead><tr><th>Tên khách hàng</th><th>Người liên hệ</th><th>Địa chỉ</th><th>Số điện thoại</th><th aria-label="Thao tác" /></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.name}><td><strong>{row.name}</strong></td><td>{row.contact}</td><td>{row.address}</td><td>{row.phone}</td><td><button type="button" className="table-action">Mở</button></td></tr>) : <tr><td colSpan={5} className="customers-empty">Không tìm thấy khách hàng</td></tr>}</tbody></table></div>
  </section>
}
