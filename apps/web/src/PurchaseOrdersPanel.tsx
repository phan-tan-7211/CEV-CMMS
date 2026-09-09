import { useState } from 'react'
import './PurchaseOrdersPanel.css'

const SAMPLE_ORDERS = [{ number: 'PO-0001', supplier: 'Chưa cập nhật', status: 'Bản nháp', createdAt: '—', total: '—' }]

export function PurchaseOrdersPanel() {
  const [query, setQuery] = useState('')
  const rows = SAMPLE_ORDERS.filter((row) => (row.number + ' ' + row.supplier + ' ' + row.status).toLowerCase().includes(query.toLowerCase()))
  return <section className="purchase-orders-panel" aria-labelledby="purchase-orders-title">
    <header className="purchase-orders-header"><div><p className="eyebrow">CEV CMMS · Mua hàng</p><h2 id="purchase-orders-title">Đơn đặt hàng</h2><p>Theo dõi các đơn đặt hàng phụ tùng và dịch vụ.</p></div><button type="button" className="purchase-order-create" onClick={() => window.alert('Biểu mẫu tạo đơn đặt hàng sẽ được nối dữ liệu ở bước tiếp theo.')}>＋ Tạo đơn đặt hàng</button></header>
    <div className="purchase-orders-toolbar"><span>{rows.length} đơn đặt hàng</span><label htmlFor="purchase-orders-search">Tìm kiếm</label><input id="purchase-orders-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm kiếm" /></div>
    <div className="purchase-orders-table-wrap"><table><thead><tr><th>Số đơn</th><th>Nhà cung cấp</th><th>Trạng thái</th><th>Ngày tạo</th><th>Tổng tiền</th><th aria-label="Thao tác" /></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.number}><td><strong>{row.number}</strong></td><td>{row.supplier}</td><td><span className="purchase-order-status">{row.status}</span></td><td>{row.createdAt}</td><td>{row.total}</td><td><button type="button" className="purchase-order-open">Mở</button></td></tr>) : <tr><td colSpan={6} className="purchase-orders-empty">Không tìm thấy đơn đặt hàng</td></tr>}</tbody></table></div>
  </section>
}
