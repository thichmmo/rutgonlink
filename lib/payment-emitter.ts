import EventEmitter from 'events'

// Singleton across hot reloads in dev
const g = globalThis as unknown as { _paymentEmitter?: EventEmitter }

export const paymentEmitter: EventEmitter =
  g._paymentEmitter ?? (g._paymentEmitter = new EventEmitter())

paymentEmitter.setMaxListeners(500)
