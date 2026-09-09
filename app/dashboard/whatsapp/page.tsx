import WhatsAppAnalyzer from '@/components/WhatsAppAnalyzer'

const BORDER = '1px solid #162032'

export default function WhatsAppPage() {
  return (
    <div style={{ borderTop: BORDER, padding: '24px', background: '#000000', minHeight: '100%' }}>
      <WhatsAppAnalyzer />
    </div>
  )
}
