'use client'

import { useRef } from 'react'
import { Modal, Button } from 'antd'
import { QRCodeCanvas } from 'qrcode.react'
import { Download, QrCode } from 'lucide-react'

interface Props {
  url: string
  title: string | null
  onClose: () => void
}

export default function QRCodeModal({ url, title, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  const handleDownload = () => {
    const canvas = containerRef.current?.querySelector('canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `qr-${(title || 'link').replace(/[^a-z0-9]/gi, '-')}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <Modal
      open={true}
      onCancel={onClose}
      width={340}
      title={
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-sky-100 rounded-lg flex items-center justify-center">
            <QrCode className="w-3.5 h-3.5 text-sky-600" />
          </div>
          <span className="font-semibold text-gray-900 text-sm">QR Code</span>
        </div>
      }
      footer={
        <div className="flex gap-3">
          <Button onClick={onClose} style={{ flex: 1 }}>Đóng</Button>
          <Button
            type="primary"
            icon={<Download className="w-4 h-4" />}
            onClick={handleDownload}
            style={{ flex: 1 }}
          >
            Tải xuống PNG
          </Button>
        </div>
      }
      destroyOnClose
    >
      <div className="flex flex-col items-center gap-4 py-4">
        {title && <p className="text-sm font-medium text-gray-800 text-center">{title}</p>}
        <p className="text-xs text-gray-400 text-center break-all max-w-xs">{url}</p>
        <div ref={containerRef} className="p-4 bg-white border border-gray-200 rounded-2xl shadow-sm">
          <QRCodeCanvas
            value={url}
            size={220}
            level="M"
            includeMargin={false}
            bgColor="#ffffff"
            fgColor="#1e293b"
          />
        </div>
        <p className="text-xs text-gray-400 text-center">Quét mã QR để mở link</p>
      </div>
    </Modal>
  )
}
