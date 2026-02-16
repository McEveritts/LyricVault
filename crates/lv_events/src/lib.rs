use chrono::Utc;
use lv_types::EventEnvelope;
use serde_json::Value;
use tokio::sync::broadcast;

#[derive(Clone)]
pub struct EventBus {
    tx: broadcast::Sender<EventEnvelope>,
}

impl EventBus {
    pub fn new(capacity: usize) -> Self {
        let (tx, _) = broadcast::channel(capacity.max(16));
        Self { tx }
    }

    pub fn publish(&self, event: impl Into<String>, data: Value) {
        let envelope = EventEnvelope {
            event: event.into(),
            data,
            ts: Utc::now().timestamp_millis() as f64 / 1000.0,
        };
        let _ = self.tx.send(envelope);
    }

    pub fn subscribe(&self) -> broadcast::Receiver<EventEnvelope> {
        self.tx.subscribe()
    }
}

impl Default for EventBus {
    fn default() -> Self {
        Self::new(64)
    }
}
