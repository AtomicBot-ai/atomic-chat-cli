/** A stand-in for the browser's `EventSource`: records what was opened and lets a test push relay frames. */
export class FakeEventSource extends EventTarget {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2

  static instances: FakeEventSource[] = []

  static reset() {
    FakeEventSource.instances = []
  }

  static get last(): FakeEventSource | undefined {
    return FakeEventSource.instances[FakeEventSource.instances.length - 1]
  }

  readonly url: string
  readonly withCredentials: boolean
  readyState = FakeEventSource.CONNECTING

  constructor(url: string, init?: EventSourceInit) {
    super()
    this.url = url
    this.withCredentials = init?.withCredentials ?? false
    FakeEventSource.instances.push(this)
  }

  /** What the relay sends: one `id` / `event` / `data` frame, the data as JSON. */
  emit(event: string, data: unknown, id = 'r1') {
    this.readyState = FakeEventSource.OPEN
    this.dispatchEvent(new MessageEvent(event, { data: JSON.stringify(data), lastEventId: id }))
  }

  close() {
    this.readyState = FakeEventSource.CLOSED
  }
}
