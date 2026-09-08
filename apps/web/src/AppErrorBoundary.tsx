import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Equipment app fatal error', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="fatal-screen" role="alert">
        <div className="fatal-card">
          <p className="eyebrow">CEV Equipment</p>
          <h1>Ứng dụng gặp lỗi</h1>
          <p>Dữ liệu gốc không bị thay đổi bởi màn hình lỗi này. Hãy tải lại ứng dụng.</p>
          <button type="button" onClick={() => window.location.reload()}>Tải lại</button>
        </div>
      </main>
    )
  }
}
