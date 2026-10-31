import { NavLink } from 'react-router-dom'
import { Icon } from './Icon'

export function BottomNav({ onAdd }: { onAdd: () => void }) {
  return (
    <nav className="bottom-nav" aria-label="주 메뉴">
      <p className="rail-brand">Wander Jar</p>
      <NavLink to="/" end className="nav-item">
        <Icon name="jar" />
        <span>보관함</span>
      </NavLink>
      <NavLink to="/savings" className="nav-item">
        <Icon name="coins" />
        <span>저축</span>
      </NavLink>
      <button className="nav-add" onClick={onAdd} aria-label="여행지 담기">
        <Icon name="plus" size={26} />
        <span className="rail-only">여행지 담기</span>
      </button>
      <NavLink to="/settings" className="nav-item">
        <Icon name="settings" />
        <span>설정</span>
      </NavLink>
    </nav>
  )
}
