export function niceAlert(message: string) {
  if (typeof document === 'undefined') return

  const existing = document.getElementById('app-alert-overlay')
  if (existing) existing.remove()

  const overlay = document.createElement('div')
  overlay.id = 'app-alert-overlay'
  overlay.style.position = 'fixed'
  overlay.style.inset = '0'
  overlay.style.background = 'rgba(0,0,0,0.45)'
  overlay.style.display = 'flex'
  overlay.style.alignItems = 'center'
  overlay.style.justifyContent = 'center'
  overlay.style.zIndex = '9999'

  const box = document.createElement('div')
  box.style.background = '#fff'
  box.style.borderRadius = '12px'
  box.style.boxShadow = '0 10px 30px rgba(0,0,0,0.15)'
  box.style.padding = '20px'
  box.style.maxWidth = '360px'
  box.style.width = '90%'
  box.style.color = '#111827'
  box.style.fontFamily = 'Inter, system-ui, -apple-system, sans-serif'

  const title = document.createElement('div')
  title.innerText = 'Aviso'
  title.style.fontWeight = '700'
  title.style.fontSize = '16px'
  title.style.marginBottom = '8px'
  title.style.color = '#111827'

  const msg = document.createElement('div')
  msg.innerText = message
  msg.style.fontSize = '14px'
  msg.style.lineHeight = '1.5'
  msg.style.color = '#374151'
  msg.style.marginBottom = '16px'

  const button = document.createElement('button')
  button.innerText = 'Cerrar'
  button.style.width = '100%'
  button.style.padding = '10px 12px'
  button.style.background = '#4f46e5'
  button.style.color = '#fff'
  button.style.border = 'none'
  button.style.borderRadius = '8px'
  button.style.fontWeight = '600'
  button.style.cursor = 'pointer'
  button.onclick = () => overlay.remove()

  box.appendChild(title)
  box.appendChild(msg)
  box.appendChild(button)
  overlay.appendChild(box)
  document.body.appendChild(overlay)
}

