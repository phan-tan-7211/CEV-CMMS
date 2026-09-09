import './CycleCountsPanel.css'

export function CycleCountsPanel() {
  return <section className="cycle-counts-panel" aria-labelledby="cycle-counts-title">
    <header className="cycle-counts-header"><div><p className="eyebrow">CEV CMMS · Kho</p><h2 id="cycle-counts-title">Kiểm kê chu kỳ</h2><p>Lập kế hoạch và theo dõi các đợt kiểm kê phụ tùng.</p></div><button type="button" className="cycle-count-create" onClick={() => window.alert('Biểu mẫu tạo kiểm kê chu kỳ sẽ được nối dữ liệu ở bước tiếp theo.')}>＋ Tạo kiểm kê chu kỳ</button></header>
    <div className="cycle-counts-toolbar"><button type="button">Trạng thái⌄</button><button type="button">Ngày tạo⌄</button><button type="button">Bộ lọc</button><button type="button" className="cycle-count-reset">Đặt lại bộ lọc</button></div>
    <div className="cycle-counts-empty"><div className="cycle-counts-icon" aria-hidden="true">▣</div><strong>Chưa có kiểm kê chu kỳ</strong><span>Tạo đợt kiểm kê đầu tiên để bắt đầu đối chiếu tồn kho.</span><button type="button" onClick={() => window.alert('Biểu mẫu tạo kiểm kê chu kỳ sẽ được nối dữ liệu ở bước tiếp theo.')}>Tạo kiểm kê chu kỳ</button></div>
  </section>
}
