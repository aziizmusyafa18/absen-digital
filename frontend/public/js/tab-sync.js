/**
 * TabSync Utility - Cross-tab communication using BroadcastChannel API
 * Enables real-time data synchronization across multiple browser tabs
 */

const TabSync = {
    channel: null,
    listeners: {},

    /**
     * Initialize the BroadcastChannel
     * @param {string} channelName - Unique channel name for the app
     */
    init(channelName = 'absen-digital-sync') {
        if (this.channel) {
            this.channel.close();
        }
        this.channel = new BroadcastChannel(channelName);

        this.channel.onmessage = (event) => {
            const { type, data, source } = event.data;
            if (this.listeners[type]) {
                this.listeners[type].forEach(callback => {
                    callback(data, source);
                });
            }
        };

        console.log('TabSync initialized');
    },

    /**
     * Send a message to all other tabs
     * @param {string} type - Event type
     * @param {any} data - Data to send
     */
    broadcast(type, data) {
        if (!this.channel) {
            console.warn('TabSync not initialized');
            return;
        }
        this.channel.postMessage({
            type,
            data,
            timestamp: Date.now(),
            source: 'tab-sync'
        });
    },

    /**
     * Listen for messages from other tabs
     * @param {string} type - Event type to listen for
     * @param {function} callback - Callback function(data, source)
     */
    on(type, callback) {
        if (!this.listeners[type]) {
            this.listeners[type] = [];
        }
        this.listeners[type].push(callback);
    },

    /**
     * Remove a listener
     * @param {string} type - Event type
     * @param {function} callback - Callback to remove
     */
    off(type, callback) {
        if (this.listeners[type]) {
            this.listeners[type] = this.listeners[type].filter(cb => cb !== callback);
        }
    },

    /**
     * Close the channel (cleanup)
     */
    destroy() {
        if (this.channel) {
            this.channel.close();
            this.channel = null;
            this.listeners = {};
        }
    }
};

/**
 * Storage event listener for cross-tab login/logout sync
 * Automatically logs out all tabs when one tab logs out
 */
function initStorageSync() {
    window.addEventListener('storage', (event) => {
        if (event.key === null) {
            // localStorage was cleared (logout)
            window.location.reload();
        } else if (event.key === 'token' && !event.newValue) {
            // Token was removed
            window.location.href = 'index.html';
        }
    });
}

/**
 * Auto-refresh data helper
 * @param {string} role - User role (admin, guru, orang_tua)
 * @param {function} refreshFunction - Function to call for refreshing data
 */
function setupAutoRefresh(role, refreshFunction) {
    TabSync.on('refresh-' + role, (data, source) => {
        console.log(`Received refresh signal for ${role} from another tab`);
        if (typeof refreshFunction === 'function') {
            refreshFunction();
        }
    });

    TabSync.on('new-absen', (data, source) => {
        console.log('Received new-absen event from another tab');
        if (typeof refreshFunction === 'function') {
            refreshFunction();
        }
    });
}

/**
 * Call this when data changes and needs to sync to other tabs
 * @param {string} role - User role
 * @param {string} eventType - Event type (e.g., 'new-absen')
 * @param {any} eventData - Optional data to include
 */
function notifyOtherTabs(role, eventType, eventData = null) {
    TabSync.broadcast(eventType, {
        role,
        ...eventData
    });
}

// Export for use in other scripts
window.TabSync = TabSync;
window.initStorageSync = initStorageSync;
window.setupAutoRefresh = setupAutoRefresh;
window.notifyOtherTabs = notifyOtherTabs;
