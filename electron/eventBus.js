// Local Event Bus - replaces Supabase Realtime for offline mode
const { EventEmitter } = require('events');

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
    this.subscribers = new Map();
  }

  // Subscribe to table changes (mimics Supabase Realtime)
  subscribe(channel, table, callback) {
    const key = `${channel}:${table}`;
    
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    
    this.subscribers.get(key).add(callback);
    
    // Listen to events for this table
    const listener = (payload) => {
      callback(payload);
    };
    
    this.on(table, listener);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.get(key)?.delete(callback);
      this.off(table, listener);
    };
  }

  // Emit table change event
  emitChange(table, eventType, data) {
    const payload = {
      eventType,
      new: eventType !== 'DELETE' ? data : null,
      old: eventType === 'DELETE' ? data : null,
      table,
      schema: 'public',
      commit_timestamp: new Date().toISOString()
    };
    
    this.emit(table, payload);
  }

  // Specific event emitters for common tables
  emitOrderChange(eventType, order) {
    this.emitChange('orders', eventType, order);
  }

  emitBillChange(eventType, bill) {
    this.emitChange('bills', eventType, bill);
  }

  emitTableChange(eventType, table) {
    this.emitChange('tables', eventType, table);
  }

  emitComandaChange(eventType, comanda) {
    this.emitChange('comandas', eventType, comanda);
  }

  emitProductChange(eventType, product) {
    this.emitChange('products', eventType, product);
  }

  // Clear all subscribers
  clear() {
    this.subscribers.clear();
    this.removeAllListeners();
  }
}

// Singleton instance
const eventBus = new EventBus();

module.exports = { EventBus, eventBus };
